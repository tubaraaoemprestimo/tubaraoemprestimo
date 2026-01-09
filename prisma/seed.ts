import { PrismaClient, LoanStatus, InstallmentStatus, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding ...')

  // 1. Create Admin
  const admin = await prisma.user.upsert({
    where: { cpf: '000.000.000-00' },
    update: {},
    create: {
      name: 'Tubarão Admin',
      cpf: '000.000.000-00',
      email: 'admin@tubarao.com',
      password: 'hashed_admin_password_123', // In production, use bcrypt
      role: UserRole.ADMIN,
    },
  })

  // 2. Create Client
  const client = await prisma.user.upsert({
    where: { cpf: '123.456.789-00' },
    update: {},
    create: {
      name: 'Marcos Vinícius',
      cpf: '123.456.789-00',
      email: 'marcos@client.com',
      phone: '5511999999999',
      password: 'hashed_client_password_123',
      role: UserRole.CLIENT,
      documentFrontUrl: 'https://placehold.co/400x300/111/FFF?text=RG+Frente',
      documentBackUrl: 'https://placehold.co/400x300/111/FFF?text=RG+Verso',
      selfieUrl: 'https://placehold.co/300x300/111/FFF?text=Selfie',
      wallet: {
        create: {
          balance: 0.00
        }
      }
    },
  })

  // 3. Create an Active Loan for the Client
  const loan = await prisma.loan.create({
    data: {
      userId: client.id,
      amountRequested: 4000.00,
      totalAmountWithInterest: 5400.00,
      installmentsCount: 12,
      interestRate: 5.5,
      status: LoanStatus.APPROVED,
      startDate: new Date(),
      installments: {
        create: [
          {
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // +30 days
            amount: 450.00,
            status: InstallmentStatus.OPEN,
            pixCode: '00020126330014BR.GOV.BCB.PIX0111123456789005204000053039865802BR5913Tubarao Loans6008Sao Paulo62070503***6304ABCD'
          },
          {
            dueDate: new Date(new Date().setDate(new Date().getDate() + 60)), // +60 days
            amount: 450.00,
            status: InstallmentStatus.OPEN
          }
        ]
      }
    }
  })

  console.log({ admin, client, loan })
  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    ;(process as any).exit(1)
  })