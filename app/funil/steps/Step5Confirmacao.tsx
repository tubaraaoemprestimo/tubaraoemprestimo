'use client';

import { useEffect } from 'react';
import { CheckCircle2, MessageCircle, Calendar, Award } from 'lucide-react';
import { FunnelVideo }      from '../components/FunnelVideo';
import { useFunnelTracker } from '../hooks/useFunnelTracker';

const VIDEO_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/05-obrigado-final.mp4';

interface Step5Props {
  sessionId: string;
}

export function Step5Confirmacao({ sessionId }: Step5Props) {
  const { track } = useFunnelTracker(sessionId);

  useEffect(() => {
    track({ step: 5, eventType: 'STEP_VIEW' });
    // Limpa o sessionId do storage ao chegar no fim do funil
    // O lead completou o fluxo — um novo visitante começa do zero
    localStorage.removeItem('funnel_session_id');
  }, [track]);

  return (
    <section className="flex flex-col items-center gap-10 py-12 px-4 animate-in fade-in zoom-in-95 duration-700">

      {/* Badge de sucesso */}
      <div className="inline-flex items-center gap-2 px-5 py-2 bg-green-500/10 border border-green-500/30 rounded-full">
        <CheckCircle2 size={20} className="text-green-400" />
        <span className="text-sm font-bold text-green-400 uppercase tracking-wider">
          Você está na nossa base!
        </span>
      </div>

      {/* H1 + Texto — exatos conforme especificado */}
      <div className="text-center max-w-3xl">
        <h1 className="text-5xl md:text-7xl font-black mb-6">
          🎉 <span className="text-[#D4AF37]">Parabéns!</span>
        </h1>
        <p className="text-xl md:text-2xl text-zinc-300 leading-relaxed">
          Você já está na nossa base de dados. Nossa equipe entrará em contato para confirmar
          sua inscrição e liberar seu acesso.
        </p>
      </div>

      {/* Vídeo final autoPlay */}
      <div className="w-full max-w-4xl">
        <FunnelVideo
          src={VIDEO_URL}
          poster="/images/obrigado-thumbnail.jpg"
          autoPlay={true}
          onPlay={() => track({ step: 5, eventType: 'VIDEO_PLAY' })}
          onComplete={() => track({ step: 5, eventType: 'VIDEO_COMPLETE' })}
        />
      </div>

      {/* Próximos Passos */}
      <div className="w-full max-w-3xl bg-zinc-900 border border-[#D4AF37]/30 rounded-3xl p-8">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
            ✦
          </span>
          Próximos Passos
        </h2>
        <div className="space-y-5">
          {[
            {
              num:  '1',
              title: 'Análise do Perfil',
              desc:  'Nossa equipe irá analisar suas informações e verificar o alinhamento com o programa.',
            },
            {
              num:  '2',
              title: 'Contato Direto',
              desc:  'Você receberá uma mensagem no WhatsApp em até 48 horas para confirmar sua inscrição.',
            },
            {
              num:  '3',
              title: 'Acesso Liberado',
              desc:  'Após a confirmação, seu acesso será liberado e você receberá todas as instruções.',
            },
          ].map((p) => (
            <div key={p.num} className="flex gap-4">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-black text-sm">
                {p.num}
              </div>
              <div>
                <h3 className="font-bold mb-0.5">{p.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cards enquanto isso */}
      <div className="grid md:grid-cols-3 gap-4 w-full max-w-4xl">
        {[
          { icon: <MessageCircle size={24} />, title: 'Fique Atento ao WhatsApp', desc: 'Nosso contato chegará em até 48 horas.' },
          { icon: <Calendar size={24} />,      title: 'Reserve as Datas',          desc: '3 dias presenciais em São Paulo (se aplicável).' },
          { icon: <Award size={24} />,         title: 'Defina Seus Objetivos',     desc: 'Pense nas metas que deseja alcançar.' },
        ].map((card, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center hover:border-[#D4AF37]/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mx-auto mb-3">
              {card.icon}
            </div>
            <h3 className="font-bold text-sm mb-1">{card.title}</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Rodapé limpo */}
      <p className="text-zinc-600 text-xs text-center">
        Dúvidas? <a href="mailto:contato@metodtubarao.com" className="text-[#D4AF37] hover:underline">contato@metodtubarao.com</a>
      </p>
    </section>
  );
}
