
import React, { useState } from 'react';
import { Search, User, Phone, MapPin, Database, Copy, Check, AlertTriangle, Building2, UserSearch, Settings, Users, Briefcase, DollarSign, Calendar, ExternalLink, Mail, Heart, GraduationCap, Shield, UserCheck, Skull, CreditCard, Home } from 'lucide-react';
import { Button } from '../../components/Button';
import { dataEnrichmentService, EnrichedCnpjData, EnrichedCpfData } from '../../services/dataEnrichmentService';
import { useToast } from '../../components/Toast';

export const DataSearch: React.FC = () => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'cpf' | 'cnpj' | 'name' | 'phone'>('cnpj');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [cpfResult, setCpfResult] = useState<EnrichedCpfData | null>(null);
    const [cnpjResult, setCnpjResult] = useState<EnrichedCnpjData | null>(null);

    const handleSearch = async () => {
        if (!query) return;

        setLoading(true);
        setCpfResult(null);
        setCnpjResult(null);

        try {
            if (activeTab === 'cpf') {
                const response = await dataEnrichmentService.searchByCpf(query);
                if (response?.success && response.data) {
                    setCpfResult(response.data);
                    addToast('Dados completos do CPF encontrados!', 'success');
                } else {
                    addToast(response?.error || 'CPF não encontrado.', 'error');
                }
            } else if (activeTab === 'cnpj') {
                const response = await dataEnrichmentService.searchByCnpj(query);
                if (response?.success && response.data) {
                    setCnpjResult(response.data);
                    addToast('Dados do CNPJ encontrados!', 'success');
                } else {
                    addToast(response?.error || 'CNPJ não encontrado.', 'error');
                }
            } else {
                await new Promise(r => setTimeout(r, 500));
                addToast('Busca por Nome/Telefone requer APIs avançadas.', 'error');
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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatCep = (cep: string) => {
        return cep?.replace(/^(\d{5})(\d{3})$/, '$1-$2') || cep;
    };

    const formatPhone = (phone: any): string => {
        if (!phone) return '';
        // Se for objeto, tentar extrair número
        const phoneStr = typeof phone === 'object'
            ? (phone.numero || phone.telefone || phone.phone || phone.ddd + phone.numero || JSON.stringify(phone))
            : String(phone);
        const clean = phoneStr.replace(/\D/g, '');
        if (clean.length === 11) {
            return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        } else if (clean.length === 10) {
            return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
        }
        return phoneStr;
    };

    return (
        <div className="p-8 bg-black min-h-screen text-white">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-3">
                    <Database size={32} /> Central de Investigação e Dados
                </h1>
                <p className="text-zinc-500 mt-2">
                    Consulte bases completas: CPF (InfoSeek - Receita Federal) e CNPJ (BrasilAPI - gratuito).
                </p>
            </div>

            {/* Search Box */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 shadow-xl">
                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-1 overflow-x-auto">
                    <button
                        onClick={() => { setActiveTab('cpf'); setCnpjResult(null); setCpfResult(null); setQuery(''); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'cpf' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <User size={18} /> Por CPF
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Completo</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('cnpj'); setCnpjResult(null); setCpfResult(null); setQuery(''); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'cnpj' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500 hover:text-white'}`}
                    >
                        <Building2 size={18} /> Por CNPJ
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Gratuito</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('name'); setCnpjResult(null); setCpfResult(null); setQuery(''); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 opacity-50 cursor-not-allowed ${activeTab === 'name' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500'}`}
                        disabled
                    >
                        <UserSearch size={18} /> Por Nome
                    </button>
                    <button
                        onClick={() => { setActiveTab('phone'); setCnpjResult(null); setCpfResult(null); setQuery(''); }}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 opacity-50 cursor-not-allowed ${activeTab === 'phone' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-zinc-500'}`}
                        disabled
                    >
                        <Phone size={18} /> Por Telefone
                    </button>
                </div>

                <div className="flex gap-4">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={activeTab === 'cpf' ? 'Digite o CPF (apenas números)...' : 'Digite o CNPJ (apenas números)...'}
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

                {activeTab === 'cpf' && (
                    <div className="mt-3 p-3 bg-purple-900/20 border border-purple-700/50 rounded-lg">
                        <p className="text-sm text-purple-300 flex items-center gap-2">
                            <Shield size={16} />
                            <strong>Apify CPF API:</strong> Retorna dados completos - telefones, e-mails, endereços, parentes, score, renda.
                        </p>
                    </div>
                )}
                {activeTab === 'cnpj' && (
                    <div className="mt-3 p-3 bg-emerald-900/20 border border-emerald-700/50 rounded-lg">
                        <p className="text-sm text-emerald-300 flex items-center gap-2">
                            <Check size={16} />
                            <strong>BrasilAPI:</strong> 100% gratuita - Dados da Receita Federal com sócios, endereço e telefone.
                        </p>
                    </div>
                )}
            </div>

            {/* CPF Results - COMPLETO */}
            {cpfResult && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    {/* Header com Status */}
                    <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-start gap-6">
                            <div className="w-20 h-20 bg-[#D4AF37]/20 rounded-2xl flex items-center justify-center text-3xl font-bold text-[#D4AF37]">
                                {cpfResult.name?.[0] || '?'}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                    <h2 className="text-2xl font-bold text-white">{cpfResult.name}</h2>
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${cpfResult.status === 'REGULAR'
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                        : 'bg-red-500/20 text-red-400 border border-red-500/50'
                                        }`}>
                                        {cpfResult.status}
                                    </span>
                                    {cpfResult.isDead && (
                                        <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/50 flex items-center gap-1">
                                            <Skull size={14} /> Óbito
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-zinc-400">
                                    <span className="font-mono">{cpfResult.cpf}</span>
                                    <button onClick={() => copyToClipboard(cpfResult.cpf || '')} className="text-zinc-600 hover:text-white">
                                        <Copy size={14} />
                                    </button>
                                    <span>•</span>
                                    <span>{cpfResult.gender}</span>
                                    <span>•</span>
                                    <span>Nasc: {cpfResult.birthDate}</span>
                                </div>
                            </div>
                            {cpfResult.score && (
                                <div className="text-center p-4 bg-zinc-800 rounded-xl">
                                    <div className="text-3xl font-bold text-[#D4AF37]">
                                        {typeof cpfResult.score === 'object'
                                            ? (cpfResult.score as any).scoreCSB || (cpfResult.score as any).score || JSON.stringify(cpfResult.score)
                                            : cpfResult.score}
                                    </div>
                                    <div className="text-xs text-zinc-500">Score</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Filiação */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <Heart size={16} /> Filiação
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-zinc-500 block">Nome da Mãe</label>
                                    <div className="text-white">{cpfResult.motherName || 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 block">Nome do Pai</label>
                                    <div className="text-white">{cpfResult.fatherName || 'N/A'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Informações Financeiras */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <DollarSign size={16} /> Informações Financeiras
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-zinc-500 block">Renda Estimada</label>
                                    <div className="text-emerald-400 font-bold">{cpfResult.income ? `R$ ${cpfResult.income}` : 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 block">Poder Aquisitivo</label>
                                    <div className="text-white">{cpfResult.purchasingPowerRange || 'N/A'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Escolaridade e Documentos */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <GraduationCap size={16} /> Outros Dados
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-zinc-500 block">Escolaridade</label>
                                    <div className="text-white">{cpfResult.education || 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 block">Título Eleitor</label>
                                    <div className="text-zinc-300 font-mono">
                                        {cpfResult.voterRegistration
                                            ? (typeof cpfResult.voterRegistration === 'object'
                                                ? (cpfResult.voterRegistration as any).titulo || (cpfResult.voterRegistration as any).numero || 'N/A'
                                                : cpfResult.voterRegistration)
                                            : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Telefones e E-mails */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Telefones */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <Phone size={16} /> Telefones ({cpfResult.phones?.length || 0})
                            </h3>
                            {cpfResult.phones && cpfResult.phones.length > 0 ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {cpfResult.phones.map((phone: any, idx: number) => {
                                        const phoneNumber = typeof phone === 'object' ? phone.numero : phone;
                                        const phoneType = typeof phone === 'object' ? phone.tipo : '';
                                        const hasWhatsapp = typeof phone === 'object' ? phone.whatsapp : false;
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-emerald-400">{formatPhone(phoneNumber)}</span>
                                                    {phoneType && <span className="text-xs text-zinc-500">{phoneType}</span>}
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    {hasWhatsapp && <span className="text-xs text-green-500">WhatsApp</span>}
                                                    <button onClick={() => copyToClipboard(String(phoneNumber))} className="p-1.5 text-zinc-500 hover:text-white">
                                                        <Copy size={14} />
                                                    </button>
                                                    <a
                                                        href={`https://wa.me/55${String(phoneNumber).replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1.5 bg-green-600 rounded text-white hover:bg-green-500"
                                                    >
                                                        <Phone size={14} />
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-zinc-500 italic">Nenhum telefone encontrado.</p>
                            )}
                        </div>

                        {/* E-mails */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <Mail size={16} /> E-mails ({cpfResult.emails?.length || 0})
                            </h3>
                            {cpfResult.emails && cpfResult.emails.length > 0 ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {cpfResult.emails.map((email, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                            <span className="text-blue-400">{email}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => copyToClipboard(email)} className="p-1.5 text-zinc-500 hover:text-white">
                                                    <Copy size={14} />
                                                </button>
                                                <a
                                                    href={`mailto:${email}`}
                                                    className="p-1.5 bg-blue-600 rounded text-white hover:bg-blue-500"
                                                >
                                                    <Mail size={14} />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-zinc-500 italic">Nenhum e-mail encontrado.</p>
                            )}
                        </div>
                    </div>

                    {/* Endereços */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                            <Home size={16} /> Endereços ({cpfResult.addresses?.length || 0})
                        </h3>
                        {cpfResult.addresses && cpfResult.addresses.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                                {cpfResult.addresses.map((address: any, idx: number) => {
                                    // Formatar endereço se for objeto
                                    const addressStr = typeof address === 'object'
                                        ? `${address.logradouro || ''}, ${address.numero || 'S/N'} - ${address.bairro || ''}, ${address.cidade || ''} - ${address.uf || ''} CEP: ${address.cep || ''}`
                                        : String(address);
                                    return (
                                        <div key={idx} className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <span className="text-xs text-zinc-500 block mb-1">Endereço {idx + 1}</span>
                                                    <p className="text-white">{addressStr}</p>
                                                </div>
                                                <a
                                                    href={`https://www.google.com/maps/search/${encodeURIComponent(addressStr)}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-2 text-zinc-500 hover:text-[#D4AF37]"
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-zinc-500 italic">Nenhum endereço encontrado.</p>
                        )}
                    </div>

                    {/* Parentes */}
                    {cpfResult.relatives && cpfResult.relatives.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <Users size={16} /> Parentes ({cpfResult.relatives.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {cpfResult.relatives.map((relative, idx) => (
                                    <div key={idx} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-[#D4AF37]/20 rounded-full flex items-center justify-center text-[#D4AF37] font-bold">
                                                {relative.name?.[0] || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-white truncate">{relative.name}</div>
                                                <div className="text-xs text-zinc-500">{relative.relationship}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-zinc-400 font-mono">{relative.cpf}</span>
                                            <button
                                                onClick={() => {
                                                    setQuery(relative.cpf);
                                                    handleSearch();
                                                }}
                                                className="text-[#D4AF37] hover:underline text-xs"
                                            >
                                                Consultar →
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Ocupações */}
                    {cpfResult.occupations && cpfResult.occupations.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <Briefcase size={16} /> Ocupações (CBO)
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {cpfResult.occupations.map((occupation, idx) => (
                                    <span key={idx} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm">
                                        {occupation}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CNPJ Results */}
            {cnpjResult && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-start gap-6">
                            <div className="w-20 h-20 bg-[#D4AF37]/20 rounded-2xl flex items-center justify-center text-3xl font-bold text-[#D4AF37]">
                                {cnpjResult.razaoSocial?.[0] || 'E'}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-2xl font-bold text-white">{cnpjResult.razaoSocial}</h2>
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${cnpjResult.situacao === 'ATIVA'
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                        : 'bg-red-500/20 text-red-400 border border-red-500/50'
                                        }`}>
                                        {cnpjResult.situacao}
                                    </span>
                                </div>
                                <p className="text-zinc-400">{cnpjResult.nomeFantasia}</p>
                                <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
                                    <span className="font-mono">{cnpjResult.cnpj}</span>
                                    <button onClick={() => copyToClipboard(cnpjResult.cnpj || '')} className="text-zinc-600 hover:text-white">
                                        <Copy size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Informações Gerais */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <Briefcase size={16} /> Informações Gerais
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-500 block">Natureza Jurídica</label>
                                    <div className="text-white text-sm">{cnpjResult.naturezaJuridica}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 block">Porte</label>
                                    <div className="text-white">{cnpjResult.porte}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 block">Capital Social</label>
                                    <div className="text-emerald-400 font-bold text-lg">
                                        {cnpjResult.capitalSocial ? formatCurrency(cnpjResult.capitalSocial) : 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 block">Data de Abertura</label>
                                    <div className="text-white flex items-center gap-2">
                                        <Calendar size={14} className="text-zinc-500" />
                                        {cnpjResult.dataAbertura}
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    {cnpjResult.simples && (
                                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/50">
                                            Simples Nacional
                                        </span>
                                    )}
                                    {cnpjResult.mei && (
                                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full border border-purple-500/50">
                                            MEI
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Endereço */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <MapPin size={16} /> Localização
                            </h3>
                            {cnpjResult.endereco ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-zinc-500 block">Logradouro</label>
                                        <div className="text-white">
                                            {cnpjResult.endereco.logradouro}, {cnpjResult.endereco.numero}
                                            {cnpjResult.endereco.complemento && ` - ${cnpjResult.endereco.complemento}`}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block">Bairro</label>
                                        <div className="text-zinc-300">{cnpjResult.endereco.bairro}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs text-zinc-500 block">Cidade</label>
                                            <div className="text-zinc-300">{cnpjResult.endereco.cidade}/{cnpjResult.endereco.uf}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-500 block">CEP</label>
                                            <div className="text-zinc-300 font-mono">{formatCep(cnpjResult.endereco.cep)}</div>
                                        </div>
                                    </div>
                                    <a
                                        href={`https://www.google.com/maps/search/${encodeURIComponent(`${cnpjResult.endereco.logradouro}, ${cnpjResult.endereco.numero}, ${cnpjResult.endereco.cidade} ${cnpjResult.endereco.uf}`)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-[#D4AF37] hover:underline mt-2"
                                    >
                                        <ExternalLink size={14} /> Ver no Google Maps
                                    </a>
                                </div>
                            ) : (
                                <p className="text-zinc-500 italic">Endereço não informado.</p>
                            )}
                        </div>

                        {/* Contato */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <Phone size={16} /> Contatos
                            </h3>
                            <div className="space-y-4">
                                {cnpjResult.telefone && (
                                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                        <div>
                                            <label className="text-xs text-zinc-500 block">Telefone 1</label>
                                            <span className="font-mono text-emerald-400">{formatPhone(cnpjResult.telefone)}</span>
                                        </div>
                                        <a
                                            href={`https://wa.me/55${cnpjResult.telefone.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2 bg-green-600 rounded-lg text-white hover:bg-green-500"
                                        >
                                            <Phone size={16} />
                                        </a>
                                    </div>
                                )}
                                {cnpjResult.telefone2 && (
                                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                        <div>
                                            <label className="text-xs text-zinc-500 block">Telefone 2</label>
                                            <span className="font-mono text-emerald-400">{formatPhone(cnpjResult.telefone2)}</span>
                                        </div>
                                        <a
                                            href={`tel:${cnpjResult.telefone2.replace(/\D/g, '')}`}
                                            className="p-2 bg-zinc-700 rounded-lg text-white hover:bg-zinc-600"
                                        >
                                            <Phone size={16} />
                                        </a>
                                    </div>
                                )}
                                {cnpjResult.email && (
                                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                        <div>
                                            <label className="text-xs text-zinc-500 block">E-mail</label>
                                            <span className="text-blue-400">{cnpjResult.email}</span>
                                        </div>
                                        <a
                                            href={`mailto:${cnpjResult.email}`}
                                            className="p-2 bg-blue-600 rounded-lg text-white hover:bg-blue-500"
                                        >
                                            <Mail size={16} />
                                        </a>
                                    </div>
                                )}
                                {!cnpjResult.telefone && !cnpjResult.telefone2 && !cnpjResult.email && (
                                    <p className="text-zinc-500 italic">Nenhum contato informado.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Atividade Principal */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                            <DollarSign size={16} /> Atividade Econômica
                        </h3>
                        <div className="mb-4">
                            <label className="text-xs text-zinc-500 block mb-1">Atividade Principal</label>
                            <div className="text-white bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-3">
                                {cnpjResult.atividadePrincipal}
                            </div>
                        </div>
                        {cnpjResult.atividadesSecundarias && cnpjResult.atividadesSecundarias.length > 0 && (
                            <div>
                                <label className="text-xs text-zinc-500 block mb-2">Atividades Secundárias ({cnpjResult.atividadesSecundarias.length})</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                    {cnpjResult.atividadesSecundarias.map((atividade, idx) => (
                                        <div key={idx} className="text-sm text-zinc-400 bg-zinc-800/50 rounded-lg p-2">
                                            <span className="text-zinc-600 font-mono text-xs">{atividade.codigo}</span>
                                            <span className="mx-2">-</span>
                                            {atividade.descricao}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sócios */}
                    {cnpjResult.socios && cnpjResult.socios.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-zinc-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                <Users size={16} /> Quadro Societário ({cnpjResult.socios.length} sócios)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {cnpjResult.socios.map((socio, idx) => (
                                    <div key={idx} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 bg-[#D4AF37]/20 rounded-full flex items-center justify-center text-[#D4AF37] font-bold">
                                                {socio.nome?.[0] || '?'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-white">{socio.nome}</div>
                                                <div className="text-xs text-zinc-500">{socio.faixaEtaria}</div>
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">Qualificação:</span>
                                                <span className="text-zinc-300">{socio.qualificacao}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">Entrada:</span>
                                                <span className="text-zinc-300">{socio.dataEntrada}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
