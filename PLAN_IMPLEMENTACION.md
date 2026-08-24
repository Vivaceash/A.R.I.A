# Plan de Implementación: Obsidian RAG para A.R.I.A

> **Fecha**: 22 de Agosto de 2026
> **Proyecto**: A.R.I.A (Asistente Reactivo de Inteligencia Artificial)
> **Estado**: ✅ APROBADO — En ejecución
> **Última actualización**: 2026-08-22 14:49

---

## Decisiones Resueltas

| Pregunta | Decisión |
|:---|:---|
| **Modelo LLM principal** | `gemma4:e4b` (última versión) — ÚNICO modelo de inferencia |
| **Modelo de Embeddings** | `nomic-embed-text` (~274MB, 768-dim) |
| **Hermes** | **Hermes AI Agent** (framework, NO el modelo hermes3) corriendo sobre gemma4:e4b — **FASE FUTURA** |
| **Motor RAG** | Reemplazar TF-IDF completamente por RAG vectorial con ChromaDB |
| **Ruta del Vault** | `/home/astra/Documents/ARIA_Vault/` |
| **Instalación Obsidian** | Flatpak (sandboxed, seguro, auto-updates) |
| **Contenido del Vault** | Desde cero con plantillas |
| **Hardware** | 12GB VRAM + 16GB RAM |
| **Foco actual** | SOLO Obsidian + sistema RAG (Hermes Agent para después) |

### Análisis de VRAM

```
gemma4:e4b       → ~9.6 GB VRAM (inferencia)
nomic-embed-text → ~0.5 GB VRAM (embeddings)
─────────────────────────────────
Total estimado   → ~10.1 GB / 12 GB disponibles ✅
Margen libre     → ~1.9 GB
```

> **Nota**: Ollama gestiona modelos en memoria bajo demanda. Cuando se usa el chat
> (gemma4), nomic-embed-text puede descargarse temporalmente y viceversa.
> Con 12GB VRAM ambos caben simultáneamente.

---

## Alcance de Este Plan

### 🟢 IMPLEMENTAR AHORA
1. Instalar Obsidian (Flatpak) con GUI
2. Crear vault desde cero con estructura y plantillas
3. Descargar `nomic-embed-text` para embeddings
4. Implementar motor RAG vectorial (`rag_engine_v2.py`) con ChromaDB
5. Hot-reload del vault con watchdog dedicado
6. Nuevos endpoints RAG en server.py
7. Integración frontend (badges, página de conocimiento)

### 🟡 FASE FUTURA (No implementar ahora)
- Hermes AI Agent (framework) corriendo sobre gemma4:e4b
- Function calling y orquestación agéntica
- Herramientas autónomas (search_vault, evaluate_risk, etc.)

---

## Validación del PROJECT_CONTEXT.md

| Aspecto | Lo que dice | Estado Real |
|:---|:---|:---|
| **Modelo LLM** | "Ollama" genérico | `gemma4:e4b` específicamente |
| **Chat interactivo** | No documentado | Existe `Chat.jsx` + `ChatContext.jsx` con streaming |
| **Tema visual** | No documentado | Existe `ThemeContext.jsx` |
| **Tabla `file_snapshots`** | No documentada | Existe para versionado de contenido |
| **Endpoint `/api/chat`** | No documentado | Implementado con streaming + RAG |
| **Motor RAG** | "RAG a nivel de archivo" | TF-IDF puro en memoria, sin vectores |
| **Componentes UI** | Lista incompleta | Faltan ~10 componentes |

---

## Arquitectura de Memoria RAG

### Principio fundamental
**Obsidian es la memoria visible. ChromaDB es el buscador invisible.**

- **Obsidian Vault** = Fuente única de verdad. Archivos `.md` reales que el usuario
  puede ver, editar y organizar en la GUI de Obsidian.
- **ChromaDB** = Índice de búsqueda vectorial. Invisible para el usuario. Se reconstruye
  automáticamente a partir del vault. Si se borra, se puede regenerar.

```
Obsidian = Biblioteca física (los libros reales)
ChromaDB = Catálogo digital (para encontrar cosas rápido)
```

### Flujo de memoria

```
1. ESCRITURA: A.R.I.A aprende algo → Crea archivo .md en Obsidian vault
2. INDEXACIÓN: vault_watcher detecta el archivo (~2 seg) → ChromaDB lo indexa
3. CONSULTA: Usuario pregunta algo → ChromaDB busca por similitud → retorna fragmentos
4. RESPUESTA: gemma4:e4b recibe fragmentos como contexto → genera respuesta informada
```

