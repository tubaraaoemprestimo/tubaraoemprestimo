// ⭐ Score & Renegotiation - Score de clientes e simulador de renegociação
import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, Calculator, RefreshCw, Users, AlertTriangle, CheckCircle, Zap, Target, DollarSign, Percent, Clock, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { scoreService, renegotiationService } from '../../services/adminService';
import { supabaseService } from '../../services/supabaseService';
import { ClientScore, RenegotiationProposal, Customer, Loan } from '../../types';
import { useToast } from '../../components/Toast';

export const ScorePage: React.FC = () => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'scores' | 'simulator' | 'proposals'>('scores');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [scores, setScores] = useState<ClientScore[]>([]);
    const [proposals, setProposals] = useState<RenegotiationProposal[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);

    // Simulator state
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedLoanId, setSelectedLoanId] = useState('');
    const [discountPercent, setDiscountPercent] = useState(10);
    const [newInstallments, setNewInstallments] = useState(12);
    const [interestRate, setInterestRate] = useState(5);
    const [simulationResult, setSimulationResult] = useState<RenegotiationProposal | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [customersData, loansData] = await Promise.all([
            supabaseService.getCustomers(),
            supabaseService.getClientLoans()
        ]);
        setCustomers(customersData);
        setLoans(loansData);
        setScores(scoreService.getAllScores());
        setProposals(renegotiationService.getAll());
    };

    const handleCalculateAllScores = async () => {
        setIsCalculating(true);
        for (const customer of customers) {
            const customerLoans = loans.filter(l => l.id.startsWith(customer.id));
            scoreService.calculate(customer, customerLoans);
        }
        setScores(scoreService.getAllScores());
        setIsCalculating(false);
        addToast(`Scores calculados para ${customers.length} clientes`, 'success');
    };

    const handleSimulate = () => {
        if (!selectedCustomerId || !selectedLoanId) {
            addToast('Selecione cliente e empréstimo', 'warning');
            return;
        }

        const customer = customers.find(c => c.id === selectedCustomerId);
        const loan = loans.find(l => l.id === selectedLoanId);

        if (!customer || !loan) return;

        const proposal = renegotiationService.calculateProposal(
            customer,
            loan,
            discountPercent,
            newInstallments,
            interestRate
        );

        setSimulationResult(proposal);
    };

    const handleSaveProposal = () => {
        if (!simulationResult) return;
        renegotiationService.save(simulationResult);
        addToast('Proposta salva com sucesso!', 'success');
        setSimulationResult(null);
        loadData();
    };

    const getScoreColor = (level: ClientScore['level']) => {
        const colors: Record<ClientScore['level'], string> = {
            EXCELLENT: 'text-green-400 bg-green-900/30',
            GOOD: 'text-blue-400 bg-blue-900/30',
            REGULAR: 'text-yellow-400 bg-yellow-900/30',
            BAD: 'text-orange-400 bg-orange-900/30',
            CRITICAL: 'text-red-400 bg-red-900/30'
        };
        return colors[level];
    };

    const getScoreLabel = (level: ClientScore['level']) => {
        const labels: Record<ClientScore['level'], string> = {
            EXCELLENT: 'Excelente',
            GOOD: 'Bom',
            REGULAR: 'Regular',
            BAD: 'Ruim',
            CRITICAL: 'Crítico'
        };
        return labels[level];
    };

    const customerLoans = selectedCustomerId
        ? loans.filter(l => l.id.startsWith(selectedCustomerId))
        : [];

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                    <Star size={32} /> Score & Renegociação
                </h1>
                {activeTab === 'scores' && (
                    <Button onClick={handleCalculateAllScores} isLoading={isCalculating}>
                        <RefreshCw size={18} /> Recalcular Todos
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 bg-zinc-900/50 p-1 rounded-xl w-fit border border-zinc-800">
                {(['scores', 'simulator', 'proposals'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-[#D4AF37] text-black' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        {tab === 'scores' ? 'Scores' : tab === 'simulator' ? 'Simulador' : 'Propostas'}
                    </button>
                ))}
            </div>

            {activeTab === 'scores' && (
                <>
                    {/* Score Distribution */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                        {(['EXCELLENT', 'GOOD', 'REGULAR', 'BAD', 'CRITICAL'] as const).map(level => (
                            <div key={level} className={`rounded-xl p-4 ${getScoreColor(level)}`}>
                                <p className="text-sm opacity-70">{getScoreLabel(level)}</p>
                                <p className="text-2xl font-bold">{scores.filter(s => s.level === level).length}</p>
                            </div>
                        ))}
                    </div>

                    {/* Score List */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-800 bg-zinc-800/50">
                                        <th className="text-left py-4 px-6 text-zinc-400 font-medium">Cliente</th>
                                        <th className="text-center py-4 px-6 text-zinc-400 font-medium">Score</th>
                                        <th className="text-center py-4 px-6 text-zinc-400 font-medium">Nível</th>
                                        <th className="text-center py-4 px-6 text-zinc-400 font-medium">Pagamentos</th>
                                        <th className="text-center py-4 px-6 text-zinc-400 font-medium">Atrasos</th>
                                        <th className="text-right py-4 px-6 text-zinc-400 font-medium">Limite Sugerido</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scores.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-zinc-500">
                                                <Star size={48} className="mx-auto mb-4 opacity-50" />
                                                <p>Clique em "Recalcular Todos" para gerar os scores</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        scores.sort((a, b) => b.score - a.score).map(score => {
                                            const customer = customers.find(c => c.id === score.customerId);
                                            return (
                                                <tr key={score.customerId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                    <td className="py-4 px-6">
                                                        <p className="font-bold text-white">{customer?.name || 'N/A'}</p>
                                                        <p className="text-xs text-zinc-500">{score.factors.relationshipMonths} meses de relacionamento</p>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <div className="inline-flex items-center gap-2">
                                                            <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${score.level === 'EXCELLENT' ? 'bg-green-400' :
                                                                        score.level === 'GOOD' ? 'bg-blue-400' :
                                                                            score.level === 'REGULAR' ? 'bg-yellow-400' :
                                                                                score.level === 'BAD' ? 'bg-orange-400' : 'bg-red-400'}`}
                                                                    style={{ width: `${score.score / 10}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-bold text-white">{score.score}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <span className={`text-xs px-3 py-1 rounded-full ${getScoreColor(score.level)}`}>
                                                            {getScoreLabel(score.level)}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <span className="text-green-400">{score.factors.onTimePayments}</span>
                                                        <span className="text-zinc-500"> / </span>
                                                        <span className="text-white">{score.factors.paymentHistory}</span>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        {score.factors.latePayments > 0 ? (
                                                            <span className="text-red-400">{score.factors.latePayments}</span>
                                                        ) : (
                                                            <CheckCircle className="text-green-400 mx-auto" size={18} />
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-right font-bold text-[#D4AF37]">
                                                        R$ {score.suggestedLimit.toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'simulator' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Simulator Form */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Calculator size={24} className="text-[#D4AF37]" />
                            Simulador de Renegociação
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Cliente</label>
                                <select
                                    value={selectedCustomerId}
                                    onChange={(e) => { setSelectedCustomerId(e.target.value); setSelectedLoanId(''); }}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                >
                                    <option value="">Selecione um cliente</option>
                                    {customers.filter(c => c.totalDebt > 0).map(c => (
                                        <option key={c.id} value={c.id}>{c.name} - Dívida: R$ {c.totalDebt.toLocaleString()}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedCustomerId && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Empréstimo</label>
                                    <select
                                        value={selectedLoanId}
                                        onChange={(e) => setSelectedLoanId(e.target.value)}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                    >
                                        <option value="">Selecione um empréstimo</option>
                                        {customerLoans.map(l => (
                                            <option key={l.id} value={l.id}>
                                                R$ {l.amount.toLocaleString()} - Restante: R$ {l.remainingAmount.toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Desconto (%)</label>
                                    <input
                                        type="number"
                                        value={discountPercent}
                                        onChange={(e) => setDiscountPercent(Number(e.target.value))}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                        min={0}
                                        max={50}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Parcelas</label>
                                    <input
                                        type="number"
                                        value={newInstallments}
                                        onChange={(e) => setNewInstallments(Number(e.target.value))}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                        min={1}
                                        max={48}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Juros (%)</label>
                                    <input
                                        type="number"
                                        value={interestRate}
                                        onChange={(e) => setInterestRate(Number(e.target.value))}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                        min={0}
                                        step={0.5}
                                    />
                                </div>
                            </div>

                            <Button onClick={handleSimulate} className="w-full">
                                <Zap size={18} /> Simular Proposta
                            </Button>
                        </div>
                    </div>

                    {/* Simulation Result */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Target size={24} className="text-[#D4AF37]" />
                            Resultado da Simulação
                        </h2>

                        {!simulationResult ? (
                            <div className="text-center py-12 text-zinc-500">
                                <Calculator size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Preencha os dados e clique em "Simular"</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-black rounded-xl p-4">
                                    <p className="text-zinc-400 text-sm">Cliente</p>
                                    <p className="text-xl font-bold text-white">{simulationResult.customerName}</p>
                                    <p className="text-sm text-red-400">{simulationResult.daysOverdue} dias em atraso</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black rounded-xl p-4">
                                        <p className="text-zinc-400 text-sm">Dívida Original</p>
                                        <p className="text-xl font-bold text-white line-through">
                                            R$ {simulationResult.remainingAmount.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-green-900/30 rounded-xl p-4 border border-green-500/30">
                                        <p className="text-green-400 text-sm">Nova Dívida</p>
                                        <p className="text-xl font-bold text-green-400">
                                            R$ {simulationResult.proposal.newAmount.toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-4 text-center">
                                    <p className="text-[#D4AF37] text-sm">Economia do Cliente</p>
                                    <p className="text-3xl font-bold text-[#D4AF37]">
                                        R$ {simulationResult.proposal.discount.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-zinc-400">
                                        ({simulationResult.proposal.discountPercent}% de desconto)
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black rounded-xl p-4">
                                        <p className="text-zinc-400 text-sm">Novas Parcelas</p>
                                        <p className="text-xl font-bold text-white">
                                            {simulationResult.proposal.newInstallments}x de R$ {simulationResult.proposal.newInstallmentValue.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-black rounded-xl p-4">
                                        <p className="text-zinc-400 text-sm">Válido até</p>
                                        <p className="text-xl font-bold text-white">
                                            {new Date(simulationResult.expiresAt).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>

                                <Button onClick={handleSaveProposal} className="w-full">
                                    <CheckCircle size={18} /> Salvar Proposta
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'proposals' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-800/50">
                                    <th className="text-left py-4 px-6 text-zinc-400 font-medium">Cliente</th>
                                    <th className="text-center py-4 px-6 text-zinc-400 font-medium">Dívida Original</th>
                                    <th className="text-center py-4 px-6 text-zinc-400 font-medium">Nova Proposta</th>
                                    <th className="text-center py-4 px-6 text-zinc-400 font-medium">Desconto</th>
                                    <th className="text-center py-4 px-6 text-zinc-400 font-medium">Status</th>
                                    <th className="text-center py-4 px-6 text-zinc-400 font-medium">Validade</th>
                                </tr>
                            </thead>
                            <tbody>
                                {proposals.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-zinc-500">
                                            Nenhuma proposta criada
                                        </td>
                                    </tr>
                                ) : (
                                    proposals.map(proposal => (
                                        <tr key={proposal.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                            <td className="py-4 px-6 font-bold text-white">{proposal.customerName}</td>
                                            <td className="py-4 px-6 text-center text-zinc-400">
                                                R$ {proposal.remainingAmount.toLocaleString()}
                                            </td>
                                            <td className="py-4 px-6 text-center text-green-400">
                                                R$ {proposal.proposal.newAmount.toLocaleString()}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <span className="bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-1 rounded text-sm">
                                                    -{proposal.proposal.discountPercent}%
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs ${proposal.status === 'PENDING' ? 'bg-yellow-900/50 text-yellow-400' :
                                                        proposal.status === 'ACCEPTED' ? 'bg-green-900/50 text-green-400' :
                                                            proposal.status === 'REJECTED' ? 'bg-red-900/50 text-red-400' :
                                                                'bg-zinc-800 text-zinc-400'
                                                    }`}>
                                                    {proposal.status === 'PENDING' ? 'Pendente' :
                                                        proposal.status === 'ACCEPTED' ? 'Aceita' :
                                                            proposal.status === 'REJECTED' ? 'Rejeitada' : 'Expirada'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-center text-zinc-400">
                                                {new Date(proposal.expiresAt).toLocaleDateString('pt-BR')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
