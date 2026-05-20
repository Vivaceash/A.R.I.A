import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AlertTriangle, Info, X } from 'lucide-react';
import './App.css';
import './Toast.css';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Reportes from './pages/Reportes';
import Archivos from './pages/Archivos';
import Alertas from './pages/Alertas';
import Chat from './pages/Chat';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  const [toastAlert, setToastAlert] = useState(null);
  const toastTimeout = useRef(null);

  useEffect(() => {
    let ws;
    let reconnectTimeout;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'modified' || message.type === 'deleted' || message.type === 'created') {
            if (message.alert) {
              setToastAlert(message.alert);
              if (toastTimeout.current) clearTimeout(toastTimeout.current);
              toastTimeout.current = setTimeout(() => setToastAlert(null), 5000);
            }
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

  return (
    <ThemeProvider>
      <Router>
      <div className="app-container">
        {toastAlert && (
          <div className={`toast-notification fade-in toast-severity-${toastAlert.severity.toLowerCase()}`}>
            <div className="toast-icon">
               {toastAlert.iconClass === 'icon-danger' ? <AlertTriangle size={24} color="#EF4444" /> : <Info size={24} color="#3B82F6" />}
            </div>
            <div className="toast-content">
               <h4>{toastAlert.title}</h4>
               <p>{toastAlert.description && toastAlert.description.length > 120 ? toastAlert.description.split('\n')[0].substring(0, 120) + '...' : toastAlert.description}</p>
            </div>
            <button className="toast-close" onClick={() => setToastAlert(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/archivos" element={<Archivos />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </div>
      </div>
    </Router>
    </ThemeProvider>
  );
}

export default App;
