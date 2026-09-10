#!/usr/bin/env python3
"""
check_critical_alerts.py
Sondeo determinista de alertas críticas para A.R.I.A y Hermes Agent.

Comportamiento:
1. Consulta GET http://127.0.0.1:8000/api/reports?resolved=false
2. Filtra eventos en ventana reciente (<= 45 min) no vistos previamente.
3. Evalúa severidad según política operacional:
   - Alto / Crítico: Siempre de atención inmediata.
   - Medio: De atención inmediata fuera de horario laboral (20:00 - 08:00 o fines de semana).
4. Para cada alerta válida, consulta el RAG local (POST /api/rag/query).
5. Si no hay alertas nuevas: SILENCIO ABSOLUTO (sin mensajes a Telegram ni consumo de tokens).
6. Si hay alertas: genera reporte enriquecido con datos reales y precedentes.
"""

import sys
import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

ARIA_URL = os.environ.get("ARIA_URL", "http://127.0.0.1:8000")
BASE_DIR = "/home/astra/Projects/ARIA"
SEEN_FILE = os.path.join(BASE_DIR, ".hermes_alerts_seen.json")
MAX_SEEN_IDS = 500


def is_business_hours(dt: datetime) -> bool:
    """Lunes a Viernes de 08:00 a 20:00 (hora local)."""
    if dt.weekday() >= 5:  # Sábado (5) o Domingo (6)
        return False
    return 8 <= dt.hour < 20


