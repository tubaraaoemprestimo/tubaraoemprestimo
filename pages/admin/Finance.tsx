// 💰 Financial Dashboard - Fluxo de Caixa, DRE, Ranking
import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, BarChart2, PieChart, Users, Calendar, ArrowUpRight, ArrowDownRight, Download } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';
import { supabaseService } from '../../services/supabaseService';
import { financialService, scoreService } from '../../services/adminService';
import { FinancialSummary, Customer, Loan, ClientScore } from '../../types';
import { Button } from '../../components/Button';

export const FinancePage: React.FC = () => {
    const [period, setPeriod] = useState<'month' | 'year'>('month');
    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [viewMode, setViewMode] = useState<'overview' | 'cashflow' | 'ranking'>('overview');

    useEffect(() => {
        loadData();
    }, [period]);

    const loadData = async () => {
        const [customersData, loansData] = await Promise.all([
            supabaseService.getCustomers(),
            supabaseService.getClientLoans()
        ]);
        setCustomers(customersData);
        setLoans(loansData);
        setSummary(financialService.getSummary(loansData, period));
    };

    const bestClients = financialService.getRanking(customers, 'best', 5);
    const worstClients = financialService.getRanking(customers, 'worst', 5);

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
        return `R$ ${value.toLocaleString()}`;
    };

    const dreData = summary ? [
        { name: 'Receita', value: summary.revenue, color: '#22C55E' },
        { name: 'Despesas', value: summary.expenses, color: '#EF4444' },
        { name: 'Lucro', value: summary.profit, color: '#D4AF37' }
    ] : [];

    const flowData = summary ? [
        { name: 'Emprestado', value: summary.loansDisbursed, color: '#3B82F6' },
        { name: 'Recebido', value: summary.paymentsReceived, color: '#22C55E' },
        { name: 'Inadimplente', value: summary.defaultedAmount, color: '#EF4444' }
    ] : [];

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                    <DollarSign size={32} /> Dashboard Financeiro
                </h1>
                <div className="flex gap-2">
                    {(['overview', 'cashflow', 'ranking'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === mode ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                        >
                            {mode === 'overview' ? 'Visão Geral' : mode === 'cashflow' ? 'Fluxo de Caixa' : 'Ranking'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 mb-8">
                <button
                    onClick={() => setPeriod('month')}
                    className={`px-4 py-2 rounded-lg text-sm ${period === 'month' ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400'
                        }`}
                >
                    Este Mês
                </button>
                <button
                    onClick={() => setPeriod('year')}
                    className={`px-4 py-2 rounded-lg text-sm ${period === 'year' ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400'
                        }`}
                >
                    Este Ano
                </button>
            </div>

            {viewMode === 'overview' && summary && (
                <>
                    {/* Main KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-gradient-to-br from-green-500/20 to-green-900/10 border border-green-500/30 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="text-green-400" size={20} />
                                <span className="text-zinc-400 text-sm">Receita</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{formatCurrency(summary.revenue)}</p>
                            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                <ArrowUpRight size={12} /> +15% vs período anterior
                            </p>
                        </div>
                        <div className="bg-gradient-to-br from-red-500/20 to-red-900/10 border border-red-500/30 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingDown className="text-red-400" size={20} />
                                <span className="text-zinc-400 text-sm">Despesas</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{formatCurrency(summary.expenses)}</p>
                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                <ArrowDownRight size={12} /> -5% vs período anterior
                            </p>
                        </div>
                        <div className="bg-gradient-to-br from-[#D4AF37]/20 to-yellow-900/10 border border-[#D4AF37]/30 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="text-[#D4AF37]" size={20} />
                                <span className="text-zinc-400 text-sm">Lucro</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{formatCurrency(summary.profit)}</p>
                            <p className="text-xs text-[#D4AF37] mt-1">
                                Margem: {summary.revenue > 0 ? ((summary.profit / summary.revenue) * 100).toFixed(1) : 0}%
                            </p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-900/10 border border-blue-500/30 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <BarChart2 className="text-blue-400" size={20} />
                                <span className="text-zinc-400 text-sm">Emprestado</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{formatCurrency(summary.loansDisbursed)}</p>
                            <p className="text-xs text-blue-400 mt-1">{loans.length} empréstimos ativos</p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* DRE Chart */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-6">DRE Simplificado</h3>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dreData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis type="number" stroke="#666" tickFormatter={(v) => formatCurrency(v)} />
                                        <YAxis type="category" dataKey="name" stroke="#666" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                                            formatter={(value: number) => [formatCurrency(value), '']}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {dreData.map((entry, index) => (
                                                <Cell key={index} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Flow Distribution */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-6">Distribuição do Fluxo</h3>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={flowData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={3}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {flowData.map((entry, index) => (
                                                <Cell key={index} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                                            formatter={(value: number) => [formatCurrency(value), '']}
                                        />
                                    </RePieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-4 mt-4">
                                {flowData.map((item) => (
                                    <div key={item.name} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs text-zinc-400">{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {viewMode === 'cashflow' && summary && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-6">Fluxo de Caixa - Últimos 7 Dias</h3>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={summary.cashFlow}>
                                <defs>
                                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#666"
                                    tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                />
                                <YAxis stroke="#666" tickFormatter={(v) => formatCurrency(v)} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                                    formatter={(value: number) => [formatCurrency(value), '']}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR')}
                                />
                                <Area type="monotone" dataKey="inflow" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" name="Entrada" />
                                <Area type="monotone" dataKey="outflow" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" name="Saída" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Cash Flow Table */}
                    <div className="mt-6 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800">
                                    <th className="text-left py-3 text-zinc-400 font-medium">Data</th>
                                    <th className="text-right py-3 text-zinc-400 font-medium">Entradas</th>
                                    <th className="text-right py-3 text-zinc-400 font-medium">Saídas</th>
                                    <th className="text-right py-3 text-zinc-400 font-medium">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.cashFlow.map((day) => (
                                    <tr key={day.date} className="border-b border-zinc-800/50">
                                        <td className="py-3 text-white">{new Date(day.date).toLocaleDateString('pt-BR')}</td>
                                        <td className="py-3 text-right text-green-400">{formatCurrency(day.inflow)}</td>
                                        <td className="py-3 text-right text-red-400">{formatCurrency(day.outflow)}</td>
                                        <td className={`py-3 text-right font-bold ${day.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatCurrency(day.balance)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {viewMode === 'ranking' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Best Clients */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <TrendingUp className="text-green-400" size={20} />
                            Top Pagadores
                        </h3>
                        <div className="space-y-4">
                            {bestClients.map((client, index) => (
                                <div key={client.id} className="flex items-center gap-4 p-3 bg-black rounded-xl">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-[#D4AF37] text-black' :
                                            index === 1 ? 'bg-zinc-400 text-black' :
                                                index === 2 ? 'bg-amber-700 text-white' :
                                                    'bg-zinc-800 text-zinc-400'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-white">{client.name}</p>
                                        <p className="text-sm text-zinc-400">{client.activeLoansCount} empréstimo(s) ativo(s)</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-green-400">{client.internalScore || 500}</p>
                                        <p className="text-xs text-zinc-500">score</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Worst Clients */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <TrendingDown className="text-red-400" size={20} />
                            Clientes em Risco
                        </h3>
                        <div className="space-y-4">
                            {worstClients.map((client, index) => (
                                <div key={client.id} className="flex items-center gap-4 p-3 bg-black rounded-xl border border-red-900/30">
                                    <div className="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center font-bold text-red-400">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-white">{client.name}</p>
                                        <p className="text-sm text-red-400">Dívida: R$ {client.totalDebt.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-red-400">{client.internalScore || 500}</p>
                                        <p className="text-xs text-zinc-500">score</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
