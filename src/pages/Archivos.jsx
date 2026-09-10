import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  FileCode,
  FolderArchive,
  Terminal,
  X,
  Download,
  FolderOpen,
  Search,
  ArrowUp,
  ArrowDown,
  Grid,
  List as ListIcon,
  Folder,
  Archive,
  MoreVertical,
  UploadCloud,
  Plus,
  ChevronDown,
  Filter,
  Users,
  MessageSquare,
  Star,
  Music,
  Share2,
  Trash2,
  Check,
  RotateCw
} from 'lucide-react';
import Header from '../components/Header';
import FileViewerPanel from '../components/FileViewerPanel';
import PdfIcon from '../components/PdfIcon';
import DocIcon from '../components/DocIcon';
import XlsIcon from '../components/XlsIcon';
import './Archivos.css';

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileExtension = (filename) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
};

const getFileCategoryColor = (filename) => {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  switch (ext) {
    case 'pdf':
      return '#EF4444'; // Bright Red for PDF
    case 'doc':
    case 'docx':
      return '#3B82F6'; // Blue
    case 'xls':
    case 'xlsx':
    case 'csv':
      return '#10B981'; // Green
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'svg':
    case 'gif':
      return '#F59E0B'; // Amber
    case 'py':
    case 'js':
    case 'jsx':
    case 'html':
    case 'css':
    case 'json':
      return '#8B5CF6'; // Purple
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz':
      return '#EC4899'; // Pink
    case 'txt':
    case 'md':
      return '#64748B'; // Slate
    case 'flac':
    case 'mp3':
    case 'wav':
      return '#06B6D4'; // Cyan
    default:
      return '#6B7280';
  }
};

const getMinimalFileIcon = (filename, size = 22) => {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  switch (ext) {
    case 'pdf':
      return <PdfIcon size={size} color="#EF4444" />;
    case 'doc':
    case 'docx':
      return <DocIcon size={size} color="#3B82F6" label={ext.toUpperCase()} />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <XlsIcon size={size} color="#10B981" label={ext.toUpperCase()} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'svg':
    case 'gif':
      return <ImageIcon size={size} style={{ color: '#F59E0B' }} />;
    case 'py':
    case 'js':
    case 'jsx':
    case 'html':
    case 'css':
    case 'json':
      return <FileCode size={size} style={{ color: '#8B5CF6' }} />;
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
      return <FolderArchive size={size} style={{ color: '#EC4899' }} />;
    case 'sh':
    case 'bash':
      return <Terminal size={size} style={{ color: '#14B8A6' }} />;
    case 'flac':
    case 'mp3':
    case 'wav':
      return <Music size={size} style={{ color: '#06B6D4' }} />;
    case 'txt':
    case 'md':
      return <FileText size={size} style={{ color: '#94A3B8' }} />;
    default:
      return <File size={size} style={{ color: '#9CA3AF' }} />;
  }
};