def load_seen_ids() -> set:
    if os.path.exists(SEEN_FILE):
        try:
            with open(SEEN_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return set(data.get("seen_ids", []))
        except Exception:
            return set()
    return set()


def save_seen_ids(seen_ids: set):
    try:
        ids_list = list(seen_ids)[-MAX_SEEN_IDS:]
        with open(SEEN_FILE, "w", encoding="utf-8") as f:
            json.dump({"seen_ids": ids_list, "updated_at": datetime.now().isoformat()}, f, indent=2)
    except Exception as e:
        sys.stderr.write(f"[check_critical_alerts] Error guardando seen_ids: {e}\n")


def http_get(url: str, timeout: float = 6.0):
    req = urllib.request.Request(url, headers={"User-Agent": "Hermes-Monitor/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_post(url: str, payload: dict, timeout: float = 10.0):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "Hermes-Monitor/1.0"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def query_rag(alert: dict) -> dict:
    title = alert.get("title") or alert.get("filename") or ""
    event_type = alert.get("type") or ""
    desc = alert.get("description") or ""
    query_text = f"{title} {event_type} {desc}".strip()
    try:
        return http_post(f"{ARIA_URL}/api/rag/query", {"query": query_text, "top_k": 3}, timeout=8.0)
    except Exception as e:
        return {"context": f"RAG no disponible: {e}", "sources": []}


def should_process_alert(alert: dict, now: datetime, seen_ids: set) -> bool:
    alert_id = alert.get("id")
    if not alert_id or alert_id in seen_ids:
        return False
    if alert.get("resolved", False):
        return False

    # Filtrar por tiempo (últimos 45 minutos)
    ts_str = alert.get("timestamp")
    if ts_str:
        try:
            alert_dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            if alert_dt.tzinfo is None:
                diff = (now - alert_dt).total_seconds()
            else:
                diff = (datetime.now(timezone.utc) - alert_dt).total_seconds()
            if diff > 45 * 60:
                return False
        except Exception:
            pass

    event_type = (alert.get("type") or "").strip()
    sev = (alert.get("severity") or "Bajo").capitalize()

    # Modificaciones de archivos siempre califican
    if event_type in ("Modificación", "Comparación") or alert_id.startswith(("mod-", "cmp-")):
        return True

    # Alertas críticas o altas siempre califican
    if sev in ("Alto", "Crítico"):
        return True

    # Alertas medias fuera de horario laboral
    if sev == "Medio" and not is_business_hours(now):
        return True

    return False


def format_report(alert: dict, rag_result: dict, now: datetime) -> str:
    filename = alert.get("title") or alert.get("filename") or "Archivo desconocido"
    event_type = alert.get("type") or "Evento"
    severity = (alert.get("severity") or "Medio").upper()
    desc = alert.get("description") or "Sin descripción"
    ai_analysis = alert.get("aiAnalysis")

    is_modification = event_type in ("Modificación", "Comparación") or alert.get("id", "").startswith(("mod-", "cmp-"))

    if is_modification:
        if severity in ("ALTO", "CRÍTICO"):
            icon = "🚨"
            header = "🚨 **MODIFICACIÓN CON OBSERVACIONES CRÍTICAS**"
        else:
            icon = "📝"
            header = "📝 **MODIFICACIÓN DE ARCHIVO DETECTADA EN A.R.I.A**"
    elif severity in ("ALTO", "CRÍTICO"):
        icon = "🚨"
        header = "🚨 **ALERTA CRÍTICA DETECTADA EN A.R.I.A**"
    else:
        icon = "⚠️"
        header = "⚠️ **NOTIFICACIÓN DE SEGURIDAD EN A.R.I.A**"

    lines = [
        header,
        f"• **Archivo:** `{filename}`",
        f"• **Tipo de Evento:** {event_type}",
        f"• **Severidad:** `{severity}`",
        f"• **Detalle:** {desc}",
        f"• **Hora:** {alert.get('timestamp', now.strftime('%Y-%m-%d %H:%M:%S'))}",
    ]

    sources = rag_result.get("sources", [])
    if sources:
        top_source = sources[0]
        score = top_source.get("score", 0)
        lines.append(f"• **Precedente RAG:** Registrado en `{top_source.get('title', 'Obsidian')}` (Similitud: {score:.2f})")
    else:
        lines.append("• **Precedente RAG:** Sin precedentes anómalos previos.")

    if ai_analysis and len(ai_analysis.strip()) > 10:
        clean_ai = ai_analysis.strip()
        if len(clean_ai) > 380:
            clean_ai = clean_ai[:380] + "..."
        quoted = "\n> ".join(clean_ai.splitlines())
        lines.append(f"\n> **Auditoría IA:**\n> {quoted}")

    return "\n".join(lines)


def main():
    use_wake_gate = "--wake-gate" in sys.argv
    now = datetime.now()
    seen_ids = load_seen_ids()

    try:
        reports = http_get(f"{ARIA_URL}/api/reports?resolved=false")
    except Exception as e:
        sys.stderr.write(f"[check_critical_alerts] No se pudo conectar a A.R.I.A: {e}\n")
        if use_wake_gate:
            print(json.dumps({"wakeAgent": False}))
        sys.exit(0)

    qualifying_alerts = [a for a in reports if should_process_alert(a, now, seen_ids)]

    if not qualifying_alerts:
        # Silencio absoluto
        if use_wake_gate:
            print(json.dumps({"wakeAgent": False}))
        sys.exit(0)

    # Deduplicar: Si para un mismo archivo existe 'Comparación' y 'Modificación',
    # priorizar 'Comparación' (incluye auditoría de IA) y marcar 'Modificación' como vista.
    cmp_files = {
        (a.get("title") or a.get("filename") or "").strip()
        for a in qualifying_alerts
        if (a.get("type") == "Comparación" or (a.get("id") or "").startswith("cmp-"))
    }

    final_alerts = []
    for a in qualifying_alerts:
        a_id = a.get("id")
        fname = (a.get("title") or a.get("filename") or "").strip()
        is_mod = (a.get("type") == "Modificación" or (a_id or "").startswith("mod-"))
        if is_mod and fname in cmp_files:
            seen_ids.add(a_id)
            continue
        final_alerts.append(a)

    if not final_alerts:
        save_seen_ids(seen_ids)
        if use_wake_gate:
            print(json.dumps({"wakeAgent": False}))
        sys.exit(0)

    # Procesar alertas encontradas
    reports_output = []
    for alert in final_alerts:
        alert_id = alert["id"]
        seen_ids.add(alert_id)
        rag_data = query_rag(alert)
        reports_output.append(format_report(alert, rag_data, now))

    save_seen_ids(seen_ids)

    # Imprimir resultado para entrega
    full_output = "\n\n---\n\n".join(reports_output)
    print(full_output)

    if use_wake_gate:
        print(json.dumps({"wakeAgent": True}))


if __name__ == "__main__":
    main()
