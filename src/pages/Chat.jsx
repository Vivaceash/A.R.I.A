import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import Header from '../components/Header';
import './Chat.css';

function Chat() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('aria_chat_history');
    return saved ? JSON.parse(saved) : [
      { role: 'assistant', content: '¡Hola! Soy A.R.I.A, tu asistente de inteligencia artificial local. ¿En qué puedo ayudarte hoy?' }
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('connected'); // 'connected', 'error'
  const [statusMessage, setStatusMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('aria_chat_history', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleClearHistory = () => {
    if (window.confirm('¿Estás seguro de que deseas vaciar el historial de conversación?')) {
      setMessages([
        { role: 'assistant', content: 'Historial borrado. ¡Hola! Soy A.R.I.A, ¿en qué te puedo asistir ahora?' }
      ]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isGenerating) return;

    const userMessage = { role: 'user', content: inputValue.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);
    setStatus('connected');
    setStatusMessage('Consultando base de datos y RAG local...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          pageContext: {
            currentPath: window.location.pathname
          }
        })
      });

      if (!response.ok) {
        throw new Error('No se pudo conectar con el servidor.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = "";
      let assistantResponse = "";

      // Add placeholder for assistant response
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          setStatusMessage('Redactando respuesta con Gemma 4...');
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.error) {
                assistantResponse += `\n[Error: ${parsed.error}]`;
                setStatus('error');
              } else if (parsed.message && parsed.message.content) {
                assistantResponse += parsed.message.content;
              }

              setMessages(prev => {
                const updated = [...prev];
                if (updated.length > 0) {
                  updated[updated.length - 1] = { role: 'assistant', content: assistantResponse };
                }
                return updated;
              });
            } catch (err) {
              console.error("Error al parsear línea de streaming:", err);
            }
          }
        }
      }

      // Check leftover buffer content
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.error) {
            assistantResponse += `\n[Error: ${parsed.error}]`;
            setStatus('error');
          } else if (parsed.message && parsed.message.content) {
            assistantResponse += parsed.message.content;
          }
          setMessages(prev => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1] = { role: 'assistant', content: assistantResponse };
            }
            return updated;
          });
        } catch (e) {
          // ignore
        }
      }

    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setStatus('error');
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Lo siento, ha ocurrido un error al conectar con el servidor local de Ollama. Por favor, asegúrate de que el servicio de Ollama y el modelo gemma4:e4b estén activos.' }
      ]);
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
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
          <button className="clear-btn" onClick={handleClearHistory} title="Vaciar Historial">
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
