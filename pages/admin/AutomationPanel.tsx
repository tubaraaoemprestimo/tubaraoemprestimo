import { useState, useEffect } from 'react';
import { MessageSquare, TrendingUp, AlertCircle, CheckCircle, XCircle, Clock, RefreshCw, Send } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

interface AutomationLog {
  id: string;
  leadId: string;
  leadStatus: 'HOT' | 'WARM' | 'COLD';
  clientName: string;
  phone: string;
  messageText: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  messageId?: string;
  error?: string;
  sentAt?: string;
  createdAt: string;
}

interface AutomationStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  successRate: string;
}

export function AutomationPanel() {
  const { addToast } = useToast();

  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<AutomationLog | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  // Test form
  const [testPhone, setTestPhone] = useState('');
  const [testName, setTestName] = useState('');
  const [testLeadStatus, setTestLeadStatus] = useState<'HOT' | 'WARM' | 'COLD'>('HOT');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, [filterStatus]);

  const loadData = async () => {
    try {
      const [logsData, statsData] = await Promise.all([
        apiService.getAutomationLogs(filterStatus !== 'ALL' ? filterStatus : undefined),
        apiService.getAutomationStats()
      ]);
      setLogs(logsData);
      setStats(statsData);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      await apiService.retryAutomation(id);
      addToast('Mensagem reenviada com sucesso!', 'success');
      loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setRetrying(null);
    }
  };

  const handleTest = async () => {
    if (!testPhone || !testName) {
      addToast('Preencha nome e telefone', 'warning');
      return;
    }

    setTesting(true);
    try {
      await apiService.testAutomation(testPhone, testName, testLeadStatus);
      addToast('Mensagem de teste enviada! Aguarde 3 minutos.', 'success');
      setTestPhone('');
      setTestName('');
      loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'FAILED':
        return <XCircle size={20} className="text-red-500" />;
      case 'PENDING':
        return <Clock size={20} className="text-yellow-500" />;
      default:
        return <AlertCircle size={20} className="text-zinc-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT':
        return 'bg-green-600';
      case 'FAILED':
        return 'bg-red-600';
      case 'PENDING':
        return 'bg-yellow-600';
      default:
        return 'bg-zinc-600';
    }
  };

  const getLeadStatusColor = (status: string) => {
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

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">📱 Automação WhatsApp</h1>
          <p className="text-zinc-400">Monitoramento de disparos automáticos via Evolution API</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Total</p>
                  <p className="text-3xl font-bold text-white">{stats.total}</p>
                </div>
                <MessageSquare size={32} className="text-zinc-600" />
              </div>
            </div>

            <div className="bg-zinc-900 border border-green-600 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm mb-1">✅ Enviadas</p>
                  <p className="text-3xl font-bold text-green-500">{stats.sent}</p>
                </div>
                <CheckCircle size={32} className="text-green-600" />
              </div>
            </div>

            <div className="bg-zinc-900 border border-red-600 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm mb-1">❌ Falhadas</p>
                  <p className="text-3xl font-bold text-red-500">{stats.failed}</p>
                </div>
                <XCircle size={32} className="text-red-600" />
              </div>
            </div>

            <div className="bg-zinc-900 border border-yellow-600 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm mb-1">⏰ Pendentes</p>
                  <p className="text-3xl font-bold text-yellow-500">{stats.pending}</p>
                </div>
                <Clock size={32} className="text-yellow-600" />
              </div>
            </div>

            <div className="bg-zinc-900 border border-[#D4AF37] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Taxa Sucesso</p>
                  <p className="text-3xl font-bold text-[#D4AF37]">{stats.successRate}</p>
                </div>
                <TrendingUp size={32} className="text-[#D4AF37]" />
              </div>
            </div>
          </div>
        )}

        {/* Test Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Send size={20} /> Testar Envio Manual
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <input
              type="text"
              value={testName}
              onChange={e => setTestName(e.target.value)}
              placeholder="Nome do cliente"
              className="bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
            />
            <input
              type="tel"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
            />
            <select
              value={testLeadStatus}
              onChange={e => setTestLeadStatus(e.target.value as 'HOT' | 'WARM' | 'COLD')}
              className="bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="HOT">🔥 Lead Quente</option>
              <option value="WARM">⚠️ Lead Morno</option>
              <option value="COLD">❄️ Lead Frio</option>
            </select>
            <Button onClick={handleTest} disabled={testing}>
              {testing ? 'Enviando...' : 'Enviar Teste'}
            </Button>
          </div>
          <p className="text-zinc-500 text-sm mt-2">
            ⏰ A mensagem será enviada após 3 minutos (humanização)
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['ALL', 'SENT', 'FAILED', 'PENDING'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-6 py-3 rounded-lg font-bold transition-all ${
                filterStatus === status
                  ? 'bg-gradient-to-br from-[#D4AF37] to-[#8B4513] text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {status === 'ALL' ? 'Todos' : status}
            </button>
          ))}
        </div>

        {/* Logs List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-zinc-400">Carregando logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-400">Nenhum log encontrado</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {logs.map(log => (
              <div
                key={log.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 cursor-pointer hover:border-[#D4AF37] transition-all"
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {getStatusIcon(log.status)}
                      <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${getLeadStatusColor(log.leadStatus)}`}>
                        {log.leadStatus}
                      </span>
                      <span className="text-zinc-500 text-sm">
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">{log.clientName}</h3>
                    <p className="text-zinc-400 text-sm mb-2">📱 {log.phone}</p>

                    {log.sentAt && (
                      <p className="text-green-400 text-sm">
                        ✅ Enviada em: {new Date(log.sentAt).toLocaleString('pt-BR')}
                      </p>
                    )}

                    {log.error && (
                      <p className="text-red-400 text-sm mt-2">
                        ❌ Erro: {log.error}
                      </p>
                    )}
                  </div>

                  {log.status === 'FAILED' && (
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetry(log.id);
                      }}
                      disabled={retrying === log.id}
                    >
                      <RefreshCw size={16} className="mr-2" />
                      {retrying === log.id ? 'Reenviando...' : 'Reenviar'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Log Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedLog.clientName}</h2>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${getStatusColor(selectedLog.status)}`}>
                      {selectedLog.status}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${getLeadStatusColor(selectedLog.leadStatus)}`}>
                      {selectedLog.leadStatus}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-zinc-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-zinc-500 text-sm mb-1">Telefone</p>
                  <p className="text-white font-bold">{selectedLog.phone}</p>
                </div>

                <div>
                  <p className="text-zinc-500 text-sm mb-1">Criado em</p>
                  <p className="text-white font-bold">
                    {new Date(selectedLog.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>

                {selectedLog.sentAt && (
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">Enviado em</p>
                    <p className="text-green-400 font-bold">
                      {new Date(selectedLog.sentAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}

                {selectedLog.messageId && (
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">Message ID</p>
                    <p className="text-white font-mono text-sm">{selectedLog.messageId}</p>
                  </div>
                )}

                <div>
                  <p className="text-zinc-500 text-sm mb-2">Mensagem Enviada</p>
                  <div className="bg-black border border-zinc-700 rounded-lg p-4">
                    <p className="text-white whitespace-pre-wrap">{selectedLog.messageText}</p>
                  </div>
                </div>

                {selectedLog.error && (
                  <div>
                    <p className="text-zinc-500 text-sm mb-2">Erro</p>
                    <div className="bg-red-900/20 border border-red-600 rounded-lg p-4">
                      <p className="text-red-400">{selectedLog.error}</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedLog.status === 'FAILED' && (
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <Button
                    onClick={() => {
                      handleRetry(selectedLog.id);
                      setSelectedLog(null);
                    }}
                    disabled={retrying === selectedLog.id}
                    className="w-full"
                  >
                    <RefreshCw size={16} className="mr-2" />
                    {retrying === selectedLog.id ? 'Reenviando...' : 'Reenviar Mensagem'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
