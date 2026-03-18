// 📨 Central de Comunicação - Mensagens, Marketing, Status e Indicações Unificados
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    MessageSquare, Megaphone, Camera, Gift, Send, Plus, Trash2,
    Search, Filter, Users, Clock, CheckCircle, Edit2, X, Save,
    Image as ImageIcon, Repeat, RefreshCw, Phone, Mail, Percent,
    Play, AlertCircle, ChevronDown, ChevronUp, Eye, DollarSign, UserPlus
} from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../services/apiClient';
import { apiService } from '../../services/apiService';
import { whatsappService } from '../../services/whatsappService';
import { useToast } from '../../components/Toast';
import { AIGenerateCaption } from '../../components/AIGenerateCaption';
import { ImageUpload } from '../../components/ImageUpload';
import { MessageTemplate, Campaign, Customer, Referral } from '../../types';

type TabType = 'templates' | 'campaigns' | 'status' | 'referrals';

interface ScheduledStatus {
    id: string;
    image_url: string;
    caption: string | null;
    scheduled_at: string;
    status: 'PENDING' | 'POSTED' | 'FAILED';
    error_message: string | null;
    created_at: string;
}

interface Coupon {
    id: string;
    code: string;
    discount_percent: number;
    valid_until: string;
    usage_limit: number;
    times_used: number;
    active: boolean;
    description?: string;
    partner_name?: string;
    image_url?: string;
    partner_logo?: string;
}

const inputStyle = "w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none transition-colors";

