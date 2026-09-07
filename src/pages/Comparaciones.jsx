import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  FileCode,
  FolderArchive,
  Terminal,
  Music,
  X,
  Download,
  FolderOpen,
  Search,
  ArrowUp,
  ArrowDown,
  Grid,
  Folder,
  Sparkles
} from 'lucide-react';
import Header from '../components/Header';
import AiAnalysisModal from '../components/AiAnalysisModal';
import PdfIcon from '../components/PdfIcon';
import './Comparaciones.css';

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
    case 'sh':
    case 'bash':
      return '#14B8A6'; // Teal
    default:
      return '#6B7280';
  }
};

const getFileColor = getFileCategoryColor;

const getMinimalFileIcon = (filename, size = 32) => {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  switch (ext) {
    case 'pdf':
      return <PdfIcon size={size} color="#EF4444" />;
    case 'doc':
    case 'docx':
      return <FileText size={size} style={{ color: '#3B82F6' }} />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <FileSpreadsheet size={size} style={{ color: '#10B981' }} />;
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

const getFileIcon = getMinimalFileIcon;

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

function Comparaciones() {
  const { module } = useParams();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlertForAnalysis, setSelectedAlertForAnalysis] = useState(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedExtensions, setSelectedExtensions] = useState([]);

  const fetchFiles = async () => {
    try {
      const response = await fetch(`/api/comparisons?module=${module || 'general'}`);
      if (!response.ok) throw new Error('Error al obtener archivos');
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();

    let ws = null;
    let reconnectTimeout = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      try {
        ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (['modified', 'deleted', 'created', 'resolved'].includes(message.type)) {
              fetchFiles();
            }
          } catch (e) {
            // ignore
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {};
      } catch (e) {}
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => ws.close();
        }
      }
    };
  }, [module]);

  const availableExtensions = useMemo(() => {
    const exts = new Set();
    files.forEach(f => {
      const parts = f.name.split('.');
      const ext = parts.length > 1 ? parts.pop().toLowerCase() : 'otros';
      exts.add(ext);
    });
    
    // Alfabético y con los seleccionados primero
    const sortedExts = Array.from(exts).sort();
    return sortedExts.sort((a, b) => {
      const aSelected = selectedExtensions.includes(a);
      const bSelected = selectedExtensions.includes(b);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });
  }, [files, selectedExtensions]);

  const processedFiles = useMemo(() => {
    let filtered = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || (f.owner && f.owner.toLowerCase().includes(searchTerm.toLowerCase())));
    
    if (sortBy === 'type' && selectedExtensions.length > 0) {
      filtered = filtered.filter(f => {
        const parts = f.name.split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : 'otros';
        return selectedExtensions.includes(ext);
      });
    }

    return filtered.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortBy === 'size') {
          valA = a.size || 0;
          valB = b.size || 0;
        } else if (sortBy === 'timestamp') {
          valA = new Date(a.timestamp).getTime();
          valB = new Date(b.timestamp).getTime();
        } else if (sortBy === 'type') {
          const extA = a.name.split('.').pop().toLowerCase();
          const extB = b.name.split('.').pop().toLowerCase();
          valA = extA === a.name.toLowerCase() ? '' : extA; // handle no extension
          valB = extB === b.name.toLowerCase() ? '' : extB;
        }
        
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [files, searchTerm, sortBy, sortOrder, selectedExtensions]);

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const toggleExtension = (ext) => {
    setSelectedExtensions(prev => 
      prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
    );
  };

  const handleViewAnalysis = (file) => {
    setSelectedAlertForAnalysis(file);
    setIsAnalysisModalOpen(true);
  };

  return (
    <>
      <Header title={module ? `Comparaciones de ${module.charAt(0).toUpperCase() + module.slice(1)}` : "Historial de comparaciones"} showTimeframe={false} />
      
      <div className="archivos-container">
        <div className="archivos-controls">
          <div className="search-container">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o propietario..." 
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="view-toggle-group">
            <button 
              className={`view-toggle-btn ${!isGrouped ? 'active' : ''}`}
              onClick={() => setIsGrouped(false)}
              title="Vista de Lista Suelta"
            >
              <Grid size={18} />
            </button>
            <button 
              className={`view-toggle-btn ${isGrouped ? 'active' : ''}`}
              onClick={() => setIsGrouped(true)}
              title="Vista de Carpetas (Agrupado por Tipo)"
            >
              <Folder size={18} />
            </button>
          </div>

          <div className="sort-controls">
            <span className="sort-label">Ordenar por:</span>
            <select 
              className="sort-select" 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="timestamp">Fecha</option>
              <option value="name">Nombre</option>
              <option value="type">Tipo de archivo</option>
              <option value="size">Peso</option>
            </select>
            <button className="sort-order-btn" onClick={toggleSortOrder} title={`Cambiar a ${sortOrder === 'asc' ? 'descendente' : 'ascendente'}`}>
              {sortOrder === 'asc' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
            </button>
          </div>
        </div>

        {sortBy === 'type' && availableExtensions.length > 0 && (
          <div className="extension-filters-container">
            <span className="extension-filters-title">Filtrar por extensión:</span>
            <div className="extension-filters">
              {availableExtensions.map(ext => (
                <label key={ext} className={`extension-checkbox ${selectedExtensions.includes(ext) ? 'active' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={selectedExtensions.includes(ext)}
                    onChange={() => toggleExtension(ext)}
                    className="hidden-checkbox"
                  />
                  <span className="extension-badge">.{ext}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Cargando comparaciones...</div>
        ) : processedFiles.length === 0 ? (
          <div className="empty-state">No se encontraron archivos con comparaciones recientes.</div>
        ) : isGrouped ? (
          // Grouped View
          Object.entries(
            processedFiles.reduce((groups, file) => {
              const ext = file.name.split('.').pop().toLowerCase();
              const key = file.name.includes('.') ? ext : 'otros';
              if (!groups[key]) groups[key] = [];
              groups[key].push(file);
              return groups;
            }, {})
          ).sort((a, b) => b[1].length - a[1].length).map(([ext, files]) => (
            <div key={ext} className="file-group-section">
              <div className="file-group-header">
                <Folder size={24} color="var(--accent-primary)" />
                <h3>Archivos .{ext}</h3>
                <span className="badge">{files.length}</span>
              </div>
              <div className="files-grid">
                {files.map((file, idx) => {
                  const categoryColor = getFileCategoryColor(file.name);
                  return (
                    <div 
                      key={idx} 
                      className="file-card" 
                      onClick={() => handleViewAnalysis(file)}
                      style={{ '--file-color': categoryColor }}
                    >
                      <div 
                        className="file-card-icon-wrapper"
                        style={{
                          backgroundColor: `${categoryColor}20`,
                          borderColor: `${categoryColor}40`,
                          color: categoryColor
                        }}
                      >
                        {getMinimalFileIcon(file.name, 32)}
                      </div>
                      <div className="file-card-info">
                        <h4 className="file-name" title={file.name}>{file.name}</h4>
                        <div className="file-meta">
                          <span className="file-owner" title="Propietario">{file.owner}</span>
                          <span className="file-size" title="Tamaño">{formatSize(file.size)}</span>
                        </div>
                        <div className="file-date" title="Última modificación">
                          {new Date(file.timestamp).toLocaleString()}
                        </div>
                        <div className="comparison-badge" style={{ marginTop: '8px', fontSize: '11px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Sparkles size={12} /> Análisis de cambios disponible
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          // Flat Grid View
          <div className="files-grid">
            {processedFiles.map((file, idx) => {
              const categoryColor = getFileCategoryColor(file.name);
              return (
                <div 
                  key={idx} 
                  className="file-card" 
                  onClick={() => handleViewAnalysis(file)}
                  style={{ '--file-color': categoryColor }}
                >
                  <div 
                    className="file-card-icon-wrapper"
                    style={{
                      backgroundColor: `${categoryColor}20`,
                      borderColor: `${categoryColor}40`,
                      color: categoryColor
                    }}
                  >
                    {getMinimalFileIcon(file.name, 32)}
                  </div>
                  <div className="file-card-info">
                    <h4 className="file-name" title={file.name}>{file.name}</h4>
                    <div className="file-meta">
                      <span className="file-owner" title="Propietario">{file.owner}</span>
                      <span className="file-size" title="Tamaño">{formatSize(file.size)}</span>
                    </div>
                    <div className="file-date" title="Última modificación">
                      {new Date(file.timestamp).toLocaleString()}
                    </div>
                    <div className="comparison-badge" style={{ marginTop: '8px', fontSize: '11px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={12} /> Análisis de cambios disponible
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AiAnalysisModal 
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        alert={selectedAlertForAnalysis}
      />
    </>
  );
}

export default Comparaciones;
