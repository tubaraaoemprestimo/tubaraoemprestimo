
// Serviço de Enriquecimento de Dados
// Padrão: API Brasil (https://apibrasil.com.br/)
// Alternativas suportadas (basta descomentar): Hub do Desenvolvedor, API CPF

const API_BRASIL_URL = 'https://gateway.apibrasil.com.br/api/v2';

export interface EnrichedData {
    name?: string;
    cpf?: string;
    birthDate?: string;
    motherName?: string;
    address?: {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
    };
    phones?: string[]; // Lista de telefones encontrados
    status?: string; // Situacao Cadastral
}

export const dataEnrichmentService = {
    // Configuração
    getToken: () => localStorage.getItem('DATA_API_TOKEN') || '',
    setToken: (token: string) => localStorage.setItem('DATA_API_TOKEN', token),

    hasToken: () => !!localStorage.getItem('DATA_API_TOKEN'),

    // Consultar dados por CPF
    searchByCpf: async (cpf: string): Promise<{ success: boolean; data?: EnrichedData; error?: string }> => {
        const token = dataEnrichmentService.getToken();

        if (!token) {
            return { success: false, error: 'Token da API de Dados não configurado. Adicione em Configurações.' };
        }

        try {
            const cleanCpf = cpf.replace(/\D/g, '');

            // ================================= DEFAULT =================================
            // 1. API BRASIL (Padrão) - https://apibrasil.com.br/
            // Endpoint: POST /dados/cpf

            const response = await fetch(`${API_BRASIL_URL}/dados/cpf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cpf: cleanCpf })
            });

            // ================================= ALTERNATIVAS =================================
            /* 
            // 2. HUB DO DESENVOLVEDOR - https://hubdodesenvolvedor.com.br/ (Teste Grátis)
            // Endpoint: GET /v2/cpf/
            const response = await fetch(`https://ws.hubdodesenvolvedor.com.br/v2/cpf/?cpf=${cleanCpf}&token=${token}`);
            */

            /* 
           // 3. API CPF - https://apicpf.com/ (100 Grátis/Dia)
           // Endpoint: GET /v1/cpf/
           const response = await fetch(`https://apicpf.com/api/v1/cpf/${cleanCpf}`, {
                headers: { 'Authorization': `Bearer ${token}` }
           });
           */
            // =================================================================================

            if (!response.ok) {
                if (response.status === 401) return { success: false, error: 'Token inválido ou expirado.' };
                if (response.status === 404) return { success: false, error: 'CPF não encontrado na base.' };
                if (response.status === 402) return { success: false, error: 'Saldo insuficiente na API.' };
                return { success: false, error: `Erro na API: ${response.status}` };
            }

            const data = await response.json();

            // Normalizar retorno (Adaptar aqui se mudar de API)
            // Mapeamento baseado na API Brasil:
            return {
                success: true,
                data: {
                    name: data.nome,
                    cpf: data.cpf,
                    birthDate: data.nascimento,
                    motherName: data.mae,
                    status: data.situacao_cadastral,
                    address: data.endereco ? {
                        street: data.endereco.logradouro,
                        number: data.endereco.numero || '',
                        neighborhood: data.endereco.bairro,
                        city: data.endereco.municipio,
                        state: data.endereco.uf,
                        zipCode: data.endereco.cep
                    } : undefined,
                    phones: data.telefones ? data.telefones.map((t: any) => `${t.ddd}${t.numero}`) : []
                }
            };

        } catch (error) {
            console.error('Enrichment error:', error);

            // Fallback MOCK
            if (process.env.NODE_ENV === 'development' && cpf.startsWith('000')) {
                return {
                    success: true,
                    data: {
                        name: 'João da Silva (MOCK)',
                        cpf: cpf,
                        birthDate: '01/01/1980',
                        motherName: 'Maria da Silva',
                        status: 'REGULAR',
                        phones: ['11999998888'],
                        address: {
                            street: 'Av. Paulista',
                            number: '1000',
                            neighborhood: 'Bela Vista',
                            city: 'São Paulo',
                            state: 'SP',
                            zipCode: '01310-100'
                        }
                    }
                };
            }

            return { success: false, error: 'Falha de conexão com serviço de dados.' };
        }
    },

    hasToken: () => !!localStorage.getItem('DATA_API_TOKEN')
};
