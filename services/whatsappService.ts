
import { WhatsappConfig } from '../types';
import { apiService } from './apiService';
import { getApiBaseUrl } from './runtimeConfig';

const cleanUrl = (url: string) => {
    if (!url) return '';
    // Remove espaços e barras finais
    return url.trim().replace(/\/+$/, '');
};

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

/** Simula toast demo sem depender de contexto React */
const demoToast = (msg: string) =>
  window.dispatchEvent(new CustomEvent('demo-toast', { detail: { message: msg, type: 'success' } }));

export const whatsappService = {
    // Get connection status and config form local storage
    getConfig: async (): Promise<WhatsappConfig> => {
        if (IS_DEMO) return { apiUrl: '', apiKey: '', instanceName: 'demo', isConnected: true, phone: '5511999999999' } as any;
        return await apiService.getWhatsappConfig();
    },

    // Save new configuration to local storage
    updateConfig: async (config: WhatsappConfig): Promise<boolean> => {
        if (IS_DEMO) { demoToast('Configuração salva (Demo)'); return true; }
        return await apiService.saveWhatsappConfig(config);
    },

    // --- EVOLUTION API REAL INTEGRATION (v2.3.7 Compatible) ---

    // Ensure Webhook is Configured
    ensureWebhookConfigured: async (config: WhatsappConfig): Promise<boolean> => {
        if (IS_DEMO) return true;
        const baseUrl = cleanUrl(config.apiUrl);
        const webhookUrl = getApiBaseUrl() + '/webhook/whatsapp';

        try {
            console.log(`[WhatsApp] Configuring webhook for ${config.instanceName}...`);
            // Evolution v2 endpoint for setting webhook
            const response = await fetch(`${baseUrl}/webhook/set/${config.instanceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.apiKey,
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    webhook: {
                        url: webhookUrl,
                        webhookByEvents: false,
                        events: ["MESSAGES_UPSERT"],
                        enabled: true
                    }
                })
            });

            if (!response.ok) {
                console.error("[WhatsApp] Webhook Config Failed:", await response.text());
                return false;
            }

            console.log("[WhatsApp] Webhook configured successfully!");
            return true;
        } catch (e) {
            console.error("[WhatsApp] Webhook Config Exception:", e);
            return false;
        }
    },

    // Check Connection State
    checkConnectionState: async (): Promise<'open' | 'close' | 'connecting' | 'unknown'> => {
        if (IS_DEMO) return 'open';
        const config = await apiService.getWhatsappConfig();
        if (!config.apiUrl || !config.apiKey || !config.instanceName) return 'unknown';

        try {
            const baseUrl = cleanUrl(config.apiUrl);

            // Use fetchInstances endpoint that returns accurate connectionStatus
            const response = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${config.instanceName}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.apiKey,
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            if (response.status === 404) return 'close';
            if (!response.ok) return 'unknown';

            const data = await response.json();

            // Evolution v2 fetchInstances returns array or object with instances
            // Structure: [...] or { value: [...] } depending on version
            const instances = Array.isArray(data) ? data : (data?.value || data || []);

            if (instances.length === 0) return 'close';

            // Find our instance
            const instance = instances.find((i: any) => i.name === config.instanceName || i.instanceName === config.instanceName);

            if (!instance) return 'close';

            // Return connectionStatus (open, close, connecting)
            const status = instance.connectionStatus || instance.state || 'close';
            return status as 'open' | 'close' | 'connecting' | 'unknown';
        } catch (error) {
            console.error("[WhatsApp] Error checking state:", error);
            return 'unknown';
        }
    },

    // Internal: Create Instance
    createInstance: async (config: WhatsappConfig): Promise<boolean> => {
        if (IS_DEMO) return true;
        const baseUrl = cleanUrl(config.apiUrl);
        try {
            console.log(`[WhatsApp] Creating instance ${config.instanceName}...`);
            const response = await fetch(`${baseUrl}/instance/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.apiKey,
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    instanceName: config.instanceName,
                    qrcode: true,
                    integration: "WHATSAPP-BAILEYS"
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                // Ignore if error is "Instance already exists" (403 or 409)
                if (response.status === 403 || errText.includes('already exists')) {
                    // Even if it exists, ensure webhook is set
                    await whatsappService.ensureWebhookConfigured(config);
                    return true;
                }
                console.error("[WhatsApp] Create Instance Failed:", errText);
                return false;
            }

            // Instance created, now configure webhook
            await whatsappService.ensureWebhookConfigured(config);
            return true;
        } catch (e) {
            console.error("[WhatsApp] Create Exception:", e);
            return false;
        }
    },

    // Fetch QR Code from Evolution API
    getQrCode: async (): Promise<string | null> => {
        if (IS_DEMO) return null; // Demo: já "conectado"
        const config = await apiService.getWhatsappConfig();
        if (!config.apiUrl || !config.apiKey || !config.instanceName) {
            throw new Error("Configurações da API incompletas.");
        }

        const baseUrl = cleanUrl(config.apiUrl);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'apikey': config.apiKey,
            'ngrok-skip-browser-warning': 'true'
        };

        try {
            // 0. Ensure webhook is configured (proactive)
            whatsappService.ensureWebhookConfigured(config).catch(err => console.error("Webhook msg:", err));

            // 1. Try to connect (Get QR)
            let response = await fetch(`${baseUrl}/instance/connect/${config.instanceName}`, {
                method: 'GET',
                headers
            });

            // 2. If 404, Instance likely doesn't exist. Create it!
            if (response.status === 404) {
                console.warn("[WhatsApp] Instance not found (404). Attempting to create...");
                const created = await whatsappService.createInstance(config);
                if (!created) {
                    throw new Error("Falha ao criar instância automaticamente. Verifique os logs do servidor.");
                }
                // Retry connect after creation
                await new Promise(r => setTimeout(r, 1000)); // Wait 1s for consistency
                response = await fetch(`${baseUrl}/instance/connect/${config.instanceName}`, {
                    method: 'GET',
                    headers
                });
            }

            if (!response.ok) {
                const err = await response.text();
                console.error("[WhatsApp] API Error Response:", err);
                // Verify if it's already connected
                if (response.status === 403 || err.includes('open')) {
                    return null; // Already connected
                }
                throw new Error(`Erro API: ${response.status} - Verifique URL/Chave`);
            }

            const data = await response.json();

            // Evolution v2: { base64: "...", code: "..." } or { base64: "..." }
            if (data.base64) {
                return data.base64;
            } else if (data.code && !data.base64) {
                // Pairing code scenario (not handled in this UI yet, expecting QR)
                return null;
            }

            return null;
        } catch (error) {
            console.error("[WhatsApp] Error getting QR:", error);
            throw error;
        }
    },

    // Disconnect instance
    disconnect: async (): Promise<boolean> => {
        if (IS_DEMO) { demoToast('Desconectado (Demo)'); return true; }
        const config = await apiService.getWhatsappConfig();
        if (!config.apiUrl || !config.apiKey) return false;

        try {
            const baseUrl = cleanUrl(config.apiUrl);
            // Logout removes the session but keeps the instance config usually
            await fetch(`${baseUrl}/instance/logout/${config.instanceName}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.apiKey,
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            // Update local state
            config.isConnected = false;
            await apiService.saveWhatsappConfig(config);
            return true;
        } catch (e) {
            console.error("[WhatsApp] Error disconnecting:", e);
            return false;
        }
    },

    // Send Text Message
    sendMessage: async (phone: string, text: string): Promise<boolean> => {
        if (IS_DEMO) { demoToast(`📱 WhatsApp enviado para ${phone} (Demo)`); return true; }
        const config = await apiService.getWhatsappConfig();
        if (!config.apiUrl || !config.apiKey) return false;

        // Validate and clean formatting
        let number = phone.replace(/\D/g, '');
        while (number.startsWith('0')) number = number.substring(1);

        // Sanitização Avançada para Operadoras BR
        if (!number.startsWith('55')) {
            // Tratamento para números com código de operadora (ex: 1511999999999 - 13 dígitos)
            if (number.length === 13) {
                number = number.slice(-11); // Pega apenas DDD + 9 dígitos
            } else if (number.length === 12) {
                // Possível fixo com operadora (XX YY ZZZZ-ZZZZ)
                number = number.slice(-10); // Pega apenas DDD + 8 dígitos
            }

            // Adiciona DDI Brasil se estiver no formato correto (10 ou 11 dígitos)
            if (number.length >= 10 && number.length <= 11) {
                number = '55' + number;
            }
        }

        console.log(`[WhatsApp Service] Sending to ${number} via Evolution API...`);

        try {
            const baseUrl = cleanUrl(config.apiUrl);
            const response = await fetch(`${baseUrl}/message/sendText/${config.instanceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.apiKey,
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    number: number,
                    text: text,
                    options: {
                        delay: 1200,
                        presence: "composing"
                    }
                })
            });

            if (response.ok) {
                return true;
            } else {
                const errorText = await response.text();
                // Treat 401/403 as disconnected info potentially?
                console.error(`[WhatsApp Service] Failed to send to ${number}. Status: ${response.status}. API Error: ${errorText}`);
                return false;
            }
        } catch (error) {
            console.error("[WhatsApp Service] Network/Logic Error:", error);
            return false;
        }
    },

    // Buscar Contatos da API
    fetchContacts: async (): Promise<any[]> => {
        if (IS_DEMO) return [];
        const config = await apiService.getWhatsappConfig();
        if (!config.apiUrl || !config.apiKey) return [];

        const baseUrl = cleanUrl(config.apiUrl);
        const headers = {
            'Content-Type': 'application/json',
            'apikey': config.apiKey,
            'ngrok-skip-browser-warning': 'true'
        };

        const tryEndpoint = async (path: string) => {
            try {
                const res = await fetch(`${baseUrl}${path}/${config.instanceName}`, {
                    method: 'GET', // Tentar GET primeiro
                    headers
                });

                // Se 404, tenta POST pois algumas versões usam POST para busca
                if (res.status === 404 || res.status === 405) {
                    const resPost = await fetch(`${baseUrl}${path}/${config.instanceName}`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({}) // Body vazio para pegar tudo
                    });
                    if (resPost.ok) return resPost;
                    return res; // Retorna o erro original de GET ou o 404 do POST
                }

                return res;
            } catch (e) {
                return null;
            }
        };

        try {
            // Tentativa 1: Endpoint de Contatos padrão (v1/v2 legacy)
            let response = await tryEndpoint('/contact/find');

            // Tentativa 2: Endpoint de Chat (algumas v2)
            if (!response || !response.ok) {
                response = await tryEndpoint('/chat/findContacts');
            }

            if (!response || !response.ok) {
                const errText = response ? await response.text() : 'Network error';
                console.error('[WhatsApp] Failed to fetch contacts (all endpoints):', errText);
                return [];
            }

            const data = await response.json();
            // Normalizar resposta (pode ser array direto ou objeto com contacts)
            const list = Array.isArray(data) ? data : (data.contacts || data || []);

            // Log para debug
            console.log(`[WhatsApp] Fetched ${list.length} contacts`);
            return list;

        } catch (e) {
            console.error('[WhatsApp] Except fetching contacts:', e);
            return [];
        }
    },

    // Sincronizar contatos com API
    syncContacts: async (): Promise<{ added: number, updated: number, errors: number }> => {
        const contacts = await whatsappService.fetchContacts();
        if (contacts.length === 0) return { added: 0, updated: 0, errors: 0 };

        let added = 0;
        let updated = 0;
        let errors = 0;

        for (const contact of contacts) {
            try {
                // Ignorar broadcast e grupos (se id existir)
                if (contact.id && (typeof contact.id === 'string') && (contact.id.includes('broadcast') || contact.id.includes('g.us'))) continue;

                // Extrair ID e Nome
                let rawPhone = contact.phone || (contact.id && contact.id.split ? contact.id.split('@')[0] : '');
                // Sanitizar para apenas números
                let clean = String(rawPhone).replace(/\D/g, '');

                // Remove zeros a esquerda
                while (clean.startsWith('0')) clean = clean.substring(1);

                // Normalização BR (Supor DDI 55 se vier sem)
                if (clean.length >= 10 && clean.length <= 11) {
                    clean = '55' + clean;
                }

                // Correção: Remover 0 após DDD (ex: 55 32 0...)
                if (clean.startsWith('55') && clean.length >= 5 && clean[4] === '0') {
                    clean = clean.substring(0, 4) + clean.substring(5);
                }

                // Tratamento do 9º dígito
                if (clean.startsWith('55') && clean.length === 12) {
                    const thirdDigit = clean[4];
                    if (['7', '8', '9'].includes(thirdDigit)) {
                        clean = clean.substring(0, 4) + '9' + clean.substring(4);
                    }
                }

                // Validar tamanho mínimo
                if (clean.length < 12) continue;

                const phone = clean;

                // Prioridade de nome
                const displayName = contact.pushName || contact.name || contact.verifiedName || `Desconhecido ${phone.slice(-4)}`;

                const result = await apiService.importLead(displayName, phone, contact.profilePictureUrl);

                if (result === 'added') added++;
                else if (result === 'updated') updated++;
                else errors++;

            } catch (e) {
                errors++;
            }
        }

        return { added, updated, errors };
    }
};

