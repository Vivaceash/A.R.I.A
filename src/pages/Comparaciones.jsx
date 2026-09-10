import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  FileCode,
  FolderArchive,
  Terminal,
  Music,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  Grid,
  List as ListIcon,
  Filter,
  Check,
  RotateCcw,
  Trash2,
  Maximize2,
  Minimize2,
  AlertTriangle,
  History,
  Sparkles,
  RotateCw,
  Folder,
  Copy,
  Download,
  ShieldAlert,
  ShieldCheck,
  User,
  HardDrive,
  Calendar
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Header from '../components/Header';
import PdfIcon from '../components/PdfIcon';
import DocIcon from '../components/DocIcon';
import XlsIcon from '../components/XlsIcon';
import { useAuth } from '../contexts/AuthContext';
import './Comparaciones.css';

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

const cleanTextForPDF = (text) => {
  if (!text) return '';
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
  cleaned = cleaned.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '');
  return cleaned.trim();
};

const generateAuditPDF = (file, analysisText) => {
  if (!analysisText) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 28, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('A.R.I.A  |  INFORME DE AUDITORÍA Y ANÁLISIS DE CAMBIOS', margin, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Sistema Autónomo de Monitoreo e Integridad Documental', margin, 20);

  const genDate = new Date().toLocaleString();
  doc.text(`Fecha de emisión: ${genDate}`, pageWidth - margin, 20, { align: 'right' });

  // Metadata Table
  const fileName = cleanTextForPDF(file.name || 'Documento');
  const severity = (file.severity || 'Medio').toUpperCase();
  const owner = cleanTextForPDF(file.owner || 'Astra');
  const fileSize = file.size ? formatSize(file.size) : 'N/A';
  const eventDate = file.latestTimestamp ? new Date(file.latestTimestamp).toLocaleString() : 'Reciente';

  autoTable(doc, {
    startY: 36,
    head: [['Propiedad', 'Detalle']],
    body: [
      ['Archivo Analizado', fileName],
      ['Propietario / Autor', owner],
      ['Tamaño de Archivo', fileSize],
      ['Fecha del Evento', eventDate],
      ['Versiones Respaldadas', String(file.versionCount || 1)],
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

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileExtension = (filename) => {
  if (!filename) return 'FILE';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
};

const getFileCategoryColor = (filename) => {
  if (!filename) return '#6B7280';
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  switch (ext) {
    case 'pdf': return '#EF4444';
    case 'doc':
    case 'docx': return '#3B82F6';
    case 'xls':
    case 'xlsx':
    case 'csv': return '#10B981';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'svg':
    case 'gif': return '#F59E0B';
    case 'py':
    case 'js':
    case 'jsx':
    case 'html':
    case 'css':
    case 'json': return '#8B5CF6';
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz': return '#EC4899';
    case 'txt':
    case 'md':
    case 'conf':
    case 'log': return '#64748B';
    case 'flac':
    case 'mp3':
    case 'wav': return '#06B6D4';
    case 'sh':
    case 'bash': return '#14B8A6';
    default: return '#6B7280';
  }
};

const getMinimalFileIcon = (filename, size = 22) => {
  if (!filename) return <File size={size} style={{ color: '#9CA3AF' }} />;
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  switch (ext) {
    case 'pdf': return <PdfIcon size={size} color="#EF4444" />;
    case 'doc':
    case 'docx': return <DocIcon size={size} color="#3B82F6" label={ext.toUpperCase()} />;
    case 'xls':
    case 'xlsx':
    case 'csv': return <XlsIcon size={size} color="#10B981" label={ext.toUpperCase()} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'svg':
    case 'gif': return <ImageIcon size={size} style={{ color: '#F59E0B' }} />;
    case 'py':
    case 'js':
    case 'jsx':
    case 'html':
    case 'css':
    case 'json': return <FileCode size={size} style={{ color: '#8B5CF6' }} />;
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar': return <FolderArchive size={size} style={{ color: '#EC4899' }} />;
    case 'sh':
    case 'bash': return <Terminal size={size} style={{ color: '#14B8A6' }} />;
    case 'flac':
    case 'mp3':
    case 'wav': return <Music size={size} style={{ color: '#06B6D4' }} />;
    case 'txt':
    case 'md':
    case 'conf':
    case 'log': return <FileText size={size} style={{ color: '#94A3B8' }} />;
    default: return <File size={size} style={{ color: '#9CA3AF' }} />;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'Desconocida';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

const formatTime = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return '';
  }
};

export default function Comparaciones() {
  const { module } = useParams();
  const { user } = useAuth();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('latestTimestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedExtensions, setSelectedExtensions] = useState([]);
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Pop-up Modal State
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('auditoria'); // 'auditoria' (default) or 'boveda'
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [snapshotContent, setSnapshotContent] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/comparisons?module=${module || 'general'}`);
      if (!response.ok) throw new Error('Error al obtener comparaciones');
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error("Error cargando comparaciones:", error);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    fetchFiles();

    let ws = null;
    let reconnectTimeout = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      try {
        ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (['modified', 'deleted', 'created', 'resolved'].includes(message.type)) {
              fetchFiles();
            }
          } catch (e) {
            // ignore
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {};
      } catch (e) {}
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => ws.close();
        }
      }
    };
  }, [fetchFiles]);

  const loadSnapshotContent = useCallback(async (snapshotId) => {
    setIsLoadingContent(true);
    try {
      const res = await fetch(`/api/vault/snapshots/${snapshotId}/content`);
      if (!res.ok) throw new Error('Error al cargar versión');
      const data = await res.json();
      setSnapshotContent(data.content || '');
    } catch (err) {
      console.error('Error fetching snapshot content', err);
      setSnapshotContent('Error al cargar el contenido de esta versión.');
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  const handleOpenFileModal = (file, initialTab = 'auditoria') => {
    setSelectedFile(file);
    setActiveModalTab(initialTab); // Default to 'auditoria' as requested
    setIsFullscreen(false);
    setCopied(false);

    if (file.snapshots && file.snapshots.length > 0) {
      const latest = file.snapshots[0];
      setSelectedSnapshot(latest);
      loadSnapshotContent(latest.id);
    } else {
      setSelectedSnapshot(null);
      setSnapshotContent('');
    }
  };

  const handleSelectSnapshot = (snap) => {
    setSelectedSnapshot(snap);
    loadSnapshotContent(snap.id);
  };

  const handleCopyAnalysis = () => {
    if (!selectedFile?.aiAnalysis) return;
    navigator.clipboard.writeText(selectedFile.aiAnalysis).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownloadPDF = () => {
    if (!selectedFile?.aiAnalysis) return;
    generateAuditPDF(selectedFile, selectedFile.aiAnalysis);
  };

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const confirmRestore = async () => {
    if (!selectedSnapshot || isRestoring) return;
    setIsRestoring(true);
    try {
      const res = await fetch(`/api/vault/restore/${selectedSnapshot.id}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setShowRestoreModal(false);
        showToast(`¡Archivo restaurado con éxito como ${data.new_filename}!`);
        fetchFiles();
      } else {
        showToast(data.message || 'Error al restaurar el archivo', 'error');
      }
    } catch (err) {
      showToast('Error de conexión al restaurar el archivo.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedSnapshot || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/vault/snapshots/${selectedSnapshot.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setShowDeleteModal(false);
        showToast('¡Registro eliminado definitivamente de la bóveda!');
        setSelectedFile(null);
        setSelectedSnapshot(null);
        fetchFiles();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || 'Error al eliminar el registro.', 'error');
      }
    } catch (err) {
      showToast('Error de conexión al eliminar el registro.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const availableExtensions = useMemo(() => {
    const exts = new Set();
    files.forEach(f => {
      const parts = f.name.split('.');
      const ext = parts.length > 1 ? parts.pop().toLowerCase() : 'otros';
      exts.add(ext);
    });
    return Array.from(exts).sort();
  }, [files]);

  const toggleExtension = (ext) => {
    setSelectedExtensions(prev => 
      prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
    );
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const processedFiles = useMemo(() => {
    let filtered = files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.owner && f.owner.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.folder && f.folder.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });

    if (selectedExtensions.length > 0) {
      filtered = filtered.filter(f => {
        const parts = f.name.split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : 'otros';
        return selectedExtensions.includes(ext);
      });
    }

    return filtered.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortBy === 'size') {
        valA = a.size || 0;
        valB = b.size || 0;
      } else if (sortBy === 'versionCount') {
        valA = a.versionCount || 0;
        valB = b.versionCount || 0;
      } else if (sortBy === 'type') {
        valA = a.name.split('.').pop().toLowerCase();
        valB = b.name.split('.').pop().toLowerCase();
      } else {
        valA = new Date(a.latestTimestamp || a.timestamp || 0).getTime();
        valB = new Date(b.latestTimestamp || b.timestamp || 0).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [files, searchTerm, sortBy, sortOrder, selectedExtensions]);

  const getSeverityBadge = (severity) => {
    const sev = severity || 'Medio';
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
    <div className="comparaciones-page-wrapper">
      <Header
        title={module ? `Comparaciones de ${module.charAt(0).toUpperCase() + module.slice(1)}` : "Historial de comparaciones"}
        showTimeframe={false}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`archivos-toast ${toastMessage.type === 'error' ? 'error' : 'success'} fade-in`}>
          <span>{toastMessage.msg}</span>
          <button onClick={() => setToastMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="comparaciones-container">
        {/* Toolbar Bar */}
        <div className="archivos-toolbar">
          {/* Search Bar */}
          <div className="archivos-search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre, propietario o carpeta..."
              className="archivos-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="archivos-toolbar-right">
            {/* Filter Toggle */}
            <button
              className={`toolbar-btn filter-toggle-btn ${showFiltersModal || selectedExtensions.length > 0 ? 'active' : ''}`}
              onClick={() => setShowFiltersModal(!showFiltersModal)}
              title="Filtros por extensión"
            >
              <Filter size={16} />
              <span>Filtros</span>
              {selectedExtensions.length > 0 && (
                <span className="filters-count-badge">{selectedExtensions.length}</span>
              )}
            </button>

            {/* View Mode Toggle */}
            <div className="view-mode-switch">
              <button
                className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Vista de Cuadrícula"
              >
                <Grid size={17} />
              </button>
              <button
                className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="Vista de Lista"
              >
                <ListIcon size={17} />
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="sort-box">
              <span className="sort-label">Ordenar por:</span>
              <select
                className="sort-dropdown"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="latestTimestamp">Fecha de cambio</option>
                <option value="name">Nombre</option>
                <option value="versionCount">Cant. Versiones</option>
                <option value="type">Tipo de archivo</option>
                <option value="size">Tamaño</option>
              </select>
              <button
                className="sort-direction-btn"
                onClick={toggleSortOrder}
                title={`Orden ${sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}`}
              >
                {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Filters Drawer Popup */}
        {showFiltersModal && (
          <div className="filters-drawer fade-in">
            <div className="filters-drawer-header">
              <span>Filtrar por extensión de archivo modificado</span>
              {selectedExtensions.length > 0 && (
                <button className="reset-filters-btn" onClick={() => setSelectedExtensions([])}>
                  Limpiar filtros
                </button>
              )}
            </div>
            <div className="filter-chips-grid">
              {availableExtensions.map((ext) => (
                <button
                  key={ext}
                  className={`filter-chip ${selectedExtensions.includes(ext) ? 'active' : ''}`}
                  onClick={() => toggleExtension(ext)}
                >
                  <span>.{ext}</span>
                  {selectedExtensions.includes(ext) && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section Header */}
        <div className="archivos-section">
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <History size={20} style={{ color: 'var(--accent-primary)' }} />
              <h2 className="section-title">Archivos Modificados con Historial</h2>
            </div>
            <span className="files-count-badge-total">
              {processedFiles.length} {processedFiles.length === 1 ? 'archivo con versiones' : 'archivos con versiones'}
            </span>
          </div>

          {loading ? (
            <div className="loading-state-card">
              <RotateCw size={24} className="spin-icon" />
              <p>Cargando historial de archivos modificados...</p>
            </div>
          ) : processedFiles.length === 0 ? (
            <div className="empty-files-card">
              <History size={40} className="empty-icon" style={{ opacity: 0.4 }} />
              <p>No se encontraron archivos modificados con los filtros aplicados.</p>
              {(searchTerm || selectedExtensions.length > 0) && (
                <button
                  className="btn-reset-search"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedExtensions([]);
                  }}
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="files-grid-container">
              {processedFiles.map((file, idx) => {
                const categoryColor = getFileCategoryColor(file.name);
                const fileExt = getFileExtension(file.name);
                const formattedDate = formatDate(file.latestTimestamp || file.timestamp);
                const formattedTime = formatTime(file.latestTimestamp || file.timestamp);

                return (
                  <div
                    key={file.name || idx}
                    className="file-item-card comparaciones-card"
                    onClick={() => handleOpenFileModal(file, 'auditoria')}
                    style={{ '--card-accent': categoryColor }}
                  >
                    {/* Top row: Minimalist Colored Icon + Versions Badge */}
                    <div className="file-card-top">
                      <div
                        className="file-icon-box"
                        style={{
                          backgroundColor: `${categoryColor}22`,
                          borderColor: `${categoryColor}40`,
                          color: categoryColor
                        }}
                      >
                        {getMinimalFileIcon(file.name, 22)}
                      </div>

                      <div className="comparaciones-version-pill">
                        <History size={12} />
                        <span>{file.versionCount} {file.versionCount === 1 ? 'versión' : 'versiones'}</span>
                      </div>
                    </div>

                    {/* File Name */}
                    <h4 className="file-card-title" title={file.name}>
                      {file.name}
                    </h4>

                    {/* Format & Size Badge */}
                    <div className="file-card-badge-row">
                      <span
                        className="file-card-ext-pill"
                        style={{
                          color: categoryColor,
                          backgroundColor: `${categoryColor}18`,
                          borderColor: `${categoryColor}35`
                        }}
                      >
                        {fileExt}
                      </span>
                      {file.folder && file.folder !== 'General' && (
                        <span className="file-card-folder-pill">
                          <Folder size={11} /> {file.folder}
                        </span>
                      )}
                      <span className="file-card-size-label">{formatSize(file.size)}</span>
                    </div>

                    {/* Owner & Date */}
                    <div className="file-card-meta">
                      <span className="file-card-owner">{file.owner || 'Astra'}</span>
                      <span className="file-card-date">{formattedDate} {formattedTime}</span>
                    </div>

                    {/* Footer Action: Ver Auditoría */}
                    <div className="comparaciones-card-action">
                      <div className="card-ver-auditoria-btn">
                        <Sparkles size={13} className="action-sparkle" />
                        <span>Ver auditoría</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="files-list-container">
              <table className="files-list-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Versiones</th>
                    <th>Propietario</th>
                    <th>Carpeta</th>
                    <th>Tamaño</th>
                    <th>Última Modificación</th>
                    <th style={{ textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {processedFiles.map((file, idx) => {
                    const categoryColor = getFileCategoryColor(file.name);
                    const fileExt = getFileExtension(file.name);
                    const formattedDate = formatDate(file.latestTimestamp || file.timestamp);
                    const formattedTime = formatTime(file.latestTimestamp || file.timestamp);

                    return (
                      <tr
                        key={file.name || idx}
                        onClick={() => handleOpenFileModal(file, 'auditoria')}
                        className="comparaciones-list-row"
                      >
                        <td className="list-name-cell">
                          <div
                            className="list-icon-badge"
                            style={{
                              backgroundColor: `${categoryColor}20`,
                              borderColor: `${categoryColor}40`,
                              color: categoryColor
                            }}
                          >
                            {getMinimalFileIcon(file.name, 18)}
                          </div>
                          <div className="list-name-wrapper">
                            <span className="list-file-name" title={file.name}>
                              {file.name}
                            </span>
                            <span
                              className="list-ext-pill"
                              style={{
                                color: categoryColor,
                                borderColor: `${categoryColor}35`,
                                backgroundColor: `${categoryColor}15`
                              }}
                            >
                              {fileExt}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="comparaciones-version-pill-inline">
                            <History size={13} /> {file.versionCount} {file.versionCount === 1 ? 'versión' : 'versiones'}
                          </span>
                        </td>
                        <td>{file.owner || 'Astra'}</td>
                        <td>{file.folder || 'General'}</td>
                        <td>{formatSize(file.size)}</td>
                        <td>{formattedDate} {formattedTime}</td>
                        <td className="list-actions-cell" style={{ textAlign: 'right' }}>
                          <button
                            className="btn-inspect-version"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFileModal(file, 'auditoria');
                            }}
                          >
                            <Sparkles size={14} />
                            <span>Ver auditoría</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* POP-UP MODAL: UNIFIED AUDITORÍA & BÓVEDA POP-UP */}
      {selectedFile && (
        <div className="comparaciones-modal-overlay fade-in" onClick={() => setSelectedFile(null)}>
          <div 
            className={`comparaciones-modal-window slide-up ${isFullscreen ? 'modal-fullscreen' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Bar */}
            <div className="modal-header-bar">
              <div className="modal-header-left">
                <div 
                  className="modal-file-icon-box"
                  style={{
                    backgroundColor: `${getFileCategoryColor(selectedFile.name)}22`,
                    borderColor: `${getFileCategoryColor(selectedFile.name)}50`,
                    color: getFileCategoryColor(selectedFile.name)
                  }}
                >
                  {getMinimalFileIcon(selectedFile.name, 24)}
                </div>

                <div className="modal-header-texts">
                  <div className="modal-title-row">
                    <h3 className="modal-filename" title={selectedFile.name}>
                      {selectedFile.name}
                    </h3>
                    <span
                      className="modal-ext-badge"
                      style={{
                        color: getFileCategoryColor(selectedFile.name),
                        backgroundColor: `${getFileCategoryColor(selectedFile.name)}18`,
                        borderColor: `${getFileCategoryColor(selectedFile.name)}40`
                      }}
                    >
                      {getFileExtension(selectedFile.name)}
                    </span>
                    {getSeverityBadge(selectedFile.severity)}
                  </div>

                  <div className="modal-subtitle-row">
                    <span className="file-subtitle-path">
                      Carpeta: <strong>{selectedFile.folder || 'General'}</strong>
                    </span>
                    <span>•</span>
                    <span className="file-subtitle-owner">
                      Propietario: <strong>{selectedFile.owner || 'Astra'}</strong>
                    </span>
                    <span>•</span>
                    <span className="file-subtitle-size">
                      Tamaño: <strong>{formatSize(selectedFile.size)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Contextual Actions in Header */}
              <div className="modal-header-actions">
                {activeModalTab === 'auditoria' ? (
                  <>
                    {selectedFile.aiAnalysis && (
                      <>
                        <button 
                          className={`ai-action-btn ${copied ? 'copied' : ''}`} 
                          onClick={handleCopyAnalysis}
                          title="Copiar texto del análisis al portapapeles"
                        >
                          {copied ? <Check size={15} /> : <Copy size={15} />}
                          <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
                        </button>
                        <button 
                          className="ai-action-btn" 
                          onClick={handleDownloadPDF}
                          title="Descargar reporte oficial en formato PDF"
                        >
                          <Download size={15} />
                          <span>Exportar PDF</span>
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      className="btn-modal-restore"
                      onClick={() => setShowRestoreModal(true)}
                      disabled={!selectedSnapshot}
                      title="Restaurar esta versión como archivo nuevo"
                    >
                      <RotateCcw size={15} />
                      <span>Restaurar Versión</span>
                    </button>

                    {(user?.role === 'Administrador' || user?.department === 'Ciberseguridad') && (
                      <button
                        className="btn-modal-delete"
                        onClick={() => setShowDeleteModal(true)}
                        disabled={!selectedSnapshot}
                        title="Borrar registro de la bóveda"
                      >
                        <Trash2 size={15} />
                        <span>Borrar Registro</span>
                      </button>
                    )}
                  </>
                )}

                <button
                  className="btn-modal-tool"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? "Restaurar tamaño normal" : "Pantalla completa"}
                >
                  {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>

                <button
                  className="btn-modal-close"
                  onClick={() => setSelectedFile(null)}
                  title="Cerrar modal"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            {/* Main Navigation Tabs: Auditoría (Default) vs Bóveda */}
            <div className="modal-main-nav-tabs">
              <button
                className={`modal-main-nav-tab ${activeModalTab === 'auditoria' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('auditoria')}
              >
                <Sparkles size={15} />
                <span>Auditoría y Análisis IA</span>
                {selectedFile.aiAnalysis && <span className="tab-status-dot"></span>}
              </button>
              <button
                className={`modal-main-nav-tab ${activeModalTab === 'boveda' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('boveda')}
              >
                <History size={15} />
                <span>Bóveda de Restauración</span>
                <span className="tab-count-badge">
                  {selectedFile.versionCount || selectedFile.snapshots?.length || 1}
                </span>
              </button>
            </div>

            {/* Modal Body Container */}
            <div className="modal-viewer-body">
              {activeModalTab === 'auditoria' ? (
                /* SECTION 1: AUDITORÍA (DEFAULT) */
                <div className="modal-auditoria-container fade-in">
                  {/* Metadata Strip */}
                  <div className="ai-meta-strip">
                    <div className="ai-meta-item">
                      <User size={14} className="meta-icon" />
                      <span className="meta-label">Autor / Propietario:</span>
                      <strong className="meta-val">{selectedFile.owner || 'Astra'}</strong>
                    </div>
                    <div className="ai-meta-item">
                      <HardDrive size={14} className="meta-icon" />
                      <span className="meta-label">Tamaño:</span>
                      <strong className="meta-val">{formatSize(selectedFile.size)}</strong>
                    </div>
                    <div className="ai-meta-item">
                      <Calendar size={14} className="meta-icon" />
                      <span className="meta-label">Último cambio:</span>
                      <strong className="meta-val">
                        {formatDate(selectedFile.latestTimestamp || selectedFile.timestamp)} {formatTime(selectedFile.latestTimestamp || selectedFile.timestamp)}
                      </strong>
                    </div>
                    <div className="ai-meta-item">
                      <span className="meta-label">Tipo:</span>
                      <span className="ai-type-pill">Auditoría / Comparación</span>
                    </div>
                  </div>

                  {/* Auditoría Body Content */}
                  <div className="ai-modal-body-scroll">
                    {selectedFile.aiAnalysis ? (
                      formatMarkdown(selectedFile.aiAnalysis)
                    ) : (
                      <div className="modal-empty-state">
                        <AlertTriangle size={52} className="empty-icon text-warning" />
                        <h4>Análisis Pendiente o No Disponible</h4>
                        <p>No se ha registrado un reporte detallado generado por IA para este archivo todavía.</p>
                        <button
                          className="btn-switch-to-boveda"
                          onClick={() => setActiveModalTab('boveda')}
                        >
                          <History size={15} />
                          <span>Explorar y Restaurar Versiones en la Bóveda</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* SECTION 2: BÓVEDA DE RESTAURACIÓN */
                <div className="modal-boveda-container fade-in">
                  {/* Timeline Horizontal Bar */}
                  <div className="modal-timeline-container">
                    <div className="timeline-header-label">
                      <History size={14} /> Línea de Tiempo de Modificaciones Respaldadas
                    </div>
                    <div className="modal-timeline">
                      {[...(selectedFile.snapshots || [])].reverse().map((snap, sIdx) => {
                        const isActive = snap.id === selectedSnapshot?.id;
                        return (
                          <div
                            key={snap.id}
                            className={`timeline-node ${isActive ? 'active' : ''}`}
                            onClick={() => handleSelectSnapshot(snap)}
                            title={`Versión #${sIdx + 1}: ${formatDate(snap.timestamp)} ${formatTime(snap.timestamp)}`}
                          >
                            <div className="node-date-top">{formatDate(snap.timestamp)}</div>
                            <div className="node-circle"></div>
                            <div className="node-time-bottom">{formatTime(snap.timestamp)}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Snapshot Info Banner */}
                    {selectedSnapshot && (
                      <div className="timeline-info-strip">
                        <span className="version-date-label">
                          Viendo versión del <strong>{formatDate(selectedSnapshot.timestamp)}</strong> a las <strong>{formatTime(selectedSnapshot.timestamp)}</strong>
                        </span>
                        <span className="readonly-alert-pill">
                          <AlertTriangle size={13} color="#F59E0B" /> Snapshot de solo lectura
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Viewer Content Body */}
                  <div className="modal-code-area">
                    {isLoadingContent ? (
                      <div className="content-loading-state">
                        <RotateCw size={26} className="spin-icon" />
                        <p>Cargando contenido de la captura...</p>
                      </div>
                    ) : snapshotContent?.startsWith('base64:') ? (
                      <div className="binary-snapshot-card">
                        <div className="binary-icon-box">
                          <History size={48} style={{ opacity: 0.35, color: getFileCategoryColor(selectedFile.name) }} />
                        </div>
                        <h3>Snapshot de Archivo Binario ({getFileExtension(selectedFile.name)})</h3>
                        <p>
                          Esta versión se respaldó en formato binario. No se puede previsualizar como texto plano.
                          Al presionar <strong>"Restaurar Versión"</strong>, se creará un archivo nuevo con el contenido original íntegro para que lo abras con tu programa predeterminado.
                        </p>
                        <button className="btn-modal-restore" onClick={() => setShowRestoreModal(true)}>
                          <RotateCcw size={15} />
                          <span>Restaurar este Archivo Binario</span>
                        </button>
                      </div>
                    ) : (
                      <div className="code-editor-layout">
                        <div className="code-line-numbers">
                          {(snapshotContent || '').split('\n').map((_, i) => (
                            <div key={i}>{i + 1}</div>
                          ))}
                        </div>
                        <pre className="code-text-content">
                          {snapshotContent || '(Archivo vacío)'}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Restaurar Versión */}
      {showRestoreModal && selectedFile && selectedSnapshot && (
        <div className="modal-overlay-backdrop fade-in" onClick={() => setShowRestoreModal(false)}>
          <div className="confirm-modal-box slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-header">
              <div className="confirm-icon-box restore">
                <RotateCcw size={22} />
              </div>
              <div>
                <h3>Confirmar Restauración</h3>
                <p className="confirm-sub">Bóveda de Recuperación</p>
              </div>
              <button className="btn-confirm-close" onClick={() => setShowRestoreModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="confirm-body">
              <p>
                ¿Deseas rescatar la versión del <strong>{formatDate(selectedSnapshot.timestamp)} a las {formatTime(selectedSnapshot.timestamp)}</strong> del archivo <strong>{selectedFile.name}</strong>?
              </p>
              <div className="confirm-notice-box">
                <Check size={16} color="#10B981" />
                <div>
                  <strong>Seguridad garantizada:</strong> No se sobrescribirá el archivo actual. Se creará un archivo nuevo con el formato <code>{selectedFile.name.replace(/\.[^/.]+$/, "")}_RESTAURADO_{formatDate(selectedSnapshot.timestamp).replace(/[^a-zA-Z0-9]/g, "_")}...</code>
                </div>
              </div>
            </div>

            <div className="confirm-actions">
              <button
                className="btn-confirm-cancel"
                onClick={() => setShowRestoreModal(false)}
                disabled={isRestoring}
              >
                Cancelar
              </button>
              <button
                className="btn-confirm-accept"
                onClick={confirmRestore}
                disabled={isRestoring}
              >
                {isRestoring ? <RotateCw size={15} className="spin-icon" /> : <RotateCcw size={15} />}
                <span>{isRestoring ? 'Restaurando...' : 'Restaurar Versión'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Borrar Registro */}
      {showDeleteModal && selectedFile && selectedSnapshot && (
        <div className="modal-overlay-backdrop fade-in" onClick={() => setShowDeleteModal(false)}>
          <div className="confirm-modal-box slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-header">
              <div className="confirm-icon-box delete">
                <Trash2 size={22} />
              </div>
              <div>
                <h3>Confirmar Eliminación</h3>
                <p className="confirm-sub">Acción Irreversible</p>
              </div>
              <button className="btn-confirm-close" onClick={() => setShowDeleteModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="confirm-body">
              <p>
                ¿Estás seguro de que deseas <strong>borrar definitivamente</strong> el registro de la versión del <strong>{formatDate(selectedSnapshot.timestamp)} a las {formatTime(selectedSnapshot.timestamp)}</strong> de <strong>{selectedFile.name}</strong>?
              </p>
              <div className="confirm-notice-box danger">
                <AlertTriangle size={16} color="#EF4444" />
                <div>
                  Esta acción eliminará el respaldo de la bóveda permanentemente.
                </div>
              </div>
            </div>

            <div className="confirm-actions">
              <button
                className="btn-confirm-cancel"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                className="btn-confirm-danger"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <RotateCw size={15} className="spin-icon" /> : <Trash2 size={15} />}
                <span>{isDeleting ? 'Eliminando...' : 'Eliminar Registro'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
