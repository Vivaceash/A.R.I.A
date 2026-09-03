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
        <div className="sidebar-logo-wrapper">
          <img src={logoImage} alt="ARIA Logo" className="logo-icon" />
        </div>
        <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle Menu">
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

        {/* Sección Unificada: Módulos y Servicios */}
        {(hasAccess('finanzas') || hasAccess('amenazas') || modules.length > 0) && (
          <>
            <div className="nav-divider"></div>
            <div className="nav-section-title">MÓDULOS & SERVICIOS</div>
          </>
        )}

        {/* Módulo Unificado: Finanzas */}
        {(hasAccess('finanzas') || modules.some(m => m.toLowerCase() === 'finanzas')) && (
          <div className="module-group">
            <div 
              className={`nav-item module-item ${location.pathname.startsWith('/finanzas') || activeModule?.toLowerCase() === 'finanzas' ? 'active' : ''}`} 
              onClick={() => {
                if (!location.pathname.startsWith('/finanzas') && activeModule?.toLowerCase() !== 'finanzas') {
                  navigate('/finanzas/dashboard');
                }
              }}
            >
              <CircleDollarSign />
              Finanzas
            </div>
            {(location.pathname.startsWith('/finanzas') || activeModule?.toLowerCase() === 'finanzas') && (
              <div className="module-submenu">
                <NavLink to="/finanzas/dashboard" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Dashboard Financiero
                </NavLink>
                <NavLink to="/finanzas/movimientos" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Movimientos
                </NavLink>
                <NavLink to="/modulo/finanzas/archivos" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Archivos
                </NavLink>
                <NavLink to="/modulo/finanzas/comparaciones" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Comparaciones
                </NavLink>
                <NavLink to="/modulo/finanzas/alertas" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Alertas
                </NavLink>
                <NavLink to="/modulo/finanzas/reportes" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Reportes
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* Módulo Unificado: Ciberseguridad */}
        {(hasAccess('amenazas') || modules.some(m => m.toLowerCase() === 'ciberseguridad')) && (
          <div className="module-group">
            <div 
              className={`nav-item module-item ${location.pathname.startsWith('/ciberseguridad') || activeModule?.toLowerCase() === 'ciberseguridad' ? 'active' : ''}`} 
              onClick={() => {
                if (!location.pathname.startsWith('/ciberseguridad') && activeModule?.toLowerCase() !== 'ciberseguridad') {
                  navigate('/ciberseguridad');
                }
              }}
            >
              <Shield />
              Ciberseguridad
            </div>
            {(location.pathname.startsWith('/ciberseguridad') || activeModule?.toLowerCase() === 'ciberseguridad') && (
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
                <NavLink to="/modulo/ciberseguridad/archivos" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Archivos
                </NavLink>
                <NavLink to="/modulo/ciberseguridad/alertas" className={({ isActive }) => isActive ? "nav-subitem active" : "nav-subitem"} onClick={() => setIsOpen(false)}>
                  Alertas
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* Otras Áreas Monitoreadas (excluyendo Finanzas y Ciberseguridad para evitar duplicados) */}
        {modules
          .filter(mod => mod.toLowerCase() !== 'finanzas' && mod.toLowerCase() !== 'ciberseguridad')
          .map(mod => {
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
        
        <div className="sidebar-storage-widget">
          <div className="storage-widget-header">Almacenamiento</div>
          <div className="storage-ring-box">
            <div className="storage-ring-wrapper">
              <svg className="storage-ring-svg" viewBox="0 0 36 36">
                <path
                  className="storage-ring-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="storage-ring-progress"
                  strokeDasharray="68, 100"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.8" className="storage-ring-text">68%</text>
              </svg>
            </div>
            <div className="storage-widget-details">
              <span className="storage-used-text">340 GB de 500 GB usados</span>
              <button className="storage-manage-link" onClick={() => navigate('/archivos')}>
                Gestionar almacenamiento →
              </button>
            </div>
          </div>
        </div>

        <div className="nav-divider" style={{ marginTop: 'auto' }}></div>
        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar">
            {user?.username ? user.username.substring(0, 2).toUpperCase() : 'AR'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" title={user?.username}>{user?.username || 'Operador'}</div>
            <div className="sidebar-user-dept">{user?.department || 'Sistemas'}</div>
          </div>
        </div>
        <button 
          onClick={logout}
          className="sidebar-logout-btn"
        >
          Cerrar Sesión
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;
