import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Search, FileText, Paperclip, Download } from 'lucide-react';
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
    setFormData({ ...formData, amount: '', concept: '', due_date: '', calculate_tax: false });
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
      doc.text(`Fecha: ${new Date(t.date).toLocaleDateString()}`, 20, 50);
      doc.text(`Tipo: ${t.type.toUpperCase()}`, 20, 60);
      doc.text(`Categoría: ${t.category}`, 20, 70);
      doc.text(`Estado: ${t.status.toUpperCase()}`, 20, 80);
      if (t.due_date) {
        doc.text(`Vencimiento: ${new Date(t.due_date).toLocaleDateString()}`, 20, 90);
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
        <div className="logs-panel glass-panel">
          <div className="movimientos-header">
            <div className="search-container" style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Buscar movimiento..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            
            <button className="btn-add" onClick={() => setShowModal(true)}>
              <Plus size={20} />
              Añadir Movimiento
            </button>
          </div>
          
          <div className="table-responsive">
            <table className="movimientos-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Monto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(t => (
                  <tr key={t.id}>
                    <td>
                      {t.type === 'ingreso' 
                        ? <span className="badge-ingreso"><ArrowUpRight size={14} style={{verticalAlign: 'text-bottom'}} /> Ingreso</span> 
                        : <span className="badge-egreso"><ArrowDownRight size={14} style={{verticalAlign: 'text-bottom'}} /> Egreso</span>
                      }
                    </td>
                    <td>{new Date(t.date).toLocaleDateString()}</td>
                    <td><strong>{t.concept}</strong></td>
                    <td>{t.category}</td>
                    <td>
                      {t.status}
                      {t.status === 'Pendiente' && t.due_date && new Date(t.due_date) < new Date() && (
                        <span style={{color: '#EF4444', display: 'block', fontSize: '12px'}}>¡Vencido!</span>
                      )}
                    </td>
                    <td className={t.type === 'ingreso' ? 'amount-ingreso' : 'amount-egreso'}>
                      {t.type === 'ingreso' ? '+' : '-'}{formatCurrency(t.amount)}
                      {t.tax_amount > 0 && <span style={{display: 'block', fontSize: '11px', color: 'var(--text-muted)'}}>Inc. IVA</span>}
                    </td>
                    <td style={{display: 'flex', gap: '8px'}}>
                      {t.attachment_path && (
                        <button className="btn-delete" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6'}} onClick={() => window.open(t.attachment_path, '_blank')}>
                          <Paperclip size={16} />
                        </button>
                      )}
                      <button className="btn-delete" style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10B981'}} onClick={() => generatePDF(t)} title="Generar PDF">
                        <Download size={16} />
                      </button>
                      <button className="btn-delete" onClick={() => setTransactionToDelete(t.id)} title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && !loading && (
                  <tr>
                    <td colSpan="7" style={{textAlign: 'center', padding: '32px', color: 'var(--text-muted)'}}>
                      No se encontraron movimientos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <h3>Registrar Nuevo Movimiento</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tipo de Movimiento</label>
                <select 
                  value={formData.type} 
                  onChange={(e) => setFormData({...formData, type: e.target.value, category: e.target.value === 'ingreso' ? 'Ventas' : 'Operación'})}
                  style={{ padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso (Gasto)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Concepto (Descripción)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej. Pago de Cliente, Factura Luz"
                  value={formData.concept}
                  onChange={(e) => setFormData({...formData, concept: e.target.value})}
                  style={{ padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>Monto</label>
                  <input 
                    type="number" 
                    required 
                    step="0.01" 
                    min="0"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    style={{ padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '32px' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.calculate_tax}
                    onChange={(e) => setFormData({...formData, calculate_tax: e.target.checked})}
                    id="tax_checkbox"
                    style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                  />
                  <label htmlFor="tax_checkbox" style={{fontSize: '13px', cursor: 'pointer', margin: 0}}>Incluir IVA (16%)</label>
                </div>
              </div>

              <div className="form-group">
                <label>Categoría</label>
                {formData.type === 'ingreso' ? (
                  <select 
                    value={formData.category} 
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    style={{ padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="Ventas">Ventas</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Inversiones">Inversiones</option>
                    <option value="Otros Ingresos">Otros Ingresos</option>
                  </select>
                ) : (
                  <select 
                    value={formData.category} 
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    style={{ padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="Operación">Gastos Operativos</option>
                    <option value="Nómina">Nómina</option>
                    <option value="Tecnología">Tecnología / Software</option>
                    <option value="Servicios Básicos">Servicios Básicos</option>
                    <option value="Marketing">Marketing y Ventas</option>
                    <option value="Otros Egresos">Otros Egresos</option>
                  </select>
                )}
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label>Fecha</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Estado</label>
                  <select 
                    value={formData.status} 
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="Pagado">Pagado / Cobrado</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </div>
              </div>

              {formData.status === 'Pendiente' && (
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label style={{color: '#F59E0B'}}>Fecha de Vencimiento</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(245, 158, 11, 0.4)' }}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Comprobante Físico (Opcional)</label>
                <input 
                  type="file"
                  onChange={(e) => setAttachmentFile(e.target.files[0])}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px dashed rgba(255,255,255,0.2)' }}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-add">Guardar Movimiento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transactionToDelete && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <Trash2 size={48} color="#EF4444" style={{ margin: '0 auto 16px' }} />
            <h3>Eliminar Movimiento</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              ¿Estás seguro de que deseas eliminar permanentemente este movimiento? Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn-cancel" onClick={() => setTransactionToDelete(null)}>Cancelar</button>
              <button type="button" className="btn-add" style={{ background: '#EF4444' }} onClick={handleDelete}>Sí, Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="slide-up" style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', borderLeft: '4px solid #EF4444', color: 'white', zIndex: 9999, maxWidth: '400px' }}>
          {toastMessage}
        </div>
      )}
    </>
  );
}

export default FinanzasMovimientos;
