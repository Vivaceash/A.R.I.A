import React, { useState, useEffect, useMemo } from 'react';
import { FileWarning, AlertTriangle, AlertCircle, FileText, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import Header from '../components/Header';
import './Reportes.css';

function Reportes() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch(`http://${window.location.hostname}:8000/api/reports`);
        const data = await response.json();
        setReports(data);
      } catch (err) {
        console.error('Error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

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
      <Header title="Histórico de Reportes" showTimeframe={false} />

      <div className="reports-controls" style={{ marginTop: '24px', display: 'flex', gap: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
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
          <table className="reports-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('title')} className="sortable-th">
                  Archivo {renderSortIcon('title')}
                </th>
                <th onClick={() => handleSort('type')} className="sortable-th">
                  Evento {renderSortIcon('type')}
                </th>
                <th onClick={() => handleSort('description')} className="sortable-th">
                  Descripción {renderSortIcon('description')}
                </th>
                <th onClick={() => handleSort('severity')} className="sortable-th">
                  Severidad {renderSortIcon('severity')}
                </th>
                <th onClick={() => handleSort('timestamp')} className="sortable-th">
                  Fecha {renderSortIcon('timestamp')}
                </th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map(report => {
                let Icon = AlertCircle;
                if (report.iconClass === 'icon-danger') Icon = FileWarning;
                else if (report.iconClass === 'icon-warning') Icon = AlertTriangle;
                else if (report.iconClass === 'icon-info') Icon = FileText;

                return (
                  <tr key={report.id}>
                    <td>
                      <div className="file-name-cell">
                        <Icon size={16} style={{ color: report.severity === 'Alto' ? 'var(--accent-danger)' : 'var(--text-muted)' }} />
                        {report.title}
                      </div>
                    </td>
                    <td>{report.type}</td>
                    <td>{report.description}</td>
                    <td>
                      <span className={`badge ${report.severity === 'Alto' ? 'badge-high' : (report.severity === 'Medio' ? 'badge-medium' : 'badge-low')}`}>
                        {report.severity}
                      </span>
                    </td>
                    <td className="date-cell">
                      {new Date(report.timestamp).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
    </>
  );
}

export default Reportes;
