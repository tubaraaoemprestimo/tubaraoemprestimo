// 📊 Central de Análises - Relatórios, Auditoria, Geolocalização e Open Finance
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    BarChart3, FileText, MapPin, Landmark, Search, Filter,
    RefreshCw, Download, Eye, Trash2, Calendar, Clock,
    TrendingUp, TrendingDown, DollarSign, Users, Target,
    ChevronRight, ExternalLink, Navigation2, Play, CheckCircle,
    XCircle, AlertTriangle, PieChart, CreditCard, Shield, X
} from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../services/apiClient';
import { apiService } from '../../services/apiService';
import { auditService } from '../../services/adminService';
import { geolocationService } from '../../services/geolocationService';
import { openFinanceService } from '../../services/openFinanceService';
import { locationTrackingService, CustomerLocation } from '../../services/locationTrackingService';
import { useToast } from '../../components/Toast';
import { ReportsPanel } from '../../components/ReportsPanel';
import { AuditLog, Customer, CreditScore, IncomeAnalysis } from '../../types';

type TabType = 'reports' | 'audit' | 'geo' | 'openfinance';

const inputStyle = "w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none transition-colors";

const actionColors: Record<string, string> = {
    CREATE: 'text-green-400 bg-green-900/30',
    UPDATE: 'text-blue-400 bg-blue-900/30',
    DELETE: 'text-red-400 bg-red-900/30',
    APPROVE: 'text-green-400 bg-green-900/30',
    REJECT: 'text-red-400 bg-red-900/30',
    LOGIN: 'text-purple-400 bg-purple-900/30',
    EXPORT: 'text-[#D4AF37] bg-yellow-900/30',
};

const actionLabels: Record<string, string> = {
    CREATE: 'Criou',
    UPDATE: 'Atualizou',
    DELETE: 'Excluiu',
    APPROVE: 'Aprovou',
    REJECT: 'Rejeitou',
    LOGIN: 'Login',
    EXPORT: 'Exportou',
};

