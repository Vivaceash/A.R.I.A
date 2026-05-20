
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Bell, Settings, User, AlertTriangle, Info, ArrowRight, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './Header.css';

const Header = ({ title = "Dashboard", timeframe, setTimeframe, showTimeframe = true }) => {
  const [alerts, setAlerts] = useState([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [lastSeenAlertId, setLastSeenAlertId] = useState(() => localStorage.getItem('lastSeenAlertId') || null);
  const { theme, toggleTheme } = useTheme();
  const alertsRef = useRef(null);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/reports');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.slice(0, 5)); // We only need the latest 5 for the header dropdown
      }
    } catch (e) {
      console.error('Error fetching header alerts:', e);
    }
  };

  useEffect(() => {
    fetchAlerts();
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (['modified', 'deleted', 'created', 'resolved'].includes(message.type)) {
          fetchAlerts();
        }
      } catch (e) {}
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (alertsRef.current && !alertsRef.current.contains(event.target)) {
        setIsAlertsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isAlertsOpen && alerts.length > 0) {
      setLastSeenAlertId(alerts[0].id);
      localStorage.setItem('lastSeenAlertId', alerts[0].id);
    }
  }, [isAlertsOpen, alerts]);

  // Compute unread count
  let unreadCount = 0;
  for (const alert of alerts) {
    if (String(alert.id) === String(lastSeenAlertId)) break;
    unreadCount++;
  }
  if (unreadCount > 5) unreadCount = 5;
  return (
    <header className="header">
      <h1 className="page-title">{title}</h1>
      
      <div className="header-actions">
        {showTimeframe && setTimeframe && (
          <select 
            className="timeframe-select" 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
          >
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </select>
        )}
        
        <button className="icon-btn" onClick={toggleTheme} aria-label="Cambiar tema" style={{ marginRight: '8px' }}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        <div className="header-alerts-container" ref={alertsRef}>
          <button 
            className={`icon-btn alerts-btn ${isAlertsOpen ? 'active' : ''}`} 
            aria-label="Notificaciones"
            onClick={() => setIsAlertsOpen(!isAlertsOpen)}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="alerts-badge">{unreadCount}</span>}
          </button>
          
          {isAlertsOpen && (
            <div className="alerts-dropdown fade-in">
              <div className="alerts-dropdown-header">
                <h3>Notificaciones Recientes</h3>
              </div>
              <div className="alerts-dropdown-body">
                {alerts.length === 0 ? (
                  <p className="no-alerts-msg">No hay alertas recientes.</p>
                ) : (
                  alerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="dropdown-alert-item">
                      <div className="dropdown-alert-icon">
                        {alert.iconClass === 'icon-danger' ? <AlertTriangle size={16} color="#EF4444" /> : <Info size={16} color="#3B82F6" />}
                      </div>
                      <div className="dropdown-alert-content">
                        <h5>{alert.title}</h5>
                        <p>{alert.description && alert.description.length > 80 ? alert.description.split('\n')[0].substring(0, 80) + '...' : alert.description}</p>
                        <span className="dropdown-alert-time">{alert.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="alerts-dropdown-footer">
                <Link to="/alertas" className="view-all-alerts-btn" onClick={() => setIsAlertsOpen(false)}>
                  <span>Ver todas las alertas</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}
        </div>
        
        <button className="icon-btn" aria-label="Configuración">
          <Settings size={20} />
        </button>
        <button className="profile-btn" aria-label="Perfil de usuario">
          <User size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
