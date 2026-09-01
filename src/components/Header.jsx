import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Settings, User, AlertTriangle, Info, ArrowRight, Sun, Moon, LogOut, Users, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

const Header = ({ title = "Dashboard", timeframe, setTimeframe, showTimeframe = true }) => {
  const [alerts, setAlerts] = useState([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [telegramSeverity, setTelegramSeverity] = useState('Alto');
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [chatIds, setChatIds] = useState([]);
  const [newChatId, setNewChatId] = useState('');
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [lastSeenAlertId, setLastSeenAlertId] = useState(() => localStorage.getItem('lastSeenAlertId') || null);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const alertsRef = useRef(null);
  const settingsRef = useRef(null);
  const profileRef = useRef(null);

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
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.telegram_min_severity) {
          setTelegramSeverity(data.telegram_min_severity);
        }
        if (data.telegram_enabled !== undefined) {
          setTelegramEnabled(data.telegram_enabled === 'true');
        }
        if (data.telegram_chat_id) {
          setChatIds(data.telegram_chat_id.split(',').filter(id => id.trim() !== ''));
        }
      })
      .catch(e => console.error('Error fetching settings:', e));
  }, []);

  const handleAddChatId = async () => {
    if (!newChatId.trim()) return;
    const updatedIds = [...new Set([...chatIds, newChatId.trim()])];
    setChatIds(updatedIds);
    setNewChatId('');
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_chat_id: updatedIds.join(',') })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveChatId = async (idToRemove) => {
    const updatedIds = chatIds.filter(id => id !== idToRemove);
    setChatIds(updatedIds);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_chat_id: updatedIds.join(',') })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSeverityChange = async (e) => {
    const val = e.target.value;
    setTelegramSeverity(val);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_min_severity: val })
      });
    } catch (err) {
      console.error('Error updating settings:', err);
    }
  };

  const handleToggleChange = async (e) => {
    const val = e.target.checked;
    setTelegramEnabled(val);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_enabled: val ? 'true' : 'false' })
      });
    } catch (err) {
      console.error('Error updating settings:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    
    let ws = null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (['modified', 'deleted', 'created', 'resolved'].includes(message.type)) {
            fetchAlerts();
          }
        } catch (e) {}
      };
      ws.onerror = () => {};
    } catch (e) {}

    return () => {
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
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (alertsRef.current && !alertsRef.current.contains(event.target)) setIsAlertsOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(event.target)) setIsSettingsOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setIsProfileOpen(false);
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
                <button className="view-all-alerts-btn" onClick={() => { setIsAlertsOpen(false); navigate('/reportes'); }}>
                  <span>MÁS...</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="header-dropdown-container" ref={settingsRef}>
          <button 
            className={`icon-btn ${isSettingsOpen ? 'active' : ''}`} 
            aria-label="Configuración"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          >
            <Settings size={20} />
          </button>
          
          {isSettingsOpen && (
            <div className="alerts-dropdown settings-dropdown fade-in" style={{ width: '320px', right: 0 }}>
              <div className="alerts-dropdown-header">
                <h3>Configuración del Sistema</h3>
              </div>
              <div className="alerts-dropdown-body" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap' }}>Tema de la Interfaz</span>
                  <button 
                    onClick={toggleTheme} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '8px', 
                      padding: '8px 16px', 
                      borderRadius: '8px',
                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    <span style={{ fontSize: '13px' }}>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                  </button>
                </div>
                
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '16px 0' }}></div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>Alertas Telegram</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Activar o desactivar envíos</span>
                  </div>
                  <label className="telegram-switch">
                    <input 
                      type="checkbox" 
                      checked={telegramEnabled} 
                      onChange={handleToggleChange} 
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', opacity: telegramEnabled ? 1 : 0.5, pointerEvents: telegramEnabled ? 'auto' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>Nivel de alertas</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Severidad mínima</span>
                  </div>
                  <select 
                    value={telegramSeverity} 
                    onChange={handleSeverityChange}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    <option value="Crítico">Crítico</option>
                    <option value="Alto">Alto o mayor</option>
                    <option value="Medio">Medio o mayor</option>
                    <option value="Bajo">Todas</option>
                  </select>
                </div>

                <div style={{ marginTop: '16px', opacity: telegramEnabled ? 1 : 0.5, pointerEvents: telegramEnabled ? 'auto' : 'none' }}>
                  <button 
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsTelegramModalOpen(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#3B82F6',
                      cursor: 'pointer',
                      fontWeight: '500',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>👥</span> Gestionar IDs de Telegram
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>

        {isTelegramModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '24px',
              width: '450px',
              maxWidth: '90%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📨</span> Destinatarios de Telegram
                </h3>
                <button 
                  onClick={() => setIsTelegramModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 8px 0' }}>Para obtener el <strong>Chat ID</strong> de un destinatario:</p>
                <ol style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>Pídele que busque <strong>@userinfobot</strong> en Telegram y le dé a Iniciar.</li>
                  <li>El bot le responderá con un número (ej. <code style={{background: 'rgba(0,0,0,0.2)', padding: '2px 4px', borderRadius: '4px'}}>123456789</code>).</li>
                  <li>Copia ese número, pégalo en el recuadro inferior y haz clic en Agregar.</li>
                </ol>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input 
                  type="text" 
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  placeholder="Ej: 123456789"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
                <button 
                  onClick={handleAddChatId}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#3B82F6',
                    color: '#FFF',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#2563EB'}
                  onMouseOut={(e) => e.target.style.background = '#3B82F6'}
                >Agregar</button>
              </div>

              <div>
                <span style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '12px' }}>IDs Registrados ({chatIds.length})</span>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '150px', overflowY: 'auto', padding: '4px' }}>
                  {chatIds.length === 0 && <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No hay usuarios registrados actualmente.</span>}
                  
                  {chatIds.map(id => (
                    <div key={id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      background: 'rgba(59, 130, 246, 0.1)', 
                      border: '1px solid rgba(59, 130, 246, 0.3)', 
                      padding: '6px 12px', 
                      borderRadius: '20px', 
                      fontSize: '13px',
                      color: 'var(--text-primary)'
                    }}>
                      <span style={{ fontFamily: 'monospace' }}>{id}</span>
                      <button 
                        onClick={() => handleRemoveChatId(id)} 
                        title="Eliminar"
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '16px', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.8 }}
                        onMouseOver={(e) => e.target.style.opacity = 1}
                        onMouseOut={(e) => e.target.style.opacity = 0.8}
                      >&times;</button>
                    </div>
                  ))}
                </div>
              </div>
              
            </div>
          </div>
        )}

        <div className="header-dropdown-container" ref={profileRef}>
          <button 
            className={`profile-btn-with-name ${isProfileOpen ? 'active' : ''}`} 
            aria-label="Perfil de usuario"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              background: 'transparent', border: '1px solid var(--border-color)', 
              padding: '6px 12px', borderRadius: '24px', cursor: 'pointer',
              color: 'var(--text-primary)', marginLeft: '8px', transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: '500' }}>{user?.username || 'Usuario'}</span>
            <div style={{ background: 'var(--bg-card-hover)', borderRadius: '50%', padding: '6px', display: 'flex' }}>
              <User size={16} />
            </div>
          </button>
          
          {isProfileOpen && (
            <div className="alerts-dropdown profile-dropdown fade-in" style={{ width: '220px' }}>
              <div className="alerts-dropdown-body" style={{ padding: '8px' }}>
                <button className="profile-dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/accesos'); }}>
                  <Users size={16} />
                  <span>Más (IAM)</span>
                </button>
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }}></div>
                <button className="profile-dropdown-item logout-btn" onClick={logout}>
                  <LogOut size={16} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