### Generación automática de memorias

A.R.I.A genera notas `.md` reales en el vault automáticamente:

| Evento | Nota generada en Obsidian | Carpeta |
|:---|:---|:---|
| Se resuelve un incidente | `2026-08-22 Incidente resuelto - archivo.md` | `Notas Operativas/` |
| Conversación con info valiosa | `2026-08-22 Aprendizaje - tema.md` | `Aprendizajes/` |
| Patrón de alertas detectado | `2026-08-22 Patrón - tipo.md` | `Patrones/` |
| Auditoría IA importante | `2026-08-22 Auditoría - archivo.md` | `Auditorías/` |

Cada nota incluye frontmatter YAML para metadatos buscables:
```yaml
---
tags: [incidente, finanzas, resuelto]
fecha: 2026-08-22
modulo: Finanzas
severidad: Alto
generado_por: aria
tipo: incidente_resuelto
---
```

Las notas aparecen instantáneamente en la GUI de Obsidian. El usuario puede:
- Editarlas, corregirlas o enriquecerlas
- Reorganizarlas en carpetas
- Agregar links `[[]]` a otras notas manualmente
- Borrarlas si no son relevantes (se desindexan automáticamente de ChromaDB)

---

# FASE 1: Instalación de Obsidian

## 1.1 — Instalar Obsidian vía Flatpak

```bash
# Instalar Flatpak
sudo apt install flatpak -y

# Agregar Flathub
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

# Instalar Obsidian (sandboxed)
flatpak install flathub md.obsidian.Obsidian -y

# Lanzar GUI
flatpak run md.obsidian.Obsidian
```

**¿Por qué Flatpak?**
- Sandboxed (aislado del sistema) — más seguro
- Auto-updates desde Flathub
- Sin dependencias npm (evita supply-chain attacks)
- Soporte oficial de Obsidian

## 1.2 — Crear Vault desde Cero

**Ruta**: `/home/astra/Documents/ARIA_Vault/`

```
ARIA_Vault/
├── .obsidian/                        # Config auto-generada
│
├── Base de Conocimiento/             # Conocimiento estático para RAG
│   ├── Seguridad/
│   │   ├── Políticas de acceso.md
│   │   ├── Clasificación de amenazas.md
│   │   └── Protocolos de respuesta.md
│   ├── Finanzas/
│   │   ├── Normativas contables.md
│   │   └── Horarios de operación.md
│   └── Inventarios/
│       ├── Procedimientos de reconciliación.md
│       └── Catálogo de activos.md
│
├── Reglas de Negocio/                # Reglas para evaluar alertas
│   ├── Reglas de severidad.md
│   ├── Horarios laborales.md
│   └── Extensiones sensibles.md
│
├── Notas Operativas/                 # Notas libres del equipo
│   └── Incidentes resueltos.md
│
├── _templates/                       # Plantillas de Obsidian
│   ├── Nueva nota de conocimiento.md
│   ├── Registro de incidente.md
│   └── Regla de negocio.md
│
└── Index.md                          # Mapa del vault (MOC)
```

## 1.3 — Plugins Recomendados de Obsidian

| Plugin | Propósito | Config |
|:---|:---|:---|
| **Smart Connections** | Chat RAG dentro de Obsidian | Endpoint: `http://localhost:11434`, Modelo: `gemma4:e4b` |
| **Dataview** | Consultas dinámicas sobre frontmatter | Habilitar inline queries |
| **Templater** | Plantillas automatizadas | Carpeta: `_templates/` |

---

# FASE 2: Motor RAG Vectorial

## 2.1 — Dependencias

### Python
```bash
source /home/astra/Projects/ARIA/venv/bin/activate
pip install chromadb>=0.5.0 python-frontmatter>=1.1.0 ollama>=0.4.0
```

### Modelo de Embeddings
```bash
ollama pull nomic-embed-text
```

## 2.2 — Arquitectura del RAG

