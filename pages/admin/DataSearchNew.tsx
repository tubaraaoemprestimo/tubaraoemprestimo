import React, { useState } from 'react';
import { Search, User, Phone, MapPin, Database, Copy, Building2, UserSearch, Car, Mail, Home, Briefcase, Users, Calendar, DollarSign, Shield, AlertTriangle, ExternalLink, FileText, CreditCard, Heart, GraduationCap, Skull, Check, Loader2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import axios from 'axios';

const TRACKFLOW_TOKEN = '46e3cab6883b9755ce85aed22086f74b182c38415e47f6bd18b28f788f2f914f';
const TRACKFLOW_BASE_URL = 'https://apis.trackflow.services/api';

type TabType = 'cpf' | 'cnpj' | 'contatos' | 'nome-endereco' | 'veiculo';

interface TrackFlowResponse {
    success: boolean;
    api: string;
    data?: any;
    error?: string;
}

export const DataSearchNew: React.FC = () => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<TabType>('cpf');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    // Form states
    const [cpf, setCpf] = useState('');
    const [cnpj, setCnpj] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [uf, setUf] = useState('');
    const [cidade, setCidade] = useState('');
    const [placa, setPlaca] = useState('');
    const [veiculoType, setVeiculoType] = useState<'placa' | 'cpf' | 'cnpj' | 'renavam' | 'chassi'>('placa');
    const [veiculoValue, setVeiculoValue] = useState('');

    const handleSearch = async () => {
        setLoading(true);
        setResult(null);

        try {
            let apiType = '';
            let queryParams: any = {};

            switch (activeTab) {
                case 'cpf':
                    if (!cpf) {
                        addToast('Digite um CPF', 'warning');
                        setLoading(false);
                        return;
                    }
                    apiType = 'cpf';
                    queryParams.cpf = cpf.replace(/\D/g, '');
                    break;

                case 'cnpj':
                    if (!cnpj) {
                        addToast('Digite um CNPJ', 'warning');
                        setLoading(false);
                        return;
                    }
                    apiType = 'cnpj';
                    queryParams.cnpj = cnpj.replace(/\D/g, '');
                    break;

                case 'contatos':
                    if (cpf) queryParams.cpf = cpf.replace(/\D/g, '');
                    if (cnpj) queryParams.cnpj = cnpj.replace(/\D/g, '');
                    if (telefone) queryParams.telefone = telefone.replace(/\D/g, '');
                    if (email) queryParams.email = email;
                    if (nome) queryParams.nome = nome;

                    if (!cpf && !cnpj && !telefone && !email && !nome) {
                        addToast('Preencha pelo menos um campo', 'warning');
                        setLoading(false);
                        return;
                    }
                    apiType = 'contatos';
                    break;

                case 'nome-endereco':
                    if (nome) queryParams.nome = nome;
                    if (cpf) queryParams.cpf = cpf.replace(/\D/g, '');
                    if (uf) queryParams.uf = uf;
                    if (cidade) queryParams.cidade = cidade;

                    if (!nome && !cpf) {
                        addToast('Digite um nome ou CPF', 'warning');
                        setLoading(false);
                        return;
                    }
                    apiType = 'nome-endereco';
                    break;

                case 'veiculo':
                    if (!veiculoValue) {
                        addToast('Digite um valor para busca', 'warning');
                        setLoading(false);
                        return;
                    }
                    apiType = 'historico-veicular';
                    queryParams.tvalue = veiculoType;
                    queryParams.value = veiculoValue.replace(/\D/g, '');
                    break;
            }

            // Chamar backend que salva no banco e consulta TrackFlow
            const token = localStorage.getItem('token');
            const response = await axios.post(
                '/api/trackflow/query',
                { apiType, queryParams },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 30000
                }
            );

            if (response.data.success) {
                setResult(response.data.data);
                if (response.data.cached) {
                    addToast('Consulta em cache (últimas 24h)', 'info');
                } else {
                    addToast('Consulta realizada com sucesso!', 'success');
                }
            } else {
                addToast(response.data.error || 'Erro na consulta', 'error');
            }
        } catch (error: any) {
            console.error('Erro na consulta TrackFlow:', error);
            addToast(error.response?.data?.error || 'Erro ao consultar API', 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast('Copiado!', 'success');
    };

    const formatCPF = (cpf: string) => {
        return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') || cpf;
    };

    const formatCNPJ = (cnpj: string) => {
        return cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') || cnpj;
    };

    const formatPhone = (phone: string) => {
        const clean = phone?.replace(/\D/g, '') || '';
        if (clean.length === 11) {
            return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (clean.length === 10) {
            return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        return phone;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    const resetForm = () => {
        setCpf('');
        setCnpj('');
        setTelefone('');
        setEmail('');
        setNome('');
        setUf('');
        setCidade('');
        setPlaca('');
        setVeiculoValue('');
        setResult(null);
    };

    return (
        <div className="p-8 bg-black min-h-screen text-white">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-3">
                    <Database size={32} /> Central de Investigação TrackFlow
                </h1>
                <p className="text-zinc-500 mt-2">
                    5 APIs disponíveis: CPF, CNPJ, Contatos, Nome/Endereço e Histórico Veicular
                </p>
            </div>

            {/* Tabs */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
                <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-1 overflow-x-auto">
                    <button
                        onClick={() => { setActiveTab('cpf'); resetForm(); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'cpf' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <User size={18} /> Consulta CPF
                    </button>
                    <button
                        onClick={() => { setActiveTab('cnpj'); resetForm(); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'cnpj' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <Building2 size={18} /> Consulta CNPJ
                    </button>
                    <button
                        onClick={() => { setActiveTab('contatos'); resetForm(); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'contatos' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <Phone size={18} /> Contatos
                    </button>
                    <button
                        onClick={() => { setActiveTab('nome-endereco'); resetForm(); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'nome-endereco' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <UserSearch size={18} /> Nome/Endereço
                    </button>
                    <button
                        onClick={() => { setActiveTab('veiculo'); resetForm(); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'veiculo' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <Car size={18} /> Veículo
                    </button>
                </div>

                {/* Form CPF */}
                {activeTab === 'cpf' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-zinc-400 mb-2">CPF (apenas números)</label>
                            <input
                                type="text"
                                value={cpf}
                                onChange={(e) => setCpf(e.target.value)}
                                placeholder="00000000000"
                                className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white focus:border-[#D4AF37] outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} isLoading={loading} className="w-full bg-[#D4AF37] text-black hover:bg-[#B5942F]">
                            <Search size={20} className="mr-2" /> Consultar CPF
                        </Button>
                    </div>
                )}

                {/* Form CNPJ */}
                {activeTab === 'cnpj' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-zinc-400 mb-2">CNPJ (apenas números)</label>
                            <input
                                type="text"
                                value={cnpj}
                                onChange={(e) => setCnpj(e.target.value)}
                                placeholder="00000000000000"
                                className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white focus:border-[#D4AF37] outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} isLoading={loading} className="w-full bg-[#D4AF37] text-black hover:bg-[#B5942F]">
                            <Search size={20} className="mr-2" /> Consultar CNPJ
                        </Button>
                    </div>
                )}

                {/* Form Contatos */}
                {activeTab === 'contatos' && (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400">Preencha pelo menos um campo para buscar</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-2">CPF</label>
                                <input
                                    type="text"
                                    value={cpf}
                                    onChange={(e) => setCpf(e.target.value)}
                                    placeholder="00000000000"
                                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-2">CNPJ</label>
                                <input
                                    type="text"
                                    value={cnpj}
                                    onChange={(e) => setCnpj(e.target.value)}
                                    placeholder="00000000000000"
                                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-2">Telefone</label>
                                <input
                                    type="text"
                                    value={telefone}
                                    onChange={(e) => setTelefone(e.target.value)}
                                    placeholder="11999998888"
                                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-2">E-mail</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@exemplo.com"
                                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-zinc-400 mb-2">Nome</label>
                                <input
                                    type="text"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    placeholder="João Silva"
                                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                        </div>
                        <Button onClick={handleSearch} isLoading={loading} className="w-full bg-[#D4AF37] text-black hover:bg-[#B5942F]">
                            <Search size={20} className="mr-2" /> Buscar Contatos
                        </Button>
                    </div>
                )}

                {/* Form Nome/Endereço */}
                {activeTab === 'nome-endereco' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-zinc-400 mb-2">Nome *</label>
                                <input
                                    type="text"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    placeholder="João Silva"
                                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-2">CPF (opcional)</label>
                                <input
                                    type="text"
                                    value={cpf}
                                    onChange={(e) => setCpf(e.target.value)}
                                    placeholder="00000000000"
                                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-2">UF (opcional)</label>
                                <input
                                    type="text"
                                    value={uf}
                                    onChange={(e) => setUf(e.target.value.toUpperCase())}
                                    placeholder="SP"
                                    maxLength={2}
                                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-zinc-400 mb-2">Cidade (opcional)</label>
                                <input
                                    type="text"
                                    value={cidade}
                                    onChange={(e) => setCidade(e.target.value)}
                                    placeholder="São Paulo"
                                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                        </div>
                        <Button onClick={handleSearch} isLoading={loading} className="w-full bg-[#D4AF37] text-black hover:bg-[#B5942F]">
                            <Search size={20} className="mr-2" /> Buscar por Nome/Endereço
                        </Button>
                    </div>
                )}

                {/* Form Veículo */}
                {activeTab === 'veiculo' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-zinc-400 mb-2">Tipo de Busca</label>
                            <select
                                value={veiculoType}
                                onChange={(e) => setVeiculoType(e.target.value as any)}
                                className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none"
                            >
                                <option value="placa">Placa</option>
                                <option value="cpf">CPF do Proprietário</option>
                                <option value="cnpj">CNPJ do Proprietário</option>
                                <option value="renavam">Renavam</option>
                                <option value="chassi">Chassi</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-zinc-400 mb-2">Valor</label>
                            <input
                                type="text"
                                value={veiculoValue}
                                onChange={(e) => setVeiculoValue(e.target.value)}
                                placeholder={veiculoType === 'placa' ? 'ABC1D23' : 'Digite o valor'}
                                className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white focus:border-[#D4AF37] outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} isLoading={loading} className="w-full bg-[#D4AF37] text-black hover:bg-[#B5942F]">
                            <Search size={20} className="mr-2" /> Consultar Veículo
                        </Button>
                    </div>
                )}
            </div>

            {/* Results */}
            {result && result.success && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-[#D4AF37]">Resultado da Consulta</h2>
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full">
                            API: {result.api}
                        </span>
                    </div>

                    <pre className="bg-black border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 overflow-auto max-h-[600px]">
                        {JSON.stringify(result.data, null, 2)}
                    </pre>

                    <Button
                        onClick={() => copyToClipboard(JSON.stringify(result.data, null, 2))}
                        className="mt-4 bg-zinc-800 text-white hover:bg-zinc-700"
                    >
                        <Copy size={16} className="mr-2" /> Copiar JSON
                    </Button>
                </div>
            )}
        </div>
    );
};
