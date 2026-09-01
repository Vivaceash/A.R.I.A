"""
rag_engine_v2.py — Motor RAG Vectorial para A.R.I.A
====================================================
Reemplaza el motor TF-IDF (rag_engine.py) por búsqueda semántica
usando ChromaDB + nomic-embed-text via Ollama.

Fuentes de datos:
  - Obsidian Vault (/home/astra/Documents/ARIA_Vault/)
  - Directorio Monitoreado (/home/astra/Projects/concilio/)

Arquitectura:
  Obsidian = fuente única de verdad (archivos .md visibles)
  ChromaDB = índice de búsqueda vectorial (invisible, regenerable)
"""

import os
import re
import time
import hashlib
from pathlib import Path
from datetime import datetime

import frontmatter
import chromadb
import ollama

# Reutilizar los parsers de documentos existentes
from rag_engine import extract_file_content

# === CONFIGURACIÓN ===
VAULT_PATH = "c:/Users/Casillas/Documents/ARIA/ARIA_Vault/"
CHROMA_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aria_chroma_db")
EMBEDDING_MODEL = "nomic-embed-text"
CHUNK_SIZE = 600
CHUNK_OVERLAP = 150

# Extensiones que se parsean del vault
VAULT_EXTENSIONS = {".md"}

# Extensiones del directorio monitoreado (reutiliza extract_file_content)
MONITORED_EXTENSIONS = {
    ".txt", ".py", ".json", ".csv", ".md", ".log", ".js", ".css", ".html",
    ".docx", ".pdf", ".xlsx", ".xls"
}

# Carpetas a ignorar dentro del vault
VAULT_IGNORE_DIRS = {".obsidian", ".trash", ".git", "_templates"}

# Archivos temporales a ignorar
TEMP_PATTERNS = {"~", ".tmp", ".swp", "#"}


# === PARSER DE NOTAS OBSIDIAN ===

class ObsidianNoteParser:
    """Parsea archivos .md del vault de Obsidian extrayendo
    frontmatter, wikilinks, tags y contenido limpio."""

    # Regex para elementos de Obsidian
    RE_WIKILINK = re.compile(r'\[\[([^\]\|#]+)(?:#[^\]\|]*)?(?:\|([^\]]+))?\]\]')
    RE_EMBED = re.compile(r'\!\[\[([^\]]+)\]\]')
    RE_INLINE_TAG = re.compile(r'(?:^|\s)#([a-zA-Z0-9_\-\/]+)', re.MULTILINE)
    RE_DATAVIEW = re.compile(r'\[([a-zA-Z0-9_\-]+)::\s*([^\]]+)\]')
    RE_CALLOUT = re.compile(r'>\s*\[!(\w+)\]')

    @staticmethod
    def parse(filepath: str) -> dict:
        """Parsea una nota de Obsidian y retorna metadata + contenido limpio.

        Returns:
            dict con keys: title, content, clean_content, tags, linked_notes,
                          embeds, metadata, folder, source_path
        """
        path = Path(filepath)
        try:
            post = frontmatter.load(filepath)
            raw_content = post.content
            fm_metadata = dict(post.metadata) if post.metadata else {}
        except Exception:
            # Si falla el frontmatter, leer como texto plano
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                raw_content = f.read()
            fm_metadata = {}

        # Extraer tags del frontmatter
        fm_tags = fm_metadata.get("tags", [])
        if isinstance(fm_tags, str):
            fm_tags = [t.strip() for t in fm_tags.split(",")]

        # Extraer tags inline del contenido
        inline_tags = ObsidianNoteParser.RE_INLINE_TAG.findall(raw_content)

        # Combinar tags (sin duplicados)
        all_tags = list(set(fm_tags + inline_tags))

        # Extraer wikilinks
        wikilinks = ObsidianNoteParser.RE_WIKILINK.findall(raw_content)
        linked_notes = list(set(target.strip() for target, _ in wikilinks))

        # Extraer embeds/transclusiones
        embeds = ObsidianNoteParser.RE_EMBED.findall(raw_content)

        # Limpiar contenido para embedding
        clean = raw_content
        # Reemplazar [[target|alias]] con alias
        clean = re.sub(r'\[\[([^\]\|]+)\|([^\]]+)\]\]', r'\2', clean)
        # Reemplazar [[target]] con target
        clean = re.sub(r'\[\[([^\]]+)\]\]', r'\1', clean)
        # Remover embeds
        clean = re.sub(r'\!\[\[([^\]]+)\]\]', '', clean)
        # Remover callouts syntax (mantener contenido)
        clean = re.sub(r'>\s*\[!\w+\]\s*', '', clean)
        # Limpiar espacios múltiples
        clean = re.sub(r'\n{3,}', '\n\n', clean).strip()

        # Determinar carpeta relativa en el vault
        try:
            vault_path = Path(VAULT_PATH)
            folder = str(path.parent.relative_to(vault_path))
            if folder == ".":
                folder = "raíz"
        except ValueError:
            folder = "externo"

        return {
            "title": path.stem,
            "content": raw_content,
            "clean_content": clean,
            "tags": all_tags,
            "linked_notes": linked_notes,
            "embeds": embeds,
            "metadata": fm_metadata,
            "folder": folder,
            "source_path": str(path),
        }


