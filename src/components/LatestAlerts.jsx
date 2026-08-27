import { FileWarning, AlertTriangle, AlertCircle } from 'lucide-react';
import './Lists.css';

const LatestAlerts = ({ alerts }) => {
  const displayAlerts = (alerts || []).slice(0, 5);

  return (
    <div className="list-container">
      <div className="list-header">
        <h3 className="list-title">Últimas alertas</h3>
      </div>
      
      <div className="list-items">
        {displayAlerts.length > 0 ? (
          displayAlerts.map((alert) => {
            let Icon = AlertCircle;
            if (alert.iconClass === 'icon-danger') Icon = FileWarning;
            else if (alert.iconClass === 'icon-warning') Icon = AlertTriangle;
            
            return (
              <div key={alert.id} className="list-item">
                <div className={`item-icon-wrapper ${alert.iconClass}`}>
                  <Icon size={15} />
                </div>
                <div className="item-content">
                  <div className="item-title" title={alert.title}>{alert.title}</div>
                  <div className="item-subtitle" title={alert.description}>{alert.description}</div>
                </div>
                <div className="item-time">{alert.time}</div>
                <div className={`badge ${alert.severity === 'Alto' ? 'badge-high' : (alert.severity === 'Medio' ? 'badge-medium' : 'badge-low')}`}>
                  {alert.severity}
                </div>
              </div>
            );
          })
        ) : (
          <div className="no-alerts-state">
            No hay alertas recientes
          </div>
        )}
      </div>
    </div>
  );
};

export default LatestAlerts;