```
┌──────────────────────────────────────────────────────────────────┐
│                    A.R.I.A — RAG Vectorial                       │
│                                                                  │
│  FUENTES DE DATOS                                                │
│  ┌────────────────────┐    ┌──────────────────────────────┐      │
│  │ 🟣 Obsidian Vault  │    │ 🔵 Directorio Monitoreado   │      │
│  │ /Documents/        │    │ /Projects/concilio/          │      │
│  │ ARIA_Vault/        │    │ (.docx, .pdf, .xlsx, etc)    │      │
│  └────────┬───────────┘    └──────────────┬───────────────┘      │
│           │                               │                      │
│           ▼                               ▼                      │
│  ┌─────────────────────────────────────────────────────┐         │
│  │              PIPELINE DE INDEXACIÓN                  │         │
│  │  1. Cargar archivos (frontmatter, wikilinks, tags)  │         │
│  │  2. Chunking por headers MD (600 chars, 150 overlap)│         │
│  │  3. Embeddings via nomic-embed-text (Ollama)        │         │
│  └──────────────────────┬──────────────────────────────┘         │
│                         ▼                                        │
│  ┌─────────────────────────────────────────────────────┐         │
│  │              ChromaDB (Persistido en disco)          │         │
│  │              ./aria_chroma_db/                       │         │
│  │  Colección: "aria_knowledge" (vault + monitoreado)  │         │
│  └──────────────────────┬──────────────────────────────┘         │
│                         ▼                                        │
│  ┌─────────────────────────────────────────────────────┐         │
│  │              BÚSQUEDA SEMÁNTICA                      │         │
│  │  Query → Embedding → Cosine Similarity → top_k=4   │         │
│  │  Retorna: fragmentos + metadata (fuente, tags, etc) │         │
│  └──────────────────────┬──────────────────────────────┘         │
│                         ▼                                        │
│  ┌─────────────────────────────────────────────────────┐         │
│  │              gemma4:e4b (Ollama)                     │         │
│  │  System prompt + contexto RAG + query del usuario   │         │
│  └─────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

## 2.3 — Archivo: `rag_engine_v2.py` [NUEVO]

Reemplaza completamente a `rag_engine.py` como motor RAG principal.

**Componentes:**

### ObsidianNoteParser
- Parsea archivos `.md` del vault de Obsidian
- Extrae frontmatter YAML (tags, aliases, metadata)
- Extrae wikilinks `[[target]]` y `[[target|alias]]`
- Extrae tags inline `#tag` y `#nested/tag`
- Limpia sintaxis Obsidian para embedding limpio
- Regex: wikilinks `r'\[\[([^\]\|#]+)(?:\|([^\]]+))?\]\]'`, tags `r'(?:^|\s)#([a-zA-Z0-9_\-\/]+)'`

### SmartChunker
- Chunking primario por headers de Markdown (`##`, `###`)
- Sub-chunking: 600 chars max, 150 overlap
- Metadata por chunk: `source`, `source_path`, `title`, `headers`, `tags`, `linked_notes`, `folder`

### VectorIndex
- ChromaDB persistido en `./aria_chroma_db/`
- Embeddings via `ollama.embed(model="nomic-embed-text", input=text)`
- Métodos:
  - `index_vault()` — Indexa todo el vault
  - `index_directory()` — Indexa directorio monitoreado
  - `index_single_file(filepath)` — Re-indexa un archivo (hot-reload)
  - `remove_file(filepath)` — Elimina chunks de un archivo borrado
  - `search(query, top_k=4)` — Búsqueda semántica
  - `get_stats()` — Estadísticas del índice

### Función: `retrieve_context(query, top_k=4)`
- Reemplazo directo de la función en `rag_engine.py`
- Formatea resultados con metadata de fuente:
  - `"--- FRAGMENTO 1 (🟣 Obsidian: Políticas de acceso.md | Tags: #seguridad) ---"`
  - `"--- FRAGMENTO 2 (🔵 Monitoreado: Reporte_Q3.xlsx) ---"`

### Reutilización de parsers existentes
Se importa `extract_file_content()` de `rag_engine.py` para `.docx`, `.pdf`, `.xlsx`, `.xls`.

## 2.4 — Archivo: `vault_watcher.py` [NUEVO]

Watchdog dedicado al vault de Obsidian:
- Vigila solo archivos `.md`
- Ignora `.obsidian/`, `.trash/`, `.git/`
- Debounce de 2 segundos (Obsidian guarda frecuentemente)
- `on_created/modified` → `index_single_file()`
- `on_deleted` → `remove_file()`
- Emite WebSocket `vault_updated`

## 2.5 — Modificaciones a `server.py`

