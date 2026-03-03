import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------
// POST /api/funil/track
// Registra eventos do funil (STEP_VIEW, CLICK_YES, CLICK_NO,
// VIDEO_PLAY, VIDEO_COMPLETE) no banco de dados.
// Fire-and-forget: o cliente não espera resposta para continuar.
// ---------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, step, eventType, metadata } = body;

    if (!sessionId || !step || !eventType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Extrai UTMs do Referer (ou headers customizados)
    const referer   = req.headers.get('referer') ?? '';
    const userAgent = req.headers.get('user-agent') ?? '';
    const ip        = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                   ?? req.headers.get('x-real-ip')
                   ?? '';

    let utmSource   = '';
    let utmMedium   = '';
    let utmCampaign = '';
    let utmContent  = '';
    let utmTerm     = '';

    try {
      const url = new URL(referer);
      utmSource   = url.searchParams.get('utm_source')   ?? '';
      utmMedium   = url.searchParams.get('utm_medium')   ?? '';
      utmCampaign = url.searchParams.get('utm_campaign') ?? '';
      utmContent  = url.searchParams.get('utm_content')  ?? '';
      utmTerm     = url.searchParams.get('utm_term')     ?? '';
    } catch {
      // Referer inválido — ignora UTMs
    }

    // Upsert do lead (cria na primeira visita, atualiza nos eventos seguintes)
    const lead = await prisma.funnel_leads.upsert({
      where:  { session_id: sessionId },
      create: {
        session_id:   sessionId,
        current_step: step,
        utm_source:   utmSource   || null,
        utm_medium:   utmMedium   || null,
        utm_campaign: utmCampaign || null,
        utm_content:  utmContent  || null,
        utm_term:     utmTerm     || null,
        ip_address:   ip          || null,
        user_agent:   userAgent   || null,
      },
      update: {
        current_step: step,
      },
    });

    // Registra o evento
    const event = await prisma.funnel_events.create({
      data: {
        lead_id:    lead.id,
        session_id: sessionId,
        step,
        event_type: eventType,
        metadata:   metadata ?? undefined,
      },
    });

    return NextResponse.json({ leadId: lead.id, eventId: event.id }, { status: 201 });
  } catch (err) {
    console.error('[funil/track]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
