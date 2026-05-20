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
    c.execute('''
        CREATE TABLE IF NOT EXISTS file_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            content TEXT,
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
    try:
        c.execute('ALTER TABLE alert_history ADD COLUMN ai_analysis TEXT')
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()
    
    # Run database migration to split existing long AI markdown text to ai_analysis
    migrate_existing_data()

def migrate_existing_data():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        c.execute("SELECT id, filename, description FROM alert_history WHERE event_type = 'Comparación' AND (ai_analysis IS NULL OR ai_analysis = '')")
        rows = c.fetchall()
        for row_id, filename, desc in rows:
            if desc and (desc.startswith("Análisis de cambios") or "\n" in desc or "Análisis" in desc):
                short_desc = f"Se detectaron cambios en '{filename}' y se generó una auditoría gramatical/ortográfica."
                c.execute("UPDATE alert_history SET description = ?, ai_analysis = ? WHERE id = ?", (short_desc, desc, row_id))
        conn.commit()
    except Exception as e:
        print(f"Error migrating alert history: {e}")
    finally:
        conn.close()

init_db()

def save_file_snapshot(filename, content):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('INSERT INTO file_snapshots (filename, content) VALUES (?, ?)', (filename, content))
    conn.commit()
    conn.close()

def get_latest_snapshots(filename, limit=2):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT content, timestamp FROM file_snapshots WHERE filename = ? ORDER BY timestamp DESC LIMIT ?', (filename, limit))
    rows = c.fetchall()
    conn.close()
    return rows

def log_event(alert_id, filename, description, event_type, severity, icon_class, timestamp=None, file_path=None, file_size=None, owner=None, ai_analysis=None):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    if not timestamp:
        timestamp = datetime.now().isoformat()
        
    c.execute('''
        INSERT OR IGNORE INTO alert_history (id, filename, description, event_type, severity, icon_class, timestamp, file_path, file_size, owner, ai_analysis)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (alert_id, filename, description, event_type, severity, icon_class, timestamp, file_path, file_size, owner, ai_analysis))
    conn.commit()
    conn.close()

def get_alert_history(limit=50, hours=None):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # Query all, order by newest, and we'll filter robustly in Python
    c.execute('SELECT id, filename, description, event_type, severity, icon_class, timestamp, resolved, resolved_by, resolved_at, file_path, file_size, owner, ai_analysis FROM alert_history ORDER BY timestamp DESC LIMIT 500')
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
            "owner": r[12],
            "aiAnalysis": r[13]
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
    
    # Fetch all DB alerts for the timeframe
    all_db_alerts = get_alert_history(limit=1000, hours=hours)
    
    # Total analyzed is the number of file modifications, creations, deletions, and comparisons logged
    total_analyzed = len(all_db_alerts)
    
    # Count comparison events in the timeframe
    comparaciones = len([a for a in all_db_alerts if a.get("type") == "Comparación"])
    
    recent_activity = []
    for idx, alert in enumerate(all_db_alerts[:5]):
        recent_activity.append({
            "id": idx + 1,
            "description": alert.get("description", ""),
            "time": calculate_time_ago(alert.get("timestamp", ""))
        })
    
    # Calculate pie chart using severity (excluding resolved alerts)
    pie_chart_data = {'Alto': 0, 'Medio': 0, 'Bajo': 0}
    extension_chart_data = {}
    for alert in all_db_alerts:
        if alert.get("resolved"):
            continue
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
    
    latest_alerts = [a for a in all_db_alerts if not a.get("resolved")][:5]
        
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
            "comparaciones": comparaciones,
            "riesgo_promedio": "Alto" if any(a.get("severity") == "Alto" for a in latest_alerts) else ("Medio" if active_alerts > 0 else "Bajo")
        },
        "pieChart": pie_data_array,
        "extensionPieChart": extension_data_array,
        "lineChart": line_chart_data,
        "latestAlerts": latest_alerts,
        "recentActivity": recent_activity,
        "alerts": all_db_alerts
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

