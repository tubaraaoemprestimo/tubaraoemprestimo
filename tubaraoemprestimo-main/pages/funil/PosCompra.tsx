import { useState } from 'react';
import { CheckCircle2, Sparkles, TrendingUp, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Links de checkout InfinitePay
const CHECKOUT_LIMPA_NOME_URL = 'https://link.infinitepay.io/tubaraoemprestimo/VC1DLUEtSQ-7NUnL8kth5-297,00';
const CHECKOUT_FINANCIAMENTO_MOTO_URL = 'https://link.infinitepay.io/tubaraoemprestimo/VC1DLUEtSQ-3gkPAIq4JF-297,00';
const CHECKOUT_COMBO_URL = 'https://link.infinitepay.io/tubaraoemprestimo/VC1DLUEtSQ-ope8lFBEf-450,00';

// Vídeos hospedados no Cloudflare R2
const VIDEO_UPSELL_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/02-upsell-modulos.mp4';
const VIDEO_RECUSA_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/04-recusa.mp4';

export default function PosCompra() {
  const navigate = useNavigate();
  const [showRecusaModal, setShowRecusaModal] = useState(false);

  const handleRecusarClick = () => {
    setShowRecusaModal(true);
  };

  const handleFecharModal = () => {
    setShowRecusaModal(false);
    navigate('/funil/mentoria-online');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section - Parabéns */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-black via-zinc-900 to-black">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.1),transparent_50%)] pointer-events-none" />

        <div className="relative z-10 w-full max-w-5xl mx-auto">
          {/* Badge de Sucesso */}
          <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full">
              <CheckCircle2 size={20} className="text-green-400" />
              <span className="text-sm font-bold text-green-400 uppercase tracking-wider">
                Pagamento Confirmado
              </span>
            </div>
          </div>

          {/* Headline de Parabéns */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-center mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            🎉 <span className="text-[#D4AF37]">Parabéns!</span> Você Está Dentro
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 text-center mb-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            Seu acesso ao <strong className="text-white">Método Tubarão</strong> foi liberado! Mas
            antes de começar, temos uma{' '}
            <strong className="text-[#D4AF37]">oferta especial exclusiva</strong> para você...
          </p>

          {/* Vídeo de Upsell */}
          <div className="relative w-full max-w-4xl mx-auto mb-8 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#D4AF37]/20 animate-in fade-in zoom-in-95 duration-700 delay-300">
            <div className="relative aspect-video bg-zinc-900">
              <video
                controls
                autoPlay
                poster="/images/upsell-thumbnail.jpg"
                className="absolute inset-0 w-full h-full"
                preload="metadata"
                playsInline
              >
                <source src={VIDEO_UPSELL_URL} type="video/mp4" />
                Seu navegador não suporta vídeo HTML5.
              </video>
            </div>
          </div>

          {/* Oferta Especial Header */}
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#D4AF37]/20 to-[#B8860B]/20 border border-[#D4AF37]/50 rounded-full mb-6">
              <Sparkles size={20} className="text-[#D4AF37]" />
              <span className="text-lg font-bold text-[#D4AF37] uppercase tracking-wider">
                Oferta Exclusiva de Expansão
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Turbine Seus <span className="text-[#D4AF37]">Resultados</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Adicione esses módulos complementares ao seu arsenal e multiplique suas
              oportunidades de lucro.
            </p>
          </div>
        </div>
      </section>

      {/* Produtos - Order Bump */}
      <section className="py-20 px-4 bg-zinc-950">
        <div className="max-w-6xl mx-auto">

          {/* Combo em destaque no topo */}
          <div className="mb-8">
            <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-[#D4AF37] rounded-3xl p-8 relative overflow-hidden group hover:border-[#D4AF37]/80 transition-all">
              <div className="absolute top-4 right-4 px-3 py-1 bg-[#D4AF37] text-black text-sm font-black rounded-full">
                ⭐ MELHOR OFERTA
              </div>

              <div className="relative z-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center mx-auto mb-4 text-3xl">
                  🦈
                </div>
                <h3 className="text-2xl md:text-3xl font-black mb-3">
                  Combo <span className="text-[#D4AF37]">Financiamento Próprio + Limpa Nome</span>
                </h3>
                <p className="text-zinc-400 mb-6 leading-relaxed max-w-2xl mx-auto">
                  Leve os dois módulos mais lucrativos por um preço especial e domine dois mercados
                  ao mesmo tempo: empréstimos próprios e regularização de CPF.
                </p>

                <div className="mb-6">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="text-xl text-zinc-500 line-through">R$ 594</span>
                    <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full">
                      -24% OFF
                    </span>
                  </div>
                  <div className="text-5xl font-black text-[#D4AF37]">R$ 450</div>
                  <p className="text-zinc-500 text-sm mt-1">Oferta válida apenas nesta página</p>
                </div>

                <a
                  href={CHECKOUT_COMBO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black text-xl font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(212,175,55,0.5)]"
                >
                  <span>PEGAR O COMBO POR R$ 450</span>
                  <TrendingUp size={24} />
                </a>
                <p className="text-xs text-zinc-600 mt-3">🔒 Pagamento seguro via InfinitePay</p>
              </div>
            </div>
          </div>

          {/* Módulos individuais */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Módulo 1: Limpa Nome */}
            <div className="bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37]/30 rounded-3xl p-8 relative overflow-hidden group hover:border-[#D4AF37]/60 transition-all">
              <div className="absolute top-4 right-4 px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full rotate-12">
                -40%
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-6 text-[#D4AF37] text-3xl">
                  ✨
                </div>
                <h3 className="text-2xl md:text-3xl font-black mb-3">
                  Módulo <span className="text-[#D4AF37]">Limpa Nome</span>
                </h3>
                <p className="text-zinc-400 mb-6 leading-relaxed">
                  Aprenda a oferecer serviços de regularização de CPF e aumentar seu ticket médio
                  em até <strong className="text-white">300%</strong>. Inclui scripts, contratos e
                  parcerias estratégicas.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Scripts de venda prontos',
                    'Contratos e documentação legal',
                    'Rede de parceiros verificados',
                    'Suporte técnico especializado',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
                      <span className="text-zinc-300">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl text-zinc-500 line-through">R$ 497</span>
                    <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                      DESCONTO
                    </span>
                  </div>
                  <div className="text-4xl font-black text-[#D4AF37]">R$ 297</div>
                  <p className="text-zinc-500 text-sm">Oferta válida apenas nesta página</p>
                </div>
                <a
                  href={CHECKOUT_LIMPA_NOME_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black text-center font-black rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  ADICIONAR POR R$ 297
                </a>
              </div>
            </div>

            {/* Módulo 2: Financiamento de Moto */}
            <div className="bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37]/30 rounded-3xl p-8 relative overflow-hidden group hover:border-[#D4AF37]/60 transition-all">
              <div className="absolute top-4 right-4 px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full rotate-12">
                -70%
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-6 text-[#D4AF37] text-3xl">
                  🏍️
                </div>
                <h3 className="text-2xl md:text-3xl font-black mb-3">
                  Módulo <span className="text-[#D4AF37]">Financiamento de Moto</span>
                </h3>
                <p className="text-zinc-400 mb-6 leading-relaxed">
                  Domine o nicho de financiamento de motos e gere contratos de{' '}
                  <strong className="text-white">R$ 5.000 a R$ 15.000</strong> com margens
                  altíssimas. Sistema completo de gestão incluso.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Planilha de cálculo automática',
                    'Contratos com cláusula de busca e apreensão',
                    'Estratégias de captação de clientes',
                    'Gestão de garantias e seguros',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
                      <span className="text-zinc-300">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl text-zinc-500 line-through">R$ 997</span>
                    <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                      70% OFF
                    </span>
                  </div>
                  <div className="text-4xl font-black text-[#D4AF37]">R$ 297</div>
                  <p className="text-zinc-500 text-sm">Oferta válida apenas nesta página</p>
                </div>
                <a
                  href={CHECKOUT_FINANCIAMENTO_MOTO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black text-center font-black rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  ADICIONAR POR R$ 297
                </a>
              </div>
            </div>
          </div>

          {/* Botão de Recusa */}
          <div className="text-center mt-12">
            <button
              onClick={handleRecusarClick}
              className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-400 transition-colors text-sm underline"
            >
              Não, obrigado. Quero continuar apenas com o Método Tubarão
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Seção de Garantia */}
      <section className="py-16 px-4 bg-black border-t border-zinc-900">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-green-400" />
          </div>
          <h3 className="text-2xl md:text-3xl font-black mb-4">
            Garantia de <span className="text-[#D4AF37]">7 Dias</span>
          </h3>
          <p className="text-zinc-400 leading-relaxed">
            Se você não ficar 100% satisfeito com qualquer um dos módulos, devolvemos seu dinheiro
            sem perguntas. Risco zero para você.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-zinc-900 text-center text-zinc-600 text-sm">
        <p>© 2026 Método Tubarão. Todos os direitos reservados.</p>
      </footer>

      {/* Modal de Recusa com Vídeo */}
      {showRecusaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-[#D4AF37]/30 rounded-3xl p-6 animate-in zoom-in-95 duration-300">
            <button
              onClick={handleFecharModal}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors z-10"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-black text-center mb-4">
              Espera! Antes de sair... 👀
            </h2>

            <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden mb-6">
              <video
                controls
                autoPlay
                className="absolute inset-0 w-full h-full"
                preload="metadata"
                playsInline
              >
                <source src={VIDEO_RECUSA_URL} type="video/mp4" />
                Seu navegador não suporta vídeo HTML5.
              </video>
            </div>

            <button
              onClick={handleFecharModal}
              className="w-full py-3 text-zinc-500 hover:text-zinc-400 transition-colors text-sm underline"
            >
              Não, obrigado. Continuar sem os módulos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
