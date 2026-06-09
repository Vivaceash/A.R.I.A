import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  ArrowLeftRight,
  Bell,
  ClipboardList,
  Settings,
  Users,
  Menu,
  X,
  FolderOpen
} from 'lucide-react';
import logoImage from '../logo.png';
import './Sidebar.css';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [modules, setModules] = useState([]);
  const location = useLocation();
  
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
          Dashboard Ejecutivo
        </NavLink>
        <NavLink to="/archivos" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
          <FileText />
          Archivos Globales
        </NavLink>
        <NavLink to="/chat" className={({ isActive }) => isActive && !activeModule ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
          <MessageSquare />
          Chat Global
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

        <div className="nav-divider"></div>
        <div className="nav-section-title">SISTEMA</div>

        <a href="#" className="nav-item">
          <Settings />
          Configuración
        </a>
        <a href="#" className="nav-item">
          <Users />
          Usuarios
        </a>
      </nav>
    </aside>
  );
};

export default Sidebar;
