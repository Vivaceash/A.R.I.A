import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { FileWarning, AlertTriangle, AlertCircle, FileText, Search, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, CheckCircle } from 'lucide-react';
import Header from '../components/Header';
import AiAnalysisModal from '../components/AiAnalysisModal';
import './Reportes.css';
import './Alertas.css';

function Reportes() {
  const { module } = useParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedAlertForAnalysis, setSelectedAlertForAnalysis] = useState(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  const handleViewAnalysis = (alert) => {
    setSelectedAlertForAnalysis(alert);
    setIsAnalysisModalOpen(true);
  };

  const fetchReports = async () => {
    try {
      const response = await fetch(`/api/reports?module=${module || 'general'}`);
      const data = await response.json();
      setReports(data);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();

    let ws;
    let reconnectTimeout;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'modified' || message.type === 'deleted' || message.type === 'created' || message.type === 'resolved') {
            fetchReports();
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
  }, [module]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
      key = null;
    }
    setSortConfig({ key, direction });
  };

  const resolveAlert = async (id) => {
    setResolvingId(id);
    setTimeout(async () => {
      try {
        const response = await fetch(`/api/alertas/${encodeURIComponent(id)}/resolve`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: 'Jefe' })
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        setResolvingId(null);
        setReports(prev => prev.map(r => r.id === id ? { ...r, resolved: true, resolvedBy: 'Jefe', resolvedAt: new Date().toISOString() } : r));
      } catch (error) {
        console.error('Error resolving alert:', error);
        setResolvingId(null);
      }
    }, 600);
  };

  const processedReports = useMemo(() => {
    let filtered = reports.filter(report => {
      const searchLower = searchTerm.toLowerCase();
      return (
        report.title.toLowerCase().includes(searchLower) ||
        report.type.toLowerCase().includes(searchLower) ||
        report.description.toLowerCase().includes(searchLower) ||
        report.severity.toLowerCase().includes(searchLower)
      );
    });

    return filtered.sort((a, b) => {
      if (sortConfig.key) {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'severity') {
           const severityOrder = { "Alto": 3, "Medio": 2, "Bajo": 1 };
           valA = severityOrder[valA] || 0;
           valB = severityOrder[valB] || 0;
        }
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }, [reports, searchTerm, sortConfig]);

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="sort-icon inactive" />;
    if (sortConfig.direction === 'asc') return <ArrowUp size={14} className="sort-icon active" />;
    return <ArrowDown size={14} className="sort-icon active" />;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig, itemsPerPage]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = processedReports.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(processedReports.length / itemsPerPage);

  const renderPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pages.push(
          <button 
            key={i} 
            className={`page-number-btn ${currentPage === i ? 'active' : ''}`}
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </button>
        );
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        pages.push(<span key={i} className="pagination-ellipsis">...</span>);
      }
    }
    return pages;
  };

  return (
    <>
      <Header title={module ? `Histórico de ${module.charAt(0).toUpperCase() + module.slice(1)}` : "Histórico de Reportes Global"} showTimeframe={false} />

      <div className="reports-controls" style={{ marginTop: '24px', display: 'flex', gap: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="reportes-stats-bar">
          <div className="stat-item"><span className="stat-num">{processedReports.length}</span> Total</div>
          <div className="stat-item stat-alto"><span className="stat-num">{processedReports.filter(r => r.severity === 'Alto').length}</span> Alto</div>
          <div className="stat-item stat-medio"><span className="stat-num">{processedReports.filter(r => r.severity === 'Medio').length}</span> Medio</div>
          <div className="stat-item stat-bajo"><span className="stat-num">{processedReports.filter(r => r.severity === 'Bajo').length}</span> Bajo</div>
        </div>

        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar por archivo, evento, descripción o severidad..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="pagination-controls-top">
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Mostrar:</span>
          <select 
            className="items-per-page-select" 
            value={itemsPerPage} 
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="reports-card" style={{ marginTop: '16px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Cargando histórico...</div>
        ) : reports.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No hay eventos en el historial.</div>
        ) : (
          <div className="alertas-list">
            {currentItems.map(report => {
              let Icon = AlertCircle;
              if (report.severity === 'Alto') Icon = FileWarning;
              else if (report.severity === 'Medio') Icon = AlertTriangle;
              else Icon = FileText;

              return (
                <div key={report.id} className={`alerta-card severity-${report.severity.toLowerCase()} ${resolvingId === report.id ? 'resolving-green' : ''} ${report.resolved ? 'resolved-card' : ''}`}>
                  <div className="alerta-card-icon">
                    {report.resolved ? <CheckCircle size={24} /> : <Icon size={24} />}
                  </div>
                  
                  <div className="alerta-card-body">
                    <div className="alerta-card-header">
                      <h4>{report.title}</h4>
                      <span className="alerta-card-time">{new Date(report.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="alerta-card-desc">{report.description}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <span className={`alerta-card-badge badge-${report.severity.toLowerCase()}`}>
                        Riesgo {report.severity}
                      </span>
                      <span className="alerta-card-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                        {report.type}
                      </span>
                    </div>
                  </div>
                  
                  <div className="alerta-card-actions">
                    <button 
                      className="view-analysis-btn" 
                      onClick={() => report.aiAnalysis && handleViewAnalysis(report)}
                      style={{ cursor: report.aiAnalysis ? 'pointer' : 'not-allowed', filter: report.aiAnalysis ? 'none' : 'brightness(0.8)', width: report.resolved ? '100%' : 'auto', justifyContent: 'center' }}
                    >
                      <Sparkles size={18} />
                      <span>Ver Auditoría IA</span>
                    </button>
                    
                    {!report.resolved && (
                      <button className="resolve-btn" onClick={() => resolveAlert(report.id)} disabled={resolvingId === report.id}>
                        <CheckCircle size={18} />
                        <span>{resolvingId === report.id ? 'Resolviendo...' : 'Marcar Resuelto'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && processedReports.length > 0 && (
          <div className="pagination-bottom">
            <button 
              className="pagination-btn" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </button>
            
            <div className="page-numbers">
              {renderPageNumbers()}
            </div>

            <button 
              className="pagination-btn" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
      <AiAnalysisModal 
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        alert={selectedAlertForAnalysis}
      />
    </>
  );
}

export default Reportes;
