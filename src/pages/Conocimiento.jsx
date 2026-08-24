import { useState, useEffect } from 'react';
import { Brain, RefreshCcw, Database, FileText, Hash, HardDrive, Loader2, CheckCircle2, AlertCircle, Share2, Activity } from 'lucide-react';
import VaultGraph from '../components/VaultGraph';
import './Conocimiento.css';

const Conocimiento = () => {
  const [activeTab, setActiveTab] = useState('graph'); // 'graph' | 'stats'
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState(null);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/rag/status');
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleReindex = async () => {
    setReindexing(true);
    setReindexResult(null);
    try {
      const res = await fetch('/api/rag/reindex', { method: 'POST' });
      const data = await res.json();
      setReindexResult(data);
      await fetchStats();
    } catch (err) {
      setReindexResult({ status: 'error', message: 'Error al re-indexar' });
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="conocimiento-page">
      <div className="page-header">
        <div className="header-title">
          <Brain size={28} />
          <h1>Base de Conocimiento</h1>
        </div>
        <p className="header-subtitle">
          Sistema RAG vectorial y Memoria Gráfica — Obsidian Vault + ChromaDB
        </p>

        {/* Tab Navigation */}
        <div className="conocimiento-tabs">
          <button
            className={`tab-btn ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            <Share2 size={16} />
            Grafo de Memoria (Obsidian View)
          </button>
          <button
            className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <Activity size={16} />
            Métricas e Indexación RAG
          </button>
        </div>
      </div>

      {activeTab === 'graph' ? (
        <div className="graph-tab-content">
          <VaultGraph />
        </div>
      ) : (
        <>
          {loading ? (
            <div className="loading-state">
              <Loader2 size={32} className="spinner" />
              <p>Cargando estadísticas del índice...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <AlertCircle size={32} />
              <p>{error}</p>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-icon"><Database size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-value">{stats?.total_chunks || 0}</span>
                    <span className="stat-label">Chunks Totales</span>
                  </div>
                </div>

                <div className="stat-card vault">
                  <div className="stat-icon"><FileText size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-value">{stats?.vault_chunks || 0}</span>
                    <span className="stat-label">Chunks Vault (Obsidian)</span>
                  </div>
                </div>

                <div className="stat-card monitored">
                  <div className="stat-icon"><Hash size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-value">{stats?.monitored_chunks || 0}</span>
                    <span className="stat-label">Chunks Monitoreados</span>
                  </div>
                </div>

                <div className="stat-card storage">
                  <div className="stat-icon"><HardDrive size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-value">{stats?.chroma_db_size_mb || 0} MB</span>
                    <span className="stat-label">Tamaño ChromaDB</span>
                  </div>
                </div>
              </div>

              {/* Details Section */}
              <div className="details-grid">
                <div className="detail-card">
                  <h3>Configuración del Índice</h3>
                  <div className="detail-rows">
                    <div className="detail-row">
                      <span className="detail-label">Estado</span>
                      <span className={`detail-badge ${stats?.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                        {stats?.status === 'active' ? '● Activo' : '○ Inactivo'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Modelo de Embeddings</span>
                      <span className="detail-value">{stats?.embedding_model || '—'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Vault Path</span>
                      <span className="detail-value mono">{stats?.vault_path || '—'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Directorio Monitoreado</span>
                      <span className="detail-value mono">{stats?.monitored_path || '—'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Última Indexación</span>
                      <span className="detail-value">
                        {stats?.last_indexed 
                          ? new Date(stats.last_indexed).toLocaleString('es-MX')
                          : 'Nunca'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="detail-card">
                  <h3>Acciones</h3>
                  <div className="actions-section">
                    <button 
                      className={`reindex-btn ${reindexing ? 'loading' : ''}`}
                      onClick={handleReindex}
                      disabled={reindexing}
                    >
                      {reindexing ? (
                        <><Loader2 size={18} className="spinner" /> Re-indexando...</>
                      ) : (
                        <><RefreshCcw size={18} /> Re-indexar Todo</>
                      )}
                    </button>
                    <p className="action-desc">
                      Re-indexa todo el vault de Obsidian y el directorio monitoreado. 
                      Los cambios en el vault se indexan automáticamente, pero puedes forzar una re-indexación completa aquí.
                    </p>

                    {reindexResult && (
                      <div className={`reindex-result ${reindexResult.status === 'ok' ? 'success' : 'error'}`}>
                        {reindexResult.status === 'ok' ? (
                          <>
                            <CheckCircle2 size={18} />
                            <div>
                              <strong>Re-indexación completada</strong>
                              <span>
                                {reindexResult.vault_chunks} chunks vault + {reindexResult.directory_chunks} chunks directorio = {reindexResult.total_chunks} total
                                ({reindexResult.time_ms}ms)
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={18} />
                            <span>{reindexResult.message || 'Error desconocido'}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="info-box">
                    <h4>¿Cómo funciona la Memoria RAG?</h4>
                    <ul>
                      <li><strong>Obsidian</strong> es la memoria visible — notas .md organizadas por categorías.</li>
                      <li><strong>ChromaDB</strong> indexa semánticamente las notas con vectores de 768 dimensiones.</li>
                      <li><strong>Vault Watcher</strong> detecta notas nuevas en Obsidian y las vectoriza en 2 segundos.</li>
                      <li><strong>MemoryWriter</strong> escribe memorias de incidentes, auditorías y aprendizajes dictados por el Padre.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Conocimiento;
