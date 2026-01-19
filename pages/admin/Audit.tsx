// 📋 Audit Logs - Histórico de todas as ações do sistema
import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Filter, Search, Clock, User, Activity, Eye, Edit, CheckCircle, XCircle, LogIn, LogOut, Send, RefreshCw } from 'lucide-react';
import { Button } from '../../components/Button';
import { auditService } from '../../services/adminService';
import { AuditLog } from '../../types';
import { useToast } from '../../components/Toast';

const actionIcons: Record<AuditLog['action'], React.ElementType> = {
    CREATE: Edit,
    UPDATE: Edit,
    DELETE: Trash2,
    APPROVE: CheckCircle,
    REJECT: XCircle,
    LOGIN: LogIn,
    LOGOUT: LogOut,
    VIEW: Eye,
    EXPORT: Download,
    SEND_MESSAGE: Send
};

const actionColors: Record<AuditLog['action'], string> = {
    CREATE: 'text-green-400 bg-green-900/30',
    UPDATE: 'text-blue-400 bg-blue-900/30',
    DELETE: 'text-red-400 bg-red-900/30',
    APPROVE: 'text-green-400 bg-green-900/30',
    REJECT: 'text-red-400 bg-red-900/30',
    LOGIN: 'text-purple-400 bg-purple-900/30',
    LOGOUT: 'text-zinc-400 bg-zinc-800',
    VIEW: 'text-zinc-400 bg-zinc-800',
    EXPORT: 'text-[#D4AF37] bg-yellow-900/30',
    SEND_MESSAGE: 'text-blue-400 bg-blue-900/30'
};

const actionLabels: Record<AuditLog['action'], string> = {
    CREATE: 'Criou',
    UPDATE: 'Atualizou',
    DELETE: 'Excluiu',
    APPROVE: 'Aprovou',
    REJECT: 'Rejeitou',
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    VIEW: 'Visualizou',
    EXPORT: 'Exportou',
    SEND_MESSAGE: 'Enviou'
};

export const AuditPage: React.FC = () => {
    const { addToast } = useToast();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState<AuditLog['action'] | 'ALL'>('ALL');
    const [filterEntity, setFilterEntity] = useState<string>('ALL');

    useEffect(() => {
        loadLogs();
    }, [filterAction, filterEntity]);

    const loadLogs = async () => {
        const filters: any = { limit: 200 };
        if (filterAction !== 'ALL') filters.action = filterAction;
        if (filterEntity !== 'ALL') filters.entity = filterEntity;
        const data = await auditService.getAll(filters);
        setLogs(data);
    };

    const handleClearLogs = async () => {
        if (confirm('Tem certeza que deseja limpar todos os logs? Esta ação não pode ser desfeita.')) {
            await auditService.clear();
            addToast('Logs limpos com sucesso', 'info');
            loadLogs();
        }
    };

    const handleExport = () => {
        const csv = [
            ['ID', 'Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Detalhes'].join(','),
            ...logs.map(log => [
                log.id,
                new Date(log.timestamp).toLocaleString('pt-BR'),
                log.userName,
                log.action,
                log.entity,
                `"${log.details.replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        addToast('Logs exportados com sucesso', 'success');
    };

    const filteredLogs = logs.filter(log =>
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const entities = [...new Set(logs.map(l => l.entity))];

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                    <FileText size={32} /> Log de Auditoria
                </h1>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleExport}>
                        <Download size={18} /> Exportar CSV
                    </Button>
                    <Button variant="danger" onClick={handleClearLogs}>
                        <Trash2 size={18} /> Limpar
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Total de Logs</p>
                    <p className="text-2xl font-bold text-white">{logs.length}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Hoje</p>
                    <p className="text-2xl font-bold text-[#D4AF37]">
                        {logs.filter(l => l.timestamp.startsWith(new Date().toISOString().split('T')[0])).length}
                    </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Ações Críticas</p>
                    <p className="text-2xl font-bold text-red-400">
                        {logs.filter(l => ['DELETE', 'REJECT'].includes(l.action)).length}
                    </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-400 text-sm">Usuários Únicos</p>
                    <p className="text-2xl font-bold text-blue-400">
                        {new Set(logs.map(l => l.userId)).size}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar nos logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-[#D4AF37] outline-none"
                        />
                    </div>
                    <select
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value as any)}
                        className="bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] outline-none"
                    >
                        <option value="ALL">Todas as Ações</option>
                        {Object.keys(actionLabels).map(action => (
                            <option key={action} value={action}>{actionLabels[action as AuditLog['action']]}</option>
                        ))}
                    </select>
                    <select
                        value={filterEntity}
                        onChange={(e) => setFilterEntity(e.target.value)}
                        className="bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] outline-none"
                    >
                        <option value="ALL">Todas as Entidades</option>
                        {entities.map(entity => (
                            <option key={entity} value={entity}>{entity}</option>
                        ))}
                    </select>
                    <button onClick={loadLogs} className="p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700">
                        <RefreshCw size={20} />
                    </button>
                </div>

                {/* Timeline */}
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            <Activity size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Nenhum log encontrado</p>
                        </div>
                    ) : (
                        filteredLogs.map((log, index) => {
                            const Icon = actionIcons[log.action];
                            const colorClass = actionColors[log.action];

                            return (
                                <div key={log.id} className="flex gap-4 relative">
                                    {/* Timeline line */}
                                    {index !== filteredLogs.length - 1 && (
                                        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-zinc-800" />
                                    )}

                                    {/* Icon */}
                                    <div className={`p-2.5 rounded-full ${colorClass} z-10`}>
                                        <Icon size={16} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 bg-black border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white">{log.userName}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
                                                    {actionLabels[log.action]}
                                                </span>
                                                <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                                                    {log.entity}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                                                <Clock size={12} />
                                                {new Date(log.timestamp).toLocaleString('pt-BR')}
                                            </div>
                                        </div>
                                        <p className="text-zinc-400 text-sm">{log.details}</p>
                                        {log.entityId && (
                                            <p className="text-xs text-zinc-600 mt-1 font-mono">ID: {log.entityId}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
