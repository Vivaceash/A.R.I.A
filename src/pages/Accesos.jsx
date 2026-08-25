import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Users, ShieldAlert, Globe, Activity, AlertTriangle, Shield, Monitor, UserPlus, Edit2, Trash2, Eye } from 'lucide-react';
import './Accesos.css';

function Accesos() {
  const [activeTab, setActiveTab] = useState('monitoreo'); // 'monitoreo' or 'directorio'
  
  // States for Monitoreo
  const [sessions, setSessions] = useState([]);
  const [anomaliesData, setAnomaliesData] = useState([]);
  const [revokingId, setRevokingId] = useState(null);

  // States for Directorio (Users)
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form state
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Operativo');
  const [department, setDepartment] = useState('Finanzas');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);
  const fetchRef = React.useRef(null);

  const fetchIAMData = async () => {
    try {
      const [sessRes, anomRes, usersRes] = await Promise.all([
        fetch('/api/iam/sessions'),
        fetch('/api/iam/anomalies'),
        fetch('/api/users')
      ]);
      if (sessRes.ok) setSessions(await sessRes.json());
      if (anomRes.ok) setAnomaliesData(await anomRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (e) {
      console.error("Error fetching IAM data", e);
    }
  };

  useEffect(() => {
    fetchRef.current = fetchIAMData;
  }, [sessions, anomaliesData, users]); // fetchIAMData doesn't depend on much but let's keep it updated just in case

  useEffect(() => {
    fetchIAMData();

    let ws;
    let reconnectTimeout;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (['modified', 'deleted', 'created', 'resolved'].includes(message.type)) {
            fetchRef.current?.();
          }
        } catch (e) {
          // ignore
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // --- Handlers for Monitoreo ---
  const handleRevoke = async (id) => {
    setRevokingId(id);
    try {
      const response = await fetch(`/api/iam/sessions/${id}/revoke`, { method: 'POST' });
      if (response.ok) {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, status: "revoked" } : s));
      }
    } catch (e) {
      console.error("Error revoking session", e);
    } finally {
      setRevokingId(null);
    }
  };

  // --- Handlers for Directorio ---
  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUsername(user.username);
      setRole(user.role);
      setDepartment(user.department || 'Finanzas');
      setPassword('');
    } else {
      setEditingUser(null);
      setUsername('');
      setRole('Operativo');
      setDepartment('Finanzas');
      setPassword('');
    }
    setError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('El nombre de usuario es requerido');
      return;
    }
    if (!editingUser && !password.trim()) {
      setError('La contraseña es requerida para usuarios nuevos');
      return;
    }

    const payload = { username, role, department, password };
    const method = editingUser ? 'PUT' : 'POST';
    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (response.ok) {
        await fetchIAMData();
        handleCloseModal();
      } else {
        setError(data.detail || 'Ocurrió un error al guardar');
      }
    } catch (e) {
      setError('Error de red al intentar guardar');
    }
  };

  const handleDelete = async (id) => {
    setUserToDelete(id);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const response = await fetch(`/api/users/${userToDelete}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchIAMData();
      }
    } catch (e) {
      console.error("Error deleting user", e);
    } finally {
      setUserToDelete(null);
    }
  };

  const formatRoleClass = (r) => {
    return r.toLowerCase().replace(/ /g, '-');
  };

  // --- Compute Metrics ---
  const usersCount = users.length;
  const adminsCount = users.filter(u => u.role === 'Administrador').length;
  const opsCount = users.filter(u => u.role === 'Operativo').length;
  const guestsCount = users.filter(u => u.role === 'Invitado').length;

  return (
    <>
      <Header title="Identidad y Accesos (IAM)" showTimeframe={false} />
      
      <div className="accesos-page-container">
        
        {/* Global Metrics */}
        <div className="accesos-dashboard">
          <div className="access-metric-card">
            <div className="access-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
              <Users size={24} />
            </div>
            <div className="access-metric-info">
              <h4>Usuarios Registrados</h4>
              <p className="value">{usersCount}</p>
            </div>
          </div>
          
          <div className="access-metric-card">
            <div className="access-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
              <Shield size={24} />
            </div>
            <div className="access-metric-info">
              <h4>Administradores</h4>
              <p className="value">{adminsCount}</p>
            </div>
          </div>
          
          <div className="access-metric-card">
            <div className="access-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
              <Activity size={24} />
            </div>
            <div className="access-metric-info">
              <h4>Operativos</h4>
              <p className="value">{opsCount}</p>
            </div>
          </div>

          <div className="access-metric-card">
            <div className="access-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
              <Eye size={24} />
            </div>
            <div className="access-metric-info">
              <h4>Invitados</h4>
              <p className="value">{guestsCount}</p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="iam-tabs">
          <button 
            className={`iam-tab ${activeTab === 'monitoreo' ? 'active' : ''}`}
            onClick={() => setActiveTab('monitoreo')}
          >
            <Activity size={18} /> Monitoreo de Conexiones
          </button>
          <button 
            className={`iam-tab ${activeTab === 'directorio' ? 'active' : ''}`}
            onClick={() => setActiveTab('directorio')}
          >
            <Users size={18} /> Directorio de Usuarios
          </button>
        </div>

        {/* Tab Content: Monitoreo */}
        {activeTab === 'monitoreo' && (
          <div className="accesos-main-layout fade-in">
            <div className="sessions-card">
              <div className="sessions-header">
                <h3>Sesiones Activas y Recientes</h3>
              </div>
              
              <div className="table-responsive">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Ubicación e IP</th>
                      <th>Tiempo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(session => (
                      <tr key={session.id} className={session.status === 'revoked' ? 'row-revoked' : ''}>
                        <td>
                          <div className="user-info-cell">
                            <div className="user-avatar">{session.name.substring(0, 2).toUpperCase()}</div>
                            <div className="user-details">
                              <span className="user-name">{session.name}</span>
                              <span className="user-role">{session.role}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="location-cell">
                            <span className="location-country">
                              <span>{session.flag}</span> {session.country}
                            </span>
                            <span className="location-ip">{session.ip}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            <Monitor size={14} />
                            {session.time}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge-inline status-${session.status}`}>
                            {session.status === 'active' && <span className="pulse-dot"></span>}
                            {session.status === 'active' ? 'Conectado' : 'Revocada'}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn-revoke" 
                            disabled={session.status === 'revoked' || revokingId === session.id}
                            onClick={() => handleRevoke(session.id)}
                          >
                            {revokingId === session.id ? 'Revocando...' : (session.status === 'revoked' ? 'Bloqueado' : 'Revocar')}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                          No hay sesiones registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="anomalies-card">
              <div className="anomalies-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={20} color="#EF4444" />
                  <h3>Registro de Anomalías</h3>
                </div>
                <p>Eventos sospechosos detectados por el sistema.</p>
              </div>

              <div className="anomalies-list">
                {anomaliesData.map(anomaly => (
                  <div key={anomaly.id} className="anomaly-item">
                    <div className="anomaly-icon">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="anomaly-content">
                      <h4>{anomaly.title}</h4>
                      <p>{anomaly.desc}</p>
                      <div className="anomaly-time">{anomaly.time}</div>
                    </div>
                  </div>
                ))}
                {anomaliesData.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No hay anomalías registradas.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Directorio */}
        {activeTab === 'directorio' && (
          <div className="fade-in">
            <div className="directorio-card">
              <div className="sessions-header">
                <h3>Gestión de Usuarios</h3>
                <button className="btn-primary" onClick={() => handleOpenModal()}>
                  <UserPlus size={18} />
                  Nuevo Usuario
                </button>
              </div>
              
              <div className="table-responsive">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre de Usuario</th>
                      <th>Rol</th>
                      <th>Departamento</th>
                      <th>Fecha de Creación</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id}>
                        <td style={{ color: 'var(--text-secondary)' }}>#{user.id}</td>
                        <td style={{ fontWeight: 500 }}>{user.username}</td>
                        <td>
                          <span className={`user-role-badge role-${formatRoleClass(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {user.department}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn-icon edit" title="Editar" onClick={() => handleOpenModal(user)}>
                              <Edit2 size={18} />
                            </button>
                            <button className="btn-icon delete" title="Eliminar" onClick={() => handleDelete(user.id)}>
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                          <Users size={48} style={{ color: 'var(--text-secondary)', opacity: 0.5, marginBottom: '16px' }} />
                          <p style={{ color: 'var(--text-secondary)' }}>No hay usuarios registrados</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            
            {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre de Usuario</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  placeholder="Ej. Juan P."
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Rol del Sistema</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="Administrador">Administrador (Control Total)</option>
                  <option value="Operativo">Operativo (Modificar Archivos)</option>
                  <option value="Invitado">Invitado (Solo Lectura)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Departamento</label>
                <select value={department} onChange={e => setDepartment(e.target.value)}>
                  <option value="Dirección">Dirección (General)</option>
                  <option value="Finanzas">Finanzas</option>
                  <option value="Ciberseguridad">Ciberseguridad</option>
                  <option value="Operaciones">Operaciones</option>
                  <option value="Recursos Humanos">Recursos Humanos</option>
                  <option value="TI">TI (Tecnología de la Información)</option>
                </select>
              </div>
              <div className="form-group">
                <label>{editingUser ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña Inicial'}</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••"
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="modal-overlay" onClick={() => setUserToDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Trash2 size={20} color="#EF4444" /> Eliminar Usuario</h3>
            <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>¿Estás seguro de eliminar este usuario? Sus sesiones activas serán revocadas inmediatamente.</p>
            <p style={{ color: '#EF4444', fontSize: '13px', margin: '0 0 20px' }}>Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setUserToDelete(null)}>Cancelar</button>
              <button type="button" className="btn-primary" style={{ background: '#EF4444', borderColor: '#EF4444' }} onClick={confirmDeleteUser}>Sí, Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Accesos;
