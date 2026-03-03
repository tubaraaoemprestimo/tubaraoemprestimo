'use client';

import { useEffect } from 'react';
import { MapPin, Users, Flame, CheckCircle2 } from 'lucide-react';
import { FunnelVideo }      from '../components/FunnelVideo';
import { useFunnelTracker } from '../hooks/useFunnelTracker';

const VIDEO_URL    = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/video-etapa1.mp4';
const CHECKOUT_URL = 'https://infinitepay.io/link/mentoria-presencial-5997'; // ← substituir

interface Step4Props {
  sessionId: string;
  onDecline: () => void;
}

export function Step4Presencial({ sessionId, onDecline }: Step4Props) {
  const { track, trackPurchase } = useFunnelTracker(sessionId);

  useEffect(() => {
    track({ step: 4, eventType: 'STEP_VIEW' });
  }, [track]);

  const handleBuy = () => {
    trackPurchase({ step: 4, productName: 'Mentoria Presencial', amount: 5997 });
    window.open(`${CHECKOUT_URL}?sid=${sessionId}`, '_blank');
  };

  const handleDecline = () => {
    track({ step: 4, eventType: 'CLICK_NO' });
    onDecline();
  };

  return (
    <section className="flex flex-col items-center gap-10 py-12 px-4 animate-in fade-in zoom-in-95 duration-700">

      {/* Badge de urgência máxima */}
      <div className="inline-flex items-center gap-2 px-5 py-2 bg-red-500/10 border border-red-500/30 rounded-full">
        <Flame size={16} className="text-red-400" />
        <span className="text-sm font-bold text-red-400 uppercase tracking-wider">
          Apenas 3 vagas disponíveis — São Paulo
        </span>
      </div>

      {/* Headline */}
      <div className="text-center max-w-3xl">
        <h1 className="text-4xl md:text-6xl font-black mb-4">
          Imersão{' '}
          <span className="text-[#D4AF37]">Presencial</span>{' '}
          — 3 Dias Transformadores
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          Nosso programa mais intenso. Durante 3 dias em São Paulo, você vai estruturar
          seu negócio de A a Z ao lado do nosso time e de outros alunos de elite.
        </p>
      </div>

      {/* Vídeo autoPlay */}
      <div className="w-full max-w-4xl">
        <FunnelVideo
          src={VIDEO_URL}
          autoPlay={true}
          onPlay={() => track({ step: 4, eventType: 'VIDEO_PLAY' })}
          onComplete={() => track({ step: 4, eventType: 'VIDEO_COMPLETE' })}
        />
      </div>

      {/* Detalhes da imersão */}
      <div className="grid md:grid-cols-3 gap-4 w-full max-w-4xl">
        {[
          { icon: <MapPin size={22} />,  title: 'São Paulo, SP',    desc: 'Local confirmado no centro da cidade, com toda a infraestrutura.' },
          { icon: <Users size={22} />,   title: 'Turma Reduzida',   desc: 'Máximo 12 alunos para atenção individualizada do mentor.' },
          { icon: <Flame size={22} />,   title: '3 Dias Intensos',  desc: 'Imersão total: planejamento, captação, análise, cobrança e escala.' },
        ].map((item, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mx-auto mb-3">
              {item.icon}
            </div>
            <h3 className="font-black mb-2">{item.title}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* O que está incluso */}
      <div className="w-full max-w-3xl bg-zinc-900 border border-[#D4AF37]/20 rounded-3xl p-8">
        <h2 className="text-xl font-black mb-5 text-[#D4AF37]">Tudo incluso na Imersão:</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            '3 dias de imersão presencial em SP',
            'Mentoria individual com o fundador',
            'Kit físico exclusivo de materiais',
            'Acesso vitalício ao grupo de alunos',
            'Modelagem completa do seu negócio',
            'Redes de parceiros e investidores',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-zinc-300 text-sm">
              <CheckCircle2 size={16} className="shrink-0 text-[#D4AF37]" />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <button
          onClick={handleBuy}
          className="w-full py-5 px-8 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-black text-xl rounded-2xl
                     hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/25"
        >
          Quero a Imersão Presencial — R$ 5.997
        </button>
        <p className="text-zinc-500 text-xs">🔒 Pagamento seguro · Parcelamento disponível</p>
      </div>

      {/* Recusa */}
      <button
        onClick={handleDecline}
        className="text-zinc-600 text-sm underline underline-offset-4 hover:text-zinc-400 transition-colors"
      >
        Não, vou ficar apenas com o que já adquiri.
      </button>

    </section>
  );
}
