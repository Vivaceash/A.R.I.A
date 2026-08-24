"""
vault_watcher.py — Watchdog dedicado al vault de Obsidian
=========================================================
Vigila cambios en el vault y re-indexa automáticamente en ChromaDB.
Separado del DirectoryMonitor de server.py (que vigila /concilio/).

Funcionalidad:
  - Detecta creación/modificación/eliminación de archivos .md
  - Ignora carpetas de sistema (.obsidian, .trash, _templates)
  - Debounce de 2 segundos (Obsidian guarda frecuentemente)
  - Re-indexa en ChromaDB via VectorIndex
  - Emite eventos WebSocket "vault_updated"
"""

import os
import time
import asyncio
import threading
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Carpetas a ignorar
IGNORE_DIRS = {".obsidian", ".trash", ".git"}

# Debounce: segundos mínimos entre re-indexaciones del mismo archivo
DEBOUNCE_SECONDS = 2.0


class VaultMonitor(FileSystemEventHandler):
    """Watchdog handler para el vault de Obsidian.

    Detecta cambios en archivos .md y re-indexa en ChromaDB.
    """

    def __init__(self, vector_index, ws_manager=None, event_loop=None):
        """
        Args:
            vector_index: Instancia de VectorIndex (rag_engine_v2)
            ws_manager: ConnectionManager de WebSocket (opcional)
            event_loop: asyncio event loop para broadcast (opcional)
        """
        super().__init__()
        self.vector_index = vector_index
        self.ws_manager = ws_manager
        self.event_loop = event_loop
        self._last_events = {}  # filepath → timestamp (para debounce)
        self._lock = threading.Lock()

    def _should_ignore(self, path: str) -> bool:
        """Verifica si un path debe ignorarse."""
        parts = Path(path).parts
        # Ignorar carpetas del sistema
        if any(d in parts for d in IGNORE_DIRS):
            return True
        # Solo procesar archivos .md
        if not path.endswith(".md"):
            return True
        # Ignorar archivos temporales de Obsidian
        basename = os.path.basename(path)
        if basename.startswith(".") or basename.startswith("~"):
            return True
        return False

    def _debounce(self, filepath: str) -> bool:
        """Retorna True si el evento debe procesarse (pasó el debounce)."""
        now = time.time()
        with self._lock:
            last = self._last_events.get(filepath, 0)
            if now - last < DEBOUNCE_SECONDS:
                return False
            self._last_events[filepath] = now
            return True

    def _broadcast(self, event_data: dict):
        """Envía evento via WebSocket si está disponible."""
        if self.ws_manager and self.event_loop:
            try:
                asyncio.run_coroutine_threadsafe(
                    self.ws_manager.broadcast(event_data),
                    self.event_loop
                )
            except Exception as e:
                print(f"[VaultWatcher] Error en broadcast: {e}")

    def on_created(self, event):
        if event.is_directory or self._should_ignore(event.src_path):
            return
        if not self._debounce(event.src_path):
            return

        filepath = event.src_path
        filename = os.path.basename(filepath)
        print(f"[VaultWatcher] Nueva nota detectada: {filename}")

        try:
            chunks = self.vector_index.index_single_file(filepath)
            self._broadcast({
                "type": "vault_updated",
                "action": "indexed",
                "file": filename,
                "chunks": chunks,
            })
        except Exception as e:
            print(f"[VaultWatcher] Error indexando {filename}: {e}")

    def on_modified(self, event):
        if event.is_directory or self._should_ignore(event.src_path):
            return
        if not self._debounce(event.src_path):
            return

        filepath = event.src_path
        filename = os.path.basename(filepath)
        print(f"[VaultWatcher] Nota modificada: {filename}")

        try:
            chunks = self.vector_index.index_single_file(filepath)
            self._broadcast({
                "type": "vault_updated",
                "action": "reindexed",
                "file": filename,
                "chunks": chunks,
            })
        except Exception as e:
            print(f"[VaultWatcher] Error re-indexando {filename}: {e}")

    def on_deleted(self, event):
        if event.is_directory or self._should_ignore(event.src_path):
            return

        filepath = event.src_path
        filename = os.path.basename(filepath)
        print(f"[VaultWatcher] Nota eliminada: {filename}")

        try:
            self.vector_index.remove_file(filepath)
            self._broadcast({
                "type": "vault_updated",
                "action": "removed",
                "file": filename,
            })
        except Exception as e:
            print(f"[VaultWatcher] Error eliminando {filename}: {e}")

    def on_moved(self, event):
        if event.is_directory:
            return

        src = event.src_path
        dest = event.dest_path

        # Eliminar del origen si era .md
        if not self._should_ignore(src):
            print(f"[VaultWatcher] Nota movida desde: {os.path.basename(src)}")
            try:
                self.vector_index.remove_file(src)
            except Exception as e:
                print(f"[VaultWatcher] Error eliminando origen: {e}")

        # Indexar en destino si es .md
        if not self._should_ignore(dest):
            if not self._debounce(dest):
                return
            print(f"[VaultWatcher] Nota movida a: {os.path.basename(dest)}")
            try:
                chunks = self.vector_index.index_single_file(dest)
                self._broadcast({
                    "type": "vault_updated",
                    "action": "moved",
                    "file": os.path.basename(dest),
                    "chunks": chunks,
                })
            except Exception as e:
                print(f"[VaultWatcher] Error indexando destino: {e}")


def start_vault_watcher(vault_path: str, vector_index, ws_manager=None, event_loop=None) -> Observer:
    """Inicia el watchdog del vault de Obsidian.

    Args:
        vault_path: Ruta al vault de Obsidian
        vector_index: Instancia de VectorIndex
        ws_manager: ConnectionManager de WebSocket (opcional)
        event_loop: asyncio event loop (opcional)

    Returns:
        Observer instance (para poder detenerlo si es necesario)
    """
    if not os.path.exists(vault_path):
        print(f"[VaultWatcher] ⚠️ Vault no encontrado: {vault_path}")
        print(f"[VaultWatcher] Creando directorio...")
        os.makedirs(vault_path, exist_ok=True)

    handler = VaultMonitor(
        vector_index=vector_index,
        ws_manager=ws_manager,
        event_loop=event_loop,
    )

    observer = Observer()
    observer.schedule(handler, vault_path, recursive=True)
    observer.daemon = True
    observer.start()

    print(f"[VaultWatcher] ✅ Vigilando vault: {vault_path}")
    return observer
