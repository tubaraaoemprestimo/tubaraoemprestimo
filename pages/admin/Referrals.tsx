import React, { useState, useEffect } from 'react';
import { Gift, Check, X, Search, UserPlus, Clock, CheckCircle2, XCircle, DollarSign, RefreshCcw } from 'lucide-react';
import { Button } from '../../components/Button';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../components/Toast';
import { Referral } from '../../types';

export const Referrals: React.FC = () => {
    const { addToast } = useToast();
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [search, setSearch] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    // Configuração de bônus
    const [bonusAmount, setBonusAmount] = useState(50);

    useEffect(() => {
        loadReferrals();
        loadBonusConfig();
    }, []);

    const loadReferrals = async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from('referrals')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading referrals:', error);
            setReferrals([]);
        } else {
            setReferrals(data.map((r: any) => ({
                id: r.id,
                referrerCustomerId: r.referrer_customer_id,
                referrerCode: r.referrer_code,
                referrerName: r.referrer_name,
                referrerEmail: r.referrer_email,
                referredName: r.referred_name,
                referredCpf: r.referred_cpf,
                referredPhone: r.referred_phone,
                referredEmail: r.referred_email,
                status: r.status,
                rejectionReason: r.rejection_reason,
                bonusAmount: r.bonus_amount,
                bonusPaidAt: r.bonus_paid_at,
                createdAt: r.created_at,
                approvedAt: r.approved_at,
                approvedBy: r.approved_by
            })));
        }

        setLoading(false);
    };

    const loadBonusConfig = async () => {
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'referral_bonus')
            .single();

        if (data?.value) {
            setBonusAmount(Number(data.value) || 50);
        }
    };

    const handleApprove = async (referral: Referral) => {
        setProcessing(referral.id);

        const { error } = await supabase
            .from('referrals')
            .update({
                status: 'APPROVED',
                bonus_amount: bonusAmount,
                approved_at: new Date().toISOString()
            })
            .eq('id', referral.id);

        if (error) {
            addToast('Erro ao aprovar indicação', 'error');
        } else {
            addToast(`Indicação aprovada! Bônus de R$ ${bonusAmount} será creditado.`, 'success');
            loadReferrals();
        }

        setProcessing(null);
    };

    const handleReject = async (referral: Referral, reason: string) => {
        setProcessing(referral.id);

        const { error } = await supabase
            .from('referrals')
            .update({
                status: 'REJECTED',
                rejection_reason: reason
            })
            .eq('id', referral.id);

        if (error) {
            addToast('Erro ao rejeitar indicação', 'error');
        } else {
            addToast('Indicação rejeitada.', 'info');
            loadReferrals();
        }

        setProcessing(null);
    };

    const handlePayBonus = async (referral: Referral) => {
        setProcessing(referral.id);

        const { error } = await supabase
            .from('referrals')
            .update({
                status: 'BONUS_PAID',
                bonus_paid_at: new Date().toISOString()
            })
            .eq('id', referral.id);

        if (error) {
            addToast('Erro ao marcar bônus como pago', 'error');
        } else {
            addToast('Bônus marcado como pago!', 'success');
            loadReferrals();
        }

        setProcessing(null);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING':
                return <span className="px-3 py-1 bg-yellow-900/30 text-yellow-400 border border-yellow-700/50 rounded-full text-xs font-bold flex items-center gap-1"><Clock size={12} /> Pendente</span>;
            case 'APPROVED':
                return <span className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-700/50 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12} /> Aprovado</span>;
            case 'REJECTED':
                return <span className="px-3 py-1 bg-red-900/30 text-red-400 border border-red-700/50 rounded-full text-xs font-bold flex items-center gap-1"><XCircle size={12} /> Rejeitado</span>;
            case 'BONUS_PAID':
                return <span className="px-3 py-1 bg-purple-900/30 text-purple-400 border border-purple-700/50 rounded-full text-xs font-bold flex items-center gap-1"><DollarSign size={12} /> Bônus Pago</span>;
            default:
                return null;
        }
    };

    const filteredReferrals = referrals
        .filter(r => filter === 'ALL' || r.status === filter)
        .filter(r =>
            !search ||
            r.referrerName?.toLowerCase().includes(search.toLowerCase()) ||
            r.referredName?.toLowerCase().includes(search.toLowerCase()) ||
            r.referrerCode?.toLowerCase().includes(search.toLowerCase())
        );

    const stats = {
        total: referrals.length,
        pending: referrals.filter(r => r.status === 'PENDING').length,
        approved: referrals.filter(r => r.status === 'APPROVED').length,
        bonusPaid: referrals.filter(r => r.status === 'BONUS_PAID').length,
        totalBonus: referrals.filter(r => r.status === 'BONUS_PAID').reduce((sum, r) => sum + (r.bonusAmount || 0), 0)
    };

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-purple-400 flex items-center gap-2">
                        <Gift size={32} /> Indique e Ganhe
                    </h1>
                    <p className="text-zinc-400 text-sm mt-1">Gerencie indicações e aprove bônus para clientes</p>
                </div>

                <Button onClick={loadReferrals} variant="secondary">
                    <RefreshCcw size={18} className="mr-2" /> Atualizar
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs uppercase">Total</p>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs uppercase">Pendentes</p>
                    <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs uppercase">Aprovados</p>
                    <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs uppercase">Bônus Pagos</p>
                    <p className="text-2xl font-bold text-purple-400">{stats.bonusPaid}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs uppercase">Total Pago</p>
                    <p className="text-2xl font-bold text-[#D4AF37]">R$ {stats.totalBonus.toLocaleString('pt-BR')}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou código..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-purple-500 outline-none"
                    />
                </div>

                <div className="flex gap-2">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === f
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                        >
                            {f === 'ALL' ? 'Todos' : f === 'PENDING' ? 'Pendentes' : f === 'APPROVED' ? 'Aprovados' : 'Rejeitados'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-zinc-950 text-zinc-400 text-sm uppercase tracking-wider">
                            <tr>
                                <th className="p-4">Indicador</th>
                                <th className="p-4">Código</th>
                                <th className="p-4">Indicado</th>
                                <th className="p-4">Data</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Bônus</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {loading ? (
                                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Carregando...</td></tr>
                            ) : filteredReferrals.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Nenhuma indicação encontrada.</td></tr>
                            ) : (
                                filteredReferrals.map((ref) => (
                                    <tr key={ref.id} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-white">{ref.referrerName || 'Anônimo'}</div>
                                            <div className="text-xs text-zinc-500">{ref.referrerEmail}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono font-bold text-purple-400 bg-purple-900/30 px-2 py-1 rounded">
                                                {ref.referrerCode}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-white">{ref.referredName}</div>
                                            <div className="text-xs text-zinc-500">{ref.referredPhone}</div>
                                        </td>
                                        <td className="p-4 text-zinc-400 text-sm">
                                            {new Date(ref.createdAt).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="p-4">
                                            {getStatusBadge(ref.status)}
                                        </td>
                                        <td className="p-4">
                                            {ref.bonusAmount > 0 && (
                                                <span className="text-[#D4AF37] font-bold">R$ {ref.bonusAmount}</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {ref.status === 'PENDING' && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleApprove(ref)}
                                                            isLoading={processing === ref.id}
                                                            className="bg-green-600 hover:bg-green-700"
                                                        >
                                                            <Check size={16} />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="danger"
                                                            onClick={() => handleReject(ref, 'Indicação inválida')}
                                                            isLoading={processing === ref.id}
                                                        >
                                                            <X size={16} />
                                                        </Button>
                                                    </>
                                                )}
                                                {ref.status === 'APPROVED' && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handlePayBonus(ref)}
                                                        isLoading={processing === ref.id}
                                                        className="bg-purple-600 hover:bg-purple-700"
                                                    >
                                                        <DollarSign size={16} className="mr-1" /> Pagar Bônus
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