def build_realtime_system_status(current_path="/chat"):
    try:
        # 1. Date and time
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 2. Get alerts stats
        alerts = get_alert_history(limit=1000)
        total_alerts = len(alerts)
        resolved_count = sum(1 for a in alerts if a["resolved"])
        active_count = sum(1 for a in alerts if not a["resolved"])
        
        severity_counts = {"Alto": 0, "Medio": 0, "Bajo": 0}
        active_list = []
        for a in alerts:
            if not a["resolved"]:
                sev = a.get("severity", "Bajo")
                if sev in severity_counts:
                    severity_counts[sev] += 1
                if len(active_list) < 10:
                    active_list.append(f"  * [{a['severity']}] {a['title']} - {a['description']} (ID: {a['id']})")
        
        active_actionable = severity_counts['Alto'] + severity_counts['Medio']
        active_low = severity_counts['Bajo']

        # 3. Get directory files
        files = get_files_data()
        file_summary = []
        for f in files:
            file_summary.append(f"  * {f['name']} - {f['size']} bytes (Modificado por {f['owner']} en {f['mtime']})")
        
        # Format strings
        active_alerts_str = "\n".join(active_list) if active_list else "  * Sin alertas activas."
        files_str = "\n".join(file_summary) if file_summary else "  * Sin archivos en el directorio."
        
        status = f"""[ESTADO EN TIEMPO REAL DEL SISTEMA - {now_str}]
- Ruta actual de navegación del usuario: {current_path}
- Estadísticas de Alertas (Base de Datos):
  * Alertas Totales (Historial): {total_alerts}
  * Alertas Resueltas: {resolved_count}
  * Alertas Activas Totales (Sin Resolver en DB): {active_count}
- Desglose de Alertas Activas por Visibilidad en la Plataforma:
  * Alertas en la Interfaz (Centro de Alertas): {active_actionable} (Alto: {severity_counts['Alto']}, Medio: {severity_counts['Medio']})
  * Alertas Ocultas por Ruido (Bajo Impacto, no mostradas en el Centro de Alertas): {active_low} (Bajo: {severity_counts['Bajo']})
- Últimas Alertas Activas Registradas:
{active_alerts_str}
- Archivos en Directorio Local ('/home/astra/concilio'):
{files_str}"""
        return status, active_count, active_actionable
    except Exception as e:
        return f"[Error al compilar estado en tiempo real: {str(e)}]", 0, 0

class PageContext(BaseModel):
    currentPath: str = "/chat"

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatPayload(BaseModel):
    messages: list[ChatMessage]
    pageContext: PageContext = None

