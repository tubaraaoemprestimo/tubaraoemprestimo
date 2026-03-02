'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle, Phone, MapPin, DollarSign, Award, Target, Calendar } from 'lucide-react';

interface Application {
  id: string;
  nome: string;
  whatsapp: string;
  cidade: string;
  capitalDisponivel: string;
  experiencia: string;
  objetivo: string;
  status: string;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function MentoriaApplicationsAdmin() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const url = filter
        ? `/api/mentoria-application?status=${filter}`
        : '/api/mentoria-application';

      const response = await fetch(url);
      const data = await response.json();

      setApplications(data.applications || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Erro ao buscar aplicações:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDENTE: { icon: Clock, color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', label: 'Pendente' },
      APROVADO: { icon: CheckCircle2, color: 'bg-green-500/10 text-green-400 border-green-500/30', label: 'Aprovado' },
      REJEITADO: { icon: XCircle, color: 'bg-red-500/10 text-red-400 border-red-500/30', label: 'Rejeitado' },
      CONTATADO: { icon: Phone, color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', label: 'Contatado' },
    };

    const badge = badges[status as keyof typeof badges] || badges.PENDENTE;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.color}`}>
        <Icon size={14} />
        {badge.label}
      </span>
    );
  };

  const getExperienciaLabel = (exp: string) => {
    const labels: Record<string, string> = {
      'iniciante': 'Iniciante',
      'intermediario': 'Intermediário',
      'avancado': 'Avançado',
    };
    return labels[exp] || exp;
  };

  const getCapitalLabel = (capital: string) => {
    const labels: Record<string, string> = {
      'ate-5k': 'Até R$ 5.000',
      '5k-10k': 'R$ 5.000 a R$ 10.000',
      '10k-20k': 'R$ 10.000 a R$ 20.000',
      '20k-50k': 'R$ 20.000 a R$ 50.000',
      'acima-50k': 'Acima de R$ 50.000',
    };
    return labels[capital] || capital;
  };

  const formatWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black mb-2">
            Aplicações - <span className="text-[#D4AF37]">Mentoria Presencial</span>
          </h1>
          <p className="text-zinc-400">
            Total de {total} aplicações recebidas
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setFilter('')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              filter === ''
                ? 'bg-[#D4AF37] text-black'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Todas ({total})
          </button>
          <button
            onClick={() => setFilter('PENDENTE')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              filter === 'PENDENTE'
                ? 'bg-yellow-500 text-black'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilter('CONTATADO')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              filter === 'CONTATADO'
                ? 'bg-blue-500 text-black'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Contatados
          </button>
          <button
            onClick={() => setFilter('APROVADO')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              filter === 'APROVADO'
                ? 'bg-green-500 text-black'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Aprovados
          </button>
          <button
            onClick={() => setFilter('REJEITADO')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              filter === 'REJEITADO'
                ? 'bg-red-500 text-black'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Rejeitados
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-zinc-400 mt-4">Carregando aplicações...</p>
          </div>
        )}

        {/* Lista de Aplicações */}
        {!loading && applications.length === 0 && (
          <div className="text-center py-12 bg-zinc-900 rounded-2xl border border-zinc-800">
            <p className="text-zinc-400">Nenhuma aplicação encontrada.</p>
          </div>
        )}

        {!loading && applications.length > 0 && (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-[#D4AF37]/30 transition-all"
              >
                {/* Header do Card */}
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-black mb-1">{app.nome}</h3>
                    <p className="text-sm text-zinc-500">
                      Enviado em {new Date(app.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {getStatusBadge(app.status)}
                </div>

                {/* Grid de Informações */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {/* WhatsApp */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center shrink-0">
                      <Phone size={18} className="text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase mb-0.5">WhatsApp</p>
                      <a
                        href={`https://wa.me/55${app.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-green-400 hover:underline"
                      >
                        {formatWhatsApp(app.whatsapp)}
                      </a>
                    </div>
                  </div>

                  {/* Cidade */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase mb-0.5">Cidade</p>
                      <p className="font-bold">{app.cidade}</p>
                    </div>
                  </div>

                  {/* Capital Disponível */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                      <DollarSign size={18} className="text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase mb-0.5">Capital</p>
                      <p className="font-bold">{getCapitalLabel(app.capitalDisponivel)}</p>
                    </div>
                  </div>

                  {/* Experiência */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
                      <Award size={18} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase mb-0.5">Experiência</p>
                      <p className="font-bold">{getExperienciaLabel(app.experiencia)}</p>
                    </div>
                  </div>
                </div>

                {/* Objetivo */}
                <div className="bg-black/50 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={16} className="text-[#D4AF37]" />
                    <p className="text-xs text-zinc-500 uppercase font-bold">Objetivo</p>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{app.objetivo}</p>
                </div>

                {/* Observações (se houver) */}
                {app.observacoes && (
                  <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 uppercase font-bold mb-2">Observações</p>
                    <p className="text-sm text-zinc-400">{app.observacoes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
