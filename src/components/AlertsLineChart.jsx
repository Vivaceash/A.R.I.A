import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';
import './Charts.css';

const AlertsLineChart = ({ data }) => {
  const [selectedPoint, setSelectedPoint] = useState(null);

  const handleClick = (e, payload) => {
    let payloadData = null;
    
    // Si viene del AreaChart onClick
    if (e && e.activePayload && e.activePayload.length > 0) {
      payloadData = e.activePayload[0].payload;
    } 
    // Si viene del activeDot onClick
    else if (payload && payload.payload) {
      payloadData = payload.payload;
    }
    else if (e && e.payload) {
      payloadData = e.payload;
    }

    if (payloadData && payloadData.alertas > 0 && payloadData.detalles && payloadData.detalles.length > 0) {
      setSelectedPoint(payloadData);
    }
  };

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3 className="chart-title">Alertas en el tiempo</h3>
      </div>
      
      <div style={{ width: '100%', height: '220px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            <defs>
              <linearGradient id="colorAlertas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.5}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="var(--text-muted)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="var(--text-muted)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--bg-surface)', 
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)'
              }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Area 
              type="monotone" 
              dataKey="alertas" 
              stroke="#3B82F6" 
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorAlertas)"
              activeDot={{ 
                r: 8, 
                fill: '#3B82F6', 
                stroke: 'var(--bg-card)', 
                strokeWidth: 2, 
                cursor: 'pointer',
                onClick: handleClick
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {selectedPoint && (
        <div className="alert-details-modal-overlay" onClick={() => setSelectedPoint(null)}>
          <div className="alert-details-modal" onClick={e => e.stopPropagation()}>
            <div className="alert-details-header">
              <h4>Alertas del periodo: {selectedPoint.name}</h4>
              <button className="close-modal-btn" onClick={() => setSelectedPoint(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="alert-details-body">
              {selectedPoint.detalles.map((detalle, idx) => (
                <div key={idx} className="alert-detail-item">
                  <div className="alert-detail-title">{detalle.title}</div>
                  <div className="alert-detail-meta">
                    <span className={`badge ${detalle.severity === 'Alto' ? 'badge-high' : (detalle.severity === 'Medio' ? 'badge-medium' : 'badge-low')}`}>
                      {detalle.severity}
                    </span>
                    <span className="alert-detail-time">
                      {detalle.timestamp ? new Date(detalle.timestamp).toLocaleString() : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsLineChart;
