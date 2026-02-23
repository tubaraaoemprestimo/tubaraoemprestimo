// Serviço de Consulta InfoSeek API
// Validação de CPF e CNPJ com dados reais da Receita Federal

export interface InfoSeekCpfResponse {
    success: boolean;
    data?: {
        valid: boolean;
        document: string;
        name: string;
        birthDate: string;
        situation: string;
        message?: string;
    };
    meta?: {
        type: string;
        environment: string;
        latency: string;
        requestId: string;
    };
    error?: string;
}

export interface InfoSeekCnpjResponse {
    success: boolean;
    data?: {
        valid: boolean;
        document: string;
        razaoSocial: string;
        nomeFantasia: string;
        situation: string;
        dataAbertura: string;
        naturezaJuridica: string;
        porte: string;
        endereco?: {
            logradouro: string;
            numero: string;
            complemento: string;
            bairro: string;
            cidade: string;
            uf: string;
            cep: string;
        };
        message?: string;
    };
    meta?: {
        type: string;
        environment: string;
        latency: string;
        requestId: string;
    };
    error?: string;
}

export const infoseekService = {
    // URL do proxy backend (evita CORS)
    getProxyUrl: () => {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        if (host === 'tubaraoemprestimo.com.br' || host === 'www.tubaraoemprestimo.com.br') {
            return 'https://app-api.tubaraoemprestimo.com.br/api/infoseek';
        }
        return 'http://localhost:3001/api/infoseek';
    },

    // Validar CPF via proxy
    validateCpf: async (cpf: string): Promise<InfoSeekCpfResponse> => {
        try {
            const cleanCpf = cpf.replace(/\D/g, '');

            console.log('[InfoSeek] Validando CPF via proxy:', cleanCpf);

            const response = await fetch(infoseekService.getProxyUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'cpf',
                    value: cleanCpf
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[InfoSeek] Erro na validação CPF:', response.status, errorData);

                return {
                    success: false,
                    error: errorData.error || `Erro ${response.status}: ${response.statusText}`
                };
            }

            const data: InfoSeekCpfResponse = await response.json();
            console.log('[InfoSeek] Resposta CPF:', data);

            return data;

        } catch (error: any) {
            console.error('[InfoSeek] Erro ao validar CPF:', error);
            return {
                success: false,
                error: error.message || 'Erro ao conectar com a API InfoSeek'
            };
        }
    },

    // Validar CNPJ via proxy
    validateCnpj: async (cnpj: string): Promise<InfoSeekCnpjResponse> => {
        try {
            const cleanCnpj = cnpj.replace(/\D/g, '');

            console.log('[InfoSeek] Validando CNPJ via proxy:', cleanCnpj);

            const response = await fetch(infoseekService.getProxyUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'cnpj',
                    value: cleanCnpj
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[InfoSeek] Erro na validação CNPJ:', response.status, errorData);

                return {
                    success: false,
                    error: errorData.error || `Erro ${response.status}: ${response.statusText}`
                };
            }

            const data: InfoSeekCnpjResponse = await response.json();
            console.log('[InfoSeek] Resposta CNPJ:', data);

            return data;

        } catch (error: any) {
            console.error('[InfoSeek] Erro ao validar CNPJ:', error);
            return {
                success: false,
                error: error.message || 'Erro ao conectar com a API InfoSeek'
            };
        }
    },

    // Formatar CPF (123.456.789-00)
    formatCpf: (cpf: string): string => {
        const clean = cpf.replace(/\D/g, '');
        return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    },

    // Formatar CNPJ (12.345.678/0001-90)
    formatCnpj: (cnpj: string): string => {
        const clean = cnpj.replace(/\D/g, '');
        return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    },

    // Validar formato CPF (apenas formato, não valida dígitos)
    isValidCpfFormat: (cpf: string): boolean => {
        const clean = cpf.replace(/\D/g, '');
        return clean.length === 11;
    },

    // Validar formato CNPJ (apenas formato, não valida dígitos)
    isValidCnpjFormat: (cnpj: string): boolean => {
        const clean = cnpj.replace(/\D/g, '');
        return clean.length === 14;
    }
};
