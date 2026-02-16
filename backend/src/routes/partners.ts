import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { emailService } from '../services/email';
import { generateUniqueCode } from '../utils/generateUniqueCode';

export const partnersRouter = Router();

// Middleware de autenticação para todas as rotas
partnersRouter.use(authenticate);

// GET /api/partners - Listar todos os parceiros
partnersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const partners = await prisma.user.findMany({
      where: {
        isPartner: true,
        role: 'CLIENT' // Parceiros são clientes com status especial
      },
      include: {
        _count: {
          select: {
            loanRequests: {
              where: {
                isPartnerReferral: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: partners.map(partner => ({
        ...partner,
        loanRequestsCount: partner._count.loanRequests
      }))
    });
  } catch (error: any) {
    console.error('Erro ao buscar parceiros:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar parceiros'
    });
  }
});

// GET /api/partners/:id - Obter detalhes de um parceiro específico
partnersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const partner = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            loanRequests: {
              where: {
                isPartnerReferral: true
              }
            }
          }
        }
      }
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        ...partner,
        loanRequestsCount: partner._count.loanRequests
      }
    });
  } catch (error: any) {
    console.error('Erro ao buscar parceiro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar parceiro'
    });
  }
});

// POST /api/partners - Tornar um cliente em parceiro
partnersRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const { userId, commissionRate, minimumCommission, maximumCommission } = req.body;

    // Verificar se o usuário existe e é um cliente
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    if (user.role !== 'CLIENT') {
      return res.status(400).json({
        success: false,
        error: 'Somente clientes podem se tornar parceiros'
      });
    }

    // Criar ou atualizar o programa de parceiros
    const partnerProgram = await prisma.partnerProgram.create({
      data: {
        name: `${user.name} - Programa de Parceiros`,
        description: `Programa de parceiros para ${user.name}`,
        commissionRate: commissionRate || 5.0, // 5% padrão
        minimumCommission: minimumCommission || 10.0,
        maximumCommission: maximumCommission || 1000.0,
        startDate: new Date()
      }
    });

    // Atualizar o usuário para ser um parceiro
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isPartner: true,
        partnerScore: 0
      }
    });

    res.json({
      success: true,
      data: {
        user: updatedUser,
        program: partnerProgram
      }
    });
  } catch (error: any) {
    console.error('Erro ao criar parceiro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar parceiro'
    });
  }
});

// PUT /api/partners/:id - Atualizar informações do parceiro
partnersRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const { id } = req.params;
    const { commissionRate, minimumCommission, maximumCommission, isActive } = req.body;

    // Verificar se o parceiro existe
    const existingPartner = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingPartner || !existingPartner.isPartner) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro não encontrado'
      });
    }

    // Atualizar o programa de parceiros existente
    const partnerProgram = await prisma.partnerProgram.findFirst({
      where: { name: { contains: existingPartner.name } }
    });

    if (partnerProgram) {
      await prisma.partnerProgram.update({
        where: { id: partnerProgram.id },
        data: {
          commissionRate: commissionRate ?? partnerProgram.commissionRate,
          minimumCommission: minimumCommission ?? partnerProgram.minimumCommission,
          maximumCommission: maximumCommission ?? partnerProgram.maximumCommission,
          isActive: isActive ?? partnerProgram.isActive,
          updatedAt: new Date()
        }
      });
    }

    // Atualizar informações do parceiro
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        partnerScore: req.body.partnerScore ?? existingPartner.partnerScore
      }
    });

    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error: any) {
    console.error('Erro ao atualizar parceiro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar parceiro'
    });
  }
});

