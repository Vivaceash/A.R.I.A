import { useState, useEffect } from 'react';
import { Search, ShieldAlert, AlertTriangle, Shield, Info } from 'lucide-react';
import Header from '../components/Header';
import './DiccionarioAmenazas.css';

function DiccionarioAmenazas() {
  const [signatures, setSignatures] = useState({ malicious_hashes: [], malicious_patterns: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('/api/signatures')
      .then(res => res.json())
      .then(data => {
        setSignatures(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching signatures:', err);
        setLoading(false);
      });
  }, []);

  // Combine both arrays into one for the display
  const allThreats = [
    ...(signatures.malicious_hashes || []).map(h => ({ ...h, category: 'Hash (Archivo Exacto)' })),
    ...(signatures.malicious_patterns || []).map(p => ({ ...p, category: 'Patrón / Código' }))
  ];

  const filteredThreats = allThreats.filter(threat => 
    (threat.name && threat.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (threat.type && threat.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (threat.impact && threat.impact.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (threat.description && threat.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getSeverityIcon = (severity) => {
    const s = (severity || '').toLowerCase();
    if (s === 'crítico') return <ShieldAlert size={24} />;
    if (s === 'alto') return <AlertTriangle size={24} />;
    if (s === 'medio') return <Shield size={24} />;
    return <Info size={24} />;
  };

  const getSeverityClass = (severity) => {
    return `severity-${(severity || 'bajo').toLowerCase()}`;
  };

  return (
    <>
      <Header title="Diccionario de Amenazas" showTimeframe={false} />
      
      <div className="diccionario-container">
        <div className="diccionario-header">
          <div className="diccionario-stats">
            <h2>{allThreats.length}</h2>
            <p>Firmas y Amenazas Registradas</p>
          </div>
          <div className="search-container">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, tipo o impacto..." 
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Cargando base de datos de amenazas...</div>
        ) : filteredThreats.length === 0 ? (
          <div className="empty-state">No se encontraron amenazas que coincidan con la búsqueda.</div>
        ) : (
          <div className="amenaza-list">
            {filteredThreats.map((threat, idx) => (
              <div key={idx} className={`amenaza-card ${getSeverityClass(threat.severity)}`}>
                <div className="amenaza-card-header">
                  <div className="amenaza-icon">
                    {getSeverityIcon(threat.severity)}
                  </div>
                  <div className="amenaza-title">
                    <h3>{threat.name || 'Amenaza Desconocida'}</h3>
                    <span className="amenaza-badge">{threat.severity || 'Desconocido'}</span>
                  </div>
                </div>
                
                <div className="amenaza-details">
                  <div className="detail-row">
                    <span className="detail-label">Categoría</span>
                    <span className="detail-value">{threat.category}{threat.type ? ` - ${threat.type}` : ''}</span>
                  </div>
                  
                  {(threat.hash || threat.pattern) && (
                    <div className="detail-row">
                      <span className="detail-label">Firma Técnica</span>
                      <span className="detail-value pattern-code">{threat.hash || threat.pattern}</span>
                    </div>
                  )}

                  <div className="detail-row">
                    <span className="detail-label">Impacto y Vulnerabilidad</span>
                    <span className="detail-value">{threat.impact || threat.description}</span>
                  </div>

                  {threat.mitigation && (
                    <div className="detail-row">
                      <span className="detail-label">Mitigación / Solución</span>
                      <span className="detail-value">{threat.mitigation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default DiccionarioAmenazas;
