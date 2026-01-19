
import React, { useState, useEffect } from 'react';
import { Bot, MessageSquare, Terminal } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { InteractionLog } from '../../types';

export const Interactions: React.FC = () => {
  const [logs, setLogs] = useState<InteractionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseService.getInteractionLogs().then(data => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  const getIntentColor = (intent: string) => {
    switch (intent) {
      case 'PAYMENT_PROMISE': return 'text-green-400';
      case 'REQUEST_BOLETO': return 'text-blue-400';
      case 'SUPPORT': return 'text-red-400';
      default: return 'text-zinc-400';
    }
  };

  return (
    <div className="p-8 bg-black min-h-screen text-white font-mono">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-3">
             <Terminal size={32} /> Monitoramento IA
           </h1>
           <p className="text-zinc-500 mt-2">Logs de interação do WhatsApp e classificação de intenção.</p>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-black text-zinc-400 text-xs uppercase tracking-wider border-b border-zinc-800">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Usuário</th>
                <th className="p-4">Mensagem do Cliente</th>
                <th className="p-4">Intenção (IA)</th>
                <th className="p-4">Resposta Automática</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-sm">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-500">Carregando logs...</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="p-4 text-zinc-500 whitespace-nowrap">
                       {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 font-bold text-white whitespace-nowrap">
                       {log.userName}
                    </td>
                    <td className="p-4 text-zinc-300 max-w-xs truncate" title={log.message}>
                       "{log.message}"
                    </td>
                    <td className={`p-4 font-bold ${getIntentColor(log.intent)}`}>
                       [{log.intent}]
                    </td>
                    <td className="p-4 text-zinc-400 max-w-xs truncate flex items-center gap-2">
                       <Bot size={14} className="text-[#D4AF37]" /> {log.reply}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
