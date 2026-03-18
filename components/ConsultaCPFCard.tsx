import { useState } from 'react';
import ReactDOM from 'react-dom';
import apiService from '../services/apiService';
import { useToast } from './Toast';

interface ConsultaCPFCardProps {
    cpf: string;
}

interface TrackFlowData {
    success: boolean;
    api: string;
    data: {
        cpf: string;
        consulta: {
            cadastral: {
                cpf: string;
                nome: string;
                dataNasc: string;
                idade: number;
                sexo: string;
                mae: { nome: string };
                pai: { nome: string };
                naturalidade: string;
                renda: string;
                escolaridade: string;
                classeSocial: string;
                rg: { numero: string; orgao: string; uf: string };
                cnh: { numero: string };
                flagObito2: boolean;
            };
            credenciaisVazadas: Array<{
                tipo: string;
                valor: string;
                resultados: Array<{ url: string; login: string; password: string }>;
            }>;
            fotos: Array<{ foto: string; classificacao: number }>;
            enderecos: Array<{
                endereco: string;
                numero: number;
                complemento: string;
                bairro: string;
                cidade: string;
                uf: string;
                cep: string;
                classificacao: string;
                dataInformacao: string;
            }>;
            telefones: Array<{
                telefone: string;
                tipo: number;
                prioridade: number;
                classificacao: string;
                data: string;
            }>;
            emails: Array<{ email: string; avaliacao: string; password: string | null }>;
            contasBancos: Array<{ codBanco: number; agencia: number; conta: string; banco: string }>;
            empregos: Array<{
                cnpj_empregador: string;
                razao_social: string;
                salario: string;
                data_admissao: string;
                data_demissao: string | null;
                cbo: number;
                descricao_cbo: string;
            }>;
            placas: Array<{
                placa: string;
                renavam: number;
                chassi: string;
                modelo: string;
                anoFab: number;
                anoModelo: number;
                combustivel: string;
            }>;
            parentes: Array<{
                cpfParente: string;
                nome: string;
                grau: string;
                sexo: string;
                dataNasc: string;
                idade: number;
                renda: string;
            }>;
        };
    };
}

