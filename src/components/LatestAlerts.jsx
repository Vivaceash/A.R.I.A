import { FileWarning, AlertTriangle, AlertCircle } from 'lucide-react';
import './Lists.css';

const LatestAlerts = ({ alerts }) => {
  return (
    <div className="list-container">
      <div className="list-header">
        <h3 className="list-title">Últimas alertas</h3>
      </div>
      
      <div className="list-items">
        {alerts && alerts.length > 0 ? (
          alerts.map((alert) => {
            let Icon = AlertCircle;
            if (alert.iconClass === 'icon-danger') Icon = FileWarning;
            else if (alert.iconClass === 'icon-warning') Icon = AlertTriangle;
            
            return (
              <div key={alert.id} className="list-item">
                <div className={`item-icon-wrapper ${alert.iconClass}`}>
                  <Icon size={16} />
                </div>
                <div className="item-content">
                  <div className="item-title">{alert.title}</div>
                  <div className="item-subtitle">{alert.description}</div>
                </div>
                <div className="item-time">{alert.time}</div>
                <div className={`badge ${alert.severity === 'Alto' ? 'badge-high' : 'badge-medium'}`}>
                  {alert.severity}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
            No hay alertas recientes
          </div>
        )}
      </div>
    </div>
  );
};

export default LatestAlerts;
