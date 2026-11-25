import { describe, it, expect } from 'vitest';
import { normalizePhoneBR, isValidCpf } from '../legacyClients';

describe('clientes antigos — validações', () => {
    it('normaliza telefone BR para 55+DDD+número', () => {
        expect(normalizePhoneBR('(11) 98765-4321')).toBe('5511987654321');
        expect(normalizePhoneBR('+55 11 98765-4321')).toBe('5511987654321');
        expect(normalizePhoneBR('11 3333-4444')).toBe('551133334444');
        expect(normalizePhoneBR('005511987654321')).toBe('5511987654321');
        expect(normalizePhoneBR('98765-4321')).toBeNull();
        expect(normalizePhoneBR('')).toBeNull();
        expect(normalizePhoneBR(undefined)).toBeNull();
    });

    it('valida CPF pelos dígitos verificadores', () => {
        expect(isValidCpf('529.982.247-25')).toBe(true);
        expect(isValidCpf('52998224725')).toBe(true);
        expect(isValidCpf('52998224724')).toBe(false);
        expect(isValidCpf('111.111.111-11')).toBe(false);
        expect(isValidCpf('123')).toBe(false);
    });
});
