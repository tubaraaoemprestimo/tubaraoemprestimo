import { useEffect } from 'react';
import { Video, MessageSquare, Trophy, CheckCircle2, Users, Calendar, Zap } from 'lucide-react';
import { FunnelVideo } from '../FunnelVideo';
import { track, trackPurchase } from '../funnelTracker';

const VIDEO_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/03-pitch-mentorias.mp4';
const CHECKOUT_URL = 'https://link.infinitepay.io/tubaraoemprestimo/VC1DLUEtSQ-7NUsdS72g5-3997,00';

const INCLUSO = [
  { icon: <Video size={22} />, text: '12 semanas de mentoria ao vivo (1x por semana)' },
  { icon: <MessageSquare size={22} />, text: 'Grupo exclusivo no WhatsApp com suporte diário' },
  { icon: <Trophy size={22} />, text: 'Acompanhamento individual do seu negócio' },
  { icon: <CheckCircle2 size={22} />, text: 'Acesso a todas as planilhas e materiais avançados' },
  { icon: <CheckCircle2 size={22} />, text: 'Gravações de todas as sessões para rever' },
  { icon: <Users size={22} />, text: 'Comunidade de emprestadores de todo o Brasil' },
];

const TESTIMONIALS = [
  { name: 'Pedro Costa', city: 'Curitiba/PR', result: 'R$ 8k → R$ 45k/mês', text: 'A mentoria online foi o divisor de águas. Em 3 meses triplicuei minha carteira.' },
  { name: 'Juliana Alves', city: 'Fortaleza/CE', result: 'Saiu do zero em 90 dias', text: 'Comecei do absoluto zero. Hoje tenho 40 clientes ativos e renda de R$ 25k/mês.' },
  { name: 'Roberto Lima', city: 'Salvador/BA', result: 'R$ 12k → R$ 60k/mês', text: 'O suporte semanal e o grupo me ajudaram a escalar rápido e com segurança.' },
];

interface Step3Props { sessionId: string; onDecline: () => void }

