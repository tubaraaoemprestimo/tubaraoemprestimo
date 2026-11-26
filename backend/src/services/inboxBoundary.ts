import { createHash, timingSafeEqual } from 'node:crypto';

// Cabeçalho dedicado, configurado no webhook da instância, não a chave administrativa da API.
export function trustedWebhook(instance: unknown, expected: string, header: unknown, secret: string | undefined) {
    if (!expected || instance !== expected || !secret || secret.length < 32 || typeof header !== 'string' || header.length > 512) return false;
    const digest = (s: string) => createHash('sha256').update(s).digest();
    return timingSafeEqual(digest(header), digest(secret));
}

// Convites, links de recuperação e credenciais nunca devem reaparecer na caixa de atendimento.
export function inboxText(input: string): string {
    return input.replace(/([?&#](?:c|token|access_token|refresh_token|reset_token)=)[^&#\s)]+/gi, '$1[oculto]')
        .replace(/((?:senha|password|apikey)\s*:\s*)[^\r\n]+/gi, '$1[oculto]');
}
