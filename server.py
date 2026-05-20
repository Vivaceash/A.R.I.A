from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import pwd
import time
import json
import asyncio
import sqlite3
import subprocess
from datetime import datetime, timedelta
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DIRECTORY = "/home/astra/concilio"
DB_FILE = "/home/astra/Antigravity/aria.db"

# Initialize SQLite Database
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS alert_history (
            id TEXT PRIMARY KEY,
            filename TEXT,
            description TEXT,
            event_type TEXT,
            severity TEXT,
            icon_class TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    try:
        c.execute('ALTER TABLE alert_history ADD COLUMN resolved BOOLEAN DEFAULT 0')
    except sqlite3.OperationalError:
        pass # Column already exists
    try:
        c.execute('ALTER TABLE alert_history ADD COLUMN resolved_by TEXT')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE alert_history ADD COLUMN resolved_at DATETIME')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE alert_history ADD COLUMN file_path TEXT')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE alert_history ADD COLUMN file_size INTEGER')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE alert_history ADD COLUMN owner TEXT')
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()

init_db()

def log_event(alert_id, filename, description, event_type, severity, icon_class, timestamp=None, file_path=None, file_size=None, owner=None):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    if not timestamp:
        timestamp = datetime.now().isoformat()
        
    c.execute('''
        INSERT OR IGNORE INTO alert_history (id, filename, description, event_type, severity, icon_class, timestamp, file_path, file_size, owner)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (alert_id, filename, description, event_type, severity, icon_class, timestamp, file_path, file_size, owner))
    conn.commit()
    conn.close()

def get_alert_history(limit=50, hours=None):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # Query all, order by newest, and we'll filter robustly in Python
    c.execute('SELECT id, filename, description, event_type, severity, icon_class, timestamp, resolved, resolved_by, resolved_at, file_path, file_size, owner FROM alert_history ORDER BY timestamp DESC LIMIT 500')
    rows = c.fetchall()
    conn.close()
    
    cutoff_time = None
    if hours is not None:
        cutoff_time = datetime.now() - timedelta(hours=hours)

    alerts = []
    for r in rows:
        dt_str = r[6]
        try:
            # Handle both SQLite CURRENT_TIMESTAMP and isoformat
            dt_str_clean = dt_str.replace("Z", "+00:00")
            if "T" not in dt_str_clean and " " in dt_str_clean:
                dt_str_clean = dt_str_clean.replace(" ", "T")
            dt = datetime.fromisoformat(dt_str_clean)
        except Exception:
            dt = datetime.now()
            
        if cutoff_time and dt < cutoff_time:
            continue
            
        alerts.append({
            "id": r[0],
            "title": r[1],
            "description": r[2],
            "type": r[3],
            "severity": r[4],
            "iconClass": r[5],
            "time": calculate_time_ago(r[6]),
            "timestamp": r[6],
            "resolved": bool(r[7]),
            "resolvedBy": r[8],
            "resolvedAt": r[9],
            "filePath": r[10],
            "fileSize": r[11],
            "owner": r[12]
        })
        if len(alerts) >= limit:
            break
            
    return alerts

def get_last_known_size(filename):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT file_size FROM alert_history WHERE filename = ? AND file_size IS NOT NULL ORDER BY timestamp DESC LIMIT 1', (filename,))
    row = c.fetchone()
    conn.close()
    if row:
        return row[0]
    return None

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                print(f"Error sending message: {e}")

manager = ConnectionManager()

def calculate_time_ago(dt_str):
    try:
        # SQLite CURRENT_TIMESTAMP is UTC
        # If dt_str has a timezone, parse it, else assume UTC or naive
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        # Hack for naive sqlite timestamps
        if dt.tzinfo is None:
            # We assume it's local time because datetime.now() below is local time
            pass 
        diff = datetime.now() - dt
    except Exception:
        return dt_str # Fallback

    if diff.total_seconds() < 60:
        return "Hace unos segundos"
    elif diff.total_seconds() < 3600:
        return f"Hace {int(diff.total_seconds() / 60)} min"
    elif diff.total_seconds() < 86400:
        return f"Hace {int(diff.total_seconds() / 3600)} h"
    else:
        return f"Hace {int(diff.total_seconds() / 86400)} días"

def is_ignored_file(filename):
    """Ignorar archivos ocultos, de bloqueo (lock) y temporales."""
    return (
        filename.startswith('.') or 
        filename.startswith('~') or 
        filename.endswith('~') or 
        filename.endswith('#') or 
        filename.endswith('.tmp')
    )

def get_files_data(timeframe_hours=None):
    if not os.path.exists(DIRECTORY):
        return []
    
    if timeframe_hours is not None:
        cutoff_time = datetime.now() - timedelta(hours=timeframe_hours)
        cutoff_timestamp = cutoff_time.timestamp()
    else:
        cutoff_timestamp = 0
        
    files_data = []
    for filename in os.listdir(DIRECTORY):
        if is_ignored_file(filename):
            continue
            
        filepath = os.path.join(DIRECTORY, filename)
        if os.path.isfile(filepath):
            stat = os.stat(filepath)
            if stat.st_mtime >= cutoff_timestamp:
                try:
                    owner = pwd.getpwuid(stat.st_uid).pw_name
                except KeyError:
                    owner = str(stat.st_uid)
                files_data.append({
                    "name": filename,
                    "owner": owner,
                    "mtime": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "size": stat.st_size,
                    "timestamp": stat.st_mtime
                })
    files_data.sort(key=lambda x: x["timestamp"], reverse=True)
    return files_data

def seed_initial_history():
    files = get_files_data(24 * 30) # last 30 days
    for f in files:
        alert_id = f"mod-{f['name']}-{f['timestamp']}"
        description = f"Se modificó {f['name']} por {f['owner']}"
        log_event(alert_id, f['name'], description, "Modificación", "Bajo", "icon-info", f['mtime'])
        
        if f['size'] > 10 * 1024 * 1024:
            alert_id_high = f"alert-high-{f['name']}-{f['timestamp']}"
            log_event(alert_id_high, f['name'], "Archivo de gran tamaño modificado", "Posible manipulación", "Alto", "icon-danger", f['mtime'])
        elif f['name'].endswith('.doc') or f['name'].endswith('.docx') or f['name'].endswith('.xls') or f['name'].endswith('.xlsx'):
            alert_id_med = f"alert-med-{f['name']}-{f['timestamp']}"
            log_event(alert_id_med, f['name'], "Revisión manual requerida", "Inconsistencia", "Medio", "icon-warning", f['mtime'])

seed_initial_history()

@app.get("/api/stats")
def get_stats(period: str = "24h"):
    hours = {"24h": 24, "7d": 24*7, "30d": 24*30}.get(period, 24)
    files = get_files_data(hours)
    total_analyzed = len(files)
    
    recent_activity = []
    for idx, f in enumerate(files[:5]):
        recent_activity.append({
            "id": idx + 1,
            "description": f"Se modificó {f['name']} por {f['owner']}",
            "time": calculate_time_ago(f['mtime'])
        })

    # Fetch all DB alerts for the timeframe
    all_db_alerts = get_alert_history(limit=1000, hours=hours)
    
    # Calculate pie chart using severity
    pie_chart_data = {'Alto': 0, 'Medio': 0, 'Bajo': 0}
    extension_chart_data = {}
    for alert in all_db_alerts:
        sev = alert.get("severity", "Bajo")
        if sev in pie_chart_data:
            pie_chart_data[sev] += 1
            
        filename = alert.get("title", alert.get("filename", ""))
        if "." in filename:
            ext = "." + filename.split(".")[-1].lower()
        else:
            ext = "Otros"
            
        if ext in extension_chart_data:
            extension_chart_data[ext] += 1
        else:
            extension_chart_data[ext] = 1
            
    pie_data_array = []
    color_map = {
        'Alto': '#FF3366',   # Rojo neón para Alto
        'Medio': '#FFB020',  # Amarillo/Naranja para Medio
        'Bajo': '#00F0FF'    # Azul cyan para Bajo
    }
    
    for name, value in pie_chart_data.items():
        if value > 0:
            pie_data_array.append({"name": name, "value": value, "color": color_map[name]})
            
    if not pie_data_array:
        pie_data_array = [{"name": "Sin alertas", "value": 100, "color": "#1E293B"}]

    # Format extension data
    extension_data_array = []
    ext_color_map = {
        '.docx': '#02D5F5', # Bright Blue
        '.doc': '#02D5F5',
        '.xlsx': '#217346', # Excel Green
        '.xls': '#217346',
        '.csv': '#217346',
        '.pdf': '#B30B00',  # PDF Red
        '.txt': '#6B7280',  # Gray
        '.py': '#3776AB',   # Python Blue
        '.js': '#F7DF1E',   # JS Yellow
        '.html': '#E34F26', # HTML Orange
        '.css': '#1572B6',  # CSS Blue
        '.jpg': '#EC4899',  # Image Pink
        '.png': '#EC4899',
        '.zip': '#8B5CF6',  # Archive Purple
        '.tar': '#8B5CF6',
        '.rar': '#8B5CF6',
        'Otros': '#475569'  # Slate Gray
    }
    fallback_colors = ['#14B8A6', '#F59E0B', '#10B981', '#F43F5E']
    fallback_idx = 0
    
    # Sort extensions by frequency
    sorted_exts = sorted(extension_chart_data.items(), key=lambda x: x[1], reverse=True)[:6]
    for name, value in sorted_exts:
        if name in ext_color_map:
            color = ext_color_map[name]
        else:
            color = fallback_colors[fallback_idx % len(fallback_colors)]
            fallback_idx += 1
        extension_data_array.append({"name": name, "value": value, "color": color})
        
    if not extension_data_array:
        extension_data_array = [{"name": "Sin archivos", "value": 100, "color": "#1E293B"}]

    active_alerts = pie_chart_data['Alto'] + pie_chart_data['Medio']
    
    latest_alerts = all_db_alerts[:5]
        
    # Generate continuous timeline buckets for the chart
    line_chart_data = []
    now = datetime.now()
    if period == "24h":
        # Fixed scale from 00:00 to 23:00
        for i in range(24):
            line_chart_data.append({"name": f"{i:02d}:00", "alertas": 0, "detalles": []})
    elif period == "7d":
        for i in range(6, -1, -1):
            d = now - timedelta(days=i)
            line_chart_data.append({"name": d.strftime("%d %b"), "alertas": 0, "detalles": []})
    else:
        for i in range(29, -1, -1):
            d = now - timedelta(days=i)
            line_chart_data.append({"name": d.strftime("%d %b"), "alertas": 0, "detalles": []})
            
    # Fill buckets with real alerts (already fetched)
    for alert in all_db_alerts:
        if alert["severity"] in ["Alto", "Medio"]:
            try:
                dt_str_clean = alert["timestamp"].replace("Z", "+00:00")
                if "T" not in dt_str_clean and " " in dt_str_clean:
                    dt_str_clean = dt_str_clean.replace(" ", "T")
                alert_dt = datetime.fromisoformat(dt_str_clean)
            except Exception:
                alert_dt = now
                
            if period == "24h":
                b_name = alert_dt.strftime("%H:00")
            else:
                b_name = alert_dt.strftime("%d %b")
                
            for b in line_chart_data:
                if b["name"] == b_name:
                    b["alertas"] += 1
                    b["detalles"].append({
                        "title": alert.get("title", ""),
                        "severity": alert.get("severity", ""),
                        "timestamp": alert.get("timestamp", ""),
                        "type": alert.get("type", "")
                    })
                    break

    return {
        "metrics": {
            "archivos_analizados": total_analyzed,
            "alertas_activas": active_alerts,
            "comparaciones": total_analyzed * 2,
            "riesgo_promedio": "Alto" if any(a.get("severity") == "Alto" for a in latest_alerts) else ("Medio" if active_alerts > 0 else "Bajo")
        },
        "pieChart": pie_data_array,
        "extensionPieChart": extension_data_array,
        "lineChart": line_chart_data,
        "latestAlerts": latest_alerts,
        "recentActivity": recent_activity
    }

@app.get("/api/reports")
def get_reports():
    return get_alert_history(limit=100)

@app.get("/api/files")
def get_files():
    return get_files_data(timeframe_hours=None)

@app.get("/api/download/{filename}")
def download_file(filename: str):
    # Security check to prevent path traversal
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    filepath = os.path.join(DIRECTORY, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(path=filepath, filename=filename)

@app.post("/api/open-folder")
def open_folder():
    try:
        # Opens the native file explorer in Linux
        subprocess.Popen(["xdg-open", DIRECTORY])
        return {"status": "success", "message": "Folder opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel

class ResolvePayload(BaseModel):
    user: str = "Administrador Local"

@app.post("/api/alertas/{alert_id}/resolve")
async def resolve_alert(alert_id: str, payload: ResolvePayload):
    try:
        now = datetime.now().isoformat()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("UPDATE alert_history SET resolved = 1, resolved_by = ?, resolved_at = ? WHERE id = ?", (payload.user, now, alert_id))
        conn.commit()
        conn.close()
        
        # Broadcast the resolution to all connected clients
        await manager.broadcast({"type": "resolved", "alert_id": alert_id, "resolved_by": payload.user, "resolved_at": now})
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

class DirectoryMonitor(FileSystemEventHandler):
    def __init__(self, loop):
        self.loop = loop

    def on_modified(self, event):
        if not event.is_directory:
            filename = os.path.basename(event.src_path)
            if is_ignored_file(filename):
                return
                
            try:
                stat_info = os.stat(event.src_path)
                owner = pwd.getpwuid(stat_info.st_uid).pw_name
                fsize = stat_info.st_size
            except Exception:
                owner = "Sistema"
                fsize = None
                
            # Save modification to DB to keep a historical record for the Reports page
            alert_id = f"mod-{int(time.time() * 1000)}-{filename}"
            description = f"Se modificó el archivo {filename} por {owner}"
            log_event(alert_id, filename, description, "Modificación", "Bajo", "icon-info", None, event.src_path, fsize, owner)
            
            alert = {
                "id": alert_id,
                "title": filename,
                "description": description,
                "time": "Hace unos segundos",
                "severity": "Bajo",
                "iconClass": "icon-info",
                "owner": owner
            }
            
            asyncio.run_coroutine_threadsafe(
                manager.broadcast({"type": "modified", "file": filename, "alert": alert}),
                self.loop
            )

    def on_deleted(self, event):
        if not event.is_directory:
            filename = os.path.basename(event.src_path)
            if is_ignored_file(filename):
                return
                
            owner = "Sistema"
            time_str = datetime.now().strftime("%H:%M:%S")
            alert_id = f"del-{int(time.time() * 1000)}-{filename}"
            description = f"Archivo eliminado a las {time_str} por {owner}"
            
            fsize = get_last_known_size(filename)
            
            # Save to DB
            log_event(alert_id, filename, description, "Eliminado", "Alto", "icon-danger", None, event.src_path, fsize, owner)
            
            # Create a manual alert payload for WS
            alert = {
                "id": alert_id,
                "title": filename,
                "description": description,
                "time": "Hace unos segundos",
                "severity": "Alto",
                "iconClass": "icon-danger",
                "owner": owner
            }
            asyncio.run_coroutine_threadsafe(
                manager.broadcast({"type": "deleted", "file": filename, "alert": alert}),
                self.loop
            )

    def on_created(self, event):
        if not event.is_directory:
            filename = os.path.basename(event.src_path)
            if is_ignored_file(filename):
                return
                
            try:
                stat_info = os.stat(event.src_path)
                owner = pwd.getpwuid(stat_info.st_uid).pw_name
                fsize = stat_info.st_size
            except Exception:
                owner = "Sistema"
                fsize = None
                
            time_str = datetime.now().strftime("%H:%M:%S")
            alert_id = f"add-{int(time.time() * 1000)}-{filename}"
            description = f"Se creó el archivo {filename} por {owner}"
            
            # Save to DB
            log_event(alert_id, filename, description, "Creación", "Medio", "icon-warning", None, event.src_path, fsize, owner)
            
            alert = {
                "id": alert_id,
                "title": filename,
                "description": description,
                "time": "Hace unos segundos",
                "severity": "Medio",
                "iconClass": "icon-warning",
                "owner": owner
            }
            asyncio.run_coroutine_threadsafe(
                manager.broadcast({"type": "created", "file": filename, "alert": alert}),
                self.loop
            )

@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_running_loop()
    if os.path.exists(DIRECTORY):
        observer = Observer()
        event_handler = DirectoryMonitor(loop)
        observer.schedule(event_handler, DIRECTORY, recursive=False)
        observer.start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
