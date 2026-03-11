import React, { useState, useEffect } from 'react';
import { Users, CheckCircle2, XCircle, Clock, Eye, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { api } from '../../services/apiClient';

interface Migration {
  id: string;
  loan_request_id: string;
  customer_id: string;
  loan_amount: number;
  interest_rate: number;
  due_date: string;
  charge_type: string;
  notes: string;
  status: string;
  created_at: string;
  client_name: string;
  cpf: string;
  email: string;
  phone: string;
  customer_name: string;
}

export function ContractMigrations() {
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMigration, setSelectedMigration] = useState<Migration | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [adjustedAmount, setAdjustedAmount] = useState('');
  const [adjustedRate, setAdjustedRate] = useState('');
  const [adjustedDueDate, setAdjustedDueDate] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [filter, setFilter] = useState<'PENDENTE_VALIDACAO' | 'VALIDADO' | 'REJEITADO'>('PENDENTE_VALIDACAO');

  useEffect(() => {
    loadMigrations();
  }, [filter]);

  const loadMigrations = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/returning-clients?status=${filter}`);
      setMigrations(response.data.migrations || []);
    } catch (error) {
      console.error('Erro ao carregar migrações:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = async (migration: Migration) => {
    setSelectedMigration(migration);
    setAdjustedAmount(migration.loan_amount.toString());
    setAdjustedRate(migration.interest_rate.toString());
    setAdjustedDueDate(migration.due_date.split('T')[0]);
    setRejectReason('');
    setShowModal(true);
  };

  const handleValidate = async () => {
    if (!selectedMigration) return;

    try {
      await api.patch(`/api/returning-clients/${selectedMigration.id}/validate`, {
        adjustedAmount: parseFloat(adjustedAmount),
        adjustedRate: parseFloat(adjustedRate),
        adjustedDueDate
      });

      alert('Contrato validado e ativado com sucesso!');
      setShowModal(false);
      loadMigrations();
    } catch (error: any) {
      alert('Erro ao validar contrato: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleReject = async () => {
    if (!selectedMigration) return;
    if (!rejectReason.trim()) {
      alert('Por favor, informe o motivo da rejeição');
      return;
    }

    try {
      await api.patch(`/api/returning-clients/${selectedMigration.id}/reject`, {
        reason: rejectReason
      });

      alert('Solicitação rejeitada');
      setShowModal(false);
      loadMigrations();
    } catch (error: any) {
      alert('Erro ao rejeitar: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDENTE_VALIDACAO':
        return 'text-yellow-500';
      case 'VALIDADO':
        return 'text-green-500';
      case 'REJEITADO':
        return 'text-red-500';
      default:
        return 'text-zinc-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDENTE_VALIDACAO':
        return <Clock className="w-5 h-5" />;
      case 'VALIDADO':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'REJEITADO':
        return <XCircle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-[#D4AF37]" />
            <h1 className="text-3xl font-bold">Migração de Contratos</h1>
          </div>
          <p className="text-zinc-400">
            Gerenciar solicitações de clientes recorrentes (já eram clientes antes do sistema)
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilter('PENDENTE_VALIDACAO')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'PENDENTE_VALIDACAO'
                ? 'bg-yellow-500 text-black font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilter('VALIDADO')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'VALIDADO'
                ? 'bg-green-500 text-black font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Validados
          </button>
          <button
            onClick={() => setFilter('REJEITADO')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'REJEITADO'
                ? 'bg-red-500 text-black font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Rejeitados
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37] mx-auto"></div>
            <p className="text-zinc-400 mt-4">Carregando...</p>
          </div>
        ) : migrations.length === 0 ? (
          <div className="bg-zinc-900 rounded-xl p-12 text-center">
            <AlertCircle className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">Nenhuma solicitação encontrada</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {migrations.map((migration) => (
              <div
                key={migration.id}
                className="bg-zinc-900 rounded-xl p-6 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={getStatusColor(migration.status)}>
                        {getStatusIcon(migration.status)}
                      </div>
                      <h3 className="text-xl font-bold">
                        {migration.client_name || migration.customer_name}
                      </h3>
                      <span className={`text-sm ${getStatusColor(migration.status)}`}>
                        {migration.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">CPF</p>
                        <p className="text-sm font-mono">{migration.cpf}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Telefone</p>
                        <p className="text-sm">{migration.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Email</p>
                        <p className="text-sm truncate">{migration.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Criado em</p>
                        <p className="text-sm">{formatDate(migration.created_at)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-black/30 rounded-lg p-4">
                      <div>
                        <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Valor
                        </p>
                        <p className="text-lg font-bold text-[#D4AF37]">
                          {formatCurrency(migration.loan_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Taxa de Juros</p>
                        <p className="text-lg font-bold">{migration.interest_rate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Vencimento
                        </p>
                        <p className="text-lg font-bold">{formatDate(migration.due_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Tipo de Cobrança</p>
                        <p className="text-lg font-bold">{migration.charge_type}</p>
                      </div>
                    </div>

                    {migration.notes && (
                      <div className="mt-4 bg-black/30 rounded-lg p-3">
                        <p className="text-xs text-zinc-500 mb-1">Observações</p>
                        <p className="text-sm text-zinc-300">{migration.notes}</p>
                      </div>
                    )}
                  </div>

                  {migration.status === 'PENDENTE_VALIDACAO' && (
                    <button
                      onClick={() => openModal(migration)}
                      className="ml-4 bg-[#D4AF37] text-black px-4 py-2 rounded-lg font-bold hover:bg-[#C4A037] transition-colors flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Analisar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedMigration && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-2xl font-bold">Validar Contrato</h2>
              <p className="text-zinc-400 mt-1">{selectedMigration.client_name}</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Dados do Cliente */}
              <div>
                <h3 className="text-lg font-bold mb-3">Dados do Cliente</h3>
                <div className="grid grid-cols-2 gap-4 bg-black/30 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-zinc-500">CPF</p>
                    <p className="font-mono">{selectedMigration.cpf}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Telefone</p>
                    <p>{selectedMigration.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-zinc-500">Email</p>
                    <p>{selectedMigration.email}</p>
                  </div>
                </div>
              </div>

              {/* Ajustar Valores */}
              <div>
                <h3 className="text-lg font-bold mb-3">Ajustar Valores (Opcional)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Valor do Empréstimo
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustedAmount}
                      onChange={(e) => setAdjustedAmount(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Taxa de Juros (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustedRate}
                      onChange={(e) => setAdjustedRate(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Data de Vencimento
                    </label>
                    <input
                      type="date"
                      value={adjustedDueDate}
                      onChange={(e) => setAdjustedDueDate(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              {selectedMigration.notes && (
                <div>
                  <h3 className="text-lg font-bold mb-3">Observações do Cliente</h3>
                  <div className="bg-black/30 rounded-lg p-4">
                    <p className="text-zinc-300">{selectedMigration.notes}</p>
                  </div>
                </div>
              )}

              {/* Rejeitar */}
              <div>
                <h3 className="text-lg font-bold mb-3 text-red-500">Ou Rejeitar</h3>
                <textarea
                  placeholder="Motivo da rejeição..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:outline-none resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-zinc-800 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-zinc-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                Rejeitar
              </button>
              <button
                onClick={handleValidate}
                className="flex-1 bg-[#D4AF37] text-black px-6 py-3 rounded-lg font-bold hover:bg-[#C4A037] transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Validar e Ativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
