import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/returning-clients
 * Criar solicitação de cliente recorrente (já foi cliente antes do sistema)
 *
 * Fluxo:
 * 1. Atualização cadastral completa
 * 2. Dados do contrato atual
 * 3. Criar contrato com status PENDENTE_VALIDACAO
 * 4. Não gerar cobrança automática até validação manual
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      // Etapa 1: Atualização Cadastral
      name,
      cpf,
      rg,
      birthDate,
      phone,
      email,
      address,
      neighborhood,
      city,
      state,
      zipCode,
      proofOfAddressUrl,
      selfieUrl,

      // Etapa 2: Dados do Contrato Atual
      loanAmount,
      interestRate,
      dueDate,
      chargeType, // 'MENSAL' ou 'DIARIA'
      notes
    } = req.body;

    // Validações básicas
    if (!name || !cpf || !phone || !email) {
      return res.status(400).json({ error: 'Dados cadastrais obrigatórios não preenchidos' });
    }

    if (!loanAmount || !interestRate || !dueDate || !chargeType) {
      return res.status(400).json({ error: 'Dados do contrato atual obrigatórios não preenchidos' });
    }

    // Verificar se já existe customer com esse CPF
    let customer = await prisma.customer.findFirst({
      where: { cpf: cpf.replace(/\D/g, '') }
    });

    // Se não existe, criar customer
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name,
          cpf: cpf.replace(/\D/g, ''),
          phone: phone.replace(/\D/g, ''),
          email,
          address,
          city,
          state,
          zipCode: zipCode?.replace(/\D/g, ''),
          birthDate,
          rg,
          neighborhood,
          status: 'ACTIVE'
        }
      });
    } else {
      // Atualizar dados do customer existente
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name,
          phone: phone.replace(/\D/g, ''),
          email,
          address,
          city,
          state,
          zipCode: zipCode?.replace(/\D/g, ''),
          birthDate,
          rg,
          neighborhood
        }
      });
    }

    // Criar LoanRequest com status PENDENTE_VALIDACAO
    const loanRequest = await prisma.loanRequest.create({
      data: {
        customerId: customer.id,
        userId: req.user!.id,
        clientName: name,
        cpf: cpf.replace(/\D/g, ''),
        email,
        phone: phone.replace(/\D/g, ''),
        amount: loanAmount,
        installments: 1, // Cliente recorrente não usa parcelas
        status: 'PENDENTE_VALIDACAO', // Status especial para migração
        profileType: 'CLT', // Assumir CLT por padrão
        address,
        neighborhood,
        city,
        state,
        zipCode: zipCode?.replace(/\D/g, ''),
        birthDate,
        proofOfAddressUrl,
        selfieUrl,
        // Flags de classificação
        isService: false,
        isInvestment: false,
        isLoan: true
      }
    });

    // Criar registro de migração de contrato (tabela auxiliar)
    await prisma.$executeRaw`
      INSERT INTO contract_migrations (
        loan_request_id,
        customer_id,
        loan_amount,
        interest_rate,
        due_date,
        charge_type,
        notes,
        status,
        created_at
      ) VALUES (
        ${loanRequest.id},
        ${customer.id},
        ${loanAmount},
        ${interestRate},
        ${dueDate},
        ${chargeType},
        ${notes || ''},
        'PENDENTE_VALIDACAO',
        NOW()
      )
    `;

    console.log(`[ReturningClients] ✅ Solicitação criada: ${name} - R$ ${loanAmount}`);

    res.json({
      success: true,
      loanRequestId: loanRequest.id,
      customerId: customer.id,
      message: 'Solicitação de migração criada com sucesso. Aguardando validação manual.'
    });

  } catch (error: any) {
    console.error('[ReturningClients] Erro ao criar solicitação:', error);
    res.status(500).json({ error: 'Erro ao processar solicitação de cliente recorrente' });
  }
});

