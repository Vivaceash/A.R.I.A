import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, Archive, FileText, History, RotateCcw, AlertTriangle, Trash2, Search, MoreVertical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Vault.css';

function Vault({ isEmbedded = false } = {}) {
  const [snapshots, setSnapshots] = useState([]);
  const [files, setFiles] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [snapshotContent, setSnapshotContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const ws = useRef(null);
  const fetchRef = useRef(null);
  const selectedFileRef = useRef(selectedFile);

  // Keep the ref in sync with state
  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  const loadSnapshotContent = useCallback(async (id) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/vault/snapshots/${id}/content`);
      const data = await res.json();
      setSnapshotContent(data.content);
    } catch (err) {
      console.error('Error fetching snapshot content', err);
      setSnapshotContent('Error al cargar el contenido de esta versión.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch('/api/vault/snapshots');
      const data = await res.json();
      setSnapshots(data);
      
      const grouped = data.reduce((acc, snap) => {
        if (!acc[snap.filename]) acc[snap.filename] = [];
        acc[snap.filename].push(snap);
        return acc;
      }, {});
      setFiles(grouped);

      const currentSelected = selectedFileRef.current;
      if ((!currentSelected || !grouped[currentSelected]) && Object.keys(grouped).length > 0) {
        const firstFile = Object.keys(grouped)[0];
        setSelectedFile(firstFile);
        setSelectedSnapshot(grouped[firstFile][0]);
        loadSnapshotContent(grouped[firstFile][0].id);
      } else if (Object.keys(grouped).length === 0) {
        setSelectedFile(null);
        setSelectedSnapshot(null);
        setSnapshotContent('');
      }
    } catch (err) {
      console.error('Error fetching snapshots', err);
    }
  }, [loadSnapshotContent]);

  // Keep fetchRef always pointing to the latest fetchSnapshots
  useEffect(() => {
    fetchRef.current = fetchSnapshots;
  }, [fetchSnapshots]);

  // Initial fetch
  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // WebSocket — stable effect, never recreates the connection
  useEffect(() => {
    let wsInstance;
    let reconnectTimeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsInstance = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      ws.current = wsInstance;

      wsInstance.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (['modified', 'deleted', 'created', 'resolved'].includes(message.type)) {
            // Use ref so we always call the latest version without re-subscribing
            fetchRef.current?.();
          }
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      wsInstance.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };

      wsInstance.onerror = () => {
        wsInstance.close();
      };
    };

    connect();

    return () => {
      if (wsInstance) wsInstance.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []); // Stable — no dependencies, runs once



  const handleSelectSnapshot = (snap) => {
    setSelectedSnapshot(snap);
    loadSnapshotContent(snap.id);
  };

  const handleRestoreClick = () => {
    if (!selectedSnapshot) return;
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    setShowRestoreModal(false);
    try {
      const res = await fetch(`/api/vault/restore/${selectedSnapshot.id}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'success') {
        showToast(`¡Restaurado como ${data.new_filename}!`);
      } else {
        showToast('Error al restaurar: ' + data.message);
      }
    } catch (err) {
      showToast('Error de conexión al restaurar.');
    }
  };

  const handleDeleteClick = () => {
    if (!selectedSnapshot) return;
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/vault/snapshots/${selectedSnapshot.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setShowDeleteModal(false);
        showToast(`¡Archivo eliminado definitivamente de la bóveda!`);
        setSelectedSnapshot(null);
        setSelectedFile(null); // Force it to pick a new file on next fetch
      } else {
        const data = await res.json();
        setShowDeleteModal(false);
        showToast('Error al eliminar: ' + data.detail);
      }
    } catch (err) {
      setShowDeleteModal(false);
      showToast('Error de conexión al eliminar.');
    } finally {
      setIsDeleting(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString();
  };
  
  const formatTime = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString();
  };

  const getFileColor = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'txt': return '#3b82f6';
      case 'pdf': return '#ef4444';
      case 'docx': case 'doc': return '#2563eb';
      case 'xlsx': case 'xls': case 'csv': return '#10b981';
      case 'py': return '#8b5cf6';
      default: return 'var(--text-muted)';
    }
  };

  const filteredFiles = Object.keys(files).filter(filename => 
    filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`vault-container fade-in ${isEmbedded ? 'embedded' : ''}`}>
      {!isEmbedded && (
        <div className="vault-header">
          <Archive size={32} />
          <h1>Bóveda de Recuperación (Vault)</h1>
        </div>
      )}
      
      <p style={{ color: 'var(--text-muted)', marginBottom: isEmbedded ? '20px' : '24px', fontSize: isEmbedded ? '13.5px' : 'inherit' }}>
        Las versiones de los archivos modificados se respaldan aquí. El sistema mantiene un historial automático de 7 días, purgando las capturas más antiguas.
      </p>

      <div className="vault-grid">
        <div className="vault-sidebar">
          <div className="vault-sidebar-header">
            <span className="sidebar-title">ARCHIVOS CON HISTORIAL ({Object.keys(files).length})</span>
            <div className="vault-search">
              <Search size={14} className="search-icon" />
              <input 
                type="text" 
                placeholder="Buscar archivo..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="vault-file-list">
            {filteredFiles.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                {Object.keys(files).length === 0 ? 'No hay archivos en la bóveda.' : 'No se encontraron archivos.'}
              </div>
            )}
            {filteredFiles.map((filename) => {
              const snaps = files[filename];
              return (
                <div 
                  key={filename}
                  className={`vault-file-item ${selectedFile === filename ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedFile(filename);
                    handleSelectSnapshot(snaps[0]); // Auto-select latest
                  }}
                >
                  <div className="file-item-left">
                    <FileText size={16} style={{ color: getFileColor(filename) }} />
                    <div className="file-item-texts">
                      <span className="file-name">{filename}</span>
                      <span className="file-versions">{snaps.length} versión(es) guardada(s)</span>
                    </div>
                  </div>
                  <div className="file-item-right">
                    <div className="file-item-date-time">
                      <span>{formatDate(snaps[0].timestamp)}</span>
                      <span>{formatTime(snaps[0].timestamp)}</span>
                    </div>
                    <MoreVertical className="file-item-dots" size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="vault-content">
          {!selectedFile ? (
            <div className="vault-content-empty">
              <History size={48} style={{ opacity: 0.5 }} />
              <h3>Selecciona un archivo</h3>
              <p>Explora la línea de tiempo de modificaciones para restaurar versiones antiguas.</p>
            </div>
          ) : (
            <div className="vault-viewer-container">
              {selectedSnapshot && (
                <>
                  <div className="viewer-header">
                    <div className="viewer-header-left">
                      <div className="viewer-icon-box">
                        <History size={20} />
                      </div>
                      <div className="viewer-header-texts">
                        <div className="viewer-title">
                          <span className="viewer-date-bold">{formatDate(selectedSnapshot.timestamp)}</span>
                          <span className="viewer-subtitle-bold">Viendo versión del {formatDate(selectedSnapshot.timestamp)} a las {formatTime(selectedSnapshot.timestamp)}</span>
                        </div>
                        <div className="viewer-subtitle">
                          <AlertTriangle size={14} color="#F59E0B" /> Snapshot de solo lectura
                        </div>
                      </div>
                    </div>
                    
                    {(user?.role === 'Administrador' || user?.department === 'Ciberseguridad') && (
                      <div className="viewer-header-right">
                        <button className="btn-vault-outline" onClick={handleRestoreClick}>
                          <RotateCcw size={16} /> Restaurar Versión
                        </button>
                        <button className="btn-vault-ghost" onClick={handleDeleteClick}>
                          <Trash2 size={16} /> Borrar Registro
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="vault-timeline-container">
                    <div className="vault-timeline">
                      {[...(files[selectedFile] || [])].reverse().map((snap) => (
                        <div 
                          key={snap.id} 
                          className={`timeline-node ${snap.id === selectedSnapshot?.id ? 'active' : ''}`}
                          onClick={() => handleSelectSnapshot(snap)}
                          title={`${formatDate(snap.timestamp)} ${formatTime(snap.timestamp)}`}
                        >
                          <div className="node-date-top">{formatDate(snap.timestamp)}</div>
                          <div className="node-circle"></div>
                          <div className="node-time-bottom">{formatTime(snap.timestamp)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="viewer-code-area">
                    {!(snapshotContent?.startsWith('base64:')) && (
                      <div className="line-numbers">
                        {(snapshotContent || '').split('\n').map((_, i) => (
                          <div key={i}>{i + 1}</div>
                        ))}
                      </div>
                    )}
                    <div className="code-content" style={snapshotContent?.startsWith('base64:') ? { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' } : {}}>
                      {isLoading ? 'Cargando contenido...' : 
                        (snapshotContent?.startsWith('base64:') 
                          ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                              <History size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                              <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Snapshot Binario</h3>
                              <p style={{ fontSize: '13px', maxWidth: '350px' }}>
                                Esta versión se respaldó en formato Base64. No se puede previsualizar como texto plano. Restaura la versión para abrir el archivo en su programa original.
                              </p>
                            </div>
                          )
                          : snapshotContent || '(Archivo vacío)'
                        )
                      }
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && (
        <div className="modal-overlay fade-in" onClick={() => setShowRestoreModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar Restauración</h2>
              <button className="btn-close" onClick={() => setShowRestoreModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <p>¿Estás seguro de que deseas rescatar la versión del <strong>{formatDate(selectedSnapshot?.timestamp)} a las {formatTime(selectedSnapshot?.timestamp)}</strong> del archivo <strong>{selectedFile}</strong>?</p>
              <p style={{ marginTop: '12px', fontSize: '0.9em', color: 'var(--text-muted)' }}>
                No se sobrescribirá el archivo actual. Se creará un nuevo archivo con el formato Nombre_REST_FechaHora.
              </p>
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                onClick={() => setShowRestoreModal(false)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmRestore}
                style={{ padding: '8px 16px', background: 'var(--accent-primary)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <RotateCcw size={16} /> Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay fade-in" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar Eliminación</h2>
              <button className="btn-close" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <p>¿Estás seguro de que deseas <strong>borrar definitivamente</strong> el registro de la versión del <strong>{formatDate(selectedSnapshot?.timestamp)} a las {formatTime(selectedSnapshot?.timestamp)}</strong> del archivo <strong>{selectedFile}</strong>?</p>
              <p style={{ marginTop: '12px', fontSize: '0.9em', color: '#ef4444' }}>
                Esta acción lo eliminará de la bóveda permanentemente y no se podrá recuperar.
              </p>
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                onClick={() => setShowDeleteModal(false)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                style={{ padding: '8px 16px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Trash2 size={16} /> Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Toast Notification */}
      {toastMessage && (
        <div className="slide-up" style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', borderLeft: '4px solid var(--accent-primary)', border: '1px solid var(--border-color)', borderLeftWidth: '4px', borderLeftColor: 'var(--accent-primary)', color: 'white', zIndex: 9999 }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default Vault;