export function Step3Upsell2({ sessionId, onDecline }: Step3Props) {
  useEffect(() => {
    track({ sessionId, step: 3, eventType: 'STEP_VIEW' });
  }, [sessionId]);

  const handleBuy = () => {
    trackPurchase({ sessionId, step: 3, productName: 'Mentoria Online', amount: 3997 });
    window.open(`${CHECKOUT_URL}?sid=${sessionId}`, '_blank');
  };

  const handleDecline = () => {
    track({ sessionId, step: 3, eventType: 'CLICK_NO' });
    onDecline();
  };

  return (
    <section className="flex flex-col items-center gap-12 py-16 px-4 animate-in fade-in zoom-in-95 duration-700">

      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500/10 border border-purple-500/40 rounded-full">
        <Zap size={18} className="text-purple-400" />
        <span className="text-sm font-bold text-purple-400 uppercase tracking-wider">
          🚀 Para Quem Quer Resultados Acelerados
        </span>
      </div>

      {/* Headline */}
      <div className="text-center max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
          Mentoria Online em Grupo —{' '}
          <span className="text-[#D4AF37]">12 Semanas de Acompanhamento</span>
        </h1>
        <p className="text-xl text-zinc-300 leading-relaxed">
          Tenha suporte direto, tire dúvidas ao vivo e acelere seus resultados com{' '}
          <strong className="text-[#D4AF37]">acompanhamento semanal</strong> e grupo exclusivo.
        </p>
      </div>

      {/* Vídeo */}
      <div className="w-full max-w-5xl">
        <h3 className="text-2xl font-black text-center mb-6">
          🎥 Veja Como a Mentoria Vai Acelerar Sua Jornada
        </h3>
        <FunnelVideo
          src={VIDEO_URL}
          autoPlay={true}
          onPlay={() => track({ sessionId, step: 3, eventType: 'VIDEO_PLAY' })}
          onComplete={() => track({ sessionId, step: 3, eventType: 'VIDEO_COMPLETE' })}
        />
      </div>

      {/* O que está incluído */}
      <div className="w-full max-w-4xl bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37] rounded-3xl p-8 md:p-12">
        <h2 className="text-3xl font-black text-center mb-8">✨ O Que Está Incluído</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {INCLUSO.map((item, i) => (
            <div key={i} className="flex items-start gap-4 bg-black/50 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] flex-shrink-0">
                {item.icon}
              </div>
              <p className="text-zinc-300 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Depoimentos */}
      <div className="w-full max-w-6xl">
        <h2 className="text-3xl font-black text-center mb-10">
          💬 Resultados de Quem Fez a Mentoria
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-[#D4AF37]/30 transition-all">
              <div className="mb-4">
                <p className="font-black text-[#D4AF37] text-lg mb-1">{t.result}</p>
                <p className="text-zinc-500 text-xs">{t.name} · {t.city}</p>
              </div>
              <p className="text-zinc-300 text-sm italic leading-relaxed">"{t.text}"</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comparação */}
      <div className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h3 className="text-2xl font-black text-center mb-8">🎯 Com vs Sem Mentoria</h3>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-red-900/10 border border-red-500/30 rounded-2xl p-6">
            <h4 className="font-black text-red-400 mb-4 text-center">❌ Sem Mentoria</h4>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li>• Aprende sozinho (tentativa e erro)</li>
              <li>• Demora 6-12 meses para resultados</li>
              <li>• Comete erros caros</li>
              <li>• Sem suporte quando travar</li>
              <li>• Crescimento lento e inseguro</li>
            </ul>
          </div>
          <div className="bg-green-900/10 border border-green-500/30 rounded-2xl p-6">
            <h4 className="font-black text-green-400 mb-4 text-center">✅ Com Mentoria</h4>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li>• Acompanhamento semanal ao vivo</li>
              <li>• Resultados em 30-60 dias</li>
              <li>• Evita erros caros desde o início</li>
              <li>• Suporte diário no grupo VIP</li>
              <li>• Crescimento rápido e seguro</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Preço e CTA */}
      <div className="w-full max-w-2xl bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37] rounded-3xl p-8 text-center">
        <Calendar size={48} className="text-[#D4AF37] mx-auto mb-4" />
        <h3 className="text-3xl font-black mb-4">12 Semanas de Mentoria Online</h3>
        <p className="text-zinc-400 mb-6">Acompanhamento semanal + Grupo VIP + Materiais exclusivos</p>
        <div className="mb-8">
          <p className="text-zinc-500 text-sm mb-2">Investimento único:</p>
          <p className="text-6xl font-black text-[#D4AF37] mb-2">R$ 3.997</p>
          <p className="text-green-400 font-bold text-sm">Pagamento à vista</p>
        </div>
        <button
          onClick={handleBuy}
          className="w-full py-6 px-8 bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] text-black font-black text-2xl rounded-2xl
                     hover:brightness-110 active:scale-95 transition-all shadow-2xl shadow-[#D4AF37]/40 mb-4"
        >
          🚀 QUERO A MENTORIA ONLINE
        </button>
        <p className="text-zinc-500 text-sm">🔒 Pagamento seguro</p>
      </div>

      {/* Botão de Recusa */}
      <button
        onClick={handleDecline}
        className="text-zinc-600 text-sm underline underline-offset-4 hover:text-zinc-400 transition-colors"
      >
        Não, prefiro crescer no meu ritmo.
      </button>

      {/* Garantia */}
      <div className="w-full max-w-3xl bg-gradient-to-br from-green-900/20 to-black border border-green-500/30 rounded-2xl p-6 text-center">
        <p className="text-zinc-300 text-sm">
          🔒 <strong>Garantia de 7 dias</strong> — Se não gostar, devolvemos seu dinheiro!
        </p>
      </div>

    </section>
  );
}
