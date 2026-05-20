
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import './Charts.css';

const AlertsPieChart = ({ data, title = "Alertas por tipo", onSliceClick }) => {
  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
      </div>
      
      <div className="pie-content">
        <div style={{ width: '200px', height: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    onClick={() => onSliceClick && onSliceClick(entry, title)}
                    style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-surface)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)'
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="pie-legend">
          {data.map((item, index) => (
            <div 
              key={index} 
              className="legend-item" 
              onClick={() => onSliceClick && onSliceClick(item, title)}
              style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
            >
              <div className="legend-label">
                <span className="color-dot" style={{ backgroundColor: item.color }}></span>
                {item.name}
              </div>
              <span className="legend-value">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlertsPieChart;
