import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, TrendingUp, Users, Phone, Mail, MapPin, Calendar } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

interface Lead {
  id: string;
  fullName: string;
  whatsapp: string;
  city?: string;
  state?: string;
  leadStatus: 'HOT' | 'WARM' | 'COLD';
  leadScore: number;
  npsScore: number;
  investmentAmount: string;
  interestOnlineMentorship: string;
  interestPresentialMentorship: string;
  contactedAt?: string;
  contactedBy?: string;
  notes?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
  lesson: {
    id: string;
    title: string;
    module: {
      title: string;
    };
  };
}

export function AdminLeadsPanel() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'HOT' | 'WARM' | 'COLD' | 'ALL'>('HOT');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pendingComments, setPendingComments] = useState<Comment[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [contactNotes, setContactNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLeads();
    loadPendingComments();
    const interval = setInterval(() => {
      loadLeads();
      loadPendingComments();
    }, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, [activeTab]);

  const loadLeads = async () => {
    try {
      const status = activeTab === 'ALL' ? undefined : activeTab;
      const data = await apiService.getLeads(status);
      setLeads(data);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingComments = async () => {
    try {
      const data = await apiService.getPendingComments();
      setPendingComments(data);
    } catch (err: any) {
      console.error('Erro ao carregar comentários:', err);
    }
  };

  const handleMarkContacted = async () => {
    if (!selectedLead) return;
    setSubmitting(true);
    try {
      await apiService.markLeadContacted(selectedLead.id, contactNotes);
      addToast('Lead marcado como contatado!', 'success');
      setSelectedLead(null);
      setContactNotes('');
      loadLeads();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HOT':
        return 'bg-red-600';
      case 'WARM':
        return 'bg-orange-600';
      case 'COLD':
        return 'bg-blue-600';
      default:
        return 'bg-zinc-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HOT':
        return '🔥';
      case 'WARM':
        return '⚠️';
      case 'COLD':
        return '❄️';
      default:
        return '📊';
    }
  };

  const getMentorshipType = (lead: Lead) => {
    if (lead.interestPresentialMentorship === 'Sim') return 'PRESENCIAL';
    if (lead.interestOnlineMentorship === 'Sim') return 'ONLINE';
    if (lead.interestPresentialMentorship === 'Talvez' || lead.interestOnlineMentorship === 'Talvez') return 'TALVEZ';
    return 'NÃO';
  };

  const filteredLeads = activeTab === 'ALL' ? leads : leads.filter(l => l.leadStatus === activeTab);

  const stats = {
    hot: leads.filter(l => l.leadStatus === 'HOT').length,
    warm: leads.filter(l => l.leadStatus === 'WARM').length,
    cold: leads.filter(l => l.leadStatus === 'COLD').length,
    total: leads.length
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">🎯 Gestão de Leads</h1>
            <p className="text-zinc-400">Leads qualificados pelo sistema de Lead Scoring</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <MessageCircle size={20} className="text-[#D4AF37]" />
                <span className="text-white font-bold">{pendingComments.length}</span>
                <span className="text-zinc-400 text-sm">Comentários Pendentes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm mb-1">Total de Leads</p>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
              </div>
              <Users size={32} className="text-zinc-600" />
            </div>
          </div>

          <div className="bg-zinc-900 border border-red-600 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm mb-1">🔥 Leads Quentes</p>
                <p className="text-3xl font-bold text-red-500">{stats.hot}</p>
              </div>
              <TrendingUp size={32} className="text-red-600" />
            </div>
          </div>

          <div className="bg-zinc-900 border border-orange-600 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm mb-1">⚠️ Leads Mornos</p>
                <p className="text-3xl font-bold text-orange-500">{stats.warm}</p>
              </div>
              <TrendingUp size={32} className="text-orange-600" />
            </div>
          </div>

          <div className="bg-zinc-900 border border-blue-600 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm mb-1">❄️ Leads Frios</p>
                <p className="text-3xl font-bold text-blue-500">{stats.cold}</p>
              </div>
              <TrendingUp size={32} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['HOT', 'WARM', 'COLD', 'ALL'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-bold transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {getStatusIcon(tab)} {tab === 'ALL' ? 'Todos' : tab}
              {tab !== 'ALL' && ` (${stats[tab.toLowerCase() as keyof typeof stats]})`}
            </button>
          ))}
        </div>

        {/* Leads List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-zinc-400">Carregando leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-400">Nenhum lead encontrado</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredLeads.map(lead => (
              <div
                key={lead.id}
                className={`bg-zinc-900 border-2 rounded-lg p-6 cursor-pointer hover:border-[#D4AF37] transition-all ${
                  lead.leadStatus === 'HOT' ? 'border-red-600' : 'border-zinc-800'
                }`}
                onClick={() => setSelectedLead(lead)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${getStatusColor(lead.leadStatus)}`}>
                        {getStatusIcon(lead.leadStatus)} {lead.leadStatus}
                      </span>
                      <span className="text-2xl font-bold text-white">{lead.leadScore}/100</span>
                      {lead.contactedAt && (
                        <span className="px-3 py-1 rounded-full bg-green-600 text-white text-sm font-bold">
                          ✅ CONTATADO
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">{lead.fullName}</h3>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Phone size={16} />
                        <span>{lead.whatsapp}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Mail size={16} />
                        <span>{lead.user.email}</span>
                      </div>
                      {lead.city && (
                        <div className="flex items-center gap-2 text-zinc-400">
                          <MapPin size={16} />
                          <span>{lead.city}/{lead.state}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Calendar size={16} />
                        <span>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>

                    <div className="flex gap-4 mt-4">
                      <div className="bg-black rounded-lg px-3 py-2">
                        <p className="text-zinc-500 text-xs">NPS</p>
                        <p className="text-white font-bold">{lead.npsScore}/10</p>
                      </div>
                      <div className="bg-black rounded-lg px-3 py-2">
                        <p className="text-zinc-500 text-xs">Investimento</p>
                        <p className="text-white font-bold">R$ {lead.investmentAmount}</p>
                      </div>
                      <div className="bg-black rounded-lg px-3 py-2">
                        <p className="text-zinc-500 text-xs">Mentoria</p>
                        <p className="text-white font-bold">{getMentorshipType(lead)}</p>
                      </div>
                    </div>

                    {lead.contactedAt && (
                      <div className="mt-4 bg-black rounded-lg p-3">
                        <p className="text-zinc-500 text-xs mb-1">Contatado por {lead.contactedBy}</p>
                        <p className="text-zinc-400 text-sm">{lead.notes}</p>
                      </div>
                    )}
                  </div>

                  {lead.leadStatus === 'HOT' && !lead.contactedAt && (
                    <div className="ml-4">
                      <Bell size={32} className="text-red-500 animate-pulse" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lead Detail Modal */}
        {selectedLead && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedLead.fullName}</h2>
                  <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${getStatusColor(selectedLead.leadStatus)}`}>
                    {getStatusIcon(selectedLead.leadStatus)} {selectedLead.leadStatus} - {selectedLead.leadScore}/100
                  </span>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-zinc-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">WhatsApp</p>
                    <p className="text-white font-bold">{selectedLead.whatsapp}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">Email</p>
                    <p className="text-white font-bold">{selectedLead.user.email}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">Localização</p>
                    <p className="text-white font-bold">{selectedLead.city}/{selectedLead.state}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">Data</p>
                    <p className="text-white font-bold">
                      {new Date(selectedLead.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="bg-black rounded-lg p-4">
                  <p className="text-zinc-500 text-sm mb-2">Detalhes do Lead</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-zinc-400 text-xs">NPS Score</p>
                      <p className="text-white font-bold text-lg">{selectedLead.npsScore}/10</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-xs">Investimento</p>
                      <p className="text-white font-bold text-lg">R$ {selectedLead.investmentAmount}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-xs">Mentoria</p>
                      <p className="text-white font-bold text-lg">{getMentorshipType(selectedLead)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {!selectedLead.contactedAt ? (
                <div>
                  <label className="block text-white font-bold mb-2">
                    Notas do Contato
                  </label>
                  <textarea
                    value={contactNotes}
                    onChange={e => setContactNotes(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white mb-4"
                    rows={4}
                    placeholder="Descreva o resultado do contato..."
                  />
                  <div className="flex gap-3">
                    <Button onClick={handleMarkContacted} disabled={submitting} className="flex-1">
                      {submitting ? 'Salvando...' : '✅ Marcar como Contatado'}
                    </Button>
                    <Button variant="secondary" onClick={() => setSelectedLead(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-green-900/20 border border-green-600 rounded-lg p-4">
                  <p className="text-green-400 font-bold mb-2">
                    ✅ Lead contatado por {selectedLead.contactedBy}
                  </p>
                  <p className="text-zinc-400 text-sm mb-1">
                    {new Date(selectedLead.contactedAt).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-white mt-2">{selectedLead.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
