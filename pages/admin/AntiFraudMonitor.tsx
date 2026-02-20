import React, { useState, useEffect } from 'react';
import {
    Shield, MapPin, Smartphone, Monitor, Globe, Clock,
    AlertTriangle, CheckCircle, XCircle, RefreshCw, Search,
    Filter, Eye, Fingerprint, Wifi, ChevronRight, Download,
    User, Calendar, Activity, Cpu, ScreenShare, Lock, Unlock,
    Bell, Trash2, List
} from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../services/apiClient';
import { useToast } from '../../components/Toast';
import { deviceSecurityService, TrustedDevice, SecurityBlock, SecurityAlert } from '../../services/deviceSecurityService';
import { apiService } from '../../services/apiService';
import { UserAccess } from '../../types';

interface RiskLog {
    id: string;
    user_id: string | null;
    session_id: string;
    ip: string;
    user_agent: string;
    platform: string;
    screen_resolution: string;
    timezone: string;
    latitude: number | null;
    longitude: number | null;
    action: string;
    risk_score: number;
    risk_factors: string[];
    additional_data: any;
    created_at: string;
}

interface DeviceInfo {
    browser: string;
    browserVersion: string;
    os: string;
    device: string;
    isMobile: boolean;
}

const inputStyle = "w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none transition-colors";

// Parse User Agent
const parseUserAgent = (ua: string): DeviceInfo => {
    let browser = 'Desconhecido';
    let browserVersion = '';
    let os = 'Desconhecido';
    let device = 'Desktop';
    let isMobile = false;

    // Browser detection
    if (ua.includes('Chrome') && !ua.includes('Edge') && !ua.includes('OPR')) {
        browser = 'Chrome';
        const match = ua.match(/Chrome\/(\d+)/);
        browserVersion = match ? match[1] : '';
    } else if (ua.includes('Firefox')) {
        browser = 'Firefox';
        const match = ua.match(/Firefox\/(\d+)/);
        browserVersion = match ? match[1] : '';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        browser = 'Safari';
        const match = ua.match(/Version\/(\d+)/);
        browserVersion = match ? match[1] : '';
    } else if (ua.includes('Edge')) {
        browser = 'Edge';
        const match = ua.match(/Edge\/(\d+)/);
        browserVersion = match ? match[1] : '';
    } else if (ua.includes('OPR') || ua.includes('Opera')) {
        browser = 'Opera';
    }

    // OS detection
    if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
    else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
    else if (ua.includes('Windows NT 6.2')) os = 'Windows 8';
    else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Android')) {
        os = 'Android';
        const match = ua.match(/Android (\d+)/);
        if (match) os += ` ${match[1]}`;
    }
    else if (ua.includes('iPhone')) os = 'iOS (iPhone)';
    else if (ua.includes('iPad')) os = 'iOS (iPad)';
    else if (ua.includes('Linux')) os = 'Linux';

    // Device detection
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
        device = 'Mobile';
        isMobile = true;
    } else if (ua.includes('iPad') || ua.includes('Tablet')) {
        device = 'Tablet';
        isMobile = true;
    }

    return { browser, browserVersion, os, device, isMobile };
};

