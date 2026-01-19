
import { WhatsappConfig } from '../types';
import { supabaseService } from './supabaseService';

const cleanUrl = (url: string) => {
    if (!url) return '';
    // Remove espaços e barras finais
    return url.trim().replace(/\/+$/, '');
};

export const whatsappService = {
    // Get connection status and config form local storage
    getConfig: async (): Promise<WhatsappConfig> => {
        return await supabaseService.getWhatsappConfig();
    },

    // Save new configuration to local storage
    updateConfig: async (config: WhatsappConfig): Promise<boolean> => {
        return await supabaseService.saveWhatsappConfig(config);
    },

    // --- EVOLUTION API REAL INTEGRATION (v2.3.7 Compatible) ---

    // Ensure Webhook is Configured
    ensureWebhookConfigured: async (config: WhatsappConfig): Promise<boolean> => {
        const baseUrl = cleanUrl(config.apiUrl);
        const webhookUrl = "https://cwhiujeragsethxjekkb.supabase.co/functions/v1/whatsapp-webhook";

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
                    url: webhookUrl,
                    webhookByEvents: false,
                    events: ["MESSAGES_UPSERT"],
                    enabled: true
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
        const config = await supabaseService.getWhatsappConfig();
        if (!config.apiUrl || !config.apiKey || !config.instanceName) return 'unknown';

        try {
            const baseUrl = cleanUrl(config.apiUrl);
            const response = await fetch(`${baseUrl}/instance/connectionState/${config.instanceName}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.apiKey,
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            if (response.status === 404) return 'close'; // Instance doesn't exist yet
            if (!response.ok) return 'unknown';

            const data = await response.json();
            // Evolution v2 structure: { instance: { state: 'open', ... } }
            return data?.instance?.state || 'close';
        } catch (error) {
            console.error("[WhatsApp] Error checking state:", error);
            return 'unknown';
        }
    },

    // Internal: Create Instance
    createInstance: async (config: WhatsappConfig): Promise<boolean> => {
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
        const config = await supabaseService.getWhatsappConfig();
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
        const config = await supabaseService.getWhatsappConfig();
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
            await supabaseService.saveWhatsappConfig(config);
            return true;
        } catch (e) {
            console.error("[WhatsApp] Error disconnecting:", e);
            return false;
        }
    },

    // Send Text Message
    sendMessage: async (phone: string, text: string): Promise<boolean> => {
        const config = await supabaseService.getWhatsappConfig();
        if (!config.apiUrl || !config.apiKey) return false;

        // Validate formatting
        let number = phone.replace(/\D/g, '');
        if (!number.startsWith('55') && number.length >= 10) {
            number = '55' + number;
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
                console.error("[WhatsApp Service] API Error:", errorText);
                return false;
            }
        } catch (error) {
            console.error("[WhatsApp Service] Network/Logic Error:", error);
            return false;
        }
    }
};
