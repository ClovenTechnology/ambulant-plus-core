import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CodeRow = {
  email: string;
  code: string;
  name: string;
  specialty?: string;
};

const amountCents = 795000; // R7,950 = 30% of R26,500
const currency = 'ZAR';

const clinicianCodes: CodeRow[] = [
  { email: 'dmhango17@gmail.com', code: 'CLN-DMH-7K4Q', name: 'Dr Dmhango' },
  { email: 'siyasamkela@gmail.com', code: 'CLN-SIY-9P2M', name: 'Dr Siyasamkela' },
  { email: 'drmposi@gmail.com', code: 'CLN-MPO-6R8X', name: 'Dr Mposi' },
  { email: 'cvanlooy@gmail.com', code: 'CLN-VAN-3N7T', name: 'Dr Van Looy' },
  { email: 'phelitido77@gmail.com', code: 'CLN-PHE-8C5Z', name: 'Dr Phelitido' },
  { email: 'kirondesinomtha@gmail.com', code: 'CLN-KIR-4L9A', name: 'Dr Kironde Sinomtha' },
  { email: 'pswasa@gmail.com', code: 'CLN-SWA-2D6V', name: 'Dr Pswasa' },
  { email: 'mojokwana@icloud.com', code: 'CLN-MOJ-5H3B', name: 'Dr Mojokwana' },
  { email: 'nazia@cloventechnology.com', code: 'CLN-NAZ-9W2E', name: 'Dr Totoline', specialty: 'Oncology' },
  { email: 'duecare@cloventechnology.com', code: 'CLN-ZUM-4Q8N', name: 'Dr Zuma Nhleko', specialty: 'General Practice' },
];

const cohortSlots = [
  {
    id: 'clinician-training-cohort-virtual-20260615-1830',
    startsAt: new Date('2026-06-15T16:30:00.000Z'),
    endsAt: new Date('2026-06-15T18:30:00.000Z'),
    capacity: 20,
    mode: 'virtual',
    trainerName: 'Virtual Cohort 1: 2026-06-15 to 2026-06-19, Monday-Friday 18:30-20:30',
  },
  {
    id: 'clinician-training-cohort-virtual-20260622-1830',
    startsAt: new Date('2026-06-22T16:30:00.000Z'),
    endsAt: new Date('2026-06-22T18:30:00.000Z'),
    capacity: 20,
    mode: 'virtual',
    trainerName: 'Virtual Cohort 2: 2026-06-22 to 2026-06-26, Monday-Friday 18:30-20:30',
  },
  {
    id: 'clinician-training-cohort-virtual-20260629-1830',
    startsAt: new Date('2026-06-29T16:30:00.000Z'),
    endsAt: new Date('2026-06-29T18:30:00.000Z'),
    capacity: 20,
    mode: 'virtual',
    trainerName: 'Virtual Cohort 3: 2026-06-29 to 2026-07-03, Monday-Friday 18:30-20:30',
  },
  {
    id: 'clinician-training-cohort-virtual-20260706-1830',
    startsAt: new Date('2026-07-06T16:30:00.000Z'),
    endsAt: new Date('2026-07-06T18:30:00.000Z'),
    capacity: 20,
    mode: 'virtual',
    trainerName: 'Virtual Cohort 4: 2026-07-06 to 2026-07-10, Monday-Friday 18:30-20:30',
  },
  {
    id: 'clinician-training-cohort-virtual-20260713-1830',
    startsAt: new Date('2026-07-13T16:30:00.000Z'),
    endsAt: new Date('2026-07-13T18:30:00.000Z'),
    capacity: 20,
    mode: 'virtual',
    trainerName: 'Virtual Cohort 5: 2026-07-13 to 2026-07-17, Monday-Friday 18:30-20:30',
  },
  {
    id: 'clinician-training-cohort-in-person-20260617-1400',
    startsAt: new Date('2026-06-17T12:00:00.000Z'),
    endsAt: new Date('2026-06-17T14:00:00.000Z'),
    capacity: 10,
    mode: 'in_person',
    trainerName: 'In-person Cohort: 2026-06-17, 14:00-16:00',
  },
];

