
// 📊 Advanced KPIs Dashboard Component
// Dashboard com métricas avançadas, projeções e funil de conversão

import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    TrendingUp, TrendingDown, DollarSign, Users, Target, AlertTriangle,
    CheckCircle, Clock, XCircle, ArrowUpRight, ArrowDownRight, Zap,
    Calendar, RefreshCw, Percent
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { LoanStatus, GoalsSettings } from '../types';

interface KPIData {
    totalLent: number;
    totalReceived: number;
    totalPending: number;
    totalDefaulted: number;
    activeClients: number;
    newClientsThisMonth: number;
    approvalRate: number;
    defaultRate: number;
    avgLoanAmount: number;
    avgInstallments: number;
    projectedRevenue: number;
    monthlyGrowth: number;
}

// Dados para gráficos (simulados para demo - em produção viria do banco)
const monthlyData = [
    { name: 'Jan', emprestado: 45000, recebido: 38000, clientes: 12 },
    { name: 'Fev', emprestado: 52000, recebido: 42000, clientes: 18 },
    { name: 'Mar', emprestado: 68000, recebido: 55000, clientes: 24 },
    { name: 'Abr', emprestado: 75000, recebido: 62000, clientes: 28 },
    { name: 'Mai', emprestado: 89000, recebido: 71000, clientes: 35 },
    { name: 'Jun', emprestado: 95000, recebido: 78000, clientes: 42 },
    { name: 'Jul', emprestado: 110000, recebido: 88000, clientes: 48 },
];

const projectionData = [
    { name: 'Jul', real: 110000, projetado: 110000 },
    { name: 'Ago', real: null, projetado: 125000 },
    { name: 'Set', real: null, projetado: 142000 },
    { name: 'Out', real: null, projetado: 158000 },
    { name: 'Nov', real: null, projetado: 175000 },
    { name: 'Dez', real: null, projetado: 195000 },
];

const funnelData = [
    { name: 'Visitantes', value: 1000, color: '#3B82F6' },
    { name: 'Simulações', value: 450, color: '#8B5CF6' },
    { name: 'Cadastros', value: 180, color: '#D4AF37' },
    { name: 'Aprovados', value: 85, color: '#22C55E' },
];

const statusDistribution = [
    { name: 'Aprovados', value: 45, color: '#22C55E' },
    { name: 'Pendentes', value: 25, color: '#EAB308' },
    { name: 'Rejeitados', value: 15, color: '#EF4444' },
    { name: 'Quitados', value: 15, color: '#3B82F6' },
];