export const AntiFraudMonitor: React.FC = () => {
    const { addToast } = useToast();
    const [logs, setLogs] = useState<RiskLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState<RiskLog | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRisk, setFilterRisk] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    // Aba interna ativa
    const [innerTab, setInnerTab] = useState<'logs' | 'blocks' | 'alerts' | 'devices'>('logs');

    // Estados para dispositivos/bloqueios
    const [securityBlocks, setSecurityBlocks] = useState<SecurityBlock[]>([]);
    const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
    const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
    const [users, setUsers] = useState<UserAccess[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    useEffect(() => {
        loadAllData();
    }, [dateRange]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            // Logs de risco via API
            const { data: riskLogs, error: riskError } = await api.get<RiskLog[]>(
                `/antifraud/risk-logs?start=${dateRange.start}T00:00:00&end=${dateRange.end}T23:59:59&limit=200`
            );

            if (riskError) throw new Error(riskError);
            setLogs((riskLogs as RiskLog[]) || []);

            // Bloqueios e Alertas
            const blocks = await deviceSecurityService.getPendingBlocks();
            setSecurityBlocks(blocks);
            const alerts = await deviceSecurityService.getRecentAlerts(30);
            setSecurityAlerts(alerts);

            // Usuários para gerenciamento de dispositivos
            const usersData = await apiService.getUsers();
            setUsers(usersData);
        } catch (err: any) {
            console.error('Erro ao carregar dados:', err);
            addToast('Erro ao carregar dados de antifraude', 'error');
        }
        setLoading(false);
    };

    const getRiskLevel = (score: number): { level: string; color: string; bgColor: string } => {
        if (score >= 50) return { level: 'ALTO', color: 'text-red-400', bgColor: 'bg-red-900/30' };
        if (score >= 30) return { level: 'MÉDIO', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30' };
        return { level: 'BAIXO', color: 'text-green-400', bgColor: 'bg-green-900/30' };
    };

    const getDeviceIcon = (deviceInfo: DeviceInfo) => {
        if (deviceInfo.isMobile) {
            return <Smartphone size={16} className="text-blue-400" />;
        }
        return <Monitor size={16} className="text-zinc-400" />;
    };

    const filteredLogs = logs.filter(log => {
        // Filtro de busca
        const searchMatch = searchTerm === '' ||
            log.ip?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.platform?.toLowerCase().includes(searchTerm.toLowerCase());

        // Filtro de risco
        let riskMatch = true;
        if (filterRisk === 'HIGH') riskMatch = log.risk_score >= 50;
        else if (filterRisk === 'MEDIUM') riskMatch = log.risk_score >= 30 && log.risk_score < 50;
        else if (filterRisk === 'LOW') riskMatch = log.risk_score < 30;

        return searchMatch && riskMatch;
    });

    // Estatísticas
    const stats = {
        total: logs.length,
        highRisk: logs.filter(l => l.risk_score >= 50).length,
        mediumRisk: logs.filter(l => l.risk_score >= 30 && l.risk_score < 50).length,
        uniqueIps: new Set(logs.map(l => l.ip)).size,
        mobileAccess: logs.filter(l => {
            const device = parseUserAgent(l.user_agent || '');
            return device.isMobile;
        }).length
    };

    const exportToCSV = () => {
        const headers = ['Data', 'IP', 'Plataforma', 'Navegador', 'Ação', 'Score de Risco', 'Latitude', 'Longitude'];
        const rows = filteredLogs.map(log => {
            const device = parseUserAgent(log.user_agent || '');
            return [
                new Date(log.created_at).toLocaleString('pt-BR'),
                log.ip || '',
                device.os,
                device.browser,
                log.action,
                log.risk_score,
                log.latitude || '',
                log.longitude || ''
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `antifraude_${dateRange.start}_${dateRange.end}.csv`;
        a.click();
    };

    // Handlers de gerenciamento de dispositivos/bloqueios
    const handleUnblockUser = async (block: SecurityBlock) => {
        try {
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            await deviceSecurityService.resolveBlock(block.id, currentUser.name || 'Admin', 'Liberado pelo admin');
            addToast('Usuário desbloqueado com sucesso!', 'success');
            loadAllData();
        } catch (error) {
            addToast('Erro ao desbloquear usuário', 'error');
        }
    };

    const handleLoadUserDevices = async (userId: string) => {
        const devices = await deviceSecurityService.getUserDevices(userId);
        setTrustedDevices(devices);
        setSelectedUserId(userId);
    };

    const handleRemoveDevice = async (deviceId: string) => {
        if (!confirm('Remover este dispositivo da lista de confiáveis?')) return;
        await deviceSecurityService.removeDevice(deviceId);
        addToast('Dispositivo removido', 'success');
        if (selectedUserId) handleLoadUserDevices(selectedUserId);
    };

    const handleResetUserDevices = async (userId: string) => {
        if (!confirm('Remover TODOS os dispositivos deste usuário? Ele precisará fazer login novamente.')) return;
        await deviceSecurityService.resetUserDevices(userId);
        addToast('Dispositivos resetados. Próximo login registrará novo dispositivo.', 'success');
        loadAllData();
    };

    const handleMarkAlertRead = async (alertId: string) => {
        await deviceSecurityService.markAlertRead(alertId);
        setSecurityAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Shield className="text-red-500" size={28} />
                        Monitor Antifraude
                    </h1>
                    <p className="text-zinc-400 text-sm">Visualize IPs, dispositivos e localizações de acesso</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={loadAllData}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw size={16} /> Atualizar
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={exportToCSV}
                        className="flex items-center gap-2"
                    >
                        <Download size={16} /> Exportar
                    </Button>
                </div>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity size={16} className="text-blue-400" />
                        <p className="text-zinc-400 text-sm">Total de Acessos</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={16} className="text-red-400" />
                        <p className="text-zinc-400 text-sm">Alto Risco</p>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{stats.highRisk}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={16} className="text-yellow-400" />
                        <p className="text-zinc-400 text-sm">Médio Risco</p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400">{stats.mediumRisk}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Globe size={16} className="text-purple-400" />
                        <p className="text-zinc-400 text-sm">IPs Únicos</p>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">{stats.uniqueIps}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Smartphone size={16} className="text-green-400" />
                        <p className="text-zinc-400 text-sm">Acessos Mobile</p>
                    </div>
                    <p className="text-2xl font-bold text-green-400">{stats.mobileAccess}</p>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Buscar por IP, ação, plataforma..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={inputStyle + " pl-10"}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className={inputStyle + " w-40"}
                        />
                        <span className="text-zinc-500">até</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className={inputStyle + " w-40"}
                        />
                    </div>
                    <div className="flex gap-2">
                        {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(risk => (
                            <button
                                key={risk}
                                onClick={() => setFilterRisk(risk as any)}
                                className={`px-3 py-2 text-xs rounded-lg transition-colors ${filterRisk === risk
                                    ? risk === 'HIGH' ? 'bg-red-600 text-white'
                                        : risk === 'MEDIUM' ? 'bg-yellow-600 text-white'
                                            : risk === 'LOW' ? 'bg-green-600 text-white'
                                                : 'bg-zinc-700 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                    }`}
                            >
                                {risk === 'ALL' ? 'Todos' : risk === 'HIGH' ? 'Alto' : risk === 'MEDIUM' ? 'Médio' : 'Baixo'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lista de Logs */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                        <Fingerprint size={18} className="text-red-500" />
                        Logs de Acesso ({filteredLogs.length})
                    </h3>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-zinc-400">
                        <RefreshCw className="animate-spin mx-auto mb-2" />
                        Carregando...
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">
                        <Shield size={48} className="mx-auto mb-3 opacity-30" />
                        <p>Nenhum log de acesso encontrado.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800 max-h-[600px] overflow-y-auto">
                        {filteredLogs.map((log) => {
                            const deviceInfo = parseUserAgent(log.user_agent || '');
                            const riskInfo = getRiskLevel(log.risk_score);

                            return (
                                <div
                                    key={log.id}
                                    className="p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                    onClick={() => setSelectedLog(log)}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Ícone do dispositivo */}
                                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                            {getDeviceIcon(deviceInfo)}
                                        </div>

                                        {/* Informações principais */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-white font-medium">{log.ip || 'IP desconhecido'}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${riskInfo.bgColor} ${riskInfo.color}`}>
                                                    {riskInfo.level} ({log.risk_score})
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-zinc-400">
                                                <span className="flex items-center gap-1">
                                                    {getDeviceIcon(deviceInfo)}
                                                    {deviceInfo.os} • {deviceInfo.browser}
                                                </span>
                                                <span className="flex items-center gap-1 font-mono text-zinc-300">
                                                    <Clock size={12} />
                                                    {new Date(log.created_at).toLocaleString('pt-BR')}
                                                    <span className="text-zinc-500 text-xs ml-1">
                                                        ({Math.floor((Date.now() - new Date(log.created_at).getTime()) / 60000)} min atrás)
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-1 flex flex-wrap gap-x-3 gap-y-1 items-center">
                                                <span>Ação: <span className="text-zinc-400">{log.action}</span></span>
                                                {log.additional_data?.deviceModel && (
                                                    <span className="text-pink-400 font-medium">
                                                        📱 {log.additional_data.deviceModel}
                                                    </span>
                                                )}
                                                {log.additional_data?.battery && (
                                                    <span className={`${log.additional_data.battery.level > 20 ? 'text-green-400' : 'text-red-400'}`}>
                                                        🔋 {log.additional_data.battery.level}%
                                                    </span>
                                                )}
                                                {log.additional_data?.connection?.effectiveType && (
                                                    <span className="text-blue-400">
                                                        📶 {log.additional_data.connection.effectiveType.toUpperCase()}
                                                    </span>
                                                )}
                                                {log.latitude && log.longitude && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={10} className="inline text-red-400" />
                                                        <span className="text-zinc-400">{log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Seta */}
                                        <ChevronRight size={20} className="text-zinc-600" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* SEÇÃO: Bloqueios Pendentes */}
            {securityBlocks.length > 0 && (
                <div className="bg-gradient-to-br from-red-500/10 to-red-900/5 border border-red-500/30 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-red-500/20 flex items-center justify-between">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <Lock size={18} className="text-red-400" />
                            🚨 Bloqueios Pendentes ({securityBlocks.length})
                        </h3>
                    </div>
                    <div className="divide-y divide-red-500/10">
                        {securityBlocks.map(block => (
                            <div key={block.id} className="p-4 hover:bg-red-900/10">
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
                                    <Button
                                        variant="primary"
                                        onClick={() => handleUnblockUser(block)}
                                        className="flex items-center gap-1 text-sm"
                                    >
                                        <Unlock size={14} /> Liberar
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SEÇÃO: Alertas de Segurança */}
            {securityAlerts.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <Bell size={18} className="text-yellow-400" />
                            Alertas de Segurança
                            {securityAlerts.filter(a => !a.is_read).length > 0 && (
                                <span className="px-2 py-0.5 bg-yellow-500 text-black rounded-full text-xs font-bold">
                                    {securityAlerts.filter(a => !a.is_read).length} novos
                                </span>
                            )}
                        </h3>
                    </div>
                    <div className="divide-y divide-zinc-800 max-h-[300px] overflow-y-auto">
                        {securityAlerts.slice(0, 10).map(alert => (
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
                                        </div>
                                        <p className="text-white font-medium">{alert.title}</p>
                                        <p className="text-zinc-400 text-sm mt-1">{alert.description}</p>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                                            <span>{alert.user_name}</span>
                                            <span>{alert.user_email}</span>
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
                </div>
            )}

            {/* SEÇÃO: Gerenciar Dispositivos por Usuário */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Smartphone size={18} className="text-blue-400" />
                        Gerenciar Dispositivos Confiáveis
                    </h3>
                    <p className="text-zinc-500 text-sm mt-1">Visualize e remova dispositivos autorizados de cada cliente</p>
                </div>
                <div className="p-4">
                    <div className="flex gap-2 mb-4">
                        <select
                            className="flex-1 bg-black border border-zinc-700 rounded-lg p-3 text-white"
                            value={selectedUserId || ''}
                            onChange={(e) => e.target.value && handleLoadUserDevices(e.target.value)}
                        >
                            <option value="">Selecione um cliente...</option>
                            {users.filter(u => u.role === 'CLIENT').map(user => (
                                <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                            ))}
                        </select>
                        {selectedUserId && (
                            <Button
                                variant="secondary"
                                onClick={() => handleResetUserDevices(selectedUserId)}
                                className="text-red-400 whitespace-nowrap"
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
                                                Último: {new Date(device.last_seen_at).toLocaleString('pt-BR')} • IP: {device.last_ip}
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
                        <div className="text-center py-6 text-zinc-500">
                            <Smartphone size={32} className="mx-auto mb-2 opacity-50" />
                            <p>Nenhum dispositivo registrado para este cliente</p>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-zinc-500">
                            <p>Selecione um cliente para ver seus dispositivos</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Detalhes */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Eye size={20} className="text-blue-400" />
                                Detalhes do Acesso
                            </h3>
                            <button onClick={() => setSelectedLog(null)}>
                                <XCircle className="text-zinc-500 hover:text-white" />
                            </button>
                        </div>

                        {(() => {
                            const deviceInfo = parseUserAgent(selectedLog.user_agent || '');
                            const riskInfo = getRiskLevel(selectedLog.risk_score);

                            return (
                                <div className="space-y-6">
                                    {/* Score de Risco */}
                                    <div className={`p-4 rounded-xl ${riskInfo.bgColor} border border-zinc-700`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Shield size={24} className={riskInfo.color} />
                                                <div>
                                                    <p className="text-white font-bold">Score de Risco: {selectedLog.risk_score}/100</p>
                                                    <p className={`text-sm ${riskInfo.color}`}>Nível: {riskInfo.level}</p>
                                                </div>
                                            </div>
                                            <div className={`text-4xl font-bold ${riskInfo.color}`}>
                                                {selectedLog.risk_score}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grid de informações */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* IP */}
                                        <div className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Globe size={16} className="text-purple-400" />
                                                <span className="text-zinc-400 text-sm">Endereço IP</span>
                                            </div>
                                            <p className="text-white font-mono text-lg">{selectedLog.ip || 'Não capturado'}</p>
                                        </div>

                                        {/* Data/Hora */}
                                        <div className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Clock size={16} className="text-blue-400" />
                                                <span className="text-zinc-400 text-sm">Data/Hora</span>
                                            </div>
                                            <p className="text-white">{new Date(selectedLog.created_at).toLocaleString('pt-BR')}</p>
                                        </div>

                                        {/* Sistema Operacional */}
                                        <div className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Cpu size={16} className="text-green-400" />
                                                <span className="text-zinc-400 text-sm">Sistema Operacional</span>
                                            </div>
                                            <p className="text-white">{deviceInfo.os}</p>
                                        </div>

                                        {/* Navegador */}
                                        <div className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Globe size={16} className="text-orange-400" />
                                                <span className="text-zinc-400 text-sm">Navegador</span>
                                            </div>
                                            <p className="text-white">{deviceInfo.browser} {deviceInfo.browserVersion}</p>
                                        </div>

                                        {/* Dispositivo */}
                                        <div className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                {deviceInfo.isMobile ? <Smartphone size={16} className="text-blue-400" /> : <Monitor size={16} className="text-zinc-400" />}
                                                <span className="text-zinc-400 text-sm">Tipo de Dispositivo</span>
                                            </div>
                                            <p className="text-white">{deviceInfo.device}</p>
                                        </div>

                                        {/* Modelo do Dispositivo */}
                                        <div className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Smartphone size={16} className="text-pink-400" />
                                                <span className="text-zinc-400 text-sm">Modelo do Aparelho</span>
                                            </div>
                                            <p className="text-white font-semibold">
                                                {selectedLog.additional_data?.deviceModel ||
                                                    selectedLog.additional_data?.fingerprint?.deviceModel ||
                                                    'Não identificado'}
                                            </p>
                                        </div>

                                        {/* Resolução */}
                                        <div className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <ScreenShare size={16} className="text-cyan-400" />
                                                <span className="text-zinc-400 text-sm">Resolução de Tela</span>
                                            </div>
                                            <p className="text-white">{selectedLog.screen_resolution || 'Não informado'}</p>
                                        </div>

                                        {/* Fuso Horário */}
                                        <div className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Clock size={16} className="text-yellow-400" />
                                                <span className="text-zinc-400 text-sm">Fuso Horário</span>
                                            </div>
                                            <p className="text-white text-sm">{selectedLog.timezone || 'Não informado'}</p>
                                        </div>

                                        {/* Ação */}
                                        <div className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Activity size={16} className="text-red-400" />
                                                <span className="text-zinc-400 text-sm">Ação Realizada</span>
                                            </div>
                                            <p className="text-white">{selectedLog.action}</p>
                                        </div>
                                    </div>

                                    {/* Informações Extras do Dispositivo */}
                                    {selectedLog.additional_data && (
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Bateria */}
                                            <div className="bg-zinc-800 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-yellow-400">🔋</span>
                                                    <span className="text-zinc-400 text-sm">Bateria</span>
                                                </div>
                                                {selectedLog.additional_data.battery ? (
                                                    <div>
                                                        <p className={`text-lg font-bold ${selectedLog.additional_data.battery.level > 20 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {selectedLog.additional_data.battery.level}%
                                                        </p>
                                                        <p className="text-xs text-zinc-500">
                                                            {selectedLog.additional_data.battery.charging ? '⚡ Carregando' : '🔌 Desconectado'}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-zinc-500 text-sm">Não disponível</p>
                                                )}
                                            </div>

                                            {/* Rede/Conexão */}
                                            <div className="bg-zinc-800 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Wifi size={16} className="text-blue-400" />
                                                    <span className="text-zinc-400 text-sm">Conexão</span>
                                                </div>
                                                {selectedLog.additional_data.connection ? (
                                                    <div>
                                                        <p className="text-white font-bold uppercase">
                                                            {selectedLog.additional_data.connection.effectiveType || 'N/A'}
                                                            {selectedLog.additional_data.connection.type ? ` (${selectedLog.additional_data.connection.type})` : ''}
                                                        </p>
                                                        {selectedLog.additional_data.connection.downlink && (
                                                            <p className="text-xs text-zinc-500">
                                                                {selectedLog.additional_data.connection.downlink} Mbps
                                                                {selectedLog.additional_data.connection.rtt ? ` • ${selectedLog.additional_data.connection.rtt}ms` : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-zinc-500 text-sm">Não disponível</p>
                                                )}
                                            </div>

                                            {/* Memória do Dispositivo */}
                                            <div className="bg-zinc-800 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Cpu size={16} className="text-emerald-400" />
                                                    <span className="text-zinc-400 text-sm">Memória RAM</span>
                                                </div>
                                                <p className="text-white font-bold">
                                                    {selectedLog.additional_data.deviceMemory
                                                        ? `${selectedLog.additional_data.deviceMemory} GB`
                                                        : selectedLog.additional_data.fingerprint?.deviceMemory
                                                            ? `${selectedLog.additional_data.fingerprint.deviceMemory} GB`
                                                            : 'Não informado'}
                                                </p>
                                            </div>

                                            {/* CPU Cores */}
                                            <div className="bg-zinc-800 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Cpu size={16} className="text-purple-400" />
                                                    <span className="text-zinc-400 text-sm">Processador (Cores)</span>
                                                </div>
                                                <p className="text-white font-bold">
                                                    {selectedLog.additional_data.cpuCores
                                                        ? `${selectedLog.additional_data.cpuCores} núcleos`
                                                        : selectedLog.additional_data.fingerprint?.hardwareConcurrency
                                                            ? `${selectedLog.additional_data.fingerprint.hardwareConcurrency} núcleos`
                                                            : 'Não informado'}
                                                </p>
                                            </div>

                                            {/* Idioma */}
                                            <div className="bg-zinc-800 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Globe size={16} className="text-teal-400" />
                                                    <span className="text-zinc-400 text-sm">Idioma</span>
                                                </div>
                                                <p className="text-white">
                                                    {selectedLog.additional_data.language
                                                        || selectedLog.additional_data.fingerprint?.language
                                                        || 'Não informado'}
                                                </p>
                                            </div>

                                            {/* Touch / Cookies */}
                                            <div className="bg-zinc-800 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Fingerprint size={16} className="text-rose-400" />
                                                    <span className="text-zinc-400 text-sm">Recursos</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className={`text-xs px-2 py-1 rounded ${(selectedLog.additional_data.touchSupport ?? selectedLog.additional_data.fingerprint?.touchSupport) ? 'bg-green-900/30 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>
                                                        {(selectedLog.additional_data.touchSupport ?? selectedLog.additional_data.fingerprint?.touchSupport) ? '✓ Touch' : '✕ Touch'}
                                                    </span>
                                                    <span className={`text-xs px-2 py-1 rounded ${(selectedLog.additional_data.cookiesEnabled ?? selectedLog.additional_data.fingerprint?.cookiesEnabled) ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                                        {(selectedLog.additional_data.cookiesEnabled ?? selectedLog.additional_data.fingerprint?.cookiesEnabled) ? '✓ Cookies' : '✕ Cookies'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Localização com Mapa */}
                                    {selectedLog.latitude && selectedLog.longitude && (
                                        <div className="bg-zinc-800 rounded-lg overflow-hidden">
                                            <div className="h-[200px]">
                                                <iframe
                                                    width="100%"
                                                    height="100%"
                                                    frameBorder="0"
                                                    scrolling="no"
                                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedLog.longitude - 0.003},${selectedLog.latitude - 0.003},${selectedLog.longitude + 0.003},${selectedLog.latitude + 0.003}&layer=mapnik&marker=${selectedLog.latitude},${selectedLog.longitude}`}
                                                    style={{ border: 0 }}
                                                />
                                            </div>
                                            <div className="p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <MapPin size={16} className="text-red-400" />
                                                    <span className="text-zinc-400 text-sm">Localização do Acesso</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-white font-mono text-sm">
                                                            Lat: {selectedLog.latitude.toFixed(6)} • Lng: {selectedLog.longitude.toFixed(6)}
                                                        </p>
                                                    </div>
                                                    <a
                                                        href={`https://www.google.com/maps?q=${selectedLog.latitude},${selectedLog.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                                                    >
                                                        <MapPin size={14} />
                                                        Google Maps
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Fatores de Risco */}
                                    {selectedLog.risk_factors && selectedLog.risk_factors.length > 0 && (
                                        <div className="bg-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <AlertTriangle size={16} className="text-yellow-400" />
                                                <span className="text-zinc-400 text-sm">Fatores de Risco Identificados</span>
                                            </div>
                                            <div className="space-y-2">
                                                {selectedLog.risk_factors.map((factor, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-yellow-400 text-sm">
                                                        <AlertTriangle size={12} />
                                                        {factor}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* User Agent Completo */}
                                    <div className="bg-zinc-800 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Fingerprint size={16} className="text-zinc-400" />
                                            <span className="text-zinc-400 text-sm">User Agent Completo</span>
                                        </div>
                                        <p className="text-zinc-500 text-xs font-mono break-all">
                                            {selectedLog.user_agent || 'Não disponível'}
                                        </p>
                                    </div>

                                    {/* Botão Fechar */}
                                    <Button
                                        variant="secondary"
                                        onClick={() => setSelectedLog(null)}
                                        className="w-full"
                                    >
                                        Fechar
                                    </Button>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AntiFraudMonitor;
