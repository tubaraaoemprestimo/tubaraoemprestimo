
import React, { useState, useEffect } from 'react';
import {
    TrendingUp, DollarSign, CheckCircle, Clock, Users, Award, Copy, Share2,
    Wallet, ArrowUpRight, Gift, BarChart3, AlertTriangle, Handshake, Star, Trophy
} from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../services/apiClient';
import { useToast } from '../../components/Toast';

interface PartnerData {
    referralCode: string;
    partnerScore: number;
    totalCommissions: number;
    paidCommissions: number;
    pendingCommissions: number;
    cancelledCommissions: number;
    totalEarned: number;
    totalPending: number;
    totalPaid: number;
    clientsReferred: number;
    clientsApproved: number;
    defaultRate: number;
    monthlyStats: {
        month: string;
        contracts: number;
        earned: number;
    }[];
    recentCommissions: {
        id: string;
        clientName: string;
        profileType: string;
        amount: number;
        totalCommission: number;
        installmentsReleased: number;
        releasedPercent: number;
        status: string;
        createdAt: string;
    }[];
    bonuses: {
        id: string;
        month: string;
        contractsCount: number;
        bonusAmount: number;
        bonusTier: string;
        status: string;
    }[];
}

export const PartnerDashboard: React.FC = () => {
    const { addToast } = useToast();
    const [data, setData] = useState<PartnerData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: result, error } = await api.get<PartnerData>('/partners/my-dashboard');
            if (!error && result) {
                setData(result);
            } else {
                setData(null);
            }
        } catch (err) {
            console.error('Error loading partner data:', err);
        } finally {
            setLoading(false);
        }
    };

    const copyCode = () => {
        if (data?.referralCode) {
            navigator.clipboard.writeText(data.referralCode);
            addToast('Código copiado!', 'success');
        }
    };

    const shareCode = async () => {
        if (!data?.referralCode) return;
        const shareText = `🦈 Use meu código ${data.referralCode} para solicitar um empréstimo na Tubarão Empréstimos! Acesse: https://www.tubaraoemprestimo.com.br`;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Tubarão Empréstimos', text: shareText });
                addToast('Compartilhado!', 'success');
            } catch { /* user cancelled */ }
        } else {
            navigator.clipboard.writeText(shareText);
            addToast('Link copiado!', 'success');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PAID': return 'text-green-400 bg-green-900/30';
            case 'PARTIAL': return 'text-yellow-400 bg-yellow-900/30';
            case 'PENDING': return 'text-blue-400 bg-blue-900/30';
            case 'CANCELLED': return 'text-red-400 bg-red-900/30';
            default: return 'text-zinc-400 bg-zinc-800';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <Handshake size={64} className="mx-auto text-zinc-700 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Área do Parceiro</h2>
                    <p className="text-zinc-400 text-sm">
                        Você ainda não é um Parceiro Tubarão. Entre em contato com a administração para se tornar um representante comercial.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans pb-20">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#D4AF37]/20 via-zinc-950 to-black border-b border-[#D4AF37]/20 p-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-yellow-700 flex items-center justify-center">
                        <Handshake size={24} className="text-black" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Parceiro Tubarão</h1>
                        <p className="text-zinc-400 text-xs">Representante Comercial</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${(data.partnerScore || 0) >= 80 ? 'bg-green-900/50 text-green-400' :
                        (data.partnerScore || 0) >= 50 ? 'bg-yellow-900/50 text-yellow-400' :
                            'bg-red-900/50 text-red-400'
                        }`}>
                        Score: {data.partnerScore || 0}
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-300">
                        Inadimplência: {(data.defaultRate || 0).toFixed(1)}%
                    </div>
                </div>
            </div>

            <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
                {/* Referral Code Card */}
                <div className="bg-gradient-to-r from-[#D4AF37]/20 to-zinc-900 border border-[#D4AF37]/30 rounded-2xl p-6 text-center">
                    <Trophy className="mx-auto text-[#D4AF37] mb-3" size={40} />
                    <h2 className="font-bold text-lg mb-2">Seu Código de Indicação</h2>
                    <div className="bg-black rounded-xl p-4 mb-4 border border-[#D4AF37]/40">
                        <span className="text-3xl font-mono font-bold text-[#D4AF37] tracking-wider">{data.referralCode}</span>
                    </div>
                    <div className="flex gap-3">
                        <Button onClick={copyCode} variant="secondary" className="flex-1">
                            <Copy size={16} className="mr-2" /> Copiar
                        </Button>
                        <Button onClick={shareCode} className="flex-1 bg-[#D4AF37] text-black hover:bg-[#B5942F]">
                            <Share2 size={16} className="mr-2" /> Compartilhar
                        </Button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-emerald-900/30 to-zinc-900 border border-emerald-700/30 rounded-2xl p-4">
                        <DollarSign size={24} className="text-emerald-400 mb-2" />
                        <p className="text-2xl font-bold text-emerald-400">R$ {(data.totalEarned || 0).toLocaleString()}</p>
                        <p className="text-xs text-zinc-400">Total Ganho</p>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-900/30 to-zinc-900 border border-yellow-700/30 rounded-2xl p-4">
                        <Clock size={24} className="text-yellow-400 mb-2" />
                        <p className="text-2xl font-bold text-yellow-400">R$ {(data.totalPending || 0).toLocaleString()}</p>
                        <p className="text-xs text-zinc-400">Pendente</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-900/30 to-zinc-900 border border-green-700/30 rounded-2xl p-4">
                        <CheckCircle size={24} className="text-green-400 mb-2" />
                        <p className="text-2xl font-bold text-green-400">R$ {(data.totalPaid || 0).toLocaleString()}</p>
                        <p className="text-xs text-zinc-400">Recebido</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-900/30 to-zinc-900 border border-blue-700/30 rounded-2xl p-4">
                        <Users size={24} className="text-blue-400 mb-2" />
                        <p className="text-2xl font-bold text-blue-400">{data.clientsReferred || 0}</p>
                        <p className="text-xs text-zinc-400">Clientes Indicados</p>
                    </div>
                </div>

                {/* Commission Rules */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <h3 className="font-bold text-sm text-[#D4AF37] uppercase tracking-wide mb-4 flex items-center gap-2">
                        <Award size={16} /> Tabela de Comissões
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between bg-black/50 p-3 rounded-lg">
                            <span className="text-zinc-300">Empréstimo até R$ 3.000</span>
                            <span className="font-bold text-emerald-400">R$ 120</span>
                        </div>
                        <div className="flex justify-between bg-black/50 p-3 rounded-lg">
                            <span className="text-zinc-300">Empréstimo R$ 5.000+</span>
                            <span className="font-bold text-emerald-400">R$ 150</span>
                        </div>
                        <div className="flex justify-between bg-black/50 p-3 rounded-lg">
                            <span className="text-zinc-300">Empréstimo R$ 10.000+</span>
                            <span className="font-bold text-emerald-400">R$ 180</span>
                        </div>
                        <div className="flex justify-between bg-black/50 p-3 rounded-lg">
                            <span className="text-zinc-300">Financiamento Moto</span>
                            <span className="font-bold text-blue-400">R$ 250</span>
                        </div>
                        <div className="flex justify-between bg-black/50 p-3 rounded-lg">
                            <span className="text-zinc-300">Limpa Nome</span>
                            <span className="font-bold text-purple-400">R$ 50</span>
                        </div>
                        <div className="flex justify-between bg-black/50 p-3 rounded-lg">
                            <span className="text-zinc-300">Investidor</span>
                            <span className="font-bold text-[#D4AF37]">1% do valor</span>
                        </div>
                    </div>
                    <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <p className="text-xs text-zinc-400">
                            <strong className="text-white">Liberação:</strong> 40% no 1º pagamento realizado • 30% no 2º • 30% no 3º.
                            Se o contrato for cancelado antes do 3º pagamento, o restante é cancelado.
                        </p>
                    </div>
                </div>

                {/* Recent Commissions */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <h3 className="font-bold text-sm text-[#D4AF37] uppercase tracking-wide mb-4 flex items-center gap-2">
                        <Wallet size={16} /> Comissões Recentes
                    </h3>
                    {(data.recentCommissions?.length || 0) > 0 ? (
                        <div className="space-y-3">
                            {data.recentCommissions.map(c => (
                                <div key={c.id} className="bg-black/50 border border-zinc-800 rounded-xl p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-white text-sm">{c.clientName}</p>
                                            <p className="text-[10px] text-zinc-500">{c.profileType} • R$ {c.amount.toLocaleString()}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getStatusColor(c.status)}`}>
                                            {c.status === 'PAID' ? 'Pago' : c.status === 'PARTIAL' ? 'Parcial' : c.status === 'PENDING' ? 'Pendente' : 'Cancelado'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-1">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className={`w-6 h-2 rounded-full ${i <= c.installmentsReleased ? 'bg-emerald-500' : 'bg-zinc-700'
                                                    }`} />
                                            ))}
                                        </div>
                                        <span className="text-emerald-400 font-bold text-sm">R$ {c.totalCommission.toFixed(0)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-zinc-500">
                            <Wallet className="mx-auto mb-2 opacity-30" size={40} />
                            <p className="text-sm">Nenhuma comissão ainda.</p>
                            <p className="text-xs">Indique clientes para começar a ganhar!</p>
                        </div>
                    )}
                </div>

                {/* Bonuses */}
                {(data.bonuses?.length || 0) > 0 && (
                    <div className="bg-gradient-to-br from-purple-900/20 to-zinc-900 border border-purple-700/30 rounded-2xl p-5">
                        <h3 className="font-bold text-sm text-purple-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Gift size={16} /> Bônus de Performance
                        </h3>
                        <div className="space-y-3">
                            {data.bonuses.map(b => (
                                <div key={b.id} className="bg-black/50 border border-zinc-800 rounded-xl p-4 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-white text-sm">{b.month}</p>
                                        <p className="text-xs text-zinc-500">{b.contractsCount} contratos • Tier: {b.bonusTier}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-purple-400">R$ {b.bonusAmount.toFixed(0)}</p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${b.status === 'PAID' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
                                            }`}>
                                            {b.status === 'PAID' ? 'Pago' : 'Pendente'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bonus Rules */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                    <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Star size={16} /> Metas Mensais
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-silver bg-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-xs">🥈</div>
                            <div className="flex-1">
                                <p className="text-zinc-300">{'>'}10 contratos + Inadimplência {'<'}10%</p>
                            </div>
                            <span className="font-bold text-emerald-400">R$ 500</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold text-xs">🥇</div>
                            <div className="flex-1">
                                <p className="text-zinc-300">{'>'}15 contratos + Inadimplência {'<'}5%</p>
                            </div>
                            <span className="font-bold text-[#D4AF37]">R$ 1.000</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