export const AnalyticsHub: React.FC = () => {
    const { addToast } = useToast();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>('reports');
    const [loading, setLoading] = useState(true);

    // Audit
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [auditFilter, setAuditFilter] = useState<string>('all');
    const [auditSearch, setAuditSearch] = useState('');

    // Geolocation
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerLocations, setCustomerLocations] = useState<CustomerLocation[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // Open Finance
    const [analysisResults, setAnalysisResults] = useState<{
        score: CreditScore;
        income: IncomeAnalysis;
    } | null>(null);
    const [selectedCustomerForAnalysis, setSelectedCustomerForAnalysis] = useState<Customer | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Read tab from URL on mount and when URL changes
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'reports' || tabParam === 'audit' || tabParam === 'geo' || tabParam === 'openfinance') {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            // Audit logs
            const logs = await auditService.getAll();
            setAuditLogs(logs);

            // Customers
            const customersData = await apiService.getCustomers();
            setCustomers(customersData);

            // Customer locations
            const locations = await locationTrackingService.getAllLocations();
            setCustomerLocations(locations);

        } catch (error) {
            console.error('Error loading data:', error);
        }
        setLoading(false);
    };

    // Audit handlers
    const handleExportAudit = () => {
        const csv = auditLogs.map(log =>
            `${new Date(log.timestamp).toLocaleString()},${log.userName},${log.action},${log.entity},${log.entityId}`
        ).join('\n');
        const blob = new Blob([`Data,Usuário,Ação,Entidade,ID\n${csv}`], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        addToast('Exportado com sucesso!', 'success');
    };

    const handleClearLogs = async () => {
        if (!confirm('Limpar todos os logs?')) return;
        await auditService.clear();
        addToast('Logs limpos', 'success');
        loadAllData();
    };

    // Geolocation handlers
    const openInGoogleMaps = (lat: number, lng: number, name?: string) => {
        const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}${name ? `&query_place_id=${encodeURIComponent(name)}` : ''}`;
        window.open(url, '_blank');
    };

    const openInWaze = (lat: number, lng: number) => {
        window.open(`https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
    };

    const getCustomerLocation = (email: string) => {
        return customerLocations.find(l => l.customerEmail === email);
    };

    // Open Finance handlers
    const handlePerformAnalysis = async () => {
        if (!selectedCustomerForAnalysis) return;
        setIsAnalyzing(true);

        try {
            const [score, income] = await Promise.all([
                openFinanceService.calculateCreditScore(selectedCustomerForAnalysis.cpf),
                openFinanceService.analyzeIncome(selectedCustomerForAnalysis.cpf)
            ]);
            setAnalysisResults({ score, income });
        } catch (error) {
            addToast('Erro na análise', 'error');
        }
        setIsAnalyzing(false);
    };

    const getRecommendationBadge = (recommendation: 'APPROVE' | 'REVIEW' | 'DENY') => {
        switch (recommendation) {
            case 'APPROVE': return <span className="px-3 py-1 rounded-full text-sm font-bold bg-green-900/30 text-green-400 flex items-center gap-1"><CheckCircle size={14} /> Aprovar</span>;
            case 'REVIEW': return <span className="px-3 py-1 rounded-full text-sm font-bold bg-yellow-900/30 text-yellow-400 flex items-center gap-1"><AlertTriangle size={14} /> Revisar</span>;
            case 'DENY': return <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-900/30 text-red-400 flex items-center gap-1"><XCircle size={14} /> Negar</span>;
        }
    };

    // Stats
    const stats = {
        totalLogs: auditLogs.length,
        todayLogs: auditLogs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length,
        customersWithLocation: customerLocations.length,
        totalCustomers: customers.length
    };

    const filteredLogs = auditLogs.filter(log => {
        if (auditFilter !== 'all' && log.action !== auditFilter) return false;
        if (auditSearch && !log.userName.toLowerCase().includes(auditSearch.toLowerCase()) &&
            !log.entity.toLowerCase().includes(auditSearch.toLowerCase())) return false;
        return true;
    });

    const customersWithLocation = customers.filter(c => getCustomerLocation(c.email));
    const filteredCustomers = searchTerm
        ? customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.cpf.includes(searchTerm))
        : customers;

    const tabs = [
        { id: 'reports', label: 'Relatórios', icon: <BarChart3 size={18} /> },
        { id: 'audit', label: 'Auditoria', icon: <FileText size={18} />, badge: stats.todayLogs },
        { id: 'geo', label: 'Geolocalização', icon: <MapPin size={18} />, badge: stats.customersWithLocation },
        { id: 'openfinance', label: 'Open Finance', icon: <Landmark size={18} /> },
    ] as const;

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                        <BarChart3 size={32} /> Central de Análises
                    </h1>
                    <p className="text-zinc-500 mt-1">Relatórios, Auditoria, Geolocalização e Open Finance</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={loadAllData}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-900/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <FileText size={16} className="text-blue-400" />
                        <span className="text-zinc-400 text-sm">Logs Hoje</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{stats.todayLogs}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-900/10 border border-purple-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <FileText size={16} className="text-purple-400" />
                        <span className="text-zinc-400 text-sm">Total Logs</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">{stats.totalLogs}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500/20 to-green-900/10 border border-green-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <MapPin size={16} className="text-green-400" />
                        <span className="text-zinc-400 text-sm">Com Localização</span>
                    </div>
                    <p className="text-2xl font-bold text-green-400">{stats.customersWithLocation}</p>
                </div>
                <div className="bg-gradient-to-br from-[#D4AF37]/20 to-yellow-900/10 border border-[#D4AF37]/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Users size={16} className="text-[#D4AF37]" />
                        <span className="text-zinc-400 text-sm">Total Clientes</span>
                    </div>
                    <p className="text-2xl font-bold text-[#D4AF37]">{stats.totalCustomers}</p>
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
                        {tab.badge !== undefined && tab.badge > 0 && (
                            <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${activeTab === tab.id ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-300'}`}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Reports Tab */}
            {activeTab === 'reports' && (
                <ReportsPanel />
            )}

            {/* Audit Tab */}
            {activeTab === 'audit' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex gap-2 flex-wrap">
                            {['all', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN'].map(action => (
                                <button
                                    key={action}
                                    onClick={() => setAuditFilter(action)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${auditFilter === action
                                        ? 'bg-[#D4AF37] text-black'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                >
                                    {action === 'all' ? 'Todos' : actionLabels[action] || action}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={auditSearch}
                                    onChange={e => setAuditSearch(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <Button variant="secondary" onClick={handleExportAudit}>
                                <Download size={18} /> CSV
                            </Button>
                            <Button variant="danger" onClick={handleClearLogs}>
                                <Trash2 size={18} />
                            </Button>
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-zinc-950 border-b border-zinc-800">
                                    <tr>
                                        <th className="text-left p-4 text-zinc-400 text-sm">Data</th>
                                        <th className="text-left p-4 text-zinc-400 text-sm">Usuário</th>
                                        <th className="text-left p-4 text-zinc-400 text-sm">Ação</th>
                                        <th className="text-left p-4 text-zinc-400 text-sm">Entidade</th>
                                        <th className="text-left p-4 text-zinc-400 text-sm">Detalhes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {filteredLogs.slice(0, 50).map(log => (
                                        <tr key={log.id} className="hover:bg-zinc-800/30">
                                            <td className="p-4 text-zinc-500 text-sm whitespace-nowrap">
                                                {new Date(log.timestamp).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="p-4 font-bold text-white">{log.userName}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${actionColors[log.action] || 'bg-zinc-800 text-zinc-400'}`}>
                                                    {actionLabels[log.action] || log.action}
                                                </span>
                                            </td>
                                            <td className="p-4 text-zinc-300">{log.entity}</td>
                                            <td className="p-4 text-zinc-500 text-sm max-w-xs truncate">
                                                {log.details ? JSON.stringify(log.details).slice(0, 50) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredLogs.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-zinc-500">
                                                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                                                <p>Nenhum log encontrado</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Geolocation Tab */}
            {activeTab === 'geo' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Buscar cliente..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {customersWithLocation.slice(0, 12).map(customer => {
                            const location = getCustomerLocation(customer.email);
                            return (
                                <div key={customer.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-[#D4AF37]/50 transition-colors">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-[#D4AF37] to-yellow-600 rounded-full flex items-center justify-center text-black font-bold">
                                            {customer.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{customer.name}</p>
                                            <p className="text-xs text-zinc-500">{customer.phone}</p>
                                        </div>
                                    </div>
                                    {location && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-zinc-400 flex items-center gap-1">
                                                <MapPin size={14} className="text-[#D4AF37]" />
                                                {location.city}, {location.state}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                Última atualização: {location.updatedAt ? new Date(location.updatedAt).toLocaleDateString('pt-BR') : 'N/A'}
                                            </p>
                                            <div className="flex gap-2 mt-3">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => openInGoogleMaps(location.latitude, location.longitude, customer.name)}
                                                >
                                                    <MapPin size={14} /> Maps
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => openInWaze(location.latitude, location.longitude)}
                                                >
                                                    <Navigation2 size={14} /> Waze
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {customersWithLocation.length === 0 && (
                            <div className="col-span-full text-center py-12 text-zinc-500">
                                <MapPin size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Nenhum cliente com localização registrada</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Open Finance Tab */}
            {activeTab === 'openfinance' && (
                <div className="space-y-6">
                    {/* Customer Selection */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Users size={20} className="text-[#D4AF37]" /> Selecionar Cliente para Análise
                        </h3>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <select
                                    value={selectedCustomerForAnalysis?.id || ''}
                                    onChange={e => {
                                        const customer = customers.find(c => c.id === e.target.value);
                                        setSelectedCustomerForAnalysis(customer || null);
                                        setAnalysisResults(null);
                                    }}
                                    className={inputStyle}
                                >
                                    <option value="">Selecione um cliente...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} - {c.cpf}</option>
                                    ))}
                                </select>
                            </div>
                            <Button
                                onClick={handlePerformAnalysis}
                                disabled={!selectedCustomerForAnalysis || isAnalyzing}
                            >
                                {isAnalyzing ? <RefreshCw size={18} className="animate-spin" /> : <Target size={18} />}
                                Analisar
                            </Button>
                        </div>
                    </div>

                    {/* Analysis Results */}
                    {analysisResults && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Credit Score */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Shield size={20} className="text-[#D4AF37]" /> Score de Crédito
                                </h3>
                                <div className="text-center mb-6">
                                    <div className="relative w-32 h-32 mx-auto">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="64" cy="64" r="56" fill="none" stroke="#27272a" strokeWidth="12" />
                                            <circle
                                                cx="64" cy="64" r="56" fill="none"
                                                stroke={analysisResults.score.score >= 700 ? '#22c55e' : analysisResults.score.score >= 500 ? '#eab308' : '#ef4444'}
                                                strokeWidth="12"
                                                strokeDasharray={`${(analysisResults.score.score / 1000) * 352} 352`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-3xl font-bold text-white">{analysisResults.score.score}</span>
                                            <span className="text-xs text-zinc-400">{analysisResults.score.classification}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    {getRecommendationBadge(analysisResults.score.recommendation)}
                                </div>
                                <div className="mt-6 space-y-3">
                                    {analysisResults.score.factors.map((factor, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <span className="text-zinc-400 text-sm">{factor.name}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#D4AF37] rounded-full"
                                                        style={{ width: `${(factor.impact / 100) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-zinc-500 w-8">{factor.impact}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Income Analysis */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <DollarSign size={20} className="text-[#D4AF37]" /> Análise de Renda
                                </h3>
                                <div className="space-y-4">
                                    <div className="bg-black rounded-xl p-4">
                                        <p className="text-zinc-400 text-sm">Renda Média Mensal</p>
                                        <p className="text-2xl font-bold text-[#D4AF37]">
                                            R$ {analysisResults.income.averageMonthlyIncome.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black rounded-xl p-4">
                                            <p className="text-zinc-400 text-sm">Estabilidade</p>
                                            <p className="text-xl font-bold text-white">{analysisResults.income.stability}%</p>
                                        </div>
                                        <div className="bg-black rounded-xl p-4">
                                            <p className="text-zinc-400 text-sm">Tendência</p>
                                            <div className="flex items-center gap-1">
                                                {analysisResults.income.trend === 'UP' ? (
                                                    <TrendingUp size={20} className="text-green-400" />
                                                ) : analysisResults.income.trend === 'DOWN' ? (
                                                    <TrendingDown size={20} className="text-red-400" />
                                                ) : (
                                                    <span className="text-yellow-400">→</span>
                                                )}
                                                <span className={`font-bold ${analysisResults.income.trend === 'UP' ? 'text-green-400' :
                                                    analysisResults.income.trend === 'DOWN' ? 'text-red-400' : 'text-yellow-400'
                                                    }`}>
                                                    {analysisResults.income.trend === 'UP' ? 'Subindo' :
                                                        analysisResults.income.trend === 'DOWN' ? 'Caindo' : 'Estável'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-black rounded-xl p-4">
                                        <p className="text-zinc-400 text-sm mb-2">Fontes de Renda</p>
                                        <div className="space-y-2">
                                            {analysisResults.income.incomeSources.map((source, i) => (
                                                <div key={i} className="flex items-center justify-between">
                                                    <span className="text-white">{source.type}</span>
                                                    <span className="text-[#D4AF37] font-bold">
                                                        R$ {source.amount.toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!analysisResults && !isAnalyzing && (
                        <div className="text-center py-12 text-zinc-500">
                            <Landmark size={64} className="mx-auto mb-4 opacity-50" />
                            <p className="text-lg">Selecione um cliente para realizar a análise Open Finance</p>
                            <p className="text-sm mt-2">A análise inclui score de crédito e verificação de renda</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AnalyticsHub;