export default function ConsultaCPFCard({ cpf }: ConsultaCPFCardProps) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<TrackFlowData | null>(null);
    const [expanded, setExpanded] = useState(false);
    const { addToast } = useToast();

    const handleConsultar = async () => {
        const cpfLimpo = cpf?.replace(/\D/g, '') || '';
        if (!cpfLimpo || cpfLimpo.length !== 11) {
            addToast('CPF inválido ou não informado nesta solicitação.', 'error');
            return;
        }
        setLoading(true);
        try {
            const response = await apiService.consultarCPFTrackFlow(cpf);
            console.log('[TrackFlow] Resposta completa:', response);
            console.log('[TrackFlow] Estrutura data:', response?.data);
            console.log('[TrackFlow] Consulta:', response?.data?.consulta);
            setData(response);
            setExpanded(true);
            addToast('Consulta realizada com sucesso!', 'success');
        } catch (error: any) {
            console.error('Erro ao consultar CPF:', error);
            const errorMsg = error.response?.data?.error || 'Erro ao consultar CPF na TrackFlow';
            addToast(errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const formatCPF = (cpf: string) => {
        const clean = (cpf || '').replace(/\D/g, '');
        return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    const formatPhone = (phone: string) => {
        if (phone.length === 11) {
            return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
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

    // Estrutura: apiService retorna { success, data: <trackflow_response> }
    // TrackFlow retorna { success, api, data: { cpf, consulta: { ... } } }
    const trackflowData = data?.data?.data || data?.data;
    const consulta = trackflowData?.consulta;

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-white">Consulta Completa TrackFlow</h3>
                    <p className="text-sm text-zinc-400">CPF: {cpf?.replace(/\D/g, '').length === 11 ? formatCPF(cpf.replace(/\D/g, '')) : (cpf || 'Não informado')}</p>
                </div>
                <button
                    onClick={handleConsultar}
                    disabled={loading}
                    className="bg-[#D4AF37] hover:bg-[#B8941F] disabled:bg-zinc-700 text-black font-bold px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Consultando...
                        </>
                    ) : (
                        <>
                            🔍 Puxar Capivara / Consulta Completa
                        </>
                    )}
                </button>
            </div>

            {expanded && consulta && (
                <div className="space-y-6 mt-6 border-t border-zinc-800 pt-6">
                    {/* Dados Cadastrais */}
                    <Section title="📋 Dados Cadastrais">
                        <div className="grid grid-cols-2 gap-4">
                            <InfoItem label="Nome Completo" value={consulta.cadastral.nome} />
                            <InfoItem label="CPF" value={formatCPF(consulta.cadastral.cpf)} />
                            <InfoItem label="Data Nascimento" value={formatDate(consulta.cadastral.dataNasc)} />
                            <InfoItem label="Idade" value={`${consulta.cadastral.idade} anos`} />
                            <InfoItem label="Sexo" value={consulta.cadastral.sexo === 'M' ? 'Masculino' : 'Feminino'} />
                            <InfoItem label="Naturalidade" value={consulta.cadastral.naturalidade} />
                            <InfoItem label="RG" value={consulta.cadastral.rg?.numero || 'N/A'} />
                            <InfoItem label="CNH" value={consulta.cadastral.cnh?.numero || 'N/A'} />
                            <InfoItem label="Mãe" value={consulta.cadastral.mae?.nome || 'N/A'} />
                            <InfoItem label="Pai" value={consulta.cadastral.pai?.nome || 'N/A'} />
                            <InfoItem
                                label="Situação"
                                value={consulta.cadastral.flagObito2 ? '⚠️ ÓBITO' : '✅ ATIVO'}
                                highlight={consulta.cadastral.flagObito2}
                            />
                        </div>
                    </Section>

                    {/* Fotos */}
                    {consulta.fotos && consulta.fotos.length > 0 && (
                        <Section title="📸 Fotos">
                            <div className="grid grid-cols-3 gap-3">
                                {consulta.fotos.map((foto, idx) => (
                                    <PhotoViewer key={idx} url={foto.foto} label={`Foto ${idx + 1}`} />
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Situação Financeira */}
                    <Section title="💰 Situação Financeira">
                        <div className="grid grid-cols-2 gap-4">
                            <InfoItem label="Renda Estimada" value={consulta.cadastral.renda || 'N/A'} />
                            <InfoItem label="Classe Social" value={consulta.cadastral.classeSocial || 'N/A'} />
                            <InfoItem label="Escolaridade" value={consulta.cadastral.escolaridade || 'N/A'} />
                        </div>
                        {consulta.contasBancos && consulta.contasBancos.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs text-zinc-400 mb-2">Contas Bancárias:</p>
                                <div className="space-y-2">
                                    {consulta.contasBancos.slice(0, 5).map((conta, idx) => (
                                        <div key={idx} className="bg-black border border-zinc-800 rounded p-2 text-sm">
                                            <span className="text-white font-semibold">{conta.banco}</span>
                                            {conta.agencia > 0 && <span className="text-zinc-400 ml-2">Ag: {conta.agencia}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Section>

                    {/* Alertas de Segurança */}
                    {consulta.credenciaisVazadas && consulta.credenciaisVazadas.length > 0 && (
                        <Section title="🚨 Alertas de Segurança" highlight>
                            <div className="bg-red-950 border border-red-800 rounded-lg p-4">
                                <p className="text-red-400 font-bold mb-2">
                                    ⚠️ {consulta.credenciaisVazadas.length} credencial(is) vazada(s) detectada(s)
                                </p>
                                {consulta.credenciaisVazadas.slice(0, 3).map((cred, idx) => (
                                    <div key={idx} className="mt-2 text-sm">
                                        <p className="text-red-300">Tipo: {cred.tipo} - {cred.valor}</p>
                                        <p className="text-red-400 text-xs">{cred.resultados.length} vazamento(s) encontrado(s)</p>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Endereços */}
                    {consulta.enderecos && consulta.enderecos.length > 0 && (
                        <Section title="📍 Endereços">
                            <div className="space-y-3">
                                {consulta.enderecos.slice(0, 3).map((end, idx) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded-lg p-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="text-white font-semibold">
                                                    {end.endereco}, {end.numero} {end.complemento && `- ${end.complemento}`}
                                                </p>
                                                <p className="text-zinc-400 text-sm">
                                                    {end.bairro} - {end.cidade}/{end.uf} - CEP: {end.cep}
                                                </p>
                                                {end.dataInformacao && (
                                                    <p className="text-zinc-500 text-xs mt-1">
                                                        Data: {formatDate(end.dataInformacao)}
                                                    </p>
                                                )}
                                            </div>
                                            {end.classificacao && (
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    end.classificacao === 'A' ? 'bg-green-900 text-green-300' :
                                                    end.classificacao === 'B' ? 'bg-yellow-900 text-yellow-300' :
                                                    'bg-red-900 text-red-300'
                                                }`}>
                                                    {end.classificacao}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Contatos */}
                    {consulta.telefones && consulta.telefones.length > 0 && (
                        <Section title="📞 Contatos">
                            <div className="grid grid-cols-2 gap-3">
                                {consulta.telefones.slice(0, 6).map((tel, idx) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded p-2">
                                        <p className="text-white font-mono">{formatPhone(tel.telefone)}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {tel.classificacao && (
                                                <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                                                    {tel.classificacao}
                                                </span>
                                            )}
                                            {tel.data && tel.data !== 'Data Inválida' && (
                                                <span className="text-xs text-zinc-500">{formatDate(tel.data)}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {consulta.emails && consulta.emails.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-xs text-zinc-400 mb-2">E-mails:</p>
                                    <div className="space-y-2">
                                        {consulta.emails.slice(0, 3).map((email, idx) => (
                                            <div key={idx} className="bg-black border border-zinc-800 rounded p-2 text-sm">
                                                <span className="text-white">{email.email}</span>
                                                {email.avaliacao && (
                                                    <span className="text-zinc-400 ml-2 text-xs">({email.avaliacao})</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Section>
                    )}

                    {/* Empregos */}
                    {consulta.empregos && consulta.empregos.length > 0 && (
                        <Section title="💼 Empregos">
                            <div className="space-y-3">
                                {consulta.empregos.slice(0, 5).map((emp, idx) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded-lg p-3">
                                        <p className="text-white font-semibold">{emp.razao_social}</p>
                                        <p className="text-zinc-400 text-sm">{emp.descricao_cbo || `CBO: ${emp.cbo}`}</p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                                            <span>Salário: {emp.salario}</span>
                                            <span>Admissão: {formatDate(emp.data_admissao)}</span>
                                            {emp.data_demissao && <span>Demissão: {formatDate(emp.data_demissao)}</span>}
                                            {!emp.data_demissao && <span className="text-green-400">✅ ATIVO</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Veículos */}
                    {consulta.placas && consulta.placas.length > 0 && (
                        <Section title="🚗 Veículos">
                            <div className="space-y-3">
                                {consulta.placas.slice(0, 5).map((veiculo, idx) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-white font-bold">{veiculo.placa}</p>
                                                <p className="text-zinc-400 text-sm">{veiculo.modelo}</p>
                                                <p className="text-zinc-500 text-xs">
                                                    Ano: {veiculo.anoFab}/{veiculo.anoModelo} - {veiculo.combustivel}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Parentes */}
                    {consulta.parentes && consulta.parentes.length > 0 && (
                        <Section title="👨‍👩‍👧‍👦 Parentes">
                            <div className="grid grid-cols-2 gap-3">
                                {consulta.parentes.slice(0, 6).map((parente, idx) => (
                                    <div key={idx} className="bg-black border border-zinc-800 rounded p-3">
                                        <p className="text-white font-semibold">{parente.nome}</p>
                                        <p className="text-zinc-400 text-sm">{parente.grau}</p>
                                        {parente.idade > 0 && (
                                            <p className="text-zinc-500 text-xs">{parente.idade} anos</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                </div>
            )}
        </div>
    );
}

function Section({ title, children, highlight = false }: { title: string; children: React.ReactNode; highlight?: boolean }) {
    return (
        <div className={`border rounded-lg p-4 ${highlight ? 'border-red-800 bg-red-950/20' : 'border-zinc-800 bg-black'}`}>
            <h4 className="text-white font-bold mb-3">{title}</h4>
            {children}
        </div>
    );
}

function InfoItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div>
            <p className="text-xs text-zinc-500 mb-1">{label}</p>
            <p className={`text-sm font-semibold ${highlight ? 'text-red-400' : 'text-white'}`}>{value}</p>
        </div>
    );
}

function PhotoViewer({ url, label }: { url: string; label: string }) {
    const [open, setOpen] = useState(false);
    const [imgError, setImgError] = useState(false);

    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const overlay = open ? ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                background: 'rgba(0,0,0,0.96)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}
            onClick={handleClose}
        >
            <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                <button
                    onClick={handleClose}
                    style={{
                        position: 'absolute',
                        top: '-40px',
                        right: '0',
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: 'white',
                        fontSize: '24px',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ×
                </button>
                <img
                    src={url}
                    alt={label}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '90vh',
                        objectFit: 'contain',
                        borderRadius: '8px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <div
                onClick={handleOpen}
                className="relative aspect-square bg-black border border-zinc-800 rounded-lg overflow-hidden cursor-pointer hover:border-[#D4AF37] transition-colors group"
            >
                {!imgError ? (
                    <img
                        src={url}
                        alt={label}
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <span className="text-4xl">📷</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-bold">🔍 Ver</span>
                </div>
            </div>
            {overlay}
        </>
    );
}
