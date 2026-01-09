import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, MessageCircle, Phone, Mail } from 'lucide-react';
import { Button } from '../../components/Button';

export const HelpCenter: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { q: "Como aumentar meu limite?", a: "O aumento de limite é analisado automaticamente a cada 3 meses. Mantenha seus pagamentos em dia para aumentar suas chances." },
    { q: "Quais são as taxas de juros?", a: "As taxas variam de acordo com seu perfil e o pacote escolhido, começando em 3.2% a.m. Você pode ver a taxa exata na simulação." },
    { q: "Como antecipar parcelas?", a: "Vá em 'Meus Contratos', selecione a parcela desejada e realize o pagamento. O desconto de juros é calculado automaticamente." },
    { q: "O Pix não funcionou, e agora?", a: "O código Pix expira em 30 minutos. Gere um novo código na aba de contratos. Se o dinheiro saiu da sua conta, envie o comprovante no chat." },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
           <button onClick={() => navigate('/client/dashboard')} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors">
              <ChevronLeft size={24} />
           </button>
           <h1 className="text-2xl font-bold text-[#D4AF37]">Ajuda</h1>
        </div>

        <div className="space-y-6 animate-in slide-in-from-bottom-4">
           {/* Contact Channels */}
           <div className="grid grid-cols-2 gap-4">
              <button className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center gap-2 hover:border-[#D4AF37] transition-colors group">
                 <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-[#D4AF37]">
                    <MessageCircle size={20} />
                 </div>
                 <span className="text-sm font-bold group-hover:text-white text-zinc-300">Chat 24h</span>
              </button>
              <button className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center gap-2 hover:border-[#D4AF37] transition-colors group">
                 <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-[#D4AF37]">
                    <Mail size={20} />
                 </div>
                 <span className="text-sm font-bold group-hover:text-white text-zinc-300">Email</span>
              </button>
           </div>

           {/* FAQs */}
           <div>
              <h2 className="text-lg font-bold mb-4 pl-2">Perguntas Frequentes</h2>
              <div className="space-y-3">
                 {faqs.map((faq, idx) => (
                    <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                       <button 
                         onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                         className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
                       >
                          <span className="font-medium text-sm text-zinc-200">{faq.q}</span>
                          <ChevronDown size={16} className={`text-zinc-500 transition-transform ${openIndex === idx ? 'rotate-180' : ''}`} />
                       </button>
                       {openIndex === idx && (
                          <div className="p-4 pt-0 text-sm text-zinc-400 border-t border-zinc-800/50 bg-black/20">
                             {faq.a}
                          </div>
                       )}
                    </div>
                 ))}
              </div>
           </div>

           {/* Support Ticket */}
           <div className="bg-gradient-to-r from-zinc-900 to-black border border-zinc-800 rounded-2xl p-6 mt-8">
              <h3 className="font-bold text-white mb-2">Ainda precisa de ajuda?</h3>
              <p className="text-zinc-500 text-sm mb-4">Nossos especialistas respondem em até 1 hora.</p>
              <Button className="w-full">Abrir Chamado</Button>
           </div>
        </div>
      </div>
    </div>
  );
};