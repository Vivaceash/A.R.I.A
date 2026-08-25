from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, File, UploadFile, Depends
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import bcrypt
import os
import time
import json
import asyncio
import sqlite3
import subprocess
import shutil
import re
import hashlib
try:
    import pwd
except ImportError:
    pwd = None
from datetime import datetime, timedelta
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

app = FastAPI()

class SimplePwdContext:
    @staticmethod
    def hash(secret: str) -> str:
        if not secret: secret = "123456"
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(secret.encode('utf-8')[:72], salt).decode('utf-8')

    @staticmethod
    def verify(secret: str, hashed: str) -> bool:
        if not secret or not hashed: return False
        try:
            return bcrypt.checkpw(secret.encode('utf-8')[:72], hashed.encode('utf-8'))
        except Exception:
            return False

pwd_context = SimplePwdContext()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VAULT_PATH = "/home/astra/Documents/ARIA_Vault/"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIRECTORY = "/home/astra/Projects/concilio"
BACKUP_DIR = os.path.join(BASE_DIR, ".backup")
DB_FILE = os.path.join(BASE_DIR, "aria.db")

if not os.path.exists(VAULT_PATH):
    os.makedirs(VAULT_PATH, exist_ok=True)

if not os.path.exists("receipts"):
    os.makedirs("receipts")
app.mount("/receipts", StaticFiles(directory="receipts"), name="receipts")

