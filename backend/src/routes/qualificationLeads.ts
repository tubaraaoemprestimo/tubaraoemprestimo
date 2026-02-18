import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// POST /api/qualification-leads - Criar novo lead de qualificação
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      hasExperience,
      experienceLevel,
      hasCapital,
      capitalAmount,
      wantsToLearn,
      learningInterest,
      hasTime,
      timeAvailability,
      wantsPartnership,
      partnershipType
    } = req.body;

    // Validação básica
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Nome, email e telefone são obrigatórios' });
    }

    // Gerar tags automáticas baseadas nas respostas
    const tags: string[] = [];

    if (hasExperience) {
      tags.push('TAG_EXPERIENCIA');
      if (experienceLevel === 'avancado') tags.push('TAG_AVANCADO');
    } else {
      tags.push('TAG_INICIANTE');
    }

    if (hasCapital) {
      tags.push('TAG_CAPITAL');
      if (capitalAmount === 'acima_100k') tags.push('TAG_INVESTIDOR_ALTO');
      else if (capitalAmount === '50k_100k') tags.push('TAG_INVESTIDOR_MEDIO');
    }

    if (wantsToLearn) {
      tags.push('TAG_APRENDIZADO');
      if (learningInterest === 'curso') tags.push('TAG_CURSO');
      if (learningInterest === 'mentoria') tags.push('TAG_MENTORIA_ONLINE');
      if (learningInterest === 'presencial') tags.push('TAG_MENTORIA_PRESENCIAL');
    }

    if (hasTime) {
      tags.push('TAG_DISPONIBILIDADE');
      if (timeAvailability === 'integral') tags.push('TAG_TEMPO_INTEGRAL');
    }

    if (wantsPartnership) {
      tags.push('TAG_PARCERIA');
      if (partnershipType === 'investidor') tags.push('TAG_INVESTIDOR');
      if (partnershipType === 'operacional') tags.push('TAG_OPERACIONAL');
      if (partnershipType === 'correspondente') tags.push('TAG_CORRESPONDENTE');
    }

    // Criar lead
    const lead = await prisma.qualificationLead.create({
      data: {
        name,
        email,
        phone,
        hasExperience,
        experienceLevel,
        hasCapital,
        capitalAmount,
        wantsToLearn,
        learningInterest,
        hasTime,
        timeAvailability,
        wantsPartnership,
        partnershipType,
        tags,
        status: 'NEW'
      }
    });

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
