import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { aiChatbotService } from '../services/aiChatbotService';

interface Message {
  role: 'user' | 'bot';
  text: string;
}

interface ChatbotConfig {
  enabled: boolean;
  welcomeMessage: string;
  fallbackMessage: string;
  provider: 'gemini' | 'perplexity' | 'openai';
  geminiApiKey: string | null;
  perplexityApiKey: string | null;
  systemPrompt: string;
}

export const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [config, setConfig] = useState<ChatbotConfig | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chatbot config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsConfigLoading(true);
    try {
      const data = await aiChatbotService.getConfig();
      setConfig({
        enabled: data.enabled,
        welcomeMessage: data.welcomeMessage,
        fallbackMessage: data.fallbackMessage,
        provider: data.provider,
        geminiApiKey: data.geminiApiKey,
        perplexityApiKey: data.perplexityApiKey,
        systemPrompt: data.systemPrompt
      });
      // Set welcome message
      setMessages([{ role: 'bot', text: data.welcomeMessage }]);
    } catch (err) {
      console.error('[Chatbot] Error loading config:', err);
      setMessages([{ role: 'bot', text: 'Olá! 👋 Sou o assistente virtual da TUBARÃO EMPRÉSTIMOS. Como posso ajudar você hoje?' }]);
    }
    setIsConfigLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
      if (!config) {
        throw new Error('Configuração não carregada');
      }

      // Build history for context
      const history = messages.map(m => ({
        role: m.role === 'bot' ? 'assistant' as const : 'user' as const,
        content: m.text
      }));

      // Add current message
      history.push({ role: 'user' as const, content: userMsg });

      // Get API key based on provider
      const apiKey = config.provider === 'gemini' ? config.geminiApiKey : config.perplexityApiKey;

      if (!apiKey) {
        setMessages(prev => [...prev, { role: 'bot', text: config.fallbackMessage }]);
        return;
      }

      let response = '';

      if (config.provider === 'gemini') {
        response = await aiChatbotService.generateResponseGemini(
          history,
          config.systemPrompt,
          apiKey
        );
      } else if (config.provider === 'perplexity') {
        response = await aiChatbotService.generateResponsePerplexity(
          history,
          config.systemPrompt,
          apiKey
        );
      }

      if (!response) {
        response = config.fallbackMessage;
      }

      setMessages(prev => [...prev, { role: 'bot', text: response }]);
    } catch (error) {
      console.error('[Chatbot] Error:', error);
      setMessages(prev => [...prev, {
        role: 'bot',
        text: config?.fallbackMessage || 'Desculpe, tive um problema de conexão. Tente novamente.'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleRestart = () => {
    setMessages([{ role: 'bot', text: config?.welcomeMessage || 'Olá! Como posso ajudar?' }]);
  };

  // Don't render if chatbot is disabled
  if (!isConfigLoading && config && !config.enabled) {
    return null;
  }

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[350px] h-[500px] bg-black border border-[#D4AF37] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#D4AF37] to-[#B5942F] p-4 flex justify-between items-center text-black">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bot size={24} />
                <Sparkles size={10} className="absolute -top-1 -right-1 text-yellow-900" />
              </div>
              <div>
                <span className="font-bold block text-sm">Assistente Tubarão</span>
                <span className="text-[10px] opacity-75">Powered by {config?.provider === 'perplexity' ? 'Perplexity' : 'Gemini'} AI</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleRestart}
                className="hover:bg-black/10 rounded-full p-1.5 transition-colors"
                title="Reiniciar conversa"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-black/10 rounded-full p-1.5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-900/90">
            {isConfigLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user'
                        ? 'bg-[#D4AF37] text-black rounded-tr-none'
                        : 'bg-zinc-800 text-gray-200 rounded-tl-none border border-zinc-700'
                      }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none border border-zinc-700 flex gap-1.5">
                      <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="p-3 bg-black border-t border-zinc-800 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Digite sua dúvida..."
              disabled={isTyping || isConfigLoading}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isTyping || isConfigLoading || !input.trim()}
              className="bg-[#D4AF37] text-black p-2 rounded-lg hover:bg-[#B5942F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full w-14 h-14 shadow-xl shadow-[#D4AF37]/20 p-0 flex items-center justify-center bg-[#D4AF37] text-black hover:bg-[#B5942F] relative"
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        {!isOpen && config?.enabled && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse border-2 border-black"></span>
        )}
      </Button>
    </div>
  );
};