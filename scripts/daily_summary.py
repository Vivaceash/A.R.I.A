#!/usr/bin/env python3
"""
daily_summary.py
Generación determinista del resumen diario matutino (08:00 AM) para A.R.I.A y Hermes.
Obtiene métricas reales, eventos de las últimas 24 horas y contexto del RAG.
"""

import sys
import os
import json
import urllib.request
from datetime import datetime, timedelta

ARIA_URL = os.environ.get("ARIA_URL", "http://127.0.0.1:8000")


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


def main():
    now = datetime.now()
    try:
        stats = http_get(f"{ARIA_URL}/api/stats")
    except Exception:
        stats = {}

    try:
        reports = http_get(f"{ARIA_URL}/api/reports")
    except Exception:
        reports = []

    metrics = stats.get("metrics", {})
    total_files = metrics.get("archivos_analizados", len(stats.get("files", [])) or "N/A")
    riesgo = metrics.get("riesgo_promedio", "Normal")

    cutoff = now - timedelta(hours=24)
    recent_reports = []
    for r in reports:
        ts_str = r.get("timestamp")
        if ts_str:
            try:
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if dt.replace(tzinfo=None) >= cutoff:
                    recent_reports.append(r)
            except Exception:
                pass

    active_alerts = len([r for r in reports if not r.get("resolved")])
    critical_active = len([r for r in reports if not r.get("resolved") and (r.get("severity") or "").capitalize() in ("Alto", "Crítico")])
    resolved_24h = len([r for r in recent_reports if r.get("resolved")])

    if critical_active > 0:
        general_status = f"🚨 Atención Requerida ({critical_active} alertas críticas)"
    elif active_alerts > 5:
        general_status = f"⚠️ Atención Moderada ({active_alerts} alertas pendientes)"
    else:
        general_status = "✅ Normal / Estable"

    lines = [
        "📋 **Buenos días — Resumen Operativo de A.R.I.A**",
        f"📅 Fecha: {now.strftime('%d/%m/%Y %H:%M')}",
        "",
        f"• **Estado General:** {general_status}",
        f"• **Nivel de Riesgo Promedio:** `{riesgo}`",
        f"• **Archivos Monitoreados:** `{total_files}` activos",
        f"• **Alertas Activas Pendientes:** `{active_alerts}`",
        f"• **Alertas Resueltas (últimas 24h):** `{resolved_24h}`",
    ]

    if recent_reports:
        lines.append("\n**Últimos Eventos Registrados:**")
        for r in recent_reports[:4]:
            sev = (r.get("severity") or "Bajo").capitalize()
            icon = "🚨" if sev in ("Alto", "Crítico") else ("⚠️" if sev == "Medio" else "ℹ️")
            status_txt = "Resuelto" if r.get("resolved") else "Pendiente"
            lines.append(f"{icon} `{r.get('title', 'Archivo')}` ({r.get('type', 'Evento')}) — *{status_txt}*")

    # Consulta RAG
    try:
        rag_data = http_post(f"{ARIA_URL}/api/rag/query", {"query": "resumen actividad sistema ayer", "top_k": 2}, timeout=6.0)
        sources = rag_data.get("sources", [])
        if sources:
            lines.append(f"\n🧠 **Insight de Memoria (RAG):** Base de conocimiento sincronizada con `{sources[0].get('title', 'Obsidian')}`.")
    except Exception:
        pass

    print("\n".join(lines))


if __name__ == "__main__":
    main()
