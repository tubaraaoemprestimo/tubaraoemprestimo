import React, { useState, useEffect } from 'react';
import {
    Landmark, TrendingUp, Shield, AlertCircle, CheckCircle,
    Search, RefreshCw, FileText, DollarSign, PieChart,
    User, CreditCard, Clock, Target, XCircle, Loader2,
    ChevronDown, ChevronUp, Eye, Download, ExternalLink
} from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Customer, CreditScore, IncomeAnalysis } from '../../types';
import { openFinanceService } from '../../services/openFinanceService';
import { supabaseService } from '../../services/supabaseService';

export const OpenFinancePage: React.FC = () => {
    const { addToast } = useToast();

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [currentAnalysis, setCurrentAnalysis] = useState<{
        internalScore: CreditScore;
        serasaScore: CreditScore;
        incomeAnalysis: IncomeAnalysis;
        overallRecommendation: 'APPROVE' | 'REVIEW' | 'DENY';
        suggestedLimit: number;
    } | null>(null);

    const [historicalScores, setHistoricalScores] = useState<CreditScore[]>([]);
    const [historicalAnalyses, setHistoricalAnalyses] = useState<IncomeAnalysis[]>([]);
    const [activeTab, setActiveTab] = useState<'analysis' | 'history' | 'dashboard'>('analysis');
    const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
    const [declaredIncome, setDeclaredIncome] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const customersData = await supabaseService.getCustomers();
            // Add mock monthly income
            const customersWithIncome = customersData.map(c => ({
                ...c,
                monthlyIncome: c.monthlyIncome || (2000 + Math.random() * 8000)
            }));
            setCustomers(customersWithIncome);
            setHistoricalScores(openFinanceService.getScores());
            setHistoricalAnalyses(openFinanceService.getAnalyses());
        } catch (error) {
            console.error('Error loading data:', error);
            addToast('Erro ao carregar dados', 'error');
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cpf.includes(searchTerm)
    );

    const handlePerformAnalysis = async () => {
        if (!selectedCustomer) {
            addToast('Selecione um cliente', 'warning');
            return;
        }

        setIsAnalyzing(true);
        try {
            // Update customer income if declared
            const customerToAnalyze = declaredIncome
                ? { ...selectedCustomer, monthlyIncome: parseFloat(declaredIncome) }
                : selectedCustomer;

            const result = await openFinanceService.performFullAnalysis(customerToAnalyze);
            setCurrentAnalysis(result);

            // Reload historical data
            setHistoricalScores(openFinanceService.getScores());
            setHistoricalAnalyses(openFinanceService.getAnalyses());

            addToast('Análise concluída com sucesso!', 'success');
        } catch (error) {
            console.error('Error performing analysis:', error);
            addToast('Erro ao realizar análise', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getRecommendationBadge = (recommendation: 'APPROVE' | 'REVIEW' | 'DENY') => {
        const config = {
            APPROVE: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'APROVADO', icon: CheckCircle },
            REVIEW: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'EM ANÁLISE', icon: AlertCircle },
            DENY: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'NEGADO', icon: XCircle },
        };
        const c = config[recommendation];
        return (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${c.bg}`}>
                <c.icon size={20} className={c.text} />
                <span className={`font-bold ${c.text}`}>{c.label}</span>
            </div>
        );
    };

    const ScoreGauge: React.FC<{ score: number; classification: CreditScore['classification'] }> = ({ score, classification }) => {
        const color = openFinanceService.getClassificationColor(classification);
        const percentage = (score / 1000) * 100;

        return (
            <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="#27272a"
                        strokeWidth="12"
                        fill="none"
                    />
                    <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke={color}
                        strokeWidth="12"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${percentage * 4.4} 440`}
                        className="transition-all duration-1000"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{score}</span>
                    <span
                        className="text-lg font-bold"
                        style={{ color }}
                    >
                        {classification}
                    </span>
                </div>
            </div>
        );
    };

    const FactorBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span className="text-zinc-400">{label}</span>
                <span className="text-white font-medium">{value}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${value}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[#D4AF37] flex items-center gap-3">
                        <Landmark size={32} /> Open Finance
                    </h1>
                    <p className="text-zinc-400 mt-1">
                        Consulta de score, análise de renda e avaliação de crédito
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadData}>
                        <RefreshCw size={18} /> Atualizar
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <CheckCircle size={20} className="text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {historicalAnalyses.filter(a => a.recommendation === 'APPROVE').length}
                            </p>
                            <p className="text-xs text-zinc-400">Aprovados</p>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg">
                            <AlertCircle size={20} className="text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {historicalAnalyses.filter(a => a.recommendation === 'REVIEW').length}
                            </p>
                            <p className="text-xs text-zinc-400">Em Análise</p>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <XCircle size={20} className="text-red-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {historicalAnalyses.filter(a => a.recommendation === 'DENY').length}
                            </p>
                            <p className="text-xs text-zinc-400">Negados</p>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <FileText size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{historicalScores.length}</p>
                            <p className="text-xs text-zinc-400">Consultas</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-zinc-800 pb-2">
                {[
                    { id: 'analysis', label: 'Nova Análise', icon: Search },
                    { id: 'history', label: 'Histórico', icon: Clock },
                    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === tab.id
                            ? 'bg-[#D4AF37] text-black font-medium'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Analysis Tab */}
            {activeTab === 'analysis' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Customer Selection */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <User size={20} className="text-[#D4AF37]" />
                                Selecionar Cliente
                            </h3>

                            <div className="relative mb-4">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar por nome ou CPF..."
                                    className="w-full bg-black border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-2">
                                {filteredCustomers.map(customer => (
                                    <div
                                        key={customer.id}
                                        onClick={() => {
                                            setSelectedCustomer(customer);
                                            setCurrentAnalysis(null);
                                            setDeclaredIncome(customer.monthlyIncome?.toString() || '');
                                        }}
                                        className={`p-4 rounded-lg cursor-pointer transition-all ${selectedCustomer?.id === customer.id
                                            ? 'bg-[#D4AF37]/20 border border-[#D4AF37]'
                                            : 'bg-black hover:bg-zinc-800 border border-zinc-800'
                                            }`}
                                    >
                                        <p className="text-white font-medium">{customer.name}</p>
                                        <p className="text-sm text-zinc-500">{customer.cpf}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {selectedCustomer && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <DollarSign size={20} className="text-[#D4AF37]" />
                                    Dados para Análise
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-2">Renda Declarada (R$)</label>
                                        <input
                                            type="number"
                                            value={declaredIncome}
                                            onChange={(e) => setDeclaredIncome(e.target.value)}
                                            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                            placeholder="5000.00"
                                        />
                                    </div>

                                    <div className="p-4 bg-black/50 rounded-lg">
                                        <p className="text-sm text-zinc-400 mb-2">Situação Atual:</p>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Dívida Total:</span>
                                            <span className="text-red-400 font-medium">
                                                R$ {selectedCustomer.totalDebt.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm mt-1">
                                            <span className="text-zinc-500">Status:</span>
                                            <span className={selectedCustomer.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}>
                                                {selectedCustomer.status}
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handlePerformAnalysis}
                                        className="w-full"
                                        disabled={isAnalyzing}
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                Consultando APIs...
                                            </>
                                        ) : (
                                            <>
                                                <Search size={18} />
                                                Realizar Análise Completa
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Analysis Results */}
                    <div className="lg:col-span-2">
                        {currentAnalysis ? (
                            <div className="space-y-6">
                                {/* Recommendation */}
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div className="text-center md:text-left">
                                            <h3 className="text-lg text-zinc-400">Recomendação Final</h3>
                                            <p className="text-3xl font-bold text-white mt-2">
                                                Limite Sugerido: R$ {currentAnalysis.suggestedLimit.toLocaleString()}
                                            </p>
                                        </div>
                                        {getRecommendationBadge(currentAnalysis.overallRecommendation)}
                                    </div>
                                </div>

                                {/* Scores */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Internal Score */}
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <Shield size={20} className="text-[#D4AF37]" />
                                            Score Interno
                                        </h3>

                                        <div className="flex justify-center mb-6">
                                            <ScoreGauge
                                                score={currentAnalysis.internalScore.score}
                                                classification={currentAnalysis.internalScore.classification}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <FactorBar
                                                label="Histórico de Pagamento"
                                                value={currentAnalysis.internalScore.factors.paymentHistory}
                                                color="#22c55e"
                                            />
                                            <FactorBar
                                                label="Taxa de Endividamento"
                                                value={currentAnalysis.internalScore.factors.debtRatio}
                                                color="#3b82f6"
                                            />
                                            <FactorBar
                                                label="Tempo de Cliente"
                                                value={currentAnalysis.internalScore.factors.creditAge}
                                                color="#8b5cf6"
                                            />
                                            <FactorBar
                                                label="Consultas Recentes"
                                                value={currentAnalysis.internalScore.factors.recentInquiries}
                                                color="#f59e0b"
                                            />
                                        </div>
                                    </div>

                                    {/* Serasa Score */}
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <ExternalLink size={20} className="text-green-500" />
                                            Score Serasa
                                        </h3>

                                        <div className="flex justify-center mb-6">
                                            <ScoreGauge
                                                score={currentAnalysis.serasaScore.score}
                                                classification={currentAnalysis.serasaScore.classification}
                                            />
                                        </div>

                                        {currentAnalysis.serasaScore.restrictions?.hasRestriction && (
                                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                                                <p className="text-red-400 font-medium flex items-center gap-2">
                                                    <AlertCircle size={16} />
                                                    Restrição Encontrada
                                                </p>
                                                <p className="text-sm text-zinc-400 mt-1">
                                                    {currentAnalysis.serasaScore.restrictions.type}
                                                </p>
                                                {currentAnalysis.serasaScore.restrictions.value && (
                                                    <p className="text-sm text-red-300 mt-1">
                                                        Valor: R$ {currentAnalysis.serasaScore.restrictions.value.toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <FactorBar
                                                label="Histórico de Pagamento"
                                                value={currentAnalysis.serasaScore.factors.paymentHistory}
                                                color="#22c55e"
                                            />
                                            <FactorBar
                                                label="Taxa de Endividamento"
                                                value={currentAnalysis.serasaScore.factors.debtRatio}
                                                color="#3b82f6"
                                            />
                                            <FactorBar
                                                label="Tempo de Crédito"
                                                value={currentAnalysis.serasaScore.factors.creditAge}
                                                color="#8b5cf6"
                                            />
                                            <FactorBar
                                                label="Consultas Recentes"
                                                value={currentAnalysis.serasaScore.factors.recentInquiries}
                                                color="#f59e0b"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Income Analysis */}
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <TrendingUp size={20} className="text-[#D4AF37]" />
                                        Análise de Renda
                                    </h3>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="bg-black/50 rounded-lg p-4 text-center">
                                            <p className="text-2xl font-bold text-green-400">
                                                R$ {currentAnalysis.incomeAnalysis.monthlyIncome.toLocaleString()}
                                            </p>
                                            <p className="text-xs text-zinc-500">Renda Mensal</p>
                                        </div>
                                        <div className="bg-black/50 rounded-lg p-4 text-center">
                                            <p className="text-2xl font-bold text-blue-400">
                                                {currentAnalysis.incomeAnalysis.currentCommitment}%
                                            </p>
                                            <p className="text-xs text-zinc-500">Comprometido</p>
                                        </div>
                                        <div className="bg-black/50 rounded-lg p-4 text-center">
                                            <p className="text-2xl font-bold text-yellow-400">
                                                {currentAnalysis.incomeAnalysis.availableCommitment}%
                                            </p>
                                            <p className="text-xs text-zinc-500">Disponível</p>
                                        </div>
                                        <div className="bg-black/50 rounded-lg p-4 text-center">
                                            <p className="text-2xl font-bold text-[#D4AF37]">
                                                R$ {currentAnalysis.incomeAnalysis.maxLoanAmount.toLocaleString()}
                                            </p>
                                            <p className="text-xs text-zinc-500">Limite Máximo</p>
                                        </div>
                                    </div>

                                    {/* Commitment Bar */}
                                    <div className="mb-4">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-zinc-400">Comprometimento de Renda</span>
                                            <span className="text-zinc-500">Limite: 30%</span>
                                        </div>
                                        <div className="h-4 bg-zinc-800 rounded-full overflow-hidden relative">
                                            <div
                                                className="h-full bg-red-500/50 absolute"
                                                style={{ width: `${currentAnalysis.incomeAnalysis.currentCommitment}%` }}
                                            />
                                            <div
                                                className="h-full bg-green-500/50 absolute"
                                                style={{
                                                    left: `${currentAnalysis.incomeAnalysis.currentCommitment}%`,
                                                    width: `${currentAnalysis.incomeAnalysis.availableCommitment}%`
                                                }}
                                            />
                                            <div
                                                className="absolute top-0 bottom-0 w-0.5 bg-white"
                                                style={{ left: '30%' }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-zinc-500 mt-1">
                                            <span>0%</span>
                                            <span className="text-red-400">Atual: {currentAnalysis.incomeAnalysis.currentCommitment}%</span>
                                            <span>100%</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black/30 rounded-lg p-4">
                                            <p className="text-sm text-zinc-400 mb-1">Fonte de Renda</p>
                                            <p className="text-white font-medium">
                                                {currentAnalysis.incomeAnalysis.incomeSource === 'SALARY' ? 'Assalariado' :
                                                    currentAnalysis.incomeAnalysis.incomeSource === 'BUSINESS' ? 'Empresário' :
                                                        currentAnalysis.incomeAnalysis.incomeSource === 'FREELANCE' ? 'Autônomo' : 'Outros'}
                                            </p>
                                        </div>
                                        <div className="bg-black/30 rounded-lg p-4">
                                            <p className="text-sm text-zinc-400 mb-1">Estabilidade</p>
                                            <p className={`font-medium ${currentAnalysis.incomeAnalysis.stability === 'HIGH' ? 'text-green-400' :
                                                currentAnalysis.incomeAnalysis.stability === 'MEDIUM' ? 'text-yellow-400' :
                                                    'text-red-400'
                                                }`}>
                                                {currentAnalysis.incomeAnalysis.stability === 'HIGH' ? 'Alta' :
                                                    currentAnalysis.incomeAnalysis.stability === 'MEDIUM' ? 'Média' : 'Baixa'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                                <Landmark size={64} className="text-zinc-600 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-zinc-400 mb-2">
                                    Selecione um cliente para análise
                                </h3>
                                <p className="text-zinc-500">
                                    Escolha um cliente na lista ao lado e clique em "Realizar Análise Completa"
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-zinc-800">
                                <tr>
                                    <th className="text-left p-4 text-zinc-400 font-medium">Cliente</th>
                                    <th className="text-left p-4 text-zinc-400 font-medium">Data</th>
                                    <th className="text-left p-4 text-zinc-400 font-medium">Fonte</th>
                                    <th className="text-left p-4 text-zinc-400 font-medium">Score</th>
                                    <th className="text-left p-4 text-zinc-400 font-medium">Classificação</th>
                                    <th className="text-left p-4 text-zinc-400 font-medium">Restrição</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {historicalScores.slice().reverse().map(score => {
                                    const customer = customers.find(c => c.id === score.customerId);
                                    return (
                                        <tr
                                            key={score.id}
                                            className="hover:bg-zinc-800/50 transition-colors"
                                        >
                                            <td className="p-4">
                                                <p className="text-white font-medium">{customer?.name || 'N/A'}</p>
                                                <p className="text-xs text-zinc-500">{customer?.cpf || '-'}</p>
                                            </td>
                                            <td className="p-4 text-zinc-400">
                                                {new Date(score.consultedAt).toLocaleDateString()}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${score.source === 'SERASA' ? 'bg-green-500/20 text-green-400' :
                                                    score.source === 'SPC' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-zinc-700 text-zinc-300'
                                                    }`}>
                                                    {score.source}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-white font-bold">{score.score}</span>
                                            </td>
                                            <td className="p-4">
                                                <span
                                                    className="px-3 py-1 rounded-full text-sm font-bold"
                                                    style={{
                                                        backgroundColor: `${openFinanceService.getClassificationColor(score.classification)}20`,
                                                        color: openFinanceService.getClassificationColor(score.classification)
                                                    }}
                                                >
                                                    {score.classification}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {score.restrictions?.hasRestriction ? (
                                                    <span className="text-red-400 flex items-center gap-1">
                                                        <AlertCircle size={14} /> Sim
                                                    </span>
                                                ) : (
                                                    <span className="text-green-400 flex items-center gap-1">
                                                        <CheckCircle size={14} /> Não
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {historicalScores.length === 0 && (
                        <div className="p-12 text-center">
                            <Clock size={48} className="text-zinc-600 mx-auto mb-4" />
                            <p className="text-zinc-400">Nenhuma consulta realizada ainda</p>
                        </div>
                    )}
                </div>
            )}

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Score Distribution */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Distribuição de Scores</h3>
                        <div className="space-y-4">
                            {['A', 'B', 'C', 'D', 'E'].map(classification => {
                                const count = historicalScores.filter(s => s.classification === classification).length;
                                const percentage = historicalScores.length > 0 ? (count / historicalScores.length) * 100 : 0;
                                const color = openFinanceService.getClassificationColor(classification as CreditScore['classification']);

                                return (
                                    <div key={classification} className="flex items-center gap-4">
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold"
                                            style={{ backgroundColor: `${color}20`, color }}
                                        >
                                            {classification}
                                        </div>
                                        <div className="flex-1">
                                            <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{ width: `${percentage}%`, backgroundColor: color }}
                                                />
                                            </div>
                                        </div>
                                        <span className="text-white font-medium w-12 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Recommendations Distribution */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Recomendações</h3>
                        <div className="flex justify-center gap-8">
                            {[
                                { key: 'APPROVE', label: 'Aprovados', color: '#22c55e' },
                                { key: 'REVIEW', label: 'Em Análise', color: '#eab308' },
                                { key: 'DENY', label: 'Negados', color: '#ef4444' },
                            ].map(({ key, label, color }) => {
                                const count = historicalAnalyses.filter(a => a.recommendation === key).length;

                                return (
                                    <div key={key} className="text-center">
                                        <div
                                            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-2"
                                            style={{ backgroundColor: `${color}20`, color }}
                                        >
                                            {count}
                                        </div>
                                        <p className="text-sm text-zinc-400">{label}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Average Commitment */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Comprometimento Médio</h3>
                        {historicalAnalyses.length > 0 ? (
                            <>
                                <div className="text-center mb-4">
                                    <p className="text-4xl font-bold text-[#D4AF37]">
                                        {(historicalAnalyses.reduce((sum, a) => sum + a.currentCommitment, 0) / historicalAnalyses.length).toFixed(1)}%
                                    </p>
                                    <p className="text-zinc-500">da renda comprometida em média</p>
                                </div>
                                <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#D4AF37] rounded-full transition-all"
                                        style={{
                                            width: `${(historicalAnalyses.reduce((sum, a) => sum + a.currentCommitment, 0) / historicalAnalyses.length)}%`
                                        }}
                                    />
                                </div>
                            </>
                        ) : (
                            <p className="text-center text-zinc-500">Nenhuma análise realizada</p>
                        )}
                    </div>

                    {/* Suggested Limits */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Limites Sugeridos</h3>
                        {historicalAnalyses.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/30 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-green-400">
                                        R$ {Math.max(...historicalAnalyses.map(a => a.maxLoanAmount)).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-zinc-500">Maior Limite</p>
                                </div>
                                <div className="bg-black/30 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-blue-400">
                                        R$ {Math.round(historicalAnalyses.reduce((sum, a) => sum + a.maxLoanAmount, 0) / historicalAnalyses.length).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-zinc-500">Média</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-zinc-500">Nenhuma análise realizada</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