export const CommunicationHub: React.FC = () => {
    const { addToast } = useToast();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>('templates');
    const [loading, setLoading] = useState(true);

    // Templates
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<Partial<MessageTemplate>>({});

    // Campaigns
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [coupons, setCoupons] = useState<Coupon[]>([]);

    // Status
    const [scheduledStatus, setScheduledStatus] = useState<ScheduledStatus[]>([]);

    // Referrals
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [bonusValue, setBonusValue] = useState(50);

    // Customers
    const [customers, setCustomers] = useState<Customer[]>([]);

// Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  
  // Editing states
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign>>({});
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon>>({ discount_percent: 10, usage_limit: 100, active: true });
  const [newStatus, setNewStatus] = useState({
    imageUrl: '',
    caption: '',
    scheduledAt: '',
    recurrenceType: 'once' as 'once' | 'daily' | 'weekly' | 'monthly',
    recurrenceCount: 1
  });

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Read tab from URL on mount and when URL changes
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'templates' || tabParam === 'campaigns' || tabParam === 'status' || tabParam === 'referrals') {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const customersData = await apiService.getCustomers();
            setCustomers(customersData);

            // Templates via API
            const { data: templatesData } = await api.get('/communication/templates');
            if (templatesData) setTemplates(templatesData as any[]);

            // Campaigns via API
            const { data: campaignsData } = await api.get('/campaigns');
            if (campaignsData) setCampaigns(campaignsData as any[]);

            // Coupons via API
            const { data: couponsData } = await api.get('/communication/coupons');
            if (couponsData) setCoupons(couponsData as any[]);

            // Status via API
            const { data: statusData } = await api.get('/communication/scheduled-status');
            if (statusData) setScheduledStatus(statusData as any[]);

            // Referrals via API
            const { data: referralsData } = await api.get('/referrals');
            if (referralsData) setReferrals(referralsData as any[]);

            // Bonus config via API
            const { data: configData } = await api.get('/communication/referral-bonus');
            if (configData) setBonusValue(parseFloat((configData as any).value) || 50);

        } catch (error) {
            console.error('Error loading data:', error);
        }
        setLoading(false);
    };

    // Template handlers
    const handleSaveTemplate = async () => {
        if (!editingTemplate.name || !editingTemplate.content) {
            addToast('Preencha nome e conteúdo', 'warning');
            return;
        }

        try {
            if (editingTemplate.id) {
                await api.put(`/communication/templates/${editingTemplate.id}`, editingTemplate);
            } else {
                await api.post('/communication/templates', editingTemplate);
            }
            addToast('Template salvo!', 'success');
            setIsTemplateModalOpen(false);
            setEditingTemplate({});
            loadAllData();
        } catch {
            addToast('Erro ao salvar template', 'error');
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        
        await api.delete(`/communication/templates/${id}`);
        addToast('Template excluído', 'success');
        loadAllData();
    };

    // Status handlers
    const handleDeleteStatus = async (id: string) => {
        
        await api.delete(`/communication/scheduled-status/${id}`);
        addToast('Agendamento excluído', 'success');
        loadAllData();
    };

    const handlePostStatusNow = async (id: string) => {
        const { error } = await api.post(`/whatsapp/post-now/${id}`, {});
        if (!error) {
            addToast('Status postado via Evolution API!', 'success');
            loadAllData();
        } else {
            addToast('Erro ao postar status', 'error');
        }
    };

    const handleScheduleStatus = async () => {
        if (!newStatus.imageUrl) {
            addToast('Adicione uma imagem', 'warning');
            return;
        }
        try {
            const baseDate = newStatus.scheduledAt ? new Date(newStatus.scheduledAt) : new Date();

            // Single schedule (no recurrence)
            if (newStatus.recurrenceType === 'once' || newStatus.recurrenceCount <= 1) {
                const { error } = await api.post('/whatsapp/schedule-status', {
                    imageUrl: newStatus.imageUrl,
                    caption: newStatus.caption || null,
                    scheduledAt: newStatus.scheduledAt || new Date().toISOString(),
                });
                if (error) throw new Error();
                addToast('Status agendado!', 'success');
            } else {
                // Build bulk records with recurrence intervals
                const records = [];
                for (let i = 0; i < newStatus.recurrenceCount; i++) {
                    const scheduledDate = new Date(baseDate);
                    if (newStatus.recurrenceType === 'daily') {
                        scheduledDate.setDate(scheduledDate.getDate() + i);
                    } else if (newStatus.recurrenceType === 'weekly') {
                        scheduledDate.setDate(scheduledDate.getDate() + (i * 7));
                    } else if (newStatus.recurrenceType === 'monthly') {
                        scheduledDate.setMonth(scheduledDate.getMonth() + i);
                    }
                    records.push({
                        imageUrl: newStatus.imageUrl,
                        caption: newStatus.caption || null,
                        scheduledAt: scheduledDate.toISOString(),
                    });
                }
                const { error } = await api.post('/whatsapp/schedule-bulk', { records });
                if (error) throw new Error();
                addToast(`${records.length} status agendados com recorrência!`, 'success');
            }

            setIsStatusModalOpen(false);
            setNewStatus({ imageUrl: '', caption: '', scheduledAt: '', recurrenceType: 'once', recurrenceCount: 1 });
            loadAllData();
        } catch {
            addToast('Erro ao agendar status', 'error');
        }
    };

    // Referral handlers
    const handleApproveReferral = async (referral: Referral) => {
        await api.put(`/referrals/${referral.id}`, { status: 'APPROVED', approved_at: new Date().toISOString() });
        addToast('Indicação aprovada!', 'success');
        loadAllData();
    };

    const handleRejectReferral = async (referral: Referral) => {
        await api.put(`/referrals/${referral.id}`, { status: 'REJECTED' });
        addToast('Indicação rejeitada', 'info');
        loadAllData();
    };

    const handlePayBonus = async (referral: Referral) => {
        await api.put(`/referrals/${referral.id}`, { status: 'PAID', paid_at: new Date().toISOString() });
        addToast(`Bônus de R$ ${bonusValue} pago!`, 'success');
        loadAllData();
    };

// Send campaign
  const handleSendCampaign = async (campaign: Campaign) => {
    const activeCustomers = customers.filter(c => c.phone);
    if (activeCustomers.length === 0) {
      addToast('Nenhum cliente com telefone', 'warning');
      return;
    }

    for (const customer of activeCustomers.slice(0, 10)) {
      await whatsappService.sendMessage(customer.phone, campaign.description);
    }
    addToast(`Campanha enviada para ${Math.min(activeCustomers.length, 10)} clientes`, 'success');
  };

  // Campaign handlers
  const handleSaveCampaign = async () => {
    if (!editingCampaign.name || !editingCampaign.description) {
      addToast('Preencha nome e descrição', 'warning');
      return;
    }

    try {
      if (editingCampaign.id) {
        await api.put(`/campaigns/${editingCampaign.id}`, editingCampaign);
      } else {
        await api.post('/campaigns', editingCampaign);
      }
      addToast('Campanha salva!', 'success');
      setIsCampaignModalOpen(false);
      setEditingCampaign({});
      loadAllData();
    } catch {
      addToast('Erro ao salvar campanha', 'error');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    
    try {
      await api.delete(`/campaigns/${id}`);
      addToast('Campanha excluída', 'success');
      loadAllData();
    } catch {
      addToast('Erro ao excluir campanha', 'error');
    }
  };

  // Coupon handlers
  const handleSaveCoupon = async () => {
    if (!editingCoupon.code || !editingCoupon.discount_percent) {
      addToast('Preencha código e desconto', 'warning');
      return;
    }

    try {
      if (editingCoupon.id) {
        await api.put(`/communication/coupons/${editingCoupon.id}`, editingCoupon);
      } else {
        await api.post('/communication/coupons', editingCoupon);
      }
      addToast('Cupom salvo!', 'success');
      setIsCouponModalOpen(false);
      setEditingCoupon({ discount_percent: 10, usage_limit: 100, active: true });
      loadAllData();
    } catch {
      addToast('Erro ao salvar cupom', 'error');
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    
    try {
      await api.delete(`/communication/coupons/${id}`);
      addToast('Cupom excluído', 'success');
      loadAllData();
    } catch {
      addToast('Erro ao excluir cupom', 'error');
    }
  };

  // Stats
    const stats = {
        totalTemplates: templates.length,
        activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
        pendingStatus: scheduledStatus.filter(s => s.status === 'PENDING').length,
        pendingReferrals: referrals.filter(r => r.status === 'PENDING').length,
        totalReferrals: referrals.length,
        paidBonuses: referrals.filter(r => r.status === 'PAID').length * bonusValue
    };

    const tabs = [
        { id: 'templates', label: 'Templates', icon: <MessageSquare size={18} />, count: templates.length },
        { id: 'campaigns', label: 'Campanhas', icon: <Megaphone size={18} />, count: campaigns.length },
        { id: 'status', label: 'Status WhatsApp', icon: <Camera size={18} />, count: stats.pendingStatus },
        { id: 'referrals', label: 'Indicações', icon: <Gift size={18} />, count: stats.pendingReferrals },
    ] as const;

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'COBRANCA': return 'bg-red-900/30 text-red-400';
            case 'MARKETING': return 'bg-blue-900/30 text-blue-400';
            case 'ATENDIMENTO': return 'bg-green-900/30 text-green-400';
            case 'SISTEMA': return 'bg-purple-900/30 text-purple-400';
            default: return 'bg-zinc-800 text-zinc-400';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-900/30 text-yellow-400"><Clock size={12} /> Pendente</span>;
            case 'POSTED': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-900/30 text-green-400"><CheckCircle size={12} /> Postado</span>;
            case 'FAILED': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-900/30 text-red-400"><AlertCircle size={12} /> Falhou</span>;
            case 'APPROVED': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-900/30 text-green-400"><CheckCircle size={12} /> Aprovada</span>;
            case 'REJECTED': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-900/30 text-red-400"><X size={12} /> Rejeitada</span>;
            case 'PAID': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[#D4AF37]/20 text-[#D4AF37]"><DollarSign size={12} /> Pago</span>;
            default: return null;
        }
    };

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                        <Megaphone size={32} /> Central de Comunicação
                    </h1>
                    <p className="text-zinc-500 mt-1">Templates, Campanhas, Status WhatsApp e Indicações</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={loadAllData}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={16} className="text-blue-400" />
                        <span className="text-zinc-400 text-sm">Templates</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.totalTemplates}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Megaphone size={16} className="text-green-400" />
                        <span className="text-zinc-400 text-sm">Campanhas Ativas</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.activeCampaigns}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Camera size={16} className="text-purple-400" />
                        <span className="text-zinc-400 text-sm">Status Agendados</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.pendingStatus}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Gift size={16} className="text-[#D4AF37]" />
                        <span className="text-zinc-400 text-sm">Bônus Pagos</span>
                    </div>
                    <p className="text-2xl font-bold text-[#D4AF37]">R$ {stats.paidBonuses.toLocaleString()}</p>
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
                        {tab.count > 0 && (
                            <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${activeTab === tab.id ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-300'}`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Templates Tab */}
            {activeTab === 'templates' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Buscar templates..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none"
                            />
                        </div>
                        <Button onClick={() => { setEditingTemplate({}); setIsTemplateModalOpen(true); }}>
                            <Plus size={18} /> Novo Template
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {templates.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map(template => (
                            <div key={template.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-[#D4AF37]/50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-white">{template.name}</h3>
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${getCategoryColor(template.category)}`}>
                                            {template.category}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => { setEditingTemplate(template); setIsTemplateModalOpen(true); }}
                                            className="p-1.5 bg-zinc-800 rounded hover:bg-zinc-700"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTemplate(template.id)}
                                            className="p-1.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-zinc-400 text-sm line-clamp-3">{template.content}</p>
                            </div>
                        ))}
                        {templates.length === 0 && (
                            <div className="col-span-full text-center py-12 text-zinc-500">
                                <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Nenhum template criado</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Campaigns Tab */}
            {activeTab === 'campaigns' && (
                <div className="space-y-6">
<div className="flex justify-between items-center">
        <p className="text-zinc-400">Gerencie campanhas e cupons</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setEditingCoupon({ discount_percent: 10, usage_limit: 100, active: true }); setIsCouponModalOpen(true); }}>
            <Plus size={18} /> Novo Cupom
          </Button>
          <Button onClick={() => { setEditingCampaign({ status: 'ACTIVE' }); setIsCampaignModalOpen(true); }}>
            <Plus size={18} /> Nova Campanha
          </Button>
        </div>
      </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {campaigns.map(campaign => (
                            <div key={campaign.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{campaign.name}</h3>
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${campaign.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-400'
                                            }`}>
                                            {campaign.status}
                                        </span>
                                    </div>
                                    {campaign.image_url && (
                                        <img src={campaign.image_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                                    )}
                                </div>
<p className="text-zinc-400 text-sm mb-4">{campaign.description}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleSendCampaign(campaign)}>
                  <Send size={14} /> Disparar
                </Button>
                <button
                  onClick={() => { setEditingCampaign(campaign); setIsCampaignModalOpen(true); }}
                  className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDeleteCampaign(campaign.id)}
                  className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
                            </div>
                        ))}
                        {campaigns.length === 0 && (
                            <div className="col-span-full text-center py-12 text-zinc-500">
                                <Megaphone size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Nenhuma campanha criada</p>
                            </div>
                        )}
                    </div>

                    {/* Cupons */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Percent size={20} className="text-[#D4AF37]" /> Cupons de Desconto
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {coupons.map(coupon => (
                                <div key={coupon.id} className={`bg-black border rounded-lg overflow-hidden ${coupon.active ? 'border-green-500/30' : 'border-zinc-700'}`}>
                                    {coupon.image_url && (
                                        <img src={coupon.image_url} className="w-full h-32 object-cover" alt={coupon.partner_name || 'Cupom'} />
                                    )}
                                    <div className="p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-mono font-bold text-[#D4AF37] text-lg">{coupon.code}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${coupon.active ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                                {coupon.active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </div>
                                        <p className="text-white font-bold text-2xl">{coupon.discount_percent}% OFF</p>
                                        {coupon.partner_name && (
                                            <p className="text-sm text-zinc-300 mt-1 flex items-center gap-1">
                                                <UserPlus size={12} className="text-[#D4AF37]" /> {coupon.partner_name}
                                            </p>
                                        )}
                                        {coupon.description && (
                                            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{coupon.description}</p>
                                        )}
                                        <p className="text-xs text-zinc-500 mt-1">
                                            Usado {coupon.times_used}/{coupon.usage_limit} vezes
                                        </p>
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => { setEditingCoupon(coupon); setIsCouponModalOpen(true); }}
                                                className="p-1.5 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCoupon(coupon.id)}
                                                className="p-1.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Status WhatsApp Tab */}
            {activeTab === 'status' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <p className="text-zinc-400">Agende fotos para seu status do WhatsApp</p>
                        <Button onClick={() => setIsStatusModalOpen(true)}>
                            <Plus size={18} /> Agendar Status
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {scheduledStatus.map(status => (
                            <div key={status.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                                <div className="aspect-video bg-black">
                                    <img src={status.image_url} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        {getStatusBadge(status.status)}
                                        <span className="text-xs text-zinc-500">
                                            {new Date(status.scheduled_at).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                    {status.caption && (
                                        <p className="text-zinc-400 text-sm line-clamp-2">{status.caption}</p>
                                    )}
                                    {status.error_message && (
                                        <p className="text-red-400 text-xs mt-2">{status.error_message}</p>
                                    )}
                                    <div className="flex gap-2 mt-3">
                                        {status.status === 'PENDING' && (
                                            <Button size="sm" variant="secondary" onClick={() => handlePostStatusNow(status.id)}>
                                                <Play size={14} /> Postar Agora
                                            </Button>
                                        )}
                                        <Button size="sm" variant="danger" onClick={() => handleDeleteStatus(status.id)}>
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {scheduledStatus.length === 0 && (
                            <div className="col-span-full text-center py-12 text-zinc-500">
                                <Camera size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Nenhum status agendado</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Referrals Tab */}
            {activeTab === 'referrals' && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-zinc-400 text-sm">Total Indicações</p>
                            <p className="text-2xl font-bold text-white">{referrals.length}</p>
                        </div>
                        <div className="bg-zinc-900 border border-yellow-500/30 rounded-xl p-4">
                            <p className="text-zinc-400 text-sm">Pendentes</p>
                            <p className="text-2xl font-bold text-yellow-400">{referrals.filter(r => r.status === 'PENDING').length}</p>
                        </div>
                        <div className="bg-zinc-900 border border-green-500/30 rounded-xl p-4">
                            <p className="text-zinc-400 text-sm">Aprovadas</p>
                            <p className="text-2xl font-bold text-green-400">{referrals.filter(r => r.status === 'APPROVED').length}</p>
                        </div>
                        <div className="bg-zinc-900 border border-[#D4AF37]/30 rounded-xl p-4">
                            <p className="text-zinc-400 text-sm">Bônus: R$ {bonusValue}</p>
                            <p className="text-2xl font-bold text-[#D4AF37]">
                                R$ {(referrals.filter(r => r.status === 'PAID').length * bonusValue).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* List */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-zinc-950 border-b border-zinc-800">
                                <tr>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Quem Indicou</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Indicado</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Data</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Status</th>
                                    <th className="text-right p-4 text-zinc-400 text-sm">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {referrals.map(referral => (
                                    <tr key={referral.id} className="hover:bg-zinc-800/30">
                                        <td className="p-4">
                                            <p className="font-bold text-white">{referral.referrerName}</p>
                                            <p className="text-xs text-zinc-500">{referral.referrerPhone}</p>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-bold text-white">{referral.referredName}</p>
                                            <p className="text-xs text-zinc-500">{referral.referredPhone}</p>
                                        </td>
                                        <td className="p-4 text-zinc-400">
                                            {new Date(referral.createdAt).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="p-4">
                                            {getStatusBadge(referral.status)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {referral.status === 'PENDING' && (
                                                    <>
                                                        <Button size="sm" className="bg-green-600" onClick={() => handleApproveReferral(referral)}>
                                                            <CheckCircle size={14} />
                                                        </Button>
                                                        <Button size="sm" variant="danger" onClick={() => handleRejectReferral(referral)}>
                                                            <X size={14} />
                                                        </Button>
                                                    </>
                                                )}
                                                {referral.status === 'APPROVED' && (
                                                    <Button size="sm" className="bg-[#D4AF37] text-black" onClick={() => handlePayBonus(referral)}>
                                                        <DollarSign size={14} /> Pagar R${bonusValue}
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {referrals.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-zinc-500">
                                            <Gift size={48} className="mx-auto mb-4 opacity-50" />
                                            <p>Nenhuma indicação registrada</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Template Modal */}
            {isTemplateModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-zinc-900 p-6 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">{editingTemplate.id ? 'Editar Template' : 'Novo Template'}</h3>
                            <button onClick={() => setIsTemplateModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={editingTemplate.name || ''}
                                    onChange={e => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                                    className={inputStyle}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Categoria</label>
                                <select
                                    value={editingTemplate.category || 'ATENDIMENTO'}
                                    onChange={e => setEditingTemplate(prev => ({ ...prev, category: e.target.value as any }))}
                                    className={inputStyle}
                                >
                                    <option value="COBRANCA">Cobrança</option>
                                    <option value="MARKETING">Marketing</option>
                                    <option value="ATENDIMENTO">Atendimento</option>
                                    <option value="SISTEMA">Sistema</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Conteúdo</label>
                                <textarea
                                    value={editingTemplate.content || ''}
                                    onChange={e => setEditingTemplate(prev => ({ ...prev, content: e.target.value }))}
                                    className={`${inputStyle} h-40 resize-none`}
                                    placeholder="Use {nome}, {valor}, etc. para variáveis"
                                />
</div>
      <Button onClick={handleSaveTemplate} className="w-full">
        <Save size={18} /> Salvar Template
      </Button>
    </div>
  </div>
</div>
)}

{/* Campaign Modal */}
{isCampaignModalOpen && (
<div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
    <div className="sticky top-0 bg-zinc-900 p-6 border-b border-zinc-800 flex justify-between items-center">
      <h3 className="text-xl font-bold text-white">{editingCampaign.id ? 'Editar Campanha' : 'Nova Campanha'}</h3>
      <button onClick={() => setIsCampaignModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
    </div>
    <div className="p-6 space-y-4">
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Nome</label>
        <input
          type="text"
          value={editingCampaign.name || ''}
          onChange={e => setEditingCampaign(prev => ({ ...prev, name: e.target.value }))}
          className={inputStyle}
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Descrição</label>
        <textarea
          value={editingCampaign.description || ''}
          onChange={e => setEditingCampaign(prev => ({ ...prev, description: e.target.value }))}
          className={`${inputStyle} h-32 resize-none`}
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">URL da Imagem (opcional)</label>
        <input
          type="text"
          value={editingCampaign.image_url || ''}
          onChange={e => setEditingCampaign(prev => ({ ...prev, image_url: e.target.value }))}
          className={inputStyle}
          placeholder="https://..."
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Link (opcional)</label>
        <input
          type="text"
          value={editingCampaign.link || ''}
          onChange={e => setEditingCampaign(prev => ({ ...prev, link: e.target.value }))}
          className={inputStyle}
          placeholder="https://..."
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Status</label>
        <select
          value={editingCampaign.status || 'ACTIVE'}
          onChange={e => setEditingCampaign(prev => ({ ...prev, status: e.target.value as any }))}
          className={inputStyle}
        >
          <option value="ACTIVE">Ativa</option>
          <option value="INACTIVE">Inativa</option>
        </select>
      </div>
      <Button onClick={handleSaveCampaign} className="w-full">
        <Save size={18} /> Salvar Campanha
      </Button>
    </div>
  </div>
</div>
)}

{/* Coupon Modal */}
{isCouponModalOpen && (
<div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
    <div className="sticky top-0 bg-zinc-900 p-6 border-b border-zinc-800 flex justify-between items-center">
      <h3 className="text-xl font-bold text-white">{editingCoupon.id ? 'Editar Cupom' : 'Novo Cupom'}</h3>
      <button onClick={() => setIsCouponModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
    </div>
    <div className="p-6 space-y-4">
      <ImageUpload
        label="Imagem do Cupom"
        subtitle="Imagem promocional do parceiro (opcional)"
        imageUrl={editingCoupon.image_url}
        onUpload={(url) => setEditingCoupon(prev => ({ ...prev, image_url: url }))}
        onRemove={() => setEditingCoupon(prev => ({ ...prev, image_url: undefined }))}
        aspectRatio="16:9"
      />
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Código</label>
        <input
          type="text"
          value={editingCoupon.code || ''}
          onChange={e => setEditingCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
          className={inputStyle}
          placeholder="TUBARAO10"
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Desconto (%)</label>
        <input
          type="number"
          min="1"
          max="100"
          value={editingCoupon.discount_percent || ''}
          onChange={e => setEditingCoupon(prev => ({ ...prev, discount_percent: parseInt(e.target.value) }))}
          className={inputStyle}
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Parceiro</label>
        <input
          type="text"
          value={editingCoupon.partner_name || ''}
          onChange={e => setEditingCoupon(prev => ({ ...prev, partner_name: e.target.value }))}
          className={inputStyle}
          placeholder="Nome do parceiro (ex: iFood, Uber)"
        />
      </div>
      <ImageUpload
        label="Logo do Parceiro"
        subtitle="Logo pequeno do parceiro (opcional)"
        imageUrl={editingCoupon.partner_logo}
        onUpload={(url) => setEditingCoupon(prev => ({ ...prev, partner_logo: url }))}
        onRemove={() => setEditingCoupon(prev => ({ ...prev, partner_logo: undefined }))}
        aspectRatio="1:1"
        maxSize={5}
      />
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Descrição</label>
        <textarea
          value={editingCoupon.description || ''}
          onChange={e => setEditingCoupon(prev => ({ ...prev, description: e.target.value }))}
          className={`${inputStyle} h-24 resize-none`}
          placeholder="Texto de marketing ou informações do parceiro"
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Limite de Uso</label>
        <input
          type="number"
          min="1"
          value={editingCoupon.usage_limit || ''}
          onChange={e => setEditingCoupon(prev => ({ ...prev, usage_limit: parseInt(e.target.value) }))}
          className={inputStyle}
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Válido até</label>
        <input
          type="date"
          value={editingCoupon.valid_until || ''}
          onChange={e => setEditingCoupon(prev => ({ ...prev, valid_until: e.target.value }))}
          className={inputStyle}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="coupon-active"
          checked={editingCoupon.active || false}
          onChange={e => setEditingCoupon(prev => ({ ...prev, active: e.target.checked }))}
          className="w-4 h-4"
        />
        <label htmlFor="coupon-active" className="text-sm text-zinc-400">Ativo</label>
      </div>
      <Button onClick={handleSaveCoupon} className="w-full">
        <Save size={18} /> Salvar Cupom
      </Button>
    </div>
  </div>
</div>
)}

{/* Status Scheduling Modal */}
{isStatusModalOpen && (
<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-bold text-[#D4AF37]">Agendar Status WhatsApp</h3>
      <button onClick={() => setIsStatusModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
    </div>
    <div className="space-y-4">
      {/* Image Upload Component */}
      <ImageUpload
        label="Imagem do Status *"
        subtitle="Envie uma imagem ou vídeo para o status do WhatsApp"
        imageUrl={newStatus.imageUrl}
        onUpload={(url) => setNewStatus(p => ({ ...p, imageUrl: url }))}
        onRemove={() => setNewStatus(p => ({ ...p, imageUrl: '' }))}
        maxSize={10}
        aspectRatio="9:16"
      />

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Legenda</label>
        <textarea value={newStatus.caption} onChange={e => setNewStatus(p => ({ ...p, caption: e.target.value }))}
          placeholder="Texto do status..." rows={3} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm" />
      </div>

      {/* AI Caption Generator - visible when image is uploaded */}
      {newStatus.imageUrl && (
        <AIGenerateCaption
          imageBase64={newStatus.imageUrl}
          onCaptionGenerated={(caption) => setNewStatus(p => ({ ...p, caption }))}
        />
      )}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Data/Hora do Agendamento</label>
        <input type="datetime-local" value={newStatus.scheduledAt} onChange={e => setNewStatus(p => ({ ...p, scheduledAt: e.target.value }))}
          className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm" />
        <p className="text-xs text-zinc-600 mt-1">Deixe vazio para postar imediatamente</p>
      </div>
      {/* Recurrence scheduling */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">
          <Repeat size={14} className="inline mr-1" />
          Recorrência
        </label>
        <select
          value={newStatus.recurrenceType}
          onChange={e => setNewStatus(p => ({ ...p, recurrenceType: e.target.value as 'once' | 'daily' | 'weekly' | 'monthly' }))}
          className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm focus:border-[#D4AF37] outline-none transition-colors"
        >
          <option value="once">Apenas uma vez</option>
          <option value="daily">Diariamente</option>
          <option value="weekly">Semanalmente</option>
          <option value="monthly">Mensalmente</option>
        </select>
      </div>
      {newStatus.recurrenceType !== 'once' && (
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Repetir quantas vezes?</label>
          <input
            type="number"
            min="2"
            max="90"
            value={newStatus.recurrenceCount}
            onChange={e => setNewStatus(p => ({ ...p, recurrenceCount: Math.max(2, parseInt(e.target.value) || 2) }))}
            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm focus:border-[#D4AF37] outline-none transition-colors"
          />
          <p className="text-xs text-zinc-600 mt-1">
            {newStatus.recurrenceType === 'daily' && `Será postado por ${newStatus.recurrenceCount} dias consecutivos`}
            {newStatus.recurrenceType === 'weekly' && `Será postado por ${newStatus.recurrenceCount} semanas`}
            {newStatus.recurrenceType === 'monthly' && `Será postado por ${newStatus.recurrenceCount} meses`}
          </p>
        </div>
      )}
      <Button onClick={handleScheduleStatus} className="w-full">
        <Camera size={18} /> {newStatus.recurrenceType !== 'once' && newStatus.recurrenceCount > 1 ? `Agendar ${newStatus.recurrenceCount} Status` : 'Agendar Status'}
      </Button>
    </div>
  </div>
</div>
)}
</div>
);
};

export default CommunicationHub;
