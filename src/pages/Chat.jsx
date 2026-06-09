import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import Header from '../components/Header';
import { useChat } from '../contexts/ChatContext';
import './Chat.css';

function Chat() {
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
    scrollToBottom();
  }, [messages]);

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

  return (
    <div className="chat-page-container">
      <Header title="A.R.I.A IA Chat" showTimeframe={false} />
      
      <div className="chat-sub-header">
        <div className="chat-info-summary">
          <Sparkles size={16} className="sparkles-icon" />
          <span>Asistente Local de Red Inteligente y Análisis</span>
        </div>
        <div className="chat-header-actions">
          <div className={`status-badge ${status}`}>
            <span className="pulse-dot"></span>
            {status === 'connected' ? 'Gemma 4 (Local)' : 'Error de Conexión'}
          </div>
          <button className="clear-btn" onClick={clearHistory} title="Vaciar Historial">
            <Trash2 size={16} />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      <div className="chat-messages-area">
        {messages.map((message, index) => (
          <div key={index} className={`chat-message-bubble ${message.role}`}>
            <div className="bubble-avatar">
              {message.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
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
              <Bot size={18} />
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

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        {isGenerating && statusMessage && (
          <div className="chat-status-message-tip">
            <Sparkles size={13} className="spin-icon status-sparkle" />
            <span>{statusMessage}</span>
          </div>
        )}
        <div className="chat-input-wrapper">
          <input
            type="text"
            className="chat-input-field"
            placeholder={isGenerating ? "A.R.I.A está respondiendo..." : "Escribe un mensaje para A.R.I.A..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isGenerating}
            autoFocus
          />
          <button type="submit" className="chat-send-btn" disabled={!inputValue.trim() || isGenerating}>
            {isGenerating ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Chat;
