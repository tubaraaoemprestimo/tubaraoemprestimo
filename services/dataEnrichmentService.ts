
// Serviço de Enriquecimento de Dados
// Usa Edge Function do Supabase como proxy para API CPF (resolve CORS)
// API CPF: https://apicpf.com/ - 100 consultas/dia grátis

// URL do Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://cwhiujeragsethxjekkb.supabase.co';

export interface EnrichedData {
    name?: string;
    cpf?: string;
    birthDate?: string;
    gender?: string;
    motherName?: string;
    address?: {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
    };
    phones?: string[];
    status?: string;
}

export const dataEnrichmentService = {
    // Configuração
    getToken: () => localStorage.getItem('DATA_API_TOKEN') || '',
    setToken: (token: string) => localStorage.setItem('DATA_API_TOKEN', token),

    hasToken: () => !!localStorage.getItem('DATA_API_TOKEN'),

    // Consultar dados por CPF via Edge Function (resolve CORS)
    searchByCpf: async (cpf: string): Promise<{ success: boolean; data?: EnrichedData; error?: string }> => {
        const token = dataEnrichmentService.getToken();

        if (!token) {
            return { success: false, error: 'Token da API CPF não configurado.' };
        }

        try {
            const cleanCpf = cpf.replace(/\D/g, '');

            console.log('[DataEnrichment] Consultando CPF via Edge Function:', cleanCpf);

            // Chamar Edge Function do Supabase (proxy para API CPF)
            const response = await fetch(`${SUPABASE_URL}/functions/v1/cpf-lookup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cpf: cleanCpf, api_key: token })
            });

            const result = await response.json();
            console.log('[DataEnrichment] Resposta:', result);

            // Verificar erro
            if (!response.ok || result.error) {
                const errorMsg = result.message || result.error || result.msg || `Erro: ${response.status}`;
                return { success: false, error: errorMsg };
            }

            // A API retorna { code: 200, data: { ... } }
            const data = result.data || result;

            // Normalizar retorno
            return {
                success: true,
                data: {
                    name: data.nome || data.name,
                    cpf: data.cpf || cleanCpf,
                    birthDate: data.data_nascimento || data.nascimento || data.birthDate,
                    gender: data.genero || data.gender || data.sexo,
                    motherName: data.mae || data.nome_mae,
                    status: data.situacao || 'Consulta realizada',
                    address: data.endereco ? {
                        street: data.endereco.logradouro || '',
                        number: data.endereco.numero || '',
                        neighborhood: data.endereco.bairro || '',
                        city: data.endereco.cidade || data.endereco.municipio || '',
                        state: data.endereco.uf || '',
                        zipCode: data.endereco.cep || ''
                    } : undefined,
                    phones: data.telefones || []
                }
            };

        } catch (error) {
            console.error('[DataEnrichment] Erro:', error);
            return { success: false, error: 'Falha de conexão com o serviço.' };
        }
    },

    // Consultar por CNPJ (Brasil API - gratuita, sem CORS issues)
    searchByCnpj: async (cnpj: string): Promise<{ success: boolean; data?: any; error?: string }> => {
        try {
            const cleanCnpj = cnpj.replace(/\D/g, '');
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);

            if (!response.ok) {
                return { success: false, error: 'CNPJ não encontrado.' };
            }

            const data = await response.json();

            return {
                success: true,
                data: {
                    razaoSocial: data.razao_social,
                    nomeFantasia: data.nome_fantasia,
                    cnpj: data.cnpj,
                    situacao: data.descricao_situacao_cadastral,
                    dataAbertura: data.data_inicio_atividade,
                    naturezaJuridica: data.natureza_juridica,
                    atividadePrincipal: data.cnae_fiscal_descricao,
                    endereco: {
                        logradouro: data.logradouro,
                        numero: data.numero,
                        bairro: data.bairro,
                        cidade: data.municipio,
                        uf: data.uf,
                        cep: data.cep
                    },
                    telefone: data.ddd_telefone_1,
                    email: data.email
                }
            };
        } catch (error) {
            return { success: false, error: 'Erro ao consultar CNPJ.' };
        }
    }
};
