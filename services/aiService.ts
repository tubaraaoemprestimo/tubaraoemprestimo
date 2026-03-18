// Serviço de IA para análise de mensagens e documentos
// Usa configurações dinâmicas do banco de dados via aiChatbotService
import { aiChatbotService } from './aiChatbotService';

export interface AIResponse {
  intent: 'PAYMENT_PROMISE' | 'REQUEST_BOLETO' | 'SUPPORT' | 'UNKNOWN';
  date?: string;
  replyMessage: string;
}

export interface DocumentAnalysis {
  name: string;
  cpf: string;
  valid: boolean;
}

// Cache da configuração para evitar múltiplas chamadas
let cachedConfig: { apiKey: string; provider: string } | null = null;
let cacheTime = 0;
const CACHE_DURATION = 60000; // 1 minuto

async function getApiKey(): Promise<string | null> {
  const now = Date.now();

  // Usar cache se ainda válido
  if (cachedConfig && (now - cacheTime) < CACHE_DURATION) {
    return cachedConfig.apiKey;
  }

  try {
    const config = await aiChatbotService.getConfig();
    const apiKey = config.provider === 'gemini' ? config.geminiApiKey : config.perplexityApiKey;

    if (apiKey) {
      cachedConfig = { apiKey, provider: config.provider };
      cacheTime = now;
    }

    return apiKey;
  } catch (err) {
    console.error('[aiService] Error getting API key:', err);
    return null;
  }
}

