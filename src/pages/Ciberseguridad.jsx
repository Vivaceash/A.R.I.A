import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header';
import { ShieldAlert, ShieldCheck, Search, Activity, Lock, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Trash2, Zap, Download } from 'lucide-react';
import './Ciberseguridad.css';

function Ciberseguridad() {
  const { module } = useParams();
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchSecurityAlerts = async () => {
    try {
      const response = await fetch(`/api/reports?module=${module || 'general'}`);
      if (!response.ok) throw new Error('Error al conectar con la API');
      const data = await response.json();
      
      // Filter for Security Risks
      const secAlerts = data.filter(a => a.type === 'Riesgo de Seguridad');
      setSecurityAlerts(secAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityAlerts();
    
    let ws;
    let reconnectTimeout;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.alert && message.alert.severity === 'Crítico' || message.alert?.type === 'Riesgo de Seguridad') {
            fetchSecurityAlerts();
          }
        } catch (e) {
          // ignore
        }
      };

      ws.onclose = () => reconnectTimeout = setTimeout(connect, 3000);
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [module]);

  const resolveAlert = async (id) => {
    setResolvingId(id);
    setTimeout(async () => {
      try {
        await fetch(`/api/alertas/${id}/resolve`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: 'Administrador de Seguridad' })
        });
        
        // Find filename to delete
        const alert = securityAlerts.find(a => a.id === id);
        if (alert) {
          const filename = alert.filePath?.split('\\').pop()?.split('/').pop() || alert.title.replace('¡Amenaza Detectada!: ', '').replace('Riesgo Detectado: ', '');
          if (filename) {
            try {
              await fetch(`/api/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            } catch(e) { console.error('Error deleting file', e); }
          }
        }

        setResolvingId(null);
        setSecurityAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true, resolvedBy: 'Administrador de Seguridad', resolvedAt: new Date().toISOString() } : a));
      } catch (error) {
        console.error('Error resolving alert:', error);
        setResolvingId(null);
      }
    }, 600);
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const response = await fetch('/api/security/scan', { method: 'POST' });
      const data = await response.json();
      // El WebSocket actualizará la UI, pero podemos forzar un refresh por si acaso
      fetchSecurityAlerts();
      if (data.status === 'success') {
        showToast(data.message);
      }
    } catch (error) {
      console.error('Error in scan:', error);
      showToast('Error al iniciar el escaneo.');
    } finally {
      setIsScanning(false);
    }
  };

  const activeThreats = securityAlerts.filter(a => !a.resolved);
  const resolvedThreats = securityAlerts.filter(a => a.resolved);

  const filteredActiveAlerts = activeThreats.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredResolvedAlerts = resolvedThreats.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Header title={module ? `Ciberseguridad: ${module.charAt(0).toUpperCase() + module.slice(1)}` : "Ciberseguridad Global"} showTimeframe={false} />
      
      <div className="ciber-page-container">
        {/* Status Dashboard */}
        <div className="ciber-dashboard">
          <div className="ciber-status-card glass-panel">
            <div className="status-icon-wrapper pulse-animation">
               {activeThreats.length > 0 ? <ShieldAlert size={48} color="#EF4444" /> : <ShieldCheck size={48} color="#10B981" />}
            </div>
            <div className="status-info">
              <h3>Estado del Motor de Análisis</h3>
              <p className={activeThreats.length > 0 ? "text-danger" : "text-safe"}>
                {activeThreats.length > 0 ? `${activeThreats.length} Amenazas Activas` : 'Sistema Seguro y Protegido'}
              </p>
            </div>
          </div>
          
          <div className="ciber-metrics">
            <div className="metric-box glass-panel">
              <Activity size={24} color="#3B82F6" />
              <div className="metric-data">
                <h4>Monitoreo Activo</h4>
                <span>YARA & Hashes SHA-256</span>
              </div>
            </div>
            <div className="metric-box glass-panel">
              <Lock size={24} color="#8B5CF6" />
              <div className="metric-data">
                <h4>Protección de Datos</h4>
                <span>Prevención de Fugas Activa</span>
              </div>
            </div>
            
            <div className="security-controls-panel">
              <button className="btn-action btn-scan" onClick={handleScan} disabled={isScanning}>
                <Zap size={20} />
                <span>{isScanning ? 'Escaneando...' : 'Escanear Sistema'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="alertas-header" style={{ marginTop: '32px' }}>
          <div className="alertas-stats">
            <h2>{activeThreats.length}</h2>
            <p>Amenazas Pendientes</p>
          </div>
          <div className="alertas-search">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar en incidentes..." 
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Analizando base de datos de firmas...</div>
        ) : filteredActiveAlerts.length === 0 ? (
          <div className="empty-state inbox-zero">
            <ShieldCheck size={64} className="inbox-zero-icon" color="#10B981" />
            <h3>Entorno Limpio</h3>
            <p>No hay amenazas activas que requieran resolución.</p>
          </div>
        ) : (
          <div className="alertas-list">
            {filteredActiveAlerts.map(alert => (
              <div key={alert.id} className={`alerta-card threat-card severity-${alert.severity.toLowerCase()} ${resolvingId === alert.id ? 'resolving-green' : ''}`}>
                <div className="alerta-card-icon">
                  <AlertTriangle size={24} color={alert.severity === 'Crítico' ? '#EF4444' : '#F59E0B'} />
                </div>
                
                <div className="alerta-card-body">
                  <div className="alerta-card-header">
                    <h4>{alert.title}</h4>
                    <span className="alerta-card-time">{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="alerta-card-desc">{alert.description}</p>
                  <div className="threat-metadata">
                    <span className="metadata-item">Archivo: <code>{alert.filePath?.split('\\').pop()?.split('/').pop() || 'Desconocido'}</code></span>
                    <span className="metadata-item">Propietario: {alert.owner}</span>
                  </div>
                </div>
                
                <div className="alerta-card-actions">
                  <button className="resolve-btn" onClick={() => resolveAlert(alert.id)} disabled={resolvingId === alert.id}>
                    <CheckCircle size={18} />
                    <span>{resolvingId === alert.id ? 'Neutralizando...' : 'Neutralizar / Resolver'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {resolvedThreats.length > 0 && (
          <div className="resolved-section" style={{ marginTop: '32px' }}>
            <button 
              className="resolved-toggle-btn" 
              onClick={() => setShowResolved(!showResolved)}
            >
              <span>Ver amenazas neutralizadas ({resolvedThreats.length})</span>
              {showResolved ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {showResolved && (
              <div className="resolved-list fade-in">
                {filteredResolvedAlerts.map(alert => (
                  <div key={alert.id} className="alerta-card resolved-card threat-card">
                    <div className="alerta-card-icon">
                      <ShieldCheck size={24} color="#10B981" />
                    </div>
                    <div className="alerta-card-body">
                      <div className="alerta-card-header">
                        <h4>{alert.title}</h4>
                        <span className="alerta-card-time">{new Date(alert.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="alerta-card-desc">{alert.description}</p>
                      <div className="resolved-by-info">
                        Neutralizado por <strong>{alert.resolvedBy || 'Desconocido'}</strong> el {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : ''}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredResolvedAlerts.length === 0 && (
                  <p className="no-alerts-msg">Ninguna amenaza neutralizada coincide con tu búsqueda.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {toastMessage && (
        <div className="slide-up" style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--accent-primary)', color: 'white', zIndex: 9999, maxWidth: '400px' }}>
          {toastMessage}
        </div>
      )}
    </>
  );
}

export default Ciberseguridad;
