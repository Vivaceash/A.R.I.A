import { X, CheckCircle, FileText, FileSpreadsheet, Image as ImageIcon, File, FileCode, FolderArchive, Terminal } from 'lucide-react';
import '../pages/Archivos.css';
import './CategoryModal.css';

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

const getOwner = (desc, defaultOwner) => {
  if (defaultOwner) return defaultOwner;
  const match = desc.match(/por (.+)$/);
  return match ? match[1] : 'Sistema';
};

const formatSize = (bytes) => {
  if (bytes === undefined || bytes === null) return 'Desc.';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const CategoryModal = ({ isOpen, onClose, title, data }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>{title}</h3>
            <span className="modal-count">{data.length} alertas</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          {data.length === 0 ? (
            <div className="modal-empty-state">
              <CheckCircle size={48} className="empty-icon" />
              <p>No hay alertas en esta categoría</p>
            </div>
          ) : (
            <div className="files-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
              {data.map(alert => (
                <div key={alert.id} className="file-card">
                  <div className="file-card-icon-wrapper">
                    {getFileIcon(alert.title)}
                  </div>
                  <div className="file-card-info">
                    <h4 className="file-name" title={alert.title}>{alert.title}</h4>
                    <div className="file-meta">
                      <span className="file-owner" title="Propietario">{getOwner(alert.description, alert.owner)}</span>
                      <span className="file-size" title="Tamaño">{formatSize(alert.fileSize)}</span>
                    </div>
                    {alert.filePath && (
                      <div className="file-path" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', wordBreak: 'break-all' }}>
                        {alert.filePath}
                      </div>
                    )}
                    <div className="file-date" title="Última modificación">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                    <div className="modal-card-badges" style={{ marginTop: '8px' }}>
                      {alert.type && <span className="modal-badge badge-type">{alert.type}</span>}
                      {alert.severity && <span className={`modal-badge badge-${alert.severity.toLowerCase()}`}>{alert.severity}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryModal;
