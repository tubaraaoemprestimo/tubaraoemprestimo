const PROD_API_URL = 'https://app-api.tubaraoemprestimo.com.br/api';
const LOCAL_API_URL = 'http://localhost:3001/api';

const normalize = (url: string) => url.trim().replace(/\/+$/, '');

export function getApiBaseUrl(): string {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && envUrl.trim()) {
        return normalize(envUrl);
    }

    if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        if (host === 'tubaraoemprestimo.com.br' || host === 'www.tubaraoemprestimo.com.br') {
            return PROD_API_URL;
        }
    }

    return LOCAL_API_URL;
}
