// 🛡️ Central de Segurança - Antifraude, Blacklist e Acessos Unificados
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Shield, Ban, UserCog, AlertTriangle, Search, Filter,
    RefreshCw, Download, Eye, Trash2, Plus, ToggleLeft, ToggleRight,
    CheckCircle, XCircle, Clock, MapPin, Smartphone, Monitor,
    Globe, Fingerprint, User, Key, X, Save, Edit2, Phone, Mail
} from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../services/apiClient';
import { apiService } from '../../services/apiService';
import { blacklistService } from '../../services/adminService';
import { useToast } from '../../components/Toast';
import { BlacklistEntry, UserAccess, UserRole } from '../../types';
import { AntiFraudMonitor } from './AntiFraudMonitor';

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
    const [searchParams] = useSearchParams();
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
    const [biometricCountByUser, setBiometricCountByUser] = useState<Record<string, number>>({});
    const [customerByEmail, setCustomerByEmail] = useState<Record<string, boolean>>({});
    const [requestCountByEmail, setRequestCountByEmail] = useState<Record<string, number>>({});
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<UserAccess> | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserAccess | null>(null);

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Read tab from URL on mount and when URL changes
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'blacklist' || tabParam === 'users' || tabParam === 'antifraud') {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            // Risk logs via API
            const { data: logsData } = await api.get('/finance/risk-logs');
            if (logsData) setRiskLogs(logsData);

            // Blacklist
            const blacklistData = await blacklistService.getAll();
            setBlacklist(blacklistData);

            // Users
            const usersData = await apiService.getUsers();
            setUsers(usersData);

            // Mapa de biometria por usuário (WebAuthn) via API
            const { data: biometricMap } = await api.get('/finance/biometrics');
            setBiometricCountByUser(biometricMap || {});

            // Mapa de customers por email via API
            const { data: customersMap } = await api.get('/finance/customers-map');
            setCustomerByEmail(customersMap || {});

            // Mapa de requests por email via API
            const { data: requestsMap } = await api.get('/finance/requests-map');
            setRequestCountByEmail(requestsMap || {});
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
        const currentUser = JSON.parse(localStorage.getItem('tubarao_user') || '{}');
        await blacklistService.add({
            cpf: cleanCpf,
            reason: newReason,
            name: 'Desconhecido',
            addedBy: currentUser?.name || 'Admin'
        });
        addToast('CPF adicionado à blacklist', 'success');
        setNewCpf('');
        setNewReason('');
        setIsBlacklistModalOpen(false);
        loadAllData();
    };

    const handleRemoveFromBlacklist = async (id: string) => {
        if (!confirm('Remover da blacklist?')) return;
        await blacklistService.remove(id);
        addToast('CPF removido', 'success');
        loadAllData();
    };

    const handleToggleBlacklist = async (id: string) => {
        await blacklistService.toggle(id);
        loadAllData();
    };

    const formatCPF = (cpf: string) => {
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    // Users handlers
    const handleSaveUser = async () => {
        if (!editingUser?.email || !editingUser?.name) {
            addToast('Preencha nome e email', 'warning');
            return;
        }

        if (editingUser.id) {
            const updated = await apiService.updateUser(editingUser.id, {
                name: editingUser.name,
                role: editingUser.role as UserRole,
            });

            if (updated) {
                addToast('Acesso atualizado com sucesso!', 'success');
                setIsUserModalOpen(false);
                setEditingUser(null);
                setNewPassword('');
                loadAllData();
            } else {
                addToast('Não foi possível atualizar o acesso', 'error');
            }
            return;
        }

        if (!newPassword) {
            addToast('Defina uma senha para o novo acesso', 'warning');
            return;
        }

        const created = await apiService.createUser({
            email: editingUser.email,
            name: editingUser.name,
            role: editingUser.role || UserRole.CLIENT,
            password: newPassword
        });

        if (created) {
            addToast('Acesso criado!', 'success');
            setIsUserModalOpen(false);
            setEditingUser(null);
            setNewPassword('');
            loadAllData();
        } else {
            addToast('Falha ao criar acesso', 'error');
        }
    };

    const handleResetUserBiometrics = async (userId: string) => {
        if (!confirm('Remover todas as credenciais biométricas deste usuário? Ele terá que cadastrar novamente no próximo acesso.')) return;

        try {
            const { error } = await api.delete(`/finance/biometrics/${userId}`);
            if (error) {
                addToast('Erro ao resetar biometria do usuário', 'error');
                return;
            }
            addToast('Biometria resetada. Novo cadastro será exigido no próximo login.', 'success');
            loadAllData();
        } catch {
            addToast('Erro ao resetar biometria do usuário', 'error');
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm('Excluir usuário?')) return;
        await apiService.deleteUser(id);
        addToast('Usuário excluído', 'success');
        loadAllData();
    };

    const handleResetPasswordSubmit = async () => {
        if (!newPassword || !selectedUserForPassword) {
            addToast('Informe a nova senha', 'warning');
            return;
        }

        try {
            await apiService.resetUserPassword(selectedUserForPassword.id, newPassword);
            addToast('Senha alterada com sucesso!', 'success');
            setIsPasswordModalOpen(false);
            setSelectedUserForPassword(null);
            setNewPassword('');
        } catch (error) {
            addToast('Erro ao resetar senha', 'error');
        }
    };

    const getRoleColor = (role: UserRole) => {
        switch (role) {
            case UserRole.ADMIN: return 'bg-purple-900/30 text-purple-400';
            case UserRole.CLIENT: return 'bg-green-900/30 text-green-400';
            default: return 'bg-zinc-800 text-zinc-400';
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

            {/* Antifraud Tab - Usando componente completo */}
            {activeTab === 'antifraud' && (
                <AntiFraudMonitor />
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
                                            title="Editar"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => { setSelectedUserForPassword(user); setNewPassword(''); setIsPasswordModalOpen(true); }}
                                            className="p-2 bg-zinc-800 rounded hover:bg-zinc-700 text-yellow-400"
                                            title="Redefinir Senha"
                                        >
                                            <Key size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="p-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-black/60 border border-zinc-800 rounded-lg p-2">
                                        <p className="text-[10px] text-zinc-500">Cliente</p>
                                        <p className={`text-xs font-bold ${customerByEmail[(user.email || '').toLowerCase()] ? 'text-green-400' : 'text-zinc-500'}`}>
                                            {customerByEmail[(user.email || '').toLowerCase()] ? 'Vinculado' : 'Sem cadastro'}
                                        </p>
                                    </div>
                                    <div className="bg-black/60 border border-zinc-800 rounded-lg p-2">
                                        <p className="text-[10px] text-zinc-500">Solicitacoes</p>
                                        <p className="text-xs font-bold text-[#D4AF37]">
                                            {requestCountByEmail[(user.email || '').toLowerCase()] || 0}
                                        </p>
                                    </div>
                                    <div className="bg-black/60 border border-zinc-800 rounded-lg p-2">
                                        <p className="text-[10px] text-zinc-500">Biometria</p>
                                        <p className={`text-xs font-bold ${(biometricCountByUser[user.id] || 0) > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                                            {(biometricCountByUser[user.id] || 0) > 0 ? `${biometricCountByUser[user.id]} ativa` : 'Sem cadastro'}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3 flex gap-2">
                                    <button
                                        onClick={() => handleResetUserBiometrics(user.id)}
                                        className="flex-1 py-2 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                    >
                                        Reset biometria
                                    </button>
                                    <button
                                        onClick={() => { window.location.hash = '#/admin/requests'; }}
                                        className="flex-1 py-2 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                    >
                                        Ver solicitacoes
                                    </button>
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

            {/* Devices Tab - Bloqueios e Dispositivos */}
            {activeTab === 'devices' && (
                <div className="space-y-6">
                    {/* Estatísticas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-red-500/20 to-red-900/10 border border-red-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Lock size={16} className="text-red-400" />
                                <span className="text-zinc-400 text-sm">Bloqueios Pendentes</span>
                            </div>
                            <p className="text-2xl font-bold text-red-400">{securityBlocks.length}</p>
                        </div>
                        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-900/10 border border-yellow-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Bell size={16} className="text-yellow-400" />
                                <span className="text-zinc-400 text-sm">Alertas Não Lidos</span>
                            </div>
                            <p className="text-2xl font-bold text-yellow-400">{securityAlerts.filter(a => !a.is_read).length}</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-900/10 border border-blue-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Smartphone size={16} className="text-blue-400" />
                                <span className="text-zinc-400 text-sm">Total Alertas</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-400">{securityAlerts.length}</p>
                        </div>
                        <div className="bg-gradient-to-br from-green-500/20 to-green-900/10 border border-green-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <CheckCircle size={16} className="text-green-400" />
                                <span className="text-zinc-400 text-sm">Dispositivos Listados</span>
                            </div>
                            <p className="text-2xl font-bold text-green-400">{trustedDevices.length}</p>
                        </div>
                    </div>

                    {/* Bloqueios Pendentes */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Lock size={18} className="text-red-400" />
                                Bloqueios Pendentes ({securityBlocks.length})
                            </h3>
                        </div>
                        {securityBlocks.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">
                                <Unlock size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Nenhum bloqueio pendente</p>
                                <p className="text-sm mt-1">Todos os acessos estão liberados</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-800">
                                {securityBlocks.map(block => (
                                    <div key={block.id} className="p-4 hover:bg-zinc-800/30">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs font-bold">
                                                        {block.block_type.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                    <span className="text-zinc-500 text-xs">
                                                        {new Date(block.created_at).toLocaleString('pt-BR')}
                                                    </span>
                                                </div>
                                                <p className="text-white font-medium">{block.block_reason}</p>
                                                <div className="flex items-center gap-4 mt-2 text-sm text-zinc-400">
                                                    <span className="flex items-center gap-1">
                                                        <Globe size={12} /> {block.ip_address || 'IP não capturado'}
                                                    </span>
                                                    {block.device_info?.model && (
                                                        <span className="flex items-center gap-1">
                                                            <Smartphone size={12} /> {block.device_info.model}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="primary"
                                                    onClick={() => handleUnblockUser(block)}
                                                    className="flex items-center gap-1 text-sm"
                                                >
                                                    <Unlock size={14} /> Liberar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Alertas de Segurança */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Bell size={18} className="text-yellow-400" />
                                Alertas de Segurança
                            </h3>
                        </div>
                        {securityAlerts.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">
                                <Bell size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Nenhum alerta registrado</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-800 max-h-[400px] overflow-y-auto">
                                {securityAlerts.map(alert => (
                                    <div
                                        key={alert.id}
                                        className={`p-4 hover:bg-zinc-800/30 ${!alert.is_read ? 'bg-yellow-900/10 border-l-4 border-yellow-500' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${alert.severity === 'critical' ? 'bg-red-900/50 text-red-400' :
                                                        alert.severity === 'high' ? 'bg-orange-900/50 text-orange-400' :
                                                            alert.severity === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                                                                'bg-blue-900/50 text-blue-400'
                                                        }`}>
                                                        {alert.severity.toUpperCase()}
                                                    </span>
                                                    <span className="text-zinc-500 text-xs">
                                                        {new Date(alert.created_at).toLocaleString('pt-BR')}
                                                    </span>
                                                    {!alert.is_read && (
                                                        <span className="px-1.5 py-0.5 bg-yellow-500 text-black rounded text-xs font-bold">NOVO</span>
                                                    )}
                                                </div>
                                                <p className="text-white font-medium">{alert.title}</p>
                                                <p className="text-zinc-400 text-sm mt-1">{alert.description}</p>
                                                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                                                    <span>{alert.user_name}</span>
                                                    <span>{alert.user_email}</span>
                                                    {alert.ip_address && <span>IP: {alert.ip_address}</span>}
                                                </div>
                                            </div>
                                            {!alert.is_read && (
                                                <button
                                                    onClick={() => handleMarkAlertRead(alert.id)}
                                                    className="p-2 bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-400"
                                                    title="Marcar como lido"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Buscar Dispositivos de Usuário */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Smartphone size={18} className="text-blue-400" />
                                Dispositivos por Usuário
                            </h3>
                        </div>
                        <div className="p-4">
                            <div className="flex gap-2 mb-4">
                                <select
                                    className="flex-1 bg-black border border-zinc-700 rounded-lg p-3 text-white"
                                    value={selectedUserId || ''}
                                    onChange={(e) => e.target.value && handleLoadUserDevices(e.target.value)}
                                >
                                    <option value="">Selecione um usuário...</option>
                                    {users.filter(u => u.role === 'CLIENT').map(user => (
                                        <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                                    ))}
                                </select>
                                {selectedUserId && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleResetUserDevices(selectedUserId)}
                                        className="text-red-400"
                                    >
                                        <Trash2 size={16} /> Resetar Todos
                                    </Button>
                                )}
                            </div>

                            {trustedDevices.length > 0 ? (
                                <div className="space-y-3">
                                    {trustedDevices.map(device => (
                                        <div key={device.id} className="flex items-center justify-between p-3 bg-black rounded-lg border border-zinc-800">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${device.is_primary ? 'bg-[#D4AF37]/20' : 'bg-zinc-800'}`}>
                                                    <Smartphone size={20} className={device.is_primary ? 'text-[#D4AF37]' : 'text-zinc-400'} />
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium flex items-center gap-2">
                                                        {device.device_name}
                                                        {device.is_primary && (
                                                            <span className="px-1.5 py-0.5 bg-[#D4AF37]/20 text-[#D4AF37] rounded text-xs">PRINCIPAL</span>
                                                        )}
                                                        {device.is_verified && (
                                                            <CheckCircle size={14} className="text-green-400" />
                                                        )}
                                                    </p>
                                                    <p className="text-zinc-500 text-sm">
                                                        {device.platform} • {device.browser} • {device.login_count} logins
                                                    </p>
                                                    <p className="text-zinc-600 text-xs">
                                                        Último acesso: {new Date(device.last_seen_at).toLocaleString('pt-BR')} • IP: {device.last_ip}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveDevice(device.id)}
                                                className="p-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                                                title="Remover dispositivo"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : selectedUserId ? (
                                <div className="text-center py-8 text-zinc-500">
                                    <Smartphone size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>Nenhum dispositivo registrado</p>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-zinc-500">
                                    <p>Selecione um usuário para ver seus dispositivos</p>
                                </div>
                            )}
                        </div>
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
                                    value={editingUser?.role || 'CLIENT'}
                                    onChange={e => setEditingUser(prev => ({ ...prev, role: e.target.value as UserRole }))}
                                    className={inputStyle}
                                >
                                    <option value="ADMIN">Administrador</option>
                                    <option value="CLIENT">Cliente</option>
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
                            <Button onClick={handleSaveUser} className="w-full">
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
                                    <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><Monitor size={12} /> IP</p>
                                    <p className="font-mono text-white text-sm">{selectedLog.ip}</p>
                                </div>
                                <div className="bg-black p-3 rounded-lg">
                                    <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><Shield size={12} /> Risco</p>
                                    <p className={`font-bold ${getRiskLevel(selectedLog.risk_score).color}`}>
                                        {selectedLog.risk_score}%
                                    </p>
                                </div>
                            </div>

                            {/* Device Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black p-3 rounded-lg">
                                    <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><Smartphone size={12} /> Dispositivo</p>
                                    <p className="text-white text-sm">
                                        {selectedLog.platform || 'Desconhecido'}
                                        <span className="text-zinc-500 text-xs block truncate" title={selectedLog.user_agent}>
                                            ({(() => {
                                                const ua = selectedLog.user_agent || '';
                                                if (/Android/i.test(ua)) return 'Android';
                                                if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
                                                if (/Windows/i.test(ua)) return 'Windows';
                                                if (/Mac/i.test(ua)) return 'MacOS';
                                                if (/Linux/i.test(ua)) return 'Linux';
                                                return 'Outro';
                                            })()})
                                        </span>
                                    </p>
                                </div>
                                <div className="bg-black p-3 rounded-lg">
                                    <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><Globe size={12} /> Navegador</p>
                                    <p className="text-white text-sm">
                                        {(() => {
                                            const ua = selectedLog.user_agent || '';
                                            if (/Chrome/i.test(ua)) return 'Chrome';
                                            if (/Firefox/i.test(ua)) return 'Firefox';
                                            if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
                                            if (/Edge/i.test(ua)) return 'Edge';
                                            return 'Outro';
                                        })()}
                                    </p>
                                    <p className="text-zinc-600 text-xs">{selectedLog.screen_resolution || 'Resolução N/A'}</p>
                                </div>
                            </div>

                            <div className="bg-black p-3 rounded-lg">
                                <p className="text-xs text-zinc-500 mb-2">Fatores de Risco</p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedLog.risk_factors.length > 0 ? (
                                        selectedLog.risk_factors.map((f, i) => (
                                            <span key={i} className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-sm">{f}</span>
                                        ))
                                    ) : (
                                        <span className="text-zinc-600 text-sm italic">Nenhum fator detectado</span>
                                    )}
                                </div>
                            </div>

                            {selectedLog.latitude && selectedLog.longitude && (
                                <div className="bg-black p-3 rounded-lg">
                                    <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1"><MapPin size={12} /> Localização</p>
                                    <a
                                        href={`https://www.google.com/maps?q=${selectedLog.latitude},${selectedLog.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#D4AF37] hover:underline flex items-center gap-1 text-sm bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800 w-fit"
                                    >
                                        <MapPin size={14} />
                                        {selectedLog.latitude.toFixed(4)}, {selectedLog.longitude.toFixed(4)}
                                    </a>
                                </div>
                            )}

                            <div className="mt-4 pt-4 border-t border-zinc-800">
                                <p className="text-xs text-zinc-500 mb-1">User Agent (Raw)</p>
                                <div className="bg-zinc-900 p-2 rounded text-xs font-mono text-zinc-500 break-all max-h-20 overflow-y-auto">
                                    {selectedLog.user_agent}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Password Reset Modal */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Key className="text-yellow-400" /> Redefinir Senha
                            </h3>
                            <button onClick={() => setIsPasswordModalOpen(false)}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-zinc-400 text-sm">
                                Definindo nova senha para <strong>{selectedUserForPassword?.name}</strong>
                            </p>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Nova Senha</label>
                                <input
                                    type="text"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Digite a nova senha"
                                    className={inputStyle}
                                />
                            </div>
                            <Button onClick={handleResetPasswordSubmit} className="w-full">
                                <Save size={18} /> Salvar Nova Senha
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityHub;
