import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('aria_chat_history');
    return saved ? JSON.parse(saved) : [
      { role: 'assistant', content: '¡Hola! Soy A.R.I.A, tu asistente de inteligencia artificial local. ¿En qué puedo ayudarte hoy?' }
    ];
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('connected'); // 'connected', 'error'
  const [statusMessage, setStatusMessage] = useState('');

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('aria_chat_history', JSON.stringify(messages));
  }, [messages]);

  const clearHistory = useCallback(() => {
    if (window.confirm('¿Estás seguro de que deseas vaciar el historial de conversación?')) {
      setMessages([
        { role: 'assistant', content: 'Historial borrado. ¡Hola! Soy A.R.I.A, ¿en qué te puedo asistir ahora?' }
      ]);
    }
  }, []);

  const sendMessage = useCallback(async (messageText, currentPath) => {
    if (!messageText.trim() || isGenerating) return;

    const userMessage = { role: 'user', content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
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
          // Make sure we pass the fully updated messages array
          messages: [...messages, userMessage],
          pageContext: {
            currentPath: currentPath || '/chat'
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
      let ragSources = [];

      // Add placeholder for assistant response
      setMessages(prev => [...prev, { role: 'assistant', content: '', ragSources: [] }]);

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
              } else if (parsed.rag_sources) {
                // Capture RAG source metadata from the final stream line
                ragSources = parsed.rag_sources;
              } else if (parsed.message && parsed.message.content) {
                assistantResponse += parsed.message.content;
              }

              setMessages(prev => {
                const updated = [...prev];
                if (updated.length > 0) {
                  updated[updated.length - 1] = { role: 'assistant', content: assistantResponse, ragSources };
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
          } else if (parsed.rag_sources) {
            ragSources = parsed.rag_sources;
          } else if (parsed.message && parsed.message.content) {
            assistantResponse += parsed.message.content;
          }
          setMessages(prev => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1] = { role: 'assistant', content: assistantResponse, ragSources };
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
  }, [messages, isGenerating]);

  const contextValue = useMemo(() => ({
    messages,
    isGenerating,
    status,
    statusMessage,
    sendMessage,
    clearHistory
  }), [messages, isGenerating, status, statusMessage, sendMessage, clearHistory]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};
