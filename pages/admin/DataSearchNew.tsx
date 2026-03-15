import React, { useState } from 'react';
import { Search, User, Phone, MapPin, Database, Copy, Building2, UserSearch, Car, Mail, Home, Briefcase, Users, Calendar, DollarSign, Shield, AlertTriangle, ExternalLink, FileText, CreditCard, Heart, GraduationCap, Skull, Check, Loader2, Download } from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { api } from '../../services/apiClient';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Filtros do histórico
    const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
    const [filterSearch, setFilterSearch] = useState('');

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

    // Carregar histórico ao montar componente
    React.useEffect(() => {
        loadHistory();
    }, [activeTab]);

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
                    // Placa e chassi precisam manter letras, só remove espaços e traços
                    if (veiculoType === 'placa' || veiculoType === 'chassi') {
                        queryParams.value = veiculoValue.replace(/[\s\-]/g, '').toUpperCase();
                    } else {
                        queryParams.value = veiculoValue.replace(/\D/g, '');
                    }
                    break;
            }

            // Chamar backend que salva no banco e consulta TrackFlow
            const { data: response, error } = await api.post<any>('/trackflow/query',
                { apiType, queryParams },
                { timeout: 90000 }
            );

            if (error) {
                addToast(error.error || 'Erro ao consultar API', 'error');
                setLoading(false);
                return;
            }

            if (response.success) {
                setResult(response.data);
                if (response.cached) {
                    addToast('Consulta em cache (últimas 24h)', 'info');
                } else {
                    addToast('Consulta realizada com sucesso!', 'success');
                }
                loadHistory(); // Recarregar histórico após nova consulta
            } else {
                addToast(response.error || 'Erro na consulta', 'error');
            }
        } catch (error: any) {
            console.error('Erro na consulta TrackFlow:', error);
            addToast(error?.error || 'Erro ao consultar API', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const apiTypeMap: any = {
                'cpf': 'cpf',
                'cnpj': 'cnpj',
                'contatos': 'contatos',
                'nome-endereco': 'nome-endereco',
                'veiculo': 'historico-veicular'
            };

            const { data: response } = await api.get<any>(`/trackflow/history`, {
                params: { apiType: apiTypeMap[activeTab], limit: 100 }
            });

            if (response && response.success) {
                setHistory(response.queries || []);
            }
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Calcular estatísticas do histórico
    const getStatistics = () => {
        const total = history.length;
        const success = history.filter(h => h.success).length;
        const error = history.filter(h => !h.success).length;
        const cached = history.filter(h => h.response?.cached).length;

        // Consultas por tipo
        const byType: any = {};
        history.forEach(h => {
            byType[h.apiType] = (byType[h.apiType] || 0) + 1;
        });

        // Consultas por dia (últimos 7 dias)
        const byDay: any = {};
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return date.toISOString().split('T')[0];
        }).reverse();

        last7Days.forEach(day => {
            byDay[day] = 0;
        });

        history.forEach(h => {
            const day = new Date(h.createdAt).toISOString().split('T')[0];
            if (byDay[day] !== undefined) {
                byDay[day]++;
            }
        });

        return {
            total,
            success,
            error,
            cached,
            successRate: total > 0 ? ((success / total) * 100).toFixed(1) : '0',
            byType,
            byDay
        };
    };

    const viewHistoryItem = (item: any) => {
        if (item.success && item.response) {
            setResult(item.response);
            setShowHistory(false);
            addToast('Consulta carregada do histórico', 'info');
        }
    };

    // Filtrar histórico
    const getFilteredHistory = () => {
        let filtered = [...history];

        // Filtro por período
        if (filterPeriod !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            filtered = filtered.filter(item => {
                const itemDate = new Date(item.createdAt);

                if (filterPeriod === 'today') {
                    return itemDate >= today;
                } else if (filterPeriod === 'week') {
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return itemDate >= weekAgo;
                } else if (filterPeriod === 'month') {
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    return itemDate >= monthAgo;
                }
                return true;
            });
        }

        // Filtro por status
        if (filterStatus !== 'all') {
            filtered = filtered.filter(item => {
                if (filterStatus === 'success') return item.success;
                if (filterStatus === 'error') return !item.success;
                return true;
            });
        }

        // Filtro por busca (CPF, CNPJ, Placa, etc)
        if (filterSearch.trim()) {
            const search = filterSearch.toLowerCase().replace(/\D/g, '');
            filtered = filtered.filter(item => {
                const params = JSON.stringify(item.queryParams).toLowerCase().replace(/\D/g, '');
                return params.includes(search);
            });
        }

        return filtered;
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

    // Exportar resultado para PDF
    const exportToPDF = async () => {
        if (!result) {
            addToast('Nenhum resultado para exportar', 'warning');
            return;
        }

        try {
            addToast('Gerando PDF...', 'info');

            const element = document.getElementById('result-container');
            if (!element) {
                addToast('Erro ao capturar resultado', 'error');
                return;
            }

            // Capturar o elemento como imagem
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#000000',
                logging: false,
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            // Adicionar primeira página
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Adicionar páginas extras se necessário
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Gerar nome do arquivo
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const apiType = result.api || 'consulta';
            const fileName = `TrackFlow_${apiType}_${timestamp}.pdf`;

            // Salvar PDF
            pdf.save(fileName);
            addToast('PDF exportado com sucesso!', 'success');
        } catch (error: any) {
            console.error('Erro ao exportar PDF:', error);
            addToast('Erro ao exportar PDF: ' + error.message, 'error');
        }
    };

    // Renderizar dados formatados baseado no tipo de consulta
    const renderFormattedData = (result: any) => {
        const data = result.data;

        // CPF ou Contatos (retorna dados de pessoa)
        if (result.api === 'cpf' || result.api === 'contatos') {
            const pessoa = data?.consulta || data?.consulta?.[0]?.consulta || {};
            const cadastral = pessoa?.cadastral || {};

            return (
                <div className="space-y-6">
                    {/* Dados Cadastrais */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                            <User size={24} /> Dados Cadastrais
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <InfoCard label="Nome" value={cadastral.nome} icon={<User size={16} />} />
                            <InfoCard label="CPF" value={formatCPF(cadastral.cpf)} icon={<CreditCard size={16} />} />
                            <InfoCard label="Data Nascimento" value={cadastral.dataNasc} icon={<Calendar size={16} />} />
                            <InfoCard label="Idade" value={`${cadastral.idade} anos`} icon={<Calendar size={16} />} />
                            <InfoCard label="Sexo" value={cadastral.sexo === 'M' ? 'Masculino' : 'Feminino'} icon={<User size={16} />} />
                            <InfoCard label="Naturalidade" value={cadastral.naturalidade} icon={<MapPin size={16} />} />
                            <InfoCard label="Mãe" value={cadastral.mae?.nome} icon={<Heart size={16} />} />
                            <InfoCard label="Pai" value={cadastral.pai?.nome} icon={<Heart size={16} />} />
                            <InfoCard label="Renda Estimada" value={cadastral.renda} icon={<DollarSign size={16} />} />
                            <InfoCard label="Escolaridade" value={cadastral.escolaridade} icon={<GraduationCap size={16} />} />
                            <InfoCard label="Classe Social" value={`${cadastral.classeSocial} (${cadastral.subClasseSocial})`} icon={<Users size={16} />} />
                            <InfoCard label="RG" value={cadastral.rg?.numero} icon={<CreditCard size={16} />} />
                        </div>
                    </div>

                    {/* Endereços */}
                    {pessoa.enderecos && pessoa.enderecos.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                                <Home size={24} /> Endereços ({pessoa.enderecos.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pessoa.enderecos.slice(0, 6).map((end: any, idx: number) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded-xl p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                                                end.classificacao === 'A' ? 'bg-green-500/20 text-green-400' :
                                                end.classificacao === 'B' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-zinc-700 text-zinc-400'
                                            }`}>
                                                {end.classificacao || 'N/A'}
                                            </span>
                                            <span className="text-xs text-zinc-500">
                                                {formatDate(end.dataInformacao)}
                                            </span>
                                        </div>
                                        <p className="text-white font-bold text-sm">
                                            {end.endereco}, {end.numero}
                                        </p>
                                        {end.complemento && (
                                            <p className="text-zinc-400 text-xs">{end.complemento}</p>
                                        )}
                                        <p className="text-zinc-400 text-sm mt-1">
                                            {end.bairro} - {end.cidade}/{end.uf}
                                        </p>
                                        <p className="text-zinc-500 text-xs mt-1">CEP: {end.cep}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Telefones */}
                    {pessoa.telefones && pessoa.telefones.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                                <Phone size={24} /> Telefones ({pessoa.telefones.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {pessoa.telefones.slice(0, 12).map((tel: any, idx: number) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-bold">{formatPhone(tel.telefone)}</p>
                                            <p className="text-xs text-zinc-500">
                                                {tel.tipo === 3 ? 'Celular' : tel.tipo === 1 ? 'Fixo' : 'Outro'} - {tel.classificacao}
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => copyToClipboard(tel.telefone)}
                                            className="bg-zinc-800 hover:bg-zinc-700 p-2"
                                        >
                                            <Copy size={14} />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Emails */}
                    {pessoa.emails && pessoa.emails.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                                <Mail size={24} /> E-mails ({pessoa.emails.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {pessoa.emails.map((email: any, idx: number) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                                        <p className="text-white font-mono text-sm">{email.email}</p>
                                        <Button
                                            onClick={() => copyToClipboard(email.email)}
                                            className="bg-zinc-800 hover:bg-zinc-700 p-2"
                                        >
                                            <Copy size={14} />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empregos */}
                    {pessoa.empregos && pessoa.empregos.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                                <Briefcase size={24} /> Vínculos Empregatícios ({pessoa.empregos.length})
                            </h3>
                            <div className="space-y-3">
                                {pessoa.empregos.slice(0, 5).map((emp: any, idx: number) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded-xl p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-white font-bold">{emp.razao_social}</p>
                                                {emp.nome_fantasia && (
                                                    <p className="text-zinc-400 text-sm">{emp.nome_fantasia}</p>
                                                )}
                                                <p className="text-zinc-500 text-xs mt-1">
                                                    CNPJ: {formatCNPJ(emp.cnpj_empregador)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                {emp.salario && (
                                                    <p className="text-green-400 font-bold">{emp.salario}</p>
                                                )}
                                                <p className="text-xs text-zinc-500">
                                                    {formatDate(emp.data_admissao)}
                                                    {emp.data_demissao && ` - ${formatDate(emp.data_demissao)}`}
                                                </p>
                                            </div>
                                        </div>
                                        {emp.descricao_cbo && (
                                            <p className="text-zinc-400 text-sm mt-2">{emp.descricao_cbo}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Veículos */}
                    {pessoa.placas && pessoa.placas.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                                <Car size={24} /> Veículos ({pessoa.placas.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pessoa.placas.map((veiculo: any, idx: number) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="bg-[#D4AF37] text-black px-3 py-1 rounded font-bold">
                                                {veiculo.placa}
                                            </span>
                                            <span className="text-xs text-zinc-500">
                                                {veiculo.anoFab}/{veiculo.anoModelo}
                                            </span>
                                        </div>
                                        <p className="text-white font-bold">{veiculo.modelo}</p>
                                        <p className="text-zinc-400 text-sm">Renavam: {veiculo.renavam}</p>
                                        <p className="text-zinc-400 text-sm">Chassi: {veiculo.chassi}</p>
                                        <p className="text-zinc-500 text-xs mt-2">{veiculo.combustivel}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dívida Ativa */}
                    {pessoa.dividaAtiva && pessoa.dividaAtiva.length > 0 && (
                        <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                                <AlertTriangle size={24} /> Dívida Ativa ({pessoa.dividaAtiva.length})
                            </h3>
                            <div className="space-y-3">
                                {pessoa.dividaAtiva.map((divida: any, idx: number) => (
                                    <div key={idx} className="bg-black border border-red-900 rounded-xl p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-white font-bold">{divida.receita_principal}</p>
                                                <p className="text-zinc-400 text-sm">Inscrição: {divida.numero_inscricao}</p>
                                                <p className="text-zinc-500 text-xs">
                                                    {divida.situacao_inscricao} - {formatDate(divida.data_inscricao)}
                                                </p>
                                            </div>
                                            <p className="text-red-400 font-bold text-lg">
                                                R$ {parseFloat(divida.valor_consolidado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // CNPJ
        if (result.api === 'cnpj') {
            return (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                        <Building2 size={24} /> Dados da Empresa
                    </h3>
                    <pre className="bg-black border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 overflow-auto max-h-[600px]">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            );
        }

        // Histórico Veicular
        if (result.api === 'historico-veicular') {
            const consultaArray = data?.consulta || [];

            // Placa não encontrada na base
            if (consultaArray.length === 0) {
                return (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                        <div className="text-6xl mb-4">🚗</div>
                        <h3 className="text-xl font-bold text-zinc-300 mb-2">Nenhum dado encontrado</h3>
                        <p className="text-zinc-500 text-sm">
                            A placa/veículo consultado não foi encontrado na base de dados da TrackFlow.
                        </p>
                        <p className="text-zinc-600 text-xs mt-2">
                            Tente consultar por Renavam, Chassi, ou CPF/CNPJ do proprietário.
                        </p>
                    </div>
                );
            }

            const consulta = consultaArray[0] || {};
            const pf = consulta.pf || {};

            return (
                <div className="space-y-6">
                    {/* Dados do Veículo */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                            <Car size={24} /> Dados do Veículo
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <InfoCard label="Placa" value={consulta.placa} icon={<Car size={16} />} />
                            <InfoCard label="Modelo" value={consulta.modelo} icon={<Car size={16} />} />
                            <InfoCard label="Ano Fab/Modelo" value={`${consulta.ano_fabricacao}/${consulta.ano_modelo}`} icon={<Calendar size={16} />} />
                            <InfoCard label="Chassi" value={consulta.chassi} icon={<Shield size={16} />} />
                            <InfoCard label="Renavam" value={consulta.renavam} icon={<FileText size={16} />} />
                            <InfoCard label="Combustível" value={consulta.combustivel} icon={<AlertTriangle size={16} />} />
                            <InfoCard label="Tipo" value={consulta.tipo} icon={<Car size={16} />} />
                            <InfoCard label="Espécie" value={consulta.especie} icon={<Car size={16} />} />
                        </div>
                    </div>

                    {/* Fotos do Veículo */}
                    {consulta.fotosVeiculo && consulta.fotosVeiculo.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-[#D4AF37] mb-4">
                                Fotos do Veículo ({consulta.fotosVeiculo.length})
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {consulta.fotosVeiculo.slice(0, 8).map((foto: string, idx: number) => (
                                    <img
                                        key={idx}
                                        src={foto}
                                        alt={`Veículo ${idx + 1}`}
                                        className="w-full h-32 object-cover rounded-xl border border-zinc-700 hover:border-[#D4AF37] transition-colors cursor-pointer"
                                        onClick={() => window.open(foto, '_blank')}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dados do Proprietário */}
                    {pf.cadastral && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                                <User size={24} /> Proprietário
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <InfoCard label="Nome" value={pf.cadastral.nome} icon={<User size={16} />} />
                                <InfoCard label="CPF" value={formatCPF(pf.cadastral.cpf)} icon={<CreditCard size={16} />} />
                                <InfoCard label="Data Nascimento" value={pf.cadastral.dataNasc} icon={<Calendar size={16} />} />
                                <InfoCard label="Idade" value={`${pf.cadastral.idade} anos`} icon={<Calendar size={16} />} />
                                <InfoCard label="Naturalidade" value={pf.cadastral.naturalidade} icon={<MapPin size={16} />} />
                                <InfoCard label="Renda" value={pf.cadastral.renda} icon={<DollarSign size={16} />} />
                            </div>
                        </div>
                    )}

                    {/* Endereços do Proprietário */}
                    {pf.enderecos && pf.enderecos.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                                <Home size={24} /> Endereços do Proprietário ({pf.enderecos.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pf.enderecos.slice(0, 4).map((end: any, idx: number) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded-xl p-4">
                                        <p className="text-white font-bold text-sm">
                                            {end.endereco}, {end.numero}
                                        </p>
                                        {end.complemento && (
                                            <p className="text-zinc-400 text-xs">{end.complemento}</p>
                                        )}
                                        <p className="text-zinc-400 text-sm mt-1">
                                            {end.bairro} - {end.cidade}/{end.uf}
                                        </p>
                                        <p className="text-zinc-500 text-xs mt-1">CEP: {end.cep}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Telefones do Proprietário */}
                    {pf.telefones && pf.telefones.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                                <Phone size={24} /> Telefones do Proprietário ({pf.telefones.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {pf.telefones.slice(0, 9).map((tel: any, idx: number) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded-xl p-3">
                                        <p className="text-white font-bold">{formatPhone(tel.telefone)}</p>
                                        <p className="text-xs text-zinc-500">
                                            {tel.tipo === 3 ? 'Celular' : tel.tipo === 1 ? 'Fixo' : 'Outro'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Fallback: JSON bruto
        return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <pre className="bg-black border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 overflow-auto max-h-[600px]">
                    {JSON.stringify(data, null, 2)}
                </pre>
            </div>
        );
    };

    // Componente auxiliar para cards de informação
    const InfoCard = ({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) => {
        if (!value || value === 'N/A' || value === '') return null;

        return (
            <div className="bg-black border border-zinc-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-zinc-500">{icon}</span>
                    <p className="text-xs text-zinc-500 uppercase">{label}</p>
                </div>
                <p className="text-white font-bold text-sm">{value}</p>
            </div>
        );
    };

    return (
        <div className="p-8 bg-black min-h-screen text-white">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-3">
                        <Database size={32} /> Central de Investigação TrackFlow
                    </h1>
                    <p className="text-zinc-500 mt-2">
                        5 APIs disponíveis: CPF, CNPJ, Contatos, Nome/Endereço e Histórico Veicular
                    </p>
                </div>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <FileText size={18} />
                    {showHistory ? 'Ocultar Histórico' : 'Ver Histórico'}
                    {history.length > 0 && (
                        <span className="bg-[#D4AF37] text-black px-2 py-0.5 rounded-full text-xs font-bold">
                            {history.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Histórico de Consultas */}
            {showHistory && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
                    <h2 className="text-xl font-bold text-[#D4AF37] mb-4">Histórico de Consultas</h2>

                    {/* Dashboard de Estatísticas */}
                    {history.length > 0 && (
                        <div className="mb-6 space-y-4">
                            {/* Cards de Estatísticas */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-black border border-zinc-800 rounded-xl p-4">
                                    <p className="text-xs text-zinc-400 mb-1">Total de Consultas</p>
                                    <p className="text-2xl font-bold text-white">{getStatistics().total}</p>
                                </div>
                                <div className="bg-black border border-green-900/30 rounded-xl p-4">
                                    <p className="text-xs text-zinc-400 mb-1">Sucesso</p>
                                    <p className="text-2xl font-bold text-green-400">{getStatistics().success}</p>
                                </div>
                                <div className="bg-black border border-red-900/30 rounded-xl p-4">
                                    <p className="text-xs text-zinc-400 mb-1">Erros</p>
                                    <p className="text-2xl font-bold text-red-400">{getStatistics().error}</p>
                                </div>
                                <div className="bg-black border border-blue-900/30 rounded-xl p-4">
                                    <p className="text-xs text-zinc-400 mb-1">Taxa de Sucesso</p>
                                    <p className="text-2xl font-bold text-blue-400">{getStatistics().successRate}%</p>
                                </div>
                            </div>

                            {/* Gráfico de Consultas por Tipo */}
                            <div className="bg-black border border-zinc-800 rounded-xl p-4">
                                <h3 className="text-sm font-bold text-zinc-400 mb-3">Consultas por Tipo</h3>
                                <div className="space-y-2">
                                    {Object.entries(getStatistics().byType).map(([type, count]: [string, any]) => (
                                        <div key={type} className="flex items-center gap-3">
                                            <div className="w-24 text-xs text-zinc-400 uppercase">{type}</div>
                                            <div className="flex-1 bg-zinc-900 rounded-full h-6 overflow-hidden">
                                                <div
                                                    className="bg-[#D4AF37] h-full flex items-center justify-end pr-2"
                                                    style={{ width: `${(count / getStatistics().total) * 100}%` }}
                                                >
                                                    <span className="text-xs font-bold text-black">{count}</span>
                                                </div>
                                            </div>
                                            <div className="w-12 text-xs text-zinc-400 text-right">
                                                {((count / getStatistics().total) * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Gráfico de Consultas por Dia */}
                            <div className="bg-black border border-zinc-800 rounded-xl p-4">
                                <h3 className="text-sm font-bold text-zinc-400 mb-3">Consultas nos Últimos 7 Dias</h3>
                                <div className="flex items-end justify-between gap-2 h-32">
                                    {Object.entries(getStatistics().byDay).map(([day, count]: [string, any]) => {
                                        const maxCount = Math.max(...Object.values(getStatistics().byDay) as number[]);
                                        const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                                        return (
                                            <div key={day} className="flex-1 flex flex-col items-center gap-2">
                                                <div className="w-full bg-zinc-900 rounded-t-lg relative" style={{ height: `${height}%`, minHeight: count > 0 ? '20px' : '0' }}>
                                                    {count > 0 && (
                                                        <div className="absolute inset-0 bg-[#D4AF37] rounded-t-lg flex items-center justify-center">
                                                            <span className="text-xs font-bold text-black">{count}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-zinc-500 text-center">
                                                    {new Date(day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Créditos Economizados */}
                            {getStatistics().cached > 0 && (
                                <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-700/40 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-green-400 mb-1">💰 Créditos Economizados (Cache 24h)</p>
                                            <p className="text-2xl font-bold text-green-400">{getStatistics().cached} consultas</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-zinc-400">Economia estimada</p>
                                            <p className="text-lg font-bold text-green-400">
                                                R$ {(getStatistics().cached * 0.50).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Filtros */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        {/* Filtro por Período */}
                        <div>
                            <label className="block text-xs text-zinc-400 mb-2">Período</label>
                            <select
                                value={filterPeriod}
                                onChange={(e) => setFilterPeriod(e.target.value as any)}
                                className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-[#D4AF37] outline-none"
                            >
                                <option value="all">Todos</option>
                                <option value="today">Hoje</option>
                                <option value="week">Última Semana</option>
                                <option value="month">Último Mês</option>
                            </select>
                        </div>

                        {/* Filtro por Status */}
                        <div>
                            <label className="block text-xs text-zinc-400 mb-2">Status</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-[#D4AF37] outline-none"
                            >
                                <option value="all">Todos</option>
                                <option value="success">Sucesso</option>
                                <option value="error">Erro</option>
                            </select>
                        </div>

                        {/* Busca */}
                        <div className="md:col-span-2">
                            <label className="block text-xs text-zinc-400 mb-2">Buscar (CPF, CNPJ, Placa, etc)</label>
                            <input
                                type="text"
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                placeholder="Digite para buscar..."
                                className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-[#D4AF37] outline-none"
                            />
                        </div>
                    </div>

                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
                        </div>
                    ) : history.length === 0 ? (
                        <p className="text-zinc-500 text-center py-8">Nenhuma consulta realizada ainda</p>
                    ) : (
                        <>
                            {/* Contador de resultados filtrados */}
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-zinc-400">
                                    {getFilteredHistory().length} de {history.length} consultas
                                </p>
                                {(filterPeriod !== 'all' || filterStatus !== 'all' || filterSearch) && (
                                    <button
                                        onClick={() => {
                                            setFilterPeriod('all');
                                            setFilterStatus('all');
                                            setFilterSearch('');
                                        }}
                                        className="text-xs text-[#D4AF37] hover:underline"
                                    >
                                        Limpar filtros
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {getFilteredHistory().length === 0 ? (
                                    <p className="text-zinc-500 text-center py-8">Nenhuma consulta encontrada com os filtros aplicados</p>
                                ) : (
                                    getFilteredHistory().map((item) => (
                                        <div
                                            key={item.id}
                                            className="bg-black border border-zinc-800 rounded-xl p-4 hover:border-[#D4AF37] transition-colors cursor-pointer"
                                            onClick={() => viewHistoryItem(item)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {item.success ? (
                                                        <Check className="text-green-400" size={20} />
                                                    ) : (
                                                        <AlertTriangle className="text-red-400" size={20} />
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-white">
                                                            {item.apiType.toUpperCase()}
                                                        </p>
                                                        <p className="text-xs text-zinc-500">
                                                            {formatDate(item.createdAt)} - {new Date(item.createdAt).toLocaleTimeString('pt-BR')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-zinc-400">
                                                        {JSON.stringify(item.queryParams).substring(0, 50)}...
                                                    </p>
                                                    {!item.success && item.errorMsg && (
                                                        <p className="text-xs text-red-400 mt-1">{item.errorMsg}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

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
                <div id="result-container" className="space-y-6">
                    {/* Header com ações */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold text-[#D4AF37]">Resultado da Consulta</h2>
                                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold">
                                    {result.api?.toUpperCase()}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => copyToClipboard(JSON.stringify(result.data, null, 2))}
                                    className="bg-zinc-800 text-white hover:bg-zinc-700"
                                >
                                    <Copy size={16} className="mr-2" /> Copiar JSON
                                </Button>
                                <Button
                                    onClick={exportToPDF}
                                    className="bg-[#D4AF37] text-black hover:bg-[#B5942F]"
                                >
                                    <Download size={16} className="mr-2" /> Exportar PDF
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Renderizar dados formatados baseado no tipo de API */}
                    {renderFormattedData(result)}
                </div>
            )}
        </div>
    );
};
