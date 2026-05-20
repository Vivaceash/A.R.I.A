import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ArrowLeftRight,
  Bell,
  ClipboardList,
  Settings,
  Users,
  Menu,
  X
} from 'lucide-react';
import logoImage from '../logo.png';
import './Sidebar.css';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);

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
        <NavLink to="/" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} end onClick={() => setIsOpen(false)}>
          <LayoutDashboard />
          Dashboard
        </NavLink>
        <NavLink to="/archivos" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
          <FileText />
          Archivos
        </NavLink>
        <a href="#" className="nav-item">
          <ArrowLeftRight />
          Comparaciones
        </a>
        <NavLink to="/alertas" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
          <Bell />
          Alertas
        </NavLink>
        <NavLink to="/reportes" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} onClick={() => setIsOpen(false)}>
          <ClipboardList />
          Reportes
        </NavLink>

        <div className="nav-divider"></div>

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
