import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, Mail, MessageSquare, Bell, Calendar, DollarSign, AlertCircle, CheckCircle, XCircle, RefreshCw, Play } from 'lucide-react';
import { api } from '../../services/apiClient';
import { useToast } from '../../components/Toast';

interface CollectionStats {
  dueIn7Days: number;
  dueIn3Days: number;
  dueToday: number;
  overdue1Day: number;
  overdue3Days: number;
  overdue7Days: number;
  overdue15Days: number;
  overdue30Days: number;
  totalSent: number;
  errors: number;
}

interface CollectionRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  channels: string[];
  icon: React.ReactNode;
  color: string;
}

export function CollectionAutomationPanel() {
  const { addToast } = useToast();
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastExecution, setLastExecution] = useState<string | null>(null);

  const rules: CollectionRule[] = [
    {
      id: '1',
      name: 'Lembrete 7 dias antes',
      description: 'Lembrete amigável 7 dias antes do vencimento',
      trigger: 'Vence em 7 dias',
      channels: ['Email', 'WhatsApp', 'Push'],
      icon: <Calendar className="w-5 h-5" />,
      color: 'text-blue-500'
    },
    {
      id: '2',
      name: 'Lembrete 3 dias antes',
      description: 'Lembrete 3 dias antes do vencimento',
      trigger: 'Vence em 3 dias',
      channels: ['Email', 'WhatsApp', 'Push'],
      icon: <Clock className="w-5 h-5" />,
      color: 'text-cyan-500'
    },
    {
      id: '3',
      name: 'Vence hoje',
      description: 'Notificação no dia do vencimento',
      trigger: 'Vence hoje',
      channels: ['Email', 'WhatsApp', 'Push'],
      icon: <AlertCircle className="w-5 h-5" />,
      color: 'text-yellow-500'
    },
    {
      id: '4',
      name: 'Atraso 1 dia',
      description: 'Primeira cobrança após vencimento',
      trigger: '1 dia de atraso',
      channels: ['Email', 'WhatsApp', 'Push'],
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-orange-500'
    },
    {
      id: '5',
      name: 'Atraso 3 dias',
      description: 'Cobrança com juros acumulados',
      trigger: '3 dias de atraso',
      channels: ['Email', 'WhatsApp', 'Push'],
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-orange-600'
    },
    {
      id: '6',
      name: 'Atraso 7 dias',
      description: 'Cobrança urgente',
      trigger: '7 dias de atraso',
      channels: ['Email', 'WhatsApp', 'Push'],
      icon: <AlertCircle className="w-5 h-5" />,
      color: 'text-red-500'
    },
    {
      id: '7',
      name: 'Atraso 15 dias',
      description: 'Cobrança crítica',
      trigger: '15 dias de atraso',
      channels: ['Email', 'WhatsApp', 'Push'],
      icon: <XCircle className="w-5 h-5" />,
      color: 'text-red-600'
    },
    {
      id: '8',
      name: 'Atraso 30 dias',
      description: 'Última notificação antes de medidas legais',
      trigger: '30 dias de atraso',
      channels: ['Email', 'WhatsApp', 'Push'],
      icon: <XCircle className="w-5 h-5" />,
      color: 'text-red-700'
    }
  ];

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/collection-automation/stats');
      setStats(response.data);

      // Buscar última execução dos logs
      const historyResponse = await api.get('/collection-automation/history?limit=1');
      if (historyResponse.data && historyResponse.data.length > 0) {
        setLastExecution(historyResponse.data[0].executed_at);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      addToast('Erro ao carregar estatísticas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRunManually = async () => {
    if (running) return;

    try {
      setRunning(true);
      addToast('Executando réguas de cobrança...', 'info');

      const response = await api.post('/collection-automation/run');

      if (response.data.success) {
        addToast(`Réguas executadas! ${response.data.stats.totalSent} mensagens enviadas`, 'success');
        await loadStats();
      } else {
        addToast('Erro ao executar réguas', 'error');
      }
    } catch (error: any) {
      console.error('Erro ao executar réguas:', error);
      addToast(error.response?.data?.error || 'Erro ao executar réguas', 'error');
    } finally {
      setRunning(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca executado';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatValue = (ruleId: string): number => {
    if (!stats) return 0;

    switch (ruleId) {
      case '1': return stats.dueIn7Days;
      case '2': return stats.dueIn3Days;
      case '3': return stats.dueToday;
      case '4': return stats.overdue1Day;
      case '5': return stats.overdue3Days;
      case '6': return stats.overdue7Days;
      case '7': return stats.overdue15Days;
      case '8': return stats.overdue30Days;
      default: return 0;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-[#D4AF37]" />
                Réguas de Cobrança Automatizadas
              </h1>
              <p className="text-zinc-400 mt-2">
                Sistema automático de lembretes e cobranças multi-canal
              </p>
            </div>
            <button
              onClick={handleRunManually}
              disabled={running}
              className="bg-[#D4AF37] text-black px-6 py-3 rounded-lg font-bold hover:bg-[#C4A037] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {running ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Executar Agora
                </>
              )}
            </button>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-zinc-900 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-[#D4AF37]" />
                <span className="text-sm text-zinc-400">Última Execução</span>
              </div>
              <p className="text-lg font-bold">{formatDate(lastExecution)}</p>
            </div>

            <div className="bg-zinc-900 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-zinc-400">Total Enviado</span>
              </div>
              <p className="text-lg font-bold">{stats?.totalSent || 0}</p>
            </div>

            <div className="bg-zinc-900 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-zinc-400">Erros</span>
              </div>
              <p className="text-lg font-bold">{stats?.errors || 0}</p>
            </div>

            <div className="bg-zinc-900 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-zinc-400">Próxima Execução</span>
              </div>
              <p className="text-lg font-bold">Amanhã às 9h</p>
            </div>
          </div>

          {/* Alert */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <p className="font-bold text-blue-400">Execução Automática</p>
              <p className="text-sm text-zinc-400 mt-1">
                As réguas são executadas automaticamente todos os dias às 9h da manhã (horário de São Paulo).
                Você pode executar manualmente a qualquer momento usando o botão acima.
              </p>
            </div>
          </div>
        </div>

        {/* Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => {
            const statValue = getStatValue(rule.id);

            return (
              <div
                key={rule.id}
                className="bg-zinc-900 rounded-xl p-6 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`${rule.color}`}>
                      {rule.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{rule.name}</h3>
                      <p className="text-sm text-zinc-400">{rule.description}</p>
                    </div>
                  </div>
                  <div className="bg-black rounded-lg px-3 py-1">
                    <span className="text-2xl font-bold text-[#D4AF37]">{statValue}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-zinc-500" />
                    <span className="text-zinc-400">Trigger:</span>
                    <span className="text-white font-medium">{rule.trigger}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-400">Canais:</span>
                    <div className="flex gap-2">
                      {rule.channels.includes('Email') && (
                        <div className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span className="text-xs">Email</span>
                        </div>
                      )}
                      {rule.channels.includes('WhatsApp') && (
                        <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span className="text-xs">WhatsApp</span>
                        </div>
                      )}
                      {rule.channels.includes('Push') && (
                        <div className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded flex items-center gap-1">
                          <Bell className="w-3 h-3" />
                          <span className="text-xs">Push</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-zinc-900 rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4">Como Funciona</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#D4AF37] rounded-full flex items-center justify-center text-black font-bold">1</div>
                <span className="font-bold">Detecção Automática</span>
              </div>
              <p className="text-zinc-400 ml-10">
                O sistema verifica diariamente todas as parcelas e identifica quais estão próximas do vencimento ou atrasadas.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#D4AF37] rounded-full flex items-center justify-center text-black font-bold">2</div>
                <span className="font-bold">Envio Multi-Canal</span>
              </div>
              <p className="text-zinc-400 ml-10">
                Mensagens são enviadas automaticamente via Email, WhatsApp e Notificações Push para cada cliente.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#D4AF37] rounded-full flex items-center justify-center text-black font-bold">3</div>
                <span className="font-bold">Registro e Controle</span>
              </div>
              <p className="text-zinc-400 ml-10">
                Todos os envios são registrados no sistema com data, hora e status de entrega para auditoria.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
