import { useEffect } from 'react';
import { BookOpen, Car, FileCheck, CheckCircle2, Sparkles, TrendingUp } from 'lucide-react';
import { FunnelVideo } from '../FunnelVideo';
import { track, trackPurchase } from '../funnelTracker';

const VIDEO_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/02-upsell-modulos.mp4';

const OFFERS = [
  {
    id: 'limpa-nome',
    icon: <FileCheck size={32} />,
    badge: 'OFERTA ESPECIAL',
    title: 'Módulo Limpa Nome',
    subtitle: 'Lucre Ajudando Pessoas a Limpar o Nome',
    desc: 'Aprenda a captar clientes com restrições no CPF e cobrar assessoria de regularização. Nicho extremamente lucrativo e com demanda infinita.',
    benefits: [
      'Como encontrar clientes com nome sujo',
      'Estratégias de negociação com credores',
      'Contratos e documentação completa',
      'Scripts de vendas prontos',
      'Margem de lucro de 40-60% por cliente',
    ],
    priceOriginal: 'R$ 497',
    price: 'R$ 297',
    discount: '40% OFF',
    url: 'https://link.infinitepay.io/tubaraoemprestimo/VC1DLUEtSQ-7NUnL8kth5-297,00',
    highlight: true,
    productName: 'Módulo Limpa Nome',
    amount: 297,
  },
  {
    id: 'moto',
    icon: <Car size={32} />,
    badge: 'OFERTA ESPECIAL',
    title: 'Módulo Financiamento de Moto',
    subtitle: 'Ticket Médio 3× Maior com Garantia',
    desc: 'Libere crédito com garantia de veículo e aumente drasticamente seu ticket médio. Empréstimos de R$ 5.000 a R$ 20.000 com segurança total.',
    benefits: [
      'Como avaliar motos como garantia',
      'Contratos com alienação fiduciária',
      'Documentação e transferência segura',
      'Análise de risco reduzida',
      'Lucro de R$ 1.000 a R$ 4.000 por operação',
    ],
    priceOriginal: 'R$ 997',
    price: 'R$ 297',
    discount: '70% OFF',
    url: 'https://link.infinitepay.io/tubaraoemprestimo/VC1DLUEtSQ-3gkPAIq4JF-297,00',
    highlight: true,
    productName: 'Módulo Financiamento de Moto',
    amount: 297,
  },
];

interface Step2Props { sessionId: string; onDecline: () => void }

