import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { AlertTriangle, Info, CheckCircle, Search } from 'lucide-react';
import './Alertas.css';

import { ChevronDown, ChevronUp } from 'lucide-react';

function Alertas() {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [resolvedAlerts, setResolvedAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  const [showResolved, setShowResolved] = useState(false);

  const fetchAlerts = async () => {
    try {
      // Re-use the existing endpoint but parse out unresolved alerts
      const response = await fetch(`http://${window.location.hostname}:8000/api/reports`);
      if (!response.ok) throw new Error('Error al conectar con la API');
      const data = await response.json();
      
      // Keep only unresolved alerts with severity Alto or Medio
      const actionable = data.filter(a => !a.resolved && (a.severity === 'Alto' || a.severity === 'Medio'));
      const resolved = data.filter(a => a.resolved && (a.severity === 'Alto' || a.severity === 'Medio'));
      setActiveAlerts(actionable);
      setResolvedAlerts(resolved);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    
    // Listen for real-time alerts
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/api/ws`);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'modified' || message.type === 'deleted' || message.type === 'created' || message.type === 'resolved') {
          fetchAlerts();
        }
      } catch (e) {
        // ignore
      }
    };
    return () => ws.close();
  }, []);

  const resolveAlert = async (id) => {
    setResolvingId(id);
    
    // Wait for the green pulse animation
    setTimeout(async () => {
      try {
        await fetch(`http://${window.location.hostname}:8000/api/alertas/${id}/resolve`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: 'Administrador Local' })
        });
        // fetchAlerts will be triggered via WebSocket, but we do optimistic update here too just in case
        setResolvingId(null);
        setActiveAlerts(prev => prev.filter(a => a.id !== id));
      } catch (error) {
        console.error('Error resolving alert:', error);
        setResolvingId(null);
      }
    }, 600); // match CSS animation duration
  };

  const filteredActiveAlerts = activeAlerts.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredResolvedAlerts = resolvedAlerts.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Header title="Centro de Alertas" showTimeframe={false} />
      
      <div className="alertas-page-container">
        <div className="alertas-header">
          <div className="alertas-stats">
            <h2>{activeAlerts.length}</h2>
            <p>Alertas activas</p>
          </div>
          <div className="alertas-search">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar en alertas..." 
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Cargando alertas activas...</div>
        ) : filteredActiveAlerts.length === 0 ? (
          <div className="empty-state inbox-zero">
            <CheckCircle size={64} className="inbox-zero-icon" />
            <h3>Bandeja Limpia</h3>
            <p>No hay alertas activas de severidad media o alta que requieran tu atención.</p>
          </div>
        ) : (
          <div className="alertas-list">
            {filteredActiveAlerts.map(alert => (
              <div key={alert.id} className={`alerta-card severity-${alert.severity.toLowerCase()} ${resolvingId === alert.id ? 'resolving-green' : ''}`}>
                <div className="alerta-card-icon">
                  {alert.severity === 'Alto' ? <AlertTriangle size={24} /> : <Info size={24} />}
                </div>
                
                <div className="alerta-card-body">
                  <div className="alerta-card-header">
                    <h4>{alert.title}</h4>
                    <span className="alerta-card-time">{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="alerta-card-desc">{alert.description}</p>
                  <span className={`alerta-card-badge badge-${alert.severity.toLowerCase()}`}>Riesgo {alert.severity}</span>
                </div>
                
                <div className="alerta-card-actions">
                  <button className="resolve-btn" onClick={() => resolveAlert(alert.id)} disabled={resolvingId === alert.id}>
                    <CheckCircle size={18} />
                    <span>{resolvingId === alert.id ? 'Resolviendo...' : 'Marcar Resuelto'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {resolvedAlerts.length > 0 && (
          <div className="resolved-section">
            <button 
              className="resolved-toggle-btn" 
              onClick={() => setShowResolved(!showResolved)}
            >
              <span>Ver alertas resueltas ({resolvedAlerts.length})</span>
              {showResolved ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {showResolved && (
              <div className="resolved-list fade-in">
                {filteredResolvedAlerts.map(alert => (
                  <div key={alert.id} className="alerta-card resolved-card">
                    <div className="alerta-card-icon">
                      <CheckCircle size={24} />
                    </div>
                    <div className="alerta-card-body">
                      <div className="alerta-card-header">
                        <h4>{alert.title}</h4>
                        <span className="alerta-card-time">{new Date(alert.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="alerta-card-desc">{alert.description}</p>
                      <div className="resolved-by-info">
                        Resuelto por <strong>{alert.resolvedBy || 'Desconocido'}</strong> el {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : ''}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredResolvedAlerts.length === 0 && (
                  <p className="no-alerts-msg">Ninguna alerta resuelta coincide con tu búsqueda.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default Alertas;
