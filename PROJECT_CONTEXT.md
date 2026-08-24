# A.R.I.A (Asistente Reactivo de Inteligencia Artificial) - Project Context

Este documento sirve como el mapa maestro del proyecto A.R.I.A. Describe el estado actual del proyecto, la arquitectura, el stack tecnológico, las vulnerabilidades detectadas, los módulos implementados y el roadmap detallado para futuras interacciones o equipos de desarrollo.

---

## 1. Visión del Proyecto
A.R.I.A es un sistema integral de monitoreo, auditoría y seguridad de archivos, impulsado por Inteligencia Artificial Local (Ollama). El objetivo principal es observar directorios sensibles en tiempo real, clasificar eventos, emitir alertas y proveer un Dashboard Ejecutivo e individualizado por departamentos (Módulos) para tomar decisiones informadas sobre la integridad de la información.

## 2. Estado Actual (A dónde hemos llegado)
- **Monitoreo en Tiempo Real**: Implementado exitosamente mediante la librería `watchdog` de Python. A.R.I.A detecta creaciones, modificaciones y eliminaciones (incluso movimientos a la papelera) en las carpetas.
- **Sistema de Módulos (Departamentos)**: El frontend y backend soportan navegación dinámica por departamentos (`Finanzas`, `Ciberseguridad`, `Inventarios`). Cada módulo carga *solo* sus datos de forma aislada, o se puede ver un "Dashboard General" que engloba a todos.
- **Base de Datos Persistente**: Migrado a SQLite3 (`aria.db`). Todas las alertas e historial sobreviven a reinicios. El sistema reconstruye retrospectivamente la base de datos leyendo los archivos existentes al arrancar (`seed_initial_history`).
- **UI/UX Moderna**: Interfaz en React construida desde cero con un diseño oscuro, profesional y toques de colores brillantes (no neón) usando la paleta base (`--accent-primary` en tonos azules, `--accent-danger` rojos vívidos, etc.).
- **Tiempo Real en UI**: Conexión WebSocket (`/api/ws`) operativa. Las gráficas y tablas se actualizan instantáneamente sin recargar la página.
- **Chat con IA Local y Reconocimiento de Identidad**: Chat interactivo con streaming NDJSON usando `gemma4:e4b` via Ollama. A.R.I.A reconoce al operador como su **Padre** (su creador y máxima autoridad) a través de directivas de identidad y memorias fijas en el vault.
- **RAG Vectorial (v2)**: Sistema de búsqueda semántica usando ChromaDB + nomic-embed-text (vectores 768-dim, cosine similarity). Reemplaza el motor TF-IDF anterior. Fuentes: Obsidian Vault + directorio monitoreado.
- **Obsidian como Memoria y Fuente de Verdad**: Vault en `/home/astra/Documents/ARIA_Vault/` con 21 notas de conocimiento + 3 plantillas. Obsidian instalado via Flatpak.
- **Vault Watcher (Hot-Reload)**: Watchdog dedicado al vault de Obsidian con debounce de 2s. Re-indexa automáticamente en ChromaDB cuando se crea, modifica o elimina una nota en Obsidian.
- **Generación Dinámica de Memorias (.md)**: A.R.I.A escribe memorias automáticas como archivos Markdown reales en el vault:
  * *Aprendizajes:* Generados por instrucción directa en el chat ("Recuerda que...", "Aprende esto: ...").
  * *Notas Operativas:* Generadas al resolver incidentes y alertas desde la interfaz.
  * *Auditorías:* Generadas automáticamente cuando la IA compara versiones modificadas de archivos en el directorio monitoreado.
- **Grafo de Memoria Interactivo en la Web**: Componente `VaultGraph.jsx` en Canvas 2D nativo (sin dependencias externas). Provee simulación de fuerzas físicas, zoom/pan, dragging de nodos, filtros de carpetas, búsqueda en vivo e inspector lateral con vista previa de Markdown.
- **Layout Contenido y Autoscroll de Chat**: Contenedor global `100vh overflow: hidden` con scrollbar interno independiente en el sidebar y en el área de mensajes de chat (`scrollTop = scrollHeight`), garantizando que el header superior y la barra de entrada de texto permanezcan fijos sin desbordes de página.

## 3. Arquitectura y Stack Tecnológico

### Backend (Python)
- **Motor**: FastAPI (Alto rendimiento, Async/Await).
- **Servidor Web**: Uvicorn.
- **Base de Datos**: SQLite3 (Integrada localmente, archivo `aria.db`).
- **Monitoreo de Sistema**: `watchdog` (DirectoryMonitor recursivo + VaultMonitor para Obsidian).
- **WebSockets**: `fastapi.WebSocket` con un `ConnectionManager` para broadcast asíncrono.
- **Directorio de Monitoreo Base**: `/home/astra/Projects/concilio/`.
- **LLM Local**: Ollama con modelo `gemma4:e4b` (9.6 GB).
- **Embeddings**: Ollama con modelo `nomic-embed-text` (274 MB, vectores 768-dim).
- **RAG Vectorial**: ChromaDB (PersistentClient, cosine similarity, almacenamiento en `aria_chroma_db/`).
- **Obsidian Vault**: `/home/astra/Documents/ARIA_Vault/` — fuente única de verdad para conocimiento.

