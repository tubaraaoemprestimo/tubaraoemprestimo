import { useEffect, useState } from 'react';
import { Play, CheckCircle2, Clock, TrendingUp, Users, Award, Zap } from 'lucide-react';

// Configuração do contador - 5 dias a partir de agora
const COUNTDOWN_DAYS = 5;
const PRECO_FUNDADOR = 497;
const PRECO_OFICIAL = 697;

// Link de checkout InfinitePay
const INFINITEPAY_CHECKOUT_URL = 'https://link.infinitepay.io/tubaraoemprestimo/VC1DLUEtSQ-MsCyVA2ER-497,00';

// Vídeo hospedado no Cloudflare R2
const VIDEO_PRE_LANCAMENTO_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/01-pre-lancamento.mp4';

export default function PreLancamento() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false,
  });

  useEffect(() => {
    // Calcular data final do contador (5 dias a partir de agora)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + COUNTDOWN_DAYS);

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const distance = endDate.getTime() - now;

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
        expired: false,
      });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, []);

  const precoAtual = timeLeft.expired ? PRECO_OFICIAL : PRECO_FUNDADOR;
  const descontoPercentual = Math.round(((PRECO_OFICIAL - PRECO_FUNDADOR) / PRECO_OFICIAL) * 100);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section com Vídeo */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-black via-zinc-900 to-black">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.1),transparent_50%)] pointer-events-none" />

        <div className="relative z-10 w-full max-w-5xl mx-auto">
          {/* Badge de Lançamento */}
          <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full">
              <Zap size={16} className="text-[#D4AF37]" />
              <span className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider">
                Pré-Lançamento Exclusivo
              </span>
            </div>
          </div>

          {/* Headline Principal */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-center mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            Transforme <span className="text-[#D4AF37]">R$ 1.000</span> em{' '}
            <span className="text-[#D4AF37]">R$ 10.000</span> por Mês
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 text-center mb-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            O método completo que transformou pessoas comuns em{' '}
            <strong className="text-white">empresários de sucesso</strong> no mercado de
            empréstimos — mesmo começando do zero.
          </p>

          {/* Vídeo de Vendas */}
          <div className="relative w-full max-w-4xl mx-auto mb-8 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#D4AF37]/20 animate-in fade-in zoom-in-95 duration-700 delay-300">
            <div className="relative aspect-video bg-zinc-900">
              <video
                controls
                poster="/images/video-thumbnail.jpg"
                className="absolute inset-0 w-full h-full"
                preload="metadata"
                playsInline
              >
                <source src={VIDEO_PRE_LANCAMENTO_URL} type="video/mp4" />
                Seu navegador não suporta vídeo HTML5.
              </video>
            </div>
          </div>

          {/* Contador Regressivo */}
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="bg-gradient-to-r from-red-900/20 to-red-800/20 border-2 border-red-500/50 rounded-2xl p-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Clock size={24} className="text-red-400" />
                <h3 className="text-xl md:text-2xl font-bold text-red-400 uppercase tracking-wider">
                  {timeLeft.expired ? 'Oferta Encerrada' : 'Oferta Fundador Termina Em:'}
                </h3>
              </div>

              {!timeLeft.expired ? (
                <div className="grid grid-cols-4 gap-3 md:gap-4">
                  {[
                    { value: timeLeft.days, label: 'Dias' },
                    { value: timeLeft.hours, label: 'Horas' },
                    { value: timeLeft.minutes, label: 'Min' },
                    { value: timeLeft.seconds, label: 'Seg' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-black/50 border border-red-500/30 rounded-xl p-3 md:p-4 text-center"
                    >
                      <div className="text-3xl md:text-5xl font-black text-red-400 mb-1">
                        {String(item.value).padStart(2, '0')}
                      </div>
                      <div className="text-xs md:text-sm text-zinc-400 uppercase tracking-wider">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-zinc-400 text-lg">
                  O valor fundador expirou. Preço atual: R$ {PRECO_OFICIAL.toLocaleString('pt-BR')}
                </p>
              )}

              {!timeLeft.expired && (
                <p className="text-center text-sm text-zinc-500 mt-4">
                  Após o término, o valor sobe para R$ {PRECO_OFICIAL.toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>

          {/* CTA Principal */}
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <div className="inline-block">
              {/* Preço */}
              <div className="mb-4">
                {!timeLeft.expired && (
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="text-2xl text-zinc-500 line-through">
                      R$ {PRECO_OFICIAL.toLocaleString('pt-BR')}
                    </span>
                    <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full">
                      -{descontoPercentual}%
                    </span>
                  </div>
                )}
                <div className="text-5xl md:text-6xl font-black text-[#D4AF37] mb-2">
                  R$ {precoAtual.toLocaleString('pt-BR')}
                </div>
                <p className="text-zinc-400 text-sm">
                  {!timeLeft.expired ? 'Valor Fundador' : 'Valor Oficial'} • Acesso Vitalício
                </p>
              </div>

              {/* Botão de Compra */}
              {!timeLeft.expired ? (
                <a
                  href={INFINITEPAY_CHECKOUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black text-xl font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:shadow-[0_0_60px_rgba(212,175,55,0.6)]"
                >
                  <span>GARANTIR MINHA VAGA AGORA</span>
                  <TrendingUp size={24} />
                </a>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-zinc-800 text-zinc-500 text-xl font-black rounded-2xl cursor-not-allowed opacity-50"
                >
                  <span>OFERTA ENCERRADA</span>
                </button>
              )}

              <p className="text-xs text-zinc-600 mt-3">
                🔒 Pagamento 100% seguro via InfinitePay
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Benefícios */}
      <section className="py-20 px-4 bg-zinc-950">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-center mb-4">
            O Que Você Vai <span className="text-[#D4AF37]">Aprender</span>
          </h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Um método completo, passo a passo, para você construir um negócio lucrativo de
            empréstimos do zero.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: <TrendingUp size={32} />,
                title: 'Sistema de Captação de Clientes',
                description:
                  'Aprenda a atrair clientes qualificados todos os dias usando estratégias comprovadas de marketing digital.',
              },
              {
                icon: <Users size={32} />,
                title: 'Gestão de Carteira de Clientes',
                description:
                  'Domine as técnicas de análise de crédito, precificação e gestão de risco para maximizar seus lucros.',
              },
              {
                icon: <Award size={32} />,
                title: 'Automação Completa',
                description:
                  'Tenha acesso ao sistema completo de gestão, cobrança automática e controle financeiro.',
              },
              {
                icon: <Zap size={32} />,
                title: 'Estratégias de Crescimento',
                description:
                  'Escale seu negócio de R$ 1.000 para R$ 10.000+ por mês com as estratégias dos top players do mercado.',
              },
              {
                icon: <CheckCircle2 size={32} />,
                title: 'Conformidade Legal',
                description:
                  'Opere 100% dentro da lei com nosso guia completo de regularização e boas práticas.',
              },
              {
                icon: <Play size={32} />,
                title: 'Suporte Exclusivo',
                description:
                  'Acesso vitalício ao conteúdo + grupo exclusivo de alunos + atualizações constantes.',
              },
            ].map((benefit, idx) => (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-[#D4AF37]/50 transition-all group"
              >
                <div className="w-14 h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-4 text-[#D4AF37] group-hover:scale-110 transition-transform">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 bg-gradient-to-b from-zinc-950 to-black">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-black mb-6">
            Pronto Para <span className="text-[#D4AF37]">Transformar</span> Sua Vida?
          </h2>
          <p className="text-zinc-400 text-lg mb-8">
            Junte-se a centenas de alunos que já estão faturando alto com o Método Tubarão.
          </p>

          {!timeLeft.expired ? (
            <a
              href={INFINITEPAY_CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black text-xl font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(212,175,55,0.4)]"
            >
              <span>GARANTIR ACESSO POR R$ {precoAtual}</span>
              <TrendingUp size={24} />
            </a>
          ) : (
            <button
              disabled
              className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-zinc-800 text-zinc-500 text-xl font-black rounded-2xl cursor-not-allowed opacity-50"
            >
              <span>OFERTA ENCERRADA</span>
            </button>
          )}

          <p className="text-xs text-zinc-600 mt-4">
            Garantia de 7 dias • Acesso imediato após pagamento
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-zinc-900 text-center text-zinc-600 text-sm">
        <p>© 2026 Método Tubarão. Todos os direitos reservados.</p>
        <p className="mt-2">
          <a href="/termos" className="hover:text-[#D4AF37] transition-colors">
            Termos de Uso
          </a>
          {' • '}
          <a href="/privacidade" className="hover:text-[#D4AF37] transition-colors">
            Política de Privacidade
          </a>
        </p>
      </footer>
    </div>
  );
}
