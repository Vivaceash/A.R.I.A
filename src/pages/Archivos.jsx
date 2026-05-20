import { useState, useEffect, useMemo } from 'react';
import { FileText, FileSpreadsheet, Image as ImageIcon, File, FileCode, FolderArchive, Terminal, X, Download, FolderOpen, Search, ArrowUp, ArrowDown, Grid, Folder } from 'lucide-react';
import Header from '../components/Header';
import './Archivos.css';

const getFileIcon = (filename) => {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  
  switch (ext) {
    case 'doc':
    case 'docx':
    case 'txt':
    case 'pdf':
      return <FileText size={48} className="file-icon-doc" />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <FileSpreadsheet size={48} className="file-icon-sheet" />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'svg':
    case 'gif':
      return <ImageIcon size={48} className="file-icon-image" />;
    case 'py':
    case 'js':
    case 'jsx':
    case 'html':
    case 'css':
    case 'json':
      return <FileCode size={48} className="file-icon-code" />;
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
      return <FolderArchive size={48} className="file-icon-archive" />;
    case 'sh':
    case 'bash':
      return <Terminal size={48} className="file-icon-terminal" />;
    default:
      return <File size={48} className="file-icon-generic" />;
  }
};

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

function Archivos() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isGrouped, setIsGrouped] = useState(false);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(`http://${window.location.hostname}:8000/api/files`);
        if (!response.ok) throw new Error('Error al obtener archivos');
        const data = await response.json();
        setFiles(data);
      } catch (error) {
        console.error("Error loading files:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('mtime');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedExtensions, setSelectedExtensions] = useState([]);

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
    let filtered = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.owner.toLowerCase().includes(searchTerm.toLowerCase()));
    
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
          valA = a.size;
          valB = b.size;
        } else if (sortBy === 'mtime') {
          valA = new Date(a.mtime).getTime();
          valB = new Date(b.mtime).getTime();
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

  const handleDownload = (filename) => {
    // Create an invisible anchor element to trigger the download
    const link = document.createElement('a');
    link.href = `http://${window.location.hostname}:8000/api/download/${filename}`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const handleOpenFolder = async () => {
    try {
      await fetch(`http://${window.location.hostname}:8000/api/open-folder`, {
        method: 'POST'
      });
    } catch (error) {
      console.error("Error opening folder:", error);
    }
  };

  return (
    <>
      <Header title="Explorador de Archivos" showTimeframe={false} />
      
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
              <option value="mtime">Fecha</option>
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
          <div className="loading-state">Cargando archivos...</div>
        ) : processedFiles.length === 0 ? (
          <div className="empty-state">No se encontraron archivos que coincidan con la búsqueda.</div>
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
                {files.map((file, idx) => (
                  <div key={idx} className="file-card" onClick={() => setSelectedFile(file)}>
                    <div className="file-card-icon-wrapper">
                      {getFileIcon(file.name)}
                    </div>
                    <div className="file-card-info">
                      <h4 className="file-name" title={file.name}>{file.name}</h4>
                      <div className="file-meta">
                        <span className="file-owner" title="Propietario">{file.owner}</span>
                        <span className="file-size" title="Tamaño">{formatSize(file.size)}</span>
                      </div>
                      <div className="file-date" title="Última modificación">
                        {new Date(file.mtime).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          // Flat Grid View
          <div className="files-grid">
            {processedFiles.map((file, idx) => (
              <div key={idx} className="file-card" onClick={() => setSelectedFile(file)}>
                <div className="file-card-icon-wrapper">
                  {getFileIcon(file.name)}
                </div>
                <div className="file-card-info">
                  <h4 className="file-name" title={file.name}>{file.name}</h4>
                  <div className="file-meta">
                    <span className="file-owner" title="Propietario">{file.owner}</span>
                    <span className="file-size" title="Tamaño">{formatSize(file.size)}</span>
                  </div>
                  <div className="file-date" title="Última modificación">
                    {new Date(file.mtime).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="file-action-modal-overlay" onClick={() => setSelectedFile(null)}>
          <div className="file-action-modal" onClick={e => e.stopPropagation()}>
            <div className="file-action-header">
              <div className="file-action-title">
                {getFileIcon(selectedFile.name)}
                <h4>{selectedFile.name}</h4>
              </div>
              <button className="close-modal-btn" onClick={() => setSelectedFile(null)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="file-action-body">
              <div className="file-action-details">
                <p><strong>Propietario:</strong> {selectedFile.owner}</p>
                <p><strong>Tamaño:</strong> {formatSize(selectedFile.size)}</p>
                <p><strong>Modificado:</strong> {new Date(selectedFile.mtime).toLocaleString()}</p>
              </div>
              
              <div className="file-action-buttons">
                <button className="btn-action btn-folder" onClick={handleOpenFolder}>
                  <FolderOpen size={20} />
                  <span>Buscar en el fólder</span>
                </button>
                <button className="btn-action btn-download" onClick={() => handleDownload(selectedFile.name)}>
                  <Download size={20} />
                  <span>Descargar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Archivos;
