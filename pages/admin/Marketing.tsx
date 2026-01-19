import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Edit2, Calendar, Link as LinkIcon, Image as ImageIcon, CheckCircle, XCircle, Search, Users, Gift, AlertTriangle, ShieldCheck, Ban, Send, Loader2, Ticket } from 'lucide-react';
import { Button } from '../../components/Button';
import { supabaseService } from '../../services/supabaseService';
import { referralService } from '../../services/referralService';
import { firebasePushService } from '../../services/firebasePushService';
import { emailService } from '../../services/emailService';
import { Campaign, ReferralUsage, Customer } from '../../types';
import { useToast } from '../../components/Toast';

const inputStyle = "w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none transition-colors";

export const Marketing: React.FC = () => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'campaigns' | 'referrals' | 'coupons'>('referrals');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [referrals, setReferrals] = useState<ReferralUsage[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Coupons State
    const [coupons, setCoupons] = useState<{ id: string; code: string; discount: number; description: string; customerEmail: string | null; active: boolean; expiresAt: string; createdAt: string }[]>([]);
    const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
    const [couponForm, setCouponForm] = useState({
        id: '',
        code: '',
        discount: 10,
        description: '',
        customerEmail: '',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        active: true
    });

    // Form State
    const [formData, setFormData] = useState<Partial<Campaign>>({
        title: '',
        description: '',
        imageUrl: '',
        link: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
        frequency: 'ONCE',
        active: true,
        priority: 1
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const campaignsData = await supabaseService.getCampaigns();
        const customersData = await supabaseService.getCustomers();
        setCampaigns(campaignsData);
        setCustomers(customersData);

        // Fetch referral usages
        const rawReferrals = await referralService.getAllUsages();

        // Run fraud check on pending referrals
        const checkedReferrals = rawReferrals.map(r => {
            if (r.status === 'PENDING') {
                const risks = referralService.checkFraudIndicators(r, customersData);
                if (risks.length > 0) {
                    return { ...r, status: 'FRAUD_SUSPECTED' as any, fraudReason: risks.join(', ') };
                }
            }
            return r;
        });

        setReferrals(checkedReferrals);

        // Fetch coupons
        const couponsData = await supabaseService.getCoupons();
        setCoupons(couponsData);
    };


    const handleValidation = async (id: string, action: 'VALIDATE' | 'REJECT' | 'FRAUD') => {
        referralService.validateUsage(id, action, action === 'FRAUD' ? 'Atividade suspeita detectada manualmente pelo admin' : undefined);
        addToast(`Indicação ${action === 'VALIDATE' ? 'validada' : action === 'FRAUD' ? 'marcada como fraude' : 'rejeitada'} com sucesso!`, action === 'VALIDATE' ? 'success' : 'warning');
        const updatedReferrals = await referralService.getAllUsages();
        setReferrals(updatedReferrals);
    };

    // Coupon Management Functions
    const handleSaveCoupon = async () => {
        if (!couponForm.code || couponForm.discount <= 0) {
            addToast("Código e desconto são obrigatórios.", 'warning');
            return;
        }

        setLoading(true);
        const success = await supabaseService.saveCoupon({
            id: couponForm.id || undefined,
            code: couponForm.code.toUpperCase(),
            discount: couponForm.discount,
            description: couponForm.description,
            customerEmail: couponForm.customerEmail || null,
            expiresAt: couponForm.expiresAt,
            active: couponForm.active
        });

        if (success) {
            addToast(couponForm.id ? "Cupom atualizado!" : "Cupom criado!", 'success');
            setIsCouponModalOpen(false);
            setCouponForm({ id: '', code: '', discount: 10, description: '', customerEmail: '', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], active: true });
            loadData();
        } else {
            addToast("Erro ao salvar cupom.", 'error');
        }
        setLoading(false);
    };

    const handleDeleteCoupon = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este cupom?")) {
            await supabaseService.deleteCoupon(id);
            addToast("Cupom excluído!", 'info');
            loadData();
        }
    };

    const handleEditCoupon = (coupon: typeof coupons[0]) => {
        setCouponForm({
            id: coupon.id,
            code: coupon.code,
            discount: coupon.discount,
            description: coupon.description,
            customerEmail: coupon.customerEmail || '',
            expiresAt: coupon.expiresAt.split('T')[0],
            active: coupon.active
        });
        setIsCouponModalOpen(true);
    };

    const handleCreateCoupon = () => {
        setCouponForm({ id: '', code: '', discount: 10, description: '', customerEmail: '', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], active: true });
        setIsCouponModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.description) {
            addToast("Título e descrição são obrigatórios.", 'warning');
            return;
        }

        setLoading(true);
        const campaignToSave = {
            ...formData,
            id: formData.id || '',
            active: formData.active ?? true,
            priority: formData.priority || 1
        } as Campaign;

        await supabaseService.saveCampaign(campaignToSave);
        setLoading(false);
        setIsModalOpen(false);
        addToast("Campanha salva com sucesso!", 'success');
        loadData();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Excluir esta campanha permanentemente?")) {
            await supabaseService.deleteCampaign(id);
            addToast("Campanha removida.", 'info');
            loadData();
        }
    };

    const handleEdit = (c: Campaign) => {
        setFormData(c);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setFormData({
            title: '',
            description: '',
            imageUrl: '',
            link: '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
            frequency: 'ONCE',
            active: true,
            priority: 1
        });
        setIsModalOpen(true);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, imageUrl: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    // 🚀 DISPARAR CAMPANHA - Enviar Push + Email para todos os clientes
    const [sendingCampaign, setSendingCampaign] = useState<string | null>(null);

    const handleSendCampaign = async (campaign: Campaign) => {
        if (!confirm(`Disparar campanha "${campaign.title}" para ${customers.length} clientes?\n\nIsso enviará:\n• Push notification para todos\n• Email para todos`)) {
            return;
        }

        setSendingCampaign(campaign.id);

        try {
            let pushSent = 0;
            let emailSent = 0;
            let failed = 0;

            // Enviar Push para todos
            const pushResult = await firebasePushService.sendPush({
                to: 'all',
                title: `📢 ${campaign.title}`,
                body: campaign.description,
                link: campaign.link || '/client/dashboard'
            });
            pushSent = pushResult.sent || 0;

            // Enviar Email para cada cliente com email válido
            const clientsWithEmail = customers.filter(c => c.email && c.email.includes('@'));

            for (const customer of clientsWithEmail) {
                try {
                    await emailService.sendMarketingCampaign({
                        clientName: customer.name,
                        clientEmail: customer.email,
                        amount: 0,
                        campaignTitle: campaign.title,
                        campaignDescription: campaign.description,
                        campaignLink: campaign.link || undefined
                    });
                    emailSent++;
                } catch (err) {
                    console.error(`Email failed for ${customer.email}:`, err);
                    failed++;
                }

                // Pequena pausa entre emails (evitar rate limit)
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            addToast(
                `Campanha disparada!\n📱 ${pushSent} push enviados\n📧 ${emailSent} emails enviados${failed > 0 ? `\n❌ ${failed} falhas` : ''}`,
                'success'
            );
        } catch (error) {
            console.error('Campaign send error:', error);
            addToast('Erro ao disparar campanha. Verifique o console.', 'error');
        } finally {
            setSendingCampaign(null);
        }
    };

    // Filter referrals
    const filteredReferrals = referrals.filter(r =>
        r.referralCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.referredName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                        <Megaphone size={32} /> Marketing & Indicações
                    </h1>
                    <p className="text-zinc-400 text-sm mt-1">Gerencie campanhas e valide indicações de clientes.</p>
                </div>

                {activeTab === 'campaigns' && (
                    <Button onClick={handleCreate}>
                        <Plus size={18} className="mr-2" /> Nova Campanha
                    </Button>
                )}
                {activeTab === 'coupons' && (
                    <Button onClick={handleCreateCoupon}>
                        <Plus size={18} className="mr-2" /> Novo Cupom
                    </Button>
                )}
            </div>

            <div className="flex gap-4 mb-8 border-b border-zinc-800 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('referrals')}
                    className={`pb-4 px-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'referrals' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-zinc-500 hover:text-white'}`}
                >
                    Indicações
                </button>
                <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`pb-4 px-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'campaigns' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-zinc-500 hover:text-white'}`}
                >
                    Campanhas
                </button>
                <button
                    onClick={() => setActiveTab('coupons')}
                    className={`pb-4 px-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'coupons' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-zinc-500 hover:text-white'}`}
                >
                    <Ticket size={16} className="inline mr-1" /> Cupons
                </button>
            </div>

            {activeTab === 'referrals' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-zinc-400 text-sm mb-1">Total de Indicações</p>
                            <p className="text-2xl font-bold text-white">{referrals.length}</p>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-zinc-400 text-sm mb-1">Pendentes de Validação</p>
                            <p className="text-2xl font-bold text-yellow-400">{referrals.filter(r => r.status === 'PENDING').length}</p>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-zinc-400 text-sm mb-1">Suspeitas de Fraude</p>
                            <p className="text-2xl font-bold text-red-500">{referrals.filter(r => r.status === 'FRAUD_SUSPECTED').length}</p>
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Users size={18} className="text-[#D4AF37]" /> Lista de Indicações
                            </h3>
                            <div className="relative w-64">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar código ou nome..."
                                    className="w-full bg-black border border-zinc-700 rounded-full py-2 pl-9 pr-4 text-sm focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-zinc-950 text-zinc-400 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="p-4">Data</th>
                                        <th className="p-4">Código</th>
                                        <th className="p-4">Indicado (Novo Cliente)</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {filteredReferrals.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-zinc-500">Nenhuma indicação encontrada.</td>
                                        </tr>
                                    ) : (
                                        filteredReferrals.map(referral => (
                                            <tr key={referral.id} className="hover:bg-zinc-800/50">
                                                <td className="p-4 text-zinc-400">
                                                    {new Date(referral.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="p-4">
                                                    <span className="font-mono bg-black px-2 py-1 rounded border border-zinc-800 text-[#D4AF37]">
                                                        {referral.referralCode}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-medium text-white">
                                                    {referral.referredName}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${referral.status === 'VALIDATED' ? 'bg-green-900/20 text-green-400 border-green-900' :
                                                        referral.status === 'PENDING' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900' :
                                                            referral.status === 'FRAUD_SUSPECTED' ? 'bg-red-900/20 text-red-400 border-red-900' :
                                                                'bg-zinc-800 text-zinc-500 border-zinc-700'
                                                        }`}>
                                                        {referral.status === 'VALIDATED' ? 'Validado' :
                                                            referral.status === 'PENDING' ? 'Pendente' :
                                                                referral.status === 'FRAUD_SUSPECTED' ? 'Fraude' : 'Rejeitado'}
                                                    </span>
                                                    {referral.fraudReason && (
                                                        <div className="text-[10px] text-red-500 mt-1 max-w-[200px]">
                                                            {referral.fraudReason}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {referral.status === 'PENDING' && (
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => handleValidation(referral.id, 'VALIDATE')}
                                                                className="p-1.5 bg-green-900/30 text-green-400 rounded hover:bg-green-900/50"
                                                                title="Validar"
                                                            >
                                                                <CheckCircle size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleValidation(referral.id, 'FRAUD')}
                                                                className="p-1.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                                                                title="Marcar como Fraude"
                                                            >
                                                                <AlertTriangle size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleValidation(referral.id, 'REJECT')}
                                                                className="p-1.5 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700"
                                                                title="Rejeitar"
                                                            >
                                                                <Ban size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'campaigns' && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {campaigns.map((camp) => (
                            <div key={camp.id} className={`group bg-zinc-900 border rounded-2xl overflow-hidden transition-all hover:-translate-y-1 shadow-lg ${camp.active ? 'border-zinc-800 hover:border-[#D4AF37]/50' : 'border-red-900/30 opacity-75'}`}>
                                {/* ... (Existing campaign card content) ... */}
                                <div className="relative h-40 bg-black">
                                    {camp.imageUrl ? (
                                        <img src={camp.imageUrl} alt={camp.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-950">
                                            <ImageIcon size={48} />
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${camp.active ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                                            {camp.active ? 'Ativa' : 'Inativa'}
                                        </span>
                                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-black/80 text-white border border-zinc-700">
                                            {camp.frequency === 'ONCE' ? '1x' : camp.frequency === 'DAILY' ? 'Diário' : 'Sempre'}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-5">
                                    <h3 className="font-bold text-lg text-white mb-2 line-clamp-1">{camp.title}</h3>
                                    <p className="text-zinc-400 text-sm mb-4 line-clamp-2 h-10">{camp.description}</p>

                                    <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4 font-mono">
                                        <div className="flex items-center gap-1"><Calendar size={12} /> {new Date(camp.startDate).toLocaleDateString()} - {new Date(camp.endDate).toLocaleDateString()}</div>
                                    </div>

                                    {/* Botão Disparar Campanha */}
                                    {camp.active && (
                                        <Button
                                            size="sm"
                                            onClick={() => handleSendCampaign(camp)}
                                            className="w-full mb-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                                            isLoading={sendingCampaign === camp.id}
                                            disabled={sendingCampaign !== null}
                                        >
                                            {sendingCampaign === camp.id ? (
                                                <><Loader2 size={16} className="mr-2 animate-spin" /> Enviando...</>
                                            ) : (
                                                <><Send size={16} className="mr-2" /> Disparar Campanha</>
                                            )}
                                        </Button>
                                    )}

                                    <div className="flex items-center gap-2 border-t border-zinc-800 pt-4">
                                        <Button size="sm" variant="secondary" onClick={() => handleEdit(camp)} className="flex-1">
                                            <Edit2 size={16} className="mr-2" /> Editar
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => handleDelete(camp.id)}>
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {campaigns.length === 0 && (
                        <div className="text-center py-20 text-zinc-500 bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed">
                            <Megaphone size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Nenhuma campanha ativa.</p>
                            <p className="text-sm">Crie promoções de parceiros ou indicações para engajar seus clientes.</p>
                        </div>
                    )}
                </>
            )}

            {/* Modal Form */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-6">
                            {formData.id ? 'Editar Campanha' : 'Nova Campanha'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Título da Promoção</label>
                                <input
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className={inputStyle}
                                    placeholder="Ex: Ganhe 10% no iFood"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Descrição Curta</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className={`${inputStyle} h-24 resize-none`}
                                    placeholder="Ex: Use o cupom TUBARAO10 no Marmitex do Alemão..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Link de Ação (Opcional)</label>
                                    <div className="relative">
                                        <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                        <input
                                            value={formData.link}
                                            onChange={e => setFormData({ ...formData, link: e.target.value })}
                                            className={`${inputStyle} pl-10`}
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Imagem</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                            id="campaign-img"
                                        />
                                        <label htmlFor="campaign-img" className="flex items-center justify-center gap-2 bg-black border border-zinc-700 rounded-lg p-3 text-sm cursor-pointer hover:border-[#D4AF37] transition-colors">
                                            <ImageIcon size={16} /> {formData.imageUrl ? 'Alterar Imagem' : 'Enviar Imagem'}
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {formData.imageUrl && (
                                <div className="h-32 w-full rounded-lg overflow-hidden border border-zinc-800">
                                    <img src={formData.imageUrl} className="w-full h-full object-cover" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Início</label>
                                    <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className={inputStyle} />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Fim</label>
                                    <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className={inputStyle} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Frequência</label>
                                    <select
                                        value={formData.frequency}
                                        onChange={e => setFormData({ ...formData, frequency: e.target.value as any })}
                                        className={inputStyle}
                                    >
                                        <option value="ONCE">Apenas uma vez</option>
                                        <option value="DAILY">Uma vez ao dia</option>
                                        <option value="ALWAYS">Sempre visível</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Prioridade (1-10)</label>
                                    <input type="number" min="1" max="10" value={formData.priority} onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })} className={inputStyle} />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-black rounded-lg border border-zinc-800">
                                <input
                                    type="checkbox"
                                    id="active"
                                    checked={formData.active}
                                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                    className="accent-[#D4AF37] w-5 h-5"
                                />
                                <label htmlFor="active" className="text-white text-sm cursor-pointer select-none">Campanha Ativa?</label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                                <Button onClick={handleSave} isLoading={loading} className="flex-1">Salvar Campanha</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Coupons Tab */}
            {activeTab === 'coupons' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-zinc-400 text-sm mb-1">Total de Cupons</p>
                            <p className="text-2xl font-bold text-white">{coupons.length}</p>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-zinc-400 text-sm mb-1">Cupons Ativos</p>
                            <p className="text-2xl font-bold text-green-400">{coupons.filter(c => c.active).length}</p>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-zinc-400 text-sm mb-1">Cupons Expirados</p>
                            <p className="text-2xl font-bold text-red-400">{coupons.filter(c => new Date(c.expiresAt) < new Date()).length}</p>
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Ticket size={18} className="text-purple-400" /> Lista de Cupons
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-black/50 text-zinc-400">
                                    <tr>
                                        <th className="p-3 text-left">Código</th>
                                        <th className="p-3 text-left">Desconto</th>
                                        <th className="p-3 text-left">Descrição</th>
                                        <th className="p-3 text-left">Cliente</th>
                                        <th className="p-3 text-left">Validade</th>
                                        <th className="p-3 text-left">Status</th>
                                        <th className="p-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {coupons.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-zinc-500">
                                                Nenhum cupom cadastrado. Clique em "Novo Cupom" para criar.
                                            </td>
                                        </tr>
                                    ) : (
                                        coupons.map(coupon => (
                                            <tr key={coupon.id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                                                <td className="p-3">
                                                    <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">{coupon.code}</span>
                                                </td>
                                                <td className="p-3 font-bold text-purple-400">{coupon.discount}%</td>
                                                <td className="p-3 text-zinc-300">{coupon.description || '-'}</td>
                                                <td className="p-3 text-zinc-400">{coupon.customerEmail || 'Todos'}</td>
                                                <td className="p-3 text-zinc-400">{new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}</td>
                                                <td className="p-3">
                                                    {coupon.active && new Date(coupon.expiresAt) >= new Date() ? (
                                                        <span className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded">Ativo</span>
                                                    ) : (
                                                        <span className="bg-red-900/30 text-red-400 text-xs px-2 py-1 rounded">Inativo</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => handleEditCoupon(coupon)} className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white mr-1">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => handleDeleteCoupon(coupon.id)} className="p-2 hover:bg-red-900/30 rounded text-zinc-400 hover:text-red-400">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Coupon Modal */}
            {isCouponModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in duration-200 my-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
                            <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                                <Ticket size={18} /> {couponForm.id ? 'Editar Cupom' : 'Novo Cupom'}
                            </h3>
                            <button onClick={() => setIsCouponModalOpen(false)}><XCircle className="text-zinc-500 hover:text-white" /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Código do Cupom</label>
                                <input
                                    type="text"
                                    value={couponForm.code}
                                    onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                                    placeholder="BEMVINDO10"
                                    className={inputStyle}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Desconto (%)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={couponForm.discount}
                                    onChange={e => setCouponForm({ ...couponForm, discount: Number(e.target.value) })}
                                    className={inputStyle}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Descrição</label>
                                <input
                                    type="text"
                                    value={couponForm.description}
                                    onChange={e => setCouponForm({ ...couponForm, description: e.target.value })}
                                    placeholder="Desconto de boas-vindas"
                                    className={inputStyle}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Email do Cliente (opcional)</label>
                                <input
                                    type="email"
                                    value={couponForm.customerEmail}
                                    onChange={e => setCouponForm({ ...couponForm, customerEmail: e.target.value })}
                                    placeholder="cliente@email.com (vazio = todos)"
                                    className={inputStyle}
                                />
                                <p className="text-xs text-zinc-600 mt-1">Deixe vazio para cupom disponível a todos os clientes</p>
                            </div>

                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Validade</label>
                                <input
                                    type="date"
                                    value={couponForm.expiresAt}
                                    onChange={e => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                                    className={inputStyle}
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-black rounded-lg border border-zinc-800">
                                <input
                                    type="checkbox"
                                    id="couponActive"
                                    checked={couponForm.active}
                                    onChange={e => setCouponForm({ ...couponForm, active: e.target.checked })}
                                    className="accent-purple-500 w-5 h-5"
                                />
                                <label htmlFor="couponActive" className="text-white text-sm cursor-pointer select-none">Cupom Ativo?</label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button variant="secondary" onClick={() => setIsCouponModalOpen(false)} className="flex-1">Cancelar</Button>
                                <Button onClick={handleSaveCoupon} isLoading={loading} className="flex-1 bg-purple-600 hover:bg-purple-700">Salvar Cupom</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};