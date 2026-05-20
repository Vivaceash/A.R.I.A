import React from 'react';
import { X, Sparkles, AlertTriangle } from 'lucide-react';
import './AiAnalysisModal.css';

// Markdown parser helper for structured AI analysis
const formatMarkdown = (text) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  const renderedElements = [];
  
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];
  
  const parseInline = (textSegment) => {
    if (!textSegment) return '';
    // Match inline code and bold text
    const parts = textSegment.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={idx} className="markdown-inline-code">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for GFM table syntax
    if (line.startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      const isSeparator = cells.every(c => c.startsWith(':') || c.startsWith('-') || c.endsWith(':'));
      
      if (isSeparator) {
        continue;
      }
      
      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      if (inTable) {
        renderedElements.push(
          <div key={`table-${i}`} className="markdown-table-wrapper">
            <table className="markdown-table">
              <thead>
                <tr>
                  {tableHeaders.map((h, idx) => <th key={idx}>{parseInline(h)}</th>)}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => <td key={cIdx}>{parseInline(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }
    }
    
    if (line === '') {
      renderedElements.push(<div key={`empty-${i}`} className="markdown-para-spacing" />);
      continue;
    }
    
    // Check headings
    if (line.startsWith('### ')) {
      renderedElements.push(<h4 key={`h3-${i}`} className="markdown-h3">{parseInline(line.substring(4))}</h4>);
    } else if (line.startsWith('## ')) {
      renderedElements.push(<h3 key={`h2-${i}`} className="markdown-h2">{parseInline(line.substring(3))}</h3>);
    } else if (line.startsWith('# ')) {
      renderedElements.push(<h2 key={`h1-${i}`} className="markdown-h1">{parseInline(line.substring(2))}</h2>);
    } else if (line.startsWith('* ') || line.startsWith('- ')) {
      renderedElements.push(
        <ul key={`ul-${i}`} className="markdown-list">
          <li key={`li-${i}`}>{parseInline(line.substring(2))}</li>
        </ul>
      );
    } else if (line === '***' || line === '---' || line === '___') {
      renderedElements.push(<hr key={`hr-${i}`} className="markdown-hr" />);
    } else {
      renderedElements.push(<p key={`p-${i}`} className="markdown-p">{parseInline(line)}</p>);
    }
  }
  
  if (inTable) {
    renderedElements.push(
      <div key="table-end" className="markdown-table-wrapper">
        <table className="markdown-table">
          <thead>
            <tr>
              {tableHeaders.map((h, idx) => <th key={idx}>{parseInline(h)}</th>)}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => <td key={cIdx}>{parseInline(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  
  return <div className="markdown-body-rendered">{renderedElements}</div>;
};

const AiAnalysisModal = ({ isOpen, onClose, alert }) => {
  if (!isOpen || !alert) return null;

  return (
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div className="modal-content slide-up ai-analysis-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="ai-avatar-badge">
              <Sparkles size={18} className="ai-spark-icon" />
            </div>
            <div>
              <h3>Auditoría de Cambios por IA</h3>
              <p className="modal-subtitle">Archivo: {alert.title || alert.filename}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          {alert.aiAnalysis ? (
            formatMarkdown(alert.aiAnalysis)
          ) : (
            <div className="modal-empty-state">
              <AlertTriangle size={48} className="empty-icon text-warning" />
              <p>No hay un análisis detallado disponible para esta alerta.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiAnalysisModal;
