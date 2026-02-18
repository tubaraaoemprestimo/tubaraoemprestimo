import React, { useState, useEffect } from 'react';
import {
  Users, Filter, Search, Tag, Calendar, Mail, Phone, Eye, Trash2,
  Download, RefreshCw, CheckCircle2, Clock, XCircle
} from 'lucide-react';
import { apiService } from '../../services/apiService';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  hasExperience: boolean;
  experienceLevel?: string;
  hasCapital: boolean;
  capitalAmount?: string;
  wantsToLearn: boolean;
  learningInterest?: string;
  hasTime: boolean;
  timeAvailability?: string;
  wantsPartnership: boolean;
  partnershipType?: string;
  tags: string[];
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const QualificationLeadsAdmin: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const availableTags = [
    'TAG_EXPERIENCIA',
    'TAG_INICIANTE',
    'TAG_AVANCADO',
    'TAG_CAPITAL',
    'TAG_INVESTIDOR_ALTO',
    'TAG_INVESTIDOR_MEDIO',
    'TAG_APRENDIZADO',
    'TAG_CURSO',
    'TAG_MENTORIA_ONLINE',
    'TAG_MENTORIA_PRESENCIAL',
    'TAG_DISPONIBILIDADE',
    'TAG_TEMPO_INTEGRAL',
    'TAG_PARCERIA',
    'TAG_INVESTIDOR',
    'TAG_OPERACIONAL',
    'TAG_CORRESPONDENTE'
  ];

  useEffect(() => {
    loadLeads();
  }, [statusFilter, tagFilter]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (tagFilter) params.tags = tagFilter;
      if (searchTerm) params.search = searchTerm;

      const response = await apiService.get('/qualification-leads', { params });
      setLeads(response.data.leads);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, status: string) => {
    try {
      await apiService.patch(`/qualification-leads/${leadId}`, { status });
      loadLeads();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;

    try {
      await apiService.delete(`/qualification-leads/${leadId}`);
      loadLeads();
    } catch (error) {
      console.error('Erro ao deletar lead:', error);
    }
  };

  const exportToCSV = () => {
    const headers = ['Nome', 'Email', 'Telefone', 'Tags', 'Status', 'Data'];
    const rows = leads.map(lead => [
      lead.name,
      lead.email,
      lead.phone,
      lead.tags.join(', '),
      lead.status,
      new Date(lead.createdAt).toLocaleDateString('pt-BR')
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-qualificacao-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'NEW':
        return <Clock className="text-blue-500" size={18} />;
      case 'CONTACTED':
        return <CheckCircle2 className="text-green-500" size={18} />;
      case 'QUALIFIED':
        return <CheckCircle2 className="text-[#D4AF37]" size={18} />;
      case 'REJECTED':
        return <XCircle className="text-red-500" size={18} />;
      default:
        return <Clock className="text-zinc-500" size={18} />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: any = {
      NEW: 'Novo',
      CONTACTED: 'Contatado',
      QUALIFIED: 'Qualificado',
      REJECTED: 'Rejeitado'
    };
    return labels[status] || status;
  };

  const filteredLeads = leads.filter(lead => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        lead.name.toLowerCase().includes(search) ||
        lead.email.toLowerCase().includes(search) ||
        lead.phone.includes(search)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="text-[#D4AF37]" />
            Leads de Qualificação
          </h1>
          <p className="text-zinc-400 mt-1">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} encontrado{filteredLeads.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadLeads}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Atualizar
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b5952f] text-black font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadLeads()}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
        >
          <option value="">Todos os status</option>
          <option value="NEW">Novo</option>
          <option value="CONTACTED">Contatado</option>
          <option value="QUALIFIED">Qualificado</option>
          <option value="REJECTED">Rejeitado</option>
        </select>

        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
        >
          <option value="">Todas as tags</option>
          {availableTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>

        <button
          onClick={() => {
            setSearchTerm('');
            setStatusFilter('');
            setTagFilter('');
            loadLeads();
          }}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
        >
          Limpar filtros
        </button>
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-[#D4AF37]" size={32} />
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{lead.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Mail size={14} />
                          {lead.email}
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Phone size={14} />
                          {lead.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-[#D4AF37]/20 text-[#D4AF37] text-xs rounded-full"
                          >
                            {tag.replace('TAG_', '')}
                          </span>
                        ))}
                        {lead.tags.length > 3 && (
                          <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded-full">
                            +{lead.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(lead.status)}
                        <span className="text-sm text-zinc-300">{getStatusLabel(lead.status)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">
                      {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye size={18} className="text-zinc-400" />
                        </button>
                        <button
                          onClick={() => deleteLead(lead.id)}
                          className="p-2 hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLeads.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              Nenhum lead encontrado
            </div>
          )}
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Detalhes do Lead</h2>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <XCircle className="text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações Básicas */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Informações Básicas</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Nome:</span>
                    <span className="text-white font-medium">{selectedLead.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Email:</span>
                    <span className="text-white">{selectedLead.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Telefone:</span>
                    <span className="text-white">{selectedLead.phone}</span>
                  </div>
                </div>
              </div>

              {/* Perfil */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Perfil</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Experiência:</span>
                    <span className="text-white">
                      {selectedLead.hasExperience ? `Sim (${selectedLead.experienceLevel})` : 'Não'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Capital:</span>
                    <span className="text-white">
                      {selectedLead.hasCapital ? `Sim (${selectedLead.capitalAmount})` : 'Não'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Quer aprender:</span>
                    <span className="text-white">
                      {selectedLead.wantsToLearn ? `Sim (${selectedLead.learningInterest})` : 'Não'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Disponibilidade:</span>
                    <span className="text-white">
                      {selectedLead.hasTime ? selectedLead.timeAvailability : 'Limitada'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Parceria:</span>
                    <span className="text-white">
                      {selectedLead.wantsPartnership ? `Sim (${selectedLead.partnershipType})` : 'Não'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedLead.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-[#D4AF37]/20 text-[#D4AF37] text-sm rounded-full"
                    >
                      {tag.replace('TAG_', '')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Alterar Status</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      updateLeadStatus(selectedLead.id, 'CONTACTED');
                      setSelectedLead(null);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Contatado
                  </button>
                  <button
                    onClick={() => {
                      updateLeadStatus(selectedLead.id, 'QUALIFIED');
                      setSelectedLead(null);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Qualificado
                  </button>
                  <button
                    onClick={() => {
                      updateLeadStatus(selectedLead.id, 'REJECTED');
                      setSelectedLead(null);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Rejeitado
                  </button>
                  <button
                    onClick={() => {
                      updateLeadStatus(selectedLead.id, 'NEW');
                      setSelectedLead(null);
                    }}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                  >
                    Novo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
