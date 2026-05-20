import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import MetricCard from '../components/MetricCard';
import AlertsPieChart from '../components/AlertsPieChart';
import AlertsLineChart from '../components/AlertsLineChart';
import LatestAlerts from '../components/LatestAlerts';
import AlertCategories from '../components/AlertCategories';
import CategoryModal from '../components/CategoryModal';
import { AlertTriangle, Info, X } from 'lucide-react';

function Dashboard() {
  const [data, setData] = useState(null);
  const [allAlerts, setAllAlerts] = useState([]);
  const [timeframe, setTimeframe] = useState('24h');
  const ws = useRef(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`http://${window.location.hostname}:8000/api/stats?period=${timeframe}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
      
      const reportsResponse = await fetch(`http://${window.location.hostname}:8000/api/reports`);
      if (reportsResponse.ok) {
        const reportsResult = await reportsResponse.json();
        setAllAlerts(reportsResult);
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    ws.current = new WebSocket(`ws://${window.location.hostname}:8000/api/ws`);

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'modified' || message.type === 'deleted' || message.type === 'created') {
          fetchData();
        }
      } catch (e) {
        console.error('Error parseando mensaje WS', e);
      }
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [fetchData]);

  // Handlers for interactive drill-down
  const handleSliceClick = (entry, chartTitle) => {
    let filtered = [];
    if (chartTitle === "Alertas por riesgo") {
      filtered = allAlerts.filter(a => a.severity === entry.name);
    } else if (chartTitle === "Tipos de archivo") {
      if (entry.name === "Otros") {
        filtered = allAlerts.filter(a => !a.title.includes('.'));
      } else {
        filtered = allAlerts.filter(a => a.title.toLowerCase().endsWith(entry.name.toLowerCase()));
      }
    }
    setModalTitle(`${chartTitle}: ${entry.name}`);
    setModalData(filtered);
    setIsModalOpen(true);
  };

  const handleCategoryClick = (category) => {
    let filtered = [];
    if (category.filterType === 'Resueltas') {
      filtered = allAlerts.filter(a => a.resolved);
    } else {
      filtered = allAlerts.filter(a => a.type === category.filterType);
    }
    setModalTitle(`Categoría: ${category.title}`);
    setModalData(filtered);
    setIsModalOpen(true);
  };

  if (!data) return <div className="loading-state">Cargando métricas...</div>;

  return (
    <>
      <Header timeframe={timeframe} setTimeframe={setTimeframe} />

      <div className="dashboard-grid">
        <MetricCard 
          title="Archivos analizados" 
          value={data.metrics.archivos_analizados.toLocaleString()} 
          trend="" 
          trendUp={true} 
        />
        <MetricCard 
          title="Alertas activas" 
          value={data.metrics.alertas_activas.toLocaleString()} 
          trend="" 
          trendUp={false} 
        />
        <MetricCard 
          title="Comparaciones" 
          value={data.metrics.comparaciones.toLocaleString()} 
          trend="" 
          trendUp={true} 
        />
        <MetricCard 
          title="Riesgo promedio" 
          value={data.metrics.riesgo_promedio} 
          trend="" 
          trendUp={false} 
          valueColor={data.metrics.riesgo_promedio === 'Bajo' ? 'var(--accent-success)' : (data.metrics.riesgo_promedio === 'Medio' ? 'var(--accent-warning)' : 'var(--accent-danger)')}
        />
      </div>

      <div className="middle-grid">
        <AlertsPieChart data={data.pieChart} title="Alertas por riesgo" onSliceClick={handleSliceClick} />
        <AlertsPieChart data={data.extensionPieChart || []} title="Tipos de archivo" onSliceClick={handleSliceClick} />
        <LatestAlerts alerts={data.latestAlerts} />
      </div>

      <div className="bottom-grid">
        <AlertCategories alerts={allAlerts} onCategoryClick={handleCategoryClick} />
        <AlertsLineChart data={data.lineChart} />
      </div>

      <CategoryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={modalTitle} 
        data={modalData} 
      />
    </>
  );
}

export default Dashboard;
