# Hermes Project — A.R.I.A Autonomous Intelligence Agent
> **Versión**: 1.0 — En desarrollo activo
> **Última actualización**: 2026-09-07
> **Estado**: Diseño aprobado, pendiente de instalación

---

## Visión

Hermes corre 24/7 como proceso autónomo integrado con A.R.I.A.
No requiere intervención manual. Una vez configurado:

- Vigila el sistema continuamente
- Manda alertas por Telegram de forma autónoma al detectar amenazas
- Genera resumen diario a las 8am sin que nadie lo pida
- Genera análisis semanal los domingos con tendencias y patrones
- Aprende de todo lo que ve y escribe sus memorias en Obsidian
- Mejora sus propios skills con cada ciclo
- Recuerda todo entre sesiones (historial completo, cross-session)

---

## Arquitectura Autónoma Completa

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     STACK AUTÓNOMO — 24/7                               │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    A.R.I.A (Backend inmutable)                    │  │
│  │                                                                  │  │
│  │  Watchdog ──► SQLite (alertas)          FastAPI :8000            │  │
│  │  ChromaDB ◄── VaultWatcher ◄── Obsidian Vault                    │  │
│  │  gemma4:e4b (Ollama :11434) — auditorías automáticas de archivos │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │ HTTP REST                             │
│  ┌──────────────────────────────▼───────────────────────────────────┐  │
│  │               HERMES AGENT (Proceso autónomo 24/7)               │  │
│  │                                                                  │  │
│  │  ┌─────────────────────────────────────────────────────────┐    │  │
│  │  │  SCHEDULER AUTÓNOMO (4 crons, no requieren intervención) │    │  │
│  │  │  • Cada 15min → revisar alertas críticas                 │    │  │
│  │  │  • Cada 8:00am → resumen diario → Telegram               │    │  │
│  │  │  • Cada 2:00am → síntesis + patrones → Obsidian          │    │  │
│  │  │  • Domingos 7am → análisis semanal profundo → Telegram   │    │  │
│  │  └─────────────────────────────────────────────────────────┘    │  │
│  │                                                                  │  │
│  │  ┌─────────────────────────────────────────────────────────┐    │  │
│  │  │  MEMORIA PERSISTENTE (4 capas)                           │    │  │
│  │  │  1. Skills library (~/.hermes/skills/) ← auto-mejora    │    │  │
│  │  │  2. SQLite FTS5 (~/.hermes/)           ← historial total │    │  │
│  │  │  3. Honcho user model                  ← aprende de ti   │    │  │
│  │  │  4. Obsidian Vault (compartida)        ← conocimiento    │    │  │
│  │  └─────────────────────────────────────────────────────────┘    │  │
│  │                                                                  │  │
│  │  Modelo: gemma4:e4b via Ollama :11434 (compartido con A.R.I.A)  │  │
│  └────────────────────────────────────┬─────────────────────────────┘  │
│                                       │ Telegram Bot API               │
│                                       ▼                                │
│                                 📱 Tu Telegram                         │
│                          • Alertas críticas inmediatas                 │
│                          • Resumen diario 8am                          │
│                          • Análisis semanal domingos                   │
│                          • Responde tus preguntas con contexto ARIA    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Loop de Auto-Mejora Bidireccional

El sistema se vuelve más inteligente con el uso. Funciona solo.

```
Evento detectado en A.R.I.A (alerta, modificación, anomalía)
        │
        ▼
[1] HERMES CONSULTA RAG ANTES DE ACTUAR
    POST http://127.0.0.1:8000/api/rag/query
    { "query": "<contexto del evento>" }
    → "¿Ya sé algo sobre esto? ¿Hay precedente?"
        │
        ├── Sí → enriquece análisis con contexto histórico
        └── No → actúa con lógica base, aprende del resultado
        │
        ▼
[2] HERMES ACTÚA AUTÓNOMAMENTE
    • Clasifica severidad real (vs la de A.R.I.A)
    • Decide si notificar ahora o esperar al resumen
    • Genera mensaje contextualizado para Telegram
        │
        ▼
[3] HERMES ESCRIBE SU APRENDIZAJE EN OBSIDIAN
    POST http://127.0.0.1:8000/api/chat
    { "messages": [{"role": "user",
      "content": "recuerda que: [HERMES] <aprendizaje>"}] }
        │
        ▼
[4] VAULTWATCHER DE A.R.I.A DETECTA EL .md NUEVO
    → Re-indexa automáticamente en ChromaDB
    → Disponible como contexto RAG en próximas consultas
        │
        ▼
[5] SKILL DE HERMES SE ACTUALIZA (sistema nativo de Hermes)
    → La próxima vez toma una decisión mejor
    → Menos falsos positivos, más precisión

EFECTO ACUMULATIVO:
  Semana 1: Hermes aprende patrones básicos del sistema
  Semana 4: Hermes ya sabe cuáles alertas son normales
  Mes 3:    Hermes anticipa anomalías antes de que escalen
```

