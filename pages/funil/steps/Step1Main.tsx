import { useEffect, useState } from 'react';
import { ShieldCheck, TrendingUp, Users, Banknote, Clock, Star, CheckCircle2, Zap, Target, Award, Rocket, DollarSign } from 'lucide-react';
import { FunnelVideo } from '../FunnelVideo';
import { track, trackPurchase } from '../funnelTracker';

// ── URLs e configurações ──────────────────────────────────────────────────────
const VIDEO_URL    = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/01-pre-lancamento.mp4';
const WHATSAPP_NUMBER = '+55 11 98757-7050';
const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID || 'price_1TA7JnHhASMXt4ie8fYEG47C';
const API_URL = import.meta.env.VITE_API_URL || 'https://app-api.tubaraoemprestimo.com.br/api';

// Data de término do pré-lançamento (5 dias a partir de agora)
const COUNTDOWN_END = new Date('2026-03-09T23:59:59').getTime();

const BENEFITS = [
  { icon: <Rocket size={24} />, title: 'Sistema Completo', desc: 'Tudo que você precisa para começar do zero: contratos, planilhas, scripts de vendas e análise de crédito.' },
  { icon: <DollarSign size={24} />, title: 'Lucro Imediato', desc: 'Comece a ganhar dinheiro desde o primeiro empréstimo. Método validado por centenas de alunos.' },
  { icon: <ShieldCheck size={24} />, title: 'Risco Calculado', desc: 'Aprenda a analisar clientes, evitar calotes e construir uma carteira saudável e lucrativa.' },
  { icon: <TrendingUp size={24} />, title: 'Escala Rápida', desc: 'Metodologia comprovada para crescer de R$10k a R$100k/mês em menos de 6 meses.' },
  { icon: <Users size={24} />, title: 'Rede de Clientes', desc: 'Estratégias para atrair clientes fiéis que voltam sempre e indicam novos clientes.' },
  { icon: <Clock size={24} />, title: 'Liberdade Total', desc: 'Trabalhe de onde quiser, no horário que preferir. Seja dono do seu tempo e da sua vida.' },
  { icon: <Star size={24} />, title: 'Suporte VIP', desc: 'Grupo exclusivo no WhatsApp, materiais atualizados e suporte para tirar todas as suas dúvidas.' },
  { icon: <Target size={24} />, title: 'Método Validado', desc: 'Mais de 500 alunos já transformaram suas vidas com o Método Tubarão.' },
  { icon: <Award size={24} />, title: 'Garantia de 7 Dias', desc: 'Se não gostar, devolvemos 100% do seu dinheiro. Sem perguntas, sem burocracia.' },
];

const MODULES = [
  { title: 'Módulo 1: Fundamentos', items: ['Mindset do emprestador de sucesso', 'Como começar do zero absoluto', 'Quanto investir inicialmente'] },
  { title: 'Módulo 2: Análise de Crédito', items: ['Como avaliar um bom pagador', 'Ferramentas de consulta', 'Score e histórico'] },
  { title: 'Módulo 3: Contratos e Jurídico', items: ['Contratos blindados', 'Como se proteger legalmente', 'Cobrança eficaz'] },
  { title: 'Módulo 4: Captação de Clientes', items: ['Marketing digital para empréstimos', 'Redes sociais que convertem', 'Indicações e parcerias'] },
  { title: 'Módulo 5: Precificação', items: ['Como calcular juros', 'Taxas competitivas', 'Maximizar lucro'] },
  { title: 'Módulo 6: Escala e Automação', items: ['Sistemas de gestão', 'Como crescer sem perder controle', 'Equipe e processos'] },
];

const TESTIMONIALS = [
  { name: 'João Silva', city: 'São Paulo/SP', result: 'R$ 2.000 → R$ 15.000/mês', text: 'Em 4 meses saí do zero para R$ 15 mil por mês. O método é simples e funciona!' },
  { name: 'Maria Santos', city: 'Rio de Janeiro/RJ', result: 'Saiu do emprego em 60 dias', text: 'Larguei meu emprego CLT e hoje ganho 3x mais trabalhando de casa.' },
  { name: 'Carlos Oliveira', city: 'Belo Horizonte/MG', result: 'R$ 5.000 → R$ 32.000/mês', text: 'Multipliquei minha renda por 6 em menos de 6 meses. Vida transformada!' },
];

interface Step1Props { sessionId: string; onDecline: () => void }

export function Step1Main({ sessionId, onDecline }: Step1Props) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    track({ sessionId, step: 1, eventType: 'STEP_VIEW' });
  }, [sessionId]);

  // Contador regressivo real
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = COUNTDOWN_END - now;

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleBuy = async () => {
    // Se ainda não temos email, mostra o formulário
    if (!customerEmail) {
      setShowEmailForm(true);
      return;
    }

    setIsLoading(true);
    trackPurchase({ sessionId, step: 1, productName: 'Método Tubarão', amount: 497 });

    try {
      const response = await fetch(`${API_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: STRIPE_PRICE_ID,
          customerEmail,
          customerName: customerName || 'Cliente',
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao criar sessão de pagamento');
      }

      const { url } = await response.json();

      // Redireciona para o Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Erro ao processar checkout:', error);
      alert('Erro ao processar pagamento. Tente novamente ou entre em contato pelo WhatsApp.');
      setIsLoading(false);
    }
  };

  const handleDecline = () => {
    track({ sessionId, step: 1, eventType: 'CLICK_NO' });
    onDecline();
  };

  return (
    <section className="flex flex-col items-center gap-16 py-16 px-4 animate-in fade-in zoom-in-95 duration-700">

      {/* Badge de urgência */}
      <div className="inline-flex items-center gap-2 px-6 py-3 bg-red-500/10 border border-red-500/40 rounded-full animate-pulse">
        <Zap size={18} className="text-red-400" />
        <span className="text-sm font-bold text-red-400 uppercase tracking-wider">
          🔥 Pré-Lançamento — Preço Fundador Termina em Breve
        </span>
      </div>

      {/* Headline */}
      <div className="text-center max-w-5xl">
        <h1 className="text-5xl md:text-7xl font-black leading-[1.05] mb-6 bg-gradient-to-r from-white via-[#D4AF37] to-white bg-clip-text text-transparent">
          Construa um Negócio de Empréstimos Lucrativo do Zero
        </h1>
        <p className="text-xl md:text-2xl text-zinc-300 leading-relaxed max-w-3xl mx-auto mb-4">
          O <strong className="text-[#D4AF37]">Método Tubarão</strong> é o sistema completo para quem quer sair do emprego,
          ter liberdade financeira e construir uma renda sólida e recorrente com crédito pessoal.
        </p>
        <p className="text-lg text-zinc-400">
          Mais de <strong className="text-[#D4AF37]">500 alunos</strong> já transformaram suas vidas. Agora é a sua vez!
        </p>
      </div>

      {/* Contador Regressivo */}
      <div className="w-full max-w-3xl bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37] rounded-3xl p-8 shadow-2xl shadow-[#D4AF37]/20">
        <div className="text-center mb-6">
          <p className="text-sm text-zinc-400 uppercase tracking-wider mb-2">⏰ Oferta Especial Termina em:</p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Dias', value: timeLeft.days },
              { label: 'Horas', value: timeLeft.hours },
              { label: 'Min', value: timeLeft.minutes },
              { label: 'Seg', value: timeLeft.seconds },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center">
                <div className="bg-[#D4AF37] text-black font-black text-4xl md:text-5xl rounded-xl p-4 w-full min-h-[80px] flex items-center justify-center">
                  {String(item.value).padStart(2, '0')}
                </div>
                <span className="text-zinc-500 text-xs mt-2 uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center border-t border-zinc-800 pt-6">
          <p className="text-zinc-400 text-sm mb-2">De <span className="line-through">R$ 697</span> por apenas:</p>
          <p className="text-5xl font-black text-[#D4AF37] mb-2">R$ 497</p>
          <p className="text-green-400 font-bold text-sm">💰 Economize R$ 200 — Preço Fundador</p>
        </div>
      </div>

      {/* Vídeo de Vendas */}
      <div className="w-full max-w-5xl">
        <h2 className="text-3xl font-black text-center mb-6">
          🎥 Assista ao Vídeo e Descubra Como Funciona
        </h2>
        <FunnelVideo
          src={VIDEO_URL}
          autoPlay={false}
          onPlay={() => track({ sessionId, step: 1, eventType: 'VIDEO_PLAY' })}
          onComplete={() => track({ sessionId, step: 1, eventType: 'VIDEO_COMPLETE' })}
        />
      </div>

      {/* CTA Principal */}
      <div className="flex flex-col items-center gap-4 w-full max-w-xl">
        {showEmailForm ? (
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-xl font-bold text-center mb-4">📧 Últimos Dados para Finalizar</h3>
            <input
              type="text"
              placeholder="Seu nome completo"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
            <input
              type="email"
              placeholder="Seu melhor e-mail"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
            <button
              onClick={handleBuy}
              disabled={isLoading || !customerEmail}
              className="w-full py-4 px-8 bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] text-black font-black text-xl rounded-xl
                         hover:brightness-110 active:scale-[0.98] transition-all shadow-2xl shadow-[#D4AF37]/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '⏳ Processando...' : '🚀 FINALIZAR COMPRA'}
            </button>
            <button
              onClick={() => setShowEmailForm(false)}
              className="w-full text-zinc-500 text-sm underline"
            >
              Voltar
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handleBuy}
              disabled={isLoading}
              className="w-full py-6 px-8 bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] text-black font-black text-2xl rounded-2xl
                         hover:brightness-110 active:scale-[0.98] transition-all shadow-2xl shadow-[#D4AF37]/40 animate-pulse disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '⏳ Processando...' : '🚀 QUERO O MÉTODO TUBARÃO POR R$ 497'}
            </button>
            <p className="text-zinc-500 text-sm text-center">
              🔒 Pagamento 100% seguro · Acesso imediato · Garantia incondicional de 7 dias
            </p>
          </>
        )}
      </div>

      {/* Benefícios */}
      <div className="w-full max-w-6xl">
        <h2 className="text-4xl font-black text-center mb-12">
          ✨ O Que Você Vai Receber
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {BENEFITS.map((b, i) => (
            <div key={i} className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-2xl p-6 hover:border-[#D4AF37]/50 hover:shadow-lg hover:shadow-[#D4AF37]/10 transition-all group">
              <div className="w-14 h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4 group-hover:scale-110 transition-transform">
                {b.icon}
              </div>
              <h3 className="font-black text-lg mb-2">{b.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Módulos do Curso */}
      <div className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8 md:p-12">
        <h2 className="text-4xl font-black text-center mb-10">
          📚 Conteúdo Completo do Método
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {MODULES.map((module, i) => (
            <div key={i} className="bg-black border border-zinc-800 rounded-xl p-6">
              <h3 className="font-black text-[#D4AF37] mb-4">{module.title}</h3>
              <ul className="space-y-2">
                {module.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Depoimentos */}
      <div className="w-full max-w-6xl">
        <h2 className="text-4xl font-black text-center mb-12">
          💬 Veja o Que Nossos Alunos Estão Dizendo
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

      {/* CTA Final */}
      <div className="flex flex-col items-center gap-4 w-full max-w-xl">
        {showEmailForm ? (
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-xl font-bold text-center mb-4">📧 Últimos Dados para Finalizar</h3>
            <input
              type="text"
              placeholder="Seu nome completo"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
            <input
              type="email"
              placeholder="Seu melhor e-mail"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
            <button
              onClick={handleBuy}
              disabled={isLoading || !customerEmail}
              className="w-full py-4 px-8 bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] text-black font-black text-xl rounded-xl
                         hover:brightness-110 active:scale-[0.98] transition-all shadow-2xl shadow-[#D4AF37]/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '⏳ Processando...' : '🚀 FINALIZAR COMPRA'}
            </button>
            <button
              onClick={() => setShowEmailForm(false)}
              className="w-full text-zinc-500 text-sm underline"
            >
              Voltar
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handleBuy}
              disabled={isLoading}
              className="w-full py-6 px-8 bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] text-black font-black text-2xl rounded-2xl
                         hover:brightness-110 active:scale-[0.98] transition-all shadow-2xl shadow-[#D4AF37]/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '⏳ Processando...' : '🚀 SIM! QUERO TRANSFORMAR MINHA VIDA'}
            </button>
            <p className="text-zinc-500 text-sm text-center">
              🔒 Pagamento seguro · Acesso imediato · Garantia de 7 dias
            </p>
            <button
              onClick={handleDecline}
              className="text-zinc-600 text-sm underline underline-offset-4 hover:text-zinc-400 transition-colors mt-4"
            >
              Não, obrigado. Continuar sem comprar.
            </button>
          </>
        )}
      </div>

      {/* Garantia */}
      <div className="w-full max-w-4xl bg-gradient-to-br from-green-900/20 to-black border-2 border-green-500/30 rounded-3xl p-8 text-center">
        <ShieldCheck size={48} className="text-green-400 mx-auto mb-4" />
        <h3 className="text-2xl font-black mb-4">Garantia Incondicional de 7 Dias</h3>
        <p className="text-zinc-300 leading-relaxed max-w-2xl mx-auto">
          Se você não gostar do Método Tubarão por qualquer motivo, basta enviar um email para{' '}
          <a href="mailto:contato@tubaraoemprestimo.com.br" className="text-[#D4AF37] font-bold hover:underline">
            contato@tubaraoemprestimo.com.br
          </a>{' '}
          dentro de 7 dias e devolvemos 100% do seu dinheiro. Sem perguntas, sem burocracia.
        </p>
      </div>

      {/* FAQ Rápido */}
      <div className="w-full max-w-4xl">
        <h2 className="text-3xl font-black text-center mb-8">❓ Perguntas Frequentes</h2>
        <div className="space-y-4">
          {[
            { q: 'Preciso de muito dinheiro para começar?', a: 'Não! Você pode começar com apenas R$ 500 a R$ 1.000 e ir crescendo aos poucos.' },
            { q: 'Funciona em qualquer cidade?', a: 'Sim! O método funciona em todo o Brasil, de capitais a cidades pequenas.' },
            { q: 'Quanto tempo leva para ter resultados?', a: 'Muitos alunos fazem o primeiro empréstimo na primeira semana. Em 30-60 dias você já pode estar lucrando consistentemente.' },
            { q: 'Preciso de CNPJ?', a: 'Não é obrigatório no início. Você pode começar como pessoa física e depois formalizar.' },
          ].map((faq, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h4 className="font-bold text-[#D4AF37] mb-2">{faq.q}</h4>
              <p className="text-zinc-400 text-sm">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
