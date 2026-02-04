
// Serviço de Enriquecimento de Dados
// Configurado para API CPF (https://apicpf.com/)
// Plano Grátis: 100 consultas/dia

const API_CPF_URL = 'https://apicpf.com/api/consulta';

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

    // Consultar dados por CPF via API CPF (apicpf.com)
    searchByCpf: async (cpf: string): Promise<{ success: boolean; data?: EnrichedData; error?: string }> => {
        const token = dataEnrichmentService.getToken();

        if (!token) {
            return { success: false, error: 'Token da API CPF não configurado.' };
        }

        try {
            const cleanCpf = cpf.replace(/\D/g, '');

            // API CPF (apicpf.com) - Endpoint com header de autenticação
            const response = await fetch(`${API_CPF_URL}?cpf=${cleanCpf}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-API-KEY': token
                }
            });
            console.log('[DataEnrichment] Consultando CPF:', cleanCpf);
            console.log('[DataEnrichment] Token (primeiros 10 chars):', token.substring(0, 10) + '...');

            if (!response.ok) {
                // Tentar ler mensagem de erro da API
                let errorMsg = '';
                try {
                    const errorData = await response.json();
                    console.log('[DataEnrichment] Erro da API:', errorData);
                    errorMsg = errorData.message || errorData.error || errorData.msg || '';
                } catch (e) {
                    console.log('[DataEnrichment] Status HTTP:', response.status);
                }

                if (response.status === 401 || response.status === 403) {
                    return { success: false, error: errorMsg || 'Token inválido ou sem permissão.' };
                }
                if (response.status === 404) {
                    return { success: false, error: errorMsg || 'CPF não encontrado na base de dados.' };
                }
                if (response.status === 429) {
                    return { success: false, error: 'Limite de consultas atingido. Aguarde.' };
                }
                return { success: false, error: errorMsg || `Erro na API: ${response.status}` };
            }

            const data = await response.json();

            // Verificar se houve erro no retorno da API
            if (data.error || data.status === 'error') {
                return { success: false, error: data.message || data.error || 'Erro desconhecido na API.' };
            }

            // Normalizar retorno da API CPF
            // Campos esperados: nome, genero, nascimento (ou data_nascimento)
            return {
                success: true,
                data: {
                    name: data.nome || data.name,
                    cpf: data.cpf || cleanCpf,
                    birthDate: data.nascimento || data.data_nascimento || data.birthDate,
                    gender: data.genero || data.gender || data.sexo,
                    motherName: data.mae || data.nome_mae || data.motherName,
                    status: data.situacao || data.situacao_cadastral || data.status || 'Consulta realizada',
                    // Endereço (se retornado)
                    address: data.endereco ? {
                        street: data.endereco.logradouro || data.endereco.rua || '',
                        number: data.endereco.numero || '',
                        neighborhood: data.endereco.bairro || '',
                        city: data.endereco.cidade || data.endereco.municipio || '',
                        state: data.endereco.uf || data.endereco.estado || '',
                        zipCode: data.endereco.cep || ''
                    } : undefined,
                    // Telefones (se retornados)
                    phones: data.telefones || data.phones || []
                }
            };

        } catch (error) {
            console.error('Enrichment error:', error);
            return { success: false, error: 'Falha de conexão com o serviço de dados.' };
        }
    },

    // Consultar por CNPJ (placeholder - API CPF pode não suportar isso)
    searchByCnpj: async (cnpj: string): Promise<{ success: boolean; data?: any; error?: string }> => {
        // A maioria das APIs CPF não têm CNPJ
        // Usar API pública BrasilAPI como fallback para CNPJ
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
