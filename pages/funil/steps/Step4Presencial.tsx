import { useEffect, useState } from 'react';
import { MapPin, Users, Flame, CheckCircle2, Star, Award, Zap, Calendar } from 'lucide-react';
import { FunnelVideo } from '../FunnelVideo';
import { track, trackPurchase } from '../funnelTracker';

const VIDEO_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/video-etapa1.mp4';
const CHECKOUT_URL = 'https://link.infinitepay.io/tubaraoemprestimo/VC1DLUEtSQ-7NUrPuK8AH-5997,00';

const BENEFITS = [
  { icon: <Users size={22} />, text: '3 dias intensivos presenciais em São Paulo' },
  { icon: <Star size={22} />, text: 'Networking com outros emprestadores de sucesso' },
  { icon: <Award size={22} />, text: 'Certificado de conclusão exclusivo' },
  { icon: <CheckCircle2 size={22} />, text: 'Material físico completo (apostilas + contratos)' },
  { icon: <CheckCircle2 size={22} />, text: 'Acesso vitalício ao grupo de ex-alunos' },
  { icon: <CheckCircle2 size={22} />, text: 'Suporte prioritário por 6 meses' },
];

const SCHEDULE = [
  { day: 'Dia 1', title: 'Fundamentos e Estratégia', desc: 'Mindset, análise de crédito avançada, precificação e gestão de risco.' },
  { day: 'Dia 2', title: 'Operação e Escala', desc: 'Captação massiva, automação, sistemas e processos para crescer sem perder controle.' },
  { day: 'Dia 3', title: 'Casos Reais e Networking', desc: 'Análise de casos reais, resolução de problemas e networking com outros emprestadores.' },
];

interface Step4Props { sessionId: string; onDecline: () => void }

