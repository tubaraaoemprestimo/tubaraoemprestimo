import { describe, it, expect } from 'vitest';
import { getServiceCatalog, buildServiceKnowledgeBlock, buildPhoneCustomerSummary } from '../phoneFinancing/serviceKnowledge';
import { getFlags } from '../phoneFinancing/flags';

const missingTables: any = {
    serviceCatalogEntry: { findMany: async () => { throw new Error('relation does not exist'); } },
    phoneFinancingSettings: { findUnique: async () => { throw new Error('x'); } },
};
const ready = (offerEnabled: boolean, skus: any[] = []) => ({
    serviceCatalogEntry: { findMany: async () => [] },
    phoneFinancingSettings: { findUnique: async () => ({ offerEnabled }) },
    phoneSku: { findMany: async () => skus },
});
const allOn = getFlags({ PHONE_FINANCING_ENABLED: 'true', PHONE_FINANCING_WHATSAPP_ENABLED: 'true' });

describe('catálogo de serviços', () => {
    it('6 serviços na ordem oficial, mesmo sem a migração aplicada', async () => {
        const s = await getServiceCatalog(missingTables);
        expect(s.map(x => x.code)).toEqual(['CLT', 'AUTONOMO', 'GARANTIA', 'MOTO', 'LIMPA_NOME', 'FINANCIAMENTO_CELULAR']);
        expect(s.find(x => x.code === 'FINANCIAMENTO_CELULAR')!.available).toBe(false);
        expect(s.filter(x => x.code !== 'FINANCIAMENTO_CELULAR').every(x => x.available)).toBe(true);
    });
    it('celular só fica disponível com oferta aprovada E flag ligada', async () => {
        expect((await getServiceCatalog(ready(true), 'client', getFlags({}))).find(x => x.isNew)!.available).toBe(false);
        expect((await getServiceCatalog(ready(false), 'client', allOn)).find(x => x.isNew)!.available).toBe(false);
        expect((await getServiceCatalog(ready(true), 'client', allOn)).find(x => x.isNew)!.available).toBe(true);
    });
});

describe('conhecimento para a IA', () => {
    it('lista os 6 serviços, mantém Investidor e não inventa produto', async () => {
        const block = await buildServiceKnowledgeBlock(missingTables, 'https://www.tubaraoemprestimo.com.br/');
        for (const l of ['Empréstimo CLT', 'Capital de giro', 'Empréstimo com garantia', 'Financiamento de moto', 'Limpar nome', 'Financiamento de Celulares']) expect(block).toContain(l);
        expect(block).toContain('Investidor');
        expect(block).toContain('em breve');
        expect(block).toMatch(/Nunca fale de bloqueio/);
        expect(block).not.toMatch(/R\$ \d/);
    });
    it('com oferta aberta e sem estoque: orienta cotação, com link real', async () => {
        const block = await buildServiceKnowledgeBlock(ready(true), 'https://app.x', allOn);
        expect(block).toContain('cotação');
        expect(block).toContain('https://app.x/#/client/financiamento-celulares/solicitar');
    });
    it('com estoque: só os modelos cadastrados aparecem', async () => {
        const block = await buildServiceKnowledgeBlock(ready(true, [{ cashPriceCents: 399900, storage: '128GB', color: 'Preto', product: { brand: 'Apple', model: 'iPhone 13' } }]), 'https://app.x', allOn);
        expect(block).toContain('Apple iPhone 13 128GB Preto (à vista R$ 3999.00)');
    });
    it('resumo do cliente separa celular e não expõe identificadores', async () => {
        const prisma: any = {
            phoneFinancingApplication: { findMany: async () => [{ protocol: 'CEL-1', status: 'under_review' }] },
            phoneSale: { findMany: async () => [{ status: 'active', installments: [{ amountCents: 15000, paidCents: 0, dueDate: new Date('2026-12-10T12:00:00Z') }], unit: { serialNumber: 'SERIAL123', imei: '356938035643809', sku: { product: { model: 'iPhone 13' } } } }] },
        };
        const s = await buildPhoneCustomerSummary(prisma, 'c1');
        expect(s).toContain('contrato separado dos empréstimos');
        expect(s).toContain('R$ 150.00');
        expect(s).not.toContain('356938035643809');
        expect(s).not.toContain('SERIAL123');
    });
});