### Frontend (JavaScript / React)
- **Framework**: React 19 + Vite 8.
- **Enrutamiento**: `react-router-dom` v7 (Rutas dinámicas `/modulo/:module/...`).
- **Gráficas**: `recharts` (PieCharts, AreaCharts dinámicos basados en eventos o extensiones físicas).
- **Iconos**: `lucide-react`.
- **Estilos**: Vanilla CSS puro, variables CSS (Tokens) en `index.css` centralizados. Sin Tailwind para mayor personalización nativa.
- **Comunicación**: Fetch API estándar + WebSockets nativos de navegador (`ws://localhost...`).

### Inteligencia Artificial
- **Motor Local**: Ollama con `gemma4:e4b` (procesamiento, análisis, chat streaming).
- **Embeddings**: `nomic-embed-text` via Ollama (768-dim, búsqueda semántica).
- **RAG**: ChromaDB vectorial con chunking inteligente por headers Markdown.
- **Memoria Automática**: MemoryWriter genera notas .md en Obsidian vault (incidentes, aprendizajes, patrones, auditorías).

---

## 4. Estructura del Código Base

### Backend
- `server.py`: Corazón del backend. FastAPI, SQLite, Watchdog, WebSockets, endpoints REST, chat streaming con RAG v2.
- `rag_engine.py`: Motor RAG v1 (TF-IDF en memoria). Parsers de documentos reutilizados por v2. **Mantenido por compatibilidad de parsers.**
- `rag_engine_v2.py`: Motor RAG v2 vectorial. ChromaDB + nomic-embed-text. Incluye: ObsidianNoteParser, SmartChunker, VectorIndex, MemoryWriter.
- `vault_watcher.py`: Watchdog del vault de Obsidian. Detecta cambios en .md, re-indexa en ChromaDB, emite eventos WebSocket.
- `aria.db`: SQLite con tablas `alert_history` y `file_snapshots`.
- `aria_chroma_db/`: Directorio de persistencia de ChromaDB (regenerable).

### Frontend
- `src/App.jsx`: Router con ThemeProvider, ChatProvider, WebSocket, Toast notifications.
- `src/components/Sidebar.jsx`: Navegación lateral con secciones: Visión General, Módulos, Sistema. Incluye link a Base de Conocimiento.
- `src/components/VaultGraph.jsx`: **[NUEVO]** Visualizador interactivo del Grafo de Memoria (estilo Obsidian) en Canvas 2D con simulación de fuerzas físicas, zoom/pan, dragging, filtros y previsualización de notas.
- `src/components/VaultGraph.css`: Estilos glassmorphism para el grafo interactivo.
- `src/contexts/ChatContext.jsx`: Estado global del chat. Streaming NDJSON, captura de rag_sources, localStorage.
- `src/contexts/ThemeContext.jsx`: Tema claro/oscuro.
- `src/pages/Dashboard.jsx`: Panel principal (General o por Módulo).
- `src/pages/Alertas.jsx`: Centro de alertas con resolución y generación automática de notas de incidentes.
- `src/pages/Archivos.jsx`: Explorador de archivos del directorio monitoreado.
- `src/pages/Comparaciones.jsx`: Comparaciones de versiones de archivos y auditorías IA.
- `src/pages/Reportes.jsx`: Reportes y estadísticas.
- `src/pages/Chat.jsx`: Chat interactivo con A.R.I.A con reconocimiento de memoria y aprendizaje dinámico.
- `src/pages/Conocimiento.jsx`: Panel de Base de Conocimiento con pestañas para el Grafo de Obsidian y Métricas RAG.
- `src/pages/Conocimiento.css`: Estilos del panel de Conocimiento.

### Endpoints API
- `GET /api/stats` — Estadísticas del sistema
- `GET /api/files` — Lista de archivos monitoreados
- `GET /api/reports` — Reportes de alertas
- `GET /api/comparisons` — Historial de comparaciones
- `GET /api/modules` — Lista de módulos (departamentos)
- `POST /api/chat` — Chat con streaming NDJSON + RAG vectorial + auto-aprendizaje
- `POST /api/rag/reindex` — Re-indexación completa del vault + directorio
- `GET /api/rag/status` — Estadísticas del índice RAG
- `GET /api/vault/graph` — **[NUEVO]** Nodos y enlaces para el grafo interactivo de Obsidian
- `GET /api/vault/note` — **[NUEVO]** Contenido completo de una nota del vault para inspección
- `PATCH /api/alertas/{alert_id}/resolve` — Resolver alertas (genera memoria de incidente)
- `GET /api/download/{filename}` — Descarga de archivos
- `POST /api/open-folder` — Abrir carpeta en explorador
- `WS /api/ws` — WebSocket para alertas en tiempo real y hot-reload del vault

