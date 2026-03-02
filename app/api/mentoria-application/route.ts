import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Listar todas as aplicações (para admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = status ? { status } : {};

    const [applications, total] = await Promise.all([
      prisma.mentoriaApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.mentoriaApplication.count({ where }),
    ]);

    return NextResponse.json({
      applications,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Erro ao buscar aplicações:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar aplicações.' },
      { status: 500 }
    );
  }
}

// POST - Criar nova aplicação
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { nome, whatsapp, cidade, capitalDisponivel, experiencia, objetivo } = body;

    // Validação server-side
    if (!nome || !whatsapp || !cidade || !capitalDisponivel || !experiencia || !objetivo) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios.' },
        { status: 400 }
      );
    }

    // Validar WhatsApp (mínimo 10 dígitos)
    const whatsappDigits = whatsapp.replace(/\D/g, '');
    if (whatsappDigits.length < 10) {
      return NextResponse.json(
        { error: 'WhatsApp inválido. Digite um número completo.' },
        { status: 400 }
      );
    }

    // Validar objetivo (mínimo 20 caracteres)
    if (objetivo.length < 20) {
      return NextResponse.json(
        { error: 'Por favor, descreva seu objetivo com mais detalhes (mínimo 20 caracteres).' },
        { status: 400 }
      );
    }

    // Verificar se já existe aplicação com mesmo WhatsApp nos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const existingApplication = await prisma.mentoriaApplication.findFirst({
      where: {
        whatsapp: whatsappDigits,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    if (existingApplication) {
      return NextResponse.json(
        {
          error: 'Você já enviou uma aplicação recentemente. Nossa equipe entrará em contato em breve.',
          existingApplicationId: existingApplication.id,
        },
        { status: 409 }
      );
    }

    // Salvar no banco de dados
    const application = await prisma.mentoriaApplication.create({
      data: {
        nome,
        whatsapp: whatsappDigits,
        cidade,
        capitalDisponivel,
        experiencia,
        objetivo,
        status: 'PENDENTE',
      },
    });

    // TODO: Enviar notificação para o admin (email, WhatsApp, etc.)
    // Exemplo de integração com Evolution API:
    // await fetch('https://seu-evolution-api.com/message/sendText', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'apikey': process.env.EVOLUTION_API_KEY },
    //   body: JSON.stringify({
    //     number: process.env.ADMIN_WHATSAPP,
    //     text: `🎯 Nova Aplicação - Mentoria Presencial\n\n` +
    //           `Nome: ${nome}\n` +
    //           `WhatsApp: ${whatsapp}\n` +
    //           `Cidade: ${cidade}\n` +
    //           `Capital: ${capitalDisponivel}\n` +
    //           `Experiência: ${experiencia}\n\n` +
    //           `Objetivo: ${objetivo}`
    //   })
    // });

    // TODO: Adicionar ao CRM ou sistema de gestão de leads

    return NextResponse.json(
      {
        success: true,
        message: 'Aplicação enviada com sucesso!',
        applicationId: application.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao processar aplicação:', error);
    return NextResponse.json(
      { error: 'Erro ao processar aplicação. Tente novamente.' },
      { status: 500 }
    );
  }
}
