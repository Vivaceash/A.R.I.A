import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  ArrowLeftRight,
  Bell,
  ClipboardList,
  Brain,
  Settings,
  Users,
  Shield,
  CircleDollarSign,
  Archive,
  Menu,
  X,
  FolderOpen
} from 'lucide-react';
import logoImage from '../logo.png';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [modules, setModules] = useState([]);
  const { user, logout, hasAccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const pathParts = location.pathname.split('/');
  const activeModule = pathParts[1] === 'modulo' ? pathParts[2] : null;

  useEffect(() => {
    fetch('/api/modules')
      .then(res => res.json())
      .then(data => setModules(data))
      .catch(err => console.error("Error fetching modules:", err));
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logoImage} alt="ARIA Logo" className="logo-icon" style={{ width: '84px', height: '84px', objectFit: 'contain' }} />
          <span className="logo-text">A.R.I.A</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <nav className={`nav-menu ${isOpen ? 'open' : ''}`}>
        <div className="nav-section-title">VISIÓN GENERAL</div>
        <NavLink to="/" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} end onClick={() => setIsOpen(false)}>
          <LayoutDashboard />
          Dashboard Global
        </NavLink>
        
        {hasAccess('archivos') && (
          <>
            <NavLink to="/archivos" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <FolderOpen />
              Archivos Globales
            </NavLink>
            <NavLink to="/chat" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <MessageSquare />
              Chat Global IA
            </NavLink>
            <NavLink to="/conocimiento" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <Brain />
              Base de Conocimiento
            </NavLink>
            <NavLink to="/comparaciones" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <ArrowLeftRight />
              Comparaciones Globales
            </NavLink>
            <NavLink to="/alertas" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <Bell />
              Alertas Globales
            </NavLink>
            <NavLink to="/reportes" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <ClipboardList />
              Reportes Globales
            </NavLink>
          </>
        )}

        {(hasAccess('finanzas') || hasAccess('amenazas') || hasAccess('boveda')) && (
          <>
            <div className="nav-divider"></div>
            <div className="nav-section-title">MÓDULOS ESPECIALIZADOS</div>
          </>
        )}

        {hasAccess('finanzas') && (
          <div className="module-group">
            <div 
              className={`nav-item module-item ${location.pathname.startsWith('/finanzas') ? 'active' : ''}`} 
              onClick={() => {
                if (!location.pathname.startsWith('/finanzas')) {
                  navigate('/finanzas/dashboard');
                }
              }}
            >
              <CircleDollarSign />
              Finanzas
            </div>
            {location.pathname.startsWith('/finanzas') && (
              <div className="module-submenu">
                <NavLink to="/finanzas/dashboard" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Dashboard Financiero
                </NavLink>
                <NavLink to="/finanzas/movimientos" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Movimientos
                </NavLink>
              </div>
            )}
          </div>
        )}

        {hasAccess('amenazas') && (
          <div className="module-group">
            <div 
              className={`nav-item module-item ${location.pathname.startsWith('/ciberseguridad') ? 'active' : ''}`} 
              onClick={() => {
                if (!location.pathname.startsWith('/ciberseguridad')) {
                  navigate('/ciberseguridad');
                }
              }}
            >
              <Shield />
              Ciberseguridad
            </div>
            {location.pathname.startsWith('/ciberseguridad') && (
              <div className="module-submenu">
                <NavLink to="/ciberseguridad" className={({ isActive }) => isActive && location.pathname === '/ciberseguridad' ? "nav-subitem active" : "nav-subitem"} end onClick={() => setIsOpen(false)}>
                  Resumen Global
                </NavLink>
                <NavLink to="/ciberseguridad/diccionario" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Diccionario de Amenazas
                </NavLink>
                <NavLink to="/ciberseguridad/reportes" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Reportes de Auditoría
                </NavLink>
              </div>
            )}
          </div>
        )}

        {hasAccess('boveda') && (
          <div className="module-group">
            <div 
              className={`nav-item module-item ${location.pathname.startsWith('/boveda') ? 'active' : ''}`} 
              onClick={() => {
                if (!location.pathname.startsWith('/boveda')) {
                  navigate('/boveda');
                }
              }}
            >
              <Archive />
              Bóveda (Vault)
            </div>
            {location.pathname.startsWith('/boveda') && (
              <div className="module-submenu">
                <NavLink to="/boveda" className={({ isActive }) => isActive && location.pathname === '/boveda' ? "nav-subitem active" : "nav-subitem"} end onClick={() => setIsOpen(false)}>
                  Recuperación de Archivos
                </NavLink>
              </div>
            )}
          </div>
        )}

        {modules.length > 0 && (
          <>
            <div className="nav-divider"></div>
            <div className="nav-section-title">MÓDULOS (ÁREAS)</div>
            {modules.map(mod => {
              const isModActive = activeModule === mod;
              return (
                <div key={mod} className="module-group">
                  <NavLink 
                    to={isModActive ? '/' : `/modulo/${mod}/dashboard`} 
                    className={`nav-item module-item ${isModActive ? 'active' : ''}`} 
                    onClick={() => setIsOpen(false)}
                  >
                    <FolderOpen />
                    {mod.charAt(0).toUpperCase() + mod.slice(1)}
                  </NavLink>
                  {isModActive && (
                    <div className="module-submenu">
                      <NavLink to={`/modulo/${mod}/dashboard`} className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} end onClick={() => setIsOpen(false)}>
                        Dashboard
                      </NavLink>
                      <NavLink to={`/modulo/${mod}/archivos`} className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                        Archivos
                      </NavLink>
                      <NavLink to={`/modulo/${mod}/comparaciones`} className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                        Comparaciones
                      </NavLink>
                      <NavLink to={`/modulo/${mod}/alertas`} className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                        Alertas
                      </NavLink>
                      <NavLink to={`/modulo/${mod}/reportes`} className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                        Reportes
                      </NavLink>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {(hasAccess('iam') || user?.role === 'Administrador') && (
          <>
            <div className="nav-divider"></div>
            <div className="nav-section-title">SISTEMA</div>
            <NavLink to="/accesos" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <Users />
              Identidad y Accesos (IAM)
            </NavLink>
            <a href="#" className="nav-item">
              <Settings />
              Configuración
            </a>
          </>
        )}
        
        <div className="nav-divider" style={{ marginTop: 'auto' }}></div>
        <div className="sidebar-user-profile" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white' }}>
            {user?.username ? user.username.substring(0, 2).toUpperCase() : 'AR'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.username}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user?.department}</div>
          </div>
        </div>
        <button 
          onClick={logout}
          style={{ margin: '0 16px 24px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}
        >
          Cerrar Sesión
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;
