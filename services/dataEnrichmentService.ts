
// Serviço de Enriquecimento de Dados
// CNPJ: BrasilAPI (100% gratuita)
// CPF: RapidAPI CPF DataPro

import { api } from './apiClient';

export interface EnrichedCpfData {
    cpf?: string;
    name?: string;
    gender?: string;
    birthDate?: string;
    age?: number;
    zodiac?: string;
    motherName?: string;
    fatherName?: string;
    status?: string;
    isDead?: boolean;
    deathDate?: string;
    emails?: string[];
    phones?: { numero: string; tipo?: string; operadora?: string; whatsapp?: boolean }[];
    addresses?: {
        logradouro: string;
        numero: string;
        bairro: string;
        cidade: string;
        uf: string;
        cep: string;
        complemento?: string;
    }[];
    education?: string;
    voterRegistration?: {
        titulo: string;
        zona: string;
        secao: string;
        municipio: string;
        uf: string;
    };
    rg?: {
        numero: string;
        orgaoExpedidor: string;
        uf: string;
        dataExpedicao: string;
    };
    cns?: string;
    income?: string;
    score?: number;
    purchasingPower?: string;
    purchasingPowerRange?: string;
    occupations?: string[];
    jobs?: { empresa: string; cargo: string; dataAdmissao: string; dataDemissao?: string }[];
    companies?: { cnpj: string; razaoSocial: string; participacao: string }[];
    relatives?: {
        cpf: string;
        name: string;
        relationship?: string;
        birthDate?: string;
        age?: number;
    }[];
    neighbors?: { cpf: string; name: string; }[];
    consumptionProfile?: Record<string, any>;
    isPEP?: boolean;
    rawData?: any;
}

export interface EnrichedCnpjData {
    razaoSocial?: string;
    nomeFantasia?: string;
    cnpj?: string;
    situacao?: string;
    dataAbertura?: string;
    naturezaJuridica?: string;
    atividadePrincipal?: string;
    atividadesSecundarias?: { codigo: number; descricao: string }[];
    porte?: string;
    capitalSocial?: number;
    endereco?: {
        logradouro: string;
        numero: string;
        complemento: string;
        bairro: string;
        cidade: string;
        uf: string;
        cep: string;
    };
    telefone?: string;
    telefone2?: string;
    email?: string;
    socios?: {
        nome: string;
        qualificacao: string;
        dataEntrada: string;
        faixaEtaria: string;
    }[];
    simples?: boolean;
    mei?: boolean;
    regimeTributario?: string;
}