/**
 * GET /api/returning-clients
 * Listar todas as solicitações de clientes recorrentes pendentes
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;

    const migrations = await prisma.$queryRaw`
      SELECT
        cm.*,
        lr.client_name,
        lr.cpf,
        lr.email,
        lr.phone,
        c.name as customer_name
      FROM contract_migrations cm
      LEFT JOIN loan_requests lr ON cm.loan_request_id = lr.id
      LEFT JOIN customers c ON cm.customer_id = c.id
      WHERE cm.status = ${status || 'PENDENTE_VALIDACAO'}
      ORDER BY cm.created_at DESC
    `;

    res.json({ migrations });
  } catch (error: any) {
    console.error('[ReturningClients] Erro ao listar:', error);
    res.status(500).json({ error: 'Erro ao listar solicitações' });
  }
});

/**
 * GET /api/returning-clients/:id
 * Buscar detalhes de uma solicitação específica
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const migration = await prisma.$queryRaw`
      SELECT
        cm.*,
        lr.*,
        c.*
      FROM contract_migrations cm
      LEFT JOIN loan_requests lr ON cm.loan_request_id = lr.id
      LEFT JOIN customers c ON cm.customer_id = c.id
      WHERE cm.id = ${id}
      LIMIT 1
    `;

    if (!migration || (migration as any[]).length === 0) {
      return res.status(404).json({ error: 'Solicitação não encontrada' });
    }

    res.json({ migration: (migration as any[])[0] });
  } catch (error: any) {
    console.error('[ReturningClients] Erro ao buscar:', error);
    res.status(500).json({ error: 'Erro ao buscar solicitação' });
  }
});

/**
 * PATCH /api/returning-clients/:id/validate
 * Validar e ativar contrato de cliente recorrente
 */
router.patch('/:id/validate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustedAmount, adjustedRate, adjustedDueDate } = req.body;

    // Buscar migração
    const migrations = await prisma.$queryRaw`
      SELECT * FROM contract_migrations WHERE id = ${id} LIMIT 1
    ` as any[];

    if (!migrations || migrations.length === 0) {
      return res.status(404).json({ error: 'Solicitação não encontrada' });
    }

    const migration = migrations[0];

    // Atualizar LoanRequest para APPROVED
    await prisma.loanRequest.update({
      where: { id: migration.loan_request_id },
      data: {
        status: 'APPROVED',
        amount: adjustedAmount || migration.loan_amount
      }
    });

    // Criar Loan
    const loan = await prisma.loan.create({
      data: {
        customerId: migration.customer_id,
        requestId: migration.loan_request_id,
        amount: adjustedAmount || migration.loan_amount,
        installmentsCount: 1,
        remainingAmount: adjustedAmount || migration.loan_amount,
        status: 'APPROVED',
        startDate: new Date(),
        isService: false,
        isInvestment: false,
        isLoan: true
      }
    });

    // Criar parcela/cobrança
    const finalDueDate = adjustedDueDate ? new Date(adjustedDueDate) : new Date(migration.due_date);

    await prisma.installment.create({
      data: {
        loanId: loan.id,
        dueDate: finalDueDate,
        amount: adjustedAmount || migration.loan_amount,
        status: 'OPEN'
      }
    });

    // Atualizar status da migração
    await prisma.$executeRaw`
      UPDATE contract_migrations
      SET
        status = 'VALIDADO',
        validated_at = NOW(),
        validated_by = ${req.user!.id}
      WHERE id = ${id}
    `;

    console.log(`[ReturningClients] ✅ Contrato validado e ativado: ${migration.customer_id}`);

    res.json({
      success: true,
      loanId: loan.id,
      message: 'Contrato validado e ativado com sucesso'
    });

  } catch (error: any) {
    console.error('[ReturningClients] Erro ao validar:', error);
    res.status(500).json({ error: 'Erro ao validar contrato' });
  }
});

/**
 * PATCH /api/returning-clients/:id/reject
 * Rejeitar solicitação de cliente recorrente
 */
router.patch('/:id/reject', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Atualizar status da migração
    await prisma.$executeRaw`
      UPDATE contract_migrations
      SET
        status = 'REJEITADO',
        rejection_reason = ${reason || ''},
        rejected_at = NOW(),
        rejected_by = ${req.user!.id}
      WHERE id = ${id}
    `;

    // Atualizar LoanRequest
    const migrations = await prisma.$queryRaw`
      SELECT loan_request_id FROM contract_migrations WHERE id = ${id} LIMIT 1
    ` as any[];

    if (migrations && migrations.length > 0) {
      await prisma.loanRequest.update({
        where: { id: migrations[0].loan_request_id },
        data: { status: 'REJECTED' }
      });
    }

    res.json({
      success: true,
      message: 'Solicitação rejeitada'
    });

  } catch (error: any) {
    console.error('[ReturningClients] Erro ao rejeitar:', error);
    res.status(500).json({ error: 'Erro ao rejeitar solicitação' });
  }
});

export { router as returningClientsRouter };
