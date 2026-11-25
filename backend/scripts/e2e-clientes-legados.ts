// Homologação ponta a ponta do módulo Clientes Antigos + régua. SÓ no banco descartável.
// WhatsApp/e-mail/push interceptados: nada sai da máquina. Relógio da régua simulado por data.
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'node:net';

if (!/127\.0\.0\.1:55431\/tubarao_paytest/.test(process.env.DATABASE_URL || '')) throw new Error('RECUSADO: só roda no banco descartável');
process.env.JWT_SECRET = 'it-secret';
process.env.INFINITEPAY_HANDLE = '';
delete process.env.LEGACY_WHATSAPP_ENABLED;

const sentWhats: { to: string; text: string }[] = [];
const ok = (n: string) => console.log('OK  ', n);

(async () => {
  const axios = require('axios');
  // Intercepta toda requisição HTTP de envio (Evolution/WhatsApp, Resend/e-mail): registra e não envia.
  axios.defaults.adapter = async (config: any) => { const b = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {}); sentWhats.push({ to: String(b.number || config.url), text: String(b.text || b.textMessage?.text || b.html || '') }); return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config }; };
  const webpush = (await import('web-push')).default as any; webpush.sendNotification = async () => ({ statusCode: 201 });
  const { prisma } = await import('./src/services/prisma');

  const { legacyClientsRouter, legacyActivationRouter } = await import('./src/routes/legacyClients');
  const collectionRouter = (await import('./src/routes/collectionAutomation')).default;
  const { loansRouter } = await import('./src/routes/loans');
  const { paymentReceiptsRouter } = await import('./src/routes/paymentReceipts');
  const svc = await import('./src/services/collectionAutomationService');

  // WhatsApp "conectado" só na cópia, para exercitar o canal (axios interceptado).
  await prisma.whatsappConfig.updateMany({ data: { isConnected: true, apiUrl: 'http://wa.invalid', apiKey: 'x', instanceName: 'teste' } });
  await prisma.whatsappConfig.count().then(n => n || prisma.whatsappConfig.create({ data: { isConnected: true, apiUrl: 'http://wa.invalid', apiKey: 'x', instanceName: 'teste' } as any }));

  const app = express(); app.use(express.json());
  app.use('/api/legacy-clients', legacyClientsRouter);
  app.use('/api/activation', legacyActivationRouter);
  app.use('/api/collection-automation', collectionRouter);
  app.use('/api/loans', loansRouter);
  app.use('/api/payment-receipts', (await import('./src/middleware/auth')).authenticate, paymentReceiptsRouter);
  const ops = await import('./src/routes/legacyOps');
  app.use('/api/legacy-ops', ops.legacyOpsRouter);
  app.use('/api/my-disputes', ops.clientDisputesRouter);
  app.use('/api/returning-clients', (await import('./src/routes/returningClients')).returningClientsRouter);
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const stamp = Date.now();
  const admin = await prisma.user.create({ data: { name: 'Admin Teste', email: `adm-${stamp}@teste.invalid`, password: 'x', role: 'ADMIN' } });
  const tok = (u: any) => jwt.sign({ id: u.id, email: u.email, role: u.role }, 'it-secret');
  const call = async (method: string, path: string, body?: any, who: any = admin) => {
    const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(who ? { authorization: `Bearer ${tok(who)}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) as any };
  };
  const txBefore = await prisma.transaction.count();

  // Isola a régua: todos os contratos reais da cópia ficam com mensagens pausadas (só na cópia).
  await prisma.loan.updateMany({ where: { isLegacy: false }, data: { messagesSuspended: true } });

  // 1-2. cadastro pelo telefone + consulta
  const phone = `(11) 9${String(stamp).slice(-8, -4)}-${String(stamp).slice(-4)}`;
  const lk0 = await call('GET', `/api/legacy-clients/lookup?phone=${encodeURIComponent(phone)}`);
  assert.equal(lk0.body.matches.length, 0); ok('1. consulta: telefone não existe');
  const c = await call('POST', '/api/legacy-clients', { phone, name: 'Maria Fictícia de Teste' });
  assert.equal(c.status, 201); const cid = c.body.customer.id; ok('1. pré-cadastro pelo telefone');
  const svcs = (await call('GET', '/api/legacy-clients/services')).body.services;
  assert.deepEqual(svcs.map((s: any) => s.code).sort(), ['AUTONOMO', 'CLT', 'FINANCIAMENTO_CELULAR', 'GARANTIA', 'INVESTIDOR', 'LIMPA_NOME', 'MOTO']); ok('2. catálogo real: ' + svcs.map((s: any) => s.code).join(','));
  assert.equal((await call('POST', `/api/legacy-clients/${cid}/contracts`, { serviceCode: 'FINANCIAMENTO_CELULAR', amount: 1000, balance: 500, installmentAmount: 100, nextDueDate: '2099-01-01' })).body.code, 'USE_DEVICE_FLOW'); ok('2. celular vai para o fluxo próprio de aparelho');

  // 3-5. contratos: moto (parcelas) e CLT (juros mensal), saldo confirmado, vencimento em 7 dias
  const day = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const bad = await call('POST', `/api/legacy-clients/${cid}/contracts`, { serviceCode: 'MOTO', amount: 6000, balance: 3000, installmentAmount: 500, remainingInstallments: 5, nextDueDate: day(7) });
  assert.equal(bad.body.code, 'SCHEDULE_MISMATCH'); ok('3. parcelas que não somam o saldo → recusado');
  const moto = await call('POST', `/api/legacy-clients/${cid}/contracts`, { serviceCode: 'MOTO', amount: 6000, paidAmount: 3000, balance: 3000, installmentAmount: 500, remainingInstallments: 6, nextDueDate: day(7), frequency: 'MONTHLY', interestRate: 0, reference: `MOTO-${stamp}`, balanceConfirmed: true });
  assert.equal(moto.status, 201, JSON.stringify(moto.body)); const motoId = moto.body.loan.id;
  const motoInst = await prisma.installment.findMany({ where: { loanId: motoId }, orderBy: { dueDate: 'asc' } });
  assert.equal(motoInst.length, 6); assert.equal(motoInst.reduce((a, i) => a + i.amount, 0), 3000); ok('4-5. moto: 6 parcelas de 500 = saldo 3000, vencimento mensal');
  const clt = await call('POST', `/api/legacy-clients/${cid}/contracts`, { serviceCode: 'CLT', amount: 1000, balance: 1000, installmentAmount: 300, nextDueDate: day(5), interestRate: 30, reference: `CLT-${stamp}` });
  const cltId = clt.body.loan.id; assert.equal(clt.body.loan.collectionSuspended, true); ok('5. CLT com saldo não conferido nasce fora da régua');
  assert.equal(await prisma.transaction.count(), txBefore); ok('5. nenhum lançamento de caixa (sem desembolso/receita)');

  // 6-7. gestão de contratos e histórico
  const all = await call('GET', `/api/loans/admin/all?search=${encodeURIComponent('Maria Fictícia')}`);
  assert.ok(JSON.stringify(all.body).includes(motoId)); ok('6. aparece na Gestão de Contratos');
  const det = await call('GET', `/api/loans/${motoId}/admin-details`);
  assert.equal(det.status, 200); ok('6. detalhes do contrato abrem');
  const audits = await prisma.auditLog.findMany({ where: { entityId: { in: [cid, motoId, cltId] } } });
  assert.ok(audits.length >= 3); ok(`7. histórico: ${audits.map(a => a.action).join(', ')}`);

  // 8. régua 7/5/3: regras e programadas; rodada da régua com os 3 dias
  const put = await call('PUT', '/api/collection-automation/rules', { enabled: true, reminderDays: [7, 5, 3], sendHour: 9 });
  assert.deepEqual(put.body.rules.reminderDays, [7, 5, 3]); ok('8. régua configurada: 7, 5 e 3 dias');
  const sch = await call('GET', '/api/collection-automation/scheduled?days=7');
  const mine = sch.body.items.filter((i: any) => i.loanId === motoId || i.loanId === cltId);
  assert.ok(mine.some((i: any) => i.loanId === motoId && i.status === 'PROGRAMADA'));
  assert.ok(mine.filter((i: any) => i.loanId === cltId).every((i: any) => i.status === 'SALDO_NAO_CONFIRMADO')); ok('8. programadas: moto programada; CLT não conferido bloqueado com motivo');
  await call('PATCH', `/api/legacy-clients/contracts/${cltId}/collection`, { confirmBalance: true });

  sentWhats.length = 0;
  const r1 = await svc.runCollectionAutomation();
  const d7 = await prisma.collectionDispatch.findMany({ where: { loanId: { in: [motoId, cltId] } } });
  assert.ok(d7.some(d => d.loanId === motoId && d.triggerEvent === 'INSTALLMENT_DUE_7_DAYS' && d.status === 'SENT'), JSON.stringify(d7));
  assert.ok(d7.some(d => d.loanId === cltId && d.triggerEvent === 'INSTALLMENT_DUE_5_DAYS' && d.status === 'SENT'), JSON.stringify(d7));
  const waToMaria = sentWhats.filter(w => w.to.endsWith(phone.replace(/\D/g, '').slice(-8)));
  assert.ok(waToMaria.length >= 2); ok(`8. lembretes 7 dias (moto) e 5 dias (CLT) gerados — ${waToMaria.length} WhatsApp simulados, ${r1.totalSent} no total`);
  assert.ok(waToMaria.every(w => !/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(w.text))); ok('8. mensagens sem CPF');
  const r2 = await svc.runCollectionAutomation();
  const d7b = await prisma.collectionDispatch.findMany({ where: { loanId: { in: [motoId, cltId] } } });
  assert.equal(d7b.length, d7.length); assert.ok(d7b.every(d => d.attempts === 1)); ok('8. segunda rodada no mesmo dia não reenvia (idempotente)');
  // 3 dias: move a 1ª parcela da moto para daqui a 3 dias (só na cópia) e roda
  await prisma.installment.update({ where: { id: motoInst[0].id }, data: { dueDate: new Date(day(3) + 'T00:00:00') } });
  await svc.runCollectionAutomation();
  assert.ok(await prisma.collectionDispatch.count({ where: { installmentId: motoInst[0].id, triggerEvent: 'INSTALLMENT_DUE_3_DAYS', status: 'SENT' } })); ok('8. lembrete de 3 dias gerado');
  const hist = await call('GET', '/api/collection-automation/dispatches?limit=50');
  assert.ok(hist.body.items.some((i: any) => i.loanId === motoId)); ok('8. histórico de enviadas no painel');
  // pausar mensagens do contrato
  await call('PATCH', `/api/collection-automation/loans/${cltId}/messages`, { suspended: true });
  const schP = await call('GET', '/api/collection-automation/scheduled?days=7');
  assert.ok(schP.body.items.filter((i: any) => i.loanId === cltId).every((i: any) => i.status === 'COMUNICACAO_SUSPENSA')); ok('8. pausar mensagens do contrato funciona');
  await call('PATCH', `/api/collection-automation/loans/${cltId}/messages`, { suspended: false });

  // 9-10. convite e envio simulado
  const inv = await call('POST', `/api/legacy-clients/${cid}/invite`, { send: true });
  assert.equal(inv.body.simulation, true); const token = new URL(inv.body.link.replace('/#/', '/')).searchParams.get('c')!; ok('9-10. convite gerado (envio manual/simulado)');
  const reg = await call('POST', `/api/legacy-clients/contracts/${motoId}/regularize-message`, {});
  assert.equal(reg.status, 200); assert.ok(!/R\$|\d{3}\.\d{3}/.test(reg.body.text)); ok('10. mensagem "consultar/regularizar" sem valores nem CPF');

  // 11-12. ativação e visualização pelo cliente
  const last4 = phone.replace(/\D/g, '').slice(-4);
  const act = await call('POST', '/api/activation/complete', { token, phoneLast4: last4, email: `maria-${stamp}@teste.invalid`, password: 'SenhaForte1', acceptTerms: true }, null);
  assert.equal(act.status, 201); ok('11. cliente ativou a conta');
  const user = await prisma.user.findUnique({ where: { email: `maria-${stamp}@teste.invalid` } });
  const myLoans = await call('GET', '/api/loans', undefined, user);
  const ids = myLoans.body.map((l: any) => l.id);
  assert.ok(ids.includes(motoId) && ids.includes(cltId)); ok('12. cliente vê os contratos antigos no app (sem contratar de novo)');
  const motoView = myLoans.body.find((l: any) => l.id === motoId);
  assert.equal(motoView.installments.length, 6); ok('12. cliente vê as 6 parcelas');
  const other = await prisma.loan.findFirst({ where: { customerId: { not: cid } }, include: { installments: true } });
  if (other?.installments[0]) {
    const steal = await call('POST', '/api/payment-receipts', { installmentId: other.installments[0].id, receiptUrl: 'https://x/y.jpg' }, user);
    assert.equal(steal.status, 404); ok('12. cliente não envia comprovante em parcela de outra pessoa');
    const proof = await call('PUT', `/api/loans/${other.id}/installments/${other.installments[0].id}/proof`, { proofUrl: 'x' }, user);
    assert.equal(proof.status, 403); ok('12. cliente NÃO consegue mais dar baixa direta em parcela (rota fechada)');
  }

  // 13-14. comprovante fictício + conferência
  const all6 = await prisma.installment.findMany({ where: { loanId: motoId }, orderBy: { dueDate: 'asc' } });
  const rc = await call('POST', '/api/payment-receipts', { installmentId: all6[0].id, receiptUrl: 'https://exemplo.invalid/comprovante.jpg', amount: 500 }, user);
  assert.equal(rc.status, 200); ok('13. cliente enviou comprovante fictício');
  const gate = (await call('GET', '/api/collection-automation/scheduled?days=7')).body.items.filter((i: any) => i.installmentId === all6[0].id);
  assert.ok(gate.every((i: any) => i.status === 'PAGAMENTO_EM_CONFERENCIA')); ok('13. com comprovante pendente, régua não cobra essa parcela');
  const ap = await call('PUT', `/api/payment-receipts/${rc.body.id}/approve`, { amount: 500 });
  assert.equal(ap.status, 200, JSON.stringify(ap.body));
  const after1 = await prisma.loan.findUnique({ where: { id: motoId } });
  assert.equal(after1!.remainingAmount, 2500); ok('14. admin aprovou: saldo 3000 → 2500');

  // 15-16. quitação total (protegida) e régua interrompida
  assert.equal((await call('POST', `/api/loans/${motoId}/settle-all`, {})).body.code, 'CONFIRM_REQUIRED'); ok('15. quitação sem "QUITAR" → recusada no servidor');
  const [q1, q2] = await Promise.all([call('POST', `/api/loans/${motoId}/settle-all`, { confirm: 'QUITAR' }), call('POST', `/api/loans/${motoId}/settle-all`, { confirm: 'QUITAR' })]);
  assert.deepEqual([q1.status, q2.status].sort(), [200, 409]); ok('15. clique duplo: só 1 quitação aplicada');
  assert.equal(await prisma.transaction.count({ where: { description: { contains: 'Quitação total — Maria Fictícia' } } }), 1);
  assert.ok(await prisma.auditLog.count({ where: { action: 'LOAN_SETTLE_ALL', entityId: motoId } })); ok('15. quitação registrada na auditoria');
  const done = await prisma.loan.findUnique({ where: { id: motoId } });
  assert.equal(done!.status, 'COMPLETED'); assert.equal(done!.remainingAmount, 0);
  const sch2 = await call('GET', '/api/collection-automation/scheduled?days=30');
  assert.ok(!sch2.body.items.some((i: any) => i.loanId === motoId)); ok('16. contrato quitado sai da régua');
  const before = await prisma.collectionDispatch.count({ where: { loanId: motoId } });
  await svc.runCollectionAutomation();
  assert.equal(await prisma.collectionDispatch.count({ where: { loanId: motoId } }), before); ok('16. nenhuma cobrança após a quitação');

  // régua desligada
  await call('PUT', '/api/collection-automation/rules', { enabled: false });
  const off = await svc.runCollectionAutomation();
  assert.equal(off.totalSent, 0); ok('régua desligada: nada enviado');
  await call('PUT', '/api/collection-automation/rules', { enabled: true, reminderDays: [7, 5, 3] });


  // ═══════════════ PENDÊNCIAS (fase 3) ═══════════════
  const txStart = await prisma.transaction.count();
  const salesStart = await prisma.phoneSale.count();
  const unitsStart = await prisma.phoneInventoryUnit.count();
  await call('PUT', '/api/legacy-ops/automation', { automationEnabled: true, inviteWhatsapp: false, testPhone: '' });

  // P3 — celular antigo
  const p2 = `(21) 9${String(stamp).slice(-8, -4)}-${String(stamp).slice(-4)}`;
  const c2 = (await call('POST', '/api/legacy-clients', { phone: p2, name: 'João Fictício Celular' })).body.customer.id;
  const badCount = await call('POST', `/api/legacy-ops/customers/${c2}/devices`, { model: 'iPhone 13', originalInstallments: 10, paidInstallments: 4, remainingInstallments: 5 });
  assert.equal(badCount.body.code, 'COUNT_MISMATCH'); ok('P3. pagas + restantes ≠ total original → recusado');
  const pend = await call('POST', `/api/legacy-ops/customers/${c2}/devices`, { brand: 'Apple', model: 'iPhone 12', reference: `CEL-P-${stamp}` });
  assert.equal(pend.status, 201); assert.equal(pend.body.loan.collectionSuspended, true); assert.ok(pend.body.missing.length >= 3);
  assert.equal(await prisma.installment.count({ where: { loanId: pend.body.loan.id } }), 0); ok(`P3. faltando dados → pendente de conferência, sem cobranças (${pend.body.missing.join(', ')})`);
  const dev = await call('POST', `/api/legacy-ops/customers/${c2}/devices`, { brand: 'Apple', model: 'iPhone 13', deviceIdentifier: '000000000000000', originalSaleDate: '2026-05-10', originalPrice: 4000, downPayment: 1000, financedAmount: 3000, monthlyRate: 0, originalInstallments: 10, paidInstallments: 4, remainingInstallments: 6, installmentAmount: 300, balance: 1800, nextDueDate: day(7), frequency: 'MONTHLY', reference: `CEL-${stamp}`, balanceConfirmed: true, contractUrl: 'https://exemplo.invalid/contrato.pdf' });
  assert.equal(dev.status, 201, JSON.stringify(dev.body)); const devLoan = dev.body.loan.id;
  assert.equal(await prisma.installment.count({ where: { loanId: devLoan } }), 6);
  const ficha = await prisma.legacyDeviceFinancing.findUnique({ where: { loanId: devLoan } });
  assert.equal(ficha!.paidInstallments, 4); assert.equal(ficha!.model, 'iPhone 13'); ok('P3. celular antigo: 6 parcelas restantes, ficha do aparelho, contrato anexado');
  assert.equal(await prisma.phoneSale.count(), salesStart); assert.equal(await prisma.phoneInventoryUnit.count(), unitsStart); ok('P3. nenhuma venda nova e nenhuma baixa de estoque');
  assert.equal(await prisma.transaction.count(), txStart); ok('P3. nenhum lançamento de caixa');
  assert.equal((await call('POST', `/api/legacy-ops/customers/${c2}/devices`, { model: 'X', reference: `CEL-${stamp}` })).body.code, 'DUPLICATE_REFERENCE'); ok('P3. mesma referência não duplica');

  // P4 — investimento antigo
  const p3 = `(31) 9${String(stamp).slice(-8, -4)}-${String(stamp).slice(-4)}`;
  const c3 = (await call('POST', '/api/legacy-clients', { phone: p3, name: 'Ana Fictícia Investidora' })).body.customer.id;
  const invNo = await call('POST', `/api/legacy-ops/customers/${c3}/investments`, { amount: 5000 });
  assert.equal(invNo.body.investment.status, 'PENDING_REVIEW'); ok('P4. sem condição de rendimento no contrato → pendente (não se inventa rendimento)');
  const invRec = await call('POST', `/api/legacy-ops/customers/${c3}/investments`, { amount: 10000, originalDate: '2026-01-10', yieldTerms: '2% ao mês, pago todo dia 10', monthlyRate: 2, payoutFrequency: 'MONTHLY', paidYieldsTotal: 1800, nextPayoutDate: day(15), reference: `INV-${stamp}` });
  assert.equal(invRec.status, 201); const invId = invRec.body.investment.id;
  assert.equal(await prisma.transaction.count(), txStart); ok('P4. aporte antigo registrado sem novo recebimento no caixa');
  assert.equal(await prisma.loan.count({ where: { customerId: c3 } }), 0);
  assert.equal(await prisma.installment.count({ where: { loan: { customerId: c3 } } }), 0); ok('P4. investidor não tem cobrança nem entra na régua');
  const histPay = await call('POST', `/api/legacy-ops/investments/${invId}/payouts`, { amount: 200, paidAt: '2026-10-10', historical: true });
  assert.equal(histPay.status, 201); assert.equal(await prisma.transaction.count(), txStart); ok('P4. repasse histórico: só registro, sem caixa');
  assert.equal((await call('POST', `/api/legacy-ops/investments/${invId}/payouts`, { amount: 200 })).body.code, 'CONFIRM_REQUIRED'); ok('P4. repasse novo exige confirmação REPASSAR');
  const newPay = await call('POST', `/api/legacy-ops/investments/${invId}/payouts`, { amount: 200, confirm: 'REPASSAR' });
  const outTx = await prisma.transaction.findUnique({ where: { id: newPay.body.payout.transactionId } });
  assert.equal(outTx!.type, 'OUT'); assert.equal(outTx!.amount, 200); ok('P4. repasse novo gera uma saída de caixa (OUT 200)');

  // P6 — preferências de comunicação + bloqueio de mensagem "na fila"
  assert.equal((await call('PATCH', `/api/legacy-ops/customers/${c2}/communication`, { suspend: true })).status, 400); ok('P6. suspender sem motivo → recusado');
  await call('PATCH', `/api/legacy-ops/customers/${c2}/communication`, { promoOptOut: true, inviteOptOut: true, phoneConfirmed: true });
  const pref = await call('GET', `/api/legacy-ops/customers/${c2}/communication`);
  assert.equal(pref.body.preferences.promoOptOut, true); assert.equal(pref.body.preferences.phoneConfirmed, true); ok('P6. preferências salvas');
  assert.ok(await prisma.auditLog.count({ where: { action: 'COMMUNICATION_PREFS_UPDATED', entityId: c2 } })); ok('P6. alteração auditada');
  await call('PUT', '/api/legacy-ops/automation', { inviteWhatsapp: true });
  const blockedInv = await call('POST', `/api/legacy-clients/${c2}/invite`, { send: true });
  assert.equal(blockedInv.body.whatsappSent, false); assert.ok(/convite/i.test(blockedInv.body.blocked)); ok('P6. cliente sem convite → envio bloqueado (link ainda gerado para o admin)');
  // mensagem já "na fila": rodada carrega a cobrança, cliente é suspenso no meio, envio é barrado
  const rules = await import('./src/services/collectionRules');
  const queued = await prisma.installment.findFirst({ where: { loanId: devLoan }, orderBy: { dueDate: 'asc' }, include: { loan: { include: { customer: true } } } });
  assert.equal(await rules.collectionGate(queued, 'INSTALLMENT_DUE_7_DAYS'), null);
  await call('PATCH', `/api/legacy-ops/customers/${c2}/communication`, { suspend: true, suspendedReason: 'pediu para não ser contatado esta semana' });
  assert.equal(await rules.collectionGate(queued, 'INSTALLMENT_DUE_7_DAYS'), 'CLIENTE_SUSPENSO'); ok('P6. mensagem já na fila respeita suspensão feita depois');
  await call('PATCH', `/api/legacy-ops/customers/${c2}/communication`, { suspend: false });

  // P5 — contestação
  const dsp = await call('POST', '/api/legacy-ops/disputes', { loanId: devLoan, reason: 'Parcela já paga', description: 'cliente diz que pagou' });
  assert.equal(dsp.status, 201); const dspId = dsp.body.dispute.id;
  const balBefore = (await prisma.loan.findUnique({ where: { id: devLoan } }))!.remainingAmount;
  assert.equal(await rules.collectionGate(queued, 'INSTALLMENT_DUE_7_DAYS'), 'CONTESTACAO_ABERTA'); ok('P5. contestação aberta suspende a cobrança');
  const schD = await call('GET', '/api/collection-automation/scheduled?days=7');
  assert.ok(schD.body.items.filter((i: any) => i.loanId === devLoan).every((i: any) => i.status === 'CONTESTACAO_ABERTA')); ok('P5. painel mostra o motivo "Contestação aberta"');
  assert.equal((await prisma.loan.findUnique({ where: { id: devLoan } }))!.remainingAmount, balBefore);
  assert.equal((await prisma.loan.findUnique({ where: { id: devLoan } }))!.status, 'ACTIVE'); ok('P5. abrir contestação não muda saldo nem cancela o contrato');
  assert.equal((await call('PATCH', `/api/legacy-ops/disputes/${dspId}`, { status: 'RESOLVED', note: 'conferido' })).body.code, 'CONFIRM_REQUIRED'); ok('P5. resolver exige confirmação');
  await call('PATCH', `/api/legacy-ops/disputes/${dspId}`, { status: 'IN_REVIEW', note: 'pedindo extrato' });
  // simula a régua de hoje com a contestação aberta: nada sai para este contrato
  await prisma.collectionDispatch.deleteMany({ where: { loanId: devLoan } });
  await svc.runCollectionAutomation();
  assert.equal(await prisma.collectionDispatch.count({ where: { loanId: devLoan } }), 0); ok('P5. rodada da régua com contestação: nenhum aviso');
  const res1 = await call('PATCH', `/api/legacy-ops/disputes/${dspId}`, { status: 'RESOLVED', note: 'pagamento não localizado; cobrança mantida', confirm: 'RESOLVER' });
  assert.equal(res1.status, 200);
  assert.ok(await prisma.auditLog.count({ where: { action: 'DISPUTE_RESOLVED', entityId: devLoan } })); ok('P5. resolvida com registro de auditoria');
  // retomada controlada: só os avisos do dia (o vencimento está a 7 dias → só o D-7), nada acumulado
  await svc.runCollectionAutomation();
  const after = await prisma.collectionDispatch.findMany({ where: { loanId: devLoan } });
  assert.deepEqual(after.map(d => d.triggerEvent), ['INSTALLMENT_DUE_7_DAYS']); ok('P5. retomada: só o aviso devido hoje (sem disparar acumulados)');
  // cliente abre divergência pelo app
  const u2email = `joao-${stamp}@teste.invalid`;
  const inv2 = await call('POST', `/api/legacy-clients/${c2}/invite`, {});
  const t2 = new URL(inv2.body.link.replace('/#/', '/')).searchParams.get('c')!;
  await call('POST', '/api/activation/complete', { token: t2, phoneLast4: p2.replace(/\D/g, '').slice(-4), email: u2email, password: 'SenhaForte1', acceptTerms: true }, null);
  const u2 = await prisma.user.findUnique({ where: { email: u2email } });
  assert.equal((await call('POST', '/api/my-disputes', { loanId: motoId, description: 'contrato de outra pessoa' }, u2)).status, 404); ok('P5. cliente não abre divergência em contrato de outro');
  const cd = await call('POST', '/api/my-disputes', { loanId: devLoan, description: 'já paguei a parcela pelo Pix ontem' }, u2);
  assert.equal(cd.status, 201); assert.equal(await rules.collectionGate(queued, 'INSTALLMENT_DUE_5_DAYS'), 'CONTESTACAO_ABERTA'); ok('P5. cliente informa divergência pelo app → cobrança pausada');
  assert.ok((await call('GET', '/api/loans', undefined, u2)).body.some((l: any) => l.id === devLoan)); ok('P3. cliente vê o celular antigo no app');

  // P4 — investidor ativa e vê o investimento
  const inv3 = await call('POST', `/api/legacy-clients/${c3}/invite`, {});
  const t3 = new URL(inv3.body.link.replace('/#/', '/')).searchParams.get('c')!;
  await call('POST', '/api/activation/complete', { token: t3, phoneLast4: p3.replace(/\D/g, '').slice(-4), email: `ana-${stamp}@teste.invalid`, password: 'SenhaForte1', acceptTerms: true }, null);
  const u3 = await prisma.user.findUnique({ where: { email: `ana-${stamp}@teste.invalid` } });
  const myInv = await call('GET', '/api/my-disputes/investments', undefined, u3);
  assert.equal(myInv.body.items.length, 2); assert.equal(myInv.body.items.find((i: any) => i.id === invId).payouts.length, 2);
  assert.ok(myInv.body.items.every((i: any) => i.notes === undefined)); ok('P4. investidor ativa a conta e vê aportes e repasses (sem notas internas)');
  assert.equal((await call('GET', '/api/my-disputes/investments', undefined, u2)).body.items.length, 0); ok('P4. outro cliente não vê o investimento');

  // P2 — WhatsApp: modo de teste, pausa geral, sem valor para telefone não confirmado
  sentWhats.length = 0;
  await call('PUT', '/api/legacy-ops/automation', { inviteWhatsapp: true, testPhone: '(11) 99999-0000' });
  const pFresh = `(41) 9${String(stamp).slice(-8, -4)}-${String(stamp).slice(-4)}`;
  const c4 = (await call('POST', '/api/legacy-clients', { phone: pFresh, name: 'Pedro Fictício' })).body.customer.id;
  const tInv = await call('POST', `/api/legacy-clients/${c4}/invite`, { send: true });
  assert.equal(tInv.body.whatsappSent, true); assert.equal(tInv.body.testMode, true);
  assert.equal(sentWhats.length, 1); assert.ok(sentWhats[0].to.endsWith('11999990000')); assert.ok(sentWhats[0].text.startsWith('[TESTE')); ok('P2. modo de teste: convite vai SÓ para o número de homologação');
  await call('PUT', '/api/legacy-ops/automation', { testPhone: '' });
  sentWhats.length = 0;
  await call('PUT', '/api/legacy-ops/automation', { automationEnabled: false });
  const offInv = await call('POST', `/api/legacy-clients/${c4}/invite`, { send: true });
  assert.equal(offInv.body.whatsappSent, false); assert.equal(sentWhats.length, 0);
  await prisma.collectionDispatch.deleteMany({ where: { loanId: devLoan } });
  await call('PATCH', `/api/legacy-ops/disputes/${cd.body.dispute.id}`, { status: 'RESOLVED', note: 'ok', confirm: 'RESOLVER' });
  const offRun = await svc.runCollectionAutomation();
  assert.equal(offRun.totalSent, 0); assert.equal(sentWhats.length, 0); ok('P2. pausa geral no painel: nenhuma mensagem (convite nem régua)');
  await call('PUT', '/api/legacy-ops/automation', { automationEnabled: true, inviteWhatsapp: false });
  const auto = await call('GET', '/api/legacy-ops/automation');
  assert.ok(auto.body.recent.some((r: any) => r.status === 'BLOCKED') && auto.body.recent.some((r: any) => r.status === 'SENT')); ok('P2. histórico de envios (enviadas e bloqueadas) no painel');
  // confirmação de pagamento sem telefone confirmado não mostra valor
  sentWhats.length = 0;
  const pf = await call('POST', `/api/legacy-clients/${c4}/contracts`, { serviceCode: 'MOTO', amount: 900, balance: 900, installmentAmount: 300, remainingInstallments: 3, nextDueDate: day(20), balanceConfirmed: true });
  const pfInst = await prisma.installment.findFirst({ where: { loanId: pf.body.loan.id }, orderBy: { dueDate: 'asc' } });
  const rcp = await prisma.paymentReceipt.create({ data: { installmentId: pfInst!.id, customerId: c4, receiptUrl: 'https://x.invalid/c.jpg', amount: 300, status: 'PENDING' } });
  await call('PUT', `/api/payment-receipts/${rcp.id}/approve`, { amount: 300 });
  await new Promise(r => setTimeout(r, 500));
  const conf = sentWhats.find(w => /confirmado/i.test(w.text));
  assert.ok(conf, 'esperava confirmação'); assert.ok(!/R\$/.test(conf!.text)); ok('P2. confirmação para telefone não confirmado: sem valores');

  // P7 — migração antiga
  const legacyGet = await call('GET', '/api/returning-clients', undefined, u2);
  assert.equal(legacyGet.status, 403);
  assert.equal((await call('POST', '/api/returning-clients/contact', { message: 'tenho moto' }, u2)).status, 200);
  assert.ok(await prisma.notification.count({ where: { title: '👋 Cliente antigo pediu ativação' } })); ok('P7. "Já sou cliente" avisa a equipe (sem criar cobrança)');

  // Painel com números reais
  const dash = await call('GET', '/api/legacy-ops/dashboard');
  assert.ok(dash.body.devices >= 2 && dash.body.investments >= 2 && dash.body.total >= 4 && typeof dash.body.openDisputes === 'number'); ok(`Painel: ${JSON.stringify(dash.body)}`);
  assert.equal((await call('GET', '/api/legacy-ops/dashboard', undefined, u2)).status, 403); ok('Permissões: cliente não acessa painel/ações de admin');

  console.log('TODOS OS TESTES PASSARAM');
  srv.close(); await prisma.$disconnect(); process.exit(0);
})().catch(e => { console.error('FALHOU:', e); process.exit(1); });
