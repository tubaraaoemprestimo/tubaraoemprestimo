'use client';

import { useEffect } from 'react';
import { BookOpen, Car, FileCheck } from 'lucide-react';
import { FunnelVideo }      from '../components/FunnelVideo';
import { useFunnelTracker } from '../hooks/useFunnelTracker';

const VIDEO_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/02-upsell-modulos.mp4';

// ---------------------------------------------------------------
// Ofertas do Upsell 1 (módulos complementares)
// ---------------------------------------------------------------
const OFFERS = [
  {
    id:          'combo',
    icon:        <BookOpen size={28} />,
    badge:       'MELHOR OFERTA',
    title:       'Combo Completo',
    desc:        'Módulo Limpa Nome + Módulo Moto juntos com desconto especial.',
    price:       'R$ 450',
    priceNote:   'Economize R$144',
    checkoutUrl: 'https://infinitepay.io/link/combo-modulos-450', // ← substituir
    highlight:   true,
    productName: 'Combo Módulos',
    amount:      450,
  },
  {
    id:          'limpa-nome',
    icon:        <FileCheck size={28} />,
    badge:       null,
    title:       'Módulo Limpa Nome',
    desc:        'Aprenda a captar clientes com restrições e cobrar uma assessoria de regularização.',
    price:       'R$ 297',
    priceNote:   null,
    checkoutUrl: 'https://infinitepay.io/link/modulo-limpa-nome-297', // ← substituir
    highlight:   false,
    productName: 'Módulo Limpa Nome',
    amount:      297,
  },
  {
    id:          'moto',
    icon:        <Car size={28} />,
    badge:       null,
    title:       'Módulo Moto',
    desc:        'Libere crédito com garantia de veículo — ticket médio 3x maior.',
    price:       'R$ 297',
    priceNote:   null,
    checkoutUrl: 'https://infinitepay.io/link/modulo-moto-297', // ← substituir
    highlight:   false,
    productName: 'Módulo Moto',
    amount:      297,
  },
];

interface Step2Props {
  sessionId: string;
  onDecline: () => void;
}

export function Step2Upsell1({ sessionId, onDecline }: Step2Props) {
  const { track, trackPurchase } = useFunnelTracker(sessionId);

  useEffect(() => {
    track({ step: 2, eventType: 'STEP_VIEW' });
  }, [track]);

  const handleBuy = (offer: typeof OFFERS[0]) => {
    trackPurchase({ step: 2, productName: offer.productName, amount: offer.amount });
    window.open(`${offer.checkoutUrl}?sid=${sessionId}`, '_blank');
  };

  const handleDecline = () => {
    track({ step: 2, eventType: 'CLICK_NO' });
    onDecline();
  };

  return (
    <section className="flex flex-col items-center gap-10 py-12 px-4 animate-in fade-in zoom-in-95 duration-700">

      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full">
        <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">
          Oferta especial — Disponível apenas agora
        </span>
      </div>

      {/* Headline */}
      <div className="text-center max-w-3xl">
        <h1 className="text-4xl md:text-6xl font-black mb-4">
          Turbine Seus Resultados com{' '}
          <span className="text-[#D4AF37]">Módulos Exclusivos</span>
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          Clientes com restrições e garantia de veículo são os mais lucrativos do mercado.
          Aproveite esta oferta única para dominar esses nichos.
        </p>
      </div>

      {/* Vídeo autoPlay */}
      <div className="w-full max-w-4xl">
        <FunnelVideo
          src={VIDEO_URL}
          autoPlay={true}
          onPlay={() => track({ step: 2, eventType: 'VIDEO_PLAY' })}
          onComplete={() => track({ step: 2, eventType: 'VIDEO_COMPLETE' })}
        />
      </div>

      {/* Cards de oferta */}
      <div className="grid md:grid-cols-3 gap-4 w-full max-w-4xl">
        {OFFERS.map((offer) => (
          <div
            key={offer.id}
            className={`relative flex flex-col bg-zinc-900 rounded-2xl p-6 border transition-all ${
              offer.highlight
                ? 'border-[#D4AF37] shadow-lg shadow-[#D4AF37]/10'
                : 'border-zinc-800'
            }`}
          >
            {offer.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#D4AF37] text-black text-xs font-black rounded-full whitespace-nowrap">
                {offer.badge}
              </div>
            )}

            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
              offer.highlight
                ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37]'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
            }`}>
              {offer.icon}
            </div>

            <h3 className="text-lg font-black mb-2">{offer.title}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed flex-1 mb-4">{offer.desc}</p>

            <div className="mb-4">
              <span className={`text-2xl font-black ${offer.highlight ? 'text-[#D4AF37]' : 'text-white'}`}>
                {offer.price}
              </span>
              {offer.priceNote && (
                <span className="ml-2 text-xs text-green-400 font-bold">{offer.priceNote}</span>
              )}
            </div>

            <button
              onClick={() => handleBuy(offer)}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                offer.highlight
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black hover:brightness-110'
                  : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              Quero este módulo
            </button>
          </div>
        ))}
      </div>

      {/* Recusa — avança sem reload */}
      <button
        onClick={handleDecline}
        className="text-zinc-600 text-sm underline underline-offset-4 hover:text-zinc-400 transition-colors"
      >
        Não, obrigado. Continuar sem os módulos.
      </button>

    </section>
  );
}