### Imports nuevos
```python
from rag_engine_v2 import VectorIndex, retrieve_context
from vault_watcher import start_vault_watcher
```

### Configuración nueva
```python
VAULT_PATH = "/home/astra/Documents/ARIA_Vault/"
CHROMA_DB_PATH = "./aria_chroma_db"
```

### Startup (`@app.on_event("startup")`)
1. Inicializar `VectorIndex` (ChromaDB)
2. Indexación inicial del vault + directorio monitoreado
3. Iniciar `vault_watcher` (segundo watchdog)

### Endpoint `/api/chat` (Modificar)
- Reemplazar `get_directory_chunks()` + `retrieve_context()` del TF-IDF
- Usar nueva `retrieve_context()` vectorial de `rag_engine_v2`

### Endpoints nuevos
- `POST /api/rag/reindex` — Fuerza re-indexación completa
- `GET /api/rag/status` — Estadísticas del índice RAG

### DirectoryMonitor (Modificar)
- En `on_modified/on_created` → agregar `vector_index.index_single_file(filepath)`
- En `on_deleted` → agregar `vector_index.remove_file(filepath)`

---

# FASE 3: Frontend

## 3.1 — Modificar `Chat.jsx`
- Badges de fuente RAG en respuestas (🟣 Obsidian / 🔵 Monitoreado)
- Botón "🔄 Re-indexar Vault"
- Indicador de fuentes usadas

## 3.2 — Nueva página `Conocimiento.jsx`
- Panel de estadísticas del índice RAG
- Lista de notas indexadas del vault
- Buscador semántico standalone
- Estado de modelos (gemma4, nomic-embed-text)

## 3.3 — Modificar `Sidebar.jsx` + `App.jsx`
- Nueva entrada "📚 Base de Conocimiento" → `/conocimiento`
- Nueva ruta en App.jsx

---

# FASE 4: Testing

```bash
# Infraestructura
flatpak list | grep obsidian
ollama list  # gemma4:e4b + nomic-embed-text
python -c "import chromadb, frontmatter, ollama; print('✅ OK')"
ls -la /home/astra/Documents/ARIA_Vault/

# Indexación
python -c "
from rag_engine_v2 import VectorIndex
idx = VectorIndex()
idx.index_vault()
idx.index_directory()
print(f'Total chunks: {idx.total_count()}')
"

# Búsqueda semántica
python -c "
from rag_engine_v2 import VectorIndex
idx = VectorIndex()
results = idx.search('políticas de seguridad', top_k=3)
for r in results:
    print(f'{r[\"source\"]}: {r[\"title\"]} (score: {r[\"score\"]:.3f})')
"

# Endpoints
curl -s http://localhost:8000/api/rag/status | python -m json.tool

# Hot-reload: crear nota en Obsidian → esperar 5s → buscar contenido
```

---

# Resumen de Archivos

## Nuevos

| Archivo | Descripción |
|:---|:---|
| `rag_engine_v2.py` | Motor RAG vectorial: ChromaDB + nomic-embed-text + parser Obsidian |
| `vault_watcher.py` | Watchdog del vault con hot-reload |
| `src/pages/Conocimiento.jsx` + `.css` | Página de gestión del índice RAG |

## Modificados

| Archivo | Cambios |
|:---|:---|
| `server.py` | Integrar RAG v2, vault watcher, nuevos endpoints |
| `src/pages/Chat.jsx` | Badges de fuente RAG, botón re-indexar |
| `src/components/Sidebar.jsx` | Entrada "📚 Base de Conocimiento" |
| `src/App.jsx` | Ruta `/conocimiento` |

## Dependencias

| Tipo | Paquete |
|:---|:---|
| Python | `chromadb>=0.5.0` |
| Python | `python-frontmatter>=1.1.0` |
| Python | `ollama>=0.4.0` |
| Ollama | `nomic-embed-text` (embeddings) |
| Ollama | `gemma4:e4b` (LLM principal — actualizado) |
| Sistema | Obsidian (Flatpak) |

---

# FASE FUTURA: Hermes AI Agent

> **NO IMPLEMENTAR AHORA** — Solo documentación de referencia.

**Hermes AI Agent** es un framework de agentes autónomos de Nous Research que se instala
como herramienta independiente y puede usar CUALQUIER modelo de Ollama como backend.