export const aiService = {
  /**
   * Analyzes a user message using Google Gemini (REST API) to determine intent.
   * Simulates the logic for POST /api/webhooks/whatsapp
   */
  analyzeMessage: async (text: string): Promise<AIResponse> => {
    try {
      const apiKey = await getApiKey();

      if (!apiKey) {
        console.warn('[aiService] No API key configured, using fallback');
        return mockGeminiAnalysis(text);
      }

      console.log("[aiService] Consulting Gemini AI...");

      const prompt = `
        You are a collection assistant for 'Tubarão Empréstimos'. 
        Analyze the user's message: "${text}".
        
        Determine the intent from these options:
        - PAYMENT_PROMISE: If they mention a date to pay (e.g., 'I pay on the 15th', 'amanhã').
        - REQUEST_BOLETO: If they ask for a bill, invoice, code, or pix.
        - SUPPORT: For anything else.

        Return ONLY a JSON object with this structure (no markdown):
        {
          "intent": "STRING",
          "date": "STRING (ISO format or null)",
          "replyMessage": "STRING (A polite, short response in Portuguese)"
        }
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      if (!response.ok) throw new Error('API Error');

      const data = await response.json();

      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
        const rawText = data.candidates[0].content.parts[0].text;
        // Clean markdown code blocks if present
        const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
      }

      throw new Error("Invalid response structure from Gemini");

    } catch (error) {
      console.error("[aiService] AI Analysis failed, falling back to local logic:", error);
      return mockGeminiAnalysis(text);
    }
  },

  /**
   * Analyzes an ID Document (CNH/RG) image to extract CPF and Name.
   */
  analyzeDocument: async (imageBase64: string): Promise<DocumentAnalysis> => {
    try {
      const apiKey = await getApiKey();

      if (!apiKey) {
        console.warn('[aiService] No API key for document analysis');
        return { name: '', cpf: '', valid: false };
      }

      console.log("[aiService] Analyzing Document with Gemini Vision...");

      // Remove header from base64 if present
      const base64Data = imageBase64.split(',')[1] || imageBase64;

      const prompt = `
        Analyze this image of an identification document (CNH or RG from Brazil).
        Extract the full Name (Nome) and CPF number.
        
        Return ONLY a JSON object with this structure (no markdown):
        {
          "name": "STRING (Full extracted name, uppercase)",
          "cpf": "STRING (Only numbers)"
        }
        If the image is not a document or text is unreadable, return empty strings.
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }]
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();

      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
        const rawText = data.candidates[0].content.parts[0].text;
        const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(jsonString);
        return {
          name: result.name || '',
          cpf: result.cpf || '',
          valid: !!result.name && !!result.cpf
        };
      }

      throw new Error("Invalid response from Gemini Vision");

    } catch (error) {
      console.error("[aiService] OCR Failed:", error);
      // Fallback for demo if API fails
      return { name: '', cpf: '', valid: false };
    }
  },

  /**
   * Generates a creative caption for a WhatsApp Status image using Gemini Vision.
   */
  generateImageCaption: async (imageBase64: string): Promise<string> => {
    try {
      const apiKey = await getApiKey();

      if (!apiKey) {
        console.warn('[aiService] No API key for caption generation');
        return "Tubarão Empréstimos - Crédito Rápido e Fácil 🦈💰";
      }

      console.log("[aiService] Generating caption with Gemini Vision...");

      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

      const prompt = `
        Atue como um Criador de Conteúdo para Redes Sociais.

        Sua tarefa: Analisar a imagem anexada e criar uma legenda PERFEITA para postar no Status do WhatsApp/Stories.

        1. Identifique o que acontece na imagem (Cenário, Texto, Pessoas, Emoção).
        2. Crie uma frase curta, impactante e criativa sobre ESSE CONTEÚDO.

        Regras:
        - SEJA NATURAL. Não pareça um robô.
        - Use Emojis que combinem com a foto.
        - Se a imagem tiver texto, complemente a mensagem do texto.
        - Se for meme/engraçado, entre na brincadeira.
        - Se for sério/informativo, seja direto e profissional.
        - MÁXIMO 2 linhas.

        Retorne APENAS o texto da legenda.
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: base64Data } }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[aiService] Gemini API Error ${response.status}:`, errText);
        throw new Error(`API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();

      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
        const rawText = data.candidates[0].content.parts[0].text;
        return rawText.trim();
      }

      throw new Error("Invalid response from Gemini");

    } catch (error) {
      console.error("[aiService] Caption Generation Failed:", error);
      // Fallback message
      return "Dinheiro rápido no Pix é com a Tubarão Empréstimos! 🦈💸 Chama no direct!";
    }
  },

  /**
   * Generates a caption from an image URL (downloads via backend to avoid CORS)
   */
  generateImageCaptionFromUrl: async (imageUrl: string): Promise<string> => {
    try {
      console.log("[aiService] Generating caption from URL via backend...");

      const apiUrl = import.meta.env.VITE_API_URL || 'https://app-api.tubaraoemprestimo.com.br/api';
      const response = await fetch(`${apiUrl}/ai/generate-caption-from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      return data.caption || "Tubarão Empréstimos - Crédito Rápido e Fácil 🦈💰";

    } catch (error) {
      console.error("[aiService] Caption from URL failed:", error);
      return "Dinheiro rápido no Pix é com a Tubarão Empréstimos! 🦈💸 Chama no direct!";
    }
  },

  /**
   * Mocks the Asaas API to generate a Pix code
   */
  generatePixCode: async (amount: number): Promise<string> => {
    // Simulate API delay
    await new Promise(r => setTimeout(r, 1000));
    return `00020126330014BR.GOV.BCB.PIX0114+5511999999999520400005303986540${amount.toFixed(2).replace('.', '')}5802BR5913Tubarao Loans6008Sao Paulo62070503***6304`;
  },

  /**
   * Clear the cached API key (useful after config changes)
   */
  clearCache: () => {
    cachedConfig = null;
    cacheTime = 0;
  }
};

// Fallback Helper in case API quota is reached or network fails
function mockGeminiAnalysis(text: string): AIResponse {
  const lower = text.toLowerCase();

  if (lower.includes('boleto') || lower.includes('pix') || lower.includes('pagar') || lower.includes('fatura')) {
    return {
      intent: 'REQUEST_BOLETO',
      replyMessage: "Entendido! Estou gerando seu código Pix para pagamento agora mesmo."
    };
  }

  if (lower.match(/\d{1,2}/) || lower.includes('amanhã') || lower.includes('semana')) {
    return {
      intent: 'PAYMENT_PROMISE',
      date: new Date().toISOString(),
      replyMessage: "Certo, registrei sua promessa de pagamento. Obrigado!"
    };
  }

  return {
    intent: 'SUPPORT',
    replyMessage: "Entendo. Vou transferir seu caso para um de nossos especialistas humanos."
  };
}
