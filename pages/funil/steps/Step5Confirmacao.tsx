import { useEffect } from 'react';
import { CheckCircle2, MessageCircle, Calendar, Award, Sparkles, Mail, Phone } from 'lucide-react';
import { FunnelVideo } from '../FunnelVideo';
import { track } from '../funnelTracker';

const VIDEO_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev/videos/05-obrigado-final.mp4';

interface Step5Props { sessionId: string }

export function Step5Confirmacao({ sessionId }: Step5Props) {
  useEffect(() => {
    track({ sessionId, step: 5, eventType: 'STEP_VIEW' });
    // Limpa o sessionId após conclusão do funil
    localStorage.removeItem('funnel_session_id');
  }, [sessionId]);

  return (
    <section className="flex flex-col items-center gap-12 py-16 px-4 animate-in fade-in zoom-in-95 duration-700">

      {/* Mensagem de Sucesso */}
      <div className="w-full max-w-4xl bg-gradient-to-br from-green-900/20 to-black border-2 border-green-500/40 rounded-3xl p-12 text-center">
        <Sparkles size={64} className="text-green-400 mx-auto mb-6 animate-pulse" />
        <h1 className="text-5xl md:text-6xl font-black mb-6">
          🎉 Parabéns! Você Está Dentro!
        </h1>
        <p className="text-2xl text-zinc-300 leading-relaxed max-w-2xl mx-auto mb-6">
          Sua inscrição foi registrada com sucesso em nossa base de dados.
        </p>
        <div className="inline-block bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl px-8 py-4">
          <p className="text-lg text-[#D4AF37] font-bold">
            ✅ Nossa equipe entrará em contato em breve para confirmar sua inscrição e liberar seu acesso!
          </p>
        </div>
      </div>

      {/* Vídeo de Boas-Vindas */}
      <div className="w-full max-w-5xl">
        <h2 className="text-3xl font-black text-center mb-6">
          🎥 Mensagem Especial de Boas-Vindas
        </h2>
        <FunnelVideo
          src={VIDEO_URL}
          autoPlay={true}
          onPlay={() => track({ sessionId, step: 5, eventType: 'VIDEO_PLAY' })}
          onComplete={() => track({ sessionId, step: 5, eventType: 'VIDEO_COMPLETE' })}
        />
      </div>

      {/* Próximos Passos */}
      <div className="w-full max-w-5xl">
        <h2 className="text-4xl font-black text-center mb-12">
          📋 Próximos Passos
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37] text-black font-black text-3xl flex items-center justify-center mx-auto mb-6">
              1
            </div>
            <Mail size={40} className="text-[#D4AF37] mx-auto mb-4" />
            <h3 className="text-xl font-black mb-4">Verifique Seu Email</h3>
            <p className="text-zinc-400 leading-relaxed">
              Enviamos um email de confirmação com todos os detalhes. Verifique sua caixa de entrada e spam.
            </p>
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37] text-black font-black text-3xl flex items-center justify-center mx-auto mb-6">
              2
            </div>
            <MessageCircle size={40} className="text-[#D4AF37] mx-auto mb-4" />
            <h3 className="text-xl font-black mb-4">Aguarde Nosso Contato</h3>
            <p className="text-zinc-400 leading-relaxed">
              Nossa equipe entrará em contato via WhatsApp ou telefone nas próximas 24-48 horas.
            </p>
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37] text-black font-black text-3xl flex items-center justify-center mx-auto mb-6">
              3
            </div>
            <Award size={40} className="text-[#D4AF37] mx-auto mb-4" />
            <h3 className="text-xl font-black mb-4">Acesso Liberado</h3>
            <p className="text-zinc-400 leading-relaxed">
              Após a confirmação, você receberá acesso imediato à área de membros e todos os materiais.
            </p>
          </div>
        </div>
      </div>

      {/* Preparação */}
      <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h2 className="text-3xl font-black text-center mb-8">
          🚀 Enquanto Isso, Prepare-se!
        </h2>
        <div className="space-y-6">
          <div className="flex items-start gap-4 bg-black/50 rounded-xl p-6">
            <CheckCircle2 size={24} className="text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-lg mb-2">Defina Seu Objetivo</h3>
              <p className="text-zinc-400 leading-relaxed">
                Quanto você quer faturar por mês? R$ 10k? R$ 30k? R$ 100k? Tenha uma meta clara em mente.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 bg-black/50 rounded-xl p-6">
            <CheckCircle2 size={24} className="text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-lg mb-2">Separe Seu Capital Inicial</h3>
              <p className="text-zinc-400 leading-relaxed">
                Você pode começar com R$ 500 a R$ 1.000. Quanto mais capital, mais rápido você escala.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 bg-black/50 rounded-xl p-6">
            <CheckCircle2 size={24} className="text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-lg mb-2">Mentalidade de Empreendedor</h3>
              <p className="text-zinc-400 leading-relaxed">
                Prepare-se para sair da zona de conforto. Você está prestes a construir um negócio real e lucrativo!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Informações de Contato */}
      <div className="w-full max-w-4xl bg-gradient-to-br from-[#D4AF37]/10 to-black border-2 border-[#D4AF37] rounded-3xl p-8">
        <h2 className="text-3xl font-black text-center mb-8">
          📞 Precisa de Ajuda?
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-black/50 rounded-2xl p-6 text-center">
            <Mail size={40} className="text-[#D4AF37] mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Email</h3>
            <a
              href="mailto:contato@tubaraoemprestimo.com.br"
              className="text-[#D4AF37] hover:underline font-bold"
            >
              contato@tubaraoemprestimo.com.br
            </a>
          </div>
          <div className="bg-black/50 rounded-2xl p-6 text-center">
            <Phone size={40} className="text-[#D4AF37] mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">WhatsApp</h3>
            <a
              href="https://wa.me/5511987577050"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D4AF37] hover:underline font-bold"
            >
              +55 11 98757-7050
            </a>
          </div>
        </div>
      </div>

      {/* Depoimento Final */}
      <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center">
        <div className="mb-6">
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Award key={i} size={24} className="text-[#D4AF37]" fill="#D4AF37" />
            ))}
          </div>
          <p className="text-xl text-zinc-300 italic leading-relaxed mb-4">
            "Tomar a decisão de entrar no Método Tubarão foi o melhor investimento que já fiz.
            Em 6 meses saí de R$ 3.000 para R$ 45.000 por mês. Minha vida mudou completamente!"
          </p>
          <p className="text-[#D4AF37] font-bold">— Carlos Silva, São Paulo/SP</p>
        </div>
      </div>

      {/* Mensagem Final */}
      <div className="w-full max-w-4xl text-center">
        <h2 className="text-3xl font-black mb-6">
          🦈 Bem-vindo à Família Tubarão!
        </h2>
        <p className="text-xl text-zinc-300 leading-relaxed mb-8">
          Você acabou de dar o primeiro passo para construir um negócio lucrativo e transformar sua vida financeira.
          Estamos ansiosos para ver seus resultados!
        </p>
        <div className="inline-block bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl px-8 py-4">
          <p className="text-lg text-[#D4AF37] font-bold">
            💪 Prepare-se para a jornada da sua vida!
          </p>
        </div>
      </div>

      {/* Botão Voltar ao Início */}
      <a
        href="/#/"
        className="inline-block px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all"
      >
        ← Voltar ao Início
      </a>

    </section>
  );
}
