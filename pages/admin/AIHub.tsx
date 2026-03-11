// 🤖 Central de IA - Chatbot e Logs Unificados
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Bot, Save, MessageSquare, Settings2, Brain, Clock, TestTube,
    Send, History, User, Trash2, RefreshCw, Search, Phone, Calendar,
    ChevronDown, ChevronUp, ExternalLink, Terminal, Zap, AlertCircle,
    CheckCircle, Filter, Download, Eye, X, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Button } from '../../components/Button';
import { aiChatbotService } from '../../services/aiChatbotService';
import { apiService } from '../../services/apiService';
import { useToast } from '../../components/Toast';
import { api } from '../../services/apiClient';
import { InteractionLog } from '../../types';

type TabType = 'config' | 'conversations' | 'logs' | 'test';

interface ChatbotConfig {
  id: string;
  enabled: boolean;
  provider: 'gemini' | 'perplexity' | 'openai' | 'anthropic' | 'groq' | 'grok' | 'nvidia' | 'zai' | 'openrouter';
  geminiApiKey: string;
  perplexityApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  groqApiKey: string;
  grokApiKey: string;
  nvidiaApiKey: string;
  zaiApiKey: string;
  openrouterApiKey: string;
  systemPrompt: string;
  welcomeMessage: string;
  fallbackMessage: string;
  transferKeywords: string;
  autoReplyEnabled: boolean;
  workingHoursOnly: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  maxMessagesPerChat: number;
}

interface ChatHistoryItem {
    id: string;
    phone: string;
    customer_id: string | null;
    role: 'user' | 'assistant';
    message: string;
    created_at: string;
}

interface ConversationGroup {
    phone: string;
    messages: ChatHistoryItem[];
    lastMessage: string;
    lastMessageTime: string;
    customerName?: string;
}

const defaultConfig: ChatbotConfig = {
  id: '',
  enabled: false,
  provider: 'gemini',
  geminiApiKey: '',
  perplexityApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  groqApiKey: '',
  grokApiKey: '',
  nvidiaApiKey: '',
  zaiApiKey: '',
  openrouterApiKey: '',
  systemPrompt: `Você é o assistente virtual da TUBARÃO EMPRÉSTIMOS, uma empresa de crédito com garantia de veículo.

Regras:
- Seja objetivo e profissional
- Responda apenas o que foi perguntado
- Se não souber, responda: [TRANSFERIR]
- Português Brasil`,
  welcomeMessage: 'Olá! 👋 Sou o assistente virtual da TUBARÃO EMPRÉSTIMOS. Como posso ajudar?',
  fallbackMessage: 'Desculpe, não entendi. Vou transferir para um atendente.',
  transferKeywords: 'atendente,humano,pessoa',
  autoReplyEnabled: true,
  workingHoursOnly: false,
  workingHoursStart: '08:00',
  workingHoursEnd: '18:00',
  maxMessagesPerChat: 50
};

const inputStyle = "w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none transition-colors";

