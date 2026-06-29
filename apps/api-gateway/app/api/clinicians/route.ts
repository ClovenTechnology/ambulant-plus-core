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

type ClinicianFeeKindValue = 'STANDARD' | 'FOLLOWUP' | 'PROCEDURE';

function normalizeClinicianFeeKind(value: unknown): ClinicianFeeKindValue | null {
  const kind = String(value || '').trim().toUpperCase();

  if (kind === 'STANDARD' || kind === 'FOLLOWUP' || kind === 'PROCEDURE') {
    return kind;
  }

  return null;
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

function safeParseJson(value: unknown): any {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function realPatientApproved(meta: any) {
  const m = safeParseJson(meta);
  const approval = safeParseJson(m.realPatientApproval);

  return Boolean(
    m.adminFinalApproved === true ||
      m.realPatientApprovedAt ||
      m.patientVisible === true ||
      approval.approved === true ||
      approval.approvedAt
  );
}

function normalizePublicClass(value: unknown): 'Doctor' | 'Allied Health' | 'Wellness' {
  const s = String(value || '').trim().toLowerCase();

  if (
    s === 'allied health' ||
    s === 'allied_health' ||
    s === 'nurse' ||
    s === 'nursing' ||
    s === 'pharmacist' ||
    s === 'physiotherapist' ||
    s === 'dietitian'
  ) {
    return 'Allied Health';
  }

  if (
    s === 'wellness' ||
    s === 'coach' ||
    s === 'health coach' ||
    s === 'lifestyle' ||
    s === 'chiropractor'
  ) {
    return 'Wellness';
  }

  return 'Doctor';
}

function toMs(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const d = value instanceof Date ? value : new Date(String(value));
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function publicFairScore(row: any, now = Date.now()) {
  const online = row.online === true;
  const lastBookedAt = toMs(row.lastBookedAt);
  const recentBookedCount = Number.isFinite(Number(row.recentBookedCount))
    ? Math.max(0, Number(row.recentBookedCount))
    : 0;

  const rating =
    Number.isFinite(Number(row.ratingAvg))
      ? Number(row.ratingAvg)
      : Number.isFinite(Number(row.rating))
        ? Number(row.rating)
        : 0;

  const onlineCredit = online ? 240 : 0;

  const recentBookingPenalty =
    recentBookedCount * 90 +
    (lastBookedAt ? Math.max(0, 120 - Math.min(120, (now - lastBookedAt) / 60000)) : 0);

  const ratingCredit = Math.max(0, Math.min(5, rating)) * 8;

  return onlineCredit + ratingCredit - recentBookingPenalty;
}

function publicClinicianName(row: any, meta: any) {
  return cleanStr(row.displayName ?? row.name ?? meta.displayName ?? meta.name) || 'Clinician';
}

function normalizeCountryCode(value: unknown) {
  const raw = String(value ?? '').trim().slice(0, 80);
  const s = raw.trim().toLowerCase();

  if (!s) return 'ZA';

  if (
    s === 'za' ||
    s === 'zaf' ||
    s === 'south africa' ||
    s === 'south-africa' ||
    s === 'republic of south africa'
  ) {
    return 'ZA';
  }

  return raw.toUpperCase();
}

function publicClinicianCountry(row: any, meta: any) {
  return normalizeCountryCode(row.country ?? meta.country ?? meta.rawProfile?.country);
}

function publicClinicianLocation(row: any, meta: any) {
  const city = cleanStr(row.city ?? meta.city);
  const region = cleanStr(meta.region ?? meta.province ?? meta.state);
  const location = cleanStr(row.location ?? meta.location);

  if (location) return location;
  if (city && region) return `${city}, ${region}`;
  return city || region || '';
}

function publicAcceptedSchemes(row: any, meta: any) {
  const source =
    row.acceptedSchemes ??
    meta.acceptedSchemes ??
    meta.schemes ??
    meta.insurers ??
    meta.acceptedSchemesCsv;

  if (Array.isArray(source)) {
    return source.map(String).map((s) => s.trim()).filter(Boolean);
  }

  if (typeof source === 'string') {
    return source
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

function publicAcceptsMedicalAid(row: any, meta: any) {
  const schemes = publicAcceptedSchemes(row, meta);

  return Boolean(
    row.acceptsMedicalAid === true ||
      meta.acceptsMedicalAid === true ||
      meta.hasInsurance === true ||
      meta.acceptsInsurance === true ||
      meta.acceptEligibleMedicalAid === true ||
      schemes.length > 0,
  );
}

function publicAvatarUrl(row: any, meta: any) {
  return (
    cleanStr(row.avatarUrl ?? row.photoUrl ?? meta.avatarUrl ?? meta.photoUrl) ||
    null
  );
}


function publicMapClinician(row: any) {
  const meta = safeParseJson(row.meta);
  const rawProfile = safeParseJson(meta.rawProfileJson || meta.rawProfile || meta.submittedProfile);
  const mergedMeta = { ...meta, ...(rawProfile || {}) };

  const cls = normalizePublicClass(row.cls ?? mergedMeta.class ?? mergedMeta.cls ?? row.specialty);

  return {
    id: String(row.id ?? ''),
    name: publicClinicianName(row, mergedMeta),
    displayName: publicClinicianName(row, mergedMeta),
    specialty: cleanStr(row.specialty ?? mergedMeta.specialty) || 'General Practice',
    location: publicClinicianLocation(row, mergedMeta),
    cls,
    gender: row.gender ?? mergedMeta.gender ?? null,
    priceZAR:
      typeof row.feeCents === 'number'
        ? Math.round(row.feeCents / 100)
        : typeof mergedMeta.priceZAR === 'number'
          ? mergedMeta.priceZAR
          : undefined,
    priceCents: typeof row.feeCents === 'number' ? row.feeCents : undefined,
    currency: row.currency ?? 'ZAR',
    rating:
      typeof row.ratingAvg === 'number'
        ? row.ratingAvg
        : typeof row.rating === 'number'
          ? row.rating
          : 0,
    ratingCount:
      typeof row.ratingCount === 'number'
        ? row.ratingCount
        : typeof row.ratingsCount === 'number'
          ? row.ratingsCount
          : undefined,
    online: Boolean(row.online),
    lastBookedAt: row.lastBookedAt ? +new Date(row.lastBookedAt) : null,
    lastSeenAt: row.lastSeenAt ? +new Date(row.lastSeenAt) : null,
    onlineSeq: row.onlineSeq != null ? Number(row.onlineSeq) : null,
    recentBookedCount: row.recentBookedCount ?? 0,
    status: row.status ?? null,
    photoUrl: publicAvatarUrl(row, mergedMeta),
    avatarUrl: publicAvatarUrl(row, mergedMeta),
    acceptsMedicalAid: publicAcceptsMedicalAid(row, mergedMeta),
    acceptedSchemes: publicAcceptedSchemes(row, mergedMeta),
    practiceName: row.practiceName ?? mergedMeta.practiceName ?? undefined,
    country: publicClinicianCountry(row, mergedMeta),
    speaks: Array.isArray(mergedMeta.speaks) ? mergedMeta.speaks : undefined,
    yearsExp:
      typeof mergedMeta.yearsExp === 'number'
        ? mergedMeta.yearsExp
        : undefined,
    joinedAt: row.createdAt ?? row.joinedAt ?? null,
    operational: {
      canBeListed: true,
      canBeBooked: row.bookingEnabled === false ? false : true,
      canPrescribe: false,
      prescribingMode: 'no',
      allowedWorkspaces: ['televisit', 'encounters', 'referrals', 'certificates'],
      patientCategory: cls === 'Wellness' ? 'wellness' : 'clinical',
    },
  };
}

async function publicClinicianDirectory(req: NextRequest) {
  const url = new URL(req.url);

  const q = clampLen(url.searchParams.get('q') || '', 120).toLowerCase();
  const specialty = clampLen(url.searchParams.get('specialty') || '', 120).toLowerCase();
  const gender = clampLen(url.searchParams.get('gender') || '', 60).toLowerCase();
  const country = clampLen(url.searchParams.get('country') || '', 12).toUpperCase();

  const page = toPosInt(url.searchParams.get('page'), 1);
  const perPageRaw = Number.parseInt(
    url.searchParams.get('perPage') ||
      url.searchParams.get('pageSize') ||
      url.searchParams.get('limit') ||
      '25',
    10,
  );
  const perPage = Number.isFinite(perPageRaw)
    ? Math.min(500, Math.max(5, perPageRaw))
    : 25;

  const rows = await (prisma as any).clinicianProfile.findMany({
    where: {
      status: { in: ['active', 'ACTIVE', 'approved', 'APPROVED', 'verified', 'VERIFIED'] },
      disabled: false,
      archived: false,
      trainingCompleted: true,
    },
    orderBy: [
      { online: 'desc' },
      { recentBookedCount: 'asc' },
      { lastBookedAt: 'asc' },
      { onlineSeq: 'asc' },
      { ratingAvg: 'desc' },
      { displayName: 'asc' },
    ],
    take: 500,
    select: {
      id: true,
      displayName: true,
      specialty: true,
      gender: true,
      photoUrl: true,
      city: true,
      country: true,
      feeCents: true,
      currency: true,
      status: true,
      disabled: true,
      archived: true,
      meta: true,
      createdAt: true,
      lastBookedAt: true,
      lastSeenAt: true,
      online: true,
      onlineSeq: true,
      recentBookedCount: true,
      acceptedSchemes: true,
      acceptsMedicalAid: true,
      practiceName: true,
      ratingAvg: true,
      ratingCount: true,
    },
  });

  const now = Date.now();

  let mapped = rows
    .filter((row: any) => {
      const meta = safeParseJson(row.meta);

      if (meta.discoverable === false || meta.visible === false || meta.patientVisible === false) {
        return false;
      }

      return realPatientApproved(meta);
    })
    .map(publicMapClinician)
    .filter((item: any) => {
      if (!item.id) return false;

      if (country && String(item.country || '').toUpperCase() !== country) return false;
      if (gender && String(item.gender || '').toLowerCase() !== gender) return false;

      if (specialty) {
        const hay = `${item.specialty || ''} ${item.name || ''}`.toLowerCase();
        if (!hay.includes(specialty)) return false;
      }

      if (q) {
        const hay = `${item.name || ''} ${item.specialty || ''} ${item.location || ''} ${item.practiceName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

  mapped = mapped
    .map((item: any) => ({ ...item, _fairRankScore: publicFairScore(item, now) }))
    .sort((a: any, b: any) => {
      if (b._fairRankScore !== a._fairRankScore) return b._fairRankScore - a._fairRankScore;

      const aSeq = Number.isFinite(Number(a.onlineSeq)) ? Number(a.onlineSeq) : Number.POSITIVE_INFINITY;
      const bSeq = Number.isFinite(Number(b.onlineSeq)) ? Number(b.onlineSeq) : Number.POSITIVE_INFINITY;
      if (aSeq !== bSeq) return aSeq - bSeq;

      const aBooked = Number.isFinite(Number(a.recentBookedCount)) ? Number(a.recentBookedCount) : 0;
      const bBooked = Number.isFinite(Number(b.recentBookedCount)) ? Number(b.recentBookedCount) : 0;
      if (aBooked !== bBooked) return aBooked - bBooked;

      return String(a.name || '').localeCompare(String(b.name || ''));
    })
    .map(({ _fairRankScore, ...item }: any) => item);

  const total = mapped.length;
  const start = (page - 1) * perPage;
  const paged = mapped.slice(start, start + perPage);

  return json({
    ok: true,
    items: paged,
    clinicians: paged,
    total,
    page,
    pageSize: perPage,
    meta: {
      total,
      page,
      perPage,
      source: 'api_gateway_public_directory',
      fairness: 'directory_fairness_v1_online_booking_penalty_queue_tiebreak',
    },
  });
}

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
    // (non-fatal if model exists but relation fails later â€” this should match your schema)
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
      const subject = 'Ambulant+ Clinician Application Received â€” Next Steps';
      const html = `
        <p>Hi ${displayName},</p>
        <p>Your Ambulant+ clinician application has been received.</p>
        <p><strong>Mandatory onboarding:</strong></p>
        <ol>
          <li><strong>Training scheduling + payment</strong> (required)</li>
          <li><strong>Starter kit dispatch</strong> after payment confirmation</li>
          <li><strong>Admin certification</strong> â€” only then your profile becomes visible to patients</li>
        </ol>
        <p><a href="${trainingLink}">ðŸ‘‰ Sign in to continue onboarding</a></p>
        <p style="margin-top:12px;">If you didnâ€™t request this, you can ignore this email.</p>
        <p>â€” Ambulant+ Team</p>
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
    if (!isAdmin) return publicClinicianDirectory(req);

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
      clinicians: items, // âœ… legacy consumers
      items, // âœ… new consumers
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
          const kind = normalizeClinicianFeeKind(row?.kind);
          if (!kind) continue;

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

    // keep onboarding row (history), donâ€™t delete
    return json({ ok: true, clinician: profile });
  } catch (err: any) {
    console.error('clinicians DELETE error', err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
}


