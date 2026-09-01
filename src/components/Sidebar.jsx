import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Folder,
  MessageCircle,
  Brain,
  ArrowLeftRight,
  Bell,
  FileText,
  DollarSign,
  Shield,
  Database,
  Users,
  Settings,
  FolderOpen,
  Menu,
  X
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
          <LayoutGrid strokeWidth={1.5} />
          <span className="nav-text">Dashboard Global</span>
        </NavLink>
        
        {hasAccess('archivos') && (
          <>
            <NavLink to="/archivos" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <Folder strokeWidth={1.5} />
          <span className="nav-text">Archivos Globales</span>
        </NavLink>
            <NavLink to="/chat" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <MessageCircle strokeWidth={1.5} />
          <span className="nav-text">Chat Global IA</span>
        </NavLink>
            <NavLink to="/conocimiento" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <Brain strokeWidth={1.5} />
          <span className="nav-text">Base de Conocimiento</span>
        </NavLink>
            <NavLink to="/comparaciones" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <ArrowLeftRight strokeWidth={1.5} />
          <span className="nav-text">Comparaciones Globales</span>
        </NavLink>
            <NavLink to="/reportes" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
              <FileText strokeWidth={1.5} />
          <span className="nav-text">Reportes Globales</span>
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
              <DollarSign strokeWidth={1.5} />
              <span className="nav-text">Finanzas</span>
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
              <Shield strokeWidth={1.5} />
              <span className="nav-text">Ciberseguridad</span>
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
              <Database strokeWidth={1.5} />
              <span className="nav-text">Bóveda (Vault)</span>
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
                    <Folder strokeWidth={1.5} />
                    <span className="nav-text">{mod.charAt(0).toUpperCase() + mod.slice(1)}</span>
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
            <div className="module-group">
              <div 
                className={`nav-item module-item ${location.pathname.startsWith('/accesos') ? 'active' : ''}`} 
                onClick={() => {
                  if (!location.pathname.startsWith('/accesos')) {
                    navigate('/accesos');
                  }
                }}
              >
                <Users strokeWidth={1.5} />
                <span className="nav-text">Identidad y Accesos (IAM)</span>
              </div>
              {location.pathname.startsWith('/accesos') && (
                <div className="module-submenu">
                  <NavLink to="/accesos" className={({ isActive }) => isActive && location.pathname === '/accesos' ? "nav-subitem active" : "nav-subitem"} end onClick={() => setIsOpen(false)}>
                    Gestión de Accesos
                  </NavLink>
                  <NavLink to="/accesos/actividad" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                    Actividad de Usuarios
                  </NavLink>
                </div>
              )}
            </div>
          </>
        )}
        
        <div className="nav-divider" style={{ marginTop: 'auto' }}></div>
      </nav>
    </aside>
  );
};

export default Sidebar;

