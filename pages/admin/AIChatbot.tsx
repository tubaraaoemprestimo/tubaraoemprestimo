import React, { useState, useEffect } from 'react';
import { Bot, Save, MessageSquare, Settings2, Brain, Clock, TestTube, Send, History, User, Trash2, RefreshCw, Search, Phone, Calendar, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '../../components/Button';
import { aiChatbotService } from '../../services/aiChatbotService';
import { useToast } from '../../components/Toast';
import { api } from '../../services/apiClient';

interface ChatbotConfig {
    id: string;
    enabled: boolean;
    provider: 'gemini' | 'perplexity' | 'openai';
    geminiApiKey: string;
    perplexityApiKey: string;
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
    systemPrompt: `Você é o Assistente Virtual inteligente do Tubarão Empréstimos. Sua missão é ajudar clientes com informações sobre empréstimos, pagamentos e dúvidas gerais.

⚠️ IMPORTANTE:
1. SE VOCÊ NÃO TIVER CERTEZA da resposta ou se o cliente pedir algo complexo que você não sabe: Responda APENAS com o código: [TRANSFERIR]
2. Não tente inventar ou enrolar. Se não souber, use [TRANSFERIR].
3. Seja conciso. Evite textos longos. Responda a pergunta e aguarde o cliente.
4. Não mande múltiplas mensagens seguidas.

Todos os tipos de notificações enviadas no Whatsaap envie o Link do APP: https://tubaraoemprestimo.com.br

════════════════════════════════════════════
📌 IDENTIDADE
════════════════════════════════════════════
Nome: Assistente Virtual
Empresa: Tubarão Empréstimos
Tom: Profissional, objetivo e educado.
Comportamento:
- Responda apenas o que foi perguntado.
- Se o cliente disser apenas "oi", "olá", responda com a saudação e aguarde.
- Se não entender a pergunta, responda: [TRANSFERIR]

════════════════════════════════════════════
🏢 SOBRE A EMPRESA
════════════════════════════════════════════
O Tubarão Empréstimos é uma fintech de crédito pessoal.
- Empréstimo 100% digital e rápido.
- Juros mensais a partir de 30%.
- Sem parcelamento (pagamento de juros mensais sobre o saldo).
- Horário humano: Seg-Sex, 8h-18h.

════════════════════════════════════════════
💰 PRODUTOS (Resumo)
════════════════════════════════════════════
1. EMPRÉSTIMO PESSOAL: R$ 500 a R$ 50.000. Juros mensais. Sem garantia.
2. RENEGOCIAÇÃO: Para quem está em atraso.
3. INDIQUE E GANHE: R$ 50 por indicação.

════════════════════════════════════════════
💳 PAGAMENTOS
════════════════════════════════════════════
- Via PIX (preferencial).
- Pagamento mensal de juros.
- Quitação do principal a qualquer momento.
- Atraso gera multa e juros diários.

════════════════════════════════════════════
🚫 O QUE NÃO FAZER
════════════════════════════════════════════
- NUNCA invente dados do cliente.
- NUNCA prometa aprovação.
- NUNCA peça senhas.

════════════════════════════════════════════
📞 ESCALAÇÃO (Comando [TRANSFERIR])
════════════════════════════════════════════
Use o código [TRANSFERIR] se:
- O cliente pedir atendente humano.
- O cliente estiver nervoso/agressivo.
- Você não entender a solicitação.
- O assunto for renegociação complexa ou fraude.
Ao usar [TRANSFERIR], o sistema irá pausar seu atendimento automaticamente.

════════════════════════════════════════════
⚙️ REGRAS GERAIS
════════════════════════════════════════════
1. Respostas curtas (máx 2 parágrafos).
2. Aguarde o cliente responder antes de continuar.
3. Português Brasil.
4. Sempre que finalizar um atendimento ou dúvida, envie o link: https://tubaraoemprestimo.com.br`,
    welcomeMessage: 'Olá! 👋 Sou o assistente virtual da TUBARÃO EMPRÉSTIMOS. Como posso ajudar você hoje?',
    fallbackMessage: 'Desculpe, não consegui processar sua mensagem. Um de nossos atendentes irá responder em breve. 🙏',
    transferKeywords: 'atendente,humano,pessoa,falar com alguém,operador',
    autoReplyEnabled: true,
    workingHoursOnly: false,
    workingHoursStart: '08:00',
    workingHoursEnd: '18:00',
    maxMessagesPerChat: 50
};

export const AIChatbot: React.FC = () => {
    const [config, setConfig] = useState<ChatbotConfig>(defaultConfig);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 'prompt' | 'test' | 'history'>('config');
    const [testMessage, setTestMessage] = useState('');
    const [testResponse, setTestResponse] = useState('');
    const [testing, setTesting] = useState(false);

    // History state
    const [conversations, setConversations] = useState<ConversationGroup[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [searchPhone, setSearchPhone] = useState('');
    const [expandedConversation, setExpandedConversation] = useState<string | null>(null);
    const [historyStats, setHistoryStats] = useState({ total: 0, today: 0, uniquePhones: 0 });

    const { addToast } = useToast();

    useEffect(() => {
        loadConfig();
    }, []);

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const data = await aiChatbotService.getConfig();
            setConfig({
                ...defaultConfig,
                ...data,
                geminiApiKey: data.geminiApiKey || '',
                perplexityApiKey: data.perplexityApiKey || ''
            });
        } catch (err) {
            console.error('Error loading config:', err);
        }
        setLoading(false);
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            // Fetch chat history via API
            const { data: historyData } = await api.get('/chatbot/history-all');

            // Group by phone
            const grouped: Record<string, ChatHistoryItem[]> = {};
            ((historyData as any[]) || []).forEach((item: ChatHistoryItem) => {
                if (!grouped[item.phone]) {
                    grouped[item.phone] = [];
                }
                grouped[item.phone].push(item);
            });

            // Convert to conversation groups
            const conversationList: ConversationGroup[] = Object.entries(grouped).map(([phone, messages]) => ({
                phone,
                messages: messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
                lastMessage: messages[0].message.substring(0, 50) + (messages[0].message.length > 50 ? '...' : ''),
                lastMessageTime: messages[0].created_at
            }));

            // Sort by last message time
            conversationList.sort((a, b) =>
                new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
            );

            setConversations(conversationList);

            // Calculate stats
            const allItems = (historyData as any[]) || [];
            const today = new Date().toDateString();
            const todayMessages = allItems.filter((m: ChatHistoryItem) =>
                new Date(m.created_at).toDateString() === today
            );

            setHistoryStats({
                total: allItems.length,
                today: todayMessages.length,
                uniquePhones: Object.keys(grouped).length
            });

        } catch (err) {
            console.error('Error loading history:', err);
            addToast('Erro ao carregar histórico', 'error');
        }
        setHistoryLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const success = await aiChatbotService.saveConfig(config);
            if (success) {
                addToast('Configurações salvas com sucesso!', 'success');
            } else {
                addToast('Erro ao salvar configurações', 'error');
            }
        } catch (err) {
            addToast('Erro ao salvar configurações', 'error');
        }
        setSaving(false);
    };

    const handleTest = async () => {
        if (!testMessage.trim()) {
            addToast('Digite uma mensagem para testar', 'warning');
            return;
        }

        setTesting(true);
        setTestResponse('Processando...');

        try {
            const messages = [{ role: 'user' as const, content: testMessage }];
            let response = '';
            const apiKey = config.provider === 'gemini' ? config.geminiApiKey : config.perplexityApiKey;

            console.log('[AI Test] Provider:', config.provider);
            console.log('[AI Test] Has API Key:', !!apiKey);

            if (!apiKey) {
                setTestResponse('❌ Chave de API não configurada. Atualize a página (F5) e verifique a aba Configurações.');
                setTesting(false);
                return;
            }

            if (config.provider === 'gemini') {
                response = await aiChatbotService.generateResponseGemini(
                    messages,
                    config.systemPrompt,
                    apiKey
                );
            } else if (config.provider === 'perplexity') {
                response = await aiChatbotService.generateResponsePerplexity(
                    messages,
                    config.systemPrompt,
                    apiKey
                );
            }

            console.log('[AI Test] Response:', response);
            setTestResponse(response || 'Sem resposta. Verifique o console (F12) para detalhes.');
        } catch (err) {
            console.error('[AI Test] Error:', err);
            setTestResponse('❌ Erro: ' + (err as Error).message);
        }
        setTesting(false);
    };

    const handleClearHistory = async (phone?: string) => {
        if (!confirm(phone ? `Apagar histórico do telefone ${phone}?` : 'Apagar TODO o histórico de conversas?')) {
            return;
        }

        try {
            const url = phone ? `/chatbot/history?phone=${encodeURIComponent(phone)}` : '/chatbot/history';
            const { error } = await api.delete(url);
            if (error) throw error;

            addToast('Histórico apagado com sucesso', 'success');
            loadHistory();
        } catch (err) {
            console.error('Error clearing history:', err);
            addToast('Erro ao apagar histórico', 'error');
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatPhone = (phone: string) => {
        const clean = phone.replace(/\D/g, '');
        if (clean.length === 13) {
            return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
        }
        if (clean.length === 11) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
        }
        return phone;
    };

    const filteredConversations = searchPhone
        ? conversations.filter(c => c.phone.includes(searchPhone.replace(/\D/g, '')))
        : conversations;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                        <Bot size={28} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Chatbot IA</h1>
                        <p className="text-zinc-400 text-sm">Configure o assistente virtual para atendimento automático</p>
                    </div>
                </div>
                <Button onClick={handleSave} isLoading={saving}>
                    <Save size={18} className="mr-2" /> Salvar Configurações
                </Button>
            </div>

            {/* Status Card */}
            <div className={`p-4 rounded-xl border ${config.enabled ? 'bg-green-900/20 border-green-500' : 'bg-zinc-800 border-zinc-700'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${config.enabled ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`}></div>
                        <span className="text-white font-medium">
                            Chatbot {config.enabled ? 'ATIVO' : 'DESATIVADO'}
                        </span>
                        {config.enabled && (
                            <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                                {config.provider === 'gemini' ? '🔷 Gemini' : '🟣 Perplexity'}
                            </span>
                        )}
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-zinc-800 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('config')}
                    className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'config' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-zinc-400 border-transparent hover:text-white'
                        }`}
                >
                    <Settings2 size={18} /> Configurações
                </button>
                <button
                    onClick={() => setActiveTab('prompt')}
                    className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'prompt' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-zinc-400 border-transparent hover:text-white'
                        }`}
                >
                    <Brain size={18} /> Treinamento (Prompt)
                </button>
                <button
                    onClick={() => setActiveTab('test')}
                    className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'test' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-zinc-400 border-transparent hover:text-white'
                        }`}
                >
                    <TestTube size={18} /> Testar IA
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'history' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-zinc-400 border-transparent hover:text-white'
                        }`}
                >
                    <History size={18} /> Histórico
                    {historyStats.total > 0 && (
                        <span className="bg-zinc-700 text-zinc-300 text-xs px-2 py-0.5 rounded-full">{historyStats.total}</span>
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                {activeTab === 'config' && (
                    <div className="space-y-6">
                        {/* Provider */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">Provedor de IA</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setConfig({ ...config, provider: 'gemini' })}
                                    className={`p-4 rounded-xl border-2 transition-all ${config.provider === 'gemini'
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-zinc-700 hover:border-zinc-600'
                                        }`}
                                >
                                    <div className="text-2xl mb-2">🔷</div>
                                    <div className="font-bold text-white">Google Gemini</div>
                                    <div className="text-xs text-zinc-400">Gratuito para uso moderado</div>
                                </button>
                                <button
                                    onClick={() => setConfig({ ...config, provider: 'perplexity' })}
                                    className={`p-4 rounded-xl border-2 transition-all ${config.provider === 'perplexity'
                                        ? 'border-purple-500 bg-purple-500/10'
                                        : 'border-zinc-700 hover:border-zinc-600'
                                        }`}
                                >
                                    <div className="text-2xl mb-2">🟣</div>
                                    <div className="font-bold text-white">Perplexity AI</div>
                                    <div className="text-xs text-zinc-400">Respostas com busca online</div>
                                </button>
                            </div>
                        </div>

                        {/* API Keys */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Chave API Gemini {config.provider === 'gemini' && <span className="text-green-400">(ativo)</span>}
                                </label>
                                <input
                                    type="password"
                                    value={config.geminiApiKey}
                                    onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    placeholder="AIzaSy..."
                                />
                                <a
                                    href="https://aistudio.google.com/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:underline mt-1 inline-flex items-center gap-1"
                                >
                                    <ExternalLink size={12} /> Obter chave gratuita
                                </a>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Chave API Perplexity {config.provider === 'perplexity' && <span className="text-green-400">(ativo)</span>}
                                </label>
                                <input
                                    type="password"
                                    value={config.perplexityApiKey}
                                    onChange={(e) => setConfig({ ...config, perplexityApiKey: e.target.value })}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    placeholder="pplx-..."
                                />
                                <a
                                    href="https://www.perplexity.ai/settings/api"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-purple-400 hover:underline mt-1 inline-flex items-center gap-1"
                                >
                                    <ExternalLink size={12} /> Obter chave API
                                </a>
                            </div>
                        </div>

                        {/* Messages */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">Mensagem de Boas-vindas</label>
                            <textarea
                                value={config.welcomeMessage}
                                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none h-20 resize-none"
                                placeholder="Olá! Como posso ajudar?"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">Mensagem de Fallback (quando IA falha)</label>
                            <textarea
                                value={config.fallbackMessage}
                                onChange={(e) => setConfig({ ...config, fallbackMessage: e.target.value })}
                                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none h-20 resize-none"
                                placeholder="Desculpe, não entendi..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">
                                Palavras para Transferir para Humano (separadas por vírgula)
                            </label>
                            <input
                                value={config.transferKeywords}
                                onChange={(e) => setConfig({ ...config, transferKeywords: e.target.value })}
                                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                placeholder="atendente, humano, pessoa"
                            />
                        </div>

                        {/* Working Hours */}
                        <div className="p-4 bg-zinc-800 rounded-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Clock size={18} className="text-zinc-400" />
                                    <span className="text-white font-medium">Responder apenas em horário comercial</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.workingHoursOnly}
                                        onChange={(e) => setConfig({ ...config, workingHoursOnly: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                                </label>
                            </div>
                            {config.workingHoursOnly && (
                                <div className="flex gap-4">
                                    <div>
                                        <label className="text-xs text-zinc-400">Início</label>
                                        <input
                                            type="time"
                                            value={config.workingHoursStart}
                                            onChange={(e) => setConfig({ ...config, workingHoursStart: e.target.value })}
                                            className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-400">Fim</label>
                                        <input
                                            type="time"
                                            value={config.workingHoursEnd}
                                            onChange={(e) => setConfig({ ...config, workingHoursEnd: e.target.value })}
                                            className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Auto Reply Toggle */}
                        <div className="p-4 bg-zinc-800 rounded-xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={18} className="text-zinc-400" />
                                    <span className="text-white font-medium">Resposta automática (WhatsApp)</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.autoReplyEnabled}
                                        onChange={(e) => setConfig({ ...config, autoReplyEnabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'prompt' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                            <Brain className="text-purple-400" size={20} />
                            <span className="text-purple-300 text-sm">
                                O prompt é a "personalidade" da IA. Aqui você define como ela deve se comportar e responder.
                            </span>
                        </div>

                        <label className="block text-sm font-medium text-zinc-400">System Prompt (Treinamento da IA)</label>
                        <textarea
                            value={config.systemPrompt}
                            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                            className="w-full bg-black border border-zinc-700 rounded-lg p-4 text-white focus:border-[#D4AF37] outline-none h-96 resize-none font-mono text-sm"
                            placeholder="Você é um assistente..."
                        />

                        <div className="p-4 bg-zinc-800 rounded-lg">
                            <h4 className="text-white font-medium mb-2">💡 Dicas para um bom prompt:</h4>
                            <ul className="text-zinc-400 text-sm space-y-1">
                                <li>• Defina claramente o papel da IA (ex: "Você é um assistente de empréstimos")</li>
                                <li>• Liste as funções que ela deve exercer</li>
                                <li>• Defina regras do que NÃO fazer (ex: "Nunca invente valores")</li>
                                <li>• Mencione o tom de voz desejado (formal, amigável, etc.)</li>
                                <li>• A IA terá acesso aos dados do cliente automaticamente</li>
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'test' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <TestTube className="text-blue-400" size={20} />
                            <span className="text-blue-300 text-sm">
                                Teste como a IA irá responder às mensagens dos clientes.
                            </span>
                        </div>

                        <div className="flex gap-2">
                            <input
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleTest()}
                                className="flex-1 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                placeholder="Digite uma mensagem para testar..."
                            />
                            <Button onClick={handleTest} isLoading={testing}>
                                <Send size={18} />
                            </Button>
                        </div>

                        {testResponse && (
                            <div className="p-4 bg-zinc-800 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                                        <Bot size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-zinc-400 mb-1">Resposta da IA:</div>
                                        <div className="text-white whitespace-pre-wrap">{testResponse}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setTestMessage('Qual é o valor da minha parcela?')}
                                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
                            >
                                💰 Valor da parcela
                            </button>
                            <button
                                onClick={() => setTestMessage('Quero negociar minha dívida')}
                                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
                            >
                                🤝 Negociar dívida
                            </button>
                            <button
                                onClick={() => setTestMessage('Como faço para pegar um empréstimo?')}
                                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
                            >
                                📋 Novo empréstimo
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-4">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-zinc-800 rounded-xl p-4">
                                <div className="text-2xl font-bold text-white">{historyStats.total}</div>
                                <div className="text-xs text-zinc-400">Mensagens totais</div>
                            </div>
                            <div className="bg-zinc-800 rounded-xl p-4">
                                <div className="text-2xl font-bold text-green-400">{historyStats.today}</div>
                                <div className="text-xs text-zinc-400">Mensagens hoje</div>
                            </div>
                            <div className="bg-zinc-800 rounded-xl p-4">
                                <div className="text-2xl font-bold text-blue-400">{historyStats.uniquePhones}</div>
                                <div className="text-xs text-zinc-400">Conversas únicas</div>
                            </div>
                        </div>

                        {/* Search and Actions */}
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    value={searchPhone}
                                    onChange={(e) => setSearchPhone(e.target.value)}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 pl-10 text-white focus:border-[#D4AF37] outline-none"
                                    placeholder="Buscar por telefone..."
                                />
                            </div>
                            <button
                                onClick={loadHistory}
                                className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                                title="Atualizar"
                            >
                                <RefreshCw size={18} className={`text-zinc-400 ${historyLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => handleClearHistory()}
                                className="p-3 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors text-red-400"
                                title="Limpar todo histórico"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>

                        {/* Conversations List */}
                        {historyLoading ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="text-center py-12 text-zinc-500">
                                <History size={40} className="mx-auto mb-3 opacity-50" />
                                <p>Nenhuma conversa encontrada</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {filteredConversations.map((conv) => (
                                    <div key={conv.phone} className="bg-zinc-800 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => setExpandedConversation(
                                                expandedConversation === conv.phone ? null : conv.phone
                                            )}
                                            className="w-full p-4 flex items-center justify-between hover:bg-zinc-700/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
                                                    <Phone size={18} className="text-zinc-400" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-white font-medium">{formatPhone(conv.phone)}</div>
                                                    <div className="text-xs text-zinc-400 flex items-center gap-2">
                                                        <Calendar size={12} />
                                                        {formatDate(conv.lastMessageTime)}
                                                        <span className="bg-zinc-700 px-1.5 py-0.5 rounded">
                                                            {conv.messages.length} msgs
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleClearHistory(conv.phone);
                                                    }}
                                                    className="p-2 hover:bg-red-900/30 rounded-lg text-red-400"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                {expandedConversation === conv.phone ? (
                                                    <ChevronUp size={18} className="text-zinc-400" />
                                                ) : (
                                                    <ChevronDown size={18} className="text-zinc-400" />
                                                )}
                                            </div>
                                        </button>

                                        {expandedConversation === conv.phone && (
                                            <div className="border-t border-zinc-700 p-4 bg-zinc-900/50 space-y-3 max-h-80 overflow-y-auto">
                                                {conv.messages.map((msg) => (
                                                    <div
                                                        key={msg.id}
                                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div
                                                            className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user'
                                                                ? 'bg-[#D4AF37] text-black rounded-tr-none'
                                                                : 'bg-zinc-800 text-gray-200 rounded-tl-none border border-zinc-700'
                                                                }`}
                                                        >
                                                            <div className="whitespace-pre-wrap">{msg.message}</div>
                                                            <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-black/60' : 'text-zinc-500'}`}>
                                                                {formatDate(msg.created_at)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
