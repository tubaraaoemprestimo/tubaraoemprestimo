// 🛡️ Central de Segurança - Antifraude, Blacklist e Acessos Unificados
import React, { useState, useEffect } from 'react';
import {
    Shield, Ban, UserCog, AlertTriangle, Search, Filter,
    RefreshCw, Download, Eye, Trash2, Plus, ToggleLeft, ToggleRight,
    CheckCircle, XCircle, Clock, MapPin, Smartphone, Monitor,
    Globe, Fingerprint, User, Key, X, Save, Edit2, Phone, Mail
} from 'lucide-react';
import { Button } from '../../components/Button';
import { supabase } from '../../services/supabaseClient';
import { supabaseService } from '../../services/supabaseService';
import { blacklistService } from '../../services/adminService';
import { useToast } from '../../components/Toast';
import { BlacklistEntry, UserAccess, UserRole } from '../../types';

type TabType = 'antifraud' | 'blacklist' | 'users';

interface RiskLog {
    id: string;
    user_id: string | null;
    session_id: string;
    ip: string;
    user_agent: string;
    platform: string;
    screen_resolution: string;
    latitude: number | null;
    longitude: number | null;
    action: string;
    risk_score: number;
    risk_factors: string[];
    created_at: string;
}

const inputStyle = "w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none transition-colors";

