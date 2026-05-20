
import { FileText } from 'lucide-react';
import './Lists.css';

const RecentActivity = ({ activities }) => {
  return (
    <div className="list-container">
      <div className="list-header">
        <h3 className="list-title">Actividad reciente</h3>
      </div>
      
      <div className="list-items">
        {activities && activities.length > 0 ? (
          activities.map((activity) => (
            <div key={activity.id} className="list-item">
              <div className="item-icon-wrapper" style={{ color: 'var(--text-secondary)' }}>
                <FileText size={16} />
              </div>
              <div className="item-content">
                <div className="item-subtitle" style={{ color: 'var(--text-primary)' }}>
                  {activity.description}
                </div>
              </div>
              <div className="item-time">{activity.time}</div>
            </div>
          ))
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
            No hay actividad reciente en este periodo
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentActivity;
