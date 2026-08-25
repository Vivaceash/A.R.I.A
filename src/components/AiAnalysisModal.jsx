import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  AlertTriangle, 
  Copy, 
  Check, 
  Download, 
  Maximize2, 
  Minimize2, 
  FileText, 
  Calendar, 
  User, 
  HardDrive,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    if (line.startsWith('#### ')) {
      renderedElements.push(<h5 key={`h4-${i}`} className="markdown-h4">{parseInline(line.substring(5))}</h5>);
    } else if (line.startsWith('### ')) {
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

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return 'Desconocido';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const cleanTextForPDF = (text) => {
  if (!text) return '';

  // 1. Remove all emojis, surrogate pairs, dingbats, and pictographs that corrupt jsPDF standard fonts
  let cleaned = text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25FE}\u{25FD}\u{25FB}\u{25FC}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}\u{200B}-\u{200D}\u{E000}-\u{F8FF}]/gu, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^#+\s*/, '')
    .replace(/^[\*\-]\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 2. Strip any remaining characters outside standard Latin-1 printable range
  cleaned = cleaned.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '');

  return cleaned.trim();
};

const generateAuditPDF = (alert, analysisText) => {
  if (!analysisText) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 18;
  const contentWidth = pageWidth - margin * 2; // 174mm

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line
  doc.setFillColor(59, 130, 246); // Blue 500
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Title in Header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('A.R.I.A  |  INFORME DE AUDITORÍA Y ANÁLISIS DE CAMBIOS', margin, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Sistema Autónomo de Monitoreo e Integridad Documental', margin, 20);

  const genDate = new Date().toLocaleString();
  doc.text(`Fecha de emisión: ${genDate}`, pageWidth - margin, 20, { align: 'right' });

  // 2. Metadata Table
  const fileName = cleanTextForPDF(alert.title || alert.filename || 'Documento');
  const severity = (alert.severity || 'Medio').toUpperCase();
  const owner = cleanTextForPDF(alert.owner || 'Sistema');
  const fileSize = alert.fileSize ? formatFileSize(alert.fileSize) : 'N/A';
  const eventDate = alert.timestamp ? new Date(alert.timestamp).toLocaleString() : alert.time || 'Reciente';
  const eventType = cleanTextForPDF(alert.type || 'Auditoría / Comparación');

  autoTable(doc, {
    startY: 36,
    head: [['Propiedad', 'Detalle']],
    body: [
      ['Archivo Analizado', fileName],
      ['Propietario / Autor', owner],
      ['Tamaño de Archivo', fileSize],
      ['Fecha del Evento', eventDate],
      ['Tipo de Evento', eventType],
      ['Nivel de Severidad', severity],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 9.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', textColor: [71, 85, 105] },
      1: { cellWidth: 'auto', textColor: [15, 23, 42] },
    },
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
    },
    didParseCell: (data) => {
      if (data.row.index === 5 && data.column.index === 1) {
        if (severity === 'ALTO' || severity === 'HIGH') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (severity === 'MEDIO' || severity === 'MEDIUM') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  let currentY = doc.lastAutoTable.finalY + 10;

  // 3. Parse and Render Markdown Sections
  const lines = analysisText.split('\n');
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];

  const checkPageBreak = (neededHeight = 12) => {
    if (currentY + neededHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();

    // Table parsing
    if (rawLine.startsWith('|')) {
      const cells = rawLine.split('|').map(c => cleanTextForPDF(c)).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      const isSeparator = cells.every(c => c.startsWith(':') || c.startsWith('-') || c.endsWith(':'));
      if (isSeparator) continue;

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      if (inTable) {
        autoTable(doc, {
          startY: currentY,
          head: [tableHeaders],
          body: tableRows,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 9 },
          styles: { fontSize: 8.5, cellPadding: 2.5 },
        });
        currentY = doc.lastAutoTable.finalY + 6;
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }
    }

    if (!rawLine) {
      currentY += 3;
      continue;
    }

    const cleanedText = cleanTextForPDF(rawLine);
    if (!cleanedText) continue;

    // Headings
    if (rawLine.startsWith('# ') || rawLine.startsWith('## ')) {
      checkPageBreak(16);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, currentY, contentWidth, 8, 1.5, 1.5, 'F');
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, currentY, 2.5, 8, 'F');

      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(cleanedText, margin + 6, currentY + 5.5);
      currentY += 12;
    } else if (rawLine.startsWith('### ') || rawLine.startsWith('#### ')) {
      checkPageBreak(12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text(cleanedText, margin, currentY);
      currentY += 6;
    } else if (rawLine.startsWith('* ') || rawLine.startsWith('- ')) {
      checkPageBreak(8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);

      // Bullet dot
      doc.setFillColor(59, 130, 246);
      doc.circle(margin + 2, currentY - 1, 0.9, 'F');

      const splitBullet = doc.splitTextToSize(cleanedText, contentWidth - 8);
      doc.text(splitBullet, margin + 6, currentY);
      currentY += splitBullet.length * 4.5 + 1.5;
    } else if (rawLine === '---' || rawLine === '***') {
      checkPageBreak(6);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 6;
    } else {
      checkPageBreak(8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const splitP = doc.splitTextToSize(cleanedText, contentWidth);
      doc.text(splitP, margin, currentY);
      currentY += splitP.length * 4.5 + 2;
    }
  }

  // Handle trailing table if text ended in table
  if (inTable) {
    autoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
    });
  }

  // 4. Footers with Page Numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('A.R.I.A Security Engine • Informe Confidencial de Auditoría', margin, pageHeight - 7);
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  doc.save(`Auditoria_${fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
};

const AiAnalysisModal = ({ isOpen, onClose, alert }) => {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen || !alert) return null;

  const fileName = alert.title || alert.filename || 'Documento';
  const analysisText = alert.aiAnalysis || '';

  const handleCopy = () => {
    if (!analysisText) return;
    navigator.clipboard.writeText(analysisText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownloadPDF = () => {
    if (!analysisText) return;
    generateAuditPDF(alert, analysisText);
  };

  const getSeverityBadge = () => {
    const sev = alert.severity || 'Medio';
    const isHigh = sev.toLowerCase() === 'alto' || sev.toLowerCase() === 'high';
    const isMed = sev.toLowerCase() === 'medio' || sev.toLowerCase() === 'medium';

    return (
      <span className={`ai-badge-severity ${isHigh ? 'severity-high' : isMed ? 'severity-med' : 'severity-low'}`}>
        {isHigh ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
        {sev}
      </span>
    );
  };

  return (
    <div className="ai-analysis-modal-overlay fade-in" onClick={onClose}>
      <div 
        className={`ai-analysis-modal-window slide-up ${isFullscreen ? 'modal-fullscreen' : ''}`} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="ai-modal-header">
          <div className="ai-modal-title-group">
            <div className="ai-avatar-badge">
              <Sparkles size={22} className="ai-spark-icon" />
            </div>
            <div className="ai-title-column">
              <div className="ai-title-row">
                <h3>Auditoría y Análisis de Cambios por IA</h3>
                {getSeverityBadge()}
              </div>
              <p className="ai-modal-subtitle">
                <FileText size={14} className="inline-icon" /> <span>{fileName}</span>
              </p>
            </div>
          </div>

          <div className="ai-modal-header-actions">
            {analysisText && (
              <>
                <button 
                  className={`ai-action-btn ${copied ? 'copied' : ''}`} 
                  onClick={handleCopy}
                  title="Copiar texto del análisis al portapapeles"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
                </button>
                <button 
                  className="ai-action-btn" 
                  onClick={handleDownloadPDF}
                  title="Descargar reporte oficial en formato PDF"
                >
                  <Download size={16} />
                  <span>Exportar PDF</span>
                </button>
              </>
            )}

            <button 
              className="ai-action-btn icon-only" 
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Restaurar tamaño normal" : "Expandir a pantalla completa"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            <button className="ai-modal-close-btn" onClick={onClose} title="Cerrar modal">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="ai-meta-strip">
          <div className="ai-meta-item">
            <User size={14} className="meta-icon" />
            <span className="meta-label">Autor / Propietario:</span>
            <strong className="meta-val">{alert.owner || 'Sistema'}</strong>
          </div>
          {alert.fileSize && (
            <div className="ai-meta-item">
              <HardDrive size={14} className="meta-icon" />
              <span className="meta-label">Tamaño:</span>
              <strong className="meta-val">{formatFileSize(alert.fileSize)}</strong>
            </div>
          )}
          <div className="ai-meta-item">
            <Calendar size={14} className="meta-icon" />
            <span className="meta-label">Fecha del evento:</span>
            <strong className="meta-val">{alert.timestamp ? new Date(alert.timestamp).toLocaleString() : alert.time || 'Reciente'}</strong>
          </div>
          {alert.type && (
            <div className="ai-meta-item">
              <span className="meta-label">Tipo:</span>
              <span className="ai-type-pill">{alert.type}</span>
            </div>
          )}
        </div>
        
        {/* Body content */}
        <div className="ai-modal-body">
          {analysisText ? (
            formatMarkdown(analysisText)
          ) : (
            <div className="modal-empty-state">
              <AlertTriangle size={56} className="empty-icon text-warning" />
              <h4>Análisis Pendiente o No Disponible</h4>
              <p>No se ha generado un reporte detallado para este evento todavía.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiAnalysisModal;