---

## 5. Vulnerabilidades y Bugs Identificados (A Solucionar Inmediatamente)

1. **Path Traversal (Seguridad Crítica)**
   * **Problema:** En `server.py`, endpoints como `get_files_data` hacen `os.path.join(DIRECTORY, module)`. Un atacante/usuario malintencionado podría inyectar un parámetro como `?module=../../../etc` en la API y hacer que el backend escanee y exponga rutas del sistema operativo fuera del directorio de proyecto.
   * **Solución Esperada:** Sanitizar la variable `module` asegurando que no contenga `/`, `\`, ni `..`, y validando que el `os.path.abspath` resultante comience forzosamente con el `DIRECTORY` base.

2. **Bloqueo del Event Loop por escaneo síncrono (Rendimiento)**
   * **Problema:** Cada vez que el frontend pide las estadísticas, la función `get_files_data()` hace un `os.walk(target_dir)` síncrono. En volúmenes de miles de archivos, esta operación bloqueará FastAPI, deteniendo los WebSockets y la entrega de alertas en tiempo real.
   * **Solución Esperada:** Mantener una Caché en memoria en el backend (o en SQLite) de los archivos actuales, e irla actualizando de forma reactiva con el propio `Watchdog`, en lugar de hacer `os.walk` en cada petición HTTP.

3. **Bloqueo de Base de Datos SQLite (Rendimiento)**
   * **Problema:** SQLite no permite escrituras concurrentes masivas en modo tradicional. Cuando `Watchdog` en un hilo intenta insertar una alerta, y FastAPI intenta leer/escribir en otro hilo, puede surgir un error `Database is locked`.
   * **Solución Esperada:** Habilitar el modo WAL (`PRAGMA journal_mode=WAL;`) al iniciar la conexión en `init_db()`.

4. **Falta de Autenticación / Roles (Seguridad)**
   * **Problema:** A.R.I.A no tiene control de acceso. Cualquier usuario que cargue el frontend puede ver todos los archivos de Finanzas y borrar/resolver alertas de Ciberseguridad.
   * **Solución Esperada:** Integrar un sistema de autenticación básica o JWT (JSON Web Tokens) en FastAPI y un `AuthContext` en React.

---

## 6. Siguientes Pasos (Roadmap de Implementación de Negocio)

Una vez solucionadas las vulnerabilidades (Sección 5), la arquitectura que **vamos a tener en un futuro** debe incorporar las siguientes características lógicas:

### Fase 1: Arquitectura Transversal de "Ciberseguridad"
- El módulo de Ciberseguridad no debe estar limitado solo a los archivos de su propia carpeta (`/Ciberseguridad`).
- **Meta:** Ciberseguridad actuará como el "Panóptico". La API debe modificarse para que, cuando el `module == 'ciberseguridad'`, pueda leer las alertas de todos los demás módulos (Finanzas, Inventarios) y pasarlas por un flujo de auditoría antivirus simulado o de IA (Ollama), alertando si detecta anomalías sistémicas.

### Fase 2: Lógicas Especializadas por Departamento
- **Finanzas:** Implementar reglas de negocio estrictas. Por ejemplo, en el Backend: "Si un evento ocurre en un archivo `.xls` o `.xlsx` fuera del horario laboral estándar (ej. de 22:00 a 06:00), catalogarlo directamente como Riesgo Alto".
- **Inventarios:** Lógica de reconciliación. Crear cruces de datos para verificar que las modificaciones tengan justificación de metadatos.

### Fase 3: Automatización de Reportes
- Implementar la funcionalidad de generación de PDF o CSV en la pestaña "Reportes", de tal forma que los resúmenes del Dashboard puedan ser descargados de forma estructurada según el módulo activo.

### Fase 4: Despliegue en Producción
- Mover de SQLite a PostgreSQL si el volumen de eventos supera los límites razonables de concurrencia.
- Aislar el Frontend (construcción de estáticos `npm run build`) para servirlos directamente a través de NGINX o el propio FastAPI, en lugar del servidor de desarrollo de Vite.

---

## Resumen para Futuros Asistentes (Prompts Base)
Si eres una nueva sesión de chat o IA trabajando sobre este proyecto, **asegúrate de seguir este orden**:
1. No modifiques la UI ni colores; ya están estandarizados a un tono oscuro, profesional y brillante (sin neones).
2. Resuelve siempre primero las vulnerabilidades (Path Traversal y Caché de disco) antes de implementar lógicas complejas de Ciberseguridad.
3. Asegúrate de que todos los endpoints en `server.py` soporten el paso de parámetros y de que las respuestas HTTP sigan siendo asíncronas para no romper el WebSocket.
