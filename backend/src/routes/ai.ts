import { Router, Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../services/prisma';

const aiRouter = Router();

/**
 * POST /api/ai/generate-caption-from-url
 * Downloads an image from R2 URL and generates a caption using Gemini Vision API
 * This avoids CORS issues by handling the download on the backend
 */
aiRouter.post('/generate-caption-from-url', async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    console.log('[AI] Generating caption from URL:', imageUrl);

    // Get API key from database
    const config = await prisma.aiChatbotConfig.findFirst();
    const apiKey = config?.provider === 'gemini' ? config.geminiApiKey : config?.perplexityApiKey;

    if (!apiKey) {
      console.warn('[AI] No API key configured, using fallback');
      return res.json({
        caption: "Tubarão Empréstimos - Crédito Rápido e Fácil 🦈💰"
      });
    }

    // Download image from R2 (no CORS issues on backend)
    console.log('[AI] Downloading image from R2...');
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });

    // Convert to base64
    const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');
    const imageSize = Buffer.byteLength(base64Image, 'base64');
    console.log('[AI] Image downloaded and converted to base64');
    console.log('[AI] Image size:', imageSize, 'bytes');
    console.log('[AI] MIME type:', imageResponse.headers['content-type']);

    // Call Gemini Vision API
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

    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: imageResponse.headers['content-type'] || 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    console.log('[AI] Gemini response:', JSON.stringify(geminiResponse.data, null, 2));

    if (geminiResponse.data.candidates &&
        geminiResponse.data.candidates[0].content &&
        geminiResponse.data.candidates[0].content.parts) {
      const caption = geminiResponse.data.candidates[0].content.parts[0].text.trim();
      console.log('[AI] Caption generated successfully:', caption);
      return res.json({ caption });
    }

    throw new Error('Invalid response from Gemini API');

  } catch (error: any) {
    console.error('[AI] Caption generation failed:', error.message);
    console.error('[AI] Full error:', error.response?.data || error);

    // Return fallback caption
    return res.json({
      caption: "Dinheiro rápido no Pix é com a Tubarão Empréstimos! 🦈💸 Chama no direct!"
    });
  }
});

export { aiRouter };
