import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Search, FileText, Paperclip, Download, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Finanzas.css';

function FinanzasMovimientos() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Form State
  const [formData, setFormData] = useState({
    type: 'ingreso',
    amount: '',
    concept: '',
    category: 'Ventas',
    date: new Date().toISOString().split('T')[0],
    status: 'Pagado',
    due_date: '',
    calculate_tax: false
  });
  const [attachmentFile, setAttachmentFile] = useState(null);

  const fetchRef = React.useRef(null);

  const fetchTransactions = React.useCallback(async () => {
    try {
      const res = await fetch('/api/finances');
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRef.current = fetchTransactions;
  }, [fetchTransactions]);

  useEffect(() => {
    fetchTransactions();

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
        } catch (e) {}
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
  }, [fetchTransactions]);

  const handleDelete = async () => {
    if (transactionToDelete) {
      await fetch(`/api/finances/${transactionToDelete}`, { method: 'DELETE' });
      setTransactionToDelete(null);
      fetchTransactions();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let subtotal = parseFloat(formData.amount);
    let tax_amount = 0;
    let tax_rate = 0;
    
    if (formData.calculate_tax) {
      tax_rate = 16;
      subtotal = parseFloat(formData.amount) / 1.16;
      tax_amount = parseFloat(formData.amount) - subtotal;
    }
    
    let attachment_path = null;
    if (attachmentFile) {
      const fd = new FormData();
      fd.append('file', attachmentFile);
      const uploadRes = await fetch('/api/finances/upload', { method: 'POST', body: fd });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        attachment_path = uploadData.attachment_path;
      }
    }

    await fetch('/api/finances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        amount: parseFloat(formData.amount),
        due_date: formData.status === 'Pendiente' ? formData.due_date : null,
        subtotal,
        tax_amount,
        tax_rate,
        attachment_path
      })
    });
    
    setShowModal(false);
    setFormData({ type: 'ingreso', amount: '', concept: '', category: 'Ventas', date: new Date().toISOString().split('T')[0], status: 'Pagado', due_date: '', calculate_tax: false });
    setAttachmentFile(null);
    fetchTransactions();
  };

  const generatePDF = async (t) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.text("RECIBO DE TRANSACCIÓN", 105, 20, null, null, "center");
      
      doc.setFontSize(12);
      doc.text(`ID Recibo: #${t.id.toString().padStart(5, '0')}`, 20, 40);
      doc.text(`Fecha: ${new Date(t.date).toLocaleDateString('es-MX')}`, 20, 50);
      doc.text(`Tipo: ${t.type.toUpperCase()}`, 20, 60);
      doc.text(`Categoría: ${t.category}`, 20, 70);
      doc.text(`Estado: ${t.status.toUpperCase()}`, 20, 80);
      if (t.due_date) {
        doc.text(`Vencimiento: ${new Date(t.due_date).toLocaleDateString('es-MX')}`, 20, 90);
      }
      
      autoTable(doc, {
        startY: 100,
        head: [['Concepto', 'Subtotal', 'IVA (16%)', 'Total']],
        body: [
          [t.concept, formatCurrency(t.subtotal || t.amount), formatCurrency(t.tax_amount || 0), formatCurrency(t.amount)]
        ],
        theme: 'grid',
        headStyles: { fillColor: t.type === 'ingreso' ? [16, 185, 129] : [239, 68, 68] }
      });
      
      doc.text("Generado por A.R.I.A", 105, 280, null, null, "center");
      doc.save(`Recibo_${t.id}_${t.concept.substring(0,10)}.pdf`);

      await fetch('/api/finances/log_export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: t.id, concept: t.concept })
      });
    } catch (err) {
      console.error(err);
      showToast("Error al generar PDF. " + err.message);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  };

  const filteredTransactions = transactions.filter(t => 
    t.concept.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Header title="Libro de Movimientos" showTimeframe={false} />
      
      <div className="finanzas-container fade-in">
        
        <div className="finanzas-header-actions">
          <div className="search-container" style={{ position: 'relative', width: '350px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por concepto o categoría..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '14px' }}
            />
          </div>
          
          <button 
            onClick={() => setShowModal(true)}
            style={{ marginLeft: 'auto', padding: '12px 24px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', border: 'none', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' }}
          >
            <Plus size={18} />
            Añadir Transacción
          </button>
        </div>
        
        <div className="finanzas-table-container">
          <table className="finanzas-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th>Monto</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(t => (
                <tr key={t.id}>
                  <td>
                    <span className={`type-badge ${t.type}`}>
                      {t.type === 'ingreso' ? <ArrowUpRight size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }}/> : <ArrowDownRight size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }}/>}
                      {t.type}
                    </span>
                  </td>
                  <td>{new Date(t.date).toLocaleDateString('es-MX')}</td>
                  <td style={{ fontWeight: '500' }}>{t.concept}</td>
                  <td><span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{t.category}</span></td>
                  <td>
                    <span className={`status-badge ${t.status.toLowerCase()}`}>
                      {t.status}
                    </span>
                    {t.status === 'Pendiente' && t.due_date && new Date(t.due_date) < new Date() && (
                      <span style={{ color: '#EF4444', display: 'block', fontSize: '11px', marginTop: '4px', fontWeight: '600' }}>¡Vencido!</span>
                    )}
                  </td>
                  <td style={{ fontWeight: '700', color: t.type === 'ingreso' ? '#10B981' : '#EF4444' }}>
                    {t.type === 'ingreso' ? '+' : '-'}{formatCurrency(t.amount)}
                  </td>
                  <td style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {t.attachment_path && (
                      <button 
                        onClick={() => window.open(`/api/finances/download/${t.id}`, '_blank')}
                        title="Ver comprobante"
                        style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3B82F6', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <Paperclip size={16} />
                      </button>
                    )}
                    <button 
                      onClick={() => generatePDF(t)}
                      title="Generar Recibo PDF"
                      style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#F59E0B', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Download size={16} />
                    </button>
                    <button 
                      onClick={() => setTransactionToDelete(t.id)}
                      title="Eliminar"
                      style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No se encontraron movimientos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modern Premium Modal for Add Transaction */}
      {showModal && (
        <div className="premium-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="premium-modal-content" onClick={e => e.stopPropagation()}>
            <div className="premium-modal-header">
              <h2>Registrar Transacción</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="premium-modal-body">
                <div className="form-group full-width">
                  <label>Tipo de Movimiento</label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: formData.type === 'ingreso' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.2)', border: formData.type === 'ingreso' ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <input type="radio" name="type" value="ingreso" checked={formData.type === 'ingreso'} onChange={e => setFormData({...formData, type: e.target.value})} style={{ display: 'none' }} />
                      <ArrowUpCircle size={20} color={formData.type === 'ingreso' ? '#10B981' : 'var(--text-muted)'} />
                      <span style={{ color: formData.type === 'ingreso' ? '#10B981' : 'white', fontWeight: '500' }}>Ingreso</span>
                    </label>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: formData.type === 'egreso' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.2)', border: formData.type === 'egreso' ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <input type="radio" name="type" value="egreso" checked={formData.type === 'egreso'} onChange={e => setFormData({...formData, type: e.target.value})} style={{ display: 'none' }} />
                      <ArrowDownCircle size={20} color={formData.type === 'egreso' ? '#EF4444' : 'var(--text-muted)'} />
                      <span style={{ color: formData.type === 'egreso' ? '#EF4444' : 'white', fontWeight: '500' }}>Egreso</span>
                    </label>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>Concepto (Descripción)</label>
                  <input type="text" required value={formData.concept} onChange={e => setFormData({...formData, concept: e.target.value})} placeholder="Ej. Pago de cliente, Factura de luz..." />
                </div>

                <div className="form-group">
                  <label>Monto</label>
                  <input type="number" step="0.01" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
                </div>

                <div className="form-group">
                  <label>Categoría</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {formData.type === 'ingreso' ? (
                      <>
                        <option value="Ventas">Ventas / Servicios</option>
                        <option value="Inversiones">Inversiones</option>
                        <option value="Otros Ingresos">Otros Ingresos</option>
                      </>
                    ) : (
                      <>
                        <option value="Servicios Básicos">Servicios Básicos (Agua, Luz)</option>
                        <option value="Nómina">Nómina</option>
                        <option value="Suscripciones">Suscripciones (Software, Cloud)</option>
                        <option value="Materiales">Materiales / Insumos</option>
                        <option value="Marketing">Marketing / Publicidad</option>
                        <option value="Impuestos">Impuestos</option>
                        <option value="Otros Gastos">Otros Gastos</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>Estado</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="Pagado">Pagado</option>
                    <option value="Pendiente">Pendiente / Por Pagar</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Fecha de Movimiento</label>
                  <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>

                {formData.status === 'Pendiente' && (
                  <div className="form-group full-width">
                    <label>Fecha de Vencimiento (Límite)</label>
                    <input type="date" required value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                  </div>
                )}
                
                <div className="form-group full-width">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.calculate_tax} onChange={e => setFormData({...formData, calculate_tax: e.target.checked})} style={{ width: 'auto' }} />
                    Desglosar IVA (16%) automáticamente del monto total
                  </label>
                </div>
              </div>

              <div className="premium-modal-footer">
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '12px 24px', background: '#3B82F6', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simple Delete Confirmation */}
      {transactionToDelete && (
        <div className="premium-modal-overlay" onClick={() => setTransactionToDelete(null)} style={{ zIndex: 1001 }}>
          <div className="premium-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="premium-modal-header">
              <h2>Confirmar Eliminación</h2>
            </div>
            <div className="premium-modal-body">
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>¿Estás seguro de que deseas eliminar este movimiento permanentemente?</p>
            </div>
            <div className="premium-modal-footer">
              <button onClick={() => setTransactionToDelete(null)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDelete} style={{ padding: '10px 20px', background: '#EF4444', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
      
      {toastMessage && (
        <div className="toast-notification fade-in">
          {toastMessage}
        </div>
      )}
    </>
  );
}

export default FinanzasMovimientos;