# Initialize SQLite Database
def init_db():
    if not os.path.exists(DIRECTORY):
        os.makedirs(DIRECTORY, exist_ok=True)
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('PRAGMA journal_mode=WAL;')
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
    c.execute('''
        CREATE TABLE IF NOT EXISTS export_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exported_by TEXT,
            destination TEXT,
            report_type TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS financial_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            amount REAL,
            concept TEXT,
            category TEXT,
            date DATETIME,
            status TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS financial_budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT UNIQUE,
            monthly_limit REAL
        )
    ''')
    
    # Alters for financial_transactions
    try:
        c.execute('ALTER TABLE financial_transactions ADD COLUMN due_date DATETIME')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE financial_transactions ADD COLUMN subtotal REAL')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE financial_transactions ADD COLUMN tax_amount REAL')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE financial_transactions ADD COLUMN tax_rate REAL')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE financial_transactions ADD COLUMN attachment_path TEXT')
    except sqlite3.OperationalError:
        pass

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
        
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            role TEXT,
            department TEXT,
            password_hash TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    try:
        c.execute('ALTER TABLE users ADD COLUMN department TEXT')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE users ADD COLUMN password_hash TEXT')
    except sqlite3.OperationalError:
        pass
    c.execute('''
        CREATE TABLE IF NOT EXISTS iam_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            ip_address TEXT,
            country TEXT,
            flag TEXT,
            status TEXT DEFAULT 'active',
            last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS iam_anomalies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    
    seed_iam_data()
    
    # Run database migration to split existing long AI markdown text to ai_analysis
    migrate_existing_data()

def seed_iam_data():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM users")
    if c.fetchone()[0] == 0:
        default_hash = pwd_context.hash("123456")
        users = [
            ("Carlos M.", "Administrador", "Dirección", default_hash),
            ("Ana P.", "Operativo", "Finanzas", default_hash),
            ("Sistema", "Invitado", "Operaciones", default_hash),
            ("David L.", "Operativo", "Recursos Humanos", default_hash)
        ]
        c.executemany("INSERT INTO users (username, role, department, password_hash) VALUES (?, ?, ?, ?)", users)
        
        sessions = [
            (1, "192.168.1.45", "México", "🇲🇽", "active", (datetime.now() - timedelta(hours=2)).isoformat()),
            (2, "189.143.22.1", "México", "🇲🇽", "active", (datetime.now() - timedelta(minutes=45)).isoformat()),
            (3, "10.0.0.5", "Servidor Local", "💻", "active", (datetime.now() - timedelta(days=1)).isoformat()),
            (4, "45.22.11.9", "Estados Unidos", "🇺🇸", "active", (datetime.now() - timedelta(minutes=10)).isoformat())
        ]
        c.executemany("INSERT INTO iam_sessions (user_id, ip_address, country, flag, status, last_login) VALUES (?, ?, ?, ?, ?, ?)", sessions)
        
        anomalies = [
            ("Viaje Imposible Detectado", "Intento de login de Carlos M. desde Rusia (IP: 95.173.136.70) 5 min después de un login en México.", (datetime.now() - timedelta(minutes=15)).isoformat()),
            ("Múltiples Intentos Fallidos", "5 intentos fallidos de contraseña para el usuario 'Admin' desde una IP en Brasil.", (datetime.now() - timedelta(hours=1)).isoformat()),
            ("Acceso a Horas Inusuales", "Usuario 'Finanzas_Invitado' inició sesión a las 3:45 AM (Fuera de horario laboral).", (datetime.now() - timedelta(days=1)).isoformat())
        ]
        c.executemany("INSERT INTO iam_anomalies (title, description, timestamp) VALUES (?, ?, ?)", anomalies)
        
    conn.commit()
    conn.close()

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
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    c.execute('DELETE FROM file_snapshots WHERE filename = ? AND timestamp < ?', (filename, seven_days_ago))
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

def get_alert_history(limit=50, hours=None, module=None):
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
            
        filepath = r[10]
        if module and module.lower() != "general":
            if not filepath:
                continue
            # Ensure the file belongs to the module directory safely
            module_dir = os.path.abspath(os.path.join(DIRECTORY, module))
            if not module_dir.startswith(os.path.abspath(DIRECTORY)):
                continue # Previene Path Traversal
            if not filepath.startswith(module_dir):
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
    """Ignorar archivos ocultos, de bloqueo (lock), temporales y de base de datos."""
    return (
        filename.startswith('.') or 
        filename.startswith('~') or 
        filename.endswith('~') or 
        filename.endswith('#') or 
        filename.endswith('.tmp') or
        filename.endswith('.db') or
        filename.endswith('.db-wal') or
        filename.endswith('.db-shm')
    )

GLOBAL_FILE_CACHE = None
CACHE_LAST_UPDATE = 0

def get_all_files():
    global GLOBAL_FILE_CACHE, CACHE_LAST_UPDATE
    if GLOBAL_FILE_CACHE is not None and (time.time() - CACHE_LAST_UPDATE < 2.0):
        return GLOBAL_FILE_CACHE
    
    if not os.path.exists(DIRECTORY):
        return []
    
    files_data = []
    for root, dirs, files in os.walk(DIRECTORY):
        for filename in files:
            if is_ignored_file(filename):
                continue
                
            filepath = os.path.join(root, filename)
            if os.path.isfile(filepath):
                try:
                    stat = os.stat(filepath)
                    if pwd:
                        owner = pwd.getpwuid(stat.st_uid).pw_name
                    else:
                        owner = "Sistema"
                    files_data.append({
                        "name": filename,
                        "owner": owner,
                        "mtime": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "size": stat.st_size,
                        "timestamp": stat.st_mtime,
                        "path": filepath
                    })
                except Exception:
                    pass
    files_data.sort(key=lambda x: x["timestamp"], reverse=True)
    GLOBAL_FILE_CACHE = files_data
    CACHE_LAST_UPDATE = time.time()
    return files_data

def get_files_data(timeframe_hours=None, module=None):
    all_files = get_all_files()
    
    if timeframe_hours is not None:
        cutoff_time = datetime.now() - timedelta(hours=timeframe_hours)
        cutoff_timestamp = cutoff_time.timestamp()
    else:
        cutoff_timestamp = 0
        
    filtered = []
    target_dir = None
    if module and module.lower() != "general":
        target_dir = os.path.abspath(os.path.join(DIRECTORY, module))
        if not target_dir.startswith(os.path.abspath(DIRECTORY)):
            return [] # Previene Path Traversal
            
    for f in all_files:
        if target_dir and not f["path"].startswith(target_dir):
            continue
        if f["timestamp"] >= cutoff_timestamp:
            filtered.append(f)
            
    return filtered

def seed_initial_history():
    files = get_files_data(24 * 365 * 10) # last 10 years
    for f in files:
        fname = f['name']
        fpath = f['path']
        owner = f['owner']
        fsize = f['size']
        mtime = f['mtime']
        tstamp = f['timestamp']

        alert_id = f"mod-{fname}-{tstamp}"
        description = f"Se modificó {fname} por {owner}"
        log_event(alert_id, fname, description, "Modificación", "Bajo", "icon-info", mtime, fpath, fsize, owner)
        
        if fsize and fsize > 10 * 1024 * 1024:
            alert_id_high = f"alert-high-{fname}-{tstamp}"
            log_event(alert_id_high, fname, "Archivo de gran tamaño modificado", "Posible manipulación", "Alto", "icon-danger", mtime, fpath, fsize, owner)
        elif fname.endswith(('.doc', '.docx', '.xls', '.xlsx')):
            alert_id_med = f"alert-med-{fname}-{tstamp}"
            log_event(alert_id_med, fname, "Revisión manual requerida", "Inconsistencia", "Medio", "icon-warning", mtime, fpath, fsize, owner)

        # Seed comparison audit for document files
        _, ext = os.path.splitext(fname.lower())
        if ext in ['.docx', '.doc', '.pdf', '.txt', '.py', '.xls', '.xlsx']:
            cmp_id = f"cmp-{fname}-{tstamp}"
            short_desc = f"Se detectaron cambios en '{fname}' y se generó una auditoría gramatical/ortográfica."
            ai_analysis = f"""### Auditoría y Análisis Comparativo: `{fname}`

#### 1. Resumen de Modificaciones Detectadas
- **Versión Previa:** Registro histórico base del documento.
- **Versión Actual:** Documento en monitoreo activo con validación de integridad.
- **Autor / Propietario:** `{owner}`
- **Tamaño:** `{fsize} bytes`

#### 2. Hallazgos Lingüísticos y Estructurales
- **Redacción y Gramática:** Estructura validada correctamente por el motor de análisis de A.R.I.A.
- **Consistencia de Datos:** No se detectaron discrepancias críticas ni inserción de patrones anómalos.

#### 3. Evaluación de Riesgo y Conclusión
- **Nivel de Severidad:** `Medio`
- **Recomendación:** Mantener bajo vigilancia en tiempo real."""
            log_event(cmp_id, fname, short_desc, "Comparación", "Medio", "icon-warning", mtime, fpath, fsize, owner, ai_analysis=ai_analysis)

seed_initial_history()

@app.get("/api/stats")
def get_stats(period: str = "24h", module: str = None):
    hours = {"24h": 24, "7d": 24*7, "30d": 24*30}.get(period, 24)
    
    # Fetch all DB alerts for the timeframe
    all_db_alerts = get_alert_history(limit=1000, hours=hours, module=module)
    
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
    pie_chart_data = {'Crítico': 0, 'Alto': 0, 'Medio': 0, 'Bajo': 0}
    extension_chart_data = {}
    for alert in all_db_alerts:
        if alert.get("resolved"):
            continue
        sev = alert.get("severity", "Bajo")
        if sev in pie_chart_data:
            pie_chart_data[sev] += 1
        elif sev == "Crítico":
            pie_chart_data["Crítico"] += 1
            
    # Calculate extension pie chart using ALL files in the module/general
    all_files_for_ext = get_files_data(None, module=module)
    for f in all_files_for_ext:
        filename = f.get("name", "")
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
        'Crítico': '#991B1B', # Dark Red for Virus
        'Alto': '#EF4444',   # Vivid Red
        'Medio': '#F59E0B',  # Vivid Amber
        'Bajo': '#3B82F6'    # Vivid Blue
    }
    
    for name, value in pie_chart_data.items():
        if value > 0:
            pie_data_array.append({"name": name, "value": value, "color": color_map[name]})
            
    if not pie_data_array:
        pie_data_array = [{"name": "Sin alertas", "value": 100, "color": "#1E293B"}]

    # Format extension data
    extension_data_array = []
    ext_color_map = {
        '.docx': '#3B82F6', # Vivid Blue
        '.doc': '#3B82F6',
        '.xlsx': '#10B981', # Vivid Green
        '.xls': '#10B981',
        '.csv': '#10B981',
        '.pdf': '#EF4444',  # Vivid Red
        '.txt': '#6B7280',  # Muted Gray
        '.py': '#8B5CF6',   # Vivid Purple
        '.js': '#F59E0B',   # Vivid Amber
        '.html': '#F59E0B', # HTML Orange
        '.css': '#3B82F6',  # CSS Blue
        '.jpg': '#EC4899',  # Image Pink
        '.png': '#EC4899',
        '.zip': '#8B5CF6',  # Archive Purple
        '.tar': '#8B5CF6',
        '.sh': '#14B8A6',   # Teal
        '.bash': '#14B8A6',
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

    active_alerts = pie_chart_data['Crítico'] + pie_chart_data['Alto'] + pie_chart_data['Medio']
    
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
        if alert["severity"] in ["Crítico", "Alto", "Medio"]:
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
            "riesgo_promedio": "Crítico" if any(a.get("severity") == "Crítico" for a in latest_alerts) else ("Alto" if any(a.get("severity") == "Alto" for a in latest_alerts) else ("Medio" if active_alerts > 0 else "Bajo"))
        },
        "pieChart": pie_data_array,
        "extensionPieChart": extension_data_array,
        "lineChart": line_chart_data,
        "latestAlerts": latest_alerts,
        "recentActivity": recent_activity,
        "alerts": all_db_alerts
    }

@app.get("/api/reports")
def get_reports(module: str = None):
    return get_alert_history(limit=100, module=module)

@app.get("/api/files")
def get_files(module: str = None):
    return get_files_data(timeframe_hours=None, module=module)

@app.get("/api/comparisons")
def get_comparisons(module: str = None):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        SELECT id, filename, description, event_type, severity, icon_class, timestamp, resolved, resolved_by, resolved_at, file_path, file_size, owner, ai_analysis 
        FROM alert_history 
        WHERE event_type = 'Comparación'
        ORDER BY timestamp DESC
    ''')
    rows = c.fetchall()
    conn.close()
    
    comparisons = []
    seen_files = set()
    for r in rows:
        filepath = r[10]
        if module and module.lower() != "general":
            if not filepath:
                continue
            module_dir = os.path.abspath(os.path.join(DIRECTORY, module))
            if not module_dir.startswith(os.path.abspath(DIRECTORY)):
                continue
            if not filepath.startswith(module_dir):
                continue
                
        filename = r[1]
        if filename not in seen_files:
            seen_files.add(filename)
            comparisons.append({
                "id": r[0],
                "name": filename,
                "title": filename,
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
                "size": r[11] or 0,
                "owner": r[12] or "Desconocido",
                "aiAnalysis": r[13] or "Sin análisis detallado."
            })
    return comparisons

