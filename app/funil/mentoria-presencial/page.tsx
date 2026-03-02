'use client';

import { useState } from 'react';
import { Crown, CheckCircle2, Users, TrendingUp, MapPin, Calendar, Award, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MentoriaPresencial() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    whatsapp: '',
    cidade: '',
    capitalDisponivel: '',
    experiencia: '',
    objetivo: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Máscara para WhatsApp
    if (name === 'whatsapp') {
      let cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 11) {
        if (cleaned.length <= 2) {
          setFormData({ ...formData, [name]: cleaned });
        } else if (cleaned.length <= 7) {
          setFormData({ ...formData, [name]: `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}` });
        } else {
          setFormData({ ...formData, [name]: `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}` });
        }
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validação básica
    if (!formData.nome || !formData.whatsapp || !formData.cidade || !formData.capitalDisponivel || !formData.experiencia || !formData.objetivo) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (formData.whatsapp.replace(/\D/g, '').length < 10) {
      setError('WhatsApp inválido. Digite um número completo.');
      return;
    }

    if (formData.objetivo.length < 20) {
      setError('Por favor, descreva seu objetivo com mais detalhes (mínimo 20 caracteres).');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/mentoria-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar aplicação');
      }

      // Redirecionar para página de obrigado final
      router.push('/funil/obrigado-final');
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar aplicação. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-black via-zinc-900 to-black">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.15),transparent_50%)] pointer-events-none" />

        <div className="relative z-10 w-full max-w-5xl mx-auto">
          {/* Badge Exclusivo */}
          <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#D4AF37]/20 to-[#B8860B]/20 border border-[#D4AF37]/50 rounded-full">
              <Crown size={20} className="text-[#D4AF37]" />
              <span className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider">
                Oferta Exclusiva VIP
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-center mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            Mentoria <span className="text-[#D4AF37]">Presencial</span> Individual
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 text-center mb-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            Trabalhe diretamente comigo por <strong className="text-white">3 dias intensivos</strong> e
            construa um negócio de <strong className="text-[#D4AF37]">6 dígitos por mês</strong> do zero.
          </p>

          {/* Vídeo (se houver) */}
          <div className="relative w-full max-w-4xl mx-auto mb-12 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#D4AF37]/30 animate-in fade-in zoom-in-95 duration-700 delay-300">
            <div className="relative aspect-video bg-zinc-900">
              <video
                controls
                poster="/images/mentoria-presencial-thumbnail.jpg"
                className="w-full h-full"
                preload="metadata"
              >
                <source src="/videos/04-mentoria-presencial.mp4" type="video/mp4" />
                Seu navegador não suporta vídeo HTML5.
              </video>
            </div>
          </div>

          {/* Preço */}
          <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="text-5xl md:text-6xl font-black text-[#D4AF37] mb-2">
              R$ 5.997
            </div>
            <p className="text-zinc-400 text-sm">
              Investimento único • 3 dias presenciais • Suporte vitalício
            </p>
          </div>

          {/* CTA - Botão de Aplicação */}
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black text-xl font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:shadow-[0_0_60px_rgba(212,175,55,0.6)]"
            >
              <span>APLICAR PARA MENTORIA PRESENCIAL</span>
              <Crown size={24} />
            </button>
            <p className="text-xs text-zinc-600 mt-3">
              ⚠️ Vagas limitadas • Processo seletivo
            </p>
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
            Uma imersão completa com acompanhamento individual e implementação prática.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <MapPin size={32} />,
                title: '3 Dias Presenciais',
                description:
                  'Encontro presencial em São Paulo com hospedagem e alimentação incluídas.',
              },
              {
                icon: <Users size={32} />,
                title: 'Atendimento 1 para 1',
                description:
                  'Atenção exclusiva para construir seu negócio do zero com estratégia personalizada.',
              },
              {
                icon: <TrendingUp size={32} />,
                title: 'Implementação Prática',
                description:
                  'Saia com seu negócio estruturado, sistema rodando e primeiros clientes captados.',
              },
              {
                icon: <Calendar size={32} />,
                title: 'Suporte Vitalício',
                description:
                  'Acesso direto via WhatsApp para dúvidas e suporte contínuo após a mentoria.',
              },
              {
                icon: <Award size={32} />,
                title: 'Rede de Contatos VIP',
                description:
                  'Conexão com parceiros estratégicos, fornecedores e investidores do setor.',
              },
              {
                icon: <CheckCircle2 size={32} />,
                title: 'Material Completo',
                description:
                  'Todos os contratos, planilhas, scripts e ferramentas necessárias para operar.',
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

      {/* Modal de Formulário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-[#D4AF37]/30 rounded-3xl p-8 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            {/* Botão Fechar */}
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-4">
                <Crown size={32} className="text-[#D4AF37]" />
              </div>
              <h2 className="text-3xl font-black mb-2">Aplicação para Mentoria Presencial</h2>
              <p className="text-zinc-400 text-sm">
                Preencha o formulário abaixo para avaliarmos seu perfil
              </p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome */}
              <div>
                <label className="block text-sm font-bold mb-2">Nome Completo *</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  placeholder="Seu nome completo"
                  className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:border-[#D4AF37] focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-sm font-bold mb-2">WhatsApp *</label>
                <input
                  type="tel"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleInputChange}
                  placeholder="(00) 00000-0000"
                  className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:border-[#D4AF37] focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* Cidade */}
              <div>
                <label className="block text-sm font-bold mb-2">Cidade/Estado *</label>
                <input
                  type="text"
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleInputChange}
                  placeholder="Ex: São Paulo/SP"
                  className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:border-[#D4AF37] focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* Capital Disponível */}
              <div>
                <label className="block text-sm font-bold mb-2">Capital Disponível para Investir *</label>
                <select
                  name="capitalDisponivel"
                  value={formData.capitalDisponivel}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white focus:border-[#D4AF37] focus:outline-none transition-colors"
                  required
                >
                  <option value="">Selecione uma faixa</option>
                  <option value="ate-5k">Até R$ 5.000</option>
                  <option value="5k-10k">R$ 5.000 a R$ 10.000</option>
                  <option value="10k-20k">R$ 10.000 a R$ 20.000</option>
                  <option value="20k-50k">R$ 20.000 a R$ 50.000</option>
                  <option value="acima-50k">Acima de R$ 50.000</option>
                </select>
              </div>

              {/* Experiência */}
              <div>
                <label className="block text-sm font-bold mb-2">Experiência no Mercado *</label>
                <select
                  name="experiencia"
                  value={formData.experiencia}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white focus:border-[#D4AF37] focus:outline-none transition-colors"
                  required
                >
                  <option value="">Selecione seu nível</option>
                  <option value="iniciante">Iniciante (nunca trabalhei com empréstimos)</option>
                  <option value="intermediario">Intermediário (já tenho alguns clientes)</option>
                  <option value="avancado">Avançado (já opero há mais de 1 ano)</option>
                </select>
              </div>

              {/* Objetivo */}
              <div>
                <label className="block text-sm font-bold mb-2">Qual seu principal objetivo? *</label>
                <textarea
                  name="objetivo"
                  value={formData.objetivo}
                  onChange={handleInputChange}
                  placeholder="Descreva em detalhes o que você espera alcançar com a mentoria..."
                  rows={4}
                  className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:border-[#D4AF37] focus:outline-none transition-colors resize-none"
                  required
                />
                <p className="text-xs text-zinc-600 mt-1">Mínimo 20 caracteres</p>
              </div>

              {/* Erro */}
              {error && (
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Botão Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>ENVIANDO...</span>
                  </>
                ) : (
                  <span>ENVIAR APLICAÇÃO</span>
                )}
              </button>

              <p className="text-xs text-zinc-600 text-center">
                Ao enviar, você concorda com nossa política de privacidade
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-zinc-900 text-center text-zinc-600 text-sm">
        <p>© 2026 Método Tubarão. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
