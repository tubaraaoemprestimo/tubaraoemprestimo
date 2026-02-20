
import React, { useState, useEffect } from 'react';
import {
    Users, TrendingUp, DollarSign, CheckCircle, Clock, XCircle,
    Search, Filter, Eye, ChevronDown, Award, BarChart3, Wallet,
    UserPlus, AlertTriangle, ArrowUpRight, RefreshCw, Copy, Handshake
} from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../services/apiClient';
import { useToast } from '../../components/Toast';

interface Partner {
    id: string;
    name: string;
    email: string;
    phone: string;
    cpf: string;
    isPartner: boolean;
    partnerScore: number;
    referralCode: string;
    createdAt: string;
    _count?: {
        commissions: number;
        referrals: number;
    };
    commissions?: PartnerCommission[];
    totalEarned?: number;
    totalPending?: number;
}

interface PartnerCommission {
    id: string;
    partnerId: string;
    loanRequestId: string;
    contractId: string;
    totalCommission: number;
    commissionAmount: number;
    installmentsReleased: number;
    releasedPercent: number;
    release1Amount?: number;
    release1At?: string;
    release2Amount?: number;
    release2At?: string;
    release3Amount?: number;
    release3At?: string;
    status: string;
    cancelReason?: string;
    paidAt?: string;
    paymentMethod?: string;
    createdAt: string;
    loanRequest?: {
        clientName: string;
        amount: number;
        profileType: string;
        status: string;
    };
}

interface PartnerStats {
    totalPartners: number;
    totalCommissions: number;
    totalPaid: number;
    totalPending: number;
    averageScore: number;
}