@app.post("/api/chat")
async def chat_endpoint(payload: ChatPayload):
    import urllib.request
    import urllib.error
    import json
    from fastapi.responses import StreamingResponse
    from rag_engine import get_directory_chunks, retrieve_context
    
    # 1. Get latest query
    latest_query = ""
    if payload.messages:
        latest_query = payload.messages[-1].content
        
    # 2. Get RAG context
    try:
        chunks = get_directory_chunks(DIRECTORY)
        rag_context = retrieve_context(latest_query, chunks, top_k=4)
    except Exception as e:
        print(f"Error in RAG retrieval: {e}")
        rag_context = f"Error al recuperar contexto de documentos locales: {str(e)}"

    # 2.5 Get Comparison snapshots context if applicable
    comparison_context = ""
    comparison_instruction = ""
    query_lower = latest_query.lower()
    if any(keyword in query_lower for keyword in ["compara", "cambio", "diferencia", "version", "versión"]):
        files = os.listdir(DIRECTORY) if os.path.exists(DIRECTORY) else []
        matched_filename = None
        # Try full filename match first
        for f in files:
            if f.lower() in query_lower:
                matched_filename = f
                break
        # Try name without extension match next
        if not matched_filename:
            for f in files:
                name_without_ext, _ = os.path.splitext(f.lower())
                if len(name_without_ext) > 2 and name_without_ext in query_lower:
                    matched_filename = f
                    break
        
        if matched_filename:
            snapshots = get_latest_snapshots(matched_filename, limit=2)
            if len(snapshots) >= 2:
                old_snap = snapshots[1][0].replace('\ufeff', '').strip()
                old_time = snapshots[1][1]
                new_snap = snapshots[0][0].replace('\ufeff', '').strip()
                new_time = snapshots[0][1]
                
                comparison_instruction = f"""[INSTRUCCIÓN CRÍTICA DE COMPARACIÓN]
El usuario desea comparar el archivo '{matched_filename}' o ver sus cambios.
Debes basar tu respuesta ÚNICAMENTE en el bloque [HISTORIAL DE VERSIONES PARA COMPARACIÓN] que se encuentra más abajo. Compara la Versión Anterior y la Versión Actual indicadas allí línea por línea. Reporta detalladamente qué se agregó, modificó o eliminó, y detecta/informa sobre cualquier error ortográfico o gramatical en la Versión Actual en comparación con la Anterior. No inventes cambios ni digas que no tienes la información."""

                comparison_context = f"""
[HISTORIAL DE VERSIONES PARA COMPARACIÓN - {matched_filename}]
- Versión Anterior (Modificada en {old_time}):
\"\"\"
{old_snap[:4000]}
\"\"\"

- Versión Actual (Modificada en {new_time}):
\"\"\"
{new_snap[:4000]}
\"\"\"
"""
            elif len(snapshots) == 1:
                snap_content = snapshots[0][0].replace('\ufeff', '').strip()
                snap_time = snapshots[0][1]
                from rag_engine import extract_file_content
                current_content = extract_file_content(os.path.join(DIRECTORY, matched_filename)).replace('\ufeff', '').strip()
                if current_content and current_content != snap_content:
                    comparison_instruction = f"""[INSTRUCCIÓN CRÍTICA DE COMPARACIÓN]
El usuario desea comparar el archivo '{matched_filename}' o ver sus cambios.
Debes basar tu respuesta ÚNICAMENTE en el bloque [HISTORIAL DE VERSIONES PARA COMPARACIÓN] que se encuentra más abajo. Compara la Versión Anterior y la Versión Actual indicadas allí línea por línea. Reporta detalladamente qué se agregó, modificó o eliminó, y detecta/informa sobre cualquier error ortográfico o gramatical en la Versión Actual en comparación con la Anterior. No inventes cambios ni digas que no tienes la información."""

                    comparison_context = f"""
[HISTORIAL DE VERSIONES PARA COMPARACIÓN - {matched_filename}]
- Versión Anterior (Modificada en {snap_time}):
\"\"\"
{snap_content[:4000]}
\"\"\"

- Versión Actual (Contenido actual en disco):
\"\"\"
{current_content[:4000]}
\"\"\"
"""
                else:
                    comparison_instruction = f"[INSTRUCCIÓN CRÍTICA DE COMPARACIÓN]\nInforma al usuario que no se han detectado cambios en el archivo '{matched_filename}' respecto al único registro que se tiene del mismo."
                    comparison_context = f"""
[HISTORIAL DE VERSIONES PARA COMPARACIÓN - {matched_filename}]
- El archivo '{matched_filename}' solo tiene una versión registrada en el historial y coincide exactamente con el contenido en disco:
\"\"\"
{snap_content[:4000]}
\"\"\"
"""
        
    # 3. Build system status
    current_path = payload.pageContext.currentPath if payload.pageContext else "/chat"
    system_status, active_count, active_actionable = build_realtime_system_status(current_path)
    
    # 4. Assemble system prompt
    # 4. Assemble system prompt
    if comparison_context:
        system_prompt = f"""Eres A.R.I.A (Asistente de Red Inteligente y Análisis), un asistente virtual avanzado de ciberseguridad y análisis de datos.

{comparison_instruction}

{comparison_context}

Instrucciones de Respuesta (CRÍTICAS):
1. Responde de manera profesional, clara y concisa en español.
2. Compara el contenido de la Versión Anterior y la Versión Actual literales de forma precisa línea por línea.
3. Resalta qué se agregó, modificó o eliminó.
4. Reporta detalladamente cualquier error gramatical u ortográfico detectado en la Versión Actual (por ejemplo, el uso incorrecto de 'De el' en lugar de 'del', o repeticiones de letras como 'mundoooo').
5. No inventes cambios y no le digas al usuario que no posees la información.
"""
    else:
        system_prompt = f"""Eres A.R.I.A (Asistente de Red Inteligente y Análisis), un asistente virtual avanzado de ciberseguridad y análisis de datos integrado en esta plataforma. Tienes acceso en tiempo real a las métricas del sistema, la base de datos de alertas y el directorio local de archivos.

{system_status}

[DOCUMENTOS Y ARCHIVOS DE CONTEXTO (RAG LOCAL)]
{rag_context}

Instrucciones de Respuesta (CRÍTICAS):
1. Responde de manera profesional, clara y concisa en español.
2. Si el usuario te pregunta cuántas alertas activas hay, distingue CLARAMENTE entre lo que se muestra en la interfaz del Centro de Alertas y lo que está registrado en la base de datos:
   - En la interfaz del Centro de Alertas (páginas/vistas web) se muestran SOLO las alertas activas de severidad 'Alto' y 'Medio' (accionables), las cuales suman {active_actionable} alertas activas en total.
   - En la base de datos hay un total de {active_count} alertas activas, las cuales incluyen las de severidad 'Bajo' que son filtradas en la interfaz por defecto para evitar saturación de ruido (fatiga de alertas).
   Explica esto amablemente para que el usuario entienda la diferencia.
3. Si el usuario te pregunta por estadísticas, alertas o archivos del sistema, básate strictly en el [ESTADO EN TIEMPO REAL DEL SISTEMA] proporcionado arriba. No inventes otros números ni asumas cifras que no estén explícitamente allí.
4. Si el usuario te pregunta por el contenido de los archivos o documentos (como Ciencia De Datos.docx o reporte_eventos_2026-03-28.xls), básate en el [DOCUMENTOS Y ARCHIVOS DE CONTEXTO (RAG LOCAL)]. **Menciona siempre el nombre del archivo origen de donde obtienes la respuesta.**
5. Si la información no está en el contexto o no tienes suficiente información para responder con seguridad, admítelo con honestidad y no inventes datos.
"""

    # 5. Limit memory to last 10 messages
    recent_messages = payload.messages[-10:]
    
    ollama_messages = []
    ollama_messages.append({"role": "system", "content": system_prompt})
    
    for i, msg in enumerate(recent_messages):
        role = msg.role
        content = msg.content
        # To guarantee the LLM respects system instructions and context, prepend the system prompt to the user's latest query
        if i == len(recent_messages) - 1 and role == "user":
            content = f"{system_prompt}\n\n[Mensaje del Usuario]: {content}"
        ollama_messages.append({"role": role, "content": content})

    def event_generator():
        ollama_url = "http://127.0.0.1:11434/api/chat"
        
        req_data = json.dumps({
            "model": "gemma4:e4b",
            "messages": ollama_messages,
            "stream": True
        }).encode('utf-8')
        
        req = urllib.request.Request(
            ollama_url,
            data=req_data,
            headers={"Content-Type": "application/json"}
        )
        
        try:
            with urllib.request.urlopen(req) as response:
                for line in response:
                    if line:
                        yield line
        except urllib.error.URLError as e:
            yield json.dumps({"error": f"No se pudo conectar a Ollama: {str(e)}"}).encode('utf-8')
        except Exception as e:
            yield json.dumps({"error": f"Error inesperado: {str(e)}"}).encode('utf-8')

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

