
import React, { useState } from 'react';
import { Search, User, Briefcase, Phone, MapPin, Database, Copy, Check, AlertTriangle, Building2, UserSearch } from 'lucide-react';
import { Button } from '../../components/Button';
import { dataEnrichmentService, EnrichedData } from '../../services/dataEnrichmentService';
import { useToast } from '../../components/Toast';

export const DataSearch: React.FC = () => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'cpf' | 'cnpj' | 'name' | 'phone'>('cpf');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any | null>(null);

    const handleSearch = async () => {
        if (!query) return;

        // Verificar token antes
        if (!dataEnrichmentService.hasToken()) {
            const token = prompt('Insira sua Chave de API CPF (apicpf.com):');
            if (token) dataEnrichmentService.setToken(token);
            else return;
        }

        setLoading(true);
        setResult(null);

        try {
            let response;

            if (activeTab === 'cpf') {
                response = await dataEnrichmentService.searchByCpf(query);
            } else if (activeTab === 'cnpj') {
                // CNPJ usa BrasilAPI (gratuita, não precisa token)
                response = await dataEnrichmentService.searchByCnpj(query);
            } else {
                // Nome e Telefone requerem APIs avançadas
                await new Promise(r => setTimeout(r, 500));
                response = { success: false, error: 'Busca por Nome/Telefone requer APIs avançadas (BigDataCorp, Assertiva).' };
            }

            if (response?.success && response.data) {
                setResult(response.data);
                addToast('Dados encontrados com sucesso!', 'success');
            } else {
                addToast(response?.error || 'Nenhum resultado encontrado.', 'error');
            }
        } catch (err) {
            console.error(err);
            addToast('Erro ao realizar busca.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast('Copiado!', 'success');
    };

    return (
        <div className="p-8 bg-black min-h-screen text-white">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-3">
                    <Database size={32} /> Central de Investigação e Dados
                </h1>
                <p className="text-zinc-500 mt-2">
                    Consulte bases oficiais para validação cadastral, análise de crédito e enriquecimento de dados.
                </p>
            </div>

            {/* Search Box */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 shadow-xl">
                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-1 overflow-x-auto">
                    <button
                        onClick={() => { setActiveTab('cpf'); setResult(null); setQuery(''); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'cpf' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <User size={18} /> Por CPF
                    </button>
                    <button
                        onClick={() => { setActiveTab('cnpj'); setResult(null); setQuery(''); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'cnpj' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <Building2 size={18} /> Por CNPJ
                    </button>
                    <button
                        onClick={() => { setActiveTab('name'); setResult(null); setQuery(''); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'name' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <UserSearch size={18} /> Por Nome
                    </button>
                    <button
                        onClick={() => { setActiveTab('phone'); setResult(null); setQuery(''); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'phone' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <Phone size={18} /> Por Telefone
                    </button>
                </div>

                <div className="flex gap-4">
                    <input
                        type={activeTab === 'name' ? 'text' : 'text'}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={`Digite o ${activeTab.toUpperCase()} para pesquisar...`}
                        className="flex-1 bg-black border border-zinc-700 rounded-xl p-4 text-lg text-white focus:border-[#D4AF37] outline-none placeholder:text-zinc-600"
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button
                        onClick={handleSearch}
                        isLoading={loading}
                        className="px-8 text-lg bg-[#D4AF37] text-black hover:bg-[#B5942F]"
                    >
                        <Search size={20} className="mr-2" /> Consultar
                    </Button>
                </div>

                {(activeTab === 'name' || activeTab === 'phone') && (
                    <div className="mt-2 text-xs text-zinc-500 flex items-center gap-1">
                        <AlertTriangle size={12} className="text-amber-500" />
                        <span>A busca por {activeTab.toUpperCase()} requer APIs avançadas (ex: Assertiva, BigDataCorp).</span>
                    </div>
                )}
                {activeTab === 'cnpj' && (
                    <div className="mt-2 text-xs text-emerald-500 flex items-center gap-1">
                        <Check size={12} />
                        <span>Consulta CNPJ é gratuita via Brasil API!</span>
                    </div>
                )}
            </div>

            {/* Results */}
            {result && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Cartão de Identidade */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:col-span-2">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <User size={16} /> Dados Pessoais
                            </h3>

                            <div className="flex items-start gap-6">
                                <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center text-4xl font-bold text-[#D4AF37]">
                                    {result.name ? result.name[0] : '?'}
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="text-xs text-zinc-500 block">Nome Completo</label>
                                        <div className="text-xl font-bold flex items-center gap-2">
                                            {result.name || 'N/A'}
                                            <button onClick={() => copyToClipboard(result.name)} className="text-zinc-600 hover:text-white"><Copy size={14} /></button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-500 block">CPF</label>
                                            <div className="font-mono text-zinc-300">{result.cpf || query}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-500 block">Nascimento</label>
                                            <div className="text-zinc-300">{result.birthDate || 'N/A'}</div>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-zinc-500 block">Nome da Mãe</label>
                                            <div className="text-zinc-300">{result.motherName || 'N/A'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Status e Score */}
                        <div className="space-y-6">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                                <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                    <Briefcase size={16} /> Situação
                                </h3>
                                <div className={`text-center py-4 rounded-xl font-bold text-lg border ${result.status === 'REGULAR' ? 'bg-green-900/20 text-green-500 border-green-900/50' : 'bg-red-900/20 text-red-500 border-red-900/50'
                                    }`}>
                                    {result.status || 'DESCONHECIDO'}
                                </div>
                            </div>
                        </div>

                        {/* Endereço */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:col-span-2">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <MapPin size={16} /> Localização
                            </h3>
                            {result.address ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-xs text-zinc-500 block">Logradouro</label>
                                        <div className="text-white">{result.address.street}, {result.address.number}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block">Bairro</label>
                                        <div className="text-zinc-300">{result.address.neighborhood}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block">CEP</label>
                                        <div className="text-zinc-300 font-mono">{result.address.zipCode}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block">Cidade</label>
                                        <div className="text-zinc-300">{result.address.city}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block">Estado</label>
                                        <div className="text-zinc-300">{result.address.state}</div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-zinc-500 italic">Endereço não localizado.</p>
                            )}
                        </div>

                        {/* Telefones */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <Phone size={16} /> Contatos
                            </h3>
                            {result.phones && result.phones.length > 0 ? (
                                <ul className="space-y-2">
                                    {result.phones.map((phone: string, idx: number) => (
                                        <li key={idx} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                                            <span className="font-mono text-emerald-400">{phone}</span>
                                            <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-green-500">
                                                <Database size={14} />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-zinc-500 italic">Nenhum telefone vinculado.</p>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};
