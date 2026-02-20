import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// POST /api/qualification-leads - Criar novo lead de qualificação
router.post('/', async (req, res) => {
  try {
    const {
      // Filtro inicial
      mainInterest,

      // Etapa 2 - Perfil
      creditExperience,
      hasCapital,
      intention,

      // Etapa 3 - Capacidade de investimento
      investmentCapacity,

      // Etapa 4 - Interesse em soluções
      interests,

      // Etapa 5 - Compromisso
      weeklyTime,

      // Dados básicos
      name,
      whatsapp,
      email,
      city,
      state,

      // Tags (geradas no frontend)
      tags
    } = req.body;

    // Validação básica
    if (!name || !email || !whatsapp || !city || !state) {
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }

    // Criar lead
    const lead = await prisma.qualificationLead.create({
      data: {
        name,
        email,
        phone: whatsapp,
        city,
        state,
        mainInterest,
        creditExperience,
        hasCapital,
        intention,
        investmentCapacity,
        interests: interests || [],
        weeklyTime,
        tags: tags || [],
        status: 'NEW',
        notes: ''
      }
    });

    console.log(`[QualificationLeads] ✅ Novo lead criado: ${name} - Tags: ${tags?.join(', ')}`);

    res.json({ success: true, lead });
  } catch (error: any) {
    console.error('[QualificationLeads] Erro ao criar lead:', error);
    res.status(500).json({ error: 'Erro ao criar lead de qualificação' });
  }
});

// GET /api/qualification-leads - Listar leads com filtros
router.get('/', async (req, res) => {
  try {
    const { status, tags, search } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (tags) {
      const tagArray = (tags as string).split(',');
      where.tags = {
        hasSome: tagArray
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const leads = await prisma.qualificationLead.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ leads });
  } catch (error: any) {
    console.error('[QualificationLeads] Erro ao listar leads:', error);
    res.status(500).json({ error: 'Erro ao listar leads' });
  }
});

// GET /api/qualification-leads/:id - Buscar lead específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.qualificationLead.findUnique({
      where: { id }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    res.json({ lead });
  } catch (error: any) {
    console.error('[QualificationLeads] Erro ao buscar lead:', error);
    res.status(500).json({ error: 'Erro ao buscar lead' });
  }
});

// PATCH /api/qualification-leads/:id - Atualizar lead
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const lead = await prisma.qualificationLead.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes })
      }
    });

    res.json({ success: true, lead });
  } catch (error: any) {
    console.error('[QualificationLeads] Erro ao atualizar lead:', error);
    res.status(500).json({ error: 'Erro ao atualizar lead' });
  }
});

// DELETE /api/qualification-leads/:id - Deletar lead
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.qualificationLead.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[QualificationLeads] Erro ao deletar lead:', error);
    res.status(500).json({ error: 'Erro ao deletar lead' });
  }
});

export { router as qualificationLeadsRouter };
