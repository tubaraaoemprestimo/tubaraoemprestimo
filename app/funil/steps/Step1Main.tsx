'use client';

import { useEffect } from 'react';
import { ShieldCheck, TrendingUp, Users, Banknote, Clock, Star } from 'lucide-react';
import { FunnelVideo }      from '../components/FunnelVideo';
import { useFunnelTracker } from '../hooks/useFunnelTracker';

// ---------------------------------------------------------------
// URLs de vídeo (Cloudflare R2)
// ---------------------------------------------------------------
const VIDEO_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/01-pre-lancamento.mp4';

// ---------------------------------------------------------------
// Link de checkout InfinitePay — Método Tubarão R$497
// O gateway retorna para /funil?step=2&sid={sessionId}
// ---------------------------------------------------------------
const CHECKOUT_URL = 'https://infinitepay.io/link/metodo-tubarao-497'; // ← substituir pela URL real

const BENEFITS = [
  { icon: <Banknote size={22} />,   title: 'Lucro Imediato',        desc: 'Comece a ganhar dinheiro com empréstimos desde o primeiro dia.' },
  { icon: <ShieldCheck size={22} />, title: 'Risco Calculado',       desc: 'Aprenda a analisar clientes e evitar inadimplência com segurança.' },
  { icon: <TrendingUp size={22} />, title: 'Escala Rápida',          desc: 'Metodologia comprovada para crescer de R$10k a R$100k/mês.' },
  { icon: <Users size={22} />,      title: 'Rede de Clientes',       desc: 'Monte sua carteira de clientes fiéis e recorrentes.' },
  { icon: <Clock size={22} />,      title: 'Liberdade de Horário',   desc: 'Trabalhe de onde quiser, no horário que preferir.' },
  { icon: <Star size={22} />,       title: 'Suporte Exclusivo',      desc: 'Grupo VIP, materiais e mentoria para tirar todas as dúvidas.' },
];

interface Step1Props {
  sessionId: string;
}

export function Step1Main({ sessionId }: Step1Props) {
  const { track, trackPurchase } = useFunnelTracker(sessionId);

  useEffect(() => {
    track({ step: 1, eventType: 'STEP_VIEW' });
  }, [track]);

  const handleBuy = () => {
    trackPurchase({ step: 1, productName: 'Método Tubarão', amount: 497 });
    // Abre o checkout em nova aba (gateway redireciona de volta com ?step=2)
    window.open(`${CHECKOUT_URL}?sid=${sessionId}`, '_blank');
  };

  return (
    <section className="flex flex-col items-center gap-12 py-16 px-4 animate-in fade-in zoom-in-95 duration-700">

      {/* Badge de urgência */}
      <div className="inline-flex items-center gap-2 px-5 py-2 bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-full">
        <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
        <span className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider">
          Oferta por tempo limitado — Vagas Encerrando
        </span>
      </div>

      {/* Headline */}
      <div className="text-center max-w-4xl">
        <h1 className="text-5xl md:text-7xl font-black leading-[1.05] mb-6">
          Construa um{' '}
          <span className="text-[#D4AF37]">Negócio de Empréstimos</span>{' '}
          do Zero — e Lucre Todos os Meses
        </h1>
        <p className="text-xl md:text-2xl text-zinc-300 leading-relaxed max-w-3xl mx-auto">
          O <strong>Método Tubarão</strong> é o sistema completo para quem quer sair do emprego,
          ter liberdade financeira e construir uma renda sólida com crédito pessoal.
        </p>
      </div>

      {/* Vídeo de apresentação */}
      <div className="w-full max-w-4xl">
        <FunnelVideo
          src={VIDEO_URL}
          poster="/images/pre-lancamento-thumbnail.jpg"
          autoPlay={false}
          onPlay={() => track({ step: 1, eventType: 'VIDEO_PLAY' })}
          onComplete={() => track({ step: 1, eventType: 'VIDEO_COMPLETE' })}
        />
      </div>

      {/* Grid de benefícios */}
      <div className="grid md:grid-cols-3 gap-4 w-full max-w-4xl">
        {BENEFITS.map((b, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-[#D4AF37]/30 transition-all">
            <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-3">
              {b.icon}
            </div>
            <h3 className="font-bold mb-1">{b.title}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{b.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA principal */}
      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <button
          onClick={handleBuy}
          className="w-full py-5 px-8 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-black text-xl rounded-2xl
                     hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-[#D4AF37]/25"
        >
          Quero o Método Tubarão — R$ 497
        </button>
        <p className="text-zinc-500 text-xs text-center">
          🔒 Compra 100% segura · Acesso imediato · Garantia de 7 dias
        </p>
      </div>

    </section>
  );
}
