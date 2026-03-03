import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------
// POST /api/funil/purchase
// Registra uma compra/clique de compra no funil.
// Chamado antes de redirecionar para o gateway.
// ---------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, step, productName, amount, gatewayRef } = body;

    if (!sessionId || !step || !productName || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Garante que o lead existe (upsert seguro)
    const lead = await prisma.funnel_leads.upsert({
      where:  { session_id: sessionId },
      create: { session_id: sessionId, current_step: step },
      update: { current_step: step },
    });

    // Registra a compra
    const purchase = await prisma.funnel_purchases.create({
      data: {
        lead_id:      lead.id,
        session_id:   sessionId,
        step,
        product_name: productName,
        amount,
        gateway_ref:  gatewayRef ?? null,
      },
    });

    // Registra o evento de clique em "Sim / Comprar"
    await prisma.funnel_events.create({
      data: {
        lead_id:    lead.id,
        session_id: sessionId,
        step,
        event_type: 'CLICK_YES',
        metadata:   { productName, amount },
      },
    });

    return NextResponse.json({ purchaseId: purchase.id }, { status: 201 });
  } catch (err) {
    console.error('[funil/purchase]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
