import { useState, useEffect, useMemo } from 'react';
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
  Share2,
  Link as LinkIcon,
  MoreHorizontal,
  Star,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Calendar,
  User,
  Folder,
  Tag,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Info,
  Check,
  Copy,
  Trash2,
  ExternalLink,
  Music,
  FileCheck,
  BookOpen
} from 'lucide-react';
import './FileViewerPanel.css';

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileTypeLabel = (filename) => {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  switch (ext) {
    case 'pdf': return 'Documento Portátil (PDF)';
    case 'docx':
    case 'doc': return 'Documento de Word (DOCX)';
    case 'xlsx':
    case 'xls': return 'Hoja de Cálculo (XLSX)';
    case 'csv': return 'Datos Tabulares (CSV)';
    case 'txt': return 'Documento de Texto (TXT)';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'svg':
    case 'gif': return `Imagen (${ext.toUpperCase()})`;
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz': return `Archivo Comprimido (${ext.toUpperCase()})`;
    case 'py':
    case 'js':
    case 'jsx':
    case 'html':
    case 'css':
    case 'json': return `Código Fuente (${ext.toUpperCase()})`;
    case 'flac':
    case 'mp3':
    case 'wav': return `Audio (${ext.toUpperCase()})`;
    default: return ext ? `Archivo ${ext.toUpperCase()}` : 'Archivo Genérico';
  }
};

const getFileExtension = (filename) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
};

const getFileIconComponent = (filename, size = 26) => {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  switch (ext) {
    case 'pdf':
      return <FileText size={size} className="icon-pdf" style={{ color: '#EF4444' }} />;
    case 'doc':
    case 'docx':
      return <FileText size={size} className="icon-doc" style={{ color: '#3B82F6' }} />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <FileSpreadsheet size={size} className="icon-sheet" style={{ color: '#10B981' }} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'svg':
    case 'gif':
      return <ImageIcon size={size} className="icon-image" style={{ color: '#F59E0B' }} />;
    case 'py':
    case 'js':
    case 'jsx':
    case 'html':
    case 'css':
    case 'json':
      return <FileCode size={size} className="icon-code" style={{ color: '#8B5CF6' }} />;
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
      return <FolderArchive size={size} className="icon-archive" style={{ color: '#EC4899' }} />;
    case 'sh':
    case 'bash':
      return <Terminal size={size} className="icon-terminal" style={{ color: '#14B8A6' }} />;
    case 'flac':
    case 'mp3':
    case 'wav':
      return <Music size={size} className="icon-music" style={{ color: '#06B6D4' }} />;
    default:
      return <File size={size} className="icon-generic" style={{ color: '#9CA3AF' }} />;
  }
};

const getFileCategoryColor = (filename) => {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  switch (ext) {
    case 'pdf':
      return '#EF4444'; // Bright Red for PDF
    case 'doc':
    case 'docx':
      return '#3B82F6'; // Blue for Word
    case 'xls':
    case 'xlsx':
    case 'csv':
      return '#10B981'; // Green for Excel
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'svg':
      return '#F59E0B'; // Amber for Images
    case 'py':
    case 'js':
    case 'jsx':
    case 'html':
    case 'css':
    case 'json':
      return '#8B5CF6'; // Purple for Code
    case 'zip':
    case 'rar':
    case 'tar':
      return '#EC4899'; // Pink for Zip
    case 'txt':
    case 'md':
      return '#64748B'; // Slate for Text
    case 'flac':
    case 'mp3':
      return '#06B6D4'; // Cyan for Audio
    default:
      return '#6B7280';
  }
};

