import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // 1. Criar ADMIN padrão
    const adminEmail = 'admin@tubarao.com';
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('admin123', 12);
        await prisma.user.create({
            data: {
                name: 'Administrador',
                email: adminEmail,
                password: hashedPassword,
                role: 'ADMIN',
                authId: null
            }
        });
        console.log('✅ Admin user created: admin@tubarao.com / admin123');
    } else {
        console.log('ℹ️ Admin already exists');
    }

    // 2. Criar Configurações Iniciais (Brand)
    const brand = await prisma.brandSetting.findFirst();
    if (!brand) {
        await prisma.brandSetting.create({
            data: {
                systemName: 'TUBARÃO EMPRÉSTIMO',
                companyName: 'Tubarão Financeira S.A.',
                primaryColor: '#FF0000',
                secondaryColor: '#D4AF37',
                backgroundColor: '#000000'
            }
        });
        console.log('✅ Brand settings created');
    }

    // 3. Criar Campanha Exemplo
    const campaign = await prisma.campaign.findFirst();
    if (!campaign) {
        await prisma.campaign.create({
            data: {
                title: 'Oferta de Boas Vindas',
                description: 'Faça seu primeiro empréstimo com taxa ZERO na primeira parcela!',
                startDate: new Date(),
                endDate: new Date('2026-12-31'),
                priority: 10,
                active: true,
                frequency: 'ONCE'
            }
        });
        console.log('✅ Example campaign created');
    }

    console.log('🌱 Seed finished!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