**Plan futuro:**
- Instalar Hermes AI Agent (`curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`)
- Configurar para usar `gemma4:e4b` como modelo de inferencia
- Definir herramientas: `search_vault`, `search_alerts`, `evaluate_risk`, `generate_report`, `compare_versions`
- Integrar con el sistema RAG vectorial ya implementado
- Loop agéntico: Hermes planifica → ejecuta herramientas → sintetiza respuesta

---

# Progreso de Implementación

| Paso | Estado | Fecha |
|:---|:---|:---|
| ✅ Eliminar gemma4:e4b antiguo | Completado | 2026-08-22 14:49 |
| ✅ Descargar gemma4:e4b más reciente (9.6 GB) | Completado | 2026-08-22 14:51 |
| ✅ Descargar nomic-embed-text | Completado | 2026-08-22 14:52 |
| ✅ Instalar Obsidian (Flatpak) | Completado | 2026-08-22 14:56 |
| ✅ Crear vault ARIA_Vault (13 notas + 3 plantillas) | Completado | 2026-08-22 14:58 |
| ✅ Instalar deps Python (chromadb, frontmatter, ollama) | Completado | 2026-08-23 13:01 |
| ✅ Implementar rag_engine_v2.py (49 chunks, búsqueda semántica OK) | Completado | 2026-08-23 13:02 |
| ✅ Implementar vault_watcher.py | Completado | 2026-08-23 13:03 |
| ✅ Modificar server.py (RAG v2 + endpoints + vault watcher) | Completado | 2026-08-23 13:04 |
| ✅ Implementar Conocimiento.jsx + Conocimiento.css | Completado | 2026-08-23 13:06 |
| ✅ Modificar ChatContext.jsx (captura rag_sources) | Completado | 2026-08-23 18:19 |
| ✅ Modificar Sidebar.jsx (link Brain + Conocimiento) | Completado | 2026-08-23 18:19 |
| ✅ Modificar App.jsx (ruta /conocimiento) | Completado | 2026-08-23 18:19 |
| ✅ Build frontend (Vite) sin errores — 357ms | Completado | 2026-08-23 18:19 |
| ✅ Integration tests (5/5 pasaron, scores 0.86-0.91) | Completado | 2026-08-23 18:20 |
| ✅ Memorias permanentes de Identidad del Padre | Completado | 2026-08-23 18:37 |
| ✅ Triggers automáticos de generación de memoria (.md) | Completado | 2026-08-23 18:42 |
| ✅ Grafo Interactivo de Obsidian en Web (VaultGraph.jsx) | Completado | 2026-08-23 18:47 |
| ✅ Corrección de Layout Global y Autoscroll Interno de Chat | Completado | 2026-08-23 19:00 |
| ✅ Actualizar PROJECT_CONTEXT.md | Completado | 2026-08-23 19:02 |

---

### ✅ RESUMEN DE HITOS COMPLETADOS

1. **Memoria y RAG Vectorial**:
   - Vault estructurado en `/home/astra/Documents/ARIA_Vault/` con 21 notas.
   - ChromaDB persistente con modelo de embeddings `nomic-embed-text` (768 dimensiones).
   - Hot-reload reactivo con `vault_watcher.py` (vectorización automática en ~2s).

2. **Identidad del Operador**:
   - A.R.I.A reconoce al usuario como **"Padre"** (su creador y máxima autoridad).
   - Directivas en el system prompt y notas fijas en el vault (`Identidad del Operador y Trato.md`, `Directivas de Identidad.md`).

3. **Generación Automática de Memorias (.md)**:
   - **Chat**: Frases como *"Recuerda que..."* generan notas en `Aprendizajes/`.
   - **Alertas**: Al resolver una alerta se genera una nota en `Notas Operativas/`.
   - **Auditorías**: Modificaciones en archivos monitoreados generan notas en `Auditorias/`.

4. **Grafo de Memoria en la Web**:
   - Visualizador estilo Obsidian en Canvas 2D nativo (sin dependencias npm).
   - Simulación física de fuerzas, zoom/pan, dragging de nodos, filtros por categoría e inspector de notas.
   - Pestañas en `/conocimiento` para alternar entre el Grafo y las Métricas RAG.

5. **Optimización de UI/UX y Layout**:
   - Contenedor global bloqueado a `100vh overflow: hidden` evitando saltos o scrollbars externos.
   - Sidebar y contenido con scrollbars internas independientes.
   - Chat con autoscroll interno directo en `chat-messages-area` que mantiene el header superior y la barra de entrada fijos.