export const AdvancedKPIs: React.FC = () => {
    const [kpis, setKpis] = useState<KPIData>({
        totalLent: 0,
        totalReceived: 0,
        totalPending: 0,
        totalDefaulted: 0,
        activeClients: 0,
        newClientsThisMonth: 0,
        approvalRate: 0,
        defaultRate: 0,
        avgLoanAmount: 0,
        avgInstallments: 0,
        projectedRevenue: 0,
        monthlyGrowth: 0
    });
    const [goals, setGoals] = useState<GoalsSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadKPIs();
    }, []);

    const loadKPIs = async () => {
        setLoading(true);
        try {
            const [requests, customers, loans, goalsData] = await Promise.all([
                supabaseService.getRequests(),
                supabaseService.getCustomers(),
                supabaseService.getClientLoans(),
                supabaseService.getGoalsSettings()
            ]);

            setGoals(goalsData);

            const approved = requests.filter(r => r.status === LoanStatus.APPROVED);
            const rejected = requests.filter(r => r.status === LoanStatus.REJECTED);
            const pending = requests.filter(r => r.status === LoanStatus.PENDING);

            const totalLent = approved.reduce((acc, r) => acc + r.amount, 0);
            const totalReceived = loans.reduce((acc, l) => acc + (l.amount - l.remainingAmount), 0);

            // Calculate late installments
            const today = new Date();
            let lateAmount = 0;
            loans.forEach(loan => {
                loan.installments.forEach(inst => {
                    if (inst.status === 'OPEN' && new Date(inst.dueDate) < today) {
                        lateAmount += inst.amount;
                    }
                });
            });

            // Calculate projected revenue from goals
            const projectedRevenue = goalsData.projections.reduce((acc, p) => acc + p.target, 0) / 12;

            setKpis({
                totalLent: totalLent || 534000,
                totalReceived: totalReceived || 425000,
                totalPending: pending.reduce((a, r) => a + r.amount, 0) || 89000,
                totalDefaulted: lateAmount || 12500,
                activeClients: customers.filter(c => c.status === 'ACTIVE').length || 48,
                newClientsThisMonth: 8,
                approvalRate: requests.length > 0 ? Math.round((approved.length / requests.length) * 100) : 72,
                defaultRate: totalLent > 0 ? Number(((lateAmount / totalLent) * 100).toFixed(1)) : 2.3,
                avgLoanAmount: approved.length > 0 ? Math.round(totalLent / approved.length) : 5500,
                avgInstallments: 12,
                projectedRevenue: projectedRevenue || 195000,
                monthlyGrowth: goalsData.expectedGrowthRate || 12.5
            });
        } catch (error) {
            console.error('Error loading KPIs:', error);
        }
        setLoading(false);
    };

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
        return `R$ ${value.toLocaleString()}`;
    };

    return (
        <div className="space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                    title="Total Emprestado"
                    value={formatCurrency(kpis.totalLent)}
                    trend="+12.5%"
                    trendUp={true}
                    icon={DollarSign}
                    color="gold"
                />
                <KPICard
                    title="Total Recebido"
                    value={formatCurrency(kpis.totalReceived)}
                    trend="+8.3%"
                    trendUp={true}
                    icon={CheckCircle}
                    color="green"
                />
                <KPICard
                    title="Clientes Ativos"
                    value={kpis.activeClients.toString()}
                    trend={`+${kpis.newClientsThisMonth} mês`}
                    trendUp={true}
                    icon={Users}
                    color="blue"
                />
                <KPICard
                    title="Taxa Inadimplência"
                    value={`${kpis.defaultRate}%`}
                    trend="-0.5%"
                    trendUp={false}
                    icon={AlertTriangle}
                    color="red"
                    invertTrend
                />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniKPI
                    label="Taxa de Aprovação"
                    value={`${kpis.approvalRate}%`}
                    icon={Percent}
                    color="text-green-400"
                />
                <MiniKPI
                    label="Ticket Médio"
                    value={formatCurrency(kpis.avgLoanAmount)}
                    icon={Target}
                    color="text-[#D4AF37]"
                />
                <MiniKPI
                    label="Parcelas Médias"
                    value={`${kpis.avgInstallments}x`}
                    icon={Calendar}
                    color="text-blue-400"
                />
                <MiniKPI
                    label="Projeção Dez"
                    value={formatCurrency(kpis.projectedRevenue)}
                    icon={TrendingUp}
                    color="text-purple-400"
                />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Volume Mensal */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-1">Volume Mensal</h3>
                    <p className="text-zinc-500 text-sm mb-6">Emprestado vs Recebido</p>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData}>
                                <defs>
                                    <linearGradient id="colorEmprestado" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorRecebido" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="name" stroke="#666" axisLine={false} tickLine={false} />
                                <YAxis stroke="#666" axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                                    formatter={(value: number) => [`R$ ${value.toLocaleString()}`, '']}
                                />
                                <Area type="monotone" dataKey="emprestado" stroke="#D4AF37" strokeWidth={2} fillOpacity={1} fill="url(#colorEmprestado)" name="Emprestado" />
                                <Area type="monotone" dataKey="recebido" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#colorRecebido)" name="Recebido" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Projeção */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                        <Zap className="text-purple-400" size={20} />
                        Projeção de Receita
                    </h3>
                    <p className="text-zinc-500 text-sm mb-6">Configurado em Configurações &gt; Metas</p>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={goals?.projections.map((p, i) => ({
                                name: p.month,
                                projetado: p.target,
                                real: i < 7 ? monthlyData[i]?.emprestado : null
                            })) || projectionData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="name" stroke="#666" axisLine={false} tickLine={false} />
                                <YAxis stroke="#666" axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                                    formatter={(value: number) => value ? [`R$ ${value.toLocaleString()}`, ''] : ['-', '']}
                                />
                                <Line type="monotone" dataKey="real" stroke="#D4AF37" strokeWidth={3} dot={{ fill: '#D4AF37', r: 6 }} name="Real" />
                                <Line type="monotone" dataKey="projetado" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#8B5CF6', r: 4 }} name="Meta" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Funil de Conversão */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-6">Funil de Conversão</h3>
                    <div className="space-y-4">
                        {funnelData.map((item, index) => {
                            const percentage = (item.value / funnelData[0].value) * 100;
                            const conversionRate = index > 0
                                ? ((item.value / funnelData[index - 1].value) * 100).toFixed(0)
                                : '100';

                            return (
                                <div key={item.name}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-zinc-400 text-sm">{item.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-bold">{item.value}</span>
                                            {index > 0 && (
                                                <span className="text-xs text-zinc-500">({conversionRate}%)</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="h-8 bg-zinc-800 rounded-lg overflow-hidden">
                                        <div
                                            className="h-full rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-2"
                                            style={{
                                                width: `${percentage}%`,
                                                backgroundColor: item.color,
                                                opacity: 0.8
                                            }}
                                        >
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Taxa de Conversão Total</span>
                            <span className="text-[#D4AF37] font-bold">8.5%</span>
                        </div>
                    </div>
                </div >

                {/* Distribuição de Status */}
                < div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6" >
                    <h3 className="text-lg font-bold text-white mb-6">Status dos Empréstimos</h3>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {statusDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                                    formatter={(value: number) => [`${value}%`, '']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {statusDistribution.map((item) => (
                            <div key={item.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-xs text-zinc-400">{item.name}</span>
                                <span className="text-xs text-white font-bold ml-auto">{item.value}%</span>
                            </div>
                        ))}
                    </div>
                </div >

                {/* Crescimento de Clientes */}
                < div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6" >
                    <h3 className="text-lg font-bold text-white mb-6">Novos Clientes</h3>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="name" stroke="#666" axisLine={false} tickLine={false} />
                                <YAxis stroke="#666" axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                                />
                                <Bar dataKey="clientes" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Clientes" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between">
                        <div>
                            <p className="text-zinc-500 text-xs">Total Acumulado</p>
                            <p className="text-white font-bold text-lg">{kpis.activeClients} clientes</p>
                        </div>
                        <div className="text-right">
                            <p className="text-zinc-500 text-xs">Crescimento</p>
                            <p className="text-green-400 font-bold text-lg flex items-center gap-1 justify-end">
                                <TrendingUp size={16} /> +{kpis.monthlyGrowth}%
                            </p>
                        </div>
                    </div>
                </div >
            </div >

            {/* Meta vs Realizado */}
            < div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6" >
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Target className="text-[#D4AF37]" size={20} />
                    Meta vs Realizado - {goals?.goalPeriod || 'Dezembro 2024'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <GoalProgress
                        label="Volume Emprestado"
                        current={kpis.totalLent}
                        goal={goals?.monthlyLoanGoal || 600000}
                        color="#D4AF37"
                    />
                    <GoalProgress
                        label="Novos Clientes"
                        current={kpis.activeClients}
                        goal={goals?.monthlyClientGoal || 60}
                        color="#3B82F6"
                    />
                    <GoalProgress
                        label="Taxa de Aprovação"
                        current={kpis.approvalRate}
                        goal={goals?.monthlyApprovalRateGoal || 75}
                        color="#22C55E"
                        isPercentage
                    />
                </div>
            </div >
        </div >
    );
};

// KPI Card Component
const KPICard: React.FC<{
    title: string;
    value: string;
    trend: string;
    trendUp: boolean;
    icon: React.ElementType;
    color: 'gold' | 'green' | 'blue' | 'red';
    invertTrend?: boolean;
}> = ({ title, value, trend, trendUp, icon: Icon, color, invertTrend }) => {
    const colorMap = {
        gold: 'from-[#D4AF37]/20 to-yellow-900/10 border-[#D4AF37]/30',
        green: 'from-green-500/20 to-green-900/10 border-green-500/30',
        blue: 'from-blue-500/20 to-blue-900/10 border-blue-500/30',
        red: 'from-red-500/20 to-red-900/10 border-red-500/30',
    };

    const iconColorMap = {
        gold: 'text-[#D4AF37]',
        green: 'text-green-400',
        blue: 'text-blue-400',
        red: 'text-red-400',
    };

    const isPositive = invertTrend ? !trendUp : trendUp;

    return (
        <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-5 hover:scale-[1.02] transition-transform`}>
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2 bg-zinc-900/50 rounded-lg ${iconColorMap[color]}`}>
                    <Icon size={20} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isPositive ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                    }`}>
                    {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {trend}
                </div>
            </div>
            <p className="text-zinc-400 text-sm mb-1">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    );
};

// Mini KPI Component
const MiniKPI: React.FC<{
    label: string;
    value: string;
    icon: React.ElementType;
    color: string;
}> = ({ label, value, icon: Icon, color }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
        <div className={`p-2 bg-zinc-800 rounded-lg ${color}`}>
            <Icon size={16} />
        </div>
        <div>
            <p className="text-zinc-500 text-xs">{label}</p>
            <p className="text-white font-bold">{value}</p>
        </div>
    </div>
);

// Goal Progress Component
const GoalProgress: React.FC<{
    label: string;
    current: number;
    goal: number;
    color: string;
    isPercentage?: boolean;
}> = ({ label, current, goal, color, isPercentage }) => {
    const percentage = Math.min((current / goal) * 100, 100);
    const formatValue = (v: number) => {
        if (isPercentage) return `${v}%`;
        if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
        return v.toString();
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-400 text-sm">{label}</span>
                <span className="text-white font-bold">
                    {formatValue(current)} <span className="text-zinc-500 font-normal">/ {formatValue(goal)}</span>
                </span>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                />
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-xs text-zinc-500">{percentage.toFixed(0)}% alcançado</span>
                <span className="text-xs text-zinc-500">Faltam {formatValue(goal - current)}</span>
            </div>
        </div>
    );
};
