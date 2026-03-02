import React from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { Logo } from '../../components/Logo';

export const QualificationSuccess: React.FC = () => {
  const whatsappGroupLink = 'https://chat.whatsapp.com/SEU_LINK_DO_GRUPO_ECOSSISTEMA';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#D4AF37]/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] bg-green-900/10 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <nav className="relative z-50 border-b border-zinc-800 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-20 flex items-center justify-center">
          <Logo size="md" />
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8 animate-in zoom-in">
            <CheckCircle2 size={80} className="mx-auto text-green-500 mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Seu perfil foi recebido!
            </h1>
            <p className="text-xl text-zinc-400">
              Se estiver alinhado com o programa, você receberá as próximas informações.
            </p>
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Próximos Passos</h2>
            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={24} className="text-green-500 shrink-0 mt-1" />
                <div>
                  <p className="text-white font-medium">Análise do seu perfil</p>
                  <p className="text-sm text-zinc-400">Nossa equipe irá analisar suas respostas em até 48 horas</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={24} className="text-green-500 shrink-0 mt-1" />
                <div>
                  <p className="text-white font-medium">Contato personalizado</p>
                  <p className="text-sm text-zinc-400">Se aprovado, entraremos em contato via WhatsApp com uma proposta exclusiva</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={24} className="text-green-500 shrink-0 mt-1" />
                <div>
                  <p className="text-white font-medium">Atualizações no grupo</p>
                  <p className="text-sm text-zinc-400">Entre no grupo oficial para receber novidades e conteúdos exclusivos</p>
                </div>
              </div>
            </div>
          </div>

          <a
            href={whatsappGroupLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white font-bold py-5 px-8 rounded-xl transition-all text-lg shadow-lg shadow-green-900/50"
          >
            <MessageCircle size={24} />
            Entrar no Grupo Oficial de Atualizações
          </a>

          <div className="mt-8 p-6 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl">
            <p className="text-sm text-zinc-300">
              <strong className="text-[#D4AF37]">Importante:</strong> Este é um grupo exclusivo para interessados no Ecossistema Tubarão.
              Não é o grupo de clientes que buscam empréstimos.
            </p>
          </div>

          <div className="mt-12 text-center">
            <a href="/" className="text-zinc-400 hover:text-white transition-colors">
              ← Voltar para página inicial
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
