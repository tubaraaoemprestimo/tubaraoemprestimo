import { describe, it, expect, beforeEach, vi } from 'vitest';
import { alertFromMessage } from '../waAlert';

const ADMIN = '5511915712203';
const NOW = 1_800_000_000_000;

describe('Aviso ao admin pelo número de botões', () => {
    let send: any;
    beforeEach(() => { process.env.WA_BOT_ALERT_PHONE = ADMIN; send = vi.fn(async () => ({ messageId: 'M1' })); });

    it('avisa: atendente, carteirinha, atestado e Pix (texto, legenda e botões)', async () => {
        await alertFromMessage({ kind: 'text', text: 'Quero falar com um atendente' }, '5511900000001', send, NOW);
        await alertFromMessage({ kind: 'text', text: 'mandei a CARTEIRINHA' }, '5511900000002', send, NOW);
        await alertFromMessage({ kind: 'media', media: 'image', caption: 'segue o atestado médico' }, '5511900000003', send, NOW);
        await alertFromMessage({ kind: 'action', id: 'pay:key' }, '5511900000004', send, NOW);
        await alertFromMessage({ kind: 'action', id: 'help:human' }, '5511900000005', send, NOW);
        await alertFromMessage({ kind: 'text', text: 'me passa o pix' }, '5511900000006', send, NOW);
        expect(send).toHaveBeenCalledTimes(6);
        expect(send.mock.calls.every((c: any) => c[0] === ADMIN)).toBe(true);
        expect(send.mock.calls.map((c: any) => c[1].text.split('\n')[1])).toEqual([
            'Pedido de atendimento humano', 'Menção a carteirinha', 'Menção a atestado',
            'Pedido ou menção a Pix', 'Pedido de atendimento humano', 'Pedido ou menção a Pix',
        ]);
    });

    it('não vaza conteúdo nem o número inteiro do cliente', async () => {
        await alertFromMessage({ kind: 'text', text: 'atestado de CID F32, chave pix 123.456.789-00' }, '5511900001234', send, NOW);
        const text = send.mock.calls[0][1].text as string;
        expect(text).toContain('final 1234');
        expect(text).not.toMatch(/F32|123\.456|5511900001234/);
    });

    it('não repete o mesmo motivo do mesmo cliente por 30 min; falha de envio libera nova tentativa', async () => {
        const p = '5511900000099';
        await alertFromMessage({ kind: 'text', text: 'pix?' }, p, send, NOW);
        await alertFromMessage({ kind: 'text', text: 'pix??' }, p, send, NOW + 60_000);
        expect(send).toHaveBeenCalledTimes(1);
        await alertFromMessage({ kind: 'text', text: 'pix' }, p, send, NOW + 31 * 60_000);
        expect(send).toHaveBeenCalledTimes(2);
        const broken = vi.fn(async () => { throw new Error('off'); });
        await alertFromMessage({ kind: 'text', text: 'atestado' }, p, broken, NOW);
        await alertFromMessage({ kind: 'text', text: 'atestado' }, p, send, NOW + 1000);
        expect(send).toHaveBeenCalledTimes(3);
    });

    it('ignora mensagem comum, o próprio admin e destino não configurado', async () => {
        await alertFromMessage({ kind: 'text', text: 'bom dia, quero um empréstimo' }, '5511900000100', send, NOW);
        await alertFromMessage({ kind: 'text', text: 'pix' }, ADMIN, send, NOW);
        process.env.WA_BOT_ALERT_PHONE = '';
        await alertFromMessage({ kind: 'text', text: 'pix' }, '5511900000101', send, NOW);
        expect(send).not.toHaveBeenCalled();
    });
});