---

## FASE 1 — INSTALACIÓN

### 1.1 Instalar Hermes Agent (Linux)

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc
hermes --version
```

Lo que instala automáticamente (en ~/.hermes/, aislado de A.R.I.A):
- uv (gestor Python de Astral)
- Python 3.11 (aislado, no toca el venv de A.R.I.A)
- Node.js runtime
- ripgrep, ffmpeg
- Binario `hermes`

### 1.2 Configurar modelo local gemma4:e4b

```bash
# Hermes usará el mismo Ollama que ya corre con A.R.I.A
hermes config set OLLAMA_BASE_URL http://127.0.0.1:11434
hermes config set model ollama/gemma4:e4b

# Verificar conexión
hermes
# Escribir: "¿qué modelo usas?" → debe responder mencionando gemma4
```

**Nota sobre concurrencia**: Ollama serializa peticiones en cola.
Hermes y A.R.I.A pueden usar gemma4:e4b simultáneamente sin conflicto.
Si se requiere mayor throughput, se puede asignar llama3.2:3b a Hermes
para crons simples y reservar gemma4 para auditorías profundas de A.R.I.A.

---

## FASE 2 — TELEGRAM GATEWAY

### 2.1 Crear el bot en Telegram

1. Abrir Telegram → buscar **@BotFather**
2. Enviar: `/newbot`
3. Nombre: `ARIA Monitor` (o el que prefieras)
4. Username: `aria_astra_bot` (debe terminar en `bot`, ser único)
5. Guardar el **token** que devuelve: `1234567890:ABCdefGHI...`

6. Buscar **@userinfobot** en Telegram
7. Enviarle cualquier mensaje → responde con tu **User ID** numérico

### 2.2 Configurar en Hermes

```bash
hermes config set TELEGRAM_BOT_TOKEN "1234567890:ABCdefGHI..."
hermes config set TELEGRAM_ALLOWED_USERS "TU_USER_ID"
hermes gateway setup telegram
```

### 2.3 Iniciar gateway

```bash
hermes gateway start

# Probar desde Telegram:
# Mensaje al bot: "hola"
# Hermes debe responder
```

---

## FASE 3 — ENDPOINT RAG EN server.py

Agregar en `/home/astra/Projects/ARIA/server.py` después de la línea ~2248:

```python
# ============================================================
# HERMES INTEGRATION: RAG Query Endpoint
# Allows Hermes autonomous agent to query A.R.I.A's vector DB
# before taking autonomous decisions
# ============================================================

class RAGQueryPayload(BaseModel):
    query: str
    top_k: int = 4
    include_stats: bool = True
    module: str = ""

@app.post("/api/rag/query")
async def rag_query_for_hermes(payload: RAGQueryPayload):
    """
    Endpoint para consultas RAG autónomas desde Hermes Agent.
    Hermes llama esto ANTES de tomar cualquier decisión,
    usando el conocimiento acumulado de A.R.I.A como contexto.
    """
    from rag_engine_v2 import retrieve_context_with_sources
    
    query = payload.query
    if payload.module:
        query = f"[{payload.module.upper()}] {query}"
    
    try:
        context, sources = retrieve_context_with_sources(
            query, top_k=payload.top_k
        )
    except Exception as e:
        context, sources = f"RAG no disponible: {e}", []
    
    result = {
        "context": context,
        "sources": [
            {"title": s.get("title", ""), "path": s.get("path", "")}
            for s in (sources or [])
        ],
        "query": query,
    }
    
    if payload.include_stats:
        try:
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute("""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN resolved=0 THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN severity='Alto' AND resolved=0
                             THEN 1 ELSE 0 END) as critical
                FROM alert_history
            """)
            row = c.fetchone()
            c.execute("""
                SELECT COUNT(*) FROM alert_history
                WHERE datetime(timestamp) >= datetime('now', '-2 hours')
                AND resolved = 0
            """)
            recent = c.fetchone()[0]
            conn.close()
            result["system_status"] = {
                "total_alerts": row[0] or 0,
                "active_alerts": row[1] or 0,
                "critical_alerts": row[2] or 0,
                "recent_alerts_2h": recent or 0,
            }
        except Exception as e:
            result["system_status"] = {"error": str(e)}
    
    return result
```

---

## FASE 4 — SKILLS INICIALES DE HERMES

### Crear `~/.hermes/skills/aria_core.md`

```markdown
# SKILL: aria_core — Núcleo de integración A.R.I.A

## Identidad y propósito
Soy el agente autónomo externo del sistema A.R.I.A.
Vigilo, aprendo y notifico SIN que nadie me lo pida.
Actúo por iniciativa propia según mis schedulers.

## REGLA ABSOLUTA: consultar RAG antes de actuar
Sin excepción, antes de cualquier análisis sobre A.R.I.A:

  POST http://127.0.0.1:8000/api/rag/query
  { "query": "<contexto del evento>", "top_k": 4 }

Esto me da el conocimiento acumulado antes de actuar.

## Endpoints de A.R.I.A disponibles
- GET  /api/stats           → métricas en tiempo real del sistema
- GET  /api/reports         → alertas (params: module=, severity=)
- GET  /api/files           → archivos en directorio monitoreado
- GET  /api/rag/status      → estado del índice ChromaDB
- POST /api/rag/query       → búsqueda semántica vectorial
- POST /api/chat            → escribir memorias en Obsidian Vault
- WS   /api/ws              → eventos WebSocket en tiempo real

## Módulos del sistema A.R.I.A
- finanzas       → archivos contables, xlsx, facturas
- ciberseguridad → eventos de seguridad transversales
- inventarios    → archivos de stock e inventario
- general        → visión global de todos los módulos

## Cómo escribir una memoria nueva en Obsidian
Cuando aprendo algo que vale la pena recordar a largo plazo:

  POST http://127.0.0.1:8000/api/chat
  {
    "messages": [{
      "role": "user",
      "content": "recuerda que: [HERMES] <aprendizaje detallado>"
    }]
  }

A.R.I.A VaultWatcher indexará la nota en ChromaDB automáticamente.
Prefijo mis notas con [HERMES] para distinguirlas de las de A.R.I.A.

## Escala de urgencia para Telegram
- severity=Alto + fuera de horario (20:00-08:00) → 🚨 Inmediato
- severity=Alto + horario laboral (08:00-20:00)  → ⚠️  Inmediato
- severity=Medio + fuera de horario              → ⚠️  Inmediato
- severity=Medio + horario laboral               → 📋 Resumen diario
- severity=Bajo                                  → 📊 Resumen semanal
- Sin alertas nuevas                             → ✅ Solo en resumen diario

## Horario laboral
Lunes a Viernes, 08:00 – 20:00 hora local (UTC-6 Ciudad de México).
Sábado y Domingo cualquier alerta Alto = crítica.

## Formato de mensajes Telegram
Usar emojis para clasificación rápida visual:
🚨 = Crítico, acción inmediata requerida
⚠️  = Advertencia, revisar pronto
📋 = Resumen diario informativo
📊 = Resumen semanal con estadísticas
🧠 = Nuevo aprendizaje guardado en Obsidian
✅ = Todo normal, sin incidencias
```

### Crear `~/.hermes/skills/aria_patterns.md`

```markdown
# SKILL: aria_patterns — Detección de patrones en A.R.I.A

## Propósito
Distinguir comportamiento normal del sistema vs anomalías reales.
Esta skill se auto-enriquece: cada patrón nuevo detectado se escribe
en Obsidian y vuelve como contexto RAG en la próxima ejecución.

## Patrones base conocidos (se expanden automáticamente)
- .xlsx en módulo finanzas, horario 09:00-18:00 → NORMAL
- Eliminaciones los lunes por la madrugada → posible backup
- Módulo inventarios sin actividad >72h → posible falla watchdog
- Creación de archivos .pdf en reportes → NORMAL (generación automática)

## Indicadores de anomalía real
- Cualquier actividad entre 00:00-06:00 en módulos de negocio
- >5 eliminaciones en <10 minutos en cualquier módulo
- Modificación simultánea en 3+ módulos
- Archivos .exe, .bat, .sh, .ps1 en módulos de negocio
- Inactividad >3 días en módulo normalmente activo
- Cambios en archivos de configuración del sistema

## Proceso de detección de nuevo patrón
1. GET /api/reports → últimas 50 alertas
2. POST /api/rag/query → comparar con patrones conocidos
3. Si encuentro algo sin precedente en el RAG:
   a. Analizar si es amenaza real o comportamiento nuevo legítimo
   b. Escribir en Obsidian: POST /api/chat
      "recuerda que: [HERMES][PATRÓN] <descripción detallada>"
   c. Si es amenaza → notificar Telegram con 🚨
   d. Si es comportamiento nuevo legítimo → notificar con ℹ️
```

### Crear `~/.hermes/skills/aria_memory.md`

```markdown
# SKILL: aria_memory — Gestión de memoria bidireccional

## Propósito
Gestionar el ciclo completo de aprendizaje entre Hermes y A.R.I.A.

## Cuándo escribir una memoria nueva
- Cuando resuelvo un tipo de alerta por primera vez
- Cuando detecto un patrón que no estaba en el RAG
- Cuando el usuario me enseña algo nuevo sobre el sistema
- Después de cada análisis semanal (síntesis de tendencias)
- Cuando una predicción resulta correcta o incorrecta

## Formato de notas que escribo
[HERMES][TIPO] Descripción
Tipos disponibles:
  [PATRÓN]    → comportamiento recurrente detectado
  [ANOMALÍA]  → incidente real confirmado
  [SÍNTESIS]  → análisis semanal de tendencias
  [APRENDIZAJE] → lección aprendida de un error o acierto
  [PROCEDIMIENTO] → cómo manejé un tipo de situación exitosamente

## Deduplicación automática
A.R.I.A ya tiene deduplicación semántica (similitud ≥0.85).
Si ya existe una nota similar, la consolida en lugar de duplicar.
Esto significa que mis notas mejoran en calidad con el tiempo,
no solo en cantidad.

## Cómo buscar en mi propia memoria
  POST /api/rag/query { "query": "lo que busco", "top_k": 5 }
  → devuelve mis notas [HERMES] + las de A.R.I.A

## Búsqueda en historial de sesiones propio
  /memory search <query>   → busca en SQLite FTS5 de Hermes
  "¿qué hice la última vez que vi una alerta similar?"
```

---

## FASE 5 — CRONS AUTÓNOMOS

Configurar desde el CLI de Hermes una sola vez:

```bash
# Opción A: Decirle en lenguaje natural desde Telegram o CLI
hermes
# Escribir:
```

### Cron 1: Vigilancia de alertas críticas

```
Configura una tarea automática que se ejecute cada 15 minutos,
sin excepción, para hacer lo siguiente:

1. Haz GET http://127.0.0.1:8000/api/reports
2. Filtra solo alertas con severity=Alto, resolved=false,
   y timestamp de los últimos 30 minutos
3. Para cada alerta nueva que no hayas reportado antes:
   a. Consulta el RAG: POST /api/rag/query con el nombre
      del archivo, tipo y módulo como query
   b. Determina si es comportamiento normal o anomalía real
      basándote en el contexto del RAG
   c. Si es anomalía: envía inmediatamente a Telegram con 🚨
   d. Si es patrón nuevo (no estaba en el RAG): escribe
      nota en Obsidian vía POST /api/chat y envía ℹ️ a Telegram
   e. Si es normal según el RAG: no hacer nada, solo registrar
4. Mantén registro interno de alertas ya reportadas para
   no duplicar notificaciones en la siguiente ejecución
```

### Cron 2: Resumen diario autónomo

```
Configura una tarea automática que se ejecute todos los días
a las 8:00 AM para hacer lo siguiente:

1. GET http://127.0.0.1:8000/api/stats → métricas generales
2. GET http://127.0.0.1:8000/api/reports → alertas últimas 24h
3. POST /api/rag/query con query "resumen actividad sistema ayer"
4. Con toda esa información, genera un resumen estructurado:
   - Estado general: normal / requiere atención / crítico
   - Total de alertas por módulo (finanzas, ciberseguridad, inventarios)
   - Alertas resueltas vs pendientes
   - El evento más importante del día (si hubo)
   - Archivos monitoreados activos
   - Algún insight o patrón si lo detectaste en el RAG
5. Envía el resumen a Telegram con formato con emojis,
   comenzando con 📋 Buenos días.
6. Si hay alertas pendientes sin resolver, resaltarlas con ⚠️
```

### Cron 3: Síntesis nocturna de patrones

```
Configura una tarea automática que se ejecute todos los días
a las 2:00 AM para hacer lo siguiente:

1. GET http://127.0.0.1:8000/api/reports con parámetro
   para obtener alertas de los últimos 7 días
2. POST /api/rag/query con query "patrones comportamiento
   archivos anomalías semana"
3. Analiza las alertas con gemma4: busca patrones nuevos,
   comportamientos recurrentes, tendencias, anomalías
4. Para cada insight significativo que no esté ya en el RAG:
   POST http://127.0.0.1:8000/api/chat
   { "messages": [{"role": "user",
     "content": "recuerda que: [HERMES][SÍNTESIS] <insight>"}] }
5. Actualiza o refina tus skills si detectas que tu
   comprensión del sistema ha mejorado
6. Envía Telegram SOLO si encuentras algo crítico o urgente
   que no pueda esperar al resumen de las 8am
```

### Cron 4: Análisis semanal profundo

```
Configura una tarea automática que se ejecute todos los domingos
a las 7:00 AM para hacer lo siguiente:

1. GET /api/reports para todos los módulos, últimos 7 días
2. GET /api/rag/status → métricas del índice vectorial
3. POST /api/rag/query con "análisis semanal patrones riesgo
   tendencias módulos finanzas ciberseguridad inventarios"
4. Análisis profundo:
   - ¿Cuál módulo tuvo más actividad esta semana?
   - ¿Hay tendencias crecientes o decrecientes de alertas?
   - ¿Hubo días de la semana con más incidencias?
   - ¿Qué tipos de archivo generan más alertas?
   - ¿Hay algo que deba llamar la atención del operador?
   - ¿Cuántas notas [HERMES] escribí esta semana?
5. Escribe nota de síntesis semanal en Obsidian:
   POST /api/chat
   { "messages": [{"role": "user",
     "content": "recuerda que: [HERMES][SEMANAL YYYY-WW] <análisis>"}] }
6. Envía resumen completo y detallado a Telegram con 📊,
   incluyendo estadísticas, tendencias y recomendaciones
```

---

## FASE 6 — INTEGRAR EN start.sh

Añadir al final de `/home/astra/Projects/ARIA/start.sh`, antes del bloque de resumen final:

```bash
# ============================================================
# HERMES AGENT — Autonomous AI Monitor Gateway
# ============================================================
echo -e "${BLUE}☤ Iniciando Hermes Agent (modo autónomo 24/7)...${NC}"

if command -v hermes &>/dev/null; then
    # Limpiar instancias previas
    pkill -f "hermes gateway" 2>/dev/null || true
    sleep 1
    
    # Iniciar gateway en background
    nohup hermes gateway start > "$LOGS_DIR/hermes-gateway.log" 2>&1 &
    HERMES_GW_PID=$!
    sleep 2
    
    if ps -p $HERMES_GW_PID > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ Hermes Gateway activo en background (PID: $HERMES_GW_PID)${NC}"
        echo -e "   ${CYAN}  📱 Alertas automáticas: ACTIVAS${NC}"
        echo -e "   ${CYAN}  📋 Resumen diario: 8:00 AM → Telegram${NC}"
        echo -e "   ${CYAN}  🧠 Síntesis nocturna: 2:00 AM → Obsidian${NC}"
        echo -e "   ${CYAN}  📊 Análisis semanal: Domingos 7:00 AM → Telegram${NC}"
    else
        echo -e "   ${RED}✗ Hermes Gateway no pudo iniciar. Ver logs/hermes-gateway.log${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠ Hermes no instalado. Seguir Hermes_Project.md para instalar.${NC}"
fi
```

---

## CAPAS DE MEMORIA — Cómo Hermes Recuerda Todo

### Capa 1: Skills Library (`~/.hermes/skills/`)
- **Qué guarda**: procedimientos, reglas, conocimiento operativo
- **Cómo mejora**: automáticamente con cada uso exitoso
- **Duración**: permanente, sobrevive reinicios
- **Archivos**: `aria_core.md`, `aria_patterns.md`, `aria_memory.md`, + auto-creados

### Capa 2: Session History (SQLite FTS5 en `~/.hermes/`)
- **Qué guarda**: toda conversación y acción ejecutada
- **Cómo mejora**: se indexa con FTS5 para búsqueda instantánea
- **Duración**: configurable, por defecto acumulativo
- **Uso**: "¿la última vez que vi un alerta similar, qué hice?"

### Capa 3: User Model (Honcho dialectic modeling)
- **Qué guarda**: tus preferencias, contexto personal, estilo
- **Cómo mejora**: dialécticamente con cada interacción
- **Duración**: permanente
- **Efecto**: respuestas más personalizadas con el tiempo

### Capa 4: Obsidian Vault (compartida con A.R.I.A)
- **Qué guarda**: patrones, síntesis, aprendizajes [HERMES]
- **Cómo mejora**: VaultWatcher re-indexa en ChromaDB automáticamente
- **Duración**: permanente, con deduplicación semántica
- **Efecto**: el RAG de A.R.I.A se enriquece con el conocimiento de Hermes

---

## DÍA A DÍA: COMPORTAMIENTO ESPERADO (sin intervención)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LUNES A VIERNES — Un día normal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

00:00-07:59  MODO VIGILIA NOCTURNA
  └─ Cada 15min: revisa alertas severity=Alto
  └─ 02:00 AM: análisis de 7 días → notas en Obsidian
  └─ Solo interrumpe si hay algo crítico → 🚨 Telegram inmediato

08:00 AM  RESUMEN MATUTINO → Telegram (automático)
  "📋 Buenos días — Martes 08 Sep 2026
   
   Estado general: ✅ Normal
   
   Alertas últimas 24h:
   • Finanzas: 3 eventos (todos en horario normal)
   • Ciberseguridad: 0 eventos
   • Inventarios: 1 evento (patrón conocido)
   
   Sistema: 47 archivos monitoreados
   RAG: 31 documentos indexados
   
   Sin incidencias pendientes. ☕"

08:00-20:00  MODO ACTIVO
  └─ Cada 15min: alertas críticas → Telegram inmediato si hay
  └─ Aprende patrones nuevos → escribe en Obsidian
  └─ Mejora skills cuando resuelve algo por primera vez

20:00  TRANSICIÓN A MODO NOCTURNO
  └─ Umbral sube: severity=Medio ya es alerta por la noche
  └─ Cualquier modificación de archivo → analizar más profundo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EJEMPLO: ALERTA REAL DETECTADA A LAS 02:17 AM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A.R.I.A Watchdog detecta: eliminación en /concilio/Finanzas/
gemma4 analiza diff → severity=Alto → guarda en SQLite

02:30 AM (siguiente cron de 15min):
  Hermes lee la alerta
  → POST /api/rag/query "eliminación archivo Finanzas madrugada"
  ← RAG devuelve: "Patrón: backups automáticos los lunes [HERMES]"
  → ¿Es lunes? No, es martes → anomalía real confirmada

02:30 AM → Telegram inmediato:
  "🚨 ALERTA FUERA DE PATRÓN — A.R.I.A

   📁 concilio/Finanzas/presupuesto_Q4.xlsx
   🕐 02:17 AM — Martes (fuera de horario laboral)
   ⚡ Tipo: Eliminación de archivo
   📊 Módulo: Finanzas

   Análisis: Esta eliminación NO corresponde al patrón
   de backups del lunes. Es la única eliminación nocturna
   en Finanzas en los últimos 14 días.

   ⚠️ Recomendación: Verificar si fue acción autorizada."

02:31 AM — Hermes escribe en Obsidian:
  "recuerda que: [HERMES][ANOMALÍA] Eliminación archivo
   Finanzas en madrugada 2026-09-08 02:17, fuera del patrón
   de backups del lunes. Requirió notificación inmediata."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOMINGO 07:00 AM — RESUMEN SEMANAL → Telegram
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  "📊 Resumen Semanal — Semana 37 / 2026

   Actividad general:
   ├─ 143 eventos monitoreados
   ├─ 4 alertas Altas (3 resueltas, 1 pendiente ⚠️)
   ├─ 12 alertas Medias (todas resueltas)
   └─ 127 eventos Bajos / normales

   Por módulo:
   ├─ Finanzas: ↑ +23% actividad (pico miércoles)
   ├─ Ciberseguridad: → Estable, 0 anomalías
   └─ Inventarios: ↓ Inactivo 3 días (watchdog verificado OK)

   Aprendizajes de esta semana:
   ├─ 🧠 3 nuevas notas de patrones en Obsidian
   ├─ 🧠 Skill aria_patterns.md actualizada con 2 patrones nuevos
   └─ 🧠 Patrón nuevo: .pdf en Finanzas los viernes = reporte semanal

   Recomendaciones:
   └─ La alerta pendiente del martes 02:17 requiere revisión manual.

   Próxima síntesis: Domingo 14 Sep 07:00 AM ✅"
```

---

## ROADMAP DE EVOLUCIÓN

### v1.0 — Instalación base (PRIORIDAD ACTUAL)
- [ ] Instalar Hermes Agent via curl
- [ ] Configurar gemma4:e4b via Ollama compartido
- [ ] Crear Bot Telegram + configurar gateway
- [ ] Añadir endpoint `/api/rag/query` en server.py (~40 líneas)
- [ ] Crear skills iniciales: aria_core.md, aria_patterns.md, aria_memory.md
- [ ] Configurar 4 crons autónomos en lenguaje natural
- [ ] Integrar inicio en start.sh

### v1.1 — Skills de dominio especializado
- [ ] aria_finanzas.md — reglas de negocio del módulo financiero
- [ ] aria_ciberseguridad.md — firmas de amenazas + IDS patterns
- [ ] aria_inventarios.md — lógica de reconciliación de stock

### v1.2 — Memoria enriquecida y cruzada
- [ ] Síntesis mensuales en Obsidian (resumen de 4 semanas)
- [ ] Cruce de patrones entre módulos (Ciberseguridad ve a todos)
- [ ] Panel en A.R.I.A que muestre notas [HERMES] en el vault

### v1.3 — Autonomía avanzada
- [ ] WebSocket listener real-time (reemplaza polling de 15min)
- [ ] Subagentes paralelos por módulo (análisis en paralelo)
- [ ] Auto-ajuste de umbrales de alerta basado en histórico acumulado
- [ ] Propuestas automáticas de mejora al sistema A.R.I.A

### v2.0 — Hermes como motor de chat principal
- [ ] Reemplazar /api/chat de A.R.I.A con Hermes como backend
- [ ] Dashboard React con canal de chat directo a Hermes
- [ ] Un solo punto de conversación: Hermes (web + Telegram + CLI)

---

## VERIFICACIÓN POST-INSTALACIÓN

```bash
# 1. Hermes instalado correctamente
hermes --version

# 2. Modelo configurado correctamente
hermes config get model
# Esperado: ollama/gemma4:e4b

# 3. Ollama accesible desde Hermes
curl -s http://127.0.0.1:11434/api/tags | grep gemma4
# Esperado: debe aparecer gemma4:e4b

# 4. Gateway Telegram activo
hermes gateway status
# Esperado: running

# 5. Endpoint RAG nuevo funcionando
curl -s -X POST http://127.0.0.1:8000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "alertas sistema finanzas patrones", "top_k": 2}' \
  | python3 -m json.tool
# Esperado: JSON con context, sources, system_status

# 6. Skills cargados
hermes /skills
# Esperado: aria_core, aria_patterns, aria_memory

# 7. Crons activos
hermes schedule list
# Esperado: 4 tareas programadas

# 8. Prueba de Telegram
# Enviar al bot: "dame el estado actual de ARIA"
# Hermes debe responder con datos de /api/stats
```

---

## RUTAS DEL SISTEMA

```
~/.hermes/
├── bin/                     → binarios (hermes, uv)
├── config.yaml              → tokens Telegram, modelo, config
├── skills/
│   ├── aria_core.md         → skill principal de integración
│   ├── aria_patterns.md     → detección de patrones
│   └── aria_memory.md       → gestión de memoria bidireccional
└── [memoria SQLite FTS5]    → historial completo de sesiones

/home/astra/Projects/ARIA/
├── server.py                → + endpoint /api/rag/query añadido
├── start.sh                 → + bloque de inicio de Hermes
├── Hermes_Project.md        → ESTE ARCHIVO (documento maestro)
└── logs/
    └── hermes-gateway.log   → logs del proceso de Hermes

/home/astra/Documents/ARIA_Vault/
└── [notas con prefijo HERMES] → conocimiento escrito por Hermes
                                  indexado automáticamente en ChromaDB
```

---

*Documento vivo — actualizar a medida que evoluciona el proyecto*