// GET /api/partners/:id/commissions - Obter comissões de um parceiro
partnersRouter.get('/:id/commissions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate } = req.query;

    // Verificar se o usuário tem permissão para acessar essas comissões
    if (req.user?.id !== id && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const whereClause: any = {
      partnerId: id
    };

    if (status) {
      whereClause.status = status;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate as string);
      }
    }

    const commissions = await prisma.partnerCommission.findMany({
      where: whereClause,
      include: {
        loanRequest: {
          include: {
            customer: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calcular totais
    const totals = await prisma.partnerCommission.aggregate({
      where: whereClause,
      _sum: {
        commissionAmount: true
      }
    });

    res.json({
      success: true,
      data: commissions,
      totals: {
        totalCommissions: totals._sum.commissionAmount || 0
      }
    });
  } catch (error: any) {
    console.error('Erro ao buscar comissões:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar comissões'
    });
  }
});

// POST /api/partners/:id/commissions - Criar nova comissão (admin manual)
partnersRouter.post('/:id/commissions', async (req: Request, res: Response) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const { id } = req.params;
    const { loanRequestId, commissionAmount, commissionRate, notes, contractId } = req.body;

    // Verificar se o parceiro existe
    const partner = await prisma.user.findUnique({
      where: { id }
    });

    if (!partner || !partner.isPartner) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro não encontrado'
      });
    }

    // Verificar se o pedido de empréstimo existe
    const loanRequest = await prisma.loanRequest.findUnique({
      where: { id: loanRequestId }
    });

    if (!loanRequest) {
      return res.status(404).json({
        success: false,
        error: 'Pedido de empréstimo não encontrado'
      });
    }

    // Criar a comissão com novo formato
    const commission = await prisma.partnerCommission.create({
      data: {
        partnerId: id,
        loanRequestId: loanRequestId,
        contractId: contractId || null,
        totalCommission: commissionAmount,
        commissionAmount: 0, // Nada liberado ainda
        commissionRate: commissionRate || 0,
        installmentsReleased: 0,
        releasedPercent: 0,
        notes: notes || 'Comissão criada manualmente pelo admin',
        status: 'PENDING'
      }
    });

    res.json({
      success: true,
      data: commission
    });
  } catch (error: any) {
    console.error('Erro ao criar comissão:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar comissão'
    });
  }
});

// GET /api/partners/:id/bonuses - Obter bônus mensais de um parceiro
partnersRouter.get('/:id/bonuses', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verificar se o usuário tem permissão
    if (req.user?.id !== id && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const bonuses = await prisma.partnerBonus.findMany({
      where: { partnerId: id },
      orderBy: { month: 'desc' }
    });

    const totalBonuses = await prisma.partnerBonus.aggregate({
      where: { partnerId: id, status: 'PAID' },
      _sum: { bonusAmount: true }
    });

    res.json({
      success: true,
      data: bonuses,
      totals: {
        totalPaidBonuses: totalBonuses._sum.bonusAmount || 0
      }
    });
  } catch (error: any) {
    console.error('Erro ao buscar bônus:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar bônus'
    });
  }
});

// POST /api/partners/:id/invite - Convidar novo parceiro
partnersRouter.post('/:id/invite', async (req: Request, res: Response) => {
  try {
    // Apenas administradores podem convidar novos parceiros
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const { id } = req.params;
    const { email } = req.body;

    // Verificar se o usuário convidante é um parceiro ativo
    const partner = await prisma.user.findUnique({
      where: { id }
    });

    if (!partner || !partner.isPartner) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro não encontrado'
      });
    }

    // Verificar se já existe um convite pendente para este email
    const existingInvite = await prisma.partnerInvite.findFirst({
      where: {
        invitedEmail: email,
        status: 'PENDING'
      }
    });

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        error: 'Já existe um convite pendente para este email'
      });
    }

    // Gerar código de convite único
    const inviteCode = await generateUniqueCode('partnerInvite', 'inviteCode');

    // Criar o convite
    const invite = await prisma.partnerInvite.create({
      data: {
        partnerId: id,
        invitedEmail: email,
        inviteCode: inviteCode,
        expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Convite expira em 7 dias
      }
    });

    // Enviar email de convite
    const inviteLink = `${process.env.FRONTEND_URL}/register?invite=${inviteCode}`;
    const emailContent = `
      <h2>Convite para se tornar Parceiro Tubarão!</h2>
      <p>Olá,</p>
      <p>Você foi convidado para fazer parte do Programa de Parceiros Tubarão!</p>
      <p>Clique no link abaixo para se cadastrar como parceiro:</p>
      <a href="${inviteLink}" style="background-color: #D4AF37; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">
        Tornar-se Parceiro
      </a>
      <p>O link de convite expirará em 7 dias.</p>
      <p>Atenciosamente,<br>Tubarão Empréstimos 🦈</p>
    `;

    try {
      await emailService.send(email, 'Convite para Programa de Parceiros', emailContent);
    } catch (emailError) {
      console.error('Erro ao enviar email de convite:', emailError);
    }

    res.json({
      success: true,
      data: invite
    });
  } catch (error: any) {
    console.error('Erro ao convidar parceiro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao convidar parceiro'
    });
  }
});

