
// Serviço de Enriquecimento de Dados
// Integração sugerida com API Brasil (https://apibrasil.com.br/) ou similar
// Requer Token de Acesso

const API_BRASIL_URL = 'https://gateway.apibrasil.com.br/api/v2';
const API_CONSULTAS_URL = 'https://api.infosimples.com/api/v2'; // Exemplo Infosimples

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

            // Exemplo de implementação para API Brasil (Dados CPF)
            // Ajuste conforme a documentação da API contratada
            const response = await fetch(`${API_BRASIL_URL}/dados/cpf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cpf: cleanCpf })
            });

            if (!response.ok) {
                if (response.status === 401) return { success: false, error: 'Token inválido ou expirado.' };
                if (response.status === 404) return { success: false, error: 'CPF não encontrado na base.' };
                if (response.status === 402) return { success: false, error: 'Saldo insuficiente na API.' };
                return { success: false, error: `Erro na API: ${response.status}` };
            }

            const data = await response.json();

            // Normalizar retorno
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
                    // Alguns endpoints retornam telefones vinculados
                    phones: data.telefones ? data.telefones.map((t: any) => `${t.ddd}${t.numero}`) : []
                }
            };

        } catch (error) {
            console.error('Enrichment error:', error);
            // Fallback MOCK para teste se a API falhar (apenas exemplo)
            // Remover em produção
            if (process.env.NODE_ENV === 'development' && cpf === '00000000000') {
                return {
                    success: true,
                    data: {
                        name: 'João da Silva (MOCK)',
                        cpf: cpf,
                        birthDate: '01/01/1980',
                        motherName: 'Maria da Silva',
                        status: 'REGULAR',
                        phones: ['11999998888', '11988887777'],
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
    }
};
