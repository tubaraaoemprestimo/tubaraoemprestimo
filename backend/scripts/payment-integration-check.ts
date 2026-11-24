/**
 * Verificação de integração da baixa de comprovantes contra PostgreSQL REAL e DESCARTÁVEL.
 * Só dados fictícios. Recusa rodar se DATABASE_URL não apontar para um banco *_paytest.
 *
 * Uso: DATABASE_URL=postgresql://.../tubarao_paytest npx tsx scripts/payment-integration-check.ts
 * (antes: npx prisma db push --skip-generate no banco descartável)
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const url = process.env.DATABASE_URL || '';
if (!/\/tubarao_paytest(\?|$)/.test(url)) {
    console.error('Recusado: DATABASE_URL precisa ser o banco descartável tubarao_paytest.');
    process.exit(2);
}

async function main() {
    const { prisma } = await import('../src/services/prisma');
    const { applyPaymentInTransaction } = await import('../src/services/paymentConfirmationService');
    const results: Array<[string, boolean, string?]> = [];
    const check = async (name: string, fn: () => Promise<void>) => {
        try { await fn(); results.push([name, true]); } catch (e: any) { results.push([name, false, e?.message]); }
    };

    async function fixture(profileType: 'CLT' | 'AUTONOMO') {
        const tag = randomUUID().slice(0, 8);
        const user = await prisma.user.create({ data: { email: `fict-${tag}@exemplo.invalid`, password: 'x', name: `Fictício ${tag}`, role: 'CLIENT' } as any });
        const customer = await prisma.customer.create({ data: { name: `Cliente Fictício ${tag}`, cpf: `000${tag}`, email: user.email, phone: '00000000000', userId: user.id } as any });
        const request = await prisma.loanRequest.create({ data: { clientName: customer.name, cpf: customer.cpf, email: user.email, phone: '00000000000', amount: 500, installments: 1, profileType, status: 'APPROVED', customerId: customer.id, userId: user.id } as any });
        const loan = await prisma.loan.create({ data: { requestId: request.id, customerId: customer.id, amount: 500, principalAmount: 500, remainingAmount: 500, installmentsCount: 1, status: 'ACTIVE', startDate: new Date(), interestRate: 30 } as any });
        const inst = await prisma.installment.create({ data: { loanId: loan.id, amount: 150, dueDate: new Date(Date.now() - 5 * 86400000), status: 'OPEN', isInterestPayment: profileType === 'CLT', lateFeeAmount: profileType === 'AUTONOMO' ? 40 : 0, fineAccumulated: profileType === 'AUTONOMO' ? 40 : 0 } as any });
        const receipt = await prisma.paymentReceipt.create({ data: { installmentId: inst.id, customerId: customer.id, receiptUrl: 'https://exemplo.invalid/r.jpg', amount: 150, status: 'PENDING' } as any });
        return { customer, loan, inst, receipt };
    }

    const snapshot = async (loanId: string) => {
        const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId }, include: { installments: { orderBy: { dueDate: 'asc' } } } });
        const tx = await prisma.transaction.count({ where: { description: { contains: loanId.substring(0, 8) } } });
        return JSON.stringify({ r: loan.remainingAmount, s: loan.status, i: loan.installments.map(i => [i.status, i.lateFeeAmount, i.amount]), tx });
    };

    // 1) Falha no meio da baixa desfaz TUDO (inclusive a aprovação do comprovante).
    await check('falha no meio desfaz parcela, contrato, lançamento e aprovação', async () => {
        const f = await fixture('AUTONOMO');
        const before = await snapshot(f.loan.id);
        await assert.rejects(prisma.$transaction(async tx => {
            await tx.paymentReceipt.updateMany({ where: { id: f.receipt.id, status: 'PENDING' }, data: { status: 'APPROVED' } });
            await applyPaymentInTransaction(tx, { ...f.receipt, status: 'APPROVED' }, {});
            throw new Error('falha simulada após a baixa');
        }, { timeout: 20000 }));
        assert.equal(await snapshot(f.loan.id), before, 'contrato/parcelas mudaram após rollback');
        assert.equal((await prisma.paymentReceipt.findUniqueOrThrow({ where: { id: f.receipt.id } })).status, 'PENDING');
    });

    // 2) Duas aprovações simultâneas: no máximo uma aplica (Serializable + reivindicação PENDING).
    await check('duas aprovações simultâneas aplicam uma vez', async () => {
        const f = await fixture('CLT');
        const approve = () => prisma.$transaction(async tx => {
            const claimed = await tx.paymentReceipt.updateMany({ where: { id: f.receipt.id, status: 'PENDING' }, data: { status: 'APPROVED' } });
            if (claimed.count !== 1) return 'conflict';
            await applyPaymentInTransaction(tx, f.receipt, {});
            return 'applied';
        }, { isolationLevel: 'Serializable', timeout: 20000 }).catch((e: any) => (e?.code === 'P2034' ? 'serialization' : Promise.reject(e)));
        const out = await Promise.all([approve(), approve()]);
        assert.equal(out.filter(o => o === 'applied').length, 1, `resultado: ${out}`);
        const insts = await prisma.installment.findMany({ where: { loanId: f.loan.id } });
        assert.equal(insts.filter(i => i.status === 'OPEN').length, 1, 'mais de uma nova cobrança de juros criada');
        assert.equal(await prisma.transaction.count({ where: { description: { contains: f.loan.id.substring(0, 8) } } }), 1);
    });

    // 3) CLT: juros não abate o principal (regra existente preservada).
    await check('CLT: pagamento de juros mantém o principal', async () => {
        const f = await fixture('CLT');
        await prisma.$transaction(tx => applyPaymentInTransaction(tx, f.receipt, {}), { timeout: 20000 });
        const loan = await prisma.loan.findUniqueOrThrow({ where: { id: f.loan.id } });
        assert.equal(Number(loan.remainingAmount), 500);
    });

    // 4) AUTONOMO: waterfall multa → principal (regra existente preservada).
    await check('AUTONOMO: R$150 paga R$40 de multa e abate R$110 do principal', async () => {
        const f = await fixture('AUTONOMO');
        await prisma.$transaction(tx => applyPaymentInTransaction(tx, f.receipt, {}), { timeout: 20000 });
        const loan = await prisma.loan.findUniqueOrThrow({ where: { id: f.loan.id } });
        const inst = await prisma.installment.findUniqueOrThrow({ where: { id: f.inst.id } });
        assert.equal(Number(loan.remainingAmount), 390);
        assert.equal(Number(inst.lateFeeAmount), 0);
    });

    for (const [name, ok, err] of results) console.log(`${ok ? 'PASSOU' : 'FALHOU'}  ${name}${err ? `  -> ${err}` : ''}`);
    await prisma.$disconnect();
    process.exit(results.every(r => r[1]) ? 0 : 1);
}

main().catch(e => { console.error('ERRO', e); process.exit(1); });
