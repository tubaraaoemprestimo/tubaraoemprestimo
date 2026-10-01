import { describe, it, expect, vi } from 'vitest';

// Rota importa prisma/email/whatsapp no topo; só a função pura interessa aqui.
vi.mock('../prisma', () => ({ prisma: {} }));
vi.mock('../email', () => ({ emailService: {} }));
vi.mock('../whatsapp', () => ({ sendWhatsAppMessage: vi.fn(), sendWhatsAppImage: vi.fn() }));
vi.mock('../../routes/push', () => ({ sendPushToUser: vi.fn(), sendPushToRole: vi.fn() }));

import { validateRequestByProfile } from '../../routes/loanRequests';

const u = 'https://pub.r2.dev/x';
const refs = { contactTrust1Name: 'A', contactTrust1: '11999999999', contactTrust2Name: 'B', contactTrust2: '11888888888' };
const docs = { selfie: u, idCardFront: u, idCardBack: u, proofAddress: u, signature: u, videoSelfie: u, videoHouse: u };

// Payload que cada modalidade realmente envia pelo wizard (Wizard.tsx)
describe('validateRequestByProfile — payload real de cada modalidade', () => {
    it('CLT completo passa; sem CTPS recusa', () => {
        expect(validateRequestByProfile({ profileType: 'CLT', ...refs, ...docs, workCard: u })).toBeNull();
        expect(validateRequestByProfile({ profileType: 'CLT', ...refs, ...docs })).toMatch(/Carteira/);
    });
    it('AUTONOMO completo passa', () => {
        expect(validateRequestByProfile({ profileType: 'AUTONOMO', ...refs, ...docs })).toBeNull();
    });
    it('MOTO passa sem vídeos', () => {
        const { videoSelfie, videoHouse, ...semVideo } = docs;
        expect(validateRequestByProfile({ profileType: 'MOTO', ...refs, ...semVideo })).toBeNull();
    });
    it('GARANTIA exige itens com fotos', () => {
        const item = { type: 'carro', description: 'Gol', estimatedValue: '20000', photos: [u] };
        expect(validateRequestByProfile({ profileType: 'GARANTIA', ...refs, ...docs, collateralItems: [item] })).toBeNull();
        expect(validateRequestByProfile({ profileType: 'GARANTIA', ...refs, ...docs, collateralItems: [{ ...item, photos: [] }] })).toMatch(/Fotos/);
    });
    it('LIMPA_NOME sem referências passa (wizard não pede); sem assinatura recusa', () => {
        expect(validateRequestByProfile({ profileType: 'LIMPA_NOME', signature: u })).toBeNull();
        expect(validateRequestByProfile({ profileType: 'LIMPA_NOME' })).toMatch(/Assinatura/);
    });
    it('INVESTIDOR sem referências e sem CPF passa', () => {
        expect(validateRequestByProfile({ profileType: 'INVESTIDOR', cpf: '', signatureUrl: u })).toBeNull();
    });
    it('empréstimo sem referências continua recusado', () => {
        expect(validateRequestByProfile({ profileType: 'CLT', ...docs, workCard: u })).toMatch(/Referência 1/);
    });
});