# === CHUNKING INTELIGENTE ===

class SmartChunker:
    """Chunking consciente de la estructura Markdown.
    Divide por headers primero, luego por tamaño."""

    RE_HEADER = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)

    @staticmethod
    def chunk_markdown(text: str, max_chars: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
        """Divide texto markdown en chunks respetando headers.

        Retorna lista de dicts con: text, headers (breadcrumb)
        """
        # Encontrar posiciones de headers
        headers = list(SmartChunker.RE_HEADER.finditer(text))

        if not headers:
            # Sin headers: usar chunking simple
            return SmartChunker._simple_chunk(text, max_chars, overlap)

        sections = []
        current_headers = {}

        for i, match in enumerate(headers):
            level = len(match.group(1))  # Número de #
            title = match.group(2).strip()
            start = match.end()
            end = headers[i + 1].start() if i + 1 < len(headers) else len(text)

            # Actualizar breadcrumb de headers
            current_headers[level] = title
            # Limpiar headers de nivel inferior
            for l in list(current_headers.keys()):
                if l > level:
                    del current_headers[l]

            section_text = text[start:end].strip()
            if not section_text:
                continue

            # Breadcrumb: "H1 > H2 > H3"
            breadcrumb = " > ".join(
                current_headers[l] for l in sorted(current_headers.keys())
            )

            # Si la sección es pequeña, un solo chunk
            if len(section_text) <= max_chars:
                sections.append({
                    "text": section_text,
                    "headers": breadcrumb,
                })
            else:
                # Sub-dividir sección larga
                sub_chunks = SmartChunker._simple_chunk(section_text, max_chars, overlap)
                for sc in sub_chunks:
                    sc["headers"] = breadcrumb
                    sections.append(sc)

        # Capturar texto antes del primer header
        if headers and headers[0].start() > 0:
            pre_text = text[:headers[0].start()].strip()
            if pre_text:
                pre_chunks = SmartChunker._simple_chunk(pre_text, max_chars, overlap)
                for pc in pre_chunks:
                    pc["headers"] = ""
                sections = pre_chunks + sections

        return sections

    @staticmethod
    def _simple_chunk(text: str, max_chars: int, overlap: int) -> list[dict]:
        """Chunking simple por tamaño con overlap."""
        text = re.sub(r'\s+', ' ', text).strip()
        chunks = []
        if not text:
            return chunks
        if len(text) <= max_chars:
            return [{"text": text, "headers": ""}]

        start = 0
        while start < len(text):
            end = min(start + max_chars, len(text))
            if end < len(text):
                # Buscar punto de corte limpio
                split_idx = text.rfind('.', start + max_chars // 2, end)
                if split_idx == -1:
                    split_idx = text.rfind(' ', start + max_chars // 2, end)
                if split_idx != -1:
                    end = split_idx + 1
            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append({"text": chunk_text, "headers": ""})
            start = end - overlap
            if start >= len(text) - overlap:
                break
        return chunks


# === ÍNDICE VECTORIAL ===

class VectorIndex:
    """Índice vectorial usando ChromaDB con embeddings de Ollama.

    Gestiona una colección unificada 'aria_knowledge' que contiene
    chunks tanto del vault de Obsidian como del directorio monitoreado.
    """

    COLLECTION_NAME = "aria_knowledge"

    def __init__(self, persist_dir: str = CHROMA_DB_PATH):
        """Inicializa ChromaDB con persistencia en disco."""
        self.persist_dir = persist_dir
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )
        self._file_hashes: dict[str, str] = {}
        self._stats = {
            "vault_docs": 0,
            "vault_chunks": 0,
            "monitored_docs": 0,
            "monitored_chunks": 0,
            "last_indexed": None,
        }
        print(f"[RAG v2] ChromaDB inicializado en {persist_dir}")
        print(f"[RAG v2] Colección '{self.COLLECTION_NAME}': {self.collection.count()} chunks existentes")

    def _get_file_hash(self, filepath: str) -> str:
        """Calcula el hash SHA-256 del archivo para indexación diferencial."""
        try:
            with open(filepath, "rb") as f:
                return hashlib.sha256(f.read()).hexdigest()
        except Exception:
            return ""

    def _generate_id(self, source_path: str, chunk_idx: int) -> str:
        """Genera un ID único y determinista para cada chunk."""
        raw = f"{source_path}::chunk_{chunk_idx}"
        return hashlib.md5(raw.encode()).hexdigest()

    def _embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Genera embeddings usando Ollama nomic-embed-text.

        Procesa en lotes para evitar timeouts.
        """
        embeddings = []
        batch_size = 32
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            try:
                response = ollama.embed(model=EMBEDDING_MODEL, input=batch)
                embeddings.extend(response.embeddings)
            except Exception as e:
                print(f"[RAG v2] Error generando embeddings (lote {i}): {e}")
                # Fallback: vectores vacíos para este lote
                embeddings.extend([[0.0] * 768] * len(batch))
        return embeddings

    def _remove_by_source(self, source_path: str):
        """Elimina todos los chunks de un archivo específico."""
        try:
            # Buscar IDs existentes de este archivo
            results = self.collection.get(
                where={"source_path": source_path}
            )
            if results and results["ids"]:
                self.collection.delete(ids=results["ids"])
                print(f"[RAG v2] Eliminados {len(results['ids'])} chunks de {source_path}")
        except Exception as e:
            print(f"[RAG v2] Error eliminando chunks de {source_path}: {e}")

    def index_vault(self, vault_path: str = VAULT_PATH) -> int:
        """Indexa todas las notas .md del vault de Obsidian de forma diferencial.

        Returns:
            Número de chunks indexados.
        """
        vault = Path(vault_path)
        if not vault.exists():
            print(f"[RAG v2] Vault no encontrado: {vault_path}")
            return 0

        total_chunks = 0
        doc_count = 0

        for md_file in vault.rglob("*.md"):
            # Ignorar carpetas del sistema de Obsidian
            if any(ignore in md_file.parts for ignore in VAULT_IGNORE_DIRS):
                continue

            filepath_str = str(md_file)
            file_hash = self._get_file_hash(filepath_str)

            # Optimización diferencial: saltar si el hash no ha cambiado
            if self._file_hashes.get(filepath_str) == file_hash and self.collection.count() > 0:
                doc_count += 1
                continue

            try:
                note = ObsidianNoteParser.parse(filepath_str)
                if not note["clean_content"].strip():
                    continue

                # Chunking inteligente por headers
                chunks = SmartChunker.chunk_markdown(note["clean_content"])
                if not chunks:
                    continue

                # Limpiar chunks previos si era una actualización
                self._remove_by_source(filepath_str)

                # Preparar datos para ChromaDB
                ids = []
                documents = []
                metadatas = []
                mtime_str = datetime.fromtimestamp(os.path.getmtime(filepath_str)).isoformat() if os.path.exists(filepath_str) else ""

                for idx, chunk in enumerate(chunks):
                    chunk_id = self._generate_id(filepath_str, idx)

                    # Prepend: contexto para mejorar la calidad del embedding
                    context_prefix = f"[Nota: {note['title']}]"
                    if note["folder"] != "raíz":
                        context_prefix += f" [Carpeta: {note['folder']}]"
                    if note["tags"]:
                        context_prefix += f" [Tags: {', '.join(note['tags'][:5])}]"
                    if chunk["headers"]:
                        context_prefix += f" [Sección: {chunk['headers']}]"

                    full_text = f"{context_prefix}\n{chunk['text']}"

                    ids.append(chunk_id)
                    documents.append(full_text)
                    metadatas.append({
                        "source": "obsidian",
                        "source_path": filepath_str,
                        "title": note["title"],
                        "folder": note["folder"],
                        "tags": ", ".join(note["tags"][:10]),
                        "linked_notes": ", ".join(note["linked_notes"][:10]),
                        "headers": chunk["headers"],
                        "chunk_index": idx,
                        "doc_type": "vault_note",
                        "last_modified": mtime_str,
                    })

                # Generar embeddings
                embeddings = self._embed_texts(documents)

                # Upsert en ChromaDB (actualiza si ya existe)
                self.collection.upsert(
                    ids=ids,
                    documents=documents,
                    embeddings=embeddings,
                    metadatas=metadatas,
                )

                self._file_hashes[filepath_str] = file_hash
                total_chunks += len(chunks)
                doc_count += 1

            except Exception as e:
                print(f"[RAG v2] Error indexando {md_file}: {e}")

        self._stats["vault_docs"] = doc_count
        self._stats["vault_chunks"] = total_chunks
        self._stats["last_indexed"] = datetime.now().isoformat()
        print(f"[RAG v2] Vault indexado: {doc_count} documentos, {total_chunks} chunks")
        return total_chunks

    def index_directory(self, directory_path: str) -> int:
        """Indexa archivos del directorio monitoreado de forma diferencial.

        Returns:
            Número de chunks indexados.
        """
        if not os.path.exists(directory_path):
            print(f"[RAG v2] Directorio no encontrado: {directory_path}")
            return 0

        total_chunks = 0
        doc_count = 0

        for root, dirs, files in os.walk(directory_path):
            # Ignorar carpetas ocultas
            dirs[:] = [d for d in dirs if not d.startswith('.')]

            for filename in files:
                # Ignorar archivos temporales
                if any(filename.endswith(p) or filename.startswith(p) for p in TEMP_PATTERNS):
                    continue
                if filename.startswith('.'):
                    continue

                filepath = os.path.join(root, filename)
                _, ext = os.path.splitext(filename.lower())

                if ext not in MONITORED_EXTENSIONS:
                    continue

                file_hash = self._get_file_hash(filepath)
                if self._file_hashes.get(filepath) == file_hash and self.collection.count() > 0:
                    doc_count += 1
                    continue

                try:
                    content = extract_file_content(filepath)
                    if not content or not content.strip():
                        continue

                    # Determinar subcarpeta relativa como "módulo"
                    try:
                        rel_path = os.path.relpath(filepath, directory_path)
                        module = rel_path.split(os.sep)[0] if os.sep in rel_path else "general"
                    except ValueError:
                        module = "general"

                    chunks = SmartChunker.chunk_markdown(content)
                    if not chunks:
                        continue

                    # Limpiar chunks previos si era una actualización
                    self._remove_by_source(filepath)

                    ids = []
                    documents = []
                    metadatas = []
                    mtime_str = datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat() if os.path.exists(filepath) else ""

                    for idx, chunk in enumerate(chunks):
                        chunk_id = self._generate_id(filepath, idx)

                        context_prefix = f"[Archivo: {filename}] [Módulo: {module}]"
                        if chunk["headers"]:
                            context_prefix += f" [Sección: {chunk['headers']}]"

                        full_text = f"{context_prefix}\n{chunk['text']}"

                        ids.append(chunk_id)
                        documents.append(full_text)
                        metadatas.append({
                            "source": "monitoreado",
                            "source_path": filepath,
                            "title": filename,
                            "folder": module,
                            "tags": "",
                            "linked_notes": "",
                            "headers": chunk["headers"],
                            "chunk_index": idx,
                            "doc_type": "monitored_file",
                            "last_modified": mtime_str,
                        })

                    embeddings = self._embed_texts(documents)

                    self.collection.upsert(
                        ids=ids,
                        documents=documents,
                        embeddings=embeddings,
                        metadatas=metadatas,
                    )

                    self._file_hashes[filepath] = file_hash
                    total_chunks += len(chunks)
                    doc_count += 1

                except Exception as e:
                    print(f"[RAG v2] Error indexando {filepath}: {e}")

        self._stats["monitored_docs"] = doc_count
        self._stats["monitored_chunks"] = total_chunks
        self._stats["last_indexed"] = datetime.now().isoformat()
        print(f"[RAG v2] Directorio indexado: {doc_count} documentos, {total_chunks} chunks")
        return total_chunks

    def index_single_file(self, filepath: str) -> int:
        """Re-indexa un solo archivo (para hot-reload).

        Elimina chunks anteriores del archivo y los recrea.
        Returns:
            Número de chunks indexados.
        """
        # Primero eliminar chunks existentes de este archivo
        self._remove_by_source(filepath)

        _, ext = os.path.splitext(filepath.lower())
        mtime_str = datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat() if os.path.exists(filepath) else ""

        # Determinar si es del vault o del directorio monitoreado
        if filepath.startswith(VAULT_PATH) and ext in VAULT_EXTENSIONS:
            # Es una nota de Obsidian
            try:
                note = ObsidianNoteParser.parse(filepath)
                if not note["clean_content"].strip():
                    return 0

                chunks = SmartChunker.chunk_markdown(note["clean_content"])
                if not chunks:
                    return 0

                ids = []
                documents = []
                metadatas = []

                for idx, chunk in enumerate(chunks):
                    chunk_id = self._generate_id(filepath, idx)
                    context_prefix = f"[Nota: {note['title']}]"
                    if note["folder"] != "raíz":
                        context_prefix += f" [Carpeta: {note['folder']}]"
                    if note["tags"]:
                        context_prefix += f" [Tags: {', '.join(note['tags'][:5])}]"
                    if chunk["headers"]:
                        context_prefix += f" [Sección: {chunk['headers']}]"

                    full_text = f"{context_prefix}\n{chunk['text']}"

                    ids.append(chunk_id)
                    documents.append(full_text)
                    metadatas.append({
                        "source": "obsidian",
                        "source_path": filepath,
                        "title": note["title"],
                        "folder": note["folder"],
                        "tags": ", ".join(note["tags"][:10]),
                        "linked_notes": ", ".join(note["linked_notes"][:10]),
                        "headers": chunk["headers"],
                        "chunk_index": idx,
                        "doc_type": "vault_note",
                        "last_modified": mtime_str,
                    })

                embeddings = self._embed_texts(documents)
                self.collection.upsert(
                    ids=ids, documents=documents,
                    embeddings=embeddings, metadatas=metadatas,
                )
                self._file_hashes[filepath] = self._get_file_hash(filepath)
                print(f"[RAG v2] Re-indexado (vault): {filepath} → {len(chunks)} chunks")
                return len(chunks)

            except Exception as e:
                print(f"[RAG v2] Error re-indexando {filepath}: {e}")
                return 0
        else:
            # Es un archivo del directorio monitoreado
            try:
                content = extract_file_content(filepath)
                if not content or not content.strip():
                    return 0

                filename = os.path.basename(filepath)
                chunks = SmartChunker.chunk_markdown(content)
                if not chunks:
                    return 0

                ids = []
                documents = []
                metadatas = []

                for idx, chunk in enumerate(chunks):
                    chunk_id = self._generate_id(filepath, idx)
                    context_prefix = f"[Archivo: {filename}]"
                    if chunk["headers"]:
                        context_prefix += f" [Sección: {chunk['headers']}]"
                    full_text = f"{context_prefix}\n{chunk['text']}"

                    ids.append(chunk_id)
                    documents.append(full_text)
                    metadatas.append({
                        "source": "monitoreado",
                        "source_path": filepath,
                        "title": filename,
                        "folder": "",
                        "tags": "",
                        "linked_notes": "",
                        "headers": chunk["headers"],
                        "chunk_index": idx,
                        "doc_type": "monitored_file",
                        "last_modified": mtime_str,
                    })

                embeddings = self._embed_texts(documents)
                self.collection.upsert(
                    ids=ids, documents=documents,
                    embeddings=embeddings, metadatas=metadatas,
                )
                self._file_hashes[filepath] = self._get_file_hash(filepath)
                print(f"[RAG v2] Re-indexado (monitoreado): {filepath} → {len(chunks)} chunks")
                return len(chunks)

            except Exception as e:
                print(f"[RAG v2] Error re-indexando {filepath}: {e}")
                return 0

    def remove_file(self, filepath: str):
        """Elimina todos los chunks de un archivo (cuando se borra)."""
        self._file_hashes.pop(filepath, None)
        self._remove_by_source(filepath)

    def search(self, query: str, top_k: int = 4, min_similarity: float = 0.65) -> list[dict]:
        """Búsqueda semántica por cosine similarity con filtrado calibrado.

        Args:
            query: Texto de búsqueda en lenguaje natural.
            top_k: Número de resultados a retornar.
            min_similarity: Umbral mínimo de similitud coseno para descartar ruido.

        Returns:
            Lista de dicts con: text, source, title, folder, tags, headers, score, source_path
        """
        if self.collection.count() == 0:
            return []

        try:
            # Generar embedding de la query
            query_embedding = self._embed_texts([query])[0]

            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k * 2, self.collection.count()),
                include=["documents", "metadatas", "distances"]
            )

            search_results = []
            if results and results["documents"] and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                    distance = results["distances"][0][i] if results["distances"] else 1.0
                    # ChromaDB cosine distance: 0 = idéntico, 2 = opuesto
                    # Convertir a score de similitud: 1 = idéntico, 0 = opuesto
                    similarity = 1 - (distance / 2)

                    # Filtrar resultados irrelevantes para evitar alucinaciones
                    if similarity < min_similarity and len(search_results) > 0:
                        continue

                    search_results.append({
                        "text": doc,
                        "source": metadata.get("source", "desconocido"),
                        "title": metadata.get("title", ""),
                        "folder": metadata.get("folder", ""),
                        "tags": metadata.get("tags", ""),
                        "headers": metadata.get("headers", ""),
                        "linked_notes": metadata.get("linked_notes", ""),
                        "doc_type": metadata.get("doc_type", "general"),
                        "last_modified": metadata.get("last_modified", ""),
                        "score": round(similarity, 4),
                        "source_path": metadata.get("source_path", ""),
                    })

                    if len(search_results) >= top_k:
                        break

            return search_results

        except Exception as e:
            print(f"[RAG v2] Error en búsqueda: {e}")
            return []

    def get_stats(self) -> dict:
        """Retorna estadísticas del índice."""
        total = self.collection.count()

        # Contar por fuente
        try:
            vault_results = self.collection.get(where={"source": "obsidian"})
            vault_count = len(vault_results["ids"]) if vault_results else 0
        except Exception:
            vault_count = 0

        monitored_count = total - vault_count

        # Tamaño en disco
        try:
            db_size = sum(
                f.stat().st_size for f in Path(self.persist_dir).rglob("*") if f.is_file()
            ) / (1024 * 1024)  # MB
        except Exception:
            db_size = 0

        return {
            "total_chunks": total,
            "vault_chunks": vault_count,
            "monitored_chunks": monitored_count,
            "last_indexed": self._stats.get("last_indexed"),
            "embedding_model": EMBEDDING_MODEL,
            "chroma_db_size_mb": round(db_size, 2),
        }

    def total_count(self) -> int:
        """Retorna el total de chunks indexados."""
        return self.collection.count()


# === FUNCIÓN DE CONTEXTO (compatibilidad con server.py) ===

# Instancia global del índice (inicializada en server.py)
_global_index: VectorIndex | None = None


def init_index(persist_dir: str = CHROMA_DB_PATH) -> VectorIndex:
    """Inicializa y retorna la instancia global del índice."""
    global _global_index
    _global_index = VectorIndex(persist_dir=persist_dir)
    return _global_index


def get_index() -> VectorIndex:
    """Retorna la instancia global del índice (la inicializa si es necesario)."""
    global _global_index
    if _global_index is None:
        _global_index = init_index()
    return _global_index


def retrieve_context(query: str, top_k: int = 4) -> str:
    """Búsqueda semántica y formateo de contexto.

    Reemplazo directo de rag_engine.retrieve_context().
    Compatible con el formato esperado por server.py.
    """
    idx = get_index()
    results = idx.search(query, top_k=top_k)

    if not results:
        return "No se encontraron fragmentos relevantes en la base de conocimiento."

    context_parts = []
    sources_info = []

    for idx_num, r in enumerate(results):
        # Ícono de fuente
        if r["source"] == "obsidian":
            source_label = f"🟣 Obsidian: {r['title']}"
            if r["tags"]:
                source_label += f" | Tags: {r['tags']}"
        else:
            source_label = f"🔵 Monitoreado: {r['title']}"
            if r["folder"]:
                source_label += f" | Módulo: {r['folder']}"

        context_parts.append(
            f"--- FRAGMENTO {idx_num + 1} ({source_label}) [Similitud: {r['score']:.0%}] ---\n{r['text']}"
        )

        sources_info.append({
            "type": r["source"],
            "file": r["title"],
            "tags": r["tags"].split(", ") if r["tags"] else [],
            "score": r["score"],
        })

    return "\n\n".join(context_parts)


def retrieve_context_with_sources(query: str, top_k: int = 4) -> tuple[str, list[dict]]:
    """Búsqueda semántica que retorna contexto + metadata de fuentes.

    Usado por el frontend para mostrar badges de fuente.
    """
    idx = get_index()
    results = idx.search(query, top_k=top_k)

    if not results:
        return "No se encontraron fragmentos relevantes en la base de conocimiento.", []

    context_parts = []
    sources = []

    for idx, r in enumerate(results):
        if r["source"] == "obsidian":
            source_label = f"🟣 Obsidian: {r['title']}"
            if r["tags"]:
                source_label += f" | Tags: {r['tags']}"
        else:
            source_label = f"🔵 Monitoreado: {r['title']}"

        context_parts.append(
            f"--- FRAGMENTO {idx + 1} ({source_label}) ---\n{r['text']}"
        )

        sources.append({
            "type": r["source"],
            "file": r["title"],
            "tags": r["tags"].split(", ") if r["tags"] else [],
            "folder": r["folder"],
            "score": r["score"],
        })

    return "\n\n".join(context_parts), sources


# === GENERADOR DE MEMORIAS AGÉNTICAS ===

class MemoryWriter:
    """Escribe y consolida memorias automáticas como archivos .md en el vault de Obsidian
    siguiendo la taxonomía agéntica (agentic-memory-systems)."""

    def __init__(self, vault_path: str = VAULT_PATH):
        self.vault_path = Path(vault_path)

    def _sanitize_filename(self, name: str) -> str:
        """Limpia caracteres inválidos para nombres de archivo."""
        name = re.sub(r'[<>:"/\\|?*]', '', name)
        return name[:100].strip()

    def _generate_memory_id(self) -> str:
        date_str = datetime.now().strftime("%Y-%m-%d")
        rand_suffix = hashlib.md5(f"{time.time()}_{os.getpid()}".encode()).hexdigest()[:4].upper()
        return f"MEM-{date_str}-{rand_suffix}"

    def write_memory(
        self,
        title: str,
        content: str,
        folder: str,
        tags: list[str],
        metadata: dict | None = None,
        memory_type: str = "learning",
        module: str = "general",
        related_notes: list[str] | None = None,
    ) -> str | None:
        """Escribe una nota de memoria estructurada en el vault."""
        date_iso = datetime.now().isoformat()
        date_str = datetime.now().strftime("%Y-%m-%d")
        safe_title = self._sanitize_filename(title)
        filename = f"{date_str} {safe_title}.md"

        target_dir = self.vault_path / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        filepath = target_dir / filename

        # Formatear wikilinks relacionados
        wikilinks = [f"[[{r.strip('[] ')}]]" if not r.startswith("[[") else r for r in (related_notes or [])]

        # Construir frontmatter estandarizado según la skill agentic-memory-systems
        fm_data = {
            "id": (metadata and metadata.get("id")) or self._generate_memory_id(),
            "type": memory_type,
            "module": module.lower(),
            "created_at": date_iso,
            "tags": tags,
            "related_notes": wikilinks,
        }
        if metadata:
            for k, v in metadata.items():
                if k not in fm_data:
                    fm_data[k] = v

        post = frontmatter.Post(content, **fm_data)

        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(frontmatter.dumps(post))
            print(f"[RAG v2] Memoria agéntica escrita: {filepath}")
            return str(filepath)
        except Exception as e:
            print(f"[RAG v2] Error escribiendo memoria: {e}")
            return None

    def write_learning(self, topic: str, content: str,
                       tags: list[str] | None = None,
                       module: str = "general") -> str | None:
        """Escribe o consolida un aprendizaje en el vault aplicando deduplicación semántica."""
        idx = get_index()
        # Verificar deduplicación semántica en ChromaDB
        if idx and idx.total_count() > 0:
            try:
                results = idx.search(f"{topic} {content}", top_k=2, min_similarity=0.85)
                for r in results:
                    src_path = r.get("source_path", "")
                    if src_path and os.path.exists(src_path) and "Aprendizajes" in src_path:
                        # Consolidar nota existente anexando actualización
                        try:
                            post = frontmatter.load(src_path)
                            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            update_block = f"\n\n### Actualización [{now_str}]\n- **Directiva consolidada:** {content}\n"
                            post.content += update_block
                            if tags:
                                current_tags = post.metadata.get("tags", [])
                                if isinstance(current_tags, list):
                                    post.metadata["tags"] = list(set(current_tags + tags))
                            with open(src_path, "w", encoding="utf-8") as f:
                                f.write(frontmatter.dumps(post))
                            print(f"[RAG v2] Memoria consolidada en nota existente: {src_path}")
                            idx.index_single_file(src_path)
                            return src_path
                        except Exception as upd_err:
                            print(f"[RAG v2] Error al actualizar nota existente {src_path}: {upd_err}")
            except Exception as e:
                print(f"[RAG v2] Error en comprobación de deduplicación: {e}")

        # Si no existe nota previa similar, generar nueva nota estructurada
        body = f"""# Aprendizaje: {topic}

## Contexto / Antecedentes
Instrucción aprendida a través de la interacción directa con el operador en el sistema A.R.I.A.

## Detalle Técnico
{content}

## Acciones Derivadas / Directivas
- Retener esta regla para futuras consultas semánticas y toma de decisiones operativas.

## Referencias
- [[Arquitectura General]]
- [[Políticas de Seguridad]]
"""
        return self.write_memory(
            title=topic,
            content=body,
            folder="Aprendizajes",
            tags=tags or ["aprendizaje", "memoria-dinamica"],
            memory_type="learning",
            module=module,
            related_notes=["Arquitectura General", "Políticas de Seguridad"]
        )

    def write_incident(self, filename: str, module: str, severity: str,
                       description: str, ai_analysis: str = "") -> str | None:
        """Escribe una memoria de incidente resuelto con wikilinks a políticas."""
        body = f"""# Incidente de Seguridad: {filename}

## Contexto / Antecedentes
Alerta operativa resuelta en el módulo `{module}` con nivel de severidad **{severity}**.

## Detalle Técnico
- **Archivo Afectado**: `{filename}`
- **Módulo**: `{module}`
- **Severidad**: `{severity}`
- **Descripción del Evento**: {description}

## Acciones Derivadas / Directivas
- **Análisis y Resolución A.R.I.A**:
{ai_analysis if ai_analysis else 'Incidente resuelto y archivado en base operativa.'}

## Referencias
- [[Políticas de Seguridad]]
- [[Módulo {module.capitalize()}]]
"""
        return self.write_memory(
            title=f"Incidente - {filename}",
            content=body,
            folder="Notas Operativas",
            tags=["incidente", module.lower(), severity.lower()],
            metadata={"modulo": module, "severidad": severity, "archivo": filename},
            memory_type="incident",
            module=module,
            related_notes=["Políticas de Seguridad", f"Módulo {module.capitalize()}"]
        )

    def write_pattern(self, pattern_name: str, description: str,
                      module: str = "", occurrences: int = 0) -> str | None:
        """Escribe una memoria de patrón detectado."""
        body = f"""# Patrón Detectado: {pattern_name}

## Contexto / Antecedentes
Detección de comportamiento recurrente en el módulo `{module or 'General'}` con **{occurrences}** ocurrencias.

## Detalle Técnico
{description}

## Acciones Derivadas / Directivas
- Monitorizar desviaciones en este vector de actividad.

## Referencias
- [[Políticas de Seguridad]]
- [[Arquitectura General]]
"""
        return self.write_memory(
            title=f"Patrón - {pattern_name}",
            content=body,
            folder="Patrones",
            tags=["patron", module.lower()] if module else ["patron"],
            metadata={"modulo": module, "ocurrencias": occurrences},
            memory_type="pattern",
            module=module or "general",
            related_notes=["Políticas de Seguridad", "Arquitectura General"]
        )

    def write_audit(self, filename: str, module: str,
                    analysis: str) -> str | None:
        """Escribe una memoria de auditoría IA."""
        body = f"""# Auditoría de Archivo: {filename}

## Contexto / Antecedentes
Inspección automatizada de integridad y cumplimiento en `{filename}` (`{module}`).

## Detalle Técnico
{analysis}

## Acciones Derivadas / Directivas
- Mantener registro de conformidad en la base de conocimiento.

## Referencias
- [[Políticas de Seguridad]]
- [[Módulo {module.capitalize()}]]
"""
        return self.write_memory(
            title=f"Auditoría - {filename}",
            content=body,
            folder="Auditorias",
            tags=["auditoria", module.lower()],
            metadata={"modulo": module, "archivo": filename},
            memory_type="audit",
            module=module,
            related_notes=["Políticas de Seguridad", f"Módulo {module.capitalize()}"]
        )
