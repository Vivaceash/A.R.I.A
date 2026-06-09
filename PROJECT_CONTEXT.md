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

## 3. Arquitectura y Stack Tecnológico

### Backend (Python)
- **Motor**: FastAPI (Alto rendimiento, Async/Await).
- **Servidor Web**: Uvicorn.
- **Base de Datos**: SQLite3 (Integrada localmente, archivo `aria.db`).
- **Monitoreo de Sistema**: `watchdog` (DirectoryMonitor recursivo en el directorio raíz objetivo).
- **WebSockets**: `fastapi.WebSocket` con un `ConnectionManager` para broadcast asíncrono.
- **Directorio de Monitoreo Base**: Actualmente seteado en `/home/astra/Projects/concilio/`.

### Frontend (JavaScript / React)
- **Framework**: React 18 + Vite.
- **Enrutamiento**: `react-router-dom` (Rutas dinámicas `/modulo/:module/...`).
- **Gráficas**: `recharts` (PieCharts, AreaCharts dinámicos basados en eventos o extensiones físicas).
- **Estilos**: Vanilla CSS puro, variables CSS (Tokens) en `index.css` centralizados. Sin Tailwind para mayor personalización nativa.
- **Comunicación**: Fetch API estándar + WebSockets nativos de navegador (`ws://localhost...`).

### Inteligencia Artificial
- **Motor Local**: Ollama (Procesamiento y análisis de alertas, generación de RAG a nivel de archivo).

---

## 4. Estructura del Código Base

- `server.py`: El corazón del backend. Contiene la conexión a SQLite, las lógicas del Watchdog (`on_modified`, `on_created`, `on_deleted`, `on_moved`), la inserción en base de datos (`log_event`), los Endpoints de FastAPI (`/api/stats`, `/api/files`) y el gestor de WebSockets.
- `src/App.jsx`: Gestor de Rutas de React. Redirige el tráfico a los módulos.
- `src/components/Sidebar.jsx`: Menú lateral que lee recursivamente subdirectorios dentro del directorio monitoreado y los presenta como "Módulos" navegables. Colapsa el módulo activo si se hace doble clic, enviando al usuario al Dashboard General.
- `src/pages/Dashboard.jsx`: El panel principal (General o por Módulo). Incluye gráficas (Archivos y Extensiones) y conecta con el WebSocket.
- `src/pages/Alertas.jsx`, `Archivos.jsx`, `Comparaciones.jsx`, `Reportes.jsx`: Vistas detalladas. Filtran la información por el módulo actual (`useEffect(..., [module])`).
- `aria.db`: Archivo SQLite autogenerado con la tabla `alert_history`.

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
