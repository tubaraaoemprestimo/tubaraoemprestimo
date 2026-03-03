import { useState } from 'react';
import { Users, CheckCircle2, Video, MessageCircle, Calendar, TrendingUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Link de checkout InfinitePay
const CHECKOUT_MENTORIA_ONLINE_URL = 'https://link.infinitepay.io/tubaraoemprestimo/VC1DLUEtSQ-7NUsdS72g5-3997,00';

// Vídeo hospedado no Cloudflare R2
const VIDEO_MENTORIA_ONLINE_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/03-pitch-mentorias.mp4';

export default function MentoriaOnline() {
  const navigate = useNavigate();
  const [showVideo, setShowVideo] = useState(true);

  const handleRecusar = () => {
    // Redirecionar para Etapa 4 (Mentoria Presencial)
    navigate('/funil/mentoria-presencial');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-black via-zinc-900 to-black">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.1),transparent_50%)] pointer-events-none" />

        <div className="relative z-10 w-full max-w-5xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full">
              <Sparkles size={16} className="text-purple-400" />
              <span className="text-sm font-bold text-purple-400 uppercase tracking-wider">
                Aceleração Exclusiva
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-center mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            Acelere Seus Resultados com{' '}
            <span className="text-[#D4AF37]">Mentoria em Grupo</span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 text-center mb-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            Tenha acesso direto aos especialistas, tire suas dúvidas ao vivo e aprenda com casos
            reais de alunos que já estão <strong className="text-white">faturando alto</strong>.
          </p>

          {/* Vídeo de Pitch */}
          {showVideo && (
            <div className="relative w-full max-w-4xl mx-auto mb-8 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#D4AF37]/20 animate-in fade-in zoom-in-95 duration-700 delay-300">
              <div className="relative aspect-video bg-zinc-900">
                <video
                  controls
                  autoPlay
                  poster="/images/mentoria-thumbnail.jpg"
                  className="w-full h-full"
                  preload="metadata"
                  playsInline
                >
                  <source src={VIDEO_MENTORIA_ONLINE_URL} type="video/mp4" />
                  Seu navegador não suporta vídeo HTML5.
                </video>
              </div>
            </div>
          )}

          {/* CTA Principal */}
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="inline-block">
              {/* Preço */}
              <div className="mb-6">
                <div className="text-5xl md:text-6xl font-black text-[#D4AF37] mb-2">
                  R$ 3.997
                </div>
                <p className="text-zinc-400 text-sm">
                  Acesso por 3 meses • Encontros semanais ao vivo
                </p>
              </div>

              {/* Botão de Compra */}
              <a
                href={CHECKOUT_MENTORIA_ONLINE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black text-xl font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:shadow-[0_0_60px_rgba(212,175,55,0.6)] mb-4"
              >
                <span>GARANTIR MINHA VAGA NA MENTORIA</span>
                <TrendingUp size={24} />
              </a>

              <p className="text-xs text-zinc-600 mb-6">
                🔒 Pagamento 100% seguro via InfinitePay
              </p>

              {/* Botão de Recusa */}
              <button
                onClick={handleRecusar}
                className="text-zinc-500 hover:text-zinc-400 transition-colors text-sm underline"
              >
                Não, quero continuar sem a mentoria
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* O Que Está Incluído */}
      <section className="py-20 px-4 bg-zinc-950">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-center mb-4">
            O Que Você Vai <span className="text-[#D4AF37]">Receber</span>
          </h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Uma experiência completa de aceleração com suporte direto e comunidade ativa.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Video size={32} />,
                title: 'Encontros Semanais ao Vivo',
                description:
                  '4 encontros por mês com análise de casos reais, estratégias avançadas e sessões de perguntas e respostas.',
              },
              {
                icon: <MessageCircle size={32} />,
                title: 'Grupo Exclusivo no WhatsApp',
                description:
                  'Acesso ao grupo VIP com alunos ativos, networking e suporte diário da equipe de mentores.',
              },
              {
                icon: <Users size={32} />,
                title: 'Comunidade de Alto Nível',
                description:
                  'Conecte-se com outros empreendedores do setor, troque experiências e crie parcerias estratégicas.',
              },
              {
                icon: <Calendar size={32} />,
                title: 'Gravações Disponíveis',
                description:
                  'Todas as mentorias ficam gravadas para você assistir quando quiser, quantas vezes precisar.',
              },
              {
                icon: <TrendingUp size={32} />,
                title: 'Análise de Carteira',
                description:
                  'Revisão personalizada da sua carteira de clientes com sugestões de otimização e crescimento.',
              },
              {
                icon: <CheckCircle2 size={32} />,
                title: 'Material Complementar',
                description:
                  'Planilhas, templates, scripts e ferramentas exclusivas liberadas durante as mentorias.',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-[#D4AF37]/50 transition-all group"
              >
                <div className="w-14 h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-4 text-[#D4AF37] group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="py-20 px-4 bg-black">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-center mb-12">
            O Que Nossos <span className="text-[#D4AF37]">Alunos Dizem</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Carlos Silva',
                result: 'De R$ 2.000 para R$ 15.000/mês',
                text: 'A mentoria foi o divisor de águas. Em 2 meses já tinha triplicado meu faturamento.',
              },
              {
                name: 'Ana Paula',
                result: 'Carteira de 50+ clientes ativos',
                text: 'O networking do grupo me trouxe parcerias que sozinha eu nunca conseguiria.',
              },
              {
                name: 'Roberto Lima',
                result: 'Primeiro mês: R$ 8.500',
                text: 'Implementei as estratégias da mentoria e os resultados vieram rápido demais!',
              },
            ].map((depo, idx) => (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-[#D4AF37]/30 transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] font-bold">
                    {depo.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold">{depo.name}</p>
                    <p className="text-xs text-green-400">{depo.result}</p>
                  </div>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed italic">"{depo.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 bg-gradient-to-b from-black to-zinc-950">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-black mb-6">
            Última Chance de <span className="text-[#D4AF37]">Acelerar</span>
          </h2>
          <p className="text-zinc-400 text-lg mb-8">
            As vagas são limitadas para garantir a qualidade do atendimento. Garanta a sua agora.
          </p>

          <a
            href={CHECKOUT_MENTORIA_ONLINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black text-xl font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(212,175,55,0.4)] mb-4"
          >
            <span>GARANTIR VAGA POR R$ 3.997</span>
            <TrendingUp size={24} />
          </a>

          <p className="text-xs text-zinc-600 mb-6">
            Garantia de 7 dias • Acesso imediato após pagamento
          </p>

          <button
            onClick={handleRecusar}
            className="text-zinc-500 hover:text-zinc-400 transition-colors text-sm underline"
          >
            Não, quero continuar sem a mentoria
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-zinc-900 text-center text-zinc-600 text-sm">
        <p>© 2026 Método Tubarão. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
