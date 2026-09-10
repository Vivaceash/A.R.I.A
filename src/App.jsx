import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertTriangle, Info, X } from 'lucide-react';
import './App.css';
import './Toast.css';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Reportes from './pages/Reportes';
import Archivos from './pages/Archivos';
import Comparaciones from './pages/Comparaciones';
import Alertas from './pages/Alertas';
import Chat from './pages/Chat';
import Conocimiento from './pages/Conocimiento';
import Ciberseguridad from './pages/Ciberseguridad';
import DiccionarioAmenazas from './pages/DiccionarioAmenazas';
import ReportesAuditoria from './pages/ReportesAuditoria';
import Vault from './pages/Vault';
import FinanzasDashboard from './pages/FinanzasDashboard';
import FinanzasMovimientos from './pages/FinanzasMovimientos';
import Accesos from './pages/Accesos';
import FloatingChat from './components/FloatingChat';
import { ThemeProvider } from './contexts/ThemeContext';
import { ChatProvider } from './contexts/ChatContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';

const ProtectedRoute = ({ moduleName, children }) => {
  const { hasAccess } = useAuth();
  
  if (!hasAccess(moduleName)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function AppContent() {
  const { user, loading } = useAuth();
  const [toastAlert, setToastAlert] = useState(null);
  const toastTimeout = useRef(null);

  useEffect(() => {
    if (!user) return;
    let ws;
    let reconnectTimeout;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'modified' || message.type === 'deleted' || message.type === 'created') {
            if (message.alert && message.alert.title) {
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
  }, [user]);

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>Cargando A.R.I.A...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <div className="app-container">
        {toastAlert && (
          <div className={`toast-notification fade-in toast-severity-${(toastAlert.severity || 'bajo').toLowerCase()}`}>
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
        <FloatingChat />
        <div className="main-content">
          <Routes>
            {/* Rutas Globales / Generales */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/archivos" element={<Archivos />} />
            <Route path="/comparaciones" element={<Comparaciones />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/conocimiento" element={<Conocimiento />} />
            
            {/* Módulos Especializados con Protección por Roles */}
            <Route path="/ciberseguridad" element={<ProtectedRoute moduleName="amenazas"><Ciberseguridad /></ProtectedRoute>} />
            <Route path="/ciberseguridad/diccionario" element={<ProtectedRoute moduleName="amenazas"><DiccionarioAmenazas /></ProtectedRoute>} />
            <Route path="/ciberseguridad/reportes" element={<ProtectedRoute moduleName="amenazas"><ReportesAuditoria /></ProtectedRoute>} />
            <Route path="/boveda" element={<Navigate to="/comparaciones" replace />} />
            <Route path="/finanzas/dashboard" element={<ProtectedRoute moduleName="finanzas"><FinanzasDashboard /></ProtectedRoute>} />
            <Route path="/finanzas/movimientos" element={<ProtectedRoute moduleName="finanzas"><FinanzasMovimientos /></ProtectedRoute>} />
            <Route path="/accesos" element={<ProtectedRoute moduleName="iam"><Accesos /></ProtectedRoute>} />
            
            {/* Rutas Específicas de Submódulos/Áreas */}
            <Route path="/modulo/:module/dashboard" element={<Dashboard />} />
            <Route path="/modulo/:module/reportes" element={<Reportes />} />
            <Route path="/modulo/:module/archivos" element={<Archivos />} />
            <Route path="/modulo/:module/comparaciones" element={<Comparaciones />} />
            <Route path="/modulo/:module/alertas" element={<Alertas />} />
            <Route path="/modulo/:module/ciberseguridad" element={<Ciberseguridad />} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ChatProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ChatProvider>
    </ThemeProvider>
  );
}

export default App;
