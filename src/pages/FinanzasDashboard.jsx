import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
      ws = new WebSocket(protocol + '//' + window.location.host + '/api/ws');
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (['modified', 'deleted', 'created', 'resolved'].includes(message.type)) {
            fetchRef.current?.();
          }
        } catch (e) { }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };
      ws.onerror = () => { ws.close(); };
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Prepare data for Pie Chart
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
  
  const COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981'];

  // Prepare data for Area Chart (Timeline of Income vs Expense)
  const txByDate = data.transactions.reduce((acc, t) => {
    const d = t.date;
    if (!acc[d]) acc[d] = { date: d, Ingresos: 0, Egresos: 0 };
    if (t.type === 'ingreso') acc[d].Ingresos += t.amount;
    if (t.type === 'egreso') acc[d].Egresos += t.amount;
    return acc;
  }, {});

  const areaData = Object.values(txByDate).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-10);

  // Recent transactions (Top 5)
  const recentTransactions = [...data.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <>
      <Header title="Dashboard Financiero" showTimeframe={false} />
      
      <div className="finanzas-container fade-in">
        
        {/* KPI Cards */}
        <div className="finanzas-kpi-row">
          <div className="kpi-card balance">
            <div className="kpi-icon balance"><Wallet size={28} /></div>
            <div className="kpi-details">
              <h4>Balance General</h4>
              <p className="kpi-value">{formatCurrency(data.balance)}</p>
            </div>
          </div>
          
          <div className="kpi-card ingresos">
            <div className="kpi-icon ingresos"><ArrowUpCircle size={28} /></div>
            <div className="kpi-details">
              <h4>Total Ingresos</h4>
              <p className="kpi-value">{formatCurrency(data.total_income)}</p>
            </div>
          </div>
          
          <div className="kpi-card gastos">
            <div className="kpi-icon gastos"><ArrowDownCircle size={28} /></div>
            <div className="kpi-details">
              <h4>Total Egresos</h4>
              <p className="kpi-value">{formatCurrency(data.total_expense)}</p>
            </div>
          </div>
        </div>

        {!loading && (
          <div className="finanzas-charts-row">
            {/* Left Column: Timeline & Budgets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div className="chart-card">
                <h3>Fluctuación (Últimos movimientos)</h3>
                <div className="chart-container" style={{ height: '300px' }}>
                  {areaData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickFormatter={(tick) => tick.substring(5)} />
                        <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => '$'+(val/1000)+'k'} />
                        <Tooltip 
                          formatter={(value) => formatCurrency(value)}
                          labelFormatter={(label) => 'Fecha: ' + label}
                          contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                        />
                        <Area type="monotone" dataKey="Ingresos" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                        <Area type="monotone" dataKey="Egresos" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorEgresos)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      No hay suficientes datos.
                    </div>
                  )}
                </div>
              </div>

              {budgets.length > 0 && (
                <div className="chart-card">
                  <h3>Control de Presupuestos</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
                    {budgets.map(b => {
                      const spent = expensesByCategory[b.category] || 0;
                      const percentage = Math.min((spent / b.monthly_limit) * 100, 100);
                      const isOver = spent >= b.monthly_limit;
                      const isWarning = percentage >= 85 && !isOver;
                      
                      return (
                        <div key={b.id} className="budget-item">
                          <div className="budget-header">
                            <span className="budget-cat-name">{b.category}</span>
                            <span className="budget-amounts">{formatCurrency(spent)} / {formatCurrency(b.monthly_limit)}</span>
                          </div>
                          <div className="budget-track">
                            <div className="budget-fill" style={{ 
                              width: percentage + '%', 
                              background: isOver ? 'linear-gradient(90deg, #EF4444, #DC2626)' : (isWarning ? 'linear-gradient(90deg, #F59E0B, #D97706)' : 'linear-gradient(90deg, #10B981, #059669)')
                            }}></div>
                          </div>
                          {isOver && <span style={{ color: '#EF4444', fontSize: '12px', fontWeight: '500' }}>¡Presupuesto excedido!</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Pie Chart & Recent Activity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div className="chart-card">
                <h3>Gastos por Categoría</h3>
                <div className="chart-container" style={{ height: '220px' }}>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={cell-+index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => formatCurrency(value)}
                          contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        />
                        <Legend 
                          verticalAlign="middle" 
                          align="right"
                          layout="vertical"
                          iconType="circle"
                          wrapperStyle={{ fontSize: '13px', color: 'var(--text-secondary)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      No hay egresos registrados.
                    </div>
                  )}
                </div>
              </div>

              <div className="chart-card" style={{ flex: 1 }}>
                <h3>Movimientos Recientes</h3>
                {recentTransactions.length > 0 ? (
                  <div className="recent-tx-feed">
                    {recentTransactions.map(tx => (
                      <div key={tx.id} className="recent-tx-item">
                        <div className="recent-tx-left">
                          <div className={'recent-tx-icon ' + tx.type}>
                            {tx.type === 'ingreso' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                          </div>
                          <div className="recent-tx-info">
                            <h5>{tx.concept}</h5>
                            <span>{formatDate(tx.date)} • {tx.category}</span>
                          </div>
                        </div>
                        <div className={'recent-tx-amount ' + tx.type}>
                          {tx.type === 'ingreso' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No hay movimientos recientes.
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default FinanzasDashboard;