// GET /api/partners/invite/:code - Verificar convite
partnersRouter.get('/invite/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    const invite = await prisma.partnerInvite.findUnique({
      where: {
        inviteCode: code
      },
      include: {
        partner: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: 'Convite não encontrado ou inválido'
      });
    }

    if (invite.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Convite já utilizado ou cancelado'
      });
    }

    if (invite.expiredAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Convite expirado'
      });
    }

    res.json({
      success: true,
      data: {
        invite,
        partner: invite.partner
      }
    });
  } catch (error: any) {
    console.error('Erro ao verificar convite:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao verificar convite'
    });
  }
});

// POST /api/partners/accept-invite/:code - Aceitar convite
partnersRouter.post('/accept-invite/:code', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    const { code } = req.params;

    // Verificar convite
    const invite = await prisma.partnerInvite.findUnique({
      where: {
        inviteCode: code
      }
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: 'Convite não encontrado ou inválido'
      });
    }

    if (invite.invitedEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        error: 'Convite não é para este usuário'
      });
    }

    if (invite.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Convite já utilizado ou cancelado'
      });
    }

    if (invite.expiredAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Convite expirado'
      });
    }

    // Atualizar convite para aceito
    await prisma.partnerInvite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date()
      }
    });

    // Tornar usuário um parceiro
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isPartner: true,
        partnerScore: 0
      }
    });

    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error: any) {
    console.error('Erro ao aceitar convite:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao aceitar convite'
    });
  }
});

// GET /api/partners/:id/stats - Obter estatísticas do parceiro
partnersRouter.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verificar se o usuário tem permissão para acessar essas estatísticas
    if (req.user?.id !== id && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    // Obter estatísticas do parceiro
    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(CASE WHEN lr.status = 'APPROVED' THEN 1 END) as approved_loans,
        COUNT(CASE WHEN lr.status = 'PENDING' THEN 1 END) as pending_loans,
        COUNT(CASE WHEN lr.status = 'REJECTED' THEN 1 END) as rejected_loans,
        COALESCE(SUM(CASE WHEN lr.status = 'APPROVED' THEN lr.amount END), 0) as total_loan_volume,
        COALESCE(SUM(pc.commissionAmount), 0) as total_commissions,
        COALESCE(AVG(pc.commissionAmount), 0) as average_commission,
        COUNT(DISTINCT c.id) as unique_customers
      FROM "users" u
      LEFT JOIN "loan_requests" lr ON u.id = lr."partnerId"
      LEFT JOIN "customers" c ON lr."customerId" = c.id
      LEFT JOIN "partner_commissions" pc ON lr.id = pc."loanRequestId"
      WHERE u.id = ${id}
    ` as any;

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error: any) {
    console.error('Erro ao buscar estatísticas do parceiro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar estatísticas do parceiro'
    });
  }
});

// GET /api/partners/:id/loan-requests - Obter pedidos de empréstimo referenciados pelo parceiro
partnersRouter.get('/:id/loan-requests', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate } = req.query;

    // Verificar se o usuário tem permissão
    if (req.user?.id !== id && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const whereClause: any = {
      partnerId: id,
      isPartnerReferral: true
    };

    if (status) {
      whereClause.status = status;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate as string);
      }
    }

    const loanRequests = await prisma.loanRequest.findMany({
      where: whereClause,
      include: {
        customer: true,
        partner: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: loanRequests
    });
  } catch (error: any) {
    console.error('Erro ao buscar pedidos de empréstimo do parceiro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar pedidos de empréstimo do parceiro'
    });
  }
});