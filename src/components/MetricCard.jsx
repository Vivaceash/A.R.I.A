
import './MetricCard.css';

const MetricCard = ({ title, value, trend, trendUp, valueColor }) => {
  return (
    <div className="metric-card">
      <h3 className="metric-title">{title}</h3>
      <div className="metric-content">
        <span 
          className="metric-value"
          style={valueColor ? { color: valueColor } : {}}
        >
          {value}
        </span>
        {trend && (
          <span className={`metric-trend ${trendUp ? 'trend-up' : 'trend-down'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
