import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { ShieldAlert, Users, Activity, FileText, Clock, AlertTriangle, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import './ActividadUsuarios.css';

const COLORS = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6'];

function ActividadUsuarios() {
  const [data, setData] = useState({ chart_data: [], table_data: [] });
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState("7");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchActivity = async () => {
    try {
      const response = await fetch(`/api/stats/user-activity?days=${daysFilter}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching user activity:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
    // Poll every 30 seconds
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, [daysFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, daysFilter]);

  const filteredTableData = data.table_data.filter(log => 
    log.filename.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalPages = Math.max(1, Math.ceil(filteredTableData.length / itemsPerPage));
  const currentTableData = filteredTableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportCSV = () => {
    if (data.table_data.length === 0) return;
    const headers = ["ID", "Archivo", "Descripción", "Tipo de Evento", "Propietario", "Fecha", "Severidad"];
    const csvContent = [
      headers.join(","),
      ...data.table_data.map(log => 
        `"${log.id}","${log.filename}","${log.description}","${log.event_type}","${log.owner}","${log.timestamp}","${log.severity}"`
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `auditoria_usuarios_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip glass-panel" style={{ padding: '10px', border: '1px solid var(--border-color)' }}>
          <p className="label" style={{ fontWeight: 'bold', marginBottom: '5px' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color, margin: 0, fontSize: '0.9rem' }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Header title="IAM: Actividad y Comportamiento de Usuarios" showTimeframe={false} />
      
      <div className="actividad-container">
        
        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card glass-panel">
            <div className="kpi-icon icon-blue"><Users size={24} /></div>
            <div className="kpi-content">
              <h3>Usuarios Activos</h3>
              <p className="kpi-value">{data.chart_data.length}</p>
              <span className="kpi-trend positive">Registrados en historial</span>
            </div>
          </div>
          <div className="kpi-card glass-panel">
            <div className="kpi-icon icon-green"><Activity size={24} /></div>
            <div className="kpi-content">
              <h3>Total de Eventos</h3>
              <p className="kpi-value">
                {data.chart_data.reduce((acc, curr) => acc + curr.total, 0)}
              </p>
              <span className="kpi-trend">Movimientos totales</span>
            </div>
          </div>
          <div className="kpi-card glass-panel">
            <div className="kpi-icon icon-red"><AlertTriangle size={24} /></div>
            <div className="kpi-content">
              <h3>Usuario Más Activo</h3>
              <p className="kpi-value" style={{ fontSize: '1.2rem' }}>
                {data.chart_data.length > 0 ? data.chart_data[0].name : 'N/A'}
              </p>
              <span className="kpi-trend">Mayor propensión a cambios</span>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          {/* Bar Chart: User Activity */}
          <div className="chart-card glass-panel col-span-2">
            <div className="card-header">
              <h3><Activity size={18} /> Eventos por Usuario</h3>
              <p>Volumen de creaciones, modificaciones y eliminaciones</p>
            </div>
            {loading ? (
              <div className="loading-state">Analizando comportamiento...</div>
            ) : data.chart_data.length === 0 ? (
              <div className="empty-state">No hay datos suficientes</div>
            ) : (
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <BarChart data={data.chart_data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorMod" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60A5FA" stopOpacity={1}/>
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.8}/>
                      </linearGradient>
                      <linearGradient id="colorCre" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34D399" stopOpacity={1}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.8}/>
                      </linearGradient>
                      <linearGradient id="colorEli" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F87171" stopOpacity={1}/>
                        <stop offset="95%" stopColor="#DC2626" stopOpacity={0.8}/>
                      </linearGradient>
                      <linearGradient id="colorOtr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A78BFA" stopOpacity={1}/>
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.8}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" tick={{fill: '#94A3B8'}} />
                    <YAxis stroke="#64748B" tick={{fill: '#94A3B8'}} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Legend wrapperStyle={{ paddingTop: '15px' }} />
                    <Bar dataKey="Modificación" stackId="a" fill="url(#colorMod)" name="Modificaciones" />
                    <Bar dataKey="Creación" stackId="a" fill="url(#colorCre)" name="Creaciones" />
                    <Bar dataKey="Eliminación" stackId="a" fill="url(#colorEli)" name="Eliminaciones" />
                    <Bar dataKey="Otros" stackId="a" fill="url(#colorOtr)" name="Otros Eventos" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Pie Chart: Distribution */}
          <div className="chart-card glass-panel">
            <div className="card-header">
              <h3><ShieldAlert size={18} /> Proporción de Actividad</h3>
              <p>Distribución total por usuario</p>
            </div>
            {loading ? (
              <div className="loading-state">Calculando...</div>
            ) : data.chart_data.length === 0 ? (
              <div className="empty-state">No hay datos</div>
            ) : (
              <div style={{ width: '100%', height: 350, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <defs>
                      {COLORS.map((color, index) => (
                        <linearGradient key={`pieGrad-${index}`} id={`pieGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={1}/>
                          <stop offset="95%" stopColor={color} stopOpacity={0.4}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={data.chart_data}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={4}
                      dataKey="total"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth={2}
                    >
                      {data.chart_data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#pieGrad-${index % COLORS.length})`} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="table-card glass-panel">
          <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '16px' }}>
            <h3><FileText size={18} /> Registro Detallado de Movimientos</h3>
            <p>Auditoría en tiempo real de interacciones con archivos</p>
          </div>
          
          <div className="table-toolbar">
            <div className="toolbar-left">
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="toolbar-input" 
                  placeholder="Buscar archivo o usuario..." 
                  style={{ paddingLeft: '32px' }}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <select className="toolbar-select" value={daysFilter} onChange={e => setDaysFilter(e.target.value)}>
                <option value="1">Hoy</option>
                <option value="7">Últimos 7 días</option>
                <option value="30">Último mes</option>
                <option value="all">Siempre</option>
              </select>
            </div>
            <div className="toolbar-right">
              <button className="toolbar-btn" onClick={handleExportCSV} disabled={data.table_data.length === 0}>
                <Download size={16} /> Exportar CSV
              </button>
            </div>
          </div>
          
          <div className="table-responsive">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Usuario</th>
                  <th>Archivo</th>
                  <th>Tipo de Evento</th>
                  <th>Severidad</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="loading-row">Cargando registros...</td></tr>
                ) : currentTableData.length === 0 ? (
                  <tr><td colSpan="5" className="empty-row">No hay movimientos que coincidan.</td></tr>
                ) : (
                  currentTableData.map((log, index) => (
                    <tr key={log.id} className="animate-row" style={{ animationDelay: `${index * 0.05}s` }}>
                      <td>
                        <div className="time-badge">
                          <Clock size={14} /> {log.time_ago}
                        </div>
                      </td>
                      <td className="user-cell">
                        <div className="user-avatar">{log.owner.charAt(0).toUpperCase()}</div>
                        <strong>{log.owner}</strong>
                      </td>
                      <td className="file-cell">{log.filename}</td>
                      <td>
                        <span className={`event-badge badge-${log.event_type.toLowerCase()}`}>
                          {log.event_type}
                        </span>
                      </td>
                      <td>
                        <span className={`severity-indicator sev-${log.severity.toLowerCase()}`}>
                          {log.severity}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="pagination-controls">
              <span>Página {currentPage} de {totalPages}</span>
              <button 
                className="btn-page" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                className="btn-page" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ActividadUsuarios;
