// 🚫 Blacklist Management - Gerenciamento de CPFs bloqueados
import React, { useState, useEffect } from 'react';
import { Ban, Plus, Trash2, ToggleLeft, ToggleRight, Search, AlertTriangle, Shield, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { blacklistService } from '../../services/adminService';
import { BlacklistEntry } from '../../types';
import { useToast } from '../../components/Toast';

export const BlacklistPage: React.FC = () => {
    const { addToast } = useToast();
    const [entries, setEntries] = useState<BlacklistEntry[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEntry, setNewEntry] = useState({ cpf: '', name: '', reason: '' });

    useEffect(() => {
        loadBlacklist();
    }, []);

    const loadBlacklist = () => {
        setEntries(blacklistService.getAll());
    };

    const handleAdd = () => {
        if (!newEntry.cpf || !newEntry.name || !newEntry.reason) {
            addToast('Preencha todos os campos', 'warning');
            return;
        }

        // Check if already exists
        if (blacklistService.check(newEntry.cpf)) {
            addToast('Este CPF já está na blacklist', 'warning');
            return;
        }

        const user = JSON.parse(localStorage.getItem('tubarao_user') || '{}');
        blacklistService.add({
            cpf: newEntry.cpf,
            name: newEntry.name,
            reason: newEntry.reason,
            addedBy: user.name || 'Admin'
        });

        addToast('CPF adicionado à blacklist', 'success');
        setNewEntry({ cpf: '', name: '', reason: '' });
        setIsModalOpen(false);
        loadBlacklist();
    };

    const handleRemove = (id: string) => {
        if (confirm('Tem certeza que deseja remover este CPF da blacklist?')) {
            blacklistService.remove(id);
            addToast('CPF removido da blacklist', 'info');
            loadBlacklist();
        }
    };

    const handleToggle = (id: string) => {
        blacklistService.toggle(id);
        loadBlacklist();
    };

    const filteredEntries = entries.filter(e =>
        e.cpf.includes(searchTerm) ||
        e.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatCPF = (cpf: string) => {
        const cleaned = cpf.replace(/\D/g, '');
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                    <Ban size={32} /> Blacklist de CPFs
                </h1>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> Adicionar CPF
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Shield className="text-[#D4AF37]" size={24} />
                        <span className="text-zinc-400">Total na Blacklist</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{entries.length}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="text-red-400" size={24} />
                        <span className="text-zinc-400">Ativos</span>
                    </div>
                    <p className="text-3xl font-bold text-red-400">{entries.filter(e => e.active).length}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <ToggleLeft className="text-zinc-400" size={24} />
                        <span className="text-zinc-400">Inativos</span>
                    </div>
                    <p className="text-3xl font-bold text-zinc-400">{entries.filter(e => !e.active).length}</p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por CPF ou nome..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-[#D4AF37] outline-none"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="divide-y divide-zinc-800">
                    {filteredEntries.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            <Ban size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Nenhum CPF na blacklist</p>
                        </div>
                    ) : (
                        filteredEntries.map(entry => (
                            <div key={entry.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${entry.active ? 'bg-red-900/50' : 'bg-zinc-800'}`}>
                                        <Ban className={entry.active ? 'text-red-400' : 'text-zinc-500'} size={24} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-lg">{entry.name}</p>
                                        <p className="text-zinc-400 font-mono">{formatCPF(entry.cpf)}</p>
                                        <p className="text-sm text-zinc-500 mt-1">
                                            Motivo: <span className="text-zinc-300">{entry.reason}</span>
                                        </p>
                                        <p className="text-xs text-zinc-600 mt-1">
                                            Adicionado por {entry.addedBy} em {new Date(entry.addedAt).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggle(entry.id)}
                                        className={`p-2 rounded-lg transition-colors ${entry.active ? 'bg-red-900/50 text-red-400 hover:bg-red-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                        title={entry.active ? 'Desativar' : 'Ativar'}
                                    >
                                        {entry.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                    </button>
                                    <button
                                        onClick={() => handleRemove(entry.id)}
                                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-red-900 hover:text-red-400 transition-colors"
                                        title="Remover permanentemente"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[#D4AF37]">Adicionar à Blacklist</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">CPF</label>
                                <input
                                    type="text"
                                    value={newEntry.cpf}
                                    onChange={(e) => setNewEntry({ ...newEntry, cpf: e.target.value })}
                                    placeholder="000.000.000-00"
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Nome</label>
                                <input
                                    type="text"
                                    value={newEntry.name}
                                    onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                                    placeholder="Nome completo"
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Motivo</label>
                                <textarea
                                    value={newEntry.reason}
                                    onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })}
                                    placeholder="Motivo do bloqueio..."
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none h-24 resize-none"
                                />
                            </div>
                            <Button onClick={handleAdd} className="w-full">
                                <Ban size={18} /> Adicionar à Blacklist
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
