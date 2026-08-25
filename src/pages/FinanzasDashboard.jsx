import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './Finanzas.css';

function FinanzasDashboard() {
  const [data, setData] = useState({ transactions: [], total_income: 0, total_expense: 0, balance: 0 });
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRef = React.useRef(null);

  const fetchDashboardData = React.useCallback(async () => {
    try {
      const [financeData, budgetsData] = await Promise.all([
        fetch('/api/finances').then(res => res.json()),
        fetch('/api/finances/budgets').then(res => res.json())
      ]);
      setData(financeData);
      setBudgets(budgetsData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRef.current = fetchDashboardData;
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchDashboardData();

    let ws;
    let reconnectTimeout;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // Actualizamos si el sistema global cambia algo financiero
          if (['modified', 'deleted', 'created', 'resolved'].includes(message.type)) {
            fetchRef.current?.();
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
  }, [fetchDashboardData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  };

  // Prepare data for Pie Chart (Expenses by Category)
  const expensesByCategory = data.transactions
    .filter(t => t.type === 'egreso')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
    
  const pieData = Object.keys(expensesByCategory).map(key => ({
    name: key,
    value: expensesByCategory[key]
  }));
  
  const COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899'];

  // Prepare data for Bar Chart (Income vs Expense)
  const barData = [
    { name: 'Ingresos', amount: data.total_income, fill: '#10B981' },
    { name: 'Egresos', amount: data.total_expense, fill: '#EF4444' }
  ];

  return (
    <>
      <Header title="Dashboard Financiero" showTimeframe={false} />
      
      <div className="finanzas-container fade-in">
        <div className="finanzas-kpi-row">
          <div className="kpi-card">
            <div className="kpi-icon balance">
              <Wallet size={28} />
            </div>
            <div className="kpi-details">
              <h4>Balance General</h4>
              <p className="kpi-value">{formatCurrency(data.balance)}</p>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="kpi-icon ingresos">
              <ArrowUpCircle size={28} />
            </div>
            <div className="kpi-details">
              <h4>Total Ingresos</h4>
              <p className="kpi-value">{formatCurrency(data.total_income)}</p>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="kpi-icon gastos">
              <ArrowDownCircle size={28} />
            </div>
            <div className="kpi-details">
              <h4>Total Egresos</h4>
              <p className="kpi-value">{formatCurrency(data.total_expense)}</p>
            </div>
          </div>
        </div>

        {!loading && data.transactions.length > 0 && (
          <div className="finanzas-charts-row">
            <div className="chart-card">
              <h3>Ingresos vs Egresos</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <h3>Gastos por Categoría</h3>
              <div className="chart-container">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        iconType="circle"
                        wrapperStyle={{ fontSize: '13px', color: 'var(--text-secondary)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No hay egresos registrados para mostrar.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && budgets.length > 0 && (
          <div className="finanzas-charts-row" style={{ marginTop: '24px' }}>
            <div className="chart-card" style={{ width: '100%' }}>
              <h3>Control de Presupuestos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
                {budgets.map(b => {
                  const spent = expensesByCategory[b.category] || 0;
                  const percentage = Math.min((spent / b.monthly_limit) * 100, 100);
                  const isOver = spent >= b.monthly_limit;
                  const isWarning = percentage >= 85 && !isOver;
                  
                  return (
                    <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontSize: '14px' }}>
                        <span>{b.category}</span>
                        <span>{formatCurrency(spent)} / {formatCurrency(b.monthly_limit)}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${percentage}%`, 
                          height: '100%', 
                          background: isOver ? '#EF4444' : (isWarning ? '#F59E0B' : '#10B981'),
                          borderRadius: '4px',
                          transition: 'width 0.5s ease'
                        }}></div>
                      </div>
                      {isOver && <span style={{ color: '#EF4444', fontSize: '12px' }}>¡Presupuesto excedido!</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default FinanzasDashboard;
