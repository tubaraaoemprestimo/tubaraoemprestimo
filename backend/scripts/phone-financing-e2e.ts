/**
 * Teste ponta a ponta do módulo de celulares contra um Postgres DESCARTÁVEL.
 * Recusa rodar se DATABASE_URL não apontar para banco de teste.
 *
 * Uso: DATABASE_URL=postgres://...@127.0.0.1:55432/t JWT_SECRET=x \
 *      PHONE_FINANCING_ENABLED=true PHONE_FINANCING_ADMIN_ENABLED=true \
 *      APPLE_MDM_ENABLED=true npx tsx scripts/phone-financing-e2e.ts
 */
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';

const url = process.env.DATABASE_URL || '';
if (!/:55432\//.test(url)) { console.error('Recusado: DATABASE_URL precisa ser o banco de teste (porta 55432).'); process.exit(2); }

async function main() {
    const { prisma } = await import('../src/services/prisma');
    const db: any = prisma;
    const { servicesCatalogRouter, phoneProductsRouter, phoneFinancingRouter, phoneFinancingAdminRouter } = await import('../src/routes/phoneFinancing');
    const { appleMdmRouter } = await import('../src/routes/appleMdm');

    const app = express();
    app.use(express.json());
    app.use('/api/services', servicesCatalogRouter);
    app.use('/api/phone-products', phoneProductsRouter);
    app.use('/api/phone-financing', phoneFinancingRouter);
    app.use('/api/admin/phone-financing', phoneFinancingAdminRouter);
    app.use('/api/admin/mdm', appleMdmRouter);
    const server = app.listen(0);
    const base = `http://127.0.0.1:${(server.address() as any).port}/api`;

    const mkUser = (role: string, i: number) => db.user.create({ data: { name: `T${i}`, email: `t${i}-${Date.now()}@test.local`, password: 'x', role } });
    const admin1 = await mkUser('ADMIN', 1), admin2 = await mkUser('ADMIN', 2), client = await mkUser('CLIENT', 3);
    const customer = await db.customer.create({ data: { userId: client.id, name: 'Cliente Teste', cpf: `9${Date.now()}`.slice(0, 11), email: client.email, phone: '11999990000' } });
    const tok = (u: any) => jwt.sign({ id: u.id }, process.env.JWT_SECRET!, { expiresIn: '10m' });
    const call = async (u: any, method: string, path: string, body?: any) => {
        const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok(u)}` }, body: body ? JSON.stringify(body) : undefined });
        return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    const legacyCounts = async () => ({ loans: await db.loan.count(), installments: await db.installment.count(), requests: await db.loanRequest.count(), charges: await db.paymentCharge.count() });
    const before = await legacyCounts();
    const ok = (name: string) => console.log('OK  ', name);

    // 1. catálogo
    let r = await call(client, 'GET', '/services/catalog');
    assert.deepEqual(r.body.services.map((s: any) => s.code), ['CLT', 'AUTONOMO', 'GARANTIA', 'MOTO', 'LIMPA_NOME', 'FINANCIAMENTO_CELULAR']);
    assert.equal(r.body.services[5].available, false);
    ok('catálogo com 6 serviços, celular indisponível até aprovar oferta');

    // 2. oferta não liga sem jurídico
    r = await call(admin1, 'PUT', '/admin/phone-financing/settings', { monthlyInterestBps: 300, minDownPaymentBps: 1000, maxInstallments: 12, offerEnabled: true });
    assert.equal(r.status, 400); assert.equal(r.body.code, 'OFFER_NOT_READY');
    r = await call(admin1, 'PUT', '/admin/phone-financing/settings', { monthlyInterestBps: 300, minDownPaymentBps: 1000, maxInstallments: 12, manualPaymentSecondApprovalCents: 20000 });
    assert.equal(r.status, 200); assert.equal(r.body.offerEnabled, false);
    r = await call(admin1, 'PUT', '/admin/phone-financing/settings', { legalTemplateStatus: 'approved', offerEnabled: true });
    assert.equal(r.status, 200); assert.equal(r.body.offerEnabled, true);
    ok('oferta bloqueada sem revisão jurídica; liberada depois');

    // 3. estoque
    r = await call(admin1, 'POST', '/admin/phone-financing/products', { brand: 'Apple', model: 'iPhone 13' });
    const productId = r.body.product.id;
    r = await call(admin1, 'POST', `/admin/phone-financing/products/${productId}/skus`, { sku: 'IP13-128-PRT', storage: '128GB', color: 'Preto', condition: 'NEW', costCents: 300000, cashPriceCents: 400000 });
    const skuId = r.body.sku.id;
    r = await call(admin1, 'POST', '/admin/phone-financing/inventory', { skuId, serialNumber: 'F2LXK0TESTA1', imei: '356938035643809' });
    assert.equal(r.status, 201); assert.equal(r.body.unit.imeiMasked, '***********3809');
    const unitId = r.body.unit.id;
    r = await call(admin1, 'POST', '/admin/phone-financing/inventory', { skuId, serialNumber: 'F2LXK0TESTA1' });
    assert.equal(r.status, 409);
    r = await call(admin1, 'POST', '/admin/phone-financing/inventory/import', { csv: 'sku,serial,imei\nIP13-128-PRT,F2LXK0TESTB2,356938035643817\nNAOEXISTE,X1234567,', dryRun: true });
    assert.equal(r.body.valid, 1); assert.equal(r.body.errors.length, 1); assert.equal(r.body.created, 0);
    ok('estoque: serial duplicado recusado, IMEI mascarado, import com dry-run');

    // 4. vitrine e simulação (sem expor custo)
    r = await call(client, 'GET', '/phone-products');
    assert.equal(r.body.products[0].skus[0].availableUnits, 1);
    assert.equal(r.body.products[0].skus[0].costCents, undefined);
    r = await call(client, 'POST', '/phone-financing/simulate', { skuId, downPaymentCents: 40000, installments: 12 });
    assert.equal(r.status, 200); assert.equal(r.body.financedCents, 360000);
    ok('vitrine sem custo; simulação Price');

    // 5. proposta
    r = await call(client, 'POST', '/phone-financing/applications', { skuId, requestedInstallments: 12, requestedDownPaymentCents: 40000, lgpdConsent: true, termsVersion: 'phone-v0-draft', documents: [{ kind: 'ID_FRONT', url: 'https://r2.example/x.jpg' }] });
    assert.equal(r.status, 201); assert.match(r.body.application.protocol, /^CEL-\d{8}-/);
    const appId = r.body.application.id;
    r = await call(client, 'POST', '/phone-financing/applications', { skuId, lgpdConsent: true, termsVersion: 'v' });
    assert.equal(r.status, 409);
    ok('proposta criada com protocolo; segunda proposta aberta bloqueada');

    // 6. aprovação com máquina de estados
    r = await call(admin1, 'PATCH', `/admin/phone-financing/applications/${appId}/status`, { status: 'active' });
    assert.equal(r.status, 409);
    for (const status of ['under_review', 'approved']) assert.equal((await call(admin1, 'PATCH', `/admin/phone-financing/applications/${appId}/status`, { status })).status, 200);
    ok('máquina de estados recusa salto; fluxo normal aprovado');

    // 7. reserva concorrente: só uma ganha
    const [a, b] = await Promise.all([
        call(admin1, 'POST', `/admin/phone-financing/applications/${appId}/reserve`, { unitId }),
        call(admin2, 'POST', `/admin/phone-financing/applications/${appId}/reserve`, { unitId }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    ok('reserva simultânea do mesmo aparelho: uma vence, outra 409');

    // 8. venda + cronograma
    const firstDue = new Date(Date.now() + 30 * 864e5).toISOString();
    r = await call(admin1, 'POST', '/admin/phone-financing/sales', { applicationId: appId, unitId, downPaymentCents: 40000, installments: 3, firstDueDate: firstDue });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const saleId = r.body.sale.id;
    r = await call(admin1, 'GET', `/admin/phone-financing/sales/${saleId}`);
    const inst = r.body.sale.installments;
    assert.equal(inst.length, 4); assert.equal(inst[0].kind, 'DOWN_PAYMENT');
    ok('venda criada com entrada + 3 parcelas; aparelho SOLD');

    // 9. contrato bloqueado? (jurídico aprovado neste teste → gera)
    r = await call(admin1, 'POST', `/admin/phone-financing/sales/${saleId}/contract/generate`);
    assert.equal(r.status, 200);

    // 10. entrega exige entrada paga
    r = await call(admin1, 'POST', `/admin/phone-financing/sales/${saleId}/delivery`, { deliveredAt: new Date().toISOString(), receivedBy: 'Cliente Teste' });
    assert.equal(r.status, 400); assert.equal(r.body.code, 'DOWN_PAYMENT_PENDING');
    // baixa manual da entrada (acima do limite → 2ª conferência)
    r = await call(admin1, 'POST', `/admin/phone-financing/sales/${saleId}/manual-payment`, { installmentId: inst[0].id, amountCents: 40000, receiptUrl: 'https://r2.example/pix.jpg', note: 'pix' });
    assert.equal(r.body.result, 'AWAITING_SECOND_APPROVAL');
    const payId = r.body.payment.id;
    assert.equal((await call(admin1, 'POST', `/admin/phone-financing/payments/${payId}/second-approval`)).status, 400);
    r = await call(admin2, 'POST', `/admin/phone-financing/payments/${payId}/second-approval`);
    assert.equal(r.body.result, 'CONFIRMED');
    r = await call(admin1, 'POST', `/admin/phone-financing/sales/${saleId}/delivery`, { deliveredAt: new Date().toISOString(), receivedBy: 'Cliente Teste' });
    assert.equal(r.status, 200);
    ok('entrega só após entrada; baixa manual exige outro admin');

    // 11. visão do cliente
    r = await call(client, 'GET', '/phone-financing/my-contracts');
    assert.equal(r.body.sales.length, 1); assert.equal(r.body.sales[0].paidCents, 40000);
    assert.equal(r.body.sales[0].device.imeiMasked, '***********3809');
    ok('cliente vê contrato com saldo e IMEI mascarado');

    // 12. MDM: aparelho do cliente após transferência não aceita comando
    r = await call(admin1, 'POST', '/admin/mdm/devices', { unitId, enrollmentId: 'UDID-TESTE-0001' });
    assert.equal(r.status, 201);
    const deviceId = r.body.device.id;
    await db.appleMdmDevice.update({ where: { id: deviceId }, data: { supervised: true } });
    r = await call(admin1, 'POST', `/admin/mdm/devices/${deviceId}/commands`, { requestType: 'DeviceLock', purpose: 'cliente com parcela atrasada', idempotencyKey: 'idem-0001-xx' });
    assert.equal(r.status, 403); assert.equal(r.body.code, 'FORBIDDEN_PURPOSE');
    r = await call(admin1, 'POST', `/admin/phone-financing/sales/${saleId}/title-transfer`, { legalTitleTransferDate: new Date().toISOString() });
    assert.equal(r.status, 201);
    r = await call(admin1, 'GET', `/admin/mdm/devices/${deviceId}/capabilities`);
    assert.ok(r.body.commands.every((c: any) => !c.allowed));
    r = await call(admin1, 'POST', `/admin/mdm/devices/${deviceId}/commands`, { requestType: 'DeviceInformation', purpose: 'Inventário do estoque corporativo', idempotencyKey: 'idem-0002-xx' });
    assert.equal(r.status, 403);
    ok('MDM: propósito de cobrança recusado; após transferência nenhum comando');

    // 13. cliente comum não acessa admin nem MDM
    assert.equal((await call(client, 'GET', '/admin/phone-financing/dashboard')).status, 403);
    assert.equal((await call(client, 'GET', '/admin/mdm/status')).status, 403);
    ok('RBAC: cliente não acessa admin nem MDM');

    // 14. dashboard separado e tabelas de empréstimo intocadas
    r = await call(admin1, 'GET', '/admin/phone-financing/dashboard');
    assert.equal(r.body.sales.active, 1);
    assert.deepEqual(await legacyCounts(), before);
    ok('dashboard de celulares separado; loans/installments/loan_requests/payment_charges inalterados');

    server.close();
    await db.$disconnect();
    console.log('\nTODOS OS CENÁRIOS PASSARAM');
}

main().catch(err => { console.error('FALHOU:', err?.message || err); process.exit(1); });