export const SecurityHub: React.FC = () => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<TabType>('antifraud');
    const [loading, setLoading] = useState(true);

    // Antifraud
    const [riskLogs, setRiskLogs] = useState<RiskLog[]>([]);
    const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [selectedLog, setSelectedLog] = useState<RiskLog | null>(null);

    // Blacklist
    const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
    const [newCpf, setNewCpf] = useState('');
    const [newReason, setNewReason] = useState('');
    const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);

    // Users
    const [users, setUsers] = useState<UserAccess[]>([]);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<UserAccess> | null>(null);
    const [newPassword, setNewPassword] = useState('');

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            // Risk logs
            const { data: logsData } = await supabase
                .from('risk_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            if (logsData) setRiskLogs(logsData);

            // Blacklist
            const blacklistData = await blacklistService.getBlacklist();
            setBlacklist(blacklistData);

            // Users
            const usersData = await supabaseService.getUserAccess();
            setUsers(usersData);
        } catch (error) {
            console.error('Error loading data:', error);
        }
        setLoading(false);
    };

    // Antifraud handlers
    const getRiskLevel = (score: number) => {
        if (score >= 70) return { level: 'ALTO', color: 'text-red-400', bgColor: 'bg-red-900/30' };
        if (score >= 40) return { level: 'MÉDIO', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30' };
        return { level: 'BAIXO', color: 'text-green-400', bgColor: 'bg-green-900/30' };
    };

    const parseUserAgent = (ua: string) => {
        const isMobile = /Mobile|Android|iPhone/i.test(ua);
        const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)/)?.[1] || 'Unknown';
        const os = ua.match(/(Windows|Mac|Linux|Android|iOS)/i)?.[1] || 'Unknown';
        return { isMobile, browser, os };
    };

    const exportToCSV = () => {
        const csv = riskLogs.map(log =>
            `${log.created_at},${log.ip},${log.action},${log.risk_score},${log.risk_factors.join('; ')}`
        ).join('\n');
        const blob = new Blob([`Data,IP,Ação,Score,Fatores\n${csv}`], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `risk_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // Blacklist handlers
    const handleAddToBlacklist = async () => {
        if (!newCpf || !newReason) {
            addToast('Preencha CPF e motivo', 'warning');
            return;
        }
        const cleanCpf = newCpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            addToast('CPF inválido', 'error');
            return;
        }
        await blacklistService.addToBlacklist(cleanCpf, newReason);
        addToast('CPF adicionado à blacklist', 'success');
        setNewCpf('');
        setNewReason('');
        setIsBlacklistModalOpen(false);
        loadAllData();
    };

    const handleRemoveFromBlacklist = async (id: string) => {
        if (!confirm('Remover da blacklist?')) return;
        await blacklistService.removeFromBlacklist(id);
        addToast('CPF removido', 'success');
        loadAllData();
    };

    const handleToggleBlacklist = async (id: string) => {
        await blacklistService.toggleBlacklist(id);
        loadAllData();
    };

    const formatCPF = (cpf: string) => {
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    // Users handlers
    const handleCreateUser = async () => {
        if (!editingUser?.email || !editingUser?.name || !newPassword) {
            addToast('Preencha todos os campos', 'warning');
            return;
        }
        const created = await supabaseService.createUserAccess({
            email: editingUser.email,
            name: editingUser.name,
            role: editingUser.role || 'OPERATOR',
            password: newPassword
        });
        if (created) {
            addToast('Usuário criado!', 'success');
            setIsUserModalOpen(false);
            setEditingUser(null);
            setNewPassword('');
            loadAllData();
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm('Excluir usuário?')) return;
        await supabaseService.deleteUserAccess(id);
        addToast('Usuário excluído', 'success');
        loadAllData();
    };

    const getRoleColor = (role: UserRole) => {
        switch (role) {
            case 'ADMIN': return 'bg-purple-900/30 text-purple-400';
            case 'MANAGER': return 'bg-blue-900/30 text-blue-400';
            case 'OPERATOR': return 'bg-green-900/30 text-green-400';
            case 'VIEWER': return 'bg-zinc-800 text-zinc-400';
        }
    };

    // Stats
    const stats = {
        highRiskCount: riskLogs.filter(l => l.risk_score >= 70).length,
        mediumRiskCount: riskLogs.filter(l => l.risk_score >= 40 && l.risk_score < 70).length,
        blacklistActive: blacklist.filter(b => b.active).length,
        blacklistTotal: blacklist.length,
        totalUsers: users.length,
        adminCount: users.filter(u => u.role === 'ADMIN').length
    };

    const filteredLogs = riskLogs.filter(log => {
        if (riskFilter === 'high' && log.risk_score < 70) return false;
        if (riskFilter === 'medium' && (log.risk_score < 40 || log.risk_score >= 70)) return false;
        if (riskFilter === 'low' && log.risk_score >= 40) return false;
        if (searchTerm && !log.ip.includes(searchTerm) && !log.action.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const tabs = [
        { id: 'antifraud', label: 'Antifraude', icon: <Shield size={18} />, badge: stats.highRiskCount },
        { id: 'blacklist', label: 'Blacklist', icon: <Ban size={18} />, badge: stats.blacklistActive },
        { id: 'users', label: 'Acessos', icon: <UserCog size={18} />, badge: stats.totalUsers },
    ] as const;

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                        <Shield size={32} /> Central de Segurança
                    </h1>
                    <p className="text-zinc-500 mt-1">Antifraude, Blacklist e Controle de Acessos</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={loadAllData}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-red-500/20 to-red-900/10 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={16} className="text-red-400" />
                        <span className="text-zinc-400 text-sm">Risco Alto</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{stats.highRiskCount}</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-900/10 border border-yellow-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={16} className="text-yellow-400" />
                        <span className="text-zinc-400 text-sm">Risco Médio</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400">{stats.mediumRiskCount}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-900/10 border border-purple-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Ban size={16} className="text-purple-400" />
                        <span className="text-zinc-400 text-sm">CPFs Bloqueados</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">{stats.blacklistActive}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-900/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <UserCog size={16} className="text-blue-400" />
                        <span className="text-zinc-400 text-sm">Usuários</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{stats.totalUsers}</p>
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

            {/* Antifraud Tab */}
            {activeTab === 'antifraud' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex gap-2">
                            {(['all', 'high', 'medium', 'low'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setRiskFilter(f)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${riskFilter === f
                                        ? f === 'high' ? 'bg-red-600 text-white' :
                                            f === 'medium' ? 'bg-yellow-600 text-black' :
                                                f === 'low' ? 'bg-green-600 text-white' : 'bg-[#D4AF37] text-black'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                >
                                    {f === 'all' ? 'Todos' : f === 'high' ? 'Alto' : f === 'medium' ? 'Médio' : 'Baixo'}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar IP ou ação..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <Button variant="secondary" onClick={exportToCSV}>
                                <Download size={18} /> CSV
                            </Button>
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-zinc-950 border-b border-zinc-800">
                                    <tr>
                                        <th className="text-left p-4 text-zinc-400 text-sm">Data</th>
                                        <th className="text-left p-4 text-zinc-400 text-sm">IP</th>
                                        <th className="text-left p-4 text-zinc-400 text-sm">Dispositivo</th>
                                        <th className="text-left p-4 text-zinc-400 text-sm">Ação</th>
                                        <th className="text-left p-4 text-zinc-400 text-sm">Risco</th>
                                        <th className="text-left p-4 text-zinc-400 text-sm">Fatores</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {filteredLogs.slice(0, 50).map(log => {
                                        const risk = getRiskLevel(log.risk_score);
                                        const device = parseUserAgent(log.user_agent);
                                        return (
                                            <tr key={log.id} className="hover:bg-zinc-800/30 cursor-pointer" onClick={() => setSelectedLog(log)}>
                                                <td className="p-4 text-zinc-400 text-sm whitespace-nowrap">
                                                    {new Date(log.created_at).toLocaleString('pt-BR')}
                                                </td>
                                                <td className="p-4">
                                                    <span className="font-mono text-white">{log.ip}</span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        {device.isMobile ? <Smartphone size={14} className="text-blue-400" /> : <Monitor size={14} className="text-zinc-400" />}
                                                        <span className="text-zinc-300 text-sm">{device.browser} / {device.os}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-white">{log.action}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${risk.bgColor} ${risk.color}`}>
                                                        {log.risk_score}% - {risk.level}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                                        {log.risk_factors.slice(0, 2).map((f, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">{f}</span>
                                                        ))}
                                                        {log.risk_factors.length > 2 && (
                                                            <span className="text-xs text-zinc-500">+{log.risk_factors.length - 2}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredLogs.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-zinc-500">
                                                <Shield size={48} className="mx-auto mb-4 opacity-50" />
                                                <p>Nenhum log de risco encontrado</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Blacklist Tab */}
            {activeTab === 'blacklist' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Buscar CPF..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none"
                            />
                        </div>
                        <Button onClick={() => setIsBlacklistModalOpen(true)}>
                            <Plus size={18} /> Adicionar CPF
                        </Button>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-zinc-950 border-b border-zinc-800">
                                <tr>
                                    <th className="text-left p-4 text-zinc-400 text-sm">CPF</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Motivo</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Data</th>
                                    <th className="text-left p-4 text-zinc-400 text-sm">Status</th>
                                    <th className="text-right p-4 text-zinc-400 text-sm">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {blacklist.filter(b => b.cpf.includes(searchTerm.replace(/\D/g, ''))).map(entry => (
                                    <tr key={entry.id} className="hover:bg-zinc-800/30">
                                        <td className="p-4">
                                            <span className="font-mono font-bold text-white">{formatCPF(entry.cpf)}</span>
                                        </td>
                                        <td className="p-4 text-zinc-400">{entry.reason}</td>
                                        <td className="p-4 text-zinc-500 text-sm">
                                            {new Date(entry.addedAt).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${entry.active
                                                ? 'bg-red-900/30 text-red-400'
                                                : 'bg-zinc-800 text-zinc-500'
                                                }`}>
                                                {entry.active ? 'Bloqueado' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleToggleBlacklist(entry.id)}
                                                    className="p-2 bg-zinc-800 rounded hover:bg-zinc-700"
                                                    title={entry.active ? 'Desativar' : 'Ativar'}
                                                >
                                                    {entry.active ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} className="text-zinc-500" />}
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveFromBlacklist(entry.id)}
                                                    className="p-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                                                    title="Remover"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {blacklist.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-zinc-500">
                                            <Ban size={48} className="mx-auto mb-4 opacity-50" />
                                            <p>Nenhum CPF na blacklist</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <p className="text-zinc-400">Gerencie usuários e permissões do sistema</p>
                        <Button onClick={() => { setEditingUser({}); setIsUserModalOpen(true); }}>
                            <Plus size={18} /> Novo Usuário
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.map(user => (
                            <div key={user.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-[#D4AF37]/50 transition-colors">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-[#D4AF37] to-yellow-600 rounded-full flex items-center justify-center text-black font-bold text-lg">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{user.name}</h3>
                                        <p className="text-zinc-500 text-sm">{user.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${getRoleColor(user.role)}`}>
                                        {user.role}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }}
                                            className="p-2 bg-zinc-800 rounded hover:bg-zinc-700"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="p-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                {user.phone && (
                                    <p className="text-xs text-zinc-500 mt-3 flex items-center gap-1">
                                        <Phone size={12} /> {user.phone}
                                    </p>
                                )}
                            </div>
                        ))}
                        {users.length === 0 && (
                            <div className="col-span-full text-center py-12 text-zinc-500">
                                <UserCog size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Nenhum usuário cadastrado</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Blacklist Modal */}
            {isBlacklistModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Ban className="text-red-400" /> Adicionar à Blacklist
                            </h3>
                            <button onClick={() => setIsBlacklistModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">CPF</label>
                                <input
                                    type="text"
                                    value={newCpf}
                                    onChange={e => setNewCpf(e.target.value)}
                                    placeholder="000.000.000-00"
                                    className={inputStyle}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Motivo</label>
                                <textarea
                                    value={newReason}
                                    onChange={e => setNewReason(e.target.value)}
                                    placeholder="Informe o motivo do bloqueio..."
                                    className={`${inputStyle} h-24 resize-none`}
                                />
                            </div>
                            <Button onClick={handleAddToBlacklist} className="w-full bg-red-600 hover:bg-red-700">
                                <Ban size={18} /> Bloquear CPF
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Modal */}
            {isUserModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">{editingUser?.id ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                            <button onClick={() => { setIsUserModalOpen(false); setEditingUser(null); }}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={editingUser?.name || ''}
                                    onChange={e => setEditingUser(prev => ({ ...prev, name: e.target.value }))}
                                    className={inputStyle}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={editingUser?.email || ''}
                                    onChange={e => setEditingUser(prev => ({ ...prev, email: e.target.value }))}
                                    className={inputStyle}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Função</label>
                                <select
                                    value={editingUser?.role || 'OPERATOR'}
                                    onChange={e => setEditingUser(prev => ({ ...prev, role: e.target.value as UserRole }))}
                                    className={inputStyle}
                                >
                                    <option value="ADMIN">Administrador</option>
                                    <option value="MANAGER">Gerente</option>
                                    <option value="OPERATOR">Operador</option>
                                    <option value="VIEWER">Visualizador</option>
                                </select>
                            </div>
                            {!editingUser?.id && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Senha</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className={inputStyle}
                                    />
                                </div>
                            )}
                            <Button onClick={handleCreateUser} className="w-full">
                                <Save size={18} /> Salvar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Log Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Detalhes do Log</h3>
                            <button onClick={() => setSelectedLog(null)}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black p-3 rounded-lg">
                                    <p className="text-xs text-zinc-500">IP</p>
                                    <p className="font-mono text-white">{selectedLog.ip}</p>
                                </div>
                                <div className="bg-black p-3 rounded-lg">
                                    <p className="text-xs text-zinc-500">Risco</p>
                                    <p className={`font-bold ${getRiskLevel(selectedLog.risk_score).color}`}>
                                        {selectedLog.risk_score}%
                                    </p>
                                </div>
                            </div>
                            <div className="bg-black p-3 rounded-lg">
                                <p className="text-xs text-zinc-500 mb-2">Fatores de Risco</p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedLog.risk_factors.map((f, i) => (
                                        <span key={i} className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-sm">{f}</span>
                                    ))}
                                </div>
                            </div>
                            {selectedLog.latitude && selectedLog.longitude && (
                                <div className="bg-black p-3 rounded-lg">
                                    <p className="text-xs text-zinc-500 mb-2">Localização</p>
                                    <a
                                        href={`https://www.google.com/maps?q=${selectedLog.latitude},${selectedLog.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#D4AF37] hover:underline flex items-center gap-1"
                                    >
                                        <MapPin size={14} /> Ver no mapa
                                    </a>
                                </div>
                            )}
                            <div className="bg-black p-3 rounded-lg">
                                <p className="text-xs text-zinc-500 mb-1">User Agent</p>
                                <p className="text-zinc-400 text-xs font-mono break-all">{selectedLog.user_agent}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityHub;
