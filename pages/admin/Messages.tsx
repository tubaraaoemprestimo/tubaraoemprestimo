// 📝 Templates & Mass Messaging - Gerenciamento de templates e disparo em massa
import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Edit2, Trash2, Send, Users, CheckCircle, Clock, XCircle, X, Copy, Filter, PlayCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { templateService, massMessageService, conversationService } from '../../services/adminService';
import { whatsappService } from '../../services/whatsappService';
import { supabaseService } from '../../services/supabaseService';
import { MessageTemplate, MassMessage, Customer } from '../../types';
import { useToast } from '../../components/Toast';

export const MessagesPage: React.FC = () => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'templates' | 'mass' | 'history'>('templates');
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [massMessages, setMassMessages] = useState<MassMessage[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMassModalOpen, setIsMassModalOpen] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<Partial<MessageTemplate>>({});
    const [massMessageData, setMassMessageData] = useState({
        templateId: '',
        customMessage: '',
        selectedCustomers: [] as string[],
        filterStatus: 'ALL'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const templatesData = await templateService.getAll();
        setTemplates(templatesData);
        setMassMessages(massMessageService.getAll());
        setCustomers(await supabaseService.getCustomers());
    };

    const handleSaveTemplate = async () => {
        if (!currentTemplate.name || !currentTemplate.content) {
            addToast('Preencha nome e conteúdo', 'warning');
            return;
        }

        if (currentTemplate.id) {
            await templateService.update(currentTemplate.id, currentTemplate);
            addToast('Template atualizado', 'success');
        } else {
            await templateService.save({
                name: currentTemplate.name,
                category: currentTemplate.category || 'CUSTOM',
                content: currentTemplate.content,
                isActive: true
            });
            addToast('Template criado', 'success');
        }
        setIsModalOpen(false);
        setCurrentTemplate({});
        loadData();
    };

    const handleDeleteTemplate = async (id: string) => {
        if (confirm('Excluir este template?')) {
            await templateService.delete(id);
            addToast('Template excluído', 'info');
            loadData();
        }
    };

    const handleSendMassMessage = async () => {
        if (massMessageData.selectedCustomers.length === 0) {
            addToast('Selecione pelo menos um destinatário', 'warning');
            return;
        }

        const message = massMessageData.templateId
            ? templates.find(t => t.id === massMessageData.templateId)?.content || ''
            : massMessageData.customMessage;

        if (!message) {
            addToast('Selecione um template ou digite uma mensagem', 'warning');
            return;
        }

        const mass = massMessageService.create(
            massMessageData.templateId || null,
            message,
            massMessageData.selectedCustomers
        );

        addToast(`Iniciando envio para ${massMessageData.selectedCustomers.length} destinatários...`, 'info');
        setIsMassModalOpen(false);

        // Simulate sending (in production, would use whatsappService)
        let sent = 0;
        let failed = 0;

        for (const customerId of massMessageData.selectedCustomers) {
            const customer = customers.find(c => c.id === customerId);
            if (customer) {
                try {
                    // Replace variables
                    let finalMessage = message
                        .replace('{nome}', customer.name)
                        .replace('{valor}', customer.totalDebt?.toLocaleString() || '0');

                    // In production: await whatsappService.sendText(customer.phone, finalMessage);

                    conversationService.add({
                        customerId: customer.id,
                        direction: 'OUT',
                        channel: 'WHATSAPP',
                        content: finalMessage,
                        sentBy: 'Sistema',
                        status: 'SENT'
                    });

                    sent++;
                } catch (e) {
                    failed++;
                }
            }
        }

        massMessageService.updateProgress(mass.id, sent, failed, 'COMPLETED');
        addToast(`Envio concluído: ${sent} enviados, ${failed} falhas`, sent > 0 ? 'success' : 'error');

        setMassMessageData({ templateId: '', customMessage: '', selectedCustomers: [], filterStatus: 'ALL' });
        loadData();
    };

    const filteredCustomers = customers.filter(c => {
        if (massMessageData.filterStatus === 'ALL') return true;
        if (massMessageData.filterStatus === 'ACTIVE') return c.status === 'ACTIVE';
        if (massMessageData.filterStatus === 'DEBT') return c.totalDebt > 0;
        return true;
    });

    const getCategoryColor = (category: MessageTemplate['category']) => {
        const colors: Record<MessageTemplate['category'], string> = {
            REMINDER: 'bg-yellow-900/50 text-yellow-400',
            COLLECTION: 'bg-red-900/50 text-red-400',
            WELCOME: 'bg-green-900/50 text-green-400',
            APPROVAL: 'bg-blue-900/50 text-blue-400',
            REJECTION: 'bg-zinc-800 text-zinc-400',
            PAYMENT: 'bg-purple-900/50 text-purple-400',
            CUSTOM: 'bg-[#D4AF37]/20 text-[#D4AF37]'
        };
        return colors[category];
    };

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                    <MessageSquare size={32} /> Central de Mensagens
                </h1>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setIsMassModalOpen(true)}>
                        <Send size={18} /> Disparo em Massa
                    </Button>
                    <Button onClick={() => { setCurrentTemplate({}); setIsModalOpen(true); }}>
                        <Plus size={18} /> Novo Template
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 bg-zinc-900/50 p-1 rounded-xl w-fit border border-zinc-800">
                {(['templates', 'mass', 'history'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-[#D4AF37] text-black' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        {tab === 'templates' ? 'Templates' : tab === 'mass' ? 'Disparos' : 'Histórico'}
                    </button>
                ))}
            </div>

            {activeTab === 'templates' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(template => (
                        <div key={template.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-[#D4AF37]/50 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(template.category)}`}>
                                        {template.category}
                                    </span>
                                    <h3 className="font-bold text-white mt-2">{template.name}</h3>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => { setCurrentTemplate(template); setIsModalOpen(true); }}
                                        className="p-2 hover:bg-zinc-800 rounded-lg"
                                    >
                                        <Edit2 size={16} className="text-zinc-400" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTemplate(template.id)}
                                        className="p-2 hover:bg-red-900/50 rounded-lg"
                                    >
                                        <Trash2 size={16} className="text-zinc-400" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-zinc-400 text-sm mb-4 line-clamp-3">{template.content}</p>
                            <div className="flex flex-wrap gap-1">
                                {template.variables.map(v => (
                                    <span key={v} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded font-mono">{v}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'mass' && (
                <div className="space-y-4">
                    {massMessages.length === 0 ? (
                        <div className="text-center py-12 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500">
                            <Send size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Nenhum disparo em massa realizado</p>
                        </div>
                    ) : (
                        massMessages.map(msg => (
                            <div key={msg.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        {msg.status === 'COMPLETED' ? (
                                            <CheckCircle className="text-green-400" size={24} />
                                        ) : msg.status === 'FAILED' ? (
                                            <XCircle className="text-red-400" size={24} />
                                        ) : (
                                            <Clock className="text-yellow-400 animate-spin" size={24} />
                                        )}
                                        <div>
                                            <p className="font-bold text-white">{msg.recipients.length} destinatários</p>
                                            <p className="text-sm text-zinc-500">
                                                {new Date(msg.createdAt).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-green-400">{msg.sentCount} enviados</p>
                                        {msg.failedCount > 0 && <p className="text-red-400">{msg.failedCount} falhas</p>}
                                    </div>
                                </div>
                                <p className="text-zinc-400 text-sm bg-black p-3 rounded-lg">{msg.message.substring(0, 200)}...</p>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <p className="text-center text-zinc-500 py-8">
                        Histórico de conversas disponível na página de cada cliente
                    </p>
                </div>
            )}

            {/* Template Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[#D4AF37]">
                                {currentTemplate.id ? 'Editar Template' : 'Novo Template'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Nome</label>
                                <input
                                    value={currentTemplate.name || ''}
                                    onChange={(e) => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Categoria</label>
                                <select
                                    value={currentTemplate.category || 'CUSTOM'}
                                    onChange={(e) => setCurrentTemplate({ ...currentTemplate, category: e.target.value as any })}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                >
                                    <option value="REMINDER">Lembrete</option>
                                    <option value="COLLECTION">Cobrança</option>
                                    <option value="WELCOME">Boas-vindas</option>
                                    <option value="APPROVAL">Aprovação</option>
                                    <option value="REJECTION">Rejeição</option>
                                    <option value="PAYMENT">Pagamento</option>
                                    <option value="CUSTOM">Personalizado</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Conteúdo</label>
                                <textarea
                                    value={currentTemplate.content || ''}
                                    onChange={(e) => setCurrentTemplate({ ...currentTemplate, content: e.target.value })}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none h-32 resize-none"
                                    placeholder="Use {nome}, {valor}, {vencimento} como variáveis..."
                                />
                            </div>
                            <Button onClick={handleSaveTemplate} className="w-full">Salvar Template</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mass Message Modal */}
            {isMassModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[#D4AF37]">Disparo em Massa</h2>
                            <button onClick={() => setIsMassModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Usar Template</label>
                                <select
                                    value={massMessageData.templateId}
                                    onChange={(e) => setMassMessageData({ ...massMessageData, templateId: e.target.value, customMessage: '' })}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                >
                                    <option value="">Mensagem Personalizada</option>
                                    {templates.filter(t => t.isActive).map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {!massMessageData.templateId && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Mensagem Personalizada</label>
                                    <textarea
                                        value={massMessageData.customMessage}
                                        onChange={(e) => setMassMessageData({ ...massMessageData, customMessage: e.target.value })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none h-32 resize-none"
                                    />
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-zinc-400">Destinatários</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={massMessageData.filterStatus}
                                            onChange={(e) => setMassMessageData({ ...massMessageData, filterStatus: e.target.value })}
                                            className="bg-black border border-zinc-700 rounded-lg px-3 py-1 text-sm text-white"
                                        >
                                            <option value="ALL">Todos</option>
                                            <option value="ACTIVE">Ativos</option>
                                            <option value="DEBT">Com Dívida</option>
                                        </select>
                                        <button
                                            onClick={() => setMassMessageData({
                                                ...massMessageData,
                                                selectedCustomers: massMessageData.selectedCustomers.length === filteredCustomers.length
                                                    ? []
                                                    : filteredCustomers.map(c => c.id)
                                            })}
                                            className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1 rounded-lg hover:bg-zinc-700"
                                        >
                                            {massMessageData.selectedCustomers.length === filteredCustomers.length ? 'Desmarcar' : 'Selecionar'} Todos
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-black border border-zinc-700 rounded-lg max-h-48 overflow-y-auto">
                                    {filteredCustomers.map(customer => (
                                        <label
                                            key={customer.id}
                                            className="flex items-center gap-3 p-3 hover:bg-zinc-900 cursor-pointer border-b border-zinc-800 last:border-0"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={massMessageData.selectedCustomers.includes(customer.id)}
                                                onChange={(e) => {
                                                    setMassMessageData({
                                                        ...massMessageData,
                                                        selectedCustomers: e.target.checked
                                                            ? [...massMessageData.selectedCustomers, customer.id]
                                                            : massMessageData.selectedCustomers.filter(id => id !== customer.id)
                                                    });
                                                }}
                                                className="w-4 h-4 accent-[#D4AF37]"
                                            />
                                            <div className="flex-1">
                                                <p className="text-white text-sm">{customer.name}</p>
                                                <p className="text-xs text-zinc-500">{customer.phone}</p>
                                            </div>
                                            {customer.totalDebt > 0 && (
                                                <span className="text-xs text-red-400">R$ {customer.totalDebt.toLocaleString()}</span>
                                            )}
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-zinc-500 mt-2">
                                    {massMessageData.selectedCustomers.length} selecionado(s)
                                </p>
                            </div>

                            <Button onClick={handleSendMassMessage} className="w-full">
                                <PlayCircle size={18} /> Enviar para {massMessageData.selectedCustomers.length} destinatário(s)
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