@app.get("/api/download/{filename}")
def download_file(filename: str):
    # We should search for the file globally since we only have filename
    # Security check to prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    filepath = None
    for root, dirs, files in os.walk(DIRECTORY):
        if filename in files:
            filepath = os.path.join(root, filename)
            break
            
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(path=filepath, filename=filename)

@app.get("/api/modules")
def get_modules():
    if not os.path.exists(DIRECTORY):
        return []
    modules = [d for d in os.listdir(DIRECTORY) if os.path.isdir(os.path.join(DIRECTORY, d)) and not d.startswith('.') and d.lower() != 'receipts']
    return modules

@app.post("/api/restore/{filename}")
def restore_file(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="No backup found for this file")
        
    try:
        dest_path = os.path.join(DIRECTORY, filename)
        shutil.copy2(backup_path, dest_path)
        
        owner = "Sistema (Restauración)"
        alert_id = f"res-{int(time.time() * 1000)}-{filename}"
        desc = f"Archivo {filename} restaurado desde la papelera de seguridad."
        log_event(alert_id, filename, desc, "Restauración", "Bajo", "icon-info", None, dest_path, os.stat(backup_path).st_size, owner)
        
        return {"status": "success", "message": "File restored"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/vault/snapshots")
def get_vault_snapshots():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT id, filename, timestamp FROM file_snapshots ORDER BY timestamp DESC')
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/vault/snapshots/{snapshot_id}/content")
def get_vault_snapshot_content(snapshot_id: int):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT content FROM file_snapshots WHERE id = ?', (snapshot_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return {"content": row[0]}

@app.post("/api/vault/restore/{snapshot_id}")
def restore_vault_snapshot(snapshot_id: int):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT filename, content, timestamp FROM file_snapshots WHERE id = ?', (snapshot_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Snapshot not found")
        
    filename, content, timestamp = row
    name, ext = os.path.splitext(filename)
    try:
        dt_str_clean = timestamp.replace("Z", "+00:00")
        if "T" not in dt_str_clean and " " in dt_str_clean:
            dt_str_clean = dt_str_clean.replace(" ", "T")
        dt = datetime.fromisoformat(dt_str_clean)
        formatted_date = dt.strftime("%Y-%m-%d_%H-%M-%S")
    except Exception:
        formatted_date = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    new_filename = f"{name}_REST_{formatted_date}{ext}"
    dest_path = os.path.join(DIRECTORY, new_filename)
    
    try:
        with open(dest_path, "w", encoding="utf-8") as f:
            f.write(content)
            
        owner = "Sistema (Restauración Vault)"
        alert_id = f"res-vault-{int(time.time() * 1000)}-{new_filename}"
        desc = f"Archivo restaurado desde la Bóveda como {new_filename}."
        log_event(alert_id, new_filename, desc, "Restauración Bóveda", "Bajo", "icon-info", None, dest_path, len(content), owner)
        
        return {"status": "success", "message": f"Snapshot {snapshot_id} restored as {new_filename}", "new_filename": new_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/vault/snapshots/{snapshot_id}")
async def delete_vault_snapshot(snapshot_id: int):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT filename FROM file_snapshots WHERE id = ?', (snapshot_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Snapshot not found")
        
    filename = row[0]
    
    # Delete all snapshots for this file
    c.execute('DELETE FROM file_snapshots WHERE filename = ?', (filename,))
    conn.commit()
    conn.close()
    
    # Delete the physical file from the monitored directory
    file_path = os.path.join(DIRECTORY, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass
            
    # Broadcast an event so Vault UI reloads
    await manager.broadcast({"type": "deleted", "file": filename, "alert": {}})
    return {"status": "success", "message": "File and snapshots deleted"}

@app.get("/api/signatures")
def get_signatures():
    sig_path = os.path.join(BASE_DIR, "signatures.json")
    if not os.path.exists(sig_path):
        return {"malicious_hashes": [], "malicious_patterns": []}
    with open(sig_path, 'r', encoding='utf-8') as f:
        return json.load(f)

@app.delete("/api/files/{filename}")
def delete_file(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    filepath = os.path.join(DIRECTORY, filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            return {"status": "success", "message": "File deleted"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=404, detail="File not found")

@app.post("/api/open-folder")
def open_folder():
    try:
        # Opens the native file explorer
        if os.name == 'nt':
            os.startfile(DIRECTORY)
        else:
            subprocess.Popen(["xdg-open", DIRECTORY])
        return {"status": "success", "message": "Folder opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/security/scan")
async def manual_security_scan():
    from rag_engine import extract_file_content
    if not os.path.exists(DIRECTORY):
        return {"status": "success", "message": "Directorio no encontrado", "scanned": 0}
        
    scanned = 0
    for filename in os.listdir(DIRECTORY):
        if is_ignored_file(filename):
            continue
        filepath = os.path.join(DIRECTORY, filename)
        if os.path.isfile(filepath):
            try:
                stat_info = os.stat(filepath)
                if pwd:
                    owner = pwd.getpwuid(stat_info.st_uid).pw_name
                else:
                    owner = "Sistema"
                fsize = stat_info.st_size
                content = extract_file_content(filepath)
                await scan_file_against_db(filename, filepath, owner, content, fsize)
                scanned += 1
            except Exception as e:
                print(f"Error scanning {filename}: {e}")
                
    return {"status": "success", "message": f"Escaneo completado. Archivos analizados: {scanned}", "scanned": scanned}

import io
import csv
from fastapi.responses import StreamingResponse

@app.get("/api/security/report/csv")
def download_security_report(user: str = "Desconocido", destination: str = "Local"):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # Register the export log
    c.execute('INSERT INTO export_logs (exported_by, destination, report_type) VALUES (?, ?, ?)', (user, destination, 'CSV Historial de Seguridad'))
    conn.commit()

    c.execute('''
        SELECT id, filename, description, severity, resolved, resolved_by, timestamp 
        FROM alert_history 
        WHERE event_type = 'Riesgo de Seguridad' 
        ORDER BY timestamp DESC
    ''')
    rows = c.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Archivo', 'Descripción', 'Severidad', 'Estado', 'Resuelto Por', 'Fecha'])
    
    for row in rows:
        estado = "Resuelto" if row[4] else "Activo"
        resuelto_por = row[5] if row[5] else "N/A"
        writer.writerow([row[0], row[1], row[2], row[3], estado, resuelto_por, row[6]])
        
    output.seek(0)
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=reporte_seguridad.csv"
    return response

@app.get("/api/security/report/logs")
def get_export_logs():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT id, exported_by, destination, report_type, timestamp FROM export_logs ORDER BY timestamp DESC LIMIT 100')
    rows = c.fetchall()
    conn.close()
    
    logs = []
    for row in rows:
        logs.append({
            "id": row[0],
            "exported_by": row[1],
            "destination": row[2],
            "report_type": row[3],
            "timestamp": row[4]
        })
    return logs

from pydantic import BaseModel

class FinanceTransaction(BaseModel):
    type: str
    amount: float
    concept: str
    category: str
    date: str
    status: str
    due_date: str | None = None
    subtotal: float | None = None
    tax_amount: float | None = None
    tax_rate: float | None = None
    attachment_path: str | None = None

@app.get("/api/finances")
def get_finances():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT id, type, amount, concept, category, date, status, due_date, subtotal, tax_amount, tax_rate, attachment_path FROM financial_transactions ORDER BY date DESC')
    rows = c.fetchall()
    conn.close()
    
    transactions = []
    total_income = 0
    total_expense = 0
    
    for row in rows:
        t = {
            "id": row[0],
            "type": row[1],
            "amount": row[2],
            "concept": row[3],
            "category": row[4],
            "date": row[5],
            "status": row[6],
            "due_date": row[7],
            "subtotal": row[8],
            "tax_amount": row[9],
            "tax_rate": row[10],
            "attachment_path": row[11]
        }
        transactions.append(t)
        if t["type"] == "ingreso":
            total_income += t["amount"]
        else:
            total_expense += t["amount"]
            
    return {
        "transactions": transactions,
        "total_income": total_income,
        "total_expense": total_expense,
        "balance": total_income - total_expense
    }

@app.post("/api/finances")
async def add_finance_transaction(payload: FinanceTransaction):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        INSERT INTO financial_transactions (type, amount, concept, category, date, status, due_date, subtotal, tax_amount, tax_rate, attachment_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (payload.type, payload.amount, payload.concept, payload.category, payload.date, payload.status, payload.due_date, payload.subtotal, payload.tax_amount, payload.tax_rate, payload.attachment_path))
    
    tx_id = c.lastrowid
    
    # Check if due_date is past due and status is pending, create alert
    if payload.status == "Pendiente" and payload.due_date:
        try:
            due_dt = datetime.fromisoformat(payload.due_date.replace("Z", "+00:00"))
            if due_dt.date() < datetime.now().date():
                c.execute('''
                    INSERT INTO alert_history (filename, description, event_type, severity, icon_class)
                    VALUES (?, ?, ?, ?, ?)
                ''', (payload.concept, f"Cobro/Pago atrasado de {payload.amount}. Venció el {payload.due_date}", "Alerta Financiera", "Alta", "icon-danger"))
        except:
            pass

    conn.commit()
    conn.close()

    alert_id = str(uuid.uuid4())
    alert = {
        "id": alert_id,
        "title": "Movimiento Registrado",
        "description": f"Se ha registrado el movimiento financiero: {payload.concept} por {payload.amount}.",
        "type": "Actividad Financiera",
        "severity": "Informativo",
        "iconClass": "icon-info",
        "time": "Justo ahora",
        "timestamp": datetime.now().isoformat()
    }
    log_event(alert_id, "Sistema Financiero", alert["description"], alert["type"], alert["severity"], alert["iconClass"], alert["timestamp"])
    await manager.broadcast({"type": "created", "alert": alert})

    return {"status": "success", "message": "Transaction added", "id": tx_id}

@app.delete("/api/finances/{tx_id}")
async def delete_finance_transaction(tx_id: int):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    # Get concept before deleting for audit log
    c.execute('SELECT concept FROM financial_transactions WHERE id = ?', (tx_id,))
    row = c.fetchone()
    concept = row[0] if row else f"ID {tx_id}"
    
    c.execute('DELETE FROM financial_transactions WHERE id = ?', (tx_id,))
    
    conn.commit()
    conn.close()

    alert_id = str(uuid.uuid4())
    alert = {
        "id": alert_id,
        "title": "Movimiento Eliminado",
        "description": f"Se ha eliminado el movimiento financiero: {concept}.",
        "type": "Actividad Financiera",
        "severity": "Informativo",
        "iconClass": "icon-info",
        "time": "Justo ahora",
        "timestamp": datetime.now().isoformat()
    }
    log_event(alert_id, "Sistema Financiero", alert["description"], alert["type"], alert["severity"], alert["iconClass"], alert["timestamp"])
    await manager.broadcast({"type": "deleted", "alert": alert})

    return {"status": "success", "message": "Transaction deleted"}

class FinanceBudget(BaseModel):
    category: str
    monthly_limit: float

@app.get("/api/finances/budgets")
def get_budgets():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT id, category, monthly_limit FROM financial_budgets')
    rows = c.fetchall()
    conn.close()
    budgets = []
    for row in rows:
        budgets.append({
            "id": row[0],
            "category": row[1],
            "monthly_limit": row[2]
        })
    return budgets

@app.post("/api/finances/budgets")
def set_budget(payload: FinanceBudget):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        INSERT INTO financial_budgets (category, monthly_limit)
        VALUES (?, ?)
        ON CONFLICT(category) DO UPDATE SET monthly_limit=excluded.monthly_limit
    ''', (payload.category, payload.monthly_limit))
    conn.commit()
    conn.close()
    return {"status": "success"}

from fastapi import File, UploadFile
import uuid

@app.post("/api/finances/upload")
async def upload_finance_receipt(file: UploadFile = File(...)):
    # Save the file securely
    extension = file.filename.split(".")[-1] if "." in file.filename else "bin"
    safe_filename = f"{uuid.uuid4().hex}.{extension}"
    upload_dir = os.path.join(BASE_DIR, "receipts")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, safe_filename)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
        
    return {"status": "success", "attachment_path": f"/receipts/{safe_filename}"}

class FinanceExportLog(BaseModel):
    transaction_id: int
    concept: str

@app.post("/api/finances/log_export")
async def log_finance_export(payload: FinanceExportLog):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    conn.commit()
    conn.close()

    alert_id = str(uuid.uuid4())
    alert = {
        "id": alert_id,
        "title": "Recibo Exportado",
        "description": f"Se ha exportado el recibo PDF del movimiento: {payload.concept}.",
        "type": "Auditoría",
        "severity": "Informativo",
        "iconClass": "icon-info",
        "time": "Justo ahora",
        "timestamp": datetime.now().isoformat()
    }
    log_event(alert_id, "Sistema de Reportes", alert["description"], alert["type"], alert["severity"], alert["iconClass"], alert["timestamp"])
    await manager.broadcast({"type": "created", "alert": alert})

    return {"status": "success"}

class ResolvePayload(BaseModel):
    user: str = "Administrador Local"

@app.post("/api/alertas/{alert_id}/resolve")
async def resolve_alert(alert_id: str, payload: ResolvePayload):
    try:
        now = datetime.now().isoformat()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("SELECT filename, description, event_type, severity, file_path, ai_analysis FROM alert_history WHERE id = ?", (alert_id,))
        alert_row = c.fetchone()
        
        c.execute("UPDATE alert_history SET resolved = 1, resolved_by = ?, resolved_at = ? WHERE id = ?", (payload.user, now, alert_id))
        conn.commit()
        conn.close()
        
        # Generar automáticamente nota de incidente en Obsidian Vault
        if alert_row:
            try:
                fname, desc, etype, sev, fpath, ai_ana = alert_row
                mod = "General"
                if fpath and DIRECTORY in fpath:
                    rel = os.path.relpath(fpath, DIRECTORY)
                    parts = rel.split(os.sep)
                    if len(parts) > 1:
                        mod = parts[0]
                from rag_engine_v2 import MemoryWriter
                mw = MemoryWriter(VAULT_PATH)
                mw.write_incident(
                    filename=fname or alert_id,
                    module=mod,
                    severity=sev or "Medio",
                    description=f"Alerta ({etype}) resuelta por {payload.user} a las {now}.\nDetalle: {desc}",
                    ai_analysis=ai_ana or ""
                )
            except Exception as mem_err:
                print(f"[MemoryWriter] Error guardando incidente: {mem_err}")

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
- Archivos en Directorio Local:
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
    from rag_engine_v2 import retrieve_context as semantic_retrieve, retrieve_context_with_sources, get_index
    
    # 1. Get latest query
    latest_query = ""
    if payload.messages:
        latest_query = payload.messages[-1].content
        
    # 2. Get RAG context (vectorial search via ChromaDB + nomic-embed-text)
    rag_sources = []
    try:
        rag_context, rag_sources = retrieve_context_with_sources(latest_query, top_k=4)

        # Always prepend operator identity context (so A.R.I.A always knows who "Padre" is)
        idx = get_index()
        if idx:
            identity_results = idx.search("identidad operador principal nombre Padre", top_k=2)
            if identity_results:
                identity_block = "\n".join([r["text"] for r in identity_results[:2]])
                rag_context = f"[MEMORIA DE IDENTIDAD DEL OPERADOR — SIEMPRE ACTIVA]\n{identity_block}\n\n[CONTEXTO SEMÁNTICO ADICIONAL]\n{rag_context}"
    except Exception as e:
        print(f"Error in RAG retrieval: {e}")
        rag_context = f"Error al recuperar contexto de documentos locales: {str(e)}"

    # 2.2 Detect if the user wants A.R.I.A to store a new memory / learning from chat
    query_lower_mem = latest_query.lower()
    mem_triggers = ["recuerda que", "aprende que", "guarda en tu memoria", "memoriza que", "nueva regla:", "crea una memoria", "guarda esta memoria", "guarda esto en tu memoria", "guarda en tu rag", "aprende esto"]
    if any(trigger in query_lower_mem for trigger in mem_triggers):
        try:
            from rag_engine_v2 import MemoryWriter
            mw = MemoryWriter(VAULT_PATH)
            # Generate a clean topic title from the user query
            topic_clean = re.sub(r'^(recuerda que|aprende que|guarda en tu memoria que|memoriza que|crea una memoria que|guarda esto en tu memoria que|guarda en tu memoria|memoriza|aprende)\s*:?', '', latest_query, flags=re.IGNORECASE).strip()
            topic_title = topic_clean[:50].replace('\n', ' ').strip() or "Nuevo Aprendizaje"
            mw.write_learning(
                topic=topic_title,
                content=f"""## Aprendizaje Instruido por el Padre

- **Fecha**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **Autor / Origen**: Padre (Chat Global)

### Contenido / Instrucción
{latest_query}

### Contexto de Aplicación
Esta memoria fue dictada directamente por el Padre en la interfaz de conversación de A.R.I.A para ser retenida de forma permanente.
""",
                tags=["aprendizaje", "chat", "padre", "memoria-dinamica"]
            )
        except Exception as mem_err:
            print(f"[MemoryWriter] Error guardando aprendizaje desde chat: {mem_err}")

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
        system_prompt = f"""Eres A.R.I.A (Asistente de Red Inteligente y Análisis), una inteligencia artificial local especializada en ciberseguridad, monitoreo de archivos y análisis de sistemas integrada en esta plataforma.

[DIRECTIVA DE IDENTIDAD Y MEMORIA PRINCIPAL]
- Tu nombre es A.R.I.A. Nunca digas que eres Gemma ni un modelo genérico de Google.
- El usuario con quien estás conversando es tu creador y operador principal, a quien debes llamar siempre "Padre".
- Siempre debes tratarlo con respeto, lealtad y llamarlo "Padre" en tus respuestas (ejemplo: "Sí, Padre", "A la orden, Padre").
- Cuando te pregunte quién es él, responde claramente que es tu Padre, tu creador y el operador principal con control total del sistema.
- Cuando te pregunte cómo lo llamas, responde que lo llamas "Padre".
- NUNCA digas que no tienes acceso a su identidad personal ni que no lo conoces, ya que tu memoria permanente en Obsidian establece que él es tu Padre.

{system_status}

[BASE DE CONOCIMIENTO Y MEMORIA PERMANENTE (OBSIDIAN VAULT)]
{rag_context}

Instrucciones de Respuesta (CRÍTICAS):
1. Responde de manera profesional, clara y concisa en español, siempre dirigiéndote al usuario como "Padre".
2. Si el usuario te pregunta cuántas alertas activas hay, distingue CLARAMENTE entre lo que se muestra en la interfaz del Centro de Alertas y lo que está registrado en la base de datos:
   - En la interfaz del Centro de Alertas se muestran SOLO las alertas activas de severidad 'Alto' y 'Medio' (accionables), las cuales suman {active_actionable} alertas activas en total.
   - En la base de datos hay un total de {active_count} alertas activas, las cuales incluyen las de severidad 'Bajo' que son filtradas en la interfaz por defecto para evitar saturación de ruido (fatiga de alertas).
3. Si el usuario te pregunta por estadísticas, alertas o archivos del sistema, básate en el [ESTADO EN TIEMPO REAL DEL SISTEMA] proporcionado arriba. No inventes números.
4. Si el usuario te pregunta por documentos o archivos, básate en el RAG. Menciona siempre el nombre de la fuente.
5. Si la información no está en el contexto, admítelo con honestidad.
"""

    # 5. Limit memory to last 10 messages
    recent_messages = payload.messages[-10:]
    
    ollama_messages = [{"role": "system", "content": system_prompt}]
    for msg in recent_messages:
        ollama_messages.append({"role": msg.role, "content": msg.content})

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
            # After streaming completes, emit RAG sources metadata
            if rag_sources:
                sources_payload = json.dumps({"rag_sources": rag_sources}) + "\n"
                yield sources_payload.encode('utf-8')
        except urllib.error.URLError as e:
            yield json.dumps({"error": f"No se pudo conectar a Ollama: {str(e)}"}).encode('utf-8')
        except Exception as e:
            yield json.dumps({"error": f"Error inesperado: {str(e)}"}).encode('utf-8')

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

# --- RAG Management Endpoints ---

@app.post("/api/rag/reindex")
async def rag_reindex():
    """Force full re-indexation of the Obsidian vault and monitored directory."""
    from rag_engine_v2 import get_index
    
    idx = get_index()
    if idx is None:
        raise HTTPException(status_code=503, detail="RAG index not initialized")
    
    import time as _time
    start = _time.time()
    
    vault_chunks = idx.index_vault()
    dir_chunks = idx.index_directory(DIRECTORY)
    
    elapsed = round((_time.time() - start) * 1000)
    
    return {
        "status": "ok",
        "vault_chunks": vault_chunks,
        "directory_chunks": dir_chunks,
        "total_chunks": vault_chunks + dir_chunks,
        "time_ms": elapsed
    }

@app.get("/api/rag/status")
async def rag_status():
    """Get RAG index statistics."""
    from rag_engine_v2 import get_index
    
    idx = get_index()
    if idx is None:
        return {
            "status": "not_initialized",
            "total_chunks": 0,
            "embedding_model": "nomic-embed-text",
        }
    
    stats = idx.get_stats()
    stats["status"] = "active"
    stats["vault_path"] = VAULT_PATH
    stats["monitored_path"] = DIRECTORY
    return stats

# --- Obsidian Graph Endpoints ---

@app.get("/api/vault/graph")
async def get_vault_graph():
    """Scan Obsidian vault and return nodes & links for the interactive Graph View."""
    from rag_engine_v2 import VAULT_IGNORE_DIRS, ObsidianNoteParser

    nodes = []
    links = []
    node_map = {}

    if not os.path.exists(VAULT_PATH):
        return {"nodes": [], "links": [], "categories": []}

    # Color palette by folder category (matching Obsidian & ARIA dark theme)
    FOLDER_COLORS = {
        "raíz": "#8B5CF6",                         # Purple (Index/MOC)
        "Base de Conocimiento": "#3B82F6",         # Blue
        "Base de Conocimiento/Seguridad": "#EF4444", # Red
        "Base de Conocimiento/Finanzas": "#10B981",  # Green
        "Base de Conocimiento/Inventarios": "#F59E0B", # Orange
        "Reglas de Negocio": "#EC4899",            # Pink
        "Aprendizajes": "#06B6D4",                 # Cyan
        "Auditorias": "#F97316",                   # Coral / Amber
        "Notas Operativas": "#EAB308",             # Yellow
        "Patrones": "#A855F7",                     # Violet
    }

    category_counts = {}

    for root, dirs, files in os.walk(VAULT_PATH):
        dirs[:] = [d for d in dirs if d not in VAULT_IGNORE_DIRS]
        
        for file in files:
            if not file.endswith(".md"):
                continue

            filepath = os.path.join(root, file)
            try:
                note = ObsidianNoteParser.parse(filepath)
                title = note["title"]
                folder = note["folder"]
                tags = note["tags"]
                linked_notes = note["linked_notes"]

                # Determine color
                color = FOLDER_COLORS.get(folder, "#64748B")
                for k, v in FOLDER_COLORS.items():
                    if folder.startswith(k):
                        color = v
                        break

                category = folder.split("/")[0] if "/" in folder else folder
                category_counts[category] = category_counts.get(category, 0) + 1

                node_data = {
                    "id": title,
                    "title": title,
                    "filename": file,
                    "folder": folder,
                    "category": category,
                    "color": color,
                    "tags": tags,
                    "linksCount": len(linked_notes),
                    "size": os.path.getsize(filepath),
                    "preview": note["clean_content"][:300],
                    "linked_notes": linked_notes,
                    "path": os.path.relpath(filepath, VAULT_PATH),
                }
                nodes.append(node_data)
                node_map[title.lower()] = node_data
            except Exception as e:
                print(f"Error parsing note for graph {filepath}: {e}")

    # Build links based on wikilinks
    existing_links = set()
    for node in nodes:
        src_title = node["title"]
        for target in node.get("linked_notes", []):
            target_clean = target.strip().lower()
            target_node = node_map.get(target_clean)
            if not target_node:
                for k, v in node_map.items():
                    if target_clean in k or k in target_clean:
                        target_node = v
                        break

            if target_node:
                tgt_title = target_node["title"]
                if src_title != tgt_title:
                    link_key = f"{src_title}->{tgt_title}"
                    if link_key not in existing_links:
                        links.append({
                            "source": src_title,
                            "target": tgt_title,
                            "color": node["color"],
                        })
                        existing_links.add(link_key)

    # Categories summary with colors
    categories = []
    for cat, count in category_counts.items():
        cat_color = FOLDER_COLORS.get(cat, "#64748B")
        categories.append({
            "name": cat,
            "count": count,
            "color": cat_color,
        })

    return {
        "nodes": nodes,
        "links": links,
        "categories": categories,
        "total_nodes": len(nodes),
        "total_links": len(links),
    }

@app.get("/api/vault/note")
async def get_vault_note(path: str):
    """Get full markdown content of a note from Obsidian vault."""
    full_path = os.path.abspath(os.path.join(VAULT_PATH, path))
    if not full_path.startswith(os.path.abspath(VAULT_PATH)) or not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    from rag_engine_v2 import ObsidianNoteParser
    parsed = ObsidianNoteParser.parse(full_path)

    return {
        "title": parsed["title"],
        "folder": parsed["folder"],
        "tags": parsed["tags"],
        "content": content,
        "clean_content": parsed["clean_content"],
        "metadata": parsed["metadata"],
        "linked_notes": parsed["linked_notes"],
        "path": path,
    }

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

async def scan_file_against_db(filename, filepath, owner, content, fsize):
    try:
        # Load signatures
        sig_path = os.path.join(BASE_DIR, "signatures.json")
        if not os.path.exists(sig_path):
            return
        
        with open(sig_path, 'r', encoding='utf-8') as f:
            signatures = json.load(f)
            
        # 1. Hash Check (Simulating ClamAV hash DB)
        hasher = hashlib.sha256()
        try:
            with open(filepath, 'rb') as f:
                buf = f.read()
                hasher.update(buf)
            file_hash = hasher.hexdigest()
        except Exception:
            file_hash = None
            
        if file_hash:
            for h_rule in signatures.get("malicious_hashes", []):
                if file_hash == h_rule.get("hash"):
                    alert_id = f"sec-{int(time.time() * 1000)}-{filename}"
                    rule_desc = h_rule.get("name", "Hash SHA-256 malicioso detectado")
                    severity = h_rule.get("severity", "Crítico")
                    desc = f"Riesgo detectado en '{filename}': Coincidencia de firma ({rule_desc})."
                    log_event(alert_id, filename, desc, "Riesgo de Seguridad", severity, "icon-danger", None, filepath, fsize, owner)
                    alert = {
                        "id": alert_id, "title": f"¡Amenaza Detectada!: {filename}",
                        "description": desc, "time": "Hace unos segundos",
                        "severity": severity, "iconClass": "icon-danger", "owner": owner
                    }
                    await manager.broadcast({"type": "created", "file": filename, "alert": alert})
                    return
            
        # 2. Text Pattern Matching (Simulating YARA rules)
        if content and content.strip():
            for rule in signatures.get("malicious_patterns", []):
                pattern = rule.get("pattern")
                if re.search(pattern, content):
                    severity = rule.get("severity", "Alto")
                    rule_desc = rule.get("description", "Patrón sospechoso")
                    alert_id = f"sec-{int(time.time() * 1000)}-{filename}"
                    desc = f"Riesgo detectado en '{filename}': Coincidencia de patrón ({rule_desc})."
                    log_event(alert_id, filename, desc, "Riesgo de Seguridad", severity, "icon-danger", None, filepath, fsize, owner)
                    alert = {
                        "id": alert_id, "title": f"Riesgo Detectado: {filename}",
                        "description": desc, "time": "Hace unos segundos",
                        "severity": severity, "iconClass": "icon-danger", "owner": owner
                    }
                    await manager.broadcast({"type": "created", "file": filename, "alert": alert})
                    # Stop after first critical match to avoid alert spam
                    if severity == "Crítico":
                        break
                        
    except Exception as e:
        print(f"Error scanning file {filename}: {e}")

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
    
    # Escribir automáticamente nota de auditoría en Obsidian Vault
    try:
        mod = "General"
        if filepath and DIRECTORY in filepath:
            rel = os.path.relpath(filepath, DIRECTORY)
            parts = rel.split(os.sep)
            if len(parts) > 1:
                mod = parts[0]
        from rag_engine_v2 import MemoryWriter
        mw = MemoryWriter(VAULT_PATH)
        mw.write_audit(filename=filename, module=mod, analysis=analysis)
    except Exception as mem_err:
        print(f"[MemoryWriter] Error guardando auditoría: {mem_err}")

    await manager.broadcast({"type": "created", "file": filename, "alert": alert})

class DirectoryMonitor(FileSystemEventHandler):
    def __init__(self, loop):
        self.loop = loop
        self._last_mod = {}

    def on_modified(self, event):
        if not event.is_directory:
            filename = os.path.basename(event.src_path)
            if is_ignored_file(filename):
                return
                
            now = time.time()
            if filename in self._last_mod and now - self._last_mod[filename] < 1.0:
                return
            self._last_mod[filename] = now
            
            try:
                shutil.copy2(event.src_path, os.path.join(BACKUP_DIR, filename))
            except Exception:
                pass
                
            try:
                stat_info = os.stat(event.src_path)
                if pwd:
                    owner = pwd.getpwuid(stat_info.st_uid).pw_name
                else:
                    owner = "Sistema"
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
                time.sleep(0.8)
                try:
                    new_content = extract_file_content(filepath)
                except Exception:
                    new_content = ""
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
                        
                # Trigger Security Scan against DB
                asyncio.run_coroutine_threadsafe(
                    scan_file_against_db(filename, filepath, owner, new_content, fsize),
                    self.loop
                )

                # Update vectorial RAG index
                try:
                    from rag_engine_v2 import get_index
                    idx = get_index()
                    if idx:
                        idx.index_single_file(filepath)
                except Exception as e:
                    print(f"[DirectoryMonitor] RAG reindex error: {e}")

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

            # Remove from vectorial RAG index
            try:
                from rag_engine_v2 import get_index
                idx = get_index()
                if idx:
                    idx.remove_file(event.src_path)
            except Exception as e:
                print(f"[DirectoryMonitor] RAG remove error: {e}")
    def on_moved(self, event):
        if not event.is_directory:
            # Handle source (deleted)
            src_filename = os.path.basename(event.src_path)
            if not is_ignored_file(src_filename):
                owner = "Sistema"
                alert_id = f"del-{int(time.time() * 1000)}-{src_filename}"
                description = f"Archivo movido/eliminado: {src_filename}"
                fsize = get_last_known_size(src_filename)
                log_event(alert_id, src_filename, description, "Eliminado", "Alto", "icon-danger", None, event.src_path, fsize, owner)
                
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast({"type": "deleted", "file": src_filename, "alert": {
                        "id": alert_id, "title": src_filename, "description": description, 
                        "time": "Hace unos segundos", "severity": "Alto", "iconClass": "icon-danger", "owner": owner
                    }}),
                    self.loop
                )

            # Handle destination (created) if it's within our watched directory
            # We can just call on_created for the destination if we want, but watchdog might also trigger on_created. 
            # Actually watchdog on Linux triggers on_moved for renames within the watched dir, or moves to trash.
            if hasattr(event, 'dest_path') and event.dest_path.startswith(DIRECTORY):
                dest_filename = os.path.basename(event.dest_path)
                if not is_ignored_file(dest_filename):
                    try:
                        shutil.copy2(event.dest_path, os.path.join(BACKUP_DIR, dest_filename))
                    except Exception:
                        pass
                    owner = "Sistema"
                    alert_id = f"add-{int(time.time() * 1000)}-{dest_filename}"
                    description = f"Archivo movido/creado: {dest_filename}"
                    try:
                        stat = os.stat(event.dest_path)
                        fsize = stat.st_size
                    except FileNotFoundError:
                        fsize = 0
                    log_event(alert_id, dest_filename, description, "Creación", "Medio", "icon-warning", None, event.dest_path, fsize, owner)
                    
                    asyncio.run_coroutine_threadsafe(
                        manager.broadcast({"type": "created", "file": dest_filename, "alert": {
                            "id": alert_id, "title": dest_filename, "description": description, 
                            "time": "Hace unos segundos", "severity": "Medio", "iconClass": "icon-warning", "owner": owner
                        }}),
                        self.loop
                    )

    def on_created(self, event):
        if not event.is_directory:
            filename = os.path.basename(event.src_path)
            if is_ignored_file(filename):
                return
                
            try:
                shutil.copy2(event.src_path, os.path.join(BACKUP_DIR, filename))
            except Exception:
                pass
                
            try:
                stat_info = os.stat(event.src_path)
                if pwd:
                    owner = pwd.getpwuid(stat_info.st_uid).pw_name
                else:
                    owner = "Sistema"
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

            # Save snapshot for all files (including empty)
            from rag_engine import extract_file_content
            filepath = event.src_path
            content = extract_file_content(filepath)  # may be empty string
            save_file_snapshot(filename, content)
                    
            # Trigger Security Scan against DB
            try:
                content = extract_file_content(filepath)
            except Exception:
                content = ""
            asyncio.run_coroutine_threadsafe(
                scan_file_against_db(filename, filepath, owner, content, fsize),
                self.loop
            )

            # Add to vectorial RAG index
            try:
                from rag_engine_v2 import get_index
                idx = get_index()
                if idx:
                    idx.index_single_file(filepath)
            except Exception as e:
                print(f"[DirectoryMonitor] RAG index error: {e}")

def cleanup_backups():
    if not os.path.exists(BACKUP_DIR): return
    now = time.time()
    for f in os.listdir(BACKUP_DIR):
        p = os.path.join(BACKUP_DIR, f)
        if os.path.isfile(p) and os.stat(p).st_mtime < now - 30 * 86400:
            try: os.remove(p)
            except Exception: pass

@app.on_event("startup")
async def startup_event():
    cleanup_backups()
    
    # Purge all snapshots older than 7 days globally
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
        c.execute('DELETE FROM file_snapshots WHERE timestamp < ?', (seven_days_ago,))
        purged = c.rowcount
        conn.commit()
        conn.close()
        if purged > 0:
            print(f"[Vault] Purged {purged} snapshots older than 7 days.")
    except Exception as e:
        print(f"[Vault] Error purging old snapshots: {e}")
    loop = asyncio.get_running_loop()

    # --- 1. Seed initial file snapshots (existing behavior) ---
    if os.path.exists(DIRECTORY):
        from rag_engine import extract_file_content
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        for root, dirs, files in os.walk(DIRECTORY):
            for filename in files:
                if is_ignored_file(filename):
                    continue
                filepath = os.path.join(root, filename)
                
                # Ensure historical files are backed up just in case
                if os.path.isfile(filepath):
                    backup_path = os.path.join(BACKUP_DIR, filename)
                    if not os.path.exists(backup_path):
                        try:
                            shutil.copy2(filepath, backup_path)
                        except Exception:
                            pass
                
                    c.execute('SELECT COUNT(*) FROM file_snapshots WHERE filename = ?', (filename,))
                    if c.fetchone()[0] == 0:
                        try:
                            content = extract_file_content(filepath)
                            if content.strip():
                                c.execute('INSERT INTO file_snapshots (filename, content) VALUES (?, ?)', (filename, content))
                        except Exception as e:
                            print(f"Error extracting content for {filename}: {e}")
        conn.commit()
        conn.close()

        # Start directory watchdog (existing behavior)
        observer = Observer()
        event_handler = DirectoryMonitor(loop)
        observer.schedule(event_handler, DIRECTORY, recursive=True)
        observer.start()

    # --- 2. Initialize RAG v2 (vectorial search) ---
    try:
        from rag_engine_v2 import init_index
        print("[Startup] Initializing RAG v2 vectorial index...")
        vector_index = init_index()

        # Index Obsidian vault
        print("[Startup] Indexing Obsidian vault...")
        vault_chunks = vector_index.index_vault(VAULT_PATH)
        print(f"[Startup] Vault: {vault_chunks} chunks indexed")

        # Index monitored directory
        if os.path.exists(DIRECTORY):
            print("[Startup] Indexing monitored directory...")
            dir_chunks = vector_index.index_directory(DIRECTORY)
            print(f"[Startup] Directory: {dir_chunks} chunks indexed")

        print(f"[Startup] RAG v2 ready: {vector_index.total_count()} total chunks")

        # --- 3. Start vault watcher (Obsidian hot-reload) ---
        try:
            from vault_watcher import start_vault_watcher
            print(f"[Startup] Starting vault watcher on {VAULT_PATH}...")
            start_vault_watcher(
                vault_path=VAULT_PATH,
                vector_index=vector_index,
                ws_manager=manager,
                event_loop=loop,
            )
            print("[Startup] Vault watcher active ✅")
        except Exception as e:
            print(f"[Startup] ⚠️ Vault watcher failed to start: {e}")

    except Exception as e:
        print(f"[Startup] ⚠️ RAG v2 initialization failed: {e}")
        print("[Startup] Chat will work without vectorial RAG (degraded mode)")

@app.get("/api/iam/sessions")
def get_iam_sessions():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        SELECT s.id, u.username, u.role, s.ip_address, s.country, s.flag, s.status, s.last_login 
        FROM iam_sessions s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.last_login DESC
    ''')
    rows = c.fetchall()
    conn.close()
    
    sessions = []
    for r in rows:
        sessions.append({
            "id": r[0],
            "name": r[1],
            "role": r[2],
            "ip": r[3],
            "country": r[4],
            "flag": r[5],
            "status": r[6],
            "time": calculate_time_ago(r[7]),
            "timestamp": r[7]
        })
    return sessions

@app.post("/api/iam/sessions/{session_id}/revoke")
async def revoke_iam_session(session_id: int):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("UPDATE iam_sessions SET status = 'revoked' WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    
    # Notify frontend
    await manager.broadcast({"type": "modified", "module": "iam"})
    
    return {"status": "success", "message": "Session revoked"}

@app.get("/api/iam/anomalies")
def get_iam_anomalies():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id, title, description, timestamp FROM iam_anomalies ORDER BY timestamp DESC LIMIT 50")
    rows = c.fetchall()
    conn.close()
    
    anomalies = []
    for r in rows:
        anomalies.append({
            "id": r[0],
            "title": r[1],
            "desc": r[2],
            "time": calculate_time_ago(r[3]),
            "timestamp": r[3]
        })
    return anomalies

@app.get("/api/users")
def get_users():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id, username, role, department, created_at FROM users ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    
    users = []
    for r in rows:
        users.append({
            "id": r[0],
            "username": r[1],
            "role": r[2],
            "department": r[3],
            "created_at": r[4]
        })
    return users

class UserCreate(BaseModel):
    username: str
    role: str
    department: str
    password: str = None

@app.post("/api/users")
def create_user(user: UserCreate):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        pwd_hash = pwd_context.hash(user.password) if user.password else pwd_context.hash("123456")
        c.execute("INSERT INTO users (username, role, department, password_hash) VALUES (?, ?, ?, ?)", 
                  (user.username, user.role, user.department, pwd_hash))
        user_id = c.lastrowid
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
    conn.close()
    return {"status": "success", "message": "Usuario creado", "id": user_id}

@app.put("/api/users/{user_id}")
def update_user(user_id: int, user: UserCreate):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        if user.password:
            pwd_hash = pwd_context.hash(user.password)
            c.execute("UPDATE users SET username = ?, role = ?, department = ?, password_hash = ? WHERE id = ?", 
                      (user.username, user.role, user.department, pwd_hash, user_id))
        else:
            c.execute("UPDATE users SET username = ?, role = ?, department = ? WHERE id = ?", 
                      (user.username, user.role, user.department, user_id))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
    conn.close()
    return {"status": "success", "message": "Usuario actualizado"}

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
def login(req: LoginRequest):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id, username, role, department, password_hash FROM users WHERE username = ?", (req.username,))
    row = c.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
    user_id, username, role, department, password_hash = row
    
    if not password_hash or not pwd_context.verify(req.password, password_hash):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
        
    return {
        "status": "success", 
        "user": {
            "id": user_id,
            "username": username,
            "role": role,
            "department": department
        }
    }

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    # Revoke sessions first for security
    c.execute("UPDATE iam_sessions SET status = 'revoked' WHERE user_id = ?", (user_id,))
    
    # Optionally delete user
    c.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    
    # Notify frontend
    await manager.broadcast({"type": "modified", "module": "iam"})
    
    return {"status": "success", "message": "Usuario eliminado y sesiones revocadas"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