export default function Archivos() {
  const [files, setFiles] = useState([]);
  const [modulesList, setModulesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('mtime'); // 'mtime' | 'name' | 'type' | 'size'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [selectedExtensions, setSelectedExtensions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState(null);
  const [activeMenuFile, setActiveMenuFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Favorites state persisted in localStorage
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('aria_favorite_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fileInputRef = useRef(null);
  const { module } = useParams();

  const fetchModules = async () => {
    try {
      const response = await fetch('/api/modules');
      if (response.ok) {
        const data = await response.json();
        setModulesList(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching modules:', e);
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await fetch(`/api/files?module=${module || 'general'}`);
      if (!response.ok) throw new Error('Error al obtener archivos');
      const data = await response.json();
      setFiles(data);

      // Auto-select first file or keep selected file if available
      if (data.length > 0) {
        setSelectedFile(prev => {
          if (!prev) return data[0];
          const found = data.find(f => f.name === prev.name);
          return found || data[0];
        });
      }
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchModules();
  }, [module]);

  // Listen to WebSocket events for real-time file additions/deletions
  useEffect(() => {
    let ws = null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (['modified', 'deleted', 'created'].includes(message.type)) {
            fetchFiles();
            fetchModules();
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      if (ws) {
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN) ws.close();
      }
    };
  }, []);

  const toggleFavorite = (filename) => {
    setFavorites(prev => {
      const next = prev.includes(filename) ? prev.filter(f => f !== filename) : [...prev, filename];
      try {
        localStorage.setItem('aria_favorite_files', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Compute ONLY real folder cards that actually exist on disk!
  const folderCards = useMemo(() => {
    const realFolderNames = new Set(modulesList);
    files.forEach(f => {
      if (f.folder && f.folder !== '.' && f.folder !== 'Documentos' && f.folder !== 'Raíz') {
        realFolderNames.add(f.folder);
      }
    });

    const list = Array.from(realFolderNames).sort();
    return list.map(folderName => {
      const realCount = files.filter(f => f.folder?.toLowerCase() === folderName.toLowerCase()).length;
      return {
        name: folderName,
        icon: Folder,
        count: realCount,
        color: '#F59E0B'
      };
    });
  }, [modulesList, files]);

  // Available extensions for filtering
  const availableExtensions = useMemo(() => {
    const exts = new Set();
    files.forEach(f => {
      const parts = f.name.split('.');
      if (parts.length > 1) {
        exts.add(parts.pop().toLowerCase());
      }
    });
    return Array.from(exts).sort();
  }, [files]);

  // Processed and filtered files
  const processedFiles = useMemo(() => {
    let result = files.filter(f => {
      const matchesSearch =
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.owner && f.owner.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Filter by folder if not 'all'
      if (selectedFolder !== 'all') {
        const folderName = f.folder || '';
        if (folderName.toLowerCase() !== selectedFolder.toLowerCase()) {
          return false;
        }
      }

      // Filter by selected extensions
      if (selectedExtensions.length > 0) {
        const ext = f.name.split('.').pop().toLowerCase();
        if (!selectedExtensions.includes(ext)) return false;
      }

      return true;
    });

    return result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortBy === 'size') {
        valA = a.size || 0;
        valB = b.size || 0;
      } else if (sortBy === 'mtime') {
        valA = new Date(a.mtime || 0).getTime();
        valB = new Date(b.mtime || 0).getTime();
      } else if (sortBy === 'type') {
        const extA = a.name.split('.').pop().toLowerCase();
        const extB = b.name.split('.').pop().toLowerCase();
        valA = extA;
        valB = extB;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [files, searchTerm, selectedFolder, selectedExtensions, sortBy, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const toggleExtension = (ext) => {
    setSelectedExtensions(prev =>
      prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
    );
  };

  const handleDownload = (filename) => {
    const link = document.createElement('a');
    link.href = `/api/download/${encodeURIComponent(filename)}`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const handleDeleteFile = async (filename) => {
    if (!window.confirm(`¿Estás seguro de eliminar el archivo "${filename}"?`)) return;
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Error al eliminar archivo');
      setUploadToast({ type: 'success', message: `Archivo "${filename}" eliminado.` });
      fetchFiles();
      if (selectedFile?.name === filename) {
        setSelectedFile(null);
      }
    } catch (err) {
      setUploadToast({ type: 'error', message: `No se pudo eliminar: ${err.message}` });
    }
  };

  const handleOpenFolder = async () => {
    try {
      await fetch('/api/open-folder', { method: 'POST' });
    } catch (error) {
      console.error('Error opening folder:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let lastError = null;

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const formData = new FormData();
      formData.append('file', file);
      if (module) formData.append('module', module);
      if (selectedFolder && selectedFolder !== 'all') {
        formData.append('folder', selectedFolder);
      }

      try {
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        });
        if (response.ok) {
          successCount++;
        } else {
          const errData = await response.json().catch(() => ({}));
          lastError = errData.detail || 'Error al procesar archivo';
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (successCount > 0) {
      setUploadToast({
        type: 'success',
        message: `${successCount} archivo(s) subido(s) exitosamente.`
      });
      fetchFiles();
      fetchModules();
    } else {
      setUploadToast({
        type: 'error',
        message: lastError || 'Error al subir archivo.'
      });
    }

    setTimeout(() => setUploadToast(null), 4000);
  };

  // Drag & Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let lastError = null;

    for (let i = 0; i < droppedFiles.length; i++) {
      const file = droppedFiles[i];
      const formData = new FormData();
      formData.append('file', file);
      if (module) formData.append('module', module);
      if (selectedFolder && selectedFolder !== 'all') {
        formData.append('folder', selectedFolder);
      }

      try {
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        });
        if (response.ok) {
          successCount++;
        } else {
          const errData = await response.json().catch(() => ({}));
          lastError = errData.detail || 'Error al procesar archivo';
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    setUploading(false);
    if (successCount > 0) {
      setUploadToast({
        type: 'success',
        message: `${successCount} archivo(s) subido(s) con éxito.`
      });
      fetchFiles();
      fetchModules();
    } else {
      setUploadToast({
        type: 'error',
        message: lastError || 'No se pudo subir el archivo.'
      });
    }

    setTimeout(() => setUploadToast(null), 4000);
  };

  return (
    <div className="archivos-page-wrapper">
      <Header
        title={module ? `Archivos de ${module.charAt(0).toUpperCase() + module.slice(1)}` : 'Gestión de Archivos'}
        showTimeframe={false}
      />

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        multiple
      />

      {/* Toast Notification */}
      {uploadToast && (
        <div className={`archivos-toast ${uploadToast.type} fade-in`}>
          <span>{uploadToast.message}</span>
          <button onClick={() => setUploadToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="archivos-top-bar">
        <div className="archivos-top-actions" style={{ marginLeft: 'auto' }}>
          <button
            className="btn-upload-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <RotateCw size={16} className="spin-icon" /> : <Plus size={16} />}
            <span>{uploading ? 'Subiendo...' : 'Subir Archivo'}</span>
            <ChevronDown size={14} className="upload-chevron" />
          </button>
        </div>
      </div>

      <div className="archivos-container">
          {/* Toolbar & Filters Bar */}
          <div className="archivos-toolbar">
            {/* Search Bar */}
            <div className="archivos-search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar por nombre o propietario..."
                className="archivos-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="archivos-toolbar-right">
              {/* Filters Button */}
              <button
                className={`toolbar-btn filter-toggle-btn ${showFiltersModal || selectedExtensions.length > 0 ? 'active' : ''}`}
                onClick={() => setShowFiltersModal(!showFiltersModal)}
                title="Filtros avanzados"
              >
                <Filter size={16} />
                <span>Filtros</span>
                {selectedExtensions.length > 0 && (
                  <span className="filters-count-badge">{selectedExtensions.length}</span>
                )}
              </button>

              {/* View Mode Toggle */}
              <div className="view-mode-switch">
                <button
                  className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Vista de Cuadrícula"
                >
                  <Grid size={17} />
                </button>
                <button
                  className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Vista de Lista"
                >
                  <ListIcon size={17} />
                </button>
              </div>

              {/* Sort Selector */}
              <div className="sort-box">
                <span className="sort-label">Ordenar por:</span>
                <select
                  className="sort-dropdown"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="mtime">Fecha</option>
                  <option value="name">Nombre</option>
                  <option value="type">Tipo de archivo</option>
                  <option value="size">Tamaño</option>
                </select>
                <button
                  className="sort-direction-btn"
                  onClick={toggleSortOrder}
                  title={`Orden ${sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}`}
                >
                  {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Filter Drawer Popup */}
          {showFiltersModal && (
            <div className="filters-drawer fade-in">
              <div className="filters-drawer-header">
                <span>Filtrar por extensión de archivo</span>
                {selectedExtensions.length > 0 && (
                  <button className="reset-filters-btn" onClick={() => setSelectedExtensions([])}>
                    Limpiar filtros
                  </button>
                )}
              </div>
              <div className="filter-chips-grid">
                {availableExtensions.map((ext) => (
                  <button
                    key={ext}
                    className={`filter-chip ${selectedExtensions.includes(ext) ? 'active' : ''}`}
                    onClick={() => toggleExtension(ext)}
                  >
                    <span>.{ext}</span>
                    {selectedExtensions.includes(ext) && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Carpetas (ONLY real folders that exist) */}
          {folderCards.length > 0 && (
            <div className="archivos-section">
              <div className="section-header">
                <h2 className="section-title">Carpetas</h2>
                {selectedFolder !== 'all' && (
                  <button className="clear-folder-filter" onClick={() => setSelectedFolder('all')}>
                    Ver todas ({files.length} archivos)
                  </button>
                )}
              </div>

              <div className="folders-grid">
                {folderCards.map((folder, idx) => {
                  const isSelected = selectedFolder.toLowerCase() === folder.name.toLowerCase();
                  return (
                    <div
                      key={idx}
                      className={`folder-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedFolder(isSelected ? 'all' : folder.name)}
                    >
                      <div className="folder-card-main">
                        <div className="folder-icon-wrapper" style={{ color: folder.color }}>
                          <Folder size={26} fill={folder.color} fillOpacity={0.9} />
                        </div>
                        <div className="folder-info">
                          <h4 className="folder-name">{folder.name}</h4>
                          <span className="folder-count">{folder.count} archivos</span>
                        </div>
                      </div>
                      <button
                        className="folder-menu-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFolder();
                        }}
                        title="Abrir en explorador"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

            {/* Section 2: Archivos (Files) */}
            <div className="archivos-section files-section">
              <div className="section-header">
                <h2 className="section-title">Archivos</h2>
                <span className="files-count-badge-total">
                  {processedFiles.length} {processedFiles.length === 1 ? 'archivo' : 'archivos'}
                </span>
              </div>

              <div className="archivos-files-layout">
                <div className="archivos-files-main">
                  {loading ? (
                <div className="loading-state-card">
                  <RotateCw size={24} className="spin-icon" />
                  <p>Cargando archivos del sistema...</p>
                </div>
              ) : processedFiles.length === 0 ? (
                <div className="empty-files-card">
                  <FileText size={36} className="empty-icon" />
                  <p>No se encontraron archivos que coincidan con los filtros seleccionados.</p>
                  {(searchTerm || selectedExtensions.length > 0 || selectedFolder !== 'all') && (
                    <button
                      className="btn-reset-search"
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedExtensions([]);
                        setSelectedFolder('all');
                      }}
                    >
                      Restablecer filtros
                    </button>
                  )}
                </div>
              ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="files-grid-container">
                  {processedFiles.map((file, idx) => {
                    const isSelected = selectedFile?.name === file.name;
                    const isFav = favorites.includes(file.name);
                    const categoryColor = getFileCategoryColor(file.name);
                    const fileExt = getFileExtension(file.name);
                    const formattedDate = file.mtime
                      ? new Date(file.mtime).toLocaleString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '28 ago 2026, 9:45 PM';

                    const usersCount = (idx % 4) + 1;
                    const commentsCount = idx % 3;

                    return (
                      <div
                        key={file.name || idx}
                        className={`file-item-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedFile(file)}
                        style={{ '--card-accent': categoryColor }}
                      >
                        {/* Top: Minimalist Colored Icon + 3 dots */}
                        <div className="file-card-top">
                          <div
                            className="file-icon-box"
                            style={{
                              backgroundColor: `${categoryColor}22`,
                              borderColor: `${categoryColor}40`,
                              color: categoryColor
                            }}
                          >
                            {getMinimalFileIcon(file.name, 22)}
                          </div>

                          <div className="file-card-menu-wrapper">
                            <button
                              className="file-card-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuFile(activeMenuFile === file.name ? null : file.name);
                              }}
                              title="Acciones"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeMenuFile === file.name && (
                              <div
                                className="file-context-menu fade-in"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => {
                                    handleDownload(file.name);
                                    setActiveMenuFile(null);
                                  }}
                                >
                                  <Download size={14} />
                                  <span>Descargar</span>
                                </button>
                                <button
                                  onClick={() => {
                                    toggleFavorite(file.name);
                                    setActiveMenuFile(null);
                                  }}
                                >
                                  <Star size={14} />
                                  <span>{isFav ? 'Quitar favorito' : 'Marcar favorito'}</span>
                                </button>
                                <button
                                  className="danger"
                                  onClick={() => {
                                    handleDeleteFile(file.name);
                                    setActiveMenuFile(null);
                                  }}
                                >
                                  <Trash2 size={14} />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* File Name */}
                        <h4 className="file-card-title" title={file.name}>
                          {file.name}
                        </h4>

                        {/* Format & Size Badge */}
                        <div className="file-card-badge-row">
                          <span
                            className="file-card-ext-pill"
                            style={{
                              color: categoryColor,
                              backgroundColor: `${categoryColor}18`,
                              borderColor: `${categoryColor}35`
                            }}
                          >
                            {fileExt}
                          </span>
                          <span className="file-card-size-label">{formatSize(file.size)}</span>
                        </div>

                        {/* Owner & Date */}
                        <div className="file-card-meta">
                          <span className="file-card-owner">{file.owner || 'Astra'}</span>
                          <span className="file-card-date">{formattedDate}</span>
                        </div>

                        {/* Footer: Users, Comments, Star */}
                        <div className="file-card-footer">
                          <div className="file-card-stats">
                            <span className="stat-item" title="Usuarios con acceso">
                              <Users size={13} />
                              <span>{usersCount}</span>
                            </span>
                            <span className="stat-item" title="Comentarios y notas">
                              <MessageSquare size={13} />
                              <span>{commentsCount}</span>
                            </span>
                          </div>

                          <button
                            className={`file-card-star-btn ${isFav ? 'is-fav' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(file.name);
                            }}
                            title={isFav ? 'Quitar de favoritos' : 'Favorito'}
                          >
                            <Star
                              size={15}
                              fill={isFav ? '#F59E0B' : 'none'}
                              color={isFav ? '#F59E0B' : 'currentColor'}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Drag & Drop Upload Card */}
                  <div
                    className={`dropzone-card ${isDragOver ? 'drag-over' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    title="Haz clic o arrastra archivos aquí para subir"
                  >
                    <div className="dropzone-icon-box">
                      <UploadCloud size={30} />
                    </div>
                    <h4 className="dropzone-title">Arrastra archivos aquí</h4>
                    <p className="dropzone-subtitle">o selecciona desde tu dispositivo</p>
                  </div>
                </div>
              ) : (
                /* List View */
                <div className="files-list-container">
                  <table className="files-list-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Propietario</th>
                        <th>Carpeta</th>
                        <th>Tamaño</th>
                        <th>Última modificación</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedFiles.map((file, idx) => {
                        const isSelected = selectedFile?.name === file.name;
                        const isFav = favorites.includes(file.name);
                        const categoryColor = getFileCategoryColor(file.name);
                        const fileExt = getFileExtension(file.name);
                        const formattedDate = file.mtime
                          ? new Date(file.mtime).toLocaleString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '28 ago 2026, 9:45 PM';

                        return (
                          <tr
                            key={file.name || idx}
                            className={`files-list-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedFile(file)}
                          >
                            <td className="list-name-cell">
                              <div
                                className="list-icon-badge"
                                style={{
                                  backgroundColor: `${categoryColor}20`,
                                  borderColor: `${categoryColor}40`,
                                  color: categoryColor
                                }}
                              >
                                {getMinimalFileIcon(file.name, 18)}
                              </div>
                              <div className="list-name-wrapper">
                                <span className="list-file-name" title={file.name}>
                                  {file.name}
                                </span>
                                <span
                                  className="list-ext-pill"
                                  style={{
                                    color: categoryColor,
                                    borderColor: `${categoryColor}35`,
                                    backgroundColor: `${categoryColor}15`
                                  }}
                                >
                                  {fileExt}
                                </span>
                              </div>
                            </td>
                            <td>{file.owner || 'Astra'}</td>
                            <td>{file.folder || 'Documentos'}</td>
                            <td>{formatSize(file.size)}</td>
                            <td>{formattedDate}</td>
                            <td className="list-actions-cell">
                              <button
                                className={`list-star-btn ${isFav ? 'is-fav' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(file.name);
                                }}
                              >
                                <Star
                                  size={16}
                                  fill={isFav ? '#F59E0B' : 'none'}
                                  color={isFav ? '#F59E0B' : 'currentColor'}
                                />
                              </button>
                              <button
                                className="list-action-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(file.name);
                                }}
                                title="Descargar"
                              >
                                <Download size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Side Panel: File Details & PDF/Word/Document Viewer */}
            <div className="archivos-side-column">
              <FileViewerPanel
                file={selectedFile}
                onClose={() => setSelectedFile(null)}
                onDownload={handleDownload}
                onDelete={handleDeleteFile}
                isFavorite={selectedFile ? favorites.includes(selectedFile.name) : false}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
