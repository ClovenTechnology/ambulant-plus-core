// apps/patient-app/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { API } from '@/src/lib/config';
import { prisma } from '@/src/lib/db';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GatewayPatient = {
  id?: string;
  patientId?: string;
  userId?: string;
  name?: string;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  dob?: string | null;
  avatarUrl?: string | null;
  photoUrl?: string | null;
  address?: string | null;
  mobile?: string | null;
  phone?: string | null;
  bloodType?: string | null;
  allergies?: string[] | null;
  chronicConditions?: string[] | null;
  primaryConditionsText?: string | null;
};

type SharingPreferenceDto = {
  patientId: string;
  allowClinicianAccess: boolean;
  allowMedicalAidAdherenceAccess: boolean;
  allowCorporateSponsorAdherenceAccess: boolean;
  allowRewardProgramAccess: boolean;
  allowEvidenceImages: boolean;
};

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function base64urlToBuffer(s: string) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function safeJsonParse(value: unknown) {
  if (!value) return null;

  try {
    if (Buffer.isBuffer(value)) {
      return JSON.parse(value.toString('utf8'));
    }

    if (typeof value === 'string') {
      return JSON.parse(value);
    }

    return value;
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

function readIdentity(req: NextRequest) {
  const payload = readSessionPayload(req);

  return {
    userId: String(payload?.sub || payload?.userId || payload?.uid || '').trim(),
    patientId: String(payload?.actorRefId || payload?.patientId || '').trim(),
    email: String(payload?.email || '').trim(),
    name: String(payload?.name || payload?.displayName || '').trim(),
    role: String(payload?.actorType || payload?.role || '').trim().toLowerCase(),
  };
}

function readUserId(req: NextRequest, url: URL) {
  const identity = readIdentity(req);

  return (
    url.searchParams.get('userId') ||
    req.headers.get('x-ambulant-user-id') ||
    req.headers.get('x-user-id') ||
    req.headers.get('x-uid') ||
    identity.userId ||
    ''
  ).trim();
}

function readPatientId(req: NextRequest, url: URL) {
  const identity = readIdentity(req);

  return (
    url.searchParams.get('patientId') ||
    url.searchParams.get('subjectPatientId') ||
    req.headers.get('x-ambulant-patient-id') ||
    req.headers.get('x-patient-id') ||
    identity.patientId ||
    ''
  ).trim();
}

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  [
    'cookie',
    'authorization',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-patient-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-patient-id',
    'x-uid',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
  ].forEach((key) => {
    const value = req.headers.get(key);
    if (value) h.set(key, value);
  });

  h.set('accept', 'application/json');
  return h;
}

function cleanString(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function nullableString(value: unknown, max = 500) {
  const out = cleanString(value, max);
  return out || null;
}

function normaliseAllergies(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function toIso(value: unknown) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function dateOnlyIso(value: unknown) {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function ageFromDob(value: unknown) {
  const dob = value instanceof Date ? value : value ? new Date(String(value)) : null;
  if (!dob || Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 0 && age < 130 ? age : null;
}

function buildAddress(profile: any) {
  const parts = [
    profile?.addressLine1,
    profile?.addressLine2,
    profile?.city,
    profile?.postalCode,
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean);

  return parts.length ? parts.join(', ') : null;
}

function parseEmergencyContact(value: unknown) {
  const obj = safeJsonParse(value);

  if (!obj || typeof obj !== 'object') {
    return {
      name: '',
      phone: '',
      relationship: '',
      email: '',
    };
  }

  return {
    name: cleanString((obj as any).name, 160),
    phone: cleanString((obj as any).phone, 80),
    relationship: cleanString((obj as any).relationship, 120),
    email: cleanString((obj as any).email, 180),
  };
}

function hasEmergencyContact(value: unknown) {
  const ec = parseEmergencyContact(value);
  return Boolean(ec.name && ec.phone);
}

function shapeAllergy(row: any) {
  const substance = cleanString(row?.substance ?? row?.substanceText ?? row?.name ?? 'Allergy', 240);
  const reaction = cleanString(row?.reaction ?? row?.reactionText ?? '', 500);

  return {
    id: String(row?.id || ''),
    name: substance,
    substance,
    reaction,
    status: cleanString(row?.status ?? row?.clinicalStatus ?? 'Active', 80) || 'Active',
    severity: cleanString(row?.severity ?? 'Mild', 80) || 'Mild',
    note: cleanString(row?.notes ?? '', 1000) || undefined,
    notes: cleanString(row?.notes ?? '', 1000) || undefined,
    source: row?.source ?? null,
    notedAt: toIso(row?.recordedAt ?? row?.createdAt ?? row?.updatedAt),
  };
}

function shapeCondition(row: any) {
  return {
    id: String(row?.id || ''),
    name: cleanString(row?.name, 240),
    status: cleanString(row?.status || 'Active', 80) || 'Active',
    diagnosedAt: dateOnlyIso(row?.diagnosedAt),
    facility: row?.facility ?? null,
    clinician: row?.clinician ?? null,
    source: row?.source ?? null,
    notes: row?.notes ?? null,
    createdAt: toIso(row?.createdAt),
    updatedAt: toIso(row?.updatedAt),
  };
}

function shapeMedicalAidPolicy(row: any) {
  return {
    id: String(row?.id || ''),
    patientId: String(row?.patientId || ''),
    payerName: row?.schemeName ?? null,
    schemeName: row?.schemeName ?? null,
    planName: row?.planName ?? null,
    membershipNumber: row?.membershipNumber ?? null,
    dependentCode: row?.dependentCode ?? null,
    principalName: row?.principalName ?? null,
    telemedCover: row?.coversTelemedicine
      ? row?.telemedicineCoverType === 'partial'
        ? 'partial'
        : 'full'
      : 'none',
    telemedicineCoverType: row?.telemedicineCoverType ?? null,
    coPaymentType: row?.coPaymentType ?? null,
    coPaymentValue: row?.coPaymentValue ?? null,
    hasCom: Boolean(row?.hasCom),
    comFileName: row?.comFileOriginalName ?? null,
    active: Boolean(row?.isDefault),
    isDefault: Boolean(row?.isDefault),
    notes: row?.notes ?? null,
    createdAt: toIso(row?.createdAt),
    updatedAt: toIso(row?.updatedAt),
  };
}

function defaultSharingPreference(patientId: string): SharingPreferenceDto {
  return {
    patientId,
    allowClinicianAccess: true,
    allowMedicalAidAdherenceAccess: false,
    allowCorporateSponsorAdherenceAccess: false,
    allowRewardProgramAccess: false,
    allowEvidenceImages: false,
  };
}

function calculateReadiness(args: {
  profile: any;
  allergies: any[];
  conditions: any[];
  medicalAidPolicies: any[];
  sharingPreference: SharingPreferenceDto;
  documents: any[];
}) {
  const {
    profile,
    allergies,
    conditions,
    medicalAidPolicies,
    sharingPreference,
    documents,
  } = args;

  const identityChecks = [
    Boolean(profile?.name),
    Boolean(profile?.dob || profile?.gender),
    Boolean(profile?.idNumber),
    Boolean(profile?.photoUrl),
  ];

  const contactChecks = [
    Boolean(profile?.phone),
    Boolean(profile?.contactEmail),
    Boolean(profile?.primaryComm),
  ];

  const deliveryChecks = [
    Boolean(profile?.addressLine1),
    Boolean(profile?.city),
    Boolean(profile?.postalCode),
    Boolean(profile?.useAsDefaultDelivery),
  ];

  const emergencyChecks = [hasEmergencyContact(profile?.emergencyContact)];

  const clinicalChecks = [
    Boolean(profile?.heightCm),
    Boolean(profile?.weightKg),
    allergies.length > 0 || Boolean(profile?.allergies),
    conditions.length > 0,
  ];

  const defaultPolicy =
    medicalAidPolicies.find((x) => x?.isDefault) || medicalAidPolicies[0];

  const medicalAidChecks = [
    Boolean(defaultPolicy?.schemeName),
    Boolean(defaultPolicy?.membershipNumber),
    Boolean(defaultPolicy?.hasCom),
  ];

  const consentChecks = [
    sharingPreference.allowClinicianAccess,
    sharingPreference.allowMedicalAidAdherenceAccess ||
      sharingPreference.allowCorporateSponsorAdherenceAccess ||
      sharingPreference.allowRewardProgramAccess ||
      sharingPreference.allowEvidenceImages,
  ];

  const documentChecks = [documents.length > 0];

  const pct = (checks: boolean[]) => {
    if (!checks.length) return 0;
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  };

  const identity = pct(identityChecks);
  const contact = pct(contactChecks);
  const deliveryBase = pct(deliveryChecks);
  const emergency = pct(emergencyChecks);
  const clinical = pct(clinicalChecks);
  const medicalAid = pct(medicalAidChecks);
  const consent = pct(consentChecks);
  const documentsPct = pct(documentChecks);

  const consult = Math.round(
    identity * 0.18 +
      contact * 0.18 +
      emergency * 0.18 +
      clinical * 0.32 +
      consent * 0.14,
  );

  const claim = Math.round(
    identity * 0.2 +
      contact * 0.15 +
      medicalAid * 0.5 +
      documentsPct * 0.15,
  );

  const deliveryReadiness = Math.round(contact * 0.25 + deliveryBase * 0.75);

  const overall = Math.round(
    identity * 0.14 +
      contact * 0.13 +
      (profile?.useAsDefaultDelivery ? 8 : 0) +
      emergency * 0.12 +
      clinical * 0.18 +
      medicalAid * 0.12 +
      consent * 0.11 +
      documentsPct * 0.08,
  );

  return {
    identity,
    contact,
    delivery: Math.min(100, deliveryReadiness),
    emergency,
    clinical,
    medicalAid,
    consent,
    documents: documentsPct,
    devices: null,
    consult: Math.min(100, consult),
    claim: Math.min(100, claim),
    overall: Math.max(0, Math.min(100, overall)),
  };
}

function deriveReproductiveContext(profile: any) {
  const meta = safeJsonParse(profile?.profileMetadata) || {};
  const antenatal =
    (meta as any)?.antenatal ||
    (meta as any)?.antenatalCenter ||
    (meta as any)?.pregnancy ||
    null;

  const antenatalEdd = antenatal?.edd || antenatal?.estimatedDueDate || null;

  if (antenatalEdd) {
    return {
      source: 'antenatal_center',
      pregnancyStatus: 'confirmed',
      confidencePct: 100,
      edd: String(antenatalEdd),
      gestationalAgeText: null,
      lastEvidenceAt: toIso(profile?.updatedAt),
      note: 'Derived from antenatal context stored in profile metadata.',
    };
  }

  const ladyProfile = profile?.ladyCenterProfile;
  const latestPositiveLog = Array.isArray(profile?.ladyCenterDayLogs)
    ? profile.ladyCenterDayLogs.find((log: any) => Boolean(log?.pregnancyTestPositive))
    : null;

  if (latestPositiveLog) {
    return {
      source: 'lady_center_confirmed',
      pregnancyStatus: 'confirmed',
      confidencePct: 100,
      edd: null,
      gestationalAgeText: null,
      lastEvidenceAt: toIso(latestPositiveLog.date ?? latestPositiveLog.updatedAt),
      note: 'Derived from a positive pregnancy-test log in Lady Center.',
    };
  }

  if (String(ladyProfile?.mode || '').toLowerCase() === 'pregnancy') {
    return {
      source: 'lady_center_confirmed',
      pregnancyStatus: 'confirmed',
      confidencePct: 90,
      edd: null,
      gestationalAgeText: null,
      lastEvidenceAt: toIso(ladyProfile?.updatedAt),
      note: 'Derived from Lady Center pregnancy mode.',
    };
  }

  return {
    source: 'none',
    pregnancyStatus: 'unknown',
    confidencePct: null,
    edd: null,
    gestationalAgeText: null,
    lastEvidenceAt: null,
    note: 'No confirmed pregnancy context available from Lady Center or Antenatal Center yet.',
  };
}

async function readSharingPreference(patientId: string): Promise<SharingPreferenceDto> {
  if (!patientId) return defaultSharingPreference('');

  const pref = await prisma.patientDataSharingPreference
    .findUnique({
      where: { patientId },
    })
    .catch(() => null);

  return pref
    ? {
        patientId,
        allowClinicianAccess: Boolean(pref.allowClinicianAccess),
        allowMedicalAidAdherenceAccess: Boolean(pref.allowMedicalAidAdherenceAccess),
        allowCorporateSponsorAdherenceAccess: Boolean(pref.allowCorporateSponsorAdherenceAccess),
        allowRewardProgramAccess: Boolean(pref.allowRewardProgramAccess),
        allowEvidenceImages: Boolean(pref.allowEvidenceImages),
      }
    : defaultSharingPreference(patientId);
}

async function readLocalPatientProfile(args: { userId?: string; patientId?: string }) {
  const userId = cleanString(args.userId, 160);
  const patientId = cleanString(args.patientId, 160);

  if (!userId && !patientId) return null;

  return prisma.patientProfile
    .findFirst({
      where: patientId ? { id: patientId } : { userId },
      include: {
        allergiesRel: {
          orderBy: [{ status: 'asc' }, { recordedAt: 'desc' }],
          take: 50,
        },
        conditions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        medicalAidPolicies: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        ladyCenterProfile: true,
        ladyCenterDayLogs: {
          where: { pregnancyTestPositive: true },
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    })
    .catch((err) => {
      console.error('profile.local.read.error', err);
      return null;
    });
}

function shapeLocalProfile(localPatient: any, sharingPreference: SharingPreferenceDto) {
  const allergiesList = Array.isArray(localPatient?.allergiesRel)
    ? localPatient.allergiesRel.map(shapeAllergy).filter((x: any) => x.id)
    : [];

  const legacyAllergies = normaliseAllergies(localPatient?.allergies);

  const conditions = Array.isArray(localPatient?.conditions)
    ? localPatient.conditions.map(shapeCondition).filter((x: any) => x.id)
    : [];

  const medicalAidPolicies = Array.isArray(localPatient?.medicalAidPolicies)
    ? localPatient.medicalAidPolicies
        .map(shapeMedicalAidPolicy)
        .sort((a: any, b: any) => Number(b.isDefault) - Number(a.isDefault))
    : [];

  const documents = Array.isArray(localPatient?.documents)
    ? localPatient.documents.map((doc: any) => ({
        id: String(doc?.id || ''),
        title: doc?.title ?? null,
        documentKind: doc?.documentKind ?? null,
        fileName: doc?.fileName ?? null,
        status: doc?.status ?? null,
        createdAt: toIso(doc?.createdAt),
      }))
    : [];

  const activeConditions = conditions.filter((x: any) =>
    ['active', 'current', 'ongoing'].includes(String(x.status || '').toLowerCase()),
  );

  const reproductiveContext = deriveReproductiveContext(localPatient);

  const readiness = calculateReadiness({
    profile: localPatient,
    allergies: allergiesList.length ? allergiesList : legacyAllergies,
    conditions,
    medicalAidPolicies,
    sharingPreference,
    documents,
  });

  const emergencyContact = parseEmergencyContact(localPatient?.emergencyContact);
  const address = buildAddress(localPatient);
  const profileMetadata = safeJsonParse(localPatient?.profileMetadata) || {};

  return {
    id: localPatient.id,
    patientId: localPatient.id,
    userId: localPatient.userId ?? null,

    name: localPatient.name ?? null,
    contactEmail: localPatient.contactEmail ?? null,
    email: localPatient.contactEmail ?? null,
    phone: localPatient.phone ?? null,
    mobile: localPatient.phone ?? null,
    primaryComm: localPatient.primaryComm ?? null,

    dob: dateOnlyIso(localPatient.dob),
    age: ageFromDob(localPatient.dob),
    gender: localPatient.gender ?? null,
    idNumber: localPatient.idNumber ?? null,

    photoUrl: localPatient.photoUrl ?? null,
    avatarUrl: localPatient.photoUrl ?? null,

    address,
    addressLine1: localPatient.addressLine1 ?? null,
    addressLine2: localPatient.addressLine2 ?? null,
    city: localPatient.city ?? null,
    postalCode: localPatient.postalCode ?? null,
    useAsDefaultDelivery: Boolean(localPatient.useAsDefaultDelivery),

    heightCm: localPatient.heightCm ?? null,
    weightKg: localPatient.weightKg ?? null,

    bloodType: (profileMetadata as any)?.bloodType ?? null,

    allergies: allergiesList.length
      ? allergiesList.map((x: any) => x.substance).filter(Boolean)
      : legacyAllergies,
    allergiesList,

    conditions,
    chronicConditions: activeConditions.map((x: any) => x.name).filter(Boolean),
    primaryConditionsText: activeConditions.length
      ? activeConditions.map((x: any) => x.name).join(', ')
      : null,

    emergencyContact,
    reproductiveContext,

    medicalAidSummary: {
      hasPolicy: medicalAidPolicies.length > 0,
      defaultPolicy: medicalAidPolicies.find((x: any) => x.isDefault) ?? medicalAidPolicies[0] ?? null,
      policies: medicalAidPolicies,
    },

    documentSummary: {
      count: documents.length,
      latest: documents[0] ?? null,
      items: documents,
    },

    sharingPreference,
    readiness,

    profileMetadata,

    createdAt: toIso(localPatient.createdAt),
    updatedAt: toIso(localPatient.updatedAt),

    patientRaw: localPatient,
    source: 'local_patient_profile',
  };
}

function shapeGatewayProfile(patient: GatewayPatient, data: any, userId: string) {
  const chronicConditions = Array.isArray(patient.chronicConditions)
    ? patient.chronicConditions
    : [];

  const patientId = patient.patientId || patient.id || '';
  const sharingPreference = defaultSharingPreference(patientId);

  return {
    id: patientId || null,
    patientId: patientId || null,
    userId: patient.userId || userId || null,

    name: patient.name || data?.displayName || null,
    contactEmail: patient.email ?? null,
    email: patient.email ?? null,
    phone: patient.phone || patient.mobile || null,
    mobile: patient.phone || patient.mobile || null,
    primaryComm: null,

    dob: patient.dob ?? null,
    age: patient.age ?? null,
    gender: patient.gender ?? null,
    idNumber: null,

    photoUrl: patient.photoUrl || patient.avatarUrl || null,
    avatarUrl: patient.photoUrl || patient.avatarUrl || null,

    address: patient.address || null,
    addressLine1: patient.address || null,
    addressLine2: null,
    city: null,
    postalCode: null,
    useAsDefaultDelivery: false,

    heightCm: null,
    weightKg: null,

    bloodType: patient.bloodType ?? null,
    allergies: Array.isArray(patient.allergies) ? patient.allergies : [],
    allergiesList: Array.isArray(patient.allergies)
      ? patient.allergies.map((name, index) => ({
          id: `gateway-allergy-${index}`,
          name,
          substance: name,
          reaction: '',
          status: 'Active',
          severity: 'Mild',
        }))
      : [],

    conditions: chronicConditions.map((name, index) => ({
      id: `gateway-condition-${index}`,
      name,
      status: 'Active',
    })),
    chronicConditions,
    primaryConditionsText:
      patient.primaryConditionsText ??
      (chronicConditions.length ? chronicConditions.join(', ') : null),

    emergencyContact: {
      name: '',
      phone: '',
      relationship: '',
      email: '',
    },

    reproductiveContext: {
      source: 'none',
      pregnancyStatus: 'unknown',
      confidencePct: null,
      edd: null,
      gestationalAgeText: null,
      lastEvidenceAt: null,
      note: 'Gateway profile did not include reproductive context.',
    },

    medicalAidSummary: {
      hasPolicy: false,
      defaultPolicy: null,
      policies: [],
    },

    documentSummary: {
      count: 0,
      latest: null,
      items: [],
    },

    sharingPreference,

    readiness: {
      identity: patient.name ? 25 : 0,
      contact: patient.email || patient.mobile || patient.phone ? 50 : 0,
      delivery: patient.address ? 50 : 0,
      emergency: 0,
      clinical: chronicConditions.length || patient.allergies?.length ? 50 : 0,
      medicalAid: 0,
      consent: 0,
      documents: 0,
      devices: null,
      consult: 0,
      claim: 0,
      overall: 0,
    },

    profileMetadata: {},

    patientRaw: data,
    source: 'gateway_patient_profile',
  };
}

async function fetchGatewayProfile(req: NextRequest, userId: string) {
  if (!API) {
    return null;
  }

  const baseUrl = API.replace(/\/+$/, '');
  const target = new URL('/api/patients/profile', baseUrl);

  if (userId) {
    target.searchParams.set('userId', userId);
  }

  const r = await fetch(target.toString(), {
    headers: forwardHeaders(req),
    cache: 'no-store',
  });

  const data = await r.json().catch(() => null);

  if (!r.ok || !data) {
    throw new Error(data?.error || data?.message || `profile_gateway_http_${r.status}`);
  }

  const patient: GatewayPatient = (data?.patient || data?.profile || data || {}) as GatewayPatient;
  return shapeGatewayProfile(patient, data, userId);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = readUserId(req, url);
  const patientId = readPatientId(req, url);

  const localPatient = await readLocalPatientProfile({ userId, patientId });

  if (localPatient) {
    const sharingPreference = await readSharingPreference(localPatient.id);
    const profile = shapeLocalProfile(localPatient, sharingPreference);

    return json({
      ok: true,
      profile,
      ...profile,
    });
  }

  try {
    const gatewayProfile = await fetchGatewayProfile(req, userId);

    if (gatewayProfile) {
      return json({
        ok: true,
        profile: gatewayProfile,
        ...gatewayProfile,
      });
    }
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: err?.message || 'profile_gateway_failed',
        profile: null,
      },
      502,
    );
  }

  return json(
    {
      ok: false,
      error: userId || patientId ? 'patient_profile_not_found' : 'patient_identity_required',
      profile: null,
    },
    userId || patientId ? 404 : 401,
  );
}

function readNumber(value: unknown, mode: 'int' | 'float') {
  if (value === null || value === undefined || value === '') return null;

  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;

  return mode === 'int' ? Math.round(n) : n;
}

function readBool(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    if (raw === 'true' || raw === '1' || raw === 'yes') return true;
    if (raw === 'false' || raw === '0' || raw === 'no') return false;
  }
  return undefined;
}

function parseDateInput(value: unknown) {
  const raw = cleanString(value, 40);
  if (!raw) return null;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;

  return d;
}

function normalizeGender(value: unknown) {
  const raw = cleanString(value, 40).toLowerCase();
  if (!raw) return null;
  if (['female', 'woman', 'f'].includes(raw)) return 'female';
  if (['male', 'man', 'm'].includes(raw)) return 'male';
  if (raw === 'intersex') return 'intersex';
  if (raw === 'unknown' || raw === 'prefer-not-to-say') return raw;
  return cleanString(value, 40);
}

function buildProfileUpdateData(body: any, existing: any) {
  const data: Record<string, any> = {};

  if ('name' in body) data.name = nullableString(body.name, 180);

  if ('contactEmail' in body || 'email' in body) {
    data.contactEmail = nullableString(body.contactEmail ?? body.email, 180);
  }

  if ('phone' in body || 'mobile' in body) {
    data.phone = nullableString(body.phone ?? body.mobile, 80);
  }

  if ('primaryComm' in body) {
    data.primaryComm = nullableString(body.primaryComm, 80);
  }

  if ('dob' in body) {
    const dob = parseDateInput(body.dob);
    if (dob !== undefined) data.dob = dob;
  }

  if ('gender' in body) data.gender = normalizeGender(body.gender);
  if ('idNumber' in body) data.idNumber = nullableString(body.idNumber, 80);

  if ('photoUrl' in body || 'avatarUrl' in body) {
    data.photoUrl = nullableString(body.photoUrl ?? body.avatarUrl, 1000);
  }

  if ('addressLine1' in body || 'address' in body) {
    data.addressLine1 = nullableString(body.addressLine1 ?? body.address, 240);
  }

  if ('addressLine2' in body) data.addressLine2 = nullableString(body.addressLine2, 240);
  if ('city' in body) data.city = nullableString(body.city, 120);
  if ('postalCode' in body) data.postalCode = nullableString(body.postalCode, 40);

  const defaultDelivery = readBool(body.useAsDefaultDelivery);
  if (typeof defaultDelivery === 'boolean') {
    data.useAsDefaultDelivery = defaultDelivery;
  }

  const heightCm = readNumber(body.heightCm, 'int');
  if (heightCm !== undefined) data.heightCm = heightCm;

  const weightKg = readNumber(body.weightKg, 'float');
  if (weightKg !== undefined) data.weightKg = weightKg;

  if ('emergencyContact' in body) {
    const ec = body.emergencyContact || {};
    data.emergencyContact = {
      name: cleanString(ec?.name, 160),
      phone: cleanString(ec?.phone, 80),
      relationship: cleanString(ec?.relationship, 120),
      email: cleanString(ec?.email, 180),
    };
  }

  const metadataPatch: Record<string, any> = {};

  if (
    'profileMetadata' in body &&
    body.profileMetadata &&
    typeof body.profileMetadata === 'object'
  ) {
    Object.assign(metadataPatch, body.profileMetadata);
  }

  if ('bloodType' in body) {
    metadataPatch.bloodType = nullableString(body.bloodType, 40);
  }

  if (Object.keys(metadataPatch).length > 0) {
    const previous = safeJsonParse(existing?.profileMetadata) || {};
    data.profileMetadata = {
      ...(previous as Record<string, any>),
      ...metadataPatch,
    };
  }

  return data;
}

export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({} as any));

    const sessionIdentity = readIdentity(req);
    const requestedUserId =
      cleanString(body?.userId, 160) ||
      readUserId(req, url) ||
      sessionIdentity.userId;

    const requestedPatientId =
      cleanString(body?.patientId, 160) ||
      readPatientId(req, url) ||
      sessionIdentity.patientId;

    const existing = await readLocalPatientProfile({
      userId: requestedUserId,
      patientId: requestedPatientId,
    });

    if (!existing && !requestedUserId) {
      return json(
        {
          ok: false,
          error: 'patient_identity_required',
        },
        401,
      );
    }

    const data = buildProfileUpdateData(body, existing);

    if (Object.keys(data).length === 0 && existing) {
      const sharingPreference = await readSharingPreference(existing.id);
      const profile = shapeLocalProfile(existing, sharingPreference);

      return json({
        ok: true,
        profile,
        ...profile,
      });
    }

    const saved = existing
      ? await prisma.patientProfile.update({
          where: { id: existing.id },
          data,
          include: {
            allergiesRel: {
              orderBy: [{ status: 'asc' }, { recordedAt: 'desc' }],
              take: 50,
            },
            conditions: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
            documents: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
            medicalAidPolicies: {
              orderBy: { updatedAt: 'desc' },
              take: 10,
            },
            ladyCenterProfile: true,
            ladyCenterDayLogs: {
              where: { pregnancyTestPositive: true },
              orderBy: { date: 'desc' },
              take: 1,
            },
          },
        })
      : await prisma.patientProfile.create({
          data: {
            userId: requestedUserId,
            contactEmail: data.contactEmail ?? sessionIdentity.email ?? null,
            name: data.name ?? sessionIdentity.name ?? null,
            ...data,
          },
          include: {
            allergiesRel: true,
            conditions: true,
            documents: true,
            medicalAidPolicies: true,
            ladyCenterProfile: true,
            ladyCenterDayLogs: {
              where: { pregnancyTestPositive: true },
              orderBy: { date: 'desc' },
              take: 1,
            },
          },
        });

    const sharingPreference = await readSharingPreference(saved.id);
    const profile = shapeLocalProfile(saved, sharingPreference);

    return json({
      ok: true,
      profile,
      ...profile,
    });
  } catch (err: any) {
    console.error('profile.patch.error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_save_profile',
      },
      500,
    );
  }
}

// Backward compatibility for older clients.
// Long-term, the page should call PATCH.
export async function POST(req: NextRequest) {
  return PATCH(req);
}