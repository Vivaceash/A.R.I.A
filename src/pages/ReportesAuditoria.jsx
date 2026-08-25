import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header';
import { Download, ShieldCheck, Clock, User, Send, FileText } from 'lucide-react';
import './ReportesAuditoria.css';

function ReportesAuditoria() {
  const { module } = useParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [exportedBy, setExportedBy] = useState('');
  const [destination, setDestination] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/security/report/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching export logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleExport = () => {
    if (!exportedBy || !destination) {
      showToast("Por favor, rellena todos los campos antes de exportar.");
      return;
    }
    
    // Construir la URL con parámetros para el registro
    const params = new URLSearchParams({
      user: exportedBy,
      destination: destination
    });
    
    window.location.href = `/api/security/report/csv?${params.toString()}`;
    
    // Refrescar el historial después de unos segundos
    setTimeout(fetchLogs, 1500);
    
    // Limpiar formulario opcionalmente
    setExportedBy('');
    setDestination('');
  };

  return (
    <>
      <Header title="Ciberseguridad: Reportes de Auditoría" showTimeframe={false} />
      
      <div className="reportes-auditoria-container">
        
        <div className="export-panel glass-panel">
          <div className="export-panel-header">
            <ShieldCheck size={32} color="#10B981" />
            <div>
              <h3>Generar Reporte de Incidentes (CSV)</h3>
              <p>Exporta el historial completo de amenazas y riesgos de seguridad. El sistema registrará quién realizó la exportación.</p>
            </div>
          </div>
          
          <div className="export-form">
            <div className="form-group">
              <label>
                <User size={16} /> Quién Exporta
              </label>
              <input 
                type="text" 
                placeholder="Ej. Administrador IT, Juan Pérez" 
                value={exportedBy}
                onChange={(e) => setExportedBy(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label>
                <Send size={16} /> Destino del Reporte
              </label>
              <input 
                type="text" 
                placeholder="Ej. Auditoría Externa, Comité Directivo" 
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            
            <button className="btn-action btn-export-large" onClick={handleExport}>
              <Download size={20} />
              <span>Generar y Descargar CSV</span>
            </button>
          </div>
        </div>

        <div className="logs-panel glass-panel">
          <div className="logs-panel-header">
            <h3>Historial de Exportaciones</h3>
          </div>
          
          {loading ? (
            <div className="loading-state">Cargando historial...</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} color="var(--text-muted)" />
              <p>Aún no se ha exportado ningún reporte de seguridad.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Usuario / Exportado Por</th>
                    <th>Destino</th>
                    <th>Acción / Reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="log-time">
                          <Clock size={14} />
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td><strong>{log.exported_by}</strong></td>
                      <td>{log.destination}</td>
                      <td>{log.report_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="slide-up" style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', borderLeft: '4px solid #F59E0B', color: 'white', zIndex: 9999, maxWidth: '400px' }}>
          {toastMessage}
        </div>
      )}
    </>
  );
}

export default ReportesAuditoria;
