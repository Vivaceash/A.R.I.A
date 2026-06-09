import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
  const { module } = useParams();
  const ws = useRef(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/stats?period=${timeframe}&module=${module || 'general'}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        if (result.alerts) {
          setAllAlerts(result.alerts);
        }
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  }, [timeframe, module]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let wsInstance;
    let reconnectTimeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsInstance = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      ws.current = wsInstance;

      wsInstance.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (['modified', 'deleted', 'created', 'resolved'].includes(message.type)) {
            fetchData();
          }
        } catch (e) {
          console.error('Error parseando mensaje WS', e);
        }
      };

      wsInstance.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };

      wsInstance.onerror = () => {
        wsInstance.close();
      };
    };

    connect();

    return () => {
      if (wsInstance) wsInstance.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
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
      <Header 
        title={module ? `Dashboard de ${module.charAt(0).toUpperCase() + module.slice(1)}` : "Dashboard General"} 
        onTimeframeChange={setTimeframe} 
        timeframe={timeframe} 
        setTimeframe={setTimeframe} 
      />

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
