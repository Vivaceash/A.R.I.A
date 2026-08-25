import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, Trash2, Bot, User, Sparkles, Loader2, X, MessageSquare, ExternalLink } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import './FloatingChat.css';

function FloatingChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const {
    messages,
    isGenerating,
    status,
    statusMessage,
    sendMessage,
    clearHistory
  } = useChat();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isGenerating) return;
    
    sendMessage(inputValue.trim(), window.location.pathname);
    setInputValue('');
  };

  const formatMessageContent = (text) => {
    if (!text) return "";

    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const codeLines = part.slice(3, -3).trim().split('\n');
        let language = 'code';
        let code = part.slice(3, -3).trim();
        if (codeLines[0] && !codeLines[0].includes(' ') && codeLines[0].length < 15) {
          language = codeLines[0];
          code = codeLines.slice(1).join('\n');
        }
        return (
          <div key={index} className="chat-code-block">
            <div className="chat-code-header">
              <span>{language}</span>
            </div>
            <pre><code>{code}</code></pre>
          </div>
        );
      }

      const inlineParts = part.split(/(`[^`]+`)/g);
      const inlineFormatted = inlineParts.map((subPart, subIdx) => {
        if (subPart.startsWith('`') && subPart.endsWith('`')) {
          return <code key={subIdx} className="chat-inline-code">{subPart.slice(1, -1)}</code>;
        }

        const boldParts = subPart.split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((boldPart, boldIdx) => {
          if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
            return <strong key={boldIdx}>{boldPart.slice(2, -2)}</strong>;
          }
          return boldPart;
        });
      });

      return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{inlineFormatted}</span>;
    });
  };

  // If already on the global chat page, do not render floating chat to avoid redundancy
  if (location.pathname === '/chat') {
    return null;
  }

  return (
    <div className="floating-chat-container">
      {isOpen && (
        <div className="floating-chat-window">
          <div className="floating-chat-header">
            <div 
              className="floating-chat-title clickable"
              onClick={() => {
                navigate('/chat');
                setIsOpen(false);
              }}
              title="Abrir Chat Global en pantalla completa"
            >
              <Sparkles size={18} className="sparkles-icon" color="var(--accent-purple)" />
              <span>A.R.I.A</span>
              <ExternalLink size={13} className="floating-chat-open-icon" />
            </div>
            <div className="chat-header-actions">
              <div className={`status-badge ${status}`}>
                <span className="pulse-dot"></span>
                {status === 'connected' ? 'Gemma 4 (Local)' : 'Error'}
              </div>
              <button className="clear-btn" onClick={() => setShowConfirmClear(true)} title="Limpiar Historial">
                <Trash2 size={16} />
              </button>
              <button className="close-btn" onClick={() => setIsOpen(false)} title="Cerrar">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="chat-messages-area">
            {messages.map((message, index) => (
              <div key={index} className={`chat-message-bubble ${message.role}`}>
                <div className="bubble-avatar">
                  {message.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div className="bubble-content-wrapper">
                  <div className="bubble-sender-name">
                    {message.role === 'assistant' ? 'A.R.I.A' : 'Tú'}
                  </div>
                  <div className="bubble-text">
                    {formatMessageContent(message.content)}
                  </div>
                </div>
              </div>
            ))}
            {isGenerating && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="chat-message-bubble assistant typing">
                <div className="bubble-avatar">
                  <Bot size={16} />
                </div>
                <div className="bubble-content-wrapper">
                  <div className="bubble-sender-name">A.R.I.A</div>
                  <div className="bubble-text typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-container" onSubmit={handleSendMessage}>
            {isGenerating && statusMessage && (
              <div className="chat-status-message-tip">
                <Sparkles size={12} className="spin-icon status-sparkle" />
                <span>{statusMessage}</span>
              </div>
            )}
            <div className="chat-input-wrapper">
              <input
                type="text"
                className="chat-input-field"
                placeholder={isGenerating ? "A.R.I.A está respondiendo..." : "Escribe un mensaje..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isGenerating}
                autoFocus
              />
              <button type="submit" className="chat-send-btn" disabled={!inputValue.trim() || isGenerating}>
                {isGenerating ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
              </button>
            </div>
          </form>
        </div>
      )}

      {showConfirmClear && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowConfirmClear(false)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', maxWidth: '360px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: 'white' }}>¿Vaciar historial?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-muted)' }}>Se borrarán todos los mensajes de la conversación actual.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConfirmClear(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => { clearHistory(); setShowConfirmClear(false); }} style={{ padding: '8px 16px', background: '#EF4444', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Trash2 size={14} /> Vaciar</button>
            </div>
          </div>
        </div>
      )}
      
      <button 
        className={`floating-chat-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Asistente A.R.I.A"
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
      </button>
    </div>
  );
}

export default FloatingChat;
