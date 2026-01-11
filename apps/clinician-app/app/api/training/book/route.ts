//apps/clinician-app/app/api/training/book/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { sendEmail, sendSms } from '@/src/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function safeParse(s?: string | null) {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function envInt(name: string, fallback: number) {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function paymentProvider(): 'mock' | 'stripe' | 'paystack' | 'ozow' | 'unknown' {
  const v = (process.env.TRAINING_PAYMENT_PROVIDER || '').toLowerCase();
  if (v === 'stripe' || v === 'paystack' || v === 'ozow' || v === 'mock') return v;
  return 'mock';
}

const STARTER_KIT = [
  'DueCare 6-in-1 Health Monitor (IoMT)',
  'NexRing (IoMT)',
  'Digital Stethoscope (IoMT)',
  'HD Otoscope (IoMT)',
  'Clinician Handbook',
  'Consumables pack',
  'Ambulant+ formal shirt (Black)',
  'Ambulant+ formal shirt (White)',
  'Ambulant+ Mug',
  'Ambulant+ Thermo Bottle',
  'Smart ID + card holder + lanyard',
];

function fmt(dtIso: string) {
  const d = new Date(dtIso);
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return json({ ok: false, error: 'invalid_json' }, 400);

    const clinicianId = String(body.clinicianId || '').trim();
    const startAt = String(body.startAt || '').trim();
    const endAt = String(body.endAt || '').trim();
    const mode = body.mode === 'in_person' ? 'in_person' : 'virtual';

    if (!clinicianId) return json({ ok: false, error: 'clinicianId_required' }, 400);
    if (!startAt || !endAt) return json({ ok: false, error: 'startAt_endAt_required' }, 400);

    const clinician = await prisma.clinicianProfile
      .findFirst({
        where: { OR: [{ id: clinicianId }, { userId: clinicianId }] },
        include: { metadata: true },
      })
      .catch(() => null);

    if (!clinician) return json({ ok: false, error: 'clinician_not_found' }, 404);

    const feeCents = envInt('TRAINING_FEE_CENTS', envInt('NEXT_PUBLIC_TRAINING_FEE_CENTS', 150000));
    const currency = process.env.TRAINING_CURRENCY || 'ZAR';
    const provider = paymentProvider();

    // In this implementation: if provider isn’t configured, we treat as "mock paid".
    // Later you can swap this for Stripe/Paystack/Ozow checkout creation + webhook confirmation.
    const paid = provider === 'mock' ? true : true; // keep true for now; wire real later

    const joinUrl =
      mode === 'virtual'
        ? `${process.env.NEXT_PUBLIC_BASE_URL || ''}/clinician/training/join?clinicianId=${encodeURIComponent(
            clinician.id,
          )}&startAt=${encodeURIComponent(startAt)}`
        : null;

    // Try to write to "real" tables if present; if not, fallback to metadata.rawProfileJson.
    const db: any = prisma;

    let onboarding: any = null;
    onboarding = await db.clinicianOnboarding?.findFirst?.({ where: { clinicianId: clinician.id } }).catch(() => null);

    if (!onboarding) {
      onboarding = await db.clinicianOnboarding
        ?.create?.({
          data: {
            clinicianId: clinician.id,
            stage: 'applied',
            notes: null,
          },
        })
        .catch(() => null);
    }

    // Create training slot record if possible
    let trainingSlot: any = null;
    trainingSlot = await db.clinicianTrainingSlot
      ?.create?.({
        data: {
          clinicianId: clinician.id,
          onboardingId: onboarding?.id ?? undefined,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          mode,
          status: 'scheduled',
          joinUrl,
          feeCents,
          currency,
          paid,
          paymentStatus: paid ? 'paid' : 'pending',
          paidAt: paid ? new Date() : null,
        },
      })
      .catch(() => null);

    // Ensure onboarding stage reflects scheduled
    if (onboarding?.id) {
      await db.clinicianOnboarding
        ?.update?.({
          where: { id: onboarding.id },
          data: { stage: 'training_scheduled' },
        })
        .catch(() => null);
    }

    // Create dispatch pending (if model exists)
    let dispatch: any = null;
    if (paid) {
      dispatch = await db.clinicianDispatch
        ?.create?.({
          data: {
            clinicianId: clinician.id,
            onboardingId: onboarding?.id ?? undefined,
            status: 'pending',
          },
        })
        .catch(() => null);
    }

    // Metadata fallback/upsert (always done, so you always have a single source of truth)
    const raw = safeParse((clinician as any)?.metadata?.rawProfileJson);
    const merged = {
      ...raw,
      onboarding: {
        ...(raw.onboarding || {}),
        stage: 'training_scheduled',
      },
      training: {
        ...(raw.training || {}),
        status: 'scheduled',
        startAt,
        endAt,
        mode,
        joinUrl,
        paid,
        currency,
        feeCents,
      },
      dispatch: paid
        ? {
            ...(raw.dispatch || {}),
            status: (dispatch?.status as string) || 'pending',
            courierName: dispatch?.courierName ?? null,
            trackingCode: dispatch?.trackingCode ?? null,
            trackingUrl: dispatch?.trackingUrl ?? null,
            shippedAt: dispatch?.shippedAt ? new Date(dispatch.shippedAt).toISOString() : null,
            deliveredAt: dispatch?.deliveredAt ? new Date(dispatch.deliveredAt).toISOString() : null,
          }
        : (raw.dispatch || null),
    };

    await prisma.clinicianProfile
      .update({
        where: { id: clinician.id },
        data: {
          metadata: {
            upsert: {
              create: { rawProfileJson: JSON.stringify(merged) },
              update: { rawProfileJson: JSON.stringify(merged) },
            },
          },
        },
      })
      .catch(() => null);

    // Notify clinician (booking confirmation)
    const email = (merged?.email as string) || (clinician as any).userId || null;
    const phone = (merged?.phone as string) || null;
    const name = (clinician as any).displayName || 'Clinician';

    const when = `${fmt(startAt)} → ${new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(endAt),
    )}`;

    const subject = 'Ambulant+ Training Booked — Next steps inside';
    const kitListHtml = `<ul>${STARTER_KIT.map((x) => `<li>${x}</li>`).join('')}</ul>`;
    const html = `
      <p>Hi ${name},</p>
      <p>Your <strong>mandatory Ambulant+ training</strong> has been booked.</p>
      <p><strong>When:</strong> ${when}<br/>
         <strong>Mode:</strong> ${mode === 'in_person' ? 'In person' : 'Virtual'}<br/>
         ${joinUrl ? `<strong>Join link:</strong> <a href="${joinUrl}">${joinUrl}</a><br/>` : ''}
         <strong>Payment:</strong> ${paid ? 'Confirmed' : 'Pending'}
      </p>
      <hr/>
      <p><strong>Starter kit contents (prepared after payment):</strong></p>
      ${kitListHtml}
      <p>
        After payment, your dispatch is created as <strong>pending</strong>.
        An Admin will assign courier + tracking, and you will automatically receive email/SMS with tracking details.
      </p>
      <p><em>Reminder:</em> you won’t be visible to patients until training is completed and certified by Admin.</p>
      <p>— Ambulant+ Team</p>
    `;

    if (email) sendEmail(email, subject, html).catch(console.error);
    if (phone) {
      const sms = `Ambulant+ Training booked: ${when} (${mode === 'in_person' ? 'In person' : 'Virtual'}). ${
        joinUrl ? `Join: ${joinUrl}. ` : ''
      }Starter kit dispatch starts after payment; tracking will be sent once assigned.`;
      sendSms(phone, sms).catch(console.error);
    }

    return json({
      ok: true,
      clinicianId: clinician.id,
      onboardingStage: 'training_scheduled',
      training: {
        status: 'scheduled',
        startAt,
        endAt,
        mode,
        joinUrl,
        paid,
        currency,
        feeCents,
      },
      dispatch: paid ? { status: dispatch?.status || 'pending' } : null,
      provider,
    });
  } catch (e: any) {
    console.error('POST /api/training/book error', e);
    return json({ ok: false, error: e?.message || 'server_error' }, 500);
  }
}
