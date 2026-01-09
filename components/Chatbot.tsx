import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import { Button } from './Button';
import { aiService } from '../services/aiService'; // Import the service

interface Message {
  role: 'user' | 'bot';
  text: string;
}

export const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Olá! Sou a IA do Tubarão Empréstimos. Como posso ajudar com seu crédito hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
      // Use the centralized AI service
      const analysis = await aiService.analyzeMessage(userMsg);
      
      setMessages(prev => [...prev, { role: 'bot', text: analysis.replyMessage }]);
    } catch (error) {
       setMessages(prev => [...prev, { role: 'bot', text: "Desculpe, tive um problema de conexão. Tente novamente." }]);
    } finally {
       setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[350px] h-[500px] bg-black border border-[#D4AF37] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#D4AF37] to-[#B5942F] p-4 flex justify-between items-center text-black">
            <div className="flex items-center gap-2">
              <Bot size={24} />
              <span className="font-bold">Assistente Tubarão</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-black/10 rounded-full p-1">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-900/90">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-[#D4AF37] text-black rounded-tr-none' 
                    : 'bg-zinc-800 text-gray-200 rounded-tl-none border border-zinc-700'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none border border-zinc-700 flex gap-1">
                  <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce delay-75"></span>
                  <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce delay-150"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-black border-t border-zinc-800 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Digite sua dúvida..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
            />
            <button onClick={handleSend} className="bg-[#D4AF37] text-black p-2 rounded-lg hover:bg-[#B5942F] transition-colors">
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      <Button 
        onClick={() => setIsOpen(!isOpen)} 
        className="rounded-full w-14 h-14 shadow-xl shadow-[#D4AF37]/20 p-0 flex items-center justify-center bg-[#D4AF37] text-black hover:bg-[#B5942F]"
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
      </Button>
    </div>
  );
};