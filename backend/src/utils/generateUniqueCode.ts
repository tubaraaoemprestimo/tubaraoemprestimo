import { prisma } from '../services/prisma';
import { randomBytes } from 'crypto';

/**
 * Gera um código único para diferentes tipos de entidades
 * @param entityType Tipo de entidade (ex: 'partnerInvite', 'referral', etc.)
 * @param field Campo a ser verificado (ex: 'inviteCode', 'referralCode', etc.)
 * @param length Comprimento do código (padrão: 8)
 * @returns Código único
 */
export async function generateUniqueCode(
  entityType: string,
  field: string,
  length: number = 8
): Promise<string> {
  let code: string;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 10;

  while (exists && attempts < maxAttempts) {
    // Gera um código aleatório
    code = randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .substring(0, length)
      .toUpperCase();

    // Verifica se o código já existe
    let existsResult = false;

    switch (entityType) {
      case 'partnerInvite':
        if (field === 'inviteCode') {
          const existingInvite = await prisma.partnerInvite.findUnique({
            where: { inviteCode: code }
          });
          existsResult = !!existingInvite;
        }
        break;
      case 'referral':
        if (field === 'referralCode') {
          const existingReferral = await prisma.customer.findUnique({
            where: { referralCode: code }
          });
          existsResult = !!existingReferral;
        }
        break;
      default:
        // Para outros tipos de entidade que não precisamos verificar unidade
        existsResult = false;
        break;
    }

    exists = existsResult;
    attempts++;
  }

  if (exists) {
    // Se ainda existir após várias tentativas, adiciona timestamp
    const timestamp = Date.now().toString(36).substring(0, 4);
    const randomPart = randomBytes(Math.ceil((length - 4) / 2))
      .toString('hex')
      .substring(0, length - 4)
      .toUpperCase();
    return (randomPart + timestamp).substring(0, length);
  }

  return code;
}