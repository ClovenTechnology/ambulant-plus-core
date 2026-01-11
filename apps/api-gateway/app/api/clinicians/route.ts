// apps/api-gateway/app/api/clinicians/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { sendEmail, sendSms } from '@/src/lib/mailer';
import { verifyAdminRequest } from '../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* -----------------------------
   Helpers
------------------------------ */
const PAGE_SIZES = new Set([10, 20, 50, 100]);

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function cleanStr(v: any): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function normEmail(v: any): string | null {
  const s = cleanStr(v);
  return s ? s.toLowerCase() : null;
}

function toPosInt(v: string | null, fallback: number) {
  const n = v ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function toPageSize(v: string | null, fallback: number) {
  const n = v ? Number.parseInt(v, 10) : Number.NaN;
  return PAGE_SIZES.has(n) ? n : fallback;
}

function clampLen(s: string, max: number) {
  const t = (s || '').trim();
  return t.length > max ? t.slice(0, max) : t;
}

function safeCurrency(v: any): string {
  const s = String(v ?? 'ZAR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : 'ZAR';
}

function feeZarToCents(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function zarMinor(v: any): number {
  // Accept both amountMinor and amountZar. Prefer explicit minor.
  if (v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
  const s = String(v).trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

type SortKey = 'name' | 'created' | 'updated' | 'fee' | 'specialty' | 'email' | 'status' | 'training';
type SortDir = 'asc' | 'desc';

function normalizeSortKey(v: string | null): SortKey | null {
  if (!v) return null;
  const s = v.trim();
  const ok: SortKey[] = ['name', 'created', 'updated', 'fee', 'specialty', 'email', 'status', 'training'];
  return (ok as string[]).includes(s) ? (s as SortKey) : null;
}

function normalizeDir(v: string | null): SortDir {
  return v === 'asc' ? 'asc' : 'desc';
}

function getBaseUrl(req: NextRequest) {
  // Prefer configured public base if available, else infer from request
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase && envBase.trim()) return envBase.trim().replace(/\/+$/, '');
  return req.nextUrl.origin;
}

/* -----------------------------
   POST -> clinician signup (Public)
   Creates:
   - ClinicianProfile
   - ClinicianOnboarding (upsert)
   - (Optional) seeds ClinicianFee v2 for STANDARD/FOLLOWUP
------------------------------ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const displayName = cleanStr(body.displayName ?? body.name);
    const email = normEmail(body.email);
    const phone = cleanStr(body.phone);
    const specialty = cleanStr(body.specialty);

    if (!displayName) return json({ ok: false, error: 'displayName required' }, 400);
    if (!specialty) return json({ ok: false, error: 'specialty required' }, 400);
    if (!email && !phone) return json({ ok: false, error: 'email or phone required' }, 400);

    const currency = safeCurrency(body.currency);

    // Accept either feeZAR (major units) or feeCents (already in cents)
    const feeCents =
      Number.isFinite(Number(body.feeCents)) ? Math.max(0, Math.round(Number(body.feeCents))) : feeZarToCents(body.feeZAR ?? body.fee);

    // If you have an auth provider later, pass stable userId (Auth0 sub etc).
    const userId =
      cleanStr(body.userId) ??
      cleanStr(body.auth0UserId) ??
      (email || phone ? String(email || phone) : `anon-${Date.now()}`);

    // Prevent duplicates on unique userId
    const existing = await prisma.clinicianProfile.findUnique({ where: { userId } });
    if (existing) {
      return json(
        { ok: false, error: 'clinician already exists for this userId', clinicianId: existing.id, userId },
        409,
      );
    }

    // Optional extended profile fields (all exist in your Prisma schema)
    const practiceName = cleanStr(body.practiceName);
    const practiceNumber = cleanStr(body.practiceNumber);
    const regulatorBody = cleanStr(body.regulatorBody);
    const regulatorRegistration = cleanStr(body.regulatorRegistration);

    const submittedAt = new Date().toISOString();

    const created = await prisma.clinicianProfile.create({
      data: {
        userId,
        displayName,
        specialty,
        email,
        phone,

        practiceName,
        practiceNumber,
        regulatorBody,
        regulatorRegistration,

        feeCents,
        currency,

        status: 'pending',
        trainingCompleted: false,
        disabled: false,
        archived: false,

        meta: {
          applicant: { submittedAt },
          // keep whatever extra payload the UI sent (safe-ish; still validate on the client too)
          submittedProfile: body?.profile ?? null,
        },
      },
      select: {
        id: true,
        userId: true,
        displayName: true,
        specialty: true,
        email: true,
        phone: true,
        feeCents: true,
        currency: true,
        status: true,
        trainingCompleted: true,
        disabled: true,
        archived: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Ensure onboarding exists (for onboarding-board + dispatch/training flows)
    await prisma.clinicianOnboarding.upsert({
      where: { clinicianId: created.id },
      update: {},
      create: {
        clinicianId: created.id,
        status: 'pending',
        depositPaid: false,
      },
    });

    // Seed feesV2 (ClinicianFee) if you want immediate compatibility with fee engine
    // (non-fatal if model exists but relation fails later — this should match your schema)
    try {
      const standardMinor = Math.max(0, feeCents);
      const followupMinor = Math.max(0, Math.round(standardMinor * 0.75));

      await prisma.$transaction([
        prisma.clinicianFee.create({
          data: {
            clinicianUserId: created.userId,
            kind: 'STANDARD',
            currency,
            amountMinor: standardMinor,
            active: true,
          },
        }),
        prisma.clinicianFee.create({
          data: {
            clinicianUserId: created.userId,
            kind: 'FOLLOWUP',
            currency,
            amountMinor: followupMinor,
            active: true,
          },
        }),
      ]);
    } catch {
      // keep signup working even if fees seeding fails (e.g. during partial migrations)
    }

    const baseUrl = getBaseUrl(req);
    const trainingLink = `${baseUrl}/auth/login?reason=training_required&next=${encodeURIComponent('/')}`;

    if (email) {
      const subject = 'Ambulant+ Clinician Application Received — Next Steps';
      const html = `
        <p>Hi ${displayName},</p>
        <p>Your Ambulant+ clinician application has been received.</p>
        <p><strong>Mandatory onboarding:</strong></p>
        <ol>
          <li><strong>Training scheduling + payment</strong> (required)</li>
          <li><strong>Starter kit dispatch</strong> after payment confirmation</li>
          <li><strong>Admin certification</strong> — only then your profile becomes visible to patients</li>
        </ol>
        <p><a href="${trainingLink}">👉 Sign in to continue onboarding</a></p>
        <p style="margin-top:12px;">If you didn’t request this, you can ignore this email.</p>
        <p>— Ambulant+ Team</p>
      `;
      sendEmail(email, subject, html).catch(() => {});
    }

    if (phone) {
      const sms =
        `Ambulant+ application received. Training is mandatory. Sign in to continue onboarding: ${trainingLink}`;
      sendSms(phone, sms).catch(() => {});
    }

    return json({ ok: true, clinician: created }, 201);
  } catch (err: any) {
    console.error('clinicians POST error', err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
}

/* -----------------------------
   GET -> admin-only list / single
   Supports:
     ?id=<clinicianId>  (single record)
     ?status=pending|active|...
     ?q=... (search displayName/email/phone/userId)
     ?sort=name|created|updated|fee|specialty|email|status|training
     ?dir=asc|desc
     ?page=1..N
     ?pageSize=10|20|50|100
------------------------------ */
export async function GET(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return json({ ok: false, error: 'admin_required' }, 403);

    const url = new URL(req.url);
    const id = clampLen(url.searchParams.get('id') || '', 80);

    // Single clinician fetch
    if (id) {
      const clinician = await prisma.clinicianProfile.findUnique({ where: { id } });
      if (!clinician) return json({ ok: false, error: 'not_found' }, 404);

      const onboarding = await prisma.clinicianOnboarding.findUnique({
        where: { clinicianId: clinician.id },
        include: {
          trainingSlot: true,
          _count: { select: { dispatches: true } },
        },
      });

      const item = { ...clinician, onboarding: onboarding ?? null };
      return json({ ok: true, clinician: item, clinicians: [item], items: [item], total: 1, page: 1, pageSize: 1 });
    }

    const status = clampLen(url.searchParams.get('status') || '', 48) || undefined;
    const q = clampLen(url.searchParams.get('q') || '', 120).trim();

    const sortKey = normalizeSortKey(url.searchParams.get('sort'));
    const dir = normalizeDir(url.searchParams.get('dir'));

    const page = toPosInt(url.searchParams.get('page'), 1);
    const pageSize = toPageSize(url.searchParams.get('pageSize'), 50);

    const where: any = {};
    if (status) where.status = status;

    if (q) {
      // Postgres supports insensitive, but keep generic to avoid surprises
      where.OR = [
        { displayName: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { userId: { contains: q } },
      ];
    }

    const tieBreak: any[] = [{ createdAt: 'desc' }];
    const orderBy: any[] = [];

    if (sortKey === 'name') orderBy.push({ displayName: dir }, ...tieBreak);
    else if (sortKey === 'email') orderBy.push({ email: dir }, ...tieBreak);
    else if (sortKey === 'specialty') orderBy.push({ specialty: dir }, ...tieBreak);
    else if (sortKey === 'status') orderBy.push({ status: dir }, ...tieBreak);
    else if (sortKey === 'fee') orderBy.push({ feeCents: dir }, ...tieBreak);
    else if (sortKey === 'training') orderBy.push({ trainingScheduledAt: dir }, ...tieBreak);
    else if (sortKey === 'updated') orderBy.push({ updatedAt: dir }, ...tieBreak);
    else if (sortKey === 'created') orderBy.push({ createdAt: dir });
    else orderBy.push({ createdAt: 'desc' });

    const total = await prisma.clinicianProfile.count({ where });
    const skip = (page - 1) * pageSize;

    const clinicians = await prisma.clinicianProfile.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
    });

    // Attach onboarding snapshots (separate query; no direct relation in your schema)
    const ids = clinicians.map((c) => c.id);
    const onboardings = ids.length
      ? await prisma.clinicianOnboarding.findMany({
          where: { clinicianId: { in: ids } },
          include: {
            trainingSlot: true,
            _count: { select: { dispatches: true } },
          },
        })
      : [];

    const onboardingMap = new Map(onboardings.map((o) => [o.clinicianId, o]));
    const items = clinicians.map((c) => ({ ...c, onboarding: onboardingMap.get(c.id) ?? null }));

    return json({
      ok: true,
      clinicians: items, // ✅ legacy consumers
      items, // ✅ new consumers
      total,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error('clinicians GET error', err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
}

/* -----------------------------
   PATCH -> admin-only update:
   - ClinicianProfile lifecycle + fields
   - Optional feesV2 updates (ClinicianFee)
   - Optional onboarding updates (ClinicianOnboarding)
------------------------------ */
export async function PATCH(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return json({ ok: false, error: 'admin_required' }, 403);

    const body = await req.json().catch(() => ({} as any));
    const id = cleanStr(body?.id);
    if (!id) return json({ ok: false, error: 'id required' }, 400);

    const existing = await prisma.clinicianProfile.findUnique({ where: { id } });
    if (!existing) return json({ ok: false, error: 'not_found' }, 404);

    const data: any = {};

    // Safe field updates (only if explicitly passed)
    if (body.displayName != null) data.displayName = cleanStr(body.displayName) ?? existing.displayName;
    if (body.email != null) data.email = normEmail(body.email);
    if (body.phone != null) data.phone = cleanStr(body.phone);
    if (body.specialty != null) data.specialty = cleanStr(body.specialty);

    // fee updates (back-compat)
    if (body.feeCents != null) data.feeCents = Math.max(0, Math.round(Number(body.feeCents) || 0));
    if (body.feeZAR != null || body.fee != null) data.feeCents = feeZarToCents(body.feeZAR ?? body.fee);
    if (body.currency != null) data.currency = safeCurrency(body.currency);

    // lifecycle/status updates
    if (body.status) {
      const s = String(body.status);
      data.status = s;

      if (s === 'disabled') {
        data.disabled = true;
        data.archived = false;
      } else if (s === 'archived') {
        data.archived = true;
        data.disabled = false;
      } else {
        data.disabled = false;
        if (s === 'active' || s === 'pending') data.archived = false;
      }
    }

    if (typeof body.trainingCompleted === 'boolean') data.trainingCompleted = body.trainingCompleted;
    if (body.trainingScheduledAt) data.trainingScheduledAt = new Date(body.trainingScheduledAt);
    if (typeof body.disabled === 'boolean') data.disabled = body.disabled;
    if (typeof body.archived === 'boolean') data.archived = body.archived;

    // Merge meta patch (shallow)
    if (body.meta && typeof body.meta === 'object') {
      data.meta = {
        ...(existing as any).meta,
        ...body.meta,
        _updatedAtISO: new Date().toISOString(),
      };
    }

    // Onboarding updates (optional)
    const onboardingPatch = body.onboarding && typeof body.onboarding === 'object' ? body.onboarding : null;
    const onboardingData: any = {};
    if (onboardingPatch) {
      if (onboardingPatch.status != null) onboardingData.status = String(onboardingPatch.status);
      if (typeof onboardingPatch.depositPaid === 'boolean') onboardingData.depositPaid = onboardingPatch.depositPaid;
      if (onboardingPatch.nextPaymentAt != null) onboardingData.nextPaymentAt = new Date(onboardingPatch.nextPaymentAt);
      if (onboardingPatch.trainingSlotId != null) onboardingData.trainingSlotId = cleanStr(onboardingPatch.trainingSlotId);
      if (onboardingPatch.trainingNotes != null) onboardingData.trainingNotes = cleanStr(onboardingPatch.trainingNotes);
    }

    // feesV2 updates (optional)
    // Accept body.feesV2 as an array of:
    // [{ kind:'STANDARD'|'FOLLOWUP'|'PROCEDURE', currency:'ZAR', amountMinor:65000 }] OR amountZar:650
    const feesV2 = Array.isArray(body.feesV2) ? body.feesV2 : null;

    const updated = await prisma.$transaction(async (tx) => {
      const clinician = await tx.clinicianProfile.update({ where: { id }, data });

      // upsert onboarding if patch provided OR if it doesn't exist yet (keeps board stable)
      if (onboardingPatch || body.ensureOnboarding === true) {
        await tx.clinicianOnboarding.upsert({
          where: { clinicianId: clinician.id },
          update: Object.keys(onboardingData).length ? onboardingData : {},
          create: {
            clinicianId: clinician.id,
            status: onboardingData.status ?? 'pending',
            depositPaid: onboardingData.depositPaid ?? false,
            nextPaymentAt: onboardingData.nextPaymentAt ?? null,
            trainingSlotId: onboardingData.trainingSlotId ?? null,
            trainingNotes: onboardingData.trainingNotes ?? null,
          },
        });
      }

      if (feesV2 && feesV2.length) {
        const effectiveCurrency = safeCurrency(body.currency ?? clinician.currency ?? 'ZAR');

        for (const row of feesV2) {
          const kind = String(row?.kind || '').toUpperCase();
          if (!['STANDARD', 'FOLLOWUP', 'PROCEDURE'].includes(kind)) continue;

          const currency = safeCurrency(row?.currency ?? effectiveCurrency);
          const amountMinor =
            row?.amountMinor != null
              ? zarMinor(row.amountMinor)
              : row?.amountZar != null
                ? feeZarToCents(row.amountZar)
                : 0;

          // deactivate current active entries for same kind/currency
          await tx.clinicianFee.updateMany({
            where: {
              clinicianUserId: clinician.userId,
              kind,
              currency,
              active: true,
            },
            data: { active: false, effectiveTo: new Date() },
          });

          await tx.clinicianFee.create({
            data: {
              clinicianUserId: clinician.userId,
              kind,
              currency,
              amountMinor,
              active: true,
              effectiveFrom: new Date(),
            },
          });

          // Keep legacy fee fields in sync when STANDARD updated
          if (kind === 'STANDARD') {
            await tx.clinicianProfile.update({
              where: { id: clinician.id },
              data: { feeCents: amountMinor, currency },
            });
          }
        }
      }

      const onboarding = await tx.clinicianOnboarding.findUnique({
        where: { clinicianId: clinician.id },
        include: { trainingSlot: true, _count: { select: { dispatches: true } } },
      });

      return { clinician, onboarding };
    });

    return json({ ok: true, clinician: { ...updated.clinician, onboarding: updated.onboarding ?? null } });
  } catch (err: any) {
    console.error('clinicians PATCH error', err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
}

/* -----------------------------
   DELETE -> admin-only soft archive
------------------------------ */
export async function DELETE(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return json({ ok: false, error: 'admin_required' }, 403);

    const url = new URL(req.url);
    const id =
      url.searchParams.get('id') ||
      (await req.json().catch(() => ({} as any))).id;

    const cid = cleanStr(id);
    if (!cid) return json({ ok: false, error: 'id required' }, 400);

    const profile = await prisma.clinicianProfile.update({
      where: { id: cid },
      data: { status: 'archived', archived: true, disabled: false },
    });

    // keep onboarding row (history), don’t delete
    return json({ ok: true, clinician: profile });
  } catch (err: any) {
    console.error('clinicians DELETE error', err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
}
