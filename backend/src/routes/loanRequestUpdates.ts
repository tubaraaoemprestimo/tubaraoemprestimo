import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { normalizeDocField } from '../utils/normalizeDocField';

export const loanRequestUpdatesRouter = Router();
loanRequestUpdatesRouter.use(authenticate);

// PUT /api/loan-requests/:id/partner-info - Atualizar informações de parceiro
loanRequestUpdatesRouter.put('/:id/partner-info', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fatherPhoneRelationship,
      motherPhoneRelationship,
      spousePhoneRelationship,
      companyAddress,
      companyProfession,
      companyWorkSince,
      companyIncome,
      companyPaymentDay,
      contractTermsAccepted
    } = req.body;

    const updatedRequest = await prisma.loanRequest.update({
      where: { id },
      data: {
        fatherPhoneRelationship,
        motherPhoneRelationship,
        spousePhoneRelationship,
        companyAddress,
        companyProfession,
        companyWorkSince,
        companyIncome,
        companyPaymentDay,
        contractTermsAccepted
      }
    });

    res.json({ success: true, data: updatedRequest });
  } catch (error: any) {
    console.error('[LoanRequests] Update partner info error:', error);
    res.status(500).json({ error: 'Erro ao atualizar informações' });
  }
});

// PUT /api/loan-requests/:id/company-info - Atualizar informações da empresa
loanRequestUpdatesRouter.put('/:id/company-info', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      companyAddress,
      companyProfession,
      companyWorkSince,
      companyIncome,
      companyPaymentDay
    } = req.body;

    const updatedRequest = await prisma.loanRequest.update({
      where: { id },
      data: {
        companyAddress,
        companyProfession,
        companyWorkSince,
        companyIncome,
        companyPaymentDay
      }
    });

    res.json({ success: true, data: updatedRequest });
  } catch (error: any) {
    console.error('[LoanRequests] Update company info error:', error);
    res.status(500).json({ error: 'Erro ao atualizar informações da empresa' });
  }
});

// PUT /api/loan-requests/:id/family-info - Atualizar informações de relacionamentos familiares
loanRequestUpdatesRouter.put('/:id/family-info', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fatherPhoneRelationship,
      motherPhoneRelationship,
      spousePhoneRelationship
    } = req.body;

    const updatedRequest = await prisma.loanRequest.update({
      where: { id },
      data: {
        fatherPhoneRelationship,
        motherPhoneRelationship,
        spousePhoneRelationship
      }
    });

    res.json({ success: true, data: updatedRequest });
  } catch (error: any) {
    console.error('[LoanRequests] Update family info error:', error);
    res.status(500).json({ error: 'Erro ao atualizar informações familiares' });
  }
});

export default loanRequestUpdatesRouter;