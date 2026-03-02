'use client';

import { useEffect } from 'react';
import { CheckCircle2, Sparkles, MessageCircle, Calendar, Award } from 'lucide-react';

export default function ObrigadoFinal() {
  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section - Obrigado */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-black via-zinc-900 to-black">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.15),transparent_50%)] pointer-events-none" />

        <div className="relative z-10 w-full max-w-5xl mx-auto">
          {/* Badge de Sucesso */}
          <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full">
              <CheckCircle2 size={20} className="text-green-400" />
              <span className="text-sm font-bold text-green-400 uppercase tracking-wider">
                Aplicação Recebida
              </span>
            </div>
          </div>

          {/* Headline Principal */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-center mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            🎉 <span className="text-[#D4AF37]">Obrigado!</span> Sua Aplicação Foi Enviada
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 text-center mb-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            Recebemos sua aplicação para a <strong className="text-white">Mentoria Presencial</strong>.
            Nossa equipe irá analisar seu perfil e entrar em contato em até{' '}
            <strong className="text-[#D4AF37]">48 horas</strong>.
          </p>

          {/* Vídeo Final */}
          <div className="relative w-full max-w-4xl mx-auto mb-12 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#D4AF37]/30 animate-in fade-in zoom-in-95 duration-700 delay-300">
            <div className="relative aspect-video bg-zinc-900">
              <video
                controls
                autoPlay
                poster="/images/obrigado-thumbnail.jpg"
                className="w-full h-full"
                preload="metadata"
              >
                <source src="/videos/05-obrigado-final.mp4" type="video/mp4" />
                Seu navegador não suporta vídeo HTML5.
              </video>
            </div>
          </div>

          {/* Próximos Passos */}
          <div className="max-w-3xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="bg-zinc-900 border border-[#D4AF37]/30 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
                  <Sparkles size={24} className="text-[#D4AF37]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black">Próximos Passos</h2>
              </div>

              <div className="space-y-6">
                {/* Passo 1 */}
                <div className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">Análise do Perfil</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      Nossa equipe irá analisar sua aplicação e verificar se seu perfil está alinhado
                      com os requisitos da mentoria presencial.
                    </p>
                  </div>
                </div>

                {/* Passo 2 */}
                <div className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">Contato Direto</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      Se aprovado, você receberá uma mensagem no WhatsApp cadastrado para agendar uma
                      conversa de alinhamento e definir as datas da mentoria.
                    </p>
                  </div>
                </div>

                {/* Passo 3 */}
                <div className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">Preparação</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      Após a confirmação, você receberá um material preparatório e todas as informações
                      sobre hospedagem, alimentação e cronograma dos 3 dias.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enquanto Isso */}
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <h2 className="text-2xl md:text-3xl font-black mb-6">
              Enquanto Isso, <span className="text-[#D4AF37]">Prepare-se</span>
            </h2>

            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {/* Card 1 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-[#D4AF37]/50 transition-all">
                <div className="w-14 h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-4 text-[#D4AF37] mx-auto">
                  <MessageCircle size={28} />
                </div>
                <h3 className="font-bold text-lg mb-2">Fique Atento ao WhatsApp</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Mantenha seu WhatsApp ativo. Nosso contato será feito em até 48 horas.
                </p>
              </div>

              {/* Card 2 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-[#D4AF37]/50 transition-all">
                <div className="w-14 h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-4 text-[#D4AF37] mx-auto">
                  <Calendar size={28} />
                </div>
                <h3 className="font-bold text-lg mb-2">Reserve as Datas</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Organize sua agenda para os 3 dias presenciais em São Paulo.
                </p>
              </div>

              {/* Card 3 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-[#D4AF37]/50 transition-all">
                <div className="w-14 h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-4 text-[#D4AF37] mx-auto">
                  <Award size={28} />
                </div>
                <h3 className="font-bold text-lg mb-2">Defina Seus Objetivos</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Pense nas metas que deseja alcançar com a mentoria presencial.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Voltar */}
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all"
            >
              Voltar para o Início
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-zinc-900 text-center text-zinc-600 text-sm">
        <p>© 2026 Método Tubarão. Todos os direitos reservados.</p>
        <p className="mt-2 text-zinc-500">
          Dúvidas? Entre em contato: <a href="mailto:contato@metodtubarao.com" className="text-[#D4AF37] hover:underline">contato@metodtubarao.com</a>
        </p>
      </footer>
    </div>
  );
}