export const AIHub: React.FC = () => {
    const { addToast } = useToast();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>('config');
    const [loading, setLoading] = useState(true);

    // Config
    const [config, setConfig] = useState<ChatbotConfig>(defaultConfig);
    const [isSaving, setIsSaving] = useState(false);

    // Conversations
    const [conversations, setConversations] = useState<ConversationGroup[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<ConversationGroup | null>(null);
    const [conversationSearch, setConversationSearch] = useState('');

    // Logs
    const [logs, setLogs] = useState<InteractionLog[]>([]);
    const [logSearch, setLogSearch] = useState('');

    // Test
    const [testMessage, setTestMessage] = useState('');
    const [testResponse, setTestResponse] = useState('');
    const [isTesting, setIsTesting] = useState(false);

    // Read tab from URL on mount and when URL changes
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'config' || tabParam === 'conversations' || tabParam === 'logs' || tabParam === 'test') {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            // Load config
            const configData = await aiChatbotService.getConfig();
            if (configData) {
                setConfig(configData);
            }

            // Load conversations via API
            const { data: historyData } = await api.get('/chatbot/history-all');

            if (historyData) {
                const grouped: Record<string, ChatHistoryItem[]> = {};
                (historyData as any[]).forEach((item: ChatHistoryItem) => {
                    if (!grouped[item.phone]) grouped[item.phone] = [];
                    grouped[item.phone].push(item);
                });

                const convs: ConversationGroup[] = Object.entries(grouped).map(([phone, msgs]) => ({
                    phone,
                    messages: msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
                    lastMessage: msgs[0].message,
                    lastMessageTime: msgs[0].created_at
                }));

                // Sort by last message time
                convs.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
                setConversations(convs);
            }

            // Load interaction logs
            const logsData = await apiService.getInteractionLogs();
            setLogs(logsData);

        } catch (error) {
            console.error('Error loading data:', error);
        }
        setLoading(false);
    };

    // Config handlers
    const handleSaveConfig = async () => {
        setIsSaving(true);
        const success = await aiChatbotService.saveConfig(config);
        if (success) {
            addToast('Configurações salvas!', 'success');
        } else {
            addToast('Erro ao salvar', 'error');
        }
        setIsSaving(false);
    };

    // Test handlers
    const handleTest = async () => {
        if (!testMessage.trim()) return;
        setIsTesting(true);
        setTestResponse('');

        try {
            // Usa endpoint do backend em vez de chamar API diretamente
            const response = await api.post('/chatbot/message', {
                phone: '5500000000000', // Número de teste
                message: testMessage,
                customerContext: 'Teste via Central IA'
            });
            setTestResponse(response?.data?.response || response?.data?.error || 'Sem resposta');
        } catch (error: any) {
            const errorMsg = error?.response?.data?.error || error?.message || 'Erro ao conectar com o servidor';
            setTestResponse('Erro: ' + errorMsg);
        }
        setIsTesting(false);
    };

    // Clear handlers
    const handleClearHistory = async (phone?: string) => {
        if (!confirm(phone ? `Limpar histórico de ${phone}?` : 'Limpar todo o histórico?')) return;

        try {
            const url = phone ? `/chatbot/history?phone=${encodeURIComponent(phone)}` : '/chatbot/history';
            await api.delete(url);
            addToast('Histórico limpo!', 'success');
            setSelectedConversation(null);
            loadAllData();
        } catch {
            addToast('Erro ao limpar histórico', 'error');
        }
    };

    // Format helpers
    const formatPhone = (phone: string) => {
        const clean = phone.replace(/\D/g, '');
        if (clean.length === 13) {
            return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
        }
        return phone;
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (hours < 1) return 'Agora';
        if (hours < 24) return `${hours}h atrás`;
        if (days < 7) return `${days}d atrás`;
        return date.toLocaleDateString('pt-BR');
    };

    const getIntentColor = (intent: string) => {
        switch (intent) {
            case 'PAYMENT_PROMISE': return 'text-green-400 bg-green-900/30';
            case 'REQUEST_BOLETO': return 'text-blue-400 bg-blue-900/30';
            case 'SUPPORT': return 'text-red-400 bg-red-900/30';
            case 'GREETING': return 'text-purple-400 bg-purple-900/30';
            default: return 'text-zinc-400 bg-zinc-800';
        }
    };

    // Stats
    const stats = {
        totalConversations: conversations.length,
        totalMessages: conversations.reduce((sum, c) => sum + c.messages.length, 0),
        todayMessages: conversations.reduce((sum, c) => {
            const today = new Date().toDateString();
            return sum + c.messages.filter(m => new Date(m.created_at).toDateString() === today).length;
        }, 0),
        logCount: logs.length
    };

    const tabs = [
        { id: 'config', label: 'Configurar', icon: <Settings2 size={18} /> },
        { id: 'conversations', label: 'Conversas', icon: <MessageSquare size={18} />, badge: stats.totalConversations },
        { id: 'logs', label: 'Logs', icon: <Terminal size={18} />, badge: stats.logCount },
        { id: 'test', label: 'Testar', icon: <TestTube size={18} /> },
    ] as const;

    const filteredConversations = conversations.filter(c =>
        c.phone.includes(conversationSearch) ||
        c.lastMessage.toLowerCase().includes(conversationSearch.toLowerCase())
    );

    const filteredLogs = logs.filter(l =>
        l.userName?.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.message.toLowerCase().includes(logSearch.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                        <Bot size={32} /> Central de IA
                    </h1>
                    <p className="text-zinc-500 mt-1">Chatbot, Conversas e Logs de Interação</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={loadAllData}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-900/10 border border-purple-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={16} className="text-purple-400" />
                        <span className="text-zinc-400 text-sm">Conversas</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">{stats.totalConversations}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-900/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap size={16} className="text-blue-400" />
                        <span className="text-zinc-400 text-sm">Mensagens Hoje</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{stats.todayMessages}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500/20 to-green-900/10 border border-green-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <History size={16} className="text-green-400" />
                        <span className="text-zinc-400 text-sm">Total Mensagens</span>
                    </div>
                    <p className="text-2xl font-bold text-green-400">{stats.totalMessages}</p>
                </div>
                <div className="bg-gradient-to-br from-[#D4AF37]/20 to-yellow-900/10 border border-[#D4AF37]/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        {config.enabled ? <CheckCircle size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
                        <span className="text-zinc-400 text-sm">Status</span>
                    </div>
                    <p className={`text-2xl font-bold ${config.enabled ? 'text-green-400' : 'text-red-400'}`}>
                        {config.enabled ? 'Ativo' : 'Inativo'}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-[#D4AF37] text-black'
                            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.badge !== undefined && tab.badge > 0 && (
                            <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${activeTab === tab.id ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-300'}`}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Config Tab */}
            {activeTab === 'config' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Main Settings */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Settings2 size={20} className="text-[#D4AF37]" /> Configurações Gerais
                        </h3>
                        <div className="space-y-4">
                            {/* Enable Toggle */}
                            <div className="flex items-center justify-between p-4 bg-black rounded-xl">
                                <div>
                                    <p className="font-bold text-white">Chatbot Ativo</p>
                                    <p className="text-xs text-zinc-500">Ativar respostas automáticas</p>
                                </div>
                                <button
                                    onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                                    className={`p-2 rounded-lg transition-colors ${config.enabled ? 'bg-green-600' : 'bg-zinc-700'}`}
                                >
                                    {config.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                </button>
                            </div>

{/* Provider */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Provedor de IA</label>
          <select
            value={config.provider}
            onChange={e => setConfig(prev => ({ ...prev, provider: e.target.value as any }))}
            className={inputStyle}
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="perplexity">Perplexity</option>
            <option value="groq">Groq</option>
            <option value="grok">Grok (xAI)</option>
            <option value="nvidia">NVIDIA</option>
            <option value="zai">Z.AI</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            API Key ({config.provider})
          </label>
          <input
            type="password"
            value={(() => {
              switch (config.provider) {
                case 'gemini': return config.geminiApiKey;
                case 'openai': return config.openaiApiKey;
                case 'anthropic': return config.anthropicApiKey;
                case 'perplexity': return config.perplexityApiKey;
                case 'groq': return config.groqApiKey;
                case 'grok': return config.grokApiKey;
                case 'nvidia': return config.nvidiaApiKey;
                case 'zai': return config.zaiApiKey;
                case 'openrouter': return config.openrouterApiKey;
                default: return '';
              }
            })()}
            onChange={e => {
              const value = e.target.value;
              setConfig(prev => {
                const updates: Partial<ChatbotConfig> = {};
                switch (config.provider) {
                  case 'gemini': updates.geminiApiKey = value; break;
                  case 'openai': updates.openaiApiKey = value; break;
                  case 'anthropic': updates.anthropicApiKey = value; break;
                  case 'perplexity': updates.perplexityApiKey = value; break;
                  case 'groq': updates.groqApiKey = value; break;
                  case 'grok': updates.grokApiKey = value; break;
                  case 'nvidia': updates.nvidiaApiKey = value; break;
                  case 'zai': updates.zaiApiKey = value; break;
                  case 'openrouter': updates.openrouterApiKey = value; break;
                }
                return { ...prev, ...updates };
              });
            }}
            placeholder="sk-..."
            className={inputStyle}
          />
        </div>

                            {/* Working Hours */}
                            <div className="flex items-center justify-between p-4 bg-black rounded-xl">
                                <div>
                                    <p className="font-bold text-white">Apenas Horário Comercial</p>
                                    <p className="text-xs text-zinc-500">{config.workingHoursStart} - {config.workingHoursEnd}</p>
                                </div>
                                <button
                                    onClick={() => setConfig(prev => ({ ...prev, workingHoursOnly: !prev.workingHoursOnly }))}
                                    className={`p-2 rounded-lg transition-colors ${config.workingHoursOnly ? 'bg-blue-600' : 'bg-zinc-700'}`}
                                >
                                    {config.workingHoursOnly ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <MessageSquare size={20} className="text-[#D4AF37]" /> Mensagens
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Mensagem de Boas-vindas</label>
                                <textarea
                                    value={config.welcomeMessage}
                                    onChange={e => setConfig(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                                    className={`${inputStyle} h-20 resize-none`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Mensagem de Fallback</label>
                                <textarea
                                    value={config.fallbackMessage}
                                    onChange={e => setConfig(prev => ({ ...prev, fallbackMessage: e.target.value }))}
                                    className={`${inputStyle} h-20 resize-none`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Palavras para Transferir</label>
                                <input
                                    type="text"
                                    value={config.transferKeywords}
                                    onChange={e => setConfig(prev => ({ ...prev, transferKeywords: e.target.value }))}
                                    placeholder="atendente,humano,pessoa"
                                    className={inputStyle}
                                />
                            </div>
                        </div>
                    </div>

                    {/* System Prompt */}
                    <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Brain size={20} className="text-[#D4AF37]" /> Prompt do Sistema
                        </h3>
                        <textarea
                            value={config.systemPrompt}
                            onChange={e => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                            className={`${inputStyle} h-64 resize-none font-mono text-sm`}
                            placeholder="Instruções para a IA..."
                        />
                        <div className="flex justify-end mt-4">
                            <Button onClick={handleSaveConfig} disabled={isSaving}>
                                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                Salvar Configurações
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Conversations Tab */}
            {activeTab === 'conversations' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Conversation List */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800">
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar conversas..."
                                    value={conversationSearch}
                                    onChange={e => setConversationSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-black border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto">
                            {filteredConversations.map(conv => (
                                <button
                                    key={conv.phone}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`w-full p-4 text-left border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors ${selectedConversation?.phone === conv.phone ? 'bg-zinc-800' : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-[#D4AF37] to-yellow-600 rounded-full flex items-center justify-center">
                                            <Phone size={16} className="text-black" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-sm truncate">{formatPhone(conv.phone)}</p>
                                            <p className="text-xs text-zinc-500 truncate">{conv.lastMessage}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-zinc-500">{formatDate(conv.lastMessageTime)}</p>
                                            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                                                {conv.messages.length}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {filteredConversations.length === 0 && (
                                <div className="p-8 text-center text-zinc-500">
                                    <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>Nenhuma conversa</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Conversation Detail */}
                    <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        {selectedConversation ? (
                            <>
                                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-[#D4AF37] to-yellow-600 rounded-full flex items-center justify-center">
                                            <Phone size={16} className="text-black" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{formatPhone(selectedConversation.phone)}</p>
                                            <p className="text-xs text-zinc-500">{selectedConversation.messages.length} mensagens</p>
                                        </div>
                                    </div>
                                    <Button variant="danger" size="sm" onClick={() => handleClearHistory(selectedConversation.phone)}>
                                        <Trash2 size={14} /> Limpar
                                    </Button>
                                </div>
                                <div className="p-4 max-h-[400px] overflow-y-auto space-y-3">
                                    {selectedConversation.messages.map(msg => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                                        >
                                            <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user'
                                                ? 'bg-zinc-800 text-white rounded-bl-none'
                                                : 'bg-[#D4AF37] text-black rounded-br-none'
                                                }`}>
                                                <p className="text-sm">{msg.message}</p>
                                                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-zinc-500' : 'text-black/60'}`}>
                                                    {new Date(msg.created_at).toLocaleString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-zinc-500">
                                <div className="text-center">
                                    <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                                    <p>Selecione uma conversa</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Buscar logs..."
                                value={logSearch}
                                onChange={e => setLogSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none"
                            />
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-zinc-950 border-b border-zinc-800">
                                <tr>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Data</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Usuário</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Mensagem</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Intenção</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Resposta</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {filteredLogs.slice(0, 50).map(log => (
                                    <tr key={log.id} className="hover:bg-zinc-800/30">
                                        <td className="p-4 text-zinc-500 text-sm whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="p-4 font-bold text-white">{log.userName}</td>
                                        <td className="p-4 text-zinc-300 max-w-xs truncate" title={log.message}>
                                            "{log.message}"
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${getIntentColor(log.intent)}`}>
                                                {log.intent}
                                            </span>
                                        </td>
                                        <td className="p-4 text-zinc-400 max-w-xs truncate">
                                            {log.reply || <span className="italic text-zinc-600">Sem resposta</span>}
                                        </td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-zinc-500">
                                            <Terminal size={48} className="mx-auto mb-4 opacity-50" />
                                            <p>Nenhum log encontrado</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Test Tab */}
            {activeTab === 'test' && (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <TestTube size={20} className="text-[#D4AF37]" /> Testar Chatbot
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Mensagem de teste</label>
                                <textarea
                                    value={testMessage}
                                    onChange={e => setTestMessage(e.target.value)}
                                    placeholder="Digite uma mensagem para testar..."
                                    className={`${inputStyle} h-24 resize-none`}
                                />
                            </div>
                            <Button onClick={handleTest} disabled={isTesting} className="w-full">
                                {isTesting ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                                Enviar Teste
                            </Button>

                            {testResponse && (
                                <div className="mt-6">
                                    <label className="block text-sm text-zinc-400 mb-2">Resposta da IA:</label>
                                    <div className="bg-black border border-[#D4AF37]/30 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 bg-[#D4AF37] rounded-full flex items-center justify-center shrink-0">
                                                <Bot size={16} className="text-black" />
                                            </div>
                                            <p className="text-white whitespace-pre-wrap">{testResponse}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIHub;
