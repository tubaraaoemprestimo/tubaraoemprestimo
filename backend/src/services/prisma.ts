import { PrismaClient } from '@prisma/client';

// NOTE: schema legado usa nomes snake_case/plural no banco.
// Para manter compatibilidade de build com código camelCase existente,
// tipamos a instância como `any` temporariamente.
const globalForPrisma = globalThis as unknown as {
    prisma: any;
};

export const prisma: any = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