export const dataEnrichmentService = {
    // Configuração de Token RapidAPI
    getRapidApiKey: () => localStorage.getItem('RAPIDAPI_KEY') || '',
    setRapidApiKey: (key: string) => localStorage.setItem('RAPIDAPI_KEY', key),
    hasRapidApiKey: () => !!localStorage.getItem('RAPIDAPI_KEY'),
    clearRapidApiKey: () => localStorage.removeItem('RAPIDAPI_KEY'),

    // Consultar dados por CPF via RapidAPI CPF DataPro
    searchByCpf: async (cpf: string): Promise<{ success: boolean; data?: EnrichedCpfData; error?: string }> => {
        const rapidApiKey = dataEnrichmentService.getRapidApiKey();

        if (!rapidApiKey) {
            return { success: false, error: 'Chave da RapidAPI não configurada. Configure nas configurações.' };
        }

        try {
            const cleanCpf = cpf.replace(/\D/g, '');
            console.log('[DataEnrichment] Consultando CPF via RapidAPI:', cleanCpf);

            // Chamar API backend (proxy para RapidAPI)
            const { data: result, error: apiError } = await api.post<any>('/cpf/lookup', {
                cpf: cleanCpf,
                rapidapi_key: rapidApiKey
            });

            console.log('[DataEnrichment] Resposta CPF:', result);

            // Verificar erro
            if (apiError || !result) {
                const errorMsg = apiError?.message || apiError?.error || 'Erro na consulta';
                return { success: false, error: errorMsg };
            }

            // Dados da API
            const data = result.data || result;
            const basicos = data.DadosBasicos || {};
            const economicos = data.DadosEconomicos || {};
            const profissao = data.profissao || {};
            const empregos = data.empregos || [];
            const empresas = data.empresas || [];
            const rg = data.registroGeral || {};
            const tituloEleitor = data.tituloEleitor || {};
            const enderecos = data.enderecos || [];
            const telefones = data.telefones || [];
            const emails = data.emails || [];
            const parentes = data.parentes || [];
            const vizinhos = data.vizinhos || [];
            const perfilConsumo = data.perfilConsumo || {};
            const flags = data.flags || {};

            // Normalizar resposta
            return {
                success: true,
                data: {
                    cpf: basicos.cpf || cleanCpf,
                    name: basicos.nome,
                    gender: basicos.sexo,
                    birthDate: basicos.dataNascimento,
                    age: basicos.idade,
                    zodiac: basicos.signo,
                    motherName: basicos.nomeMae,
                    fatherName: basicos.nomePai,
                    status: basicos.situacaoReceita || 'Regular',
                    isDead: basicos.falecido === true || basicos.obito === 'SIM',
                    cns: basicos.cns,

                    // Telefones
                    phones: telefones.map((t: any) => ({
                        numero: t.numero || t.telefone || t,
                        tipo: t.tipo,
                        operadora: t.operadora,
                        whatsapp: t.whatsapp || t.temWhatsApp
                    })),

                    // E-mails
                    emails: emails.map((e: any) => typeof e === 'string' ? e : e.email),

                    // Endereços
                    addresses: enderecos.map((e: any) => ({
                        logradouro: e.logradouro || e.endereco,
                        numero: e.numero || 'S/N',
                        bairro: e.bairro,
                        cidade: e.cidade || e.municipio,
                        uf: e.uf || e.estado,
                        cep: e.cep,
                        complemento: e.complemento
                    })),

                    // RG
                    rg: rg.numero ? {
                        numero: rg.numero,
                        orgaoExpedidor: rg.orgaoExpedidor,
                        uf: rg.uf,
                        dataExpedicao: rg.dataExpedicao
                    } : undefined,

                    // Título de Eleitor
                    voterRegistration: tituloEleitor.numero ? {
                        titulo: tituloEleitor.numero,
                        zona: tituloEleitor.zona,
                        secao: tituloEleitor.secao,
                        municipio: tituloEleitor.municipio,
                        uf: tituloEleitor.uf
                    } : undefined,

                    // Dados econômicos
                    income: economicos.rendaPresumida || economicos.renda,
                    score: economicos.score || economicos.scoreCredito,
                    purchasingPower: economicos.poderAquisitivo,
                    purchasingPowerRange: economicos.faixaRenda,

                    // Profissão
                    occupations: profissao.cbo ? [profissao.descricao || profissao.cbo] : [],

                    // Empregos
                    jobs: empregos.map((e: any) => ({
                        empresa: e.empresa || e.razaoSocial,
                        cargo: e.cargo || e.funcao,
                        dataAdmissao: e.dataAdmissao || e.admissao,
                        dataDemissao: e.dataDemissao || e.demissao
                    })),

                    // Empresas
                    companies: empresas.map((e: any) => ({
                        cnpj: e.cnpj,
                        razaoSocial: e.razaoSocial || e.empresa,
                        participacao: e.participacao || e.qualificacao
                    })),

                    // Parentes
                    relatives: parentes.map((p: any) => ({
                        cpf: p.cpf,
                        name: p.nome,
                        relationship: p.vinculo || p.parentesco,
                        birthDate: p.dataNascimento,
                        age: p.idade
                    })),

                    // Vizinhos
                    neighbors: vizinhos.map((v: any) => ({
                        cpf: v.cpf,
                        name: v.nome
                    })),

                    // Perfil de Consumo
                    consumptionProfile: perfilConsumo,

                    // Flags
                    isPEP: flags.__pessoa_exposta_politicamente__ === true,

                    // Dados brutos
                    rawData: data
                }
            };

        } catch (error) {
            console.error('[DataEnrichment] Erro CPF:', error);
            return { success: false, error: 'Falha de conexão com o serviço.' };
        }
    },

    // Consultar por CNPJ (Brasil API - 100% gratuita)
    searchByCnpj: async (cnpj: string): Promise<{ success: boolean; data?: EnrichedCnpjData; error?: string }> => {
        try {
            const cleanCnpj = cnpj.replace(/\D/g, '');
            console.log('[DataEnrichment] Consultando CNPJ via BrasilAPI:', cleanCnpj);

            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);

            if (!response.ok) {
                if (response.status === 404) {
                    return { success: false, error: 'CNPJ não encontrado na base da Receita Federal.' };
                }
                return { success: false, error: `Erro ao consultar CNPJ: ${response.status}` };
            }

            const data = await response.json();
            console.log('[DataEnrichment] Resposta CNPJ:', data);

            // Formatar sócios (QSA)
            const socios = data.qsa?.map((socio: any) => ({
                nome: socio.nome_socio,
                qualificacao: socio.qualificacao_socio,
                dataEntrada: socio.data_entrada_sociedade,
                faixaEtaria: socio.faixa_etaria
            })) || [];

            // Atividades secundárias
            const atividadesSecundarias = data.cnaes_secundarios?.map((cnae: any) => ({
                codigo: cnae.codigo,
                descricao: cnae.descricao
            })) || [];

            // Regime tributário mais recente
            const regimeTributarioRecente = data.regime_tributario?.length > 0
                ? data.regime_tributario[data.regime_tributario.length - 1]?.forma_de_tributacao
                : null;

            return {
                success: true,
                data: {
                    razaoSocial: data.razao_social,
                    nomeFantasia: data.nome_fantasia || 'Não informado',
                    cnpj: data.cnpj,
                    situacao: data.descricao_situacao_cadastral,
                    dataAbertura: data.data_inicio_atividade,
                    naturezaJuridica: data.natureza_juridica,
                    atividadePrincipal: data.cnae_fiscal_descricao,
                    atividadesSecundarias,
                    porte: data.porte,
                    capitalSocial: data.capital_social,
                    endereco: {
                        logradouro: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro || ''}`.trim(),
                        numero: data.numero || 'S/N',
                        complemento: data.complemento || '',
                        bairro: data.bairro,
                        cidade: data.municipio,
                        uf: data.uf,
                        cep: data.cep
                    },
                    telefone: data.ddd_telefone_1 || null,
                    telefone2: data.ddd_telefone_2 || null,
                    email: data.email || null,
                    socios,
                    simples: data.opcao_pelo_simples,
                    mei: data.opcao_pelo_mei,
                    regimeTributario: regimeTributarioRecente
                }
            };
        } catch (error) {
            console.error('[DataEnrichment] Erro CNPJ:', error);
            return { success: false, error: 'Erro de conexão ao consultar CNPJ.' };
        }
    }
};