export function Step2Upsell1({ sessionId, onDecline }: Step2Props) {
  useEffect(() => {
    track({ sessionId, step: 2, eventType: 'STEP_VIEW' });
  }, [sessionId]);

  const handleBuy = (offer: typeof OFFERS[0]) => {
    trackPurchase({ sessionId, step: 2, productName: offer.productName, amount: offer.amount });
    window.open(`${offer.url}?sid=${sessionId}`, '_blank');
  };

  const handleDecline = () => {
    track({ sessionId, step: 2, eventType: 'CLICK_NO' });
    onDecline();
  };

  return (
    <section className="flex flex-col items-center gap-12 py-16 px-4 animate-in fade-in zoom-in-95 duration-700">

      {/* Mensagem de Parabéns */}
      <div className="w-full max-w-4xl bg-gradient-to-br from-green-900/20 to-black border-2 border-green-500/40 rounded-3xl p-8 md:p-12 text-center">
        <Sparkles size={56} className="text-green-400 mx-auto mb-6 animate-pulse" />
        <h1 className="text-4xl md:text-6xl font-black mb-4">
          🎉 Parabéns pela Sua Decisão!
        </h1>
        <p className="text-xl md:text-2xl text-zinc-300 leading-relaxed max-w-2xl mx-auto mb-6">
          Você acabou de dar o primeiro passo para transformar sua vida financeira com o{' '}
          <strong className="text-[#D4AF37]">Método Tubarão</strong>!
        </p>
        <p className="text-lg text-zinc-400">
          Seu acesso será liberado em instantes. Verifique seu email! 📧
        </p>
      </div>

      {/* Badge de urgência */}
      <div className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500/10 border border-amber-500/40 rounded-full">
        <TrendingUp size={18} className="text-amber-400" />
        <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">
          ⚡ Oferta Exclusiva — Disponível Apenas Agora
        </span>
      </div>

      {/* Headline */}
      <div className="text-center max-w-4xl">
        <h2 className="text-4xl md:text-6xl font-black leading-tight mb-6">
          Turbine Seus Resultados com{' '}
          <span className="text-[#D4AF37]">Módulos Exclusivos</span>
        </h2>
        <p className="text-xl text-zinc-300 leading-relaxed">
          Aproveite esta oferta única para dominar nichos altamente lucrativos e{' '}
          <strong className="text-[#D4AF37]">multiplicar seus ganhos</strong>.
        </p>
      </div>

      {/* Vídeo */}
      <div className="w-full max-w-5xl">
        <h3 className="text-2xl font-black text-center mb-6">
          🎥 Veja Como Esses Módulos Vão Acelerar Seus Resultados
        </h3>
        <FunnelVideo
          src={VIDEO_URL}
          autoPlay={true}
          onPlay={() => track({ sessionId, step: 2, eventType: 'VIDEO_PLAY' })}
          onComplete={() => track({ sessionId, step: 2, eventType: 'VIDEO_COMPLETE' })}
        />
      </div>

      {/* Cards de Oferta */}
      <div className="grid md:grid-cols-2 gap-8 w-full max-w-6xl">
        {OFFERS.map((offer) => (
          <div
            key={offer.id}
            className="relative flex flex-col bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-8 border-2 border-[#D4AF37] shadow-2xl shadow-[#D4AF37]/20 hover:scale-[1.02] transition-all"
          >
            {/* Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black text-sm font-black rounded-full whitespace-nowrap shadow-lg">
              {offer.badge}
            </div>

            {/* Ícone */}
            <div className="w-20 h-20 rounded-2xl bg-[#D4AF37]/20 border-2 border-[#D4AF37] flex items-center justify-center text-[#D4AF37] mb-6 mx-auto mt-4">
              {offer.icon}
            </div>

            {/* Título */}
            <h3 className="text-3xl font-black text-center mb-2">{offer.title}</h3>
            <p className="text-[#D4AF37] font-bold text-center mb-4">{offer.subtitle}</p>
            <p className="text-zinc-400 text-center leading-relaxed mb-6">{offer.desc}</p>

            {/* Benefícios */}
            <div className="bg-black/50 rounded-2xl p-6 mb-6 flex-1">
              <h4 className="font-bold text-sm text-zinc-400 uppercase tracking-wider mb-4">O que você vai aprender:</h4>
              <ul className="space-y-3">
                {offer.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                    <CheckCircle2 size={18} className="text-green-400 mt-0.5 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Preço */}
            <div className="text-center mb-6">
              <p className="text-zinc-500 text-sm mb-1">
                De <span className="line-through">{offer.priceOriginal}</span> por apenas:
              </p>
              <p className="text-5xl font-black text-[#D4AF37] mb-2">{offer.price}</p>
              <div className="inline-block px-4 py-1 bg-green-500/20 border border-green-500/40 rounded-full">
                <span className="text-green-400 font-bold text-sm">{offer.discount} — Economia de {offer.priceOriginal.replace('R$ ', 'R$ ')} - {offer.price.replace('R$ ', '')}</span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => handleBuy(offer)}
              className="w-full py-5 px-6 bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] text-black font-black text-xl rounded-2xl
                         hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#D4AF37]/30"
            >
              🚀 QUERO ESTE MÓDULO AGORA
            </button>
          </div>
        ))}
      </div>

      {/* Comparação */}
      <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h3 className="text-2xl font-black text-center mb-8">💰 Potencial de Lucro</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-black rounded-2xl p-6 border border-[#D4AF37]/30">
            <h4 className="font-black text-[#D4AF37] mb-4">Módulo Limpa Nome</h4>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>✅ Ticket médio: R$ 500 - R$ 1.500</li>
              <li>✅ Margem de lucro: 40-60%</li>
              <li>✅ Demanda infinita (milhões com nome sujo)</li>
              <li>✅ Baixo risco (pagamento adiantado)</li>
            </ul>
          </div>
          <div className="bg-black rounded-2xl p-6 border border-[#D4AF37]/30">
            <h4 className="font-black text-[#D4AF37] mb-4">Módulo Financiamento de Moto</h4>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>✅ Ticket médio: R$ 5.000 - R$ 20.000</li>
              <li>✅ Lucro por operação: R$ 1.000 - R$ 4.000</li>
              <li>✅ Garantia real (moto alienada)</li>
              <li>✅ Risco reduzido e alta lucratividade</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Botão de Recusa */}
      <button
        onClick={handleDecline}
        className="text-zinc-600 text-sm underline underline-offset-4 hover:text-zinc-400 transition-colors"
      >
        Não, obrigado. Continuar sem os módulos.
      </button>

      {/* Garantia */}
      <div className="w-full max-w-3xl bg-gradient-to-br from-green-900/20 to-black border border-green-500/30 rounded-2xl p-6 text-center">
        <p className="text-zinc-300 text-sm">
          🔒 <strong>Garantia de 7 dias</strong> também vale para estes módulos. Sem risco!
        </p>
      </div>

    </section>
  );
}
