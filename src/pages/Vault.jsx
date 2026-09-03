import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, Archive, FileText, History, RotateCcw, AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Vault.css';

function Vault({ isEmbedded = false }) {
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

  return (
    <div className="vault-container fade-in" style={isEmbedded ? { marginTop: '16px' } : {}}>
      {!isEmbedded && (
        <div className="vault-header">
          <Archive size={32} />
          <h1>Bóveda de Recuperación (Vault)</h1>
        </div>
      )}
      
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '13.5px' }}>
        Las versiones de los archivos modificados se respaldan aquí. El sistema mantiene un historial automático de 7 días, purgando las capturas más antiguas.
      </p>

      <div className="vault-grid">
        <div className="vault-sidebar">
          <div className="vault-sidebar-header">
            Archivos con Historial ({Object.keys(files).length})
          </div>
          <div className="vault-file-list">
            {Object.keys(files).length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No hay archivos en la bóveda.
              </div>
            )}
            {Object.entries(files).map(([filename, snaps]) => (
              <div 
                key={filename}
                className={`vault-file-item ${selectedFile === filename ? 'active' : ''}`}
                onClick={() => {
                  setSelectedFile(filename);
                  handleSelectSnapshot(snaps[0]); // Auto-select latest
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} style={{ color: 'var(--accent-primary)' }} />
                  <span className="file-name">{filename}</span>
                </div>
                <span className="file-versions-count">{snaps.length} versión(es) guardada(s)</span>
              </div>
            ))}
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
            <div className="snapshot-viewer">
              <div className="timeline-container">
                {files[selectedFile]?.map(snap => (
                  <div 
                    key={snap.id} 
                    className={`timeline-item ${selectedSnapshot?.id === snap.id ? 'active' : ''}`}
                    onClick={() => handleSelectSnapshot(snap)}
                  >
                    <span className="timeline-date">{formatDate(snap.timestamp)}</span>
                    <span className="timeline-time">{formatTime(snap.timestamp)}</span>
                  </div>
                ))}
              </div>
              
              {selectedSnapshot && (
                <>
                  <div className="snapshot-header">
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>Viendo versión del {formatDate(selectedSnapshot.timestamp)} a las {formatTime(selectedSnapshot.timestamp)}</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} color="#F59E0B" /> Snapshot de solo lectura
                      </span>
                    </div>
                    {(user?.role === 'Administrador' || user?.department === 'Ciberseguridad') && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-restore" onClick={handleRestoreClick}>
                          <RotateCcw size={18} />
                          Restaurar Versión
                        </button>
                        <button 
                          className="btn-restore" 
                          onClick={handleDeleteClick}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        >
                          <Trash2 size={18} />
                          Borrar Registro
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="snapshot-body">
                    {isLoading ? 'Cargando contenido...' : snapshotContent || '(Archivo vacío)'}
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
