
// Serviço de Enriquecimento de Dados
// CNPJ: BrasilAPI (100% gratuita)
// CPF: InfoSeek API (Produção)

import { api } from './apiClient';
import { infoseekService } from './infoseekService';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

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
    // Consultar dados por CPF via InfoSeek API (Produção)
    searchByCpf: async (cpf: string): Promise<{ success: boolean; data?: EnrichedCpfData; error?: string }> => {
        if (IS_DEMO) {
            const clean = cpf.replace(/\D/g, '');
            return {
                success: true, data: {
                    cpf: clean, name: 'Carlos Eduardo Demo', gender: 'Masculino',
                    birthDate: '1990-05-15', motherName: 'Maria Demo', status: 'Regular',
                    score: 720, income: '5000', phones: [{ numero: '5511999990001', tipo: 'celular', whatsapp: true }],
                    addresses: [{ logradouro: 'Rua das Flores', numero: '123', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01001-000' }],
                    emails: ['carlos.demo@gmail.com'], jobs: [], companies: [], relatives: [], neighbors: []
                }
            };
        }
        try {
            const cleanCpf = cpf.replace(/\D/g, '');
            console.log('[DataEnrichment] Consultando CPF via InfoSeek:', cleanCpf);

            // Chamar InfoSeek API diretamente
            const result = await infoseekService.validateCpf(cleanCpf);

            console.log('[DataEnrichment] Resposta InfoSeek CPF:', result);

            // Verificar erro
            if (!result.success || !result.data) {
                const errorMsg = result.error || 'Erro na consulta de CPF';
                return { success: false, error: errorMsg };
            }

            // Dados da InfoSeek API
            const apiData = result.data;
            const dadosCPF = (apiData as any).dadosCPF || {};
            const emails = (apiData as any).emails || {};
            const telefones = (apiData as any).telefones || {};
            const enderecos = (apiData as any).enderecos || {};

            // Normalizar resposta da InfoSeek para o formato EnrichedCpfData
            return {
                success: true,
                data: {
                    cpf: dadosCPF.CPF || cleanCpf,
                    name: dadosCPF.NOME,
                    gender: dadosCPF.SEXO === 'M' ? 'Masculino' : dadosCPF.SEXO === 'F' ? 'Feminino' : undefined,
                    birthDate: dadosCPF.NASCIMENTO?.split(' ')[0], // Remove hora
                    motherName: dadosCPF.NOME_MAE,
                    fatherName: dadosCPF.NOME_PAI,
                    status: 'Regular',
                    income: dadosCPF.RENDA,
                    rg: dadosCPF.RG ? {
                        numero: dadosCPF.RG,
                        orgaoExpedidor: dadosCPF.ORGAO_EMISSOR,
                        uf: dadosCPF.UF_EMISSAO,
                        dataExpedicao: ''
                    } : undefined,
                    voterRegistration: dadosCPF.TITULO_ELEITOR ? {
                        titulo: dadosCPF.TITULO_ELEITOR,
                        zona: '',
                        secao: '',
                        municipio: '',
                        uf: ''
                    } : undefined,
                    // Arrays vazios se não houver dados
                    emails: emails.msg ? [] : Object.values(emails),
                    phones: telefones.msg ? [] : Object.values(telefones).map((t: any) => ({
                        numero: t.numero || t,
                        tipo: t.tipo,
                        operadora: t.operadora,
                        whatsapp: t.whatsapp
                    })),
                    addresses: enderecos.msg ? [] : [enderecos].map((e: any) => ({
                        logradouro: e.logradouro || '',
                        numero: e.numero || '',
                        bairro: e.bairro || '',
                        cidade: e.cidade || '',
                        uf: e.uf || '',
                        cep: e.cep || '',
                        complemento: e.complemento
                    })),
                    occupations: dadosCPF.CBO ? [dadosCPF.CBO] : [],
                    jobs: [],
                    companies: [],
                    relatives: [],
                    neighbors: [],
                    rawData: result
                }
            };

        } catch (error: any) {
            console.error('[DataEnrichment] Erro ao consultar CPF:', error);
            return {
                success: false,
                error: error.message || 'Erro ao consultar CPF'
            };
        }
    },

    // Consultar por CNPJ (Brasil API - 100% gratuita)
    searchByCnpj: async (cnpj: string): Promise<{ success: boolean; data?: EnrichedCnpjData; error?: string }> => {
        if (IS_DEMO) {
            const clean = cnpj.replace(/\D/g, '');
            return {
                success: true, data: {
                    razaoSocial: 'Empresa Demo LTDA', nomeFantasia: 'Demo Comércio', cnpj: clean,
                    situacao: 'ATIVA', dataAbertura: '2015-03-10', naturezaJuridica: 'Sociedade Empresária Limitada',
                    atividadePrincipal: 'Comércio varejista', porte: 'ME', capitalSocial: 10000,
                    endereco: { logradouro: 'Av. Paulista', numero: '1000', complemento: 'Sala 5', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', cep: '01310-100' },
                    socios: [{ nome: 'Carlos Demo', qualificacao: 'Sócio-Administrador', dataEntrada: '2015-03-10', faixaEtaria: '31 a 40 anos' }]
                }
            };
        }
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
