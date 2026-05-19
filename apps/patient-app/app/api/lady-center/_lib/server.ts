import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/src/lib/prisma';
import { verifyAuth0Token } from '@/src/lib/auth';

export type LadyMode = 'cycle' | 'symptoms' | 'pregnancy' | 'menopause';
export type DocTag = 'Gynae' | 'Labs' | 'Imaging' | 'Rx' | 'Notes';
export type LadySexAtBirth = 'female' | 'male' | 'intersex' | 'unknown';

export type LadyProfileDto = {
  mode: LadyMode;
  trackCycle: boolean;
  trackSymptoms: boolean;
  trackVitals: boolean;
  remindScreening: boolean;
  createdAtISO: string;
  sexAtBirth?: LadySexAtBirth;
  contraceptiveMethod?: string;
  tryingToConceive?: boolean;
  knownConditions?: string[];
};

export type LadyDocDto = {
  id: string;
  title: string;
  tag: DocTag;
  createdISO: string;
  fileName?: string;
};

export type LadyNoteDto = {
  id: string;
  text: string;
  createdISO: string;
};

export type DayLogDto = {
  date: string;
  period?: boolean;
  ovulation?: boolean;
  pregnancyTestPositive?: boolean;
  meds?: string;
  notes?: string;
  symptoms?: string[];

  sexualEncounter?: boolean;
  protectedSex?: boolean | null;
  withdrawalUsed?: boolean | null;
  emergencyContraception?: boolean;
  tryingToConceive?: boolean | null;
  contraceptionMethod?: string;
  contraceptionAdherence?: string;
  cycleModifiers?: string[];

  flowIntensity?: number | null;
  painScore?: number | null;
  cervicalMucus?: string;

  overnightHrPromptedAt?: string | null;
  overnightHrPromptStatus?: string | null;
};

export type LadyServerState = {
  profile: LadyProfileDto | null;
  docs: LadyDocDto[];
  notes: LadyNoteDto[];
  screening: Record<string, { lastDoneISO?: string | null }>;
  dayLogs: Record<string, DayLogDto>;
  updatedAtISO?: string | null;
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalize(value?: string | null) {
  return String(value || '').trim();
}

function asIso(value?: Date | string | null) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function asDateOnly(value?: Date | string | null) {
  const iso = asIso(value);
  return iso ? iso.slice(0, 10) : '';
}

function enumTagToDto(tag: string): DocTag {
  if (tag === 'Gynae' || tag === 'Labs' || tag === 'Imaging' || tag === 'Rx' || tag === 'Notes') return tag;
  return 'Notes';
}

function dtoTagToEnum(tag: string): DocTag {
  return enumTagToDto(tag);
}

function normalizeSexAtBirth(value: unknown): LadySexAtBirth {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'female' || raw === 'male' || raw === 'intersex') return raw;
  return 'unknown';
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonErr(message: string, status = 400, code?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: { message, code: code || 'request_failed' },
    },
    { status },
  );
}