export function Step4Presencial({ sessionId, onDecline }: Step4Props) {
  const [vagas, setVagas] = useState(3);

  useEffect(() => {
    track({ sessionId, step: 4, eventType: 'STEP_VIEW' });
  }, [sessionId]);

  const handleBuy = () => {
    trackPurchase({ sessionId, step: 4, productName: 'Mentoria Presencial', amount: 5997 });
    window.open(`${CHECKOUT_URL}?sid=${sessionId}`, '_blank');
  };

  const handleDecline = () => {
    track({ sessionId, step: 4, eventType: 'CLICK_NO' });
    onDecline();
  };

  return (
    <section className="flex flex-col items-center gap-12 py-16 px-4 animate-in fade-in zoom-in-95 duration-700">

      {/* Badge de Urgência */}
      <div className="inline-flex items-center gap-2 px-6 py-3 bg-red-500/10 border-2 border-red-500/40 rounded-full animate-pulse">
        <Flame size={20} className="text-red-400" />
        <span className="text-sm font-bold text-red-400 uppercase tracking-wider">
          🔥 Apenas {vagas} Vagas Disponíveis — São Paulo
        </span>
      </div>

      {/* Headline */}
      <div className="text-center max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
          Imersão{' '}
          <span className="text-[#D4AF37]">Presencial</span>{' '}
          — 3 Dias Transformadores
        </h1>
        <p className="text-xl text-zinc-300 leading-relaxed">
          A experiência mais completa e exclusiva para quem quer{' '}
          <strong className="text-[#D4AF37]">dominar o mercado de empréstimos</strong> e construir um negócio de 6 dígitos por mês.
        </p>
      </div>

      {/* Vídeo */}
      <div className="w-full max-w-5xl">
        <h3 className="text-2xl font-black text-center mb-6">
          🎥 Veja Como Será a Imersão Presencial
        </h3>
        <FunnelVideo
          src={VIDEO_URL}
          autoPlay={true}
          onPlay={() => track({ sessionId, step: 4, eventType: 'VIDEO_PLAY' })}
          onComplete={() => track({ sessionId, step: 4, eventType: 'VIDEO_COMPLETE' })}
        />
      </div>

      {/* Escassez */}
      <div className="w-full max-w-4xl bg-gradient-to-br from-red-900/20 to-black border-2 border-red-500/40 rounded-3xl p-8 text-center">
        <Flame size={56} className="text-red-400 mx-auto mb-4 animate-pulse" />
        <h2 className="text-3xl font-black mb-4">⚠️ Vagas Extremamente Limitadas</h2>
        <p className="text-xl text-zinc-300 leading-relaxed max-w-2xl mx-auto mb-6">
          Para garantir a qualidade do evento e networking de alto nível, limitamos a{' '}
          <strong className="text-red-400">apenas {vagas} vagas</strong> por turma.
        </p>
        <p className="text-zinc-400">
          Última turma esgotou em menos de 48 horas. Não perca esta oportunidade!
        </p>
      </div>

      {/* Programação */}
      <div className="w-full max-w-5xl">
        <h2 className="text-3xl font-black text-center mb-10">📅 Programação Completa</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {SCHEDULE.map((item, i) => (
            <div key={i} className="bg-gradient-to-br from-zinc-900 to-black border border-[#D4AF37] rounded-2xl p-6">
              <div className="w-12 h-12 rounded-xl bg-[#D4AF37] text-black font-black text-xl flex items-center justify-center mb-4">
                {i + 1}
              </div>
              <h3 className="font-black text-[#D4AF37] text-lg mb-2">{item.day}</h3>
              <h4 className="font-bold mb-3">{item.title}</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* O que está incluído */}
      <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h2 className="text-3xl font-black text-center mb-8">✨ O Que Está Incluído</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {BENEFITS.map((item, i) => (
            <div key={i} className="flex items-start gap-4 bg-black/50 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] flex-shrink-0">
                {item.icon}
              </div>
              <p className="text-zinc-300 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Localização */}
      <div className="w-full max-w-4xl bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-8">
        <div className="flex items-center justify-center gap-3 mb-6">
          <MapPin size={32} className="text-[#D4AF37]" />
          <h2 className="text-3xl font-black">Local do Evento</h2>
        </div>
        <div className="text-center">
          <p className="text-xl text-zinc-300 mb-2">📍 São Paulo/SP — Hotel 5 Estrelas</p>
          <p className="text-zinc-400 text-sm mb-4">Endereço será enviado após confirmação da inscrição</p>
          <div className="inline-block bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl px-6 py-3">
            <p className="text-zinc-300 text-sm">
              <Calendar className="inline mr-2" size={16} />
              <strong>Data:</strong> A definir (você será avisado com 30 dias de antecedência)
            </p>
          </div>
        </div>
      </div>

      {/* Bônus Exclusivos */}
      <div className="w-full max-w-5xl bg-gradient-to-br from-[#D4AF37]/10 to-black border-2 border-[#D4AF37] rounded-3xl p-8">
        <h2 className="text-3xl font-black text-center mb-8">🎁 Bônus Exclusivos</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-black/50 rounded-2xl p-6 border border-[#D4AF37]/30">
            <Zap size={32} className="text-[#D4AF37] mb-4" />
            <h3 className="font-black text-lg mb-2">Acesso Vitalício ao Grupo VIP</h3>
            <p className="text-zinc-400 text-sm">Networking permanente com os melhores emprestadores do Brasil.</p>
          </div>
          <div className="bg-black/50 rounded-2xl p-6 border border-[#D4AF37]/30">
            <Award size={32} className="text-[#D4AF37] mb-4" />
            <h3 className="font-black text-lg mb-2">Suporte Prioritário por 6 Meses</h3>
            <p className="text-zinc-400 text-sm">Tire dúvidas diretamente comigo via WhatsApp por 6 meses.</p>
          </div>
        </div>
      </div>

      {/* Preço e CTA */}
      <div className="w-full max-w-2xl bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37] rounded-3xl p-8 text-center">
        <h3 className="text-3xl font-black mb-4">Investimento na Sua Transformação</h3>
        <p className="text-zinc-400 mb-6">3 dias presenciais + Material completo + Networking + Suporte VIP</p>
        <div className="mb-8">
          <p className="text-zinc-500 text-sm mb-2">Investimento único:</p>
          <p className="text-6xl font-black text-[#D4AF37] mb-2">R$ 5.997</p>
          <p className="text-green-400 font-bold text-sm">Pagamento à vista</p>
        </div>
        <button
          onClick={handleBuy}
          className="w-full py-6 px-8 bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] text-black font-black text-2xl rounded-2xl
                     hover:brightness-110 active:scale-95 transition-all shadow-2xl shadow-[#D4AF37]/40 mb-4 animate-pulse"
        >
          🔥 GARANTIR MINHA VAGA AGORA
        </button>
        <p className="text-zinc-500 text-sm">🔒 Pagamento seguro</p>
      </div>

      {/* Botão de Recusa */}
      <button
        onClick={handleDecline}
        className="text-zinc-600 text-sm underline underline-offset-4 hover:text-zinc-400 transition-colors"
      >
        Não agora, vou ficar apenas com o que já adquiri.
      </button>

      {/* Garantia */}
      <div className="w-full max-w-3xl bg-gradient-to-br from-green-900/20 to-black border border-green-500/30 rounded-2xl p-6 text-center">
        <p className="text-zinc-300 text-sm">
          🔒 <strong>Garantia de 7 dias</strong> — Se não gostar, devolvemos 100% do seu dinheiro!
        </p>
      </div>

    </section>
  );
}