function json(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function normaliseEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normaliseCode(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function codeHint(code: string) {
  return normaliseCode(code).slice(-4);
}

function hashCode(code: string) {
  const salt =
    process.env.CLINICIAN_PAYMENT_AUTH_CODE_SALT ||
    process.env.NEXTAUTH_SECRET ||
    'ambulant-local-dev-salt';

  return crypto
    .createHash('sha256')
    .update(`${salt}:${normaliseCode(code)}`)
    .digest('hex');
}

function expiresAt() {
  return new Date('2026-12-31T21:59:59.000Z');
}

function timingSafeEqualText(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function assertSeedKey(req: NextRequest, body: any) {
  const expected =
    process.env.CLINICIAN_OPS_SEED_KEY ||
    process.env.ADMIN_API_KEY ||
    process.env.AUTH_API_KEY ||
    '';

  if (!expected) {
    return { ok: false as const, status: 500, error: 'seed_key_not_configured' };
  }

  const supplied =
    req.headers.get('x-seed-key') ||
    req.headers.get('x-admin-key') ||
    body?.seedKey ||
    '';

  if (!supplied || !timingSafeEqualText(String(supplied), String(expected))) {
    return { ok: false as const, status: 401, error: 'unauthorized' };
  }

  return { ok: true as const };
}

async function seedSlots(db: any, apply: boolean) {
  const results: any[] = [];

  for (const slot of cohortSlots) {
    if (apply) {
      await db.clinicianTrainingSlot.upsert({
        where: { id: slot.id },
        update: {
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          capacity: slot.capacity,
          mode: slot.mode,
          trainerName: slot.trainerName,
        },
        create: {
          ...slot,
          usedCount: 0,
          meetingUrl: null,
        },
      });
    }

    results.push({
      id: slot.id,
      mode: slot.mode,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      capacity: slot.capacity,
      trainerName: slot.trainerName,
      action: apply ? 'upserted' : 'dry_run',
    });
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const auth = assertSeedKey(req, body);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

    const apply = body?.apply === true;
    const includeSlots = body?.seedSlots !== false;
    const db: any = prisma;

    const slotResults = includeSlots ? await seedSlots(db, apply) : [];

    const results: any[] = [];
    const missing: any[] = [];
    const skipped: any[] = [];

    for (const row of clinicianCodes) {
      const email = normaliseEmail(row.email);
      const code = normaliseCode(row.code);
      const hash = hashCode(code);
      const hint = codeHint(code);

      const clinician = await db.clinicianProfile.findFirst({
        where: {
          OR: [{ email }, { userId: email }],
        },
      });

      if (!clinician) {
        missing.push({ email, code, reason: 'clinician_profile_not_found' });
        continue;
      }

      const existingByHash = await db.clinicianOnboardingPayment.findUnique({
        where: { authorisationCodeHash: hash },
      });

      if (existingByHash?.authorisationUsedAt && body?.force !== true) {
        skipped.push({
          email,
          clinicianId: clinician.id,
          codeHint: hint,
          reason: 'code_already_used',
          paymentId: existingByHash.id,
        });
        continue;
      }

      let onboardingId: string | null = null;

      if (apply) {
        const onboarding = await db.clinicianOnboarding.upsert({
          where: { clinicianId: clinician.id },
          update: {
            paymentPlan: '30_percent_downpayment',
            trainingNotes: `30% downpayment confirmed manually. Authorisation code issued. ${new Date().toISOString()}`,
          },
          create: {
            clinicianId: clinician.id,
            status: 'pending',
            paymentPlan: '30_percent_downpayment',
            depositPaid: false,
            trainingNotes: `30% downpayment confirmed manually. Authorisation code issued. ${new Date().toISOString()}`,
          },
        });

        onboardingId = onboarding.id;

        const paymentData = {
          clinicianId: clinician.id,
          onboardingId,
          amountCents,
          currency,
          provider: 'manual',
          status: 'confirmed',
          providerReference: `manual-training-auth-${hash.slice(0, 32)}`,
          paymentReference: `30PCT-${hint}`,
          payerName: clinician.displayName || row.name || email,
          originBank: 'manual_eft',
          paymentDate: new Date(),
          proofOfPaymentUrl: null,
          authorisationCodeHash: hash,
          authorisationCodeHint: hint,
          authorisationExpiresAt: expiresAt(),
          authorisationUsedAt: null,
          confirmedByUserId: 'temporary-clinician-app-seed-route',
          confirmedAt: new Date(),
          meta: {
            purpose: 'CLINICIAN_ONBOARDING_30_PERCENT_DOWNPAYMENT',
            source: 'temporary_clinician_app_seed_route',
            clinicianEmail: email,
            clinicianName: clinician.displayName || row.name || null,
            downpaymentPercent: 30,
            fullTrainingFeeCents: 2650000,
            amountPaidCents: amountCents,
            codeHint: hint,
            seededAt: new Date().toISOString(),
            note: 'Plain authorisation code intentionally not stored. Only hash and hint are stored.',
          },
        };

        await db.clinicianOnboardingPayment.upsert({
          where: { authorisationCodeHash: hash },
          update: {
            ...paymentData,
            updatedAt: new Date(),
          },
          create: paymentData,
        });
      }

      results.push({
        email,
        clinicianId: clinician.id,
        clinicianName: clinician.displayName || row.name || null,
        code,
        codeHint: hint,
        amount: 'R7,950',
        status: apply ? 'applied' : 'dry_run',
        onboardingId,
      });
    }

    return json({
      ok: true,
      mode: apply ? 'APPLY' : 'DRY_RUN',
      seededSlots: slotResults,
      codes: results,
      missing,
      skipped,
      warning:
        'Temporary operational endpoint. Remove this route immediately after confirming the authorisation codes work.',
    });
  } catch (err: any) {
    console.error('[temporary seed training authorisations] error', err);
    return json(
      {
        ok: false,
        error: err?.message || 'seed_training_authorisations_failed',
      },
      500,
    );
  }
}