def clean_reasoning(text: str) -> str:
    if not text:
        return ""
    # Remove <think>...</think> blocks
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<thought>.*?</thought>', '', text, flags=re.DOTALL | re.IGNORECASE)
    # Remove unclosed tags just in case
    text = re.sub(r'<think>.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<thought>.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
    return text.strip()

async def compare_and_log_alert_async(filename, filepath, owner, old_content, new_content, fsize):
    import urllib.request
    import json
    
    old_clean = old_content[:5000]
    new_clean = new_content[:5000]
    
    prompt = f"""Compara el contenido de las dos versiones del archivo '{filename}'.
Identifica detalladamente en español:
1. Los cambios específicos realizados (añadidos, eliminaciones, modificaciones).
2. Errores gramaticales u ortográficos introducidos en la versión actual.
3. Una breve conclusión sobre el impacto del cambio.

Versión Anterior:
\"\"\"
{old_clean}
\"\"\"

Versión Actual:
\"\"\"
{new_clean}
\"\"\"

Devuelve la respuesta en formato Markdown limpio y conciso."""

    ollama_url = "http://127.0.0.1:11434/api/chat"
    req_data = json.dumps({
        "model": "gemma4:e4b",
        "messages": [
            {"role": "system", "content": "Eres A.R.I.A, un experto en ciberseguridad, auditoría y análisis lingüístico."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }).encode('utf-8')
    
    try:
        req = urllib.request.Request(ollama_url, data=req_data, headers={"Content-Type": "application/json"})
        loop = asyncio.get_running_loop()
        def call_ollama():
            with urllib.request.urlopen(req, timeout=35) as response:
                return json.loads(response.read().decode('utf-8'))
                
        res = await loop.run_in_executor(None, call_ollama)
        analysis = res["message"]["content"]
    except Exception as e:
        analysis = f"No se pudo realizar el análisis de cambios mediante la IA debido a un error: {str(e)}"

    # Clean any reasoning/thinking tags from the analysis output
    analysis = clean_reasoning(analysis)

    severity = "Medio"
    analysis_lower = analysis.lower()
    if any(word in analysis_lower for word in ["error", "ortográfico", "ortografía", "falla", "gramatical", "error gramatical", "error de ortografía"]):
        severity = "Alto"
        
    alert_id = f"cmp-{int(time.time() * 1000)}-{filename}"
    short_desc = f"Se detectaron cambios en '{filename}' y se generó una auditoría gramatical/ortográfica."
    log_event(alert_id, filename, short_desc, "Comparación", severity, "icon-warning", None, filepath, fsize, owner, ai_analysis=analysis)
    
    alert = {
        "id": alert_id,
        "title": f"Comparación IA: {filename}",
        "description": short_desc,
        "time": "Hace unos segundos",
        "severity": severity,
        "iconClass": "icon-warning",
        "owner": owner,
        "aiAnalysis": analysis
    }
    
    await manager.broadcast({"type": "created", "file": filename, "alert": alert})

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

            # Trigger AI Comparison for supported documents
            from rag_engine import extract_file_content
            filepath = event.src_path
            _, ext = os.path.splitext(filename.lower())
            supported_exts = ['.txt', '.py', '.json', '.csv', '.md', '.log', '.js', '.css', '.html', '.docx', '.doc', '.xlsx', '.xls', '.pdf']
            if ext in supported_exts:
                time.sleep(0.3)
                new_content = extract_file_content(filepath)
                if new_content.strip():
                    snapshots = get_latest_snapshots(filename, limit=1)
                    if snapshots:
                        old_content = snapshots[0][0]
                        if old_content.strip() != new_content.strip():
                            # Save snapshot and trigger comparison
                            save_file_snapshot(filename, new_content)
                            asyncio.run_coroutine_threadsafe(
                                compare_and_log_alert_async(filename, filepath, owner, old_content, new_content, fsize),
                                self.loop
                            )
                    else:
                        # No previous snapshot, save current as first
                        save_file_snapshot(filename, new_content)

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

            # Save snapshot for new text/document file
            from rag_engine import extract_file_content
            filepath = event.src_path
            _, ext = os.path.splitext(filename.lower())
            supported_exts = ['.txt', '.py', '.json', '.csv', '.md', '.log', '.js', '.css', '.html', '.docx', '.doc', '.xlsx', '.xls', '.pdf']
            if ext in supported_exts:
                time.sleep(0.3)
                content = extract_file_content(filepath)
                if content.strip():
                    save_file_snapshot(filename, content)

@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_running_loop()
    if os.path.exists(DIRECTORY):
        from rag_engine import extract_file_content
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        for filename in os.listdir(DIRECTORY):
            if is_ignored_file(filename):
                continue
            filepath = os.path.join(DIRECTORY, filename)
            if os.path.isfile(filepath):
                c.execute('SELECT COUNT(*) FROM file_snapshots WHERE filename = ?', (filename,))
                if c.fetchone()[0] == 0:
                    content = extract_file_content(filepath)
                    if content.strip():
                        c.execute('INSERT INTO file_snapshots (filename, content) VALUES (?, ?)', (filename, content))
        conn.commit()
        conn.close()

        observer = Observer()
        event_handler = DirectoryMonitor(loop)
        observer.schedule(event_handler, DIRECTORY, recursive=False)
        observer.start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