function base64urlToBuffer(s: string) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function safeJsonParse(buf: Buffer) {
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

function verifyJwtHs256(token: string, secret: string): any | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;

    const [h, p, sig] = parts;
    const data = `${h}.${p}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest();
    const got = base64urlToBuffer(sig);

    if (got.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(got, expected)) return null;

    const payload = safeJsonParse(base64urlToBuffer(p));
    if (!payload) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp <= now) return null;

    return payload;
  } catch {
    return null;
  }
}

function readSessionPayload(req: NextRequest): any | null {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) return null;

  const token =
    req.cookies.get('ambulant_session')?.value ||
    req.cookies.get('__Host-ambulant_session')?.value ||
    req.cookies.get('ambulant.session')?.value ||
    req.cookies.get('auth_session')?.value ||
    req.cookies.get('session')?.value ||
    req.cookies.get('token')?.value ||
    '';

  if (!token) return null;
  return verifyJwtHs256(token, secret);
}

async function readUserIdFromAuth(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;

  try {
    const token = auth.slice(7).trim();
    const payload = await verifyAuth0Token(token);
    const sub = payload?.sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

function readRequestedPatientId(req: NextRequest) {
  return (
    normalize(req.nextUrl.searchParams.get('patientId')) ||
    normalize(req.headers.get('x-patient-id')) ||
    normalize(req.headers.get('x-current-patient-id')) ||
    normalize(req.headers.get('x-ambulant-patient-id'))
  );
}

function readDevOnlyUserId(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') return null;
  if (process.env.ALLOW_UNSAFE_LADY_CENTER_DEV_CONTEXT !== '1') return null;

  return (
    normalize(req.nextUrl.searchParams.get('userId')) ||
    normalize(req.headers.get('x-user-id')) ||
    normalize(req.headers.get('x-subject')) ||
    null
  );
}

export async function resolveLadyPatientContext(req: NextRequest) {
  const db = prisma as any;
  if (!db) {
    return {
      ok: false as const,
      error: 'Prisma client is not available. Run prisma generate and ensure DB access is configured.',
      status: 503,
    };
  }

  const requestedPatientId = readRequestedPatientId(req);
  const sessionPayload = readSessionPayload(req);
  const sessionActorType = normalize(sessionPayload?.actorType).toUpperCase();
  const sessionActorRefId = normalize(sessionPayload?.actorRefId);
  const sessionUserId = normalize(sessionPayload?.sub || sessionPayload?.uid || sessionPayload?.userId);
  const bearerUserId = await readUserIdFromAuth(req);
  const devOnlyUserId = readDevOnlyUserId(req);

  const authenticatedUserId = sessionUserId || bearerUserId || devOnlyUserId || null;

  if (sessionPayload && sessionActorType && sessionActorType !== 'PATIENT') {
    return {
      ok: false as const,
      error: 'Lady Center is available only for patient accounts.',
      status: 403,
    };
  }

  let patient: any | null = null;

  if (sessionActorRefId) {
    patient = await db.patientProfile.findUnique({
      where: { id: sessionActorRefId },
    });
  }

  if (!patient && authenticatedUserId) {
    patient = await db.patientProfile.findUnique({
      where: { userId: authenticatedUserId },
    });
  }

  if (!patient && process.env.NODE_ENV !== 'production' && process.env.ALLOW_UNSAFE_LADY_CENTER_DEV_CONTEXT === '1' && requestedPatientId) {
    patient = await db.patientProfile.findUnique({
      where: { id: requestedPatientId },
    });
  }

  if (!patient) {
    return {
      ok: false as const,
      error: 'Could not resolve an authenticated patient profile for Lady Center.',
      status: authenticatedUserId || sessionActorRefId ? 404 : 401,
    };
  }

  if (requestedPatientId && requestedPatientId !== patient.id) {
    return {
      ok: false as const,
      error: 'Requested patient does not match the authenticated patient context.',
      status: 403,
    };
  }

  return {
    ok: true as const,
    prisma: db,
    patientId: patient.id as string,
    userId: (patient.userId || authenticatedUserId || null) as string | null,
    patient,
  };
}

export function mapLadyProfile(row: any): LadyProfileDto | null {
  if (!row) return null;
  return {
    mode: row.mode,
    trackCycle: !!row.trackCycle,
    trackSymptoms: !!row.trackSymptoms,
    trackVitals: !!row.trackVitals,
    remindScreening: !!row.remindScreening,
    createdAtISO: asIso(row.createdAtISO || row.createdAt || new Date()) || new Date().toISOString(),
    sexAtBirth: normalizeSexAtBirth(row.sexAtBirth),
    contraceptiveMethod: row.contraceptiveMethod || '',
    tryingToConceive: !!row.tryingToConceive,
    knownConditions: Array.isArray(row.knownConditions) ? row.knownConditions.map(String).filter(Boolean) : [],
  };
}

export function mapLadyNote(row: any): LadyNoteDto {
  return {
    id: row.id,
    text: row.text,
    createdISO: asIso(row.createdISO || row.createdAt) || new Date().toISOString(),
  };
}

export function mapLadyDoc(row: any): LadyDocDto {
  return {
    id: row.id,
    title: row.title,
    tag: enumTagToDto(row.tag),
    fileName: row.fileName || undefined,
    createdISO: asIso(row.createdISO || row.createdAt) || new Date().toISOString(),
  };
}

export function mapLadyDayLog(row: any): DayLogDto {
  return {
    date: asDateOnly(row.date),
    period: !!row.period,
    ovulation: !!row.ovulation,
    pregnancyTestPositive: !!row.pregnancyTestPositive,
    meds: row.meds || '',
    notes: row.notes || '',
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],

    sexualEncounter: !!row.sexualEncounter,
    protectedSex: typeof row.protectedSex === 'boolean' ? row.protectedSex : null,
    withdrawalUsed: typeof row.withdrawalUsed === 'boolean' ? row.withdrawalUsed : null,
    emergencyContraception: !!row.emergencyContraception,
    tryingToConceive: typeof row.tryingToConceive === 'boolean' ? row.tryingToConceive : null,
    contraceptionMethod: row.contraceptionMethod || '',
    contraceptionAdherence: row.contraceptionAdherence || '',
    cycleModifiers: Array.isArray(row.cycleModifiers) ? row.cycleModifiers : [],

    flowIntensity: typeof row.flowIntensity === 'number' ? row.flowIntensity : null,
    painScore: typeof row.painScore === 'number' ? row.painScore : null,
    cervicalMucus: row.cervicalMucus || '',

    overnightHrPromptedAt: asIso(row.overnightHrPromptedAt),
    overnightHrPromptStatus: row.overnightHrPromptStatus || null,
  };
}

export function buildLadyState(input: {
  profile: any | null;
  docs: any[];
  notes: any[];
  screenings: any[];
  dayLogs: any[];
  updatedAtISO?: string | null;
}): LadyServerState {
  const screening: Record<string, { lastDoneISO?: string | null }> = {};
  for (const s of input.screenings || []) {
    screening[s.key] = {
      lastDoneISO: asIso(s.lastDoneISO),
    };
  }

  const dayLogs: Record<string, DayLogDto> = {};
  for (const row of input.dayLogs || []) {
    const mapped = mapLadyDayLog(row);
    dayLogs[mapped.date] = mapped;
  }

  return {
    profile: mapLadyProfile(input.profile),
    docs: (input.docs || []).map(mapLadyDoc),
    notes: (input.notes || []).map(mapLadyNote),
    screening,
    dayLogs,
    updatedAtISO: input.updatedAtISO || null,
  };
}

export function computeScreeningStatus(nextDueISO?: string | null): 'due' | 'ok' | 'overdue' | 'unknown' {
  if (!nextDueISO) return 'unknown';
  const due = new Date(nextDueISO);
  if (Number.isNaN(due.getTime())) return 'unknown';
  return due.getTime() < Date.now() ? 'overdue' : 'ok';
}

export function inferNextDueISO(key: string, lastDoneISO?: string | null) {
  if (!lastDoneISO) return null;
  const d = new Date(lastDoneISO);
  if (Number.isNaN(d.getTime())) return null;

  const addDays =
    key === 'pap' ? 365 * 3 :
    key === 'breast' ? 365 * 2 :
    key === 'sti' ? 365 :
    key === 'hpv_vax' ? 365 :
    365;

  d.setDate(d.getDate() + addDays);
  return d.toISOString();
}

export function tagToEnum(tag: string) {
  return dtoTagToEnum(tag);
}