export const Partners: React.FC = () => {
    const { addToast } = useToast();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [stats, setStats] = useState<PartnerStats>({
        totalPartners: 0, totalCommissions: 0, totalPaid: 0, totalPending: 0, averageScore: 0
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [commissions, setCommissions] = useState<PartnerCommission[]>([]);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [payingCommission, setPayingCommission] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState('PIX');
    const [paymentReference, setPaymentReference] = useState('');

    useEffect(() => {
        loadPartners();
    }, []);

    const loadPartners = async () => {
        setLoading(true);
        try {
            const { data, error } = await api.get<any>('/partners');
            if (!error && data) {
                setPartners(data.partners || []);
                setStats(data.stats || stats);
            }
        } catch (err) {
            console.error('Error loading partners:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadPartnerCommissions = async (partnerId: string) => {
        try {
            const { data, error } = await api.get<any>(`/partners/${partnerId}/commissions`);
            if (!error && data) {
                setCommissions(data.commissions || []);
            }
        } catch (err) {
            console.error('Error loading commissions:', err);
        }
    };

    const togglePartnerStatus = async (userId: string, isPartner: boolean) => {
        try {
            const { error } = await api.post(`/partners/${userId}/toggle`, { isPartner });
            if (!error) {
                addToast(isPartner ? 'Parceiro ativado!' : 'Parceiro desativado.', 'success');
                loadPartners();
            }
        } catch (err) {
            addToast('Erro ao atualizar parceiro', 'error');
        }
    };

    const markCommissionPaid = async (commissionId: string) => {
        try {
            const { error } = await api.post(`/partners/commissions/${commissionId}/pay`, { paymentMethod, paymentReference });
            if (!error) {
                addToast('Comissão marcada como paga!', 'success');
                setPayingCommission(null);
                setPaymentReference('');
                if (selectedPartner) loadPartnerCommissions(selectedPartner.id);
                loadPartners();
            }
        } catch (err) {
            addToast('Erro ao marcar pagamento', 'error');
        }
    };

    const filteredPartners = partners.filter(p => {
        if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) && !p.email.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PAID': return 'bg-green-900/30 text-green-400 border-green-700';
            case 'PARTIAL': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700';
            case 'PENDING': return 'bg-blue-900/30 text-blue-400 border-blue-700';
            case 'CANCELLED': return 'bg-red-900/30 text-red-400 border-red-700';
            default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PAID': return 'Pago';
            case 'PARTIAL': return 'Parcial';
            case 'PENDING': return 'Pendente';
            case 'CANCELLED': return 'Cancelado';
            default: return status;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-3">
                        <Handshake size={32} /> Parceiros Tubarão
                    </h1>
                    <p className="text-zinc-400 text-sm mt-1">Gerenciamento de Representantes Comerciais</p>
                </div>
                <Button onClick={loadPartners} variant="secondary" className="bg-zinc-900 border border-zinc-800">
                    <RefreshCw size={16} className="mr-2" /> Atualizar
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4">
                    <Users size={20} className="text-[#D4AF37] mb-2" />
                    <p className="text-2xl font-bold">{stats.totalPartners}</p>
                    <p className="text-xs text-zinc-500">Parceiros Ativos</p>
                </div>
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4">
                    <DollarSign size={20} className="text-emerald-400 mb-2" />
                    <p className="text-2xl font-bold text-emerald-400">R$ {(stats.totalCommissions || 0).toLocaleString()}</p>
                    <p className="text-xs text-zinc-500">Total Comissões</p>
                </div>
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4">
                    <CheckCircle size={20} className="text-green-400 mb-2" />
                    <p className="text-2xl font-bold text-green-400">R$ {(stats.totalPaid || 0).toLocaleString()}</p>
                    <p className="text-xs text-zinc-500">Total Pago</p>
                </div>
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4">
                    <Clock size={20} className="text-yellow-400 mb-2" />
                    <p className="text-2xl font-bold text-yellow-400">R$ {(stats.totalPending || 0).toLocaleString()}</p>
                    <p className="text-xs text-zinc-500">Pendente</p>
                </div>
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4">
                    <Award size={20} className="text-purple-400 mb-2" />
                    <p className="text-2xl font-bold text-purple-400">{(stats.averageScore || 0).toFixed(1)}</p>
                    <p className="text-xs text-zinc-500">Score Médio</p>
                </div>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar parceiros por nome ou email..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-white placeholder-zinc-500 focus:border-[#D4AF37] outline-none"
                    />
                </div>
            </div>

            {/* Partners List */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                        <thead className="bg-zinc-950 text-zinc-400">
                            <tr>
                                <th className="p-4 font-medium">Parceiro</th>
                                <th className="p-4 font-medium">Código</th>
                                <th className="p-4 font-medium">Indicações</th>
                                <th className="p-4 font-medium">Comissões</th>
                                <th className="p-4 font-medium">Score</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {filteredPartners.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-zinc-500">
                                        <Users className="mx-auto mb-3 opacity-30" size={48} />
                                        <p>Nenhum parceiro encontrado.</p>
                                        <p className="text-xs mt-1">Para cadastrar um parceiro, edite o perfil do cliente e ative a flag "Parceiro".</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPartners.map(partner => (
                                    <tr key={partner.id} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-white">{partner.name}</div>
                                            <div className="text-xs text-zinc-500">{partner.email}</div>
                                            {partner.phone && <div className="text-xs text-zinc-600">{partner.phone}</div>}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-1 rounded text-sm">
                                                {partner.referralCode || '—'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-white font-bold">{partner._count?.referrals || 0}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-emerald-400 font-bold text-sm">
                                                R$ {(partner.totalEarned || 0).toLocaleString()}
                                            </div>
                                            {(partner.totalPending || 0) > 0 && (
                                                <div className="text-yellow-400 text-xs">
                                                    + R$ {(partner.totalPending || 0).toLocaleString()} pendente
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${(partner.partnerScore || 0) >= 80 ? 'bg-green-900/50 text-green-400' :
                                                    (partner.partnerScore || 0) >= 50 ? 'bg-yellow-900/50 text-yellow-400' :
                                                        'bg-red-900/50 text-red-400'
                                                    }`}>
                                                    {partner.partnerScore || 0}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${partner.isPartner ? 'bg-emerald-900/30 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                                                }`}>
                                                {partner.isPartner ? '✅ Ativo' : '❌ Inativo'}
                                            </span>
                                        </td>
                                        <td className="p-4 flex gap-2">
                                            <Button variant="secondary" size="sm" className="py-1 px-3" onClick={() => {
                                                setSelectedPartner(partner);
                                                loadPartnerCommissions(partner.id);
                                            }}>
                                                <Eye size={14} className="mr-1" /> Ver
                                            </Button>
                                            <Button
                                                variant={partner.isPartner ? 'danger' : 'gold'}
                                                size="sm"
                                                className={`py-1 px-3 ${!partner.isPartner ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                                                onClick={() => togglePartnerStatus(partner.id, !partner.isPartner)}
                                            >
                                                {partner.isPartner ? 'Desativar' : 'Ativar'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Partner Detail Modal */}
            {selectedPartner && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-950">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Handshake size={24} className="text-[#D4AF37]" />
                                    {selectedPartner.name}
                                </h2>
                                <p className="text-zinc-400 text-sm mt-1">
                                    Código: <span className="text-[#D4AF37] font-mono">{selectedPartner.referralCode || 'N/A'}</span>
                                    {' '}• Score: <span className="text-white font-bold">{selectedPartner.partnerScore || 0}</span>
                                </p>
                            </div>
                            <button onClick={() => setSelectedPartner(null)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white">
                                <XCircle size={24} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Stats Row */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-black rounded-xl p-4 border border-zinc-800">
                                    <p className="text-xs text-zinc-500">Indicações</p>
                                    <p className="text-xl font-bold text-white">{selectedPartner._count?.referrals || 0}</p>
                                </div>
                                <div className="bg-black rounded-xl p-4 border border-zinc-800">
                                    <p className="text-xs text-zinc-500">Comissões</p>
                                    <p className="text-xl font-bold text-[#D4AF37]">{commissions.length}</p>
                                </div>
                                <div className="bg-black rounded-xl p-4 border border-zinc-800">
                                    <p className="text-xs text-zinc-500">Total Pago</p>
                                    <p className="text-xl font-bold text-green-400">
                                        R$ {commissions.filter(c => c.status === 'PAID').reduce((s, c) => s + c.totalCommission, 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-black rounded-xl p-4 border border-zinc-800">
                                    <p className="text-xs text-zinc-500">Pendente</p>
                                    <p className="text-xl font-bold text-yellow-400">
                                        R$ {commissions.filter(c => c.status !== 'PAID' && c.status !== 'CANCELLED').reduce((s, c) => s + (c.totalCommission - (c.release1Amount || 0) - (c.release2Amount || 0) - (c.release3Amount || 0)), 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Commissions Filter */}
                            <div className="flex gap-2">
                                {['ALL', 'PENDING', 'PARTIAL', 'PAID', 'CANCELLED'].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setFilterStatus(s)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filterStatus === s ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                            }`}
                                    >
                                        {s === 'ALL' ? 'Todas' : getStatusLabel(s)}
                                    </button>
                                ))}
                            </div>

                            {/* Commissions Table */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wide">Comissões</h3>
                                {commissions.length === 0 ? (
                                    <div className="text-center py-8 text-zinc-500">
                                        <Wallet className="mx-auto mb-2 opacity-30" size={40} />
                                        <p>Nenhuma comissão registrada.</p>
                                    </div>
                                ) : (
                                    commissions
                                        .filter(c => filterStatus === 'ALL' || c.status === filterStatus)
                                        .map(commission => (
                                            <div key={commission.id} className="bg-black border border-zinc-800 rounded-xl p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="font-bold text-white">{commission.loanRequest?.clientName || 'Cliente'}</p>
                                                        <p className="text-xs text-zinc-500">
                                                            {commission.loanRequest?.profileType || 'N/A'} • R$ {(commission.loanRequest?.amount || 0).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(commission.status)}`}>
                                                        {getStatusLabel(commission.status)}
                                                    </span>
                                                </div>

                                                {/* Release Progress */}
                                                <div className="grid grid-cols-3 gap-2 mb-3">
                                                    <div className={`p-2 rounded-lg text-center border ${commission.release1At ? 'bg-green-900/20 border-green-700/30' : 'bg-zinc-900 border-zinc-700/30'}`}>
                                                        <p className="text-[10px] text-zinc-400">1ª Parcela (40%)</p>
                                                        <p className={`text-sm font-bold ${commission.release1At ? 'text-green-400' : 'text-zinc-500'}`}>
                                                            R$ {(commission.release1Amount || (commission.totalCommission * 0.4)).toFixed(0)}
                                                        </p>
                                                        {commission.release1At && <p className="text-[9px] text-green-600">✓ {new Date(commission.release1At).toLocaleDateString('pt-BR')}</p>}
                                                    </div>
                                                    <div className={`p-2 rounded-lg text-center border ${commission.release2At ? 'bg-green-900/20 border-green-700/30' : 'bg-zinc-900 border-zinc-700/30'}`}>
                                                        <p className="text-[10px] text-zinc-400">2ª Parcela (30%)</p>
                                                        <p className={`text-sm font-bold ${commission.release2At ? 'text-green-400' : 'text-zinc-500'}`}>
                                                            R$ {(commission.release2Amount || (commission.totalCommission * 0.3)).toFixed(0)}
                                                        </p>
                                                        {commission.release2At && <p className="text-[9px] text-green-600">✓ {new Date(commission.release2At).toLocaleDateString('pt-BR')}</p>}
                                                    </div>
                                                    <div className={`p-2 rounded-lg text-center border ${commission.release3At ? 'bg-green-900/20 border-green-700/30' : 'bg-zinc-900 border-zinc-700/30'}`}>
                                                        <p className="text-[10px] text-zinc-400">3ª Parcela (30%)</p>
                                                        <p className={`text-sm font-bold ${commission.release3At ? 'text-green-400' : 'text-zinc-500'}`}>
                                                            R$ {(commission.release3Amount || (commission.totalCommission * 0.3)).toFixed(0)}
                                                        </p>
                                                        {commission.release3At && <p className="text-[9px] text-green-600">✓ {new Date(commission.release3At).toLocaleDateString('pt-BR')}</p>}
                                                    </div>
                                                </div>

                                                {/* Total and Pay Button */}
                                                <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
                                                    <div>
                                                        <span className="text-xs text-zinc-500">Total: </span>
                                                        <span className="font-bold text-[#D4AF37]">R$ {commission.totalCommission.toFixed(2)}</span>
                                                        <span className="text-xs text-zinc-600 ml-2">
                                                            ({commission.installmentsReleased}/3 liberadas)
                                                        </span>
                                                    </div>
                                                    {commission.status !== 'PAID' && commission.status !== 'CANCELLED' && (
                                                        <>
                                                            {payingCommission === commission.id ? (
                                                                <div className="flex items-center gap-2">
                                                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                                                                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs">
                                                                        <option value="PIX">PIX</option>
                                                                        <option value="TED">TED</option>
                                                                        <option value="CASH">Dinheiro</option>
                                                                    </select>
                                                                    <input
                                                                        value={paymentReference}
                                                                        onChange={e => setPaymentReference(e.target.value)}
                                                                        placeholder="Ref. (opcional)"
                                                                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs w-28"
                                                                    />
                                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 py-1 px-2 text-xs" onClick={() => markCommissionPaid(commission.id)}>
                                                                        ✓ Pagar
                                                                    </Button>
                                                                    <button onClick={() => setPayingCommission(null)} className="text-zinc-500 hover:text-white text-xs">✕</button>
                                                                </div>
                                                            ) : (
                                                                <Button size="sm" variant="secondary" className="py-1 px-3 text-xs" onClick={() => setPayingCommission(commission.id)}>
                                                                    <Wallet size={12} className="mr-1" /> Marcar Pago
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
