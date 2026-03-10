import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getApiBaseUrl } from './runtimeConfig';

// URL da API (dev ou prod)
const API_URL = getApiBaseUrl();

class ApiClient {
    private client: AxiosInstance;
    private token: string | null = null;
    private refreshToken: string | null = null;

    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Carrega tokens do storage
        const storedAuth = localStorage.getItem('tubarao_auth');
        if (storedAuth) {
            const { accessToken, refreshToken } = JSON.parse(storedAuth);
            this.token = accessToken;
            this.refreshToken = refreshToken;
            this.client.defaults.headers.Authorization = `Bearer ${accessToken}`;
        }

        // Interceptor para refresh token
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // Se erro 401 e não tentou refresh ainda
                if (error.response?.status === 401 && !originalRequest._retry && this.refreshToken) {
                    originalRequest._retry = true;
                    try {
                        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
                            refreshToken: this.refreshToken
                        });

                        this.setSession(data.accessToken, data.refreshToken);
                        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                        return this.client(originalRequest);
                    } catch (refreshError) {
                        // Refresh falhou -> Logout
                        this.clearSession();
                        window.location.href = '/login';
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    // Gerenciamento de Sessão
    setSession(accessToken: string, refreshToken: string) {
        this.token = accessToken;
        this.refreshToken = refreshToken;
        this.client.defaults.headers.Authorization = `Bearer ${accessToken}`;
        localStorage.setItem('tubarao_auth', JSON.stringify({ accessToken, refreshToken }));
    }

    clearSession() {
        this.token = null;
        this.refreshToken = null;
        delete this.client.defaults.headers.Authorization;
        localStorage.removeItem('tubarao_auth');
    }

    // Métodos Genéricos (Simulando Supabase)
    async get<T>(url: string, config?: AxiosRequestConfig): Promise<{ data: T | null; error: any }> {
        try {
            const response = await this.client.get<T>(url, config);
            return { data: response.data, error: null };
        } catch (error: any) {
            return { data: null, error: error.response?.data || error.message };
        }
    }

    async post<T>(url: string, body: any, config?: AxiosRequestConfig): Promise<{ data: T | null; error: any }> {
        try {
            const response = await this.client.post<T>(url, body, config);
            return { data: response.data, error: null };
        } catch (error: any) {
            return { data: null, error: error.response?.data || error.message };
        }
    }

    async put<T>(url: string, body: any, config?: AxiosRequestConfig): Promise<{ data: T | null; error: any }> {
        try {
            const response = await this.client.put<T>(url, body, config);
            return { data: response.data, error: null };
        } catch (error: any) {
            return { data: null, error: error.response?.data || error.message };
        }
    }

    async patch<T>(url: string, body: any, config?: AxiosRequestConfig): Promise<{ data: T | null; error: any }> {
        try {
            const response = await this.client.patch<T>(url, body, config);
            return { data: response.data, error: null };
        } catch (error: any) {
            return { data: null, error: error.response?.data || error.message };
        }
    }

    async delete<T>(url: string, config?: AxiosRequestConfig): Promise<{ data: T | null; error: any }> {
        try {
            const response = await this.client.delete<T>(url, config);
            return { data: response.data, error: null };
        } catch (error: any) {
            return { data: null, error: error.response?.data || error.message };
        }
    }

    // Upload helper (multipart/form-data)
    async upload(file: File | Blob, filename?: string): Promise<{ data: any; error: any }> {
        try {
            const formData = new FormData();
            formData.append('file', file, filename || 'upload');
            const response = await this.client.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 300000, // 5 minutos para vídeos grandes
                maxContentLength: 104857600, // 100MB
                maxBodyLength: 104857600, // 100MB
            });
            return { data: response.data, error: null };
        } catch (error: any) {
            return { data: null, error: error.response?.data || error.message };
        }
    }

    async uploadBase64(base64: string, filename?: string): Promise<{ data: any; error: any }> {
        return this.post('/upload/base64', { base64, filename });
    }

    // Auth Helpers
    get auth() {
        return {
            signIn: async (creds: any) => {
                const { data, error } = await this.post('/auth/login', creds);
                if (data) this.setSession(data.accessToken, data.refreshToken);
                return { data, error };
            },
            signUp: async (creds: any) => this.post('/auth/register', creds),
            signOut: async () => {
                this.clearSession();
                return { error: null };
            },
            resetPassword: async (email: string) => this.post('/auth/forgot-password', { email }),
            updateUser: async (data: any) => this.put('/auth/me', data), // Update profile
            getSession: () => ({ access_token: this.token, refresh_token: this.refreshToken }),
            getUser: async () => this.get('/auth/me')
        };
    }
}

export const api = new ApiClient();
