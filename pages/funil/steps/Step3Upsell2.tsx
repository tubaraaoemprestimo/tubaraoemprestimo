import { useEffect } from 'react';
import { Video, MessageSquare, Trophy, CheckCircle2 } from 'lucide-react';
import { FunnelVideo } from '../FunnelVideo';
import { track, trackPurchase } from '../funnelTracker';

const VIDEO_URL    = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/03-pitch-mentorias.mp4';
const CHECKOUT_URL = 'https://link.infinitepay.io/tubaraoemprestimo/VC1DLUEtSQ-7NUsdS72g5-3997,00';

const INCLUSO = [
  { icon: <Video         size={20} />, text: '12 semanas de mentoria ao vivo toda semana' },
  { icon: <MessageSquare size={20} />, text: 'Grupo exclusivo no WhatsApp com suporte diário' },
  { icon: <Trophy        size={20} />, text: 'Acompanhamento individual do seu negócio' },
  { icon: <CheckCircle2  size={20} />, text: 'Acesso a todos os materiais e planilhas avançadas' },
  { icon: <CheckCircle2  size={20} />, text: 'Gravações de todas as sessões para rever quando quiser' },
  { icon: <CheckCircle2  size={20} />, text: 'Comunidade de emprestadores de todo o Brasil' },
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
    <section className="flex flex-col items-center gap-10 py-12 px-4 animate-in fade-in zoom-in-95 duration-700">

      <div className="inline-flex items-center gap-2 px-5 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full">
        <span className="text-sm font-bold text-purple-400 uppercase tracking-wider">
          Para quem quer resultados acelerados
        </span>
      </div>

      <div className="text-center max-w-3xl">
        <h1 className="text-4xl md:text-6xl font-black mb-4">
          Mentoria Online{' '}
          <span className="text-[#D4AF37]">ao Vivo</span>{' '}
          — Chegue Mais Rápido
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          Pare de perder tempo tentando sozinho. Com a mentoria, você terá acompanhamento
          semanal para tirar dúvidas, analisar casos reais e acelerar seus resultados.
        </p>
      </div>

      <div className="w-full max-w-4xl">
        <FunnelVideo
          src={VIDEO_URL}
          autoPlay={true}
          onPlay={()     => track({ sessionId, step: 3, eventType: 'VIDEO_PLAY' })}
          onComplete={() => track({ sessionId, step: 3, eventType: 'VIDEO_COMPLETE' })}
        />
      </div>

      <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h2 className="text-xl font-black mb-5 text-[#D4AF37]">O que está incluso:</h2>
        <div className="space-y-3">
          {INCLUSO.map((b, i) => (
            <div key={i} className="flex items-center gap-3 text-zinc-300">
              <span className="shrink-0 text-[#D4AF37]">{b.icon}</span>
              <span className="text-sm">{b.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Depoimentos */}
      <div className="grid md:grid-cols-2 gap-4 w-full max-w-3xl">
        {[
          { name: 'Carlos M.', city: 'São Paulo',      text: 'Em 3 meses de mentoria, minha carteira cresceu 5×. O suporte semanal fez toda a diferença.' },
          { name: 'Ana P.',    city: 'Belo Horizonte', text: 'Saí do emprego em 60 dias. A mentoria me deu o caminho exato para chegar lá.' },
        ].map((t, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-zinc-300 text-sm italic mb-3">"{t.text}"</p>
            <p className="font-bold text-xs text-[#D4AF37]">{t.name} · {t.city}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <button
          onClick={handleBuy}
          className="w-full py-5 px-8 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-black text-xl rounded-2xl
                     hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/25"
        >
          Quero a Mentoria Online — R$ 3.997
        </button>
        <p className="text-zinc-500 text-xs">🔒 Pagamento seguro · Parcelamento disponível</p>
      </div>

      <button
        onClick={handleDecline}
        className="text-zinc-600 text-sm underline underline-offset-4 hover:text-zinc-400 transition-colors"
      >
        Não, prefiro crescer no meu ritmo.
      </button>

    </section>
  );
}
