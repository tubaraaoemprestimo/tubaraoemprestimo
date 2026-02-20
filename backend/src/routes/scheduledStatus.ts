import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Função para gerar legenda com IA usando a imagem
async function generateCaptionFromImage(imageUrl: string): Promise<string> {
  try {
    // Aqui você pode integrar com APIs de IA como:
    // - Google Gemini Vision
    // - OpenAI GPT-4 Vision
    // - Anthropic Claude Vision

    // Por enquanto, vamos usar uma implementação simples com Gemini
    const { GoogleGenerativeAI } = require('@google/generative-ai');

    // Buscar a chave da API do banco
    const config = await prisma.aiChatbotConfig.findFirst();
    if (!config?.geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analise esta imagem e gere uma legenda atraente e profissional para um post de status do WhatsApp sobre empréstimos e investimentos.
    A legenda deve:
    - Ser curta e impactante (máximo 2-3 linhas)
    - Incluir emojis relevantes
    - Ter um call-to-action
    - Ser em português do Brasil

    Retorne apenas a legenda, sem explicações adicionais.`;

    const arrayBuffer = await fetch(imageUrl).then(r => r.arrayBuffer());
    const imagePart = {
      inlineData: {
        data: Buffer.from(new Uint8Array(arrayBuffer)).toString('base64'),
        mimeType: 'image/jpeg',
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Error generating caption:', error);
    throw new Error('Failed to generate caption');
  }
}

// Calcular próxima data de postagem
function calculateNextPostDate(
  startDate: Date,
  recurrence: string,
  selectedDays: string[],
  postTimes: string[],
  currentPostIndex: number
): Date | null {
  const now = new Date();
  const start = new Date(startDate);

  if (recurrence === 'ONCE') {
    return start > now ? start : null;
  }

  const dayMap: { [key: string]: number } = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  let nextDate = new Date(now);
  nextDate.setSeconds(0, 0);

  // Para recorrência diária
  if (recurrence === 'DAILY') {
    const timeIndex = currentPostIndex % postTimes.length;
    const [hours, minutes] = postTimes[timeIndex].split(':').map(Number);

    nextDate.setHours(hours, minutes);

    if (nextDate <= now) {
      nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate;
  }

  // Para recorrência semanal ou customizada
  if (recurrence === 'WEEKLY' || recurrence === 'CUSTOM') {
    const daysToCheck = recurrence === 'WEEKLY'
      ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      : selectedDays;

    const timeIndex = currentPostIndex % postTimes.length;
    const [hours, minutes] = postTimes[timeIndex].split(':').map(Number);

    // Procurar o próximo dia válido
    for (let i = 0; i < 14; i++) { // Verificar até 2 semanas à frente
      const checkDate = new Date(nextDate);
      checkDate.setDate(checkDate.getDate() + i);
      checkDate.setHours(hours, minutes);

      const dayName = Object.keys(dayMap).find(key => dayMap[key] === checkDate.getDay());

      if (dayName && daysToCheck.includes(dayName) && checkDate > now) {
        return checkDate;
      }
    }
  }

  return null;
}

// GET - Listar todos os status agendados
router.get('/', authenticate, async (req, res) => {
  try {
    const items = await prisma.scheduledStatus.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(items);
  } catch (error) {
    console.error('Error fetching scheduled status:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled status' });
  }
});

// POST - Criar novo agendamento
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      title,
      content,
      mediaType,
      mediaUrl,
      caption,
      recurrence,
      selectedDays,
      postsPerDay,
      totalDays,
      startDate,
      postTimes,
    } = req.body;

    const user = (req as any).user;

    // Calcular a primeira data de postagem
    const nextPostAt = calculateNextPostDate(
      new Date(startDate),
      recurrence,
      selectedDays || [],
      postTimes || ['09:00'],
      0
    );

    // Calcular data de término
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (totalDays || 1));

    const item = await prisma.scheduledStatus.create({
      data: {
        title,
        content,
        mediaType,
        mediaUrl: mediaUrl || null,
        caption: caption || null,
        aiGeneratedCaption: false,
        recurrence: recurrence || 'ONCE',
        selectedDays: selectedDays || [],
        postsPerDay: postsPerDay || 1,
        totalDays: totalDays || 1,
        startDate: new Date(startDate),
        endDate,
        postTimes: postTimes || ['09:00'],
        status: 'SCHEDULED',
        nextPostAt,
        postsCount: 0,
        createdBy: user.id,
      },
    });

    res.json(item);
  } catch (error) {
    console.error('Error creating scheduled status:', error);
    res.status(500).json({ error: 'Failed to create scheduled status' });
  }
});

// POST - Gerar legenda com IA
router.post('/generate-caption', authenticate, async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const caption = await generateCaptionFromImage(imageUrl);
    res.json({ caption });
  } catch (error) {
    console.error('Error generating caption:', error);
    res.status(500).json({ error: 'Failed to generate caption' });
  }
});

// DELETE - Excluir agendamento
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const idString = Array.isArray(id) ? id[0] : id;

    await prisma.scheduledStatus.delete({
      where: { id: idString },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled status:', error);
    res.status(500).json({ error: 'Failed to delete scheduled status' });
  }
});

// PUT - Atualizar status (para marcar como postado, falhou, etc)
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const idString = Array.isArray(id) ? id[0] : id;
    const { status, postsCount } = req.body;

    const item = await prisma.scheduledStatus.findUnique({
      where: { id: idString },
    });

    if (!item) {
      return res.status(404).json({ error: 'Scheduled status not found' });
    }

    // Calcular próxima data de postagem se ainda houver posts pendentes
    let nextPostAt = null;
    const totalPosts = item.postsPerDay * item.totalDays;

    if (postsCount < totalPosts && status === 'SCHEDULED') {
      nextPostAt = calculateNextPostDate(
        item.startDate,
        item.recurrence,
        item.selectedDays,
        item.postTimes,
        postsCount
      );
    }

    const updated = await prisma.scheduledStatus.update({
      where: { id: idString },
      data: {
        status,
        postsCount: postsCount || item.postsCount,
        lastPostedAt: status === 'POSTED' ? new Date() : item.lastPostedAt,
        nextPostAt,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating scheduled status:', error);
    res.status(500).json({ error: 'Failed to update scheduled status' });
  }
});

// GET - Buscar status prontos para postar (para o cron job)
router.get('/ready-to-post', async (req, res) => {
  try {
    const now = new Date();

    const items = await prisma.scheduledStatus.findMany({
      where: {
        status: 'SCHEDULED',
        nextPostAt: {
          lte: now,
        },
      },
    });

    res.json(items);
  } catch (error) {
    console.error('Error fetching ready to post:', error);
    res.status(500).json({ error: 'Failed to fetch ready to post' });
  }
});

export default router;