export default function FileViewerPanel({
  file,
  onClose,
  onDownload,
  onDelete,
  isFavorite,
  onToggleFavorite
}) {
  const [activeTab, setActiveTab] = useState('detalles'); // 'detalles' | 'actividad'
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activities, setActivities] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [docData, setDocData] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');

  const ext = useMemo(() => {
    if (!file?.name) return '';
    const parts = file.name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }, [file?.name]);

  const isPdf = ext === 'pdf';
  const isDocx = ext === 'docx' || ext === 'doc';
  const isImage = ['jpg', 'jpeg', 'png', 'svg', 'gif', 'webp'].includes(ext);
  const isTextLike = ['txt', 'md', 'json', 'js', 'jsx', 'py', 'html', 'css', 'sh', 'sql', 'log'].includes(ext);

  // Fetch document content for Word or Text files
  useEffect(() => {
    if (!file?.name) {
      setDocData(null);
      return;
    }

    if (isDocx || isTextLike) {
      let cancelled = false;
      setLoadingDoc(true);
      fetch(`/api/files/${encodeURIComponent(file.name)}/doc-content`)
        .then(res => res.json())
        .then(data => {
          if (!cancelled) setDocData(data);
        })
        .catch(err => {
          if (!cancelled) setDocData({ status: 'error', message: err.message });
        })
        .finally(() => {
          if (!cancelled) setLoadingDoc(false);
        });

      return () => {
        cancelled = true;
      };
    } else {
      setDocData(null);
    }
  }, [file?.name, isDocx, isTextLike]);

  // Fetch activity when activeTab is 'actividad'
  useEffect(() => {
    if (!file?.name || activeTab !== 'actividad') return;
    setLoadingActivity(true);
    fetch(`/api/files/${encodeURIComponent(file.name)}/activity`)
      .then(res => res.json())
      .then(data => {
        setActivities(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error('Error fetching file activity:', err);
        setActivities([]);
      })
      .finally(() => {
        setLoadingActivity(false);
      });
  }, [file?.name, activeTab]);

  if (!file) {
    return (
      <div className="file-viewer-panel empty-panel">
        <div className="empty-panel-content">
          <FileText size={48} className="empty-panel-icon" />
          <h3>Selecciona un archivo</h3>
          <p>Haz clic en cualquier archivo de la lista para ver su vista previa, metadatos y opciones.</p>
        </div>
      </div>
    );
  }

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

  const defaultDescription = file.description || `Reporte e integridad de datos del archivo ${file.name}.`;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/api/download/${encodeURIComponent(file.name)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/api/download/${encodeURIComponent(file.name)}`;
    if (navigator.share) {
      navigator.share({
        title: file.name,
        text: `Acceso al archivo ${file.name} en ARIA`,
        url: url
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 20, 200));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 20, 60));
  const handleResetZoom = () => setZoomLevel(100);

  return (
    <>
      <aside className="file-viewer-panel" style={{ '--accent-file': categoryColor }}>
        {/* Panel Header */}
        <div className="fvp-header">
          <div className="fvp-header-left">
            <div
              className="fvp-icon-badge"
              style={{
                backgroundColor: `${categoryColor}22`,
                borderColor: `${categoryColor}45`
              }}
            >
              {getFileIconComponent(file.name, 24)}
            </div>
            <div className="fvp-header-titles">
              <h3 className="fvp-filename" title={file.name}>
                {file.name}
              </h3>
              <div className="fvp-badge-row">
                <span
                  className="fvp-badge-ext"
                  style={{
                    color: categoryColor,
                    borderColor: `${categoryColor}45`,
                    backgroundColor: `${categoryColor}18`
                  }}
                >
                  {fileExt}
                </span>
                <span className="fvp-badge-size">{formatSize(file.size)}</span>
              </div>
            </div>
          </div>

          <div className="fvp-header-actions">
            <button
              className={`fvp-icon-btn ${isFavorite ? 'is-favorited' : ''}`}
              onClick={() => onToggleFavorite && onToggleFavorite(file.name)}
              title={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
            >
              <Star size={17} fill={isFavorite ? '#F59E0B' : 'none'} color={isFavorite ? '#F59E0B' : 'currentColor'} />
            </button>
            <button className="fvp-icon-btn close-btn" onClick={onClose} title="Cerrar panel">
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="fvp-tabs">
          <button
            className={`fvp-tab-btn ${activeTab === 'detalles' ? 'active' : ''}`}
            onClick={() => setActiveTab('detalles')}
          >
            Detalles
          </button>
          <button
            className={`fvp-tab-btn ${activeTab === 'actividad' ? 'active' : ''}`}
            onClick={() => setActiveTab('actividad')}
          >
            Actividad
          </button>
        </div>

        {/* Tab 1: Detalles */}
        {activeTab === 'detalles' && (
          <div className="fvp-body">
            {/* Visualizer Frame */}
            <div className="fvp-visualizer-container">
              {isPdf ? (
                /* PDF Interactive Viewer */
                <div className="fvp-pdf-viewer">
                  <div className="fvp-pdf-controls">
                    <div className="fvp-pdf-ctrl-group">
                      <span className="fvp-format-tag" style={{ color: '#EF4444' }}>PDF</span>
                      <button onClick={handleZoomOut} title="Alejar" disabled={zoomLevel <= 60} className="fvp-zoom-btn">
                        <ZoomOut size={13} />
                      </button>
                      <span className="fvp-zoom-label" onClick={handleResetZoom} title="Restablecer">
                        {zoomLevel}%
                      </span>
                      <button onClick={handleZoomIn} title="Acercar" disabled={zoomLevel >= 200} className="fvp-zoom-btn">
                        <ZoomIn size={13} />
                      </button>
                    </div>
                    <button
                      className="fvp-expand-btn"
                      onClick={() => setShowFullModal(true)}
                      title="Pantalla completa"
                    >
                      <Maximize2 size={13} />
                    </button>
                  </div>
                  <div
                    className="fvp-pdf-canvas-wrapper"
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                  >
                    <iframe
                      src={`/api/download/${encodeURIComponent(file.name)}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                      title={file.name}
                      className="fvp-pdf-iframe"
                    />
                  </div>
                </div>
              ) : isDocx ? (
                /* Word (.docx) Interactive Document Viewer */
                <div className="fvp-word-viewer">
                  <div className="fvp-word-toolbar">
                    <div className="fvp-word-toolbar-left">
                      <FileText size={14} color="#3B82F6" />
                      <span className="fvp-word-title-tag">Word Document</span>
                      {docData?.words > 0 && (
                        <span className="fvp-word-count-tag">{docData.words} palabras</span>
                      )}
                    </div>
                    <div className="fvp-word-toolbar-right">
                      <button
                        className="fvp-zoom-btn"
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 60}
                        title="Reducir escala"
                      >
                        <ZoomOut size={12} />
                      </button>
                      <span className="fvp-zoom-label" onClick={handleResetZoom}>
                        {zoomLevel}%
                      </span>
                      <button
                        className="fvp-zoom-btn"
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 180}
                        title="Aumentar escala"
                      >
                        <ZoomIn size={12} />
                      </button>
                      <button
                        className="fvp-expand-btn"
                        onClick={() => setShowFullModal(true)}
                        title="Ver en pantalla completa"
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="fvp-word-sheet-wrapper">
                    {loadingDoc ? (
                      <div className="fvp-doc-loading">
                        <FileCheck size={24} className="spin-icon" color="#3B82F6" />
                        <span>Renderizando documento Word...</span>
                      </div>
                    ) : (
                      <div
                        className="fvp-word-sheet"
                        style={{
                          transform: `scale(${zoomLevel / 100})`,
                          transformOrigin: 'top center'
                        }}
                      >
                        <div className="fvp-word-sheet-header">
                          <span className="fvp-doc-watermark">A.R.I.A Word Viewer</span>
                          <span className="fvp-doc-page-num">Pág. 1</span>
                        </div>
                        {docData?.html ? (
                          <div
                            className="fvp-word-html-content"
                            dangerouslySetInnerHTML={{ __html: docData.html }}
                          />
                        ) : (
                          <div className="fvp-word-fallback">
                            <h4>{file.name}</h4>
                            <p>Documento procesado por el motor de análisis de A.R.I.A.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : isImage ? (
                /* Image Viewer */
                <div className="fvp-image-viewer" onClick={() => setShowFullModal(true)}>
                  <img
                    src={`/api/download/${encodeURIComponent(file.name)}`}
                    alt={file.name}
                    className="fvp-image-preview"
                    style={{ transform: `scale(${zoomLevel / 100})` }}
                  />
                  <div className="fvp-preview-overlay">
                    <Search size={20} />
                  </div>
                </div>
              ) : isTextLike ? (
                /* Text / Code Viewer */
                <div className="fvp-text-viewer">
                  <div className="fvp-text-header">
                    <span>Vista previa ({fileExt})</span>
                    <button onClick={() => setShowFullModal(true)} className="fvp-expand-btn" title="Expandir">
                      <Maximize2 size={12} />
                    </button>
                  </div>
                  {loadingDoc ? (
                    <div className="fvp-loading-text">Cargando contenido...</div>
                  ) : (
                    <pre className="fvp-code-block">{docData?.content || 'Archivo sin contenido textual legible.'}</pre>
                  )}
                </div>
              ) : (
                /* Generic Document Visualizer Card */
                <div className="fvp-doc-visualizer-mock">
                  <div className="fvp-doc-page-sketch">
                    <div className="fvp-sketch-line header-line"></div>
                    <div className="fvp-sketch-line"></div>
                    <div className="fvp-sketch-line short"></div>
                    <div className="fvp-sketch-line"></div>
                    <div className="fvp-sketch-line medium"></div>
                    <div className="fvp-sketch-line"></div>
                  </div>
                  <button
                    className="fvp-doc-magnifier-btn"
                    onClick={() => setShowFullModal(true)}
                    title="Inspeccionar documento"
                  >
                    <Search size={22} />
                  </button>
                </div>
              )}
            </div>

            {/* Quick Action Buttons Row */}
            <div className="fvp-action-buttons-grid">
              <button
                className="fvp-action-btn"
                onClick={() => onDownload && onDownload(file.name)}
                title="Descargar archivo"
              >
                <Download size={15} />
                <span>Descargar</span>
              </button>

              <button
                className="fvp-action-btn"
                onClick={handleShare}
                title="Compartir archivo"
              >
                <Share2 size={15} />
                <span>Compartir</span>
              </button>

              <button
                className={`fvp-action-btn ${copiedLink ? 'copied' : ''}`}
                onClick={handleCopyLink}
                title="Copiar enlace directo"
              >
                {copiedLink ? <Check size={15} color="#10B981" /> : <LinkIcon size={15} />}
                <span>{copiedLink ? 'Copiado' : 'Copiar enlace'}</span>
              </button>

              <div className="fvp-more-container">
                <button
                  className="fvp-action-btn"
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  title="Más opciones"
                >
                  <MoreHorizontal size={15} />
                  <span>Más</span>
                </button>

                {showMoreMenu && (
                  <div className="fvp-more-dropdown fade-in">
                    <button
                      className="fvp-dropdown-item"
                      onClick={() => {
                        setShowFullModal(true);
                        setShowMoreMenu(false);
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>Vista Previa Completa</span>
                    </button>
                    <button
                      className="fvp-dropdown-item danger"
                      onClick={() => {
                        setShowMoreMenu(false);
                        if (onDelete) onDelete(file.name);
                      }}
                    >
                      <Trash2 size={14} />
                      <span>Eliminar archivo</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Metadata Section */}
            <div className="fvp-metadata-section">
              <div className="fvp-meta-item">
                <span className="fvp-meta-label">Propietario</span>
                <span className="fvp-meta-value">{file.owner || 'Astra'}</span>
              </div>

              <div className="fvp-meta-item">
                <span className="fvp-meta-label">Carpeta</span>
                <span className="fvp-meta-value fvp-meta-folder">
                  / {file.folder || 'Raíz'}
                </span>
              </div>

              <div className="fvp-meta-item">
                <span className="fvp-meta-label">Tipo</span>
                <span className="fvp-meta-value">{getFileTypeLabel(file.name)}</span>
              </div>

              <div className="fvp-meta-item">
                <span className="fvp-meta-label">Subido el</span>
                <span className="fvp-meta-value">{formattedDate}</span>
              </div>

              <div className="fvp-meta-item">
                <span className="fvp-meta-label">Última modificación</span>
                <span className="fvp-meta-value">{formattedDate}</span>
              </div>

              <div className="fvp-meta-item fvp-meta-tags-item">
                <span className="fvp-meta-label">Etiquetas</span>
                <div className="fvp-tags-list">
                  <span className="fvp-tag-pill">{ext ? `.${ext}` : 'archivo'}</span>
                  <span className="fvp-tag-pill">{file.folder || 'general'}</span>
                  <span className="fvp-tag-pill fvp-tag-more">seguro</span>
                </div>
              </div>

              <div className="fvp-description-block">
                <span className="fvp-meta-label">Descripción</span>
                <p className="fvp-description-text">{defaultDescription}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Actividad */}
        {activeTab === 'actividad' && (
          <div className="fvp-body fvp-activity-body">
            {loadingActivity ? (
              <div className="fvp-activity-loading">Cargando historial de eventos...</div>
            ) : activities.length === 0 ? (
              <div className="fvp-activity-empty">
                <Clock size={32} className="empty-icon" />
                <p>No hay eventos registrados recientemente para este archivo.</p>
              </div>
            ) : (
              <div className="fvp-timeline">
                {activities.map((act) => (
                  <div key={act.id} className="fvp-timeline-item">
                    <div className="fvp-timeline-dot"></div>
                    <div className="fvp-timeline-content">
                      <div className="fvp-timeline-header">
                        <span className="fvp-timeline-type">{act.type || 'Modificación'}</span>
                        <span className="fvp-timeline-time">{act.time}</span>
                      </div>
                      <p className="fvp-timeline-desc">{act.description}</p>
                      <div className="fvp-timeline-footer">
                        <span>Por: <strong>{act.owner}</strong></span>
                        {act.severity && (
                          <span className={`fvp-sev-badge sev-${act.severity.toLowerCase()}`}>
                            {act.severity}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Fullscreen Inspector Modal */}
      {showFullModal && (
        <div className="fvp-modal-overlay" onClick={() => setShowFullModal(false)}>
          <div className="fvp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="fvp-modal-header">
              <div className="fvp-modal-title">
                {getFileIconComponent(file.name, 22)}
                <h4>{file.name}</h4>
                <span
                  className="fvp-badge-ext"
                  style={{
                    color: categoryColor,
                    borderColor: `${categoryColor}45`,
                    backgroundColor: `${categoryColor}18`
                  }}
                >
                  {fileExt}
                </span>
                {isDocx && docData?.words > 0 && (
                  <span className="fvp-modal-word-badge">{docData.words} palabras</span>
                )}
              </div>
              <div className="fvp-modal-actions">
                <button
                  className="fvp-icon-btn"
                  onClick={() => onDownload && onDownload(file.name)}
                  title="Descargar"
                >
                  <Download size={18} />
                </button>
                <button
                  className="fvp-icon-btn close-btn"
                  onClick={() => setShowFullModal(false)}
                  title="Cerrar modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="fvp-modal-content">
              {isPdf ? (
                <iframe
                  src={`/api/download/${encodeURIComponent(file.name)}#toolbar=1&navpanes=1`}
                  title={file.name}
                  className="fvp-modal-pdf-iframe"
                />
              ) : isDocx ? (
                <div className="fvp-modal-word-container">
                  <div className="fvp-modal-word-page">
                    <div className="fvp-word-doc-ribbon">
                      <BookOpen size={16} color="#3B82F6" />
                      <span>Visor de Documento Word — {file.name}</span>
                    </div>
                    {docData?.html ? (
                      <div
                        className="fvp-word-html-content full-view"
                        dangerouslySetInnerHTML={{ __html: docData.html }}
                      />
                    ) : (
                      <div className="fvp-word-doc-empty">
                        <p>No se pudo cargar el contenido del documento Word.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : isImage ? (
                <div className="fvp-modal-image-wrapper">
                  <img src={`/api/download/${encodeURIComponent(file.name)}`} alt={file.name} className="fvp-modal-image" />
                </div>
              ) : isTextLike ? (
                <div className="fvp-modal-text-wrapper">
                  <pre className="fvp-modal-pre">{docData?.content || 'Sin contenido textual.'}</pre>
                </div>
              ) : (
                <div className="fvp-modal-doc-info">
                  <div className="fvp-modal-doc-icon-large" style={{ color: categoryColor }}>
                    {getFileIconComponent(file.name, 64)}
                  </div>
                  <h3>{file.name}</h3>
                  <p className="fvp-modal-doc-desc">
                    Este documento ({fileExt}) está almacenado de forma segura en la bóveda de ARIA.
                  </p>
                  <div className="fvp-modal-details-grid">
                    <div><strong>Tamaño:</strong> {formatSize(file.size)}</div>
                    <div><strong>Propietario:</strong> {file.owner || 'Astra'}</div>
                    <div><strong>Carpeta:</strong> {file.folder || 'Raíz'}</div>
                    <div><strong>Fecha:</strong> {formattedDate}</div>
                  </div>
                  <button className="fvp-modal-download-primary" onClick={() => onDownload && onDownload(file.name)}>
                    <Download size={18} />
                    <span>Descargar para ver en el programa nativo</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
