import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, requireTrustedIdentityInProduction } from '@/src/lib/identity';
import { computeClinicianOperationalState } from '@/src/lib/clinician-operational-state';
import { loadClinicianComplianceChecks } from '@/src/lib/credentialing/loadChecks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Coding = {
  system: string;
  code: string;
  display: string;
};

type MedicationDto = {
  coding: Coding[];
  formText?: string;
  strengthText?: string;
  doseText?: string;
  routeText?: string;
  frequencyText?: string;
  durationText?: string;
  quantity?: { value?: number; unit?: string; text?: string };
  repeats?: number;
  note?: string;
};

type LabDto = {
  testText: string;
  testCoding?: Coding;
  priority?: 'Routine' | 'Urgent' | 'Stat';
  specimenText?: string;
  icd10?: Coding;
  note?: string;
};

type AllergyDto = {
  coding?: Coding[];
  substanceText?: string;
  substance?: string;
  name?: string;
  allergen?: string;
  reactionText?: string | null;
  reaction?: string | null;
  severity?: string | null;
  status?: string | null;
  recordedAt?: string | null;
};

type ErxDto = {
  encounterId: string;
  patient: { id: string; name?: string };
  clinician: { id: string; name?: string };
  reason?: string;
  medications: MedicationDto[];
  labs: LabDto[];
  allergies?: AllergyDto[];
  note?: string;
  authorization?: Record<string, unknown>;
};

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function optionalString(value: unknown, max = 4000): string | null {
  const v = clean(value, max);
  return v ? v : null;
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function firstCoding(codings: Coding[] | undefined, preferredSystems?: string[]) {
  const list = Array.isArray(codings) ? codings : [];
  if (!list.length) return null;

  if (preferredSystems?.length) {
    for (const sys of preferredSystems) {
      const found = list.find(
        (c) =>
          typeof c?.system === 'string' &&
          c.system.toLowerCase().includes(sys.toLowerCase()),
      );
      if (found) return found;
    }
  }

  return list[0] ?? null;
}

function parseScheduleValue(text: string): number | null {
  const m = String(text || '').match(/schedule\s*([1-8])/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function inferMedicationSchedule(med: MedicationDto): number | null {
  const text = [
    optionalString(firstCoding(med.coding, ['rxnorm', 'nappi'])?.display, 300),
    optionalString(firstCoding(med.coding, ['rxnorm', 'nappi'])?.code, 120),
    optionalString(med.note, 500),
    optionalString(med.frequencyText, 120),
    optionalString(med.durationText, 120),
    optionalString(med.formText, 120),
  ]
    .filter(Boolean)
    .join(' ');

  return parseScheduleValue(text);
}

function highestRequestedSchedule(meds: MedicationDto[]) {
  let maxFound: number | null = null;
  for (const med of meds) {
    const n = inferMedicationSchedule(med);
    if (n != null) maxFound = maxFound == null ? n : Math.max(maxFound, n);
  }
  return maxFound;
}

function medicationSnapshot(med: MedicationDto, authoredAt: string) {
  const primary = firstCoding(med.coding, ['nappi', 'rxnorm']);
  const quantityText =
    optionalString(med.quantity?.text, 200) ||
    (typeof med.quantity?.value === 'number'
      ? `${med.quantity.value}${med.quantity.unit ? ` ${med.quantity.unit}` : ''}`
      : null);

  return {
    coding: Array.isArray(med.coding) ? med.coding : [],
    primaryCoding: primary
      ? { system: primary.system, code: primary.code, display: primary.display }
      : null,
    formText: optionalString(med.formText, 200),
    strengthText: optionalString(med.strengthText, 200),
    doseText: optionalString(med.doseText, 200),
    routeText: optionalString(med.routeText, 120),
    frequencyText: optionalString(med.frequencyText, 200),
    durationText: optionalString(med.durationText, 200),
    quantity: med.quantity ?? null,
    quantityText,
    repeats:
      typeof med.repeats === 'number' && Number.isFinite(med.repeats)
        ? med.repeats
        : 0,
    note: optionalString(med.note, 2000),
    authoredAt,
  };
}

function medicationSigParts(med: MedicationDto) {
  return [
    optionalString(med.doseText, 200),
    optionalString(med.routeText, 120),
    optionalString(med.frequencyText, 200),
    optionalString(med.durationText, 200),
  ].filter(Boolean) as string[];
}

function medicationSigDisplay(med: MedicationDto) {
  const parts = medicationSigParts(med);
  return parts.length ? parts.join(' | ') : 'Use as directed';
}

function labSnapshot(lab: LabDto, authoredAt: string) {
  return {
    testText: optionalString(lab.testText, 500) || 'Lab order',
    testCoding: lab.testCoding
      ? {
          system: optionalString(lab.testCoding.system, 120),
          code: optionalString(lab.testCoding.code, 120),
          display: optionalString(lab.testCoding.display, 500),
        }
      : null,
    priority: optionalString(lab.priority, 40) || 'Routine',
    specimenText: optionalString(lab.specimenText, 200),
    note: optionalString(lab.note, 2000),
    icd10: lab.icd10
      ? {
          system: lab.icd10.system,
          code: lab.icd10.code,
          display: lab.icd10.display,
        }
      : null,
    authoredAt,
  };
}


type NormalizedAllergy = {
  source: 'client' | 'database';
  id?: string | null;
  substanceText: string;
  coding: Coding[];
  reactionText?: string | null;
  severity?: string | null;
  status?: string | null;
  recordedAt?: string | null;
};

function normalizeForMatch(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function meaningfulTerm(value: unknown) {
  const v = normalizeForMatch(value);
  return v.length >= 4 ? v : '';
}

function normalizeAllergyRecord(raw: any, source: 'client' | 'database'): NormalizedAllergy | null {
  const substanceText =
    optionalString(raw?.substanceText, 300) ||
    optionalString(raw?.substance, 300) ||
    optionalString(raw?.name, 300) ||
    optionalString(raw?.allergen, 300) ||
    optionalString(raw?.display, 300);

  const coding = Array.isArray(raw?.coding)
    ? raw.coding
    : Array.isArray(raw?.codings)
      ? raw.codings
      : [];

  if (!substanceText && coding.length === 0) return null;

  return {
    source,
    id: optionalString(raw?.id, 120),
    substanceText: substanceText || optionalString(coding?.[0]?.display, 300) || 'Allergy',
    coding,
    reactionText:
      optionalString(raw?.reactionText, 500) ||
      optionalString(raw?.reaction, 500) ||
      optionalString(raw?.reactionName, 500),
    severity: optionalString(raw?.severity, 80),
    status: optionalString(raw?.status, 80),
    recordedAt:
      optionalString(raw?.recordedAt, 80) ||
      optionalString(raw?.createdAt, 80) ||
      optionalString(raw?.updatedAt, 80),
  };
}

function isActiveAllergy(allergy: NormalizedAllergy) {
  const s = normalizeForMatch(allergy.status);
  if (!s) return true;
  if (s.includes('entered in error')) return false;
  if (s.includes('resolved') || s.includes('inactive')) return false;
  return true;
}

function isSevereAllergy(allergy: NormalizedAllergy) {
  const s = normalizeForMatch(allergy.severity);
  return s.includes('severe') || s.includes('critical') || s.includes('high');
}

function recentAllergyReactions(allergies: NormalizedAllergy[], days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return allergies
    .filter((a) => {
      if (!a.recordedAt) return false;
      const t = Date.parse(a.recordedAt);
      return Number.isFinite(t) && t >= cutoff;
    })
    .map((a) => ({
      substanceText: a.substanceText,
      reactionText: a.reactionText ?? null,
      severity: a.severity ?? null,
      status: a.status ?? null,
      recordedAt: a.recordedAt ?? null,
    }));
}

function medicationSearchTerms(med: MedicationDto) {
  const anyMed = med as any;
  const coding = Array.isArray(med.coding) ? med.coding : [];

  return [
    optionalString(anyMed.drug, 500),
    optionalString(anyMed.name, 500),
    optionalString(anyMed.display, 500),
    optionalString(firstCoding(coding, ['nappi', 'rxnorm'])?.display, 500),
    optionalString(firstCoding(coding, ['nappi', 'rxnorm'])?.code, 120),
    ...coding.flatMap((c) => [optionalString(c.display, 500), optionalString(c.code, 120)]),
    optionalString(med.note, 1000),
  ]
    .map(meaningfulTerm)
    .filter(Boolean);
}

function allergySearchTerms(allergy: NormalizedAllergy) {
  return [
    allergy.substanceText,
    ...(allergy.coding || []).flatMap((c) => [c.display, c.code]),
  ]
    .map(meaningfulTerm)
    .filter(Boolean);
}

function findMedicationAllergyConflicts(
  meds: MedicationDto[],
  allergies: NormalizedAllergy[],
) {
  const active = allergies.filter(isActiveAllergy);
  const conflicts: Array<{
    medicationIndex: number;
    medicationName: string;
    allergySubstance: string;
    severity: string | null;
    reaction: string | null;
    status: string | null;
    matchedTerm: string;
    source: string;
  }> = [];

  meds.forEach((med, medicationIndex) => {
    const medTerms = medicationSearchTerms(med);
    const medName =
      optionalString((med as any).drug, 500) ||
      optionalString((med as any).name, 500) ||
      optionalString(firstCoding(med.coding, ['nappi', 'rxnorm'])?.display, 500) ||
      optionalString(firstCoding(med.coding, ['nappi', 'rxnorm'])?.code, 120) ||
      `Medication ${medicationIndex + 1}`;

    for (const allergy of active) {
      for (const allergyTerm of allergySearchTerms(allergy)) {
        const matched = medTerms.find(
          (m) => m.includes(allergyTerm) || allergyTerm.includes(m),
        );

        if (matched) {
          conflicts.push({
            medicationIndex,
            medicationName: medName,
            allergySubstance: allergy.substanceText,
            severity: allergy.severity ?? null,
            reaction: allergy.reactionText ?? null,
            status: allergy.status ?? null,
            matchedTerm: allergyTerm,
            source: allergy.source,
          });
          break;
        }
      }
    }
  });

  return conflicts;
}

type NormalizedCurrentMedication = {
  source: 'database';
  id: string | null;
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  status: string | null;
  codes: string[];
  updatedAt: string | null;
};

function isActiveMedicationStatus(value: unknown) {
  const raw = normalizeForMatch(value);
  if (!raw) return true;
  if (raw.includes('completed') || raw.includes('stopped') || raw.includes('inactive')) return false;
  if (raw.includes('cancelled') || raw.includes('canceled') || raw.includes('discontinued')) return false;
  return true;
}

function medicationCodesFromRecord(raw: any) {
  const codes = [
    optionalString(raw?.dispenseCode, 120),
    optionalString(raw?.rxnorm, 120),
    optionalString(raw?.rxNorm, 120),
    optionalString(raw?.rxNormCode, 120),
    optionalString(raw?.nappi, 120),
    optionalString(raw?.nappiCode, 120),
    optionalString(raw?.code, 120),
  ];

  const coding = Array.isArray(raw?.coding)
    ? raw.coding
    : Array.isArray(raw?.codings)
      ? raw.codings
      : [];

  for (const c of coding) {
    codes.push(optionalString(c?.code, 120));
    codes.push(optionalString(c?.display, 500));
  }

  return Array.from(new Set(codes.map((x) => clean(x, 500)).filter(Boolean)));
}

function normalizeCurrentMedicationRecord(raw: any): NormalizedCurrentMedication | null {
  if (!raw || typeof raw !== 'object') return null;

  const name =
    optionalString(raw?.name, 500) ||
    optionalString(raw?.drug, 500) ||
    optionalString(raw?.display, 500) ||
    optionalString(raw?.title, 500);

  if (!name) return null;

  const status = optionalString(raw?.status, 80) || 'Active';
  if (!isActiveMedicationStatus(status)) return null;

  return {
    source: 'database',
    id: optionalString(raw?.id || raw?.medicationId || raw?.orderId, 120),
    name,
    dose: optionalString(raw?.dose, 200),
    frequency: optionalString(raw?.frequency, 200),
    route: optionalString(raw?.route, 120),
    status,
    codes: medicationCodesFromRecord(raw),
    updatedAt:
      optionalString(raw?.updatedAt, 80) ||
      optionalString(raw?.createdAt, 80),
  };
}

function medicationDisplayName(med: MedicationDto, medicationIndex: number) {
  return (
    optionalString((med as any).drug, 500) ||
    optionalString((med as any).name, 500) ||
    optionalString((med as any).display, 500) ||
    optionalString(firstCoding(med.coding, ['nappi', 'rxnorm'])?.display, 500) ||
    optionalString(firstCoding(med.coding, ['nappi', 'rxnorm'])?.code, 120) ||
    `Medication ${medicationIndex + 1}`
  );
}

function currentMedicationTerms(row: NormalizedCurrentMedication) {
  return [
    row.name,
    ...row.codes,
  ]
    .map(meaningfulTerm)
    .filter(Boolean);
}

function isMeaningfulMedicationNameMatch(a: string, b: string) {
  if (!a || !b) return false;
  if (a.length < 4 || b.length < 4) return false;

  const genericTerms = new Set([
    'tablet',
    'tablets',
    'capsule',
    'capsules',
    'daily',
    'oral',
    'mouth',
    'dose',
    'doses',
    'take',
    'directed',
    'routine',
  ]);

  if (genericTerms.has(a) || genericTerms.has(b)) return false;
  if (a === b) return true;

  const min = Math.min(a.length, b.length);
  if (min < 6) return false;

  return a.includes(b) || b.includes(a);
}

function findCurrentMedicationAdvisories(
  meds: MedicationDto[],
  currentMeds: NormalizedCurrentMedication[],
) {
  const advisories: Array<{
    medicationIndex: number;
    medicationName: string;
    currentMedicationId: string | null;
    currentMedicationName: string;
    currentDose: string | null;
    currentFrequency: string | null;
    currentRoute: string | null;
    currentStatus: string | null;
    matchedTerm: string;
    advisory: 'possible_duplicate_or_continuation';
  }> = [];

  meds.forEach((med, medicationIndex) => {
    const requestedTerms = medicationSearchTerms(med);
    const requestedName = medicationDisplayName(med, medicationIndex);

    for (const current of currentMeds) {
      const currentTerms = currentMedicationTerms(current);
      const matchedTerm = currentTerms.find((currentTerm) =>
        requestedTerms.some((requestedTerm) =>
          isMeaningfulMedicationNameMatch(requestedTerm, currentTerm),
        ),
      );

      if (!matchedTerm) continue;

      advisories.push({
        medicationIndex,
        medicationName: requestedName,
        currentMedicationId: current.id,
        currentMedicationName: current.name,
        currentDose: current.dose,
        currentFrequency: current.frequency,
        currentRoute: current.route,
        currentStatus: current.status,
        matchedTerm,
        advisory: 'possible_duplicate_or_continuation',
      });
      break;
    }
  });

  return advisories;
}

async function loadCurrentMedicationSafety(patientId: string, meds: MedicationDto[]) {
  const base = {
    checked: false,
    mode: 'advisory_only' as const,
    blocked: false,
    clinicianMayProceed: true,
    activeMedicationCount: 0,
    potentialDuplicateCount: 0,
    advisories: [] as ReturnType<typeof findCurrentMedicationAdvisories>,
    error: null as string | null,
  };

  try {
    const prismaAny = prisma as any;
    const delegate = prismaAny?.medication;

    if (!delegate?.findMany) {
      return {
        ...base,
        checked: false,
        error: 'medication_model_unavailable',
      };
    }

    const rows = await delegate.findMany({
      where: { patientId },
      take: 100,
    });

    const currentMeds = Array.isArray(rows)
      ? rows.map(normalizeCurrentMedicationRecord).filter(Boolean) as NormalizedCurrentMedication[]
      : [];

    const advisories = findCurrentMedicationAdvisories(meds, currentMeds);

    return {
      checked: true,
      mode: 'advisory_only' as const,
      blocked: false,
      clinicianMayProceed: true,
      activeMedicationCount: currentMeds.length,
      potentialDuplicateCount: advisories.length,
      advisories,
      error: null,
    };
  } catch (err: any) {
    return {
      ...base,
      checked: false,
      error: String(err?.message || 'current_medication_safety_unavailable'),
    };
  }
}

async function loadAllergiesForSafety(patientId: string, clientAllergies: unknown) {
  const normalized: NormalizedAllergy[] = [];

  if (Array.isArray(clientAllergies)) {
    for (const a of clientAllergies) {
      const n = normalizeAllergyRecord(a, 'client');
      if (n) normalized.push(n);
    }
  }

  const prismaAny = prisma as any;
  const candidateModels = ['patientAllergy', 'allergy', 'allergyIntolerance'];

  for (const model of candidateModels) {
    try {
      const delegate = prismaAny?.[model];
      if (!delegate?.findMany) continue;

      const rows = await delegate.findMany({
        where: { patientId },
        take: 100,
      });

      if (Array.isArray(rows)) {
        for (const row of rows) {
          const n = normalizeAllergyRecord(row, 'database');
          if (n) normalized.push(n);
        }
      }
    } catch {
      // Some environments may not have this model/shape. Client allergies still protect the flow.
    }
  }

  const seen = new Set<string>();
  return normalized.filter((a) => {
    const key = `${normalizeForMatch(a.substanceText)}|${normalizeForMatch(a.reactionText)}|${normalizeForMatch(a.status)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => clean(value, 240)).filter(Boolean)));
}

function participantRefs(participant: any) {
  const partyId = clean(participant?.partyId, 240);
  return unique([
    participant?.clinicianId,
    participant?.userId,
    partyId,
    partyId.replace(/^clin?[-_:]/i, ''),
  ]);
}

async function resolveClinicianIdentity(who: ReturnType<typeof readIdentity>, requestedId?: string | null) {
  const identityRefs = unique([who.uid, who.actorRefId, requestedId]);
  if (!identityRefs.length) return { clinician: null, refs: [] as string[] };

  const clinician = await prisma.clinicianProfile.findFirst({
    where: {
      OR: identityRefs.flatMap((value) => [{ id: value }, { userId: value }]),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!clinician) return { clinician: null, refs: identityRefs };
  return {
    clinician,
    refs: unique([...identityRefs, clinician.id, clinician.userId]),
  };
}

function clinicianCanAccessEncounter(encounter: any, refs: string[]) {
  if (!refs.length) return false;
  const matches = (value: unknown) => refs.includes(clean(value, 240));
  if (matches(encounter?.clinicianId)) return true;

  return (encounter?.appointments || []).some((appointment: any) => {
    if (matches(appointment?.clinicianId)) return true;
    return (appointment?.participants || []).some((participant: any) => {
      const role = clean(participant?.role, 80).toUpperCase();
      const status = clean(participant?.status, 80).toUpperCase();
      if (!['LEAD_CLINICIAN', 'CO_CLINICIAN', 'ADVISOR'].includes(role)) return false;
      if (status && !['ACCEPTED', 'JOINED'].includes(status)) return false;
      return participantRefs(participant).some((ref) => refs.includes(ref));
    });
  });
}

function normalizedScope(value: unknown): 'medications' | 'labs' | 'all' {
  const scope = clean(value, 40).toLowerCase();
  if (scope === 'medications' || scope === 'labs') return scope;
  return 'all';
}

function normalizedAction(value: unknown): 'save-draft' | 'finalize' {
  return clean(value, 40).toLowerCase() === 'save-draft' ? 'save-draft' : 'finalize';
}

function parseNotesJson(value: unknown) {
  if (!value) return {} as Record<string, any>;
  if (typeof value === 'object') return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function medDraftFromOrder(order: any) {
  const snapshot = Array.isArray(order?.meds) ? order.meds[0] : null;
  const notes = parseNotesJson(order?.notes);
  const coding = Array.isArray(snapshot?.coding) ? snapshot.coding : [];
  const rxnorm = coding.find((item: any) => clean(item?.system, 80).toLowerCase().includes('rxnorm'));
  const nappi = coding.find((item: any) => clean(item?.system, 80).toLowerCase().includes('nappi'));
  return {
    drug: clean(order?.drug || snapshot?.primaryCoding?.display, 500),
    strength: clean(snapshot?.strengthText, 200),
    form: clean(snapshot?.formText, 200),
    dose: clean(snapshot?.doseText, 200),
    route: clean(snapshot?.routeText, 120),
    freq: clean(snapshot?.frequencyText, 200),
    duration: clean(snapshot?.durationText, 200),
    qty: clean(snapshot?.quantityText || snapshot?.quantity?.text, 200),
    refills: Number(snapshot?.repeats ?? notes?.repeats ?? 0) || 0,
    notes: clean(snapshot?.note || notes?.note, 2000),
    rxcui: clean(rxnorm?.code, 120) || undefined,
    nappi: clean(nappi?.code, 120) || undefined,
  };
}

function labDraftFromOrder(order: any) {
  const snapshot = Array.isArray(order?.tests) ? order.tests[0] : null;
  return {
    test: clean(snapshot?.testText || order?.panel, 500),
    priority: clean(snapshot?.priority, 40),
    specimen: clean(snapshot?.specimenText, 200),
    icd: clean(snapshot?.icd10?.code || snapshot?.icd10?.display, 120),
    instructions: clean(snapshot?.note, 2000),
    catalogCode: clean(snapshot?.testCoding?.code, 120) || undefined,
    catalogSystem: clean(snapshot?.testCoding?.system, 120) || undefined,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const who = readIdentity(req.headers);
    try { requireTrustedIdentityInProduction(req.headers, who); } catch {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    if (!who?.uid) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    if (!['clinician', 'admin', 'admin_staff'].includes(clean(who.role, 40).toLowerCase())) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const encounterId = clean(params.id, 120);
    if (!encounterId) return NextResponse.json({ ok: false, error: 'encounter_id_required' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as (ErxDto & Record<string, any>) | null;
    if (!body) return NextResponse.json({ ok: false, error: 'invalid_json_body' }, { status: 400 });

    const action = normalizedAction(body.action);
    const scope = normalizedScope(body.scope);
    const meds = scope === 'labs' ? [] : (Array.isArray(body.medications) ? body.medications : []);
    const labs = scope === 'medications' ? [] : (Array.isArray(body.labs) ? body.labs : []);

    if (meds.length === 0 && labs.length === 0) {
      return NextResponse.json({ ok: false, error: 'at_least_one_order_required' }, { status: 400 });
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        appointments: {
          orderBy: { startsAt: 'desc' },
          take: 20,
          include: {
            participants: {
              select: { partyId: true, role: true, status: true, clinicianId: true, userId: true },
            },
          },
        },
      },
    });
    if (!encounter) return NextResponse.json({ ok: false, error: 'encounter_not_found' }, { status: 404 });

    const requestedClinicianId = optionalString(body?.clinician?.id, 120);
    const identity = await resolveClinicianIdentity(who, requestedClinicianId);
    if (!identity.clinician) return NextResponse.json({ ok: false, error: 'clinician_not_found' }, { status: 404 });
    if (clean(who.role, 40).toLowerCase() === 'clinician' && !clinicianCanAccessEncounter(encounter, identity.refs)) {
      return NextResponse.json({ ok: false, error: 'forbidden_encounter_scope' }, { status: 403 });
    }

    const clinician = identity.clinician;
    const patientId = optionalString(body?.patient?.id, 120) || encounter.patientId;
    if (!patientId) return NextResponse.json({ ok: false, error: 'patient_id_required' }, { status: 400 });
    if (encounter.patientId && patientId !== encounter.patientId) {
      return NextResponse.json({ ok: false, error: 'patient_mismatch' }, { status: 409 });
    }

    const onboarding = await prisma.clinicianOnboarding.findFirst({
      where: { clinicianId: clinician.id },
      orderBy: { createdAt: 'desc' },
    });
    const trainingSlot = onboarding?.trainingSlotId
      ? await prisma.clinicianTrainingSlot.findUnique({ where: { id: onboarding.trainingSlotId } })
      : null;
    const dispatch = await prisma.clinicianDispatch.findFirst({
      where: { clinicianId: clinician.id },
      orderBy: { createdAt: 'desc' },
    });
    const checks = await loadClinicianComplianceChecks({
      clinicianId: clinician.id,
      orgId: clean((who as any).orgId || (encounter as any).orgId || '', 120),
    });
    const operational = computeClinicianOperationalState({ clinician, onboarding, trainingSlot, dispatch, checks });

    if (!operational.canPractice) {
      return NextResponse.json({ ok: false, error: 'practice_not_enabled', blockers: operational.blockers, operational }, { status: 403 });
    }
    if (!operational.allowedWorkspaces.includes('erx')) {
      return NextResponse.json({ ok: false, error: 'workspace_not_authorized', blockers: operational.blockers, operational }, { status: 403 });
    }

    // Drafting is allowed without silently turning the draft into a clinical order.
    // Medication finalization, and only medication finalization, requires prescribing authority.
    if (action === 'finalize' && meds.length > 0 && !operational.canPrescribe) {
      return NextResponse.json({
        ok: false,
        error: 'prescribing_not_authorized',
        blockers: operational.blockers,
        riskFlags: operational.riskFlags,
        operational,
      }, { status: 403 });
    }

    const requestedMaxSchedule = highestRequestedSchedule(meds);
    if (
      action === 'finalize' && meds.length > 0 && requestedMaxSchedule != null &&
      typeof operational.maxRxSchedule === 'number' && requestedMaxSchedule > operational.maxRxSchedule
    ) {
      return NextResponse.json({
        ok: false,
        error: 'max_schedule_exceeded',
        requestedMaxSchedule,
        maxRxSchedule: operational.maxRxSchedule,
        operational,
      }, { status: 403 });
    }

    let allergiesForSafety: NormalizedAllergy[] = [];
    let severeAllergies: NormalizedAllergy[] = [];
    let recentReactions: ReturnType<typeof recentAllergyReactions> = [];
    let currentMedicationSafety: Awaited<ReturnType<typeof loadCurrentMedicationSafety>> | null = null;

    if (action === 'finalize' && meds.length > 0) {
      allergiesForSafety = await loadAllergiesForSafety(patientId, body.allergies);
      const allergyConflicts = findMedicationAllergyConflicts(meds, allergiesForSafety);
      severeAllergies = allergiesForSafety.filter((allergy) => isActiveAllergy(allergy) && isSevereAllergy(allergy));
      recentReactions = recentAllergyReactions(allergiesForSafety, 30);
      currentMedicationSafety = await loadCurrentMedicationSafety(patientId, meds);

      if (currentMedicationSafety.potentialDuplicateCount > 0) {
        await prisma.auditEvent.create({
          data: {
            kind: 'erx_current_medication_advisory_detected',
            actorId: who.uid,
            actorRole: who.role,
            subjectId: encounterId,
            meta: jsonSafe({ patientId, clinicianId: clinician.id, currentMedicationSafety }) as any,
          },
        }).catch(() => null);
      }

      if (allergyConflicts.length > 0) {
        await prisma.auditEvent.create({
          data: {
            kind: 'erx_allergy_conflict_blocked',
            actorId: who.uid,
            actorRole: who.role,
            subjectId: encounterId,
            meta: jsonSafe({ patientId, clinicianId: clinician.id, conflicts: allergyConflicts }) as any,
          },
        }).catch(() => null);
        return NextResponse.json({
          ok: false,
          error: 'ALLERGY_CONFLICT',
          message: 'Prescription blocked because one or more medications conflict with an active patient allergy.',
          conflicts: allergyConflicts,
          currentMedicationSafety,
        }, { status: 409 });
      }
    }

    const authoredAt = new Date().toISOString();
    const finalStatus = action === 'finalize' ? 'issued' : 'draft';

    const createdOrders = await prisma.$transaction(async (tx) => {
      const erxOrders: any[] = [];
      const labOrders: any[] = [];

      if (meds.length > 0) {
        await tx.erxOrder.deleteMany({
          where: { encounterId, clinicianId: clinician.id, kind: 'medication', status: 'draft' },
        });
      }
      if (labs.length > 0) {
        await tx.labOrder.deleteMany({
          where: { encounterId, clinicianId: clinician.id, kind: 'lab', status: 'draft' },
        });
      }

      for (const med of meds) {
        const primaryCoding = firstCoding(med.coding, ['nappi', 'rxnorm']);
        const display = optionalString(primaryCoding?.display, 500) || optionalString(primaryCoding?.code, 120) || 'Medication';
        const sigDisplay = medicationSigDisplay(med);
        const snapshot = medicationSnapshot(med, authoredAt);
        const integrityPayload = jsonSafe({ encounterId, patientId, clinicianId: clinician.id, snapshot, authoredAt });
        const signatureHash = action === 'finalize'
          ? createHash('sha256').update(JSON.stringify(integrityPayload)).digest('hex')
          : null;

        const created = await tx.erxOrder.create({
          data: {
            encounterId,
            patientId,
            clinicianId: clinician.id,
            drug: display,
            sig: sigDisplay,
            dispenseCode: primaryCoding?.code ?? null,
            status: finalStatus,
            kind: 'medication',
            meds: jsonSafe([snapshot]) as any,
            labTests: jsonSafe([]) as any,
            notes: JSON.stringify({
              note: optionalString(med.note, 2000),
              reason: optionalString(body.reason, 1000),
              orderState: action === 'finalize' ? 'issued' : 'draft',
              authorRole: 'clinician',
              fulfilmentOwner: 'patient',
              marketplaceRouting: action === 'finalize' ? 'patient_action_required' : 'not_available_until_issued',
              carePortDispatched: false,
              medReachDispatched: false,
              authorization: action === 'finalize' ? {
                gatewayEvaluated: true,
                canPrescribe: operational.canPrescribe,
                prescribingMode: operational.prescribingMode,
                maxRxSchedule: operational.maxRxSchedule,
                requestedMaxSchedule,
              } : { gatewayEvaluated: false, draftOnly: true },
              allergySafety: action === 'finalize' ? {
                checked: true,
                blocked: false,
                severeAllergyCount: severeAllergies.length,
                recentReactions,
                allergyCount: allergiesForSafety.length,
              } : { checked: false, draftOnly: true },
              currentMedicationSafety,
              authoredAt,
            }),
            signedAt: action === 'finalize' ? new Date(authoredAt) : null,
            signatureHash,
          } as any,
        });
        erxOrders.push(created);
      }

      for (const lab of labs) {
        const snapshot = labSnapshot(lab, authoredAt);
        const created = await tx.labOrder.create({
          data: {
            encounterId,
            patientId,
            clinicianId: clinician.id,
            panel: snapshot.testText,
            status: action === 'finalize' ? 'issued' : 'draft',
            kind: 'lab',
            tests: jsonSafe([snapshot]) as any,
            icd10Codes: jsonSafe(snapshot.icd10?.code ? [snapshot.icd10.code] : []) as any,
            authorizationSnapshot: jsonSafe({
              orderState: action === 'finalize' ? 'issued' : 'draft',
              authorRole: 'clinician',
              fulfilmentOwner: 'patient',
              marketplaceRouting: action === 'finalize' ? 'patient_action_required' : 'not_available_until_issued',
              carePortDispatched: false,
              medReachDispatched: false,
              authoredAt,
            }) as any,
          } as any,
        });
        labOrders.push(created);
      }

      if (action === 'finalize') {
        await tx.auditEvent.create({
          data: {
            kind: scope === 'labs' ? 'encounter_lab_orders_issued' : scope === 'medications' ? 'encounter_erx_issued' : 'encounter_orders_issued',
            actorId: who.uid,
            actorRole: who.role,
            subjectId: encounterId,
            meta: jsonSafe({ patientId, clinicianId: clinician.id, medicationCount: erxOrders.length, labCount: labOrders.length }) as any,
          },
        }).catch(() => null);
      }

      return { erxOrders, labOrders };
    });

    return NextResponse.json({
      ok: true,
      encounterId,
      patientId,
      clinicianId: clinician.id,
      action,
      scope,
      status: action === 'finalize' ? 'issued' : 'draft',
      medications: createdOrders.erxOrders,
      labs: createdOrders.labOrders,
      allergySafety: action === 'finalize' && meds.length > 0 ? {
        checked: true,
        blocked: false,
        severeAllergyCount: severeAllergies.length,
        recentReactions,
        allergyCount: allergiesForSafety.length,
      } : null,
      currentMedicationSafety,
      operational: {
        canPrescribe: operational.canPrescribe,
        prescribingMode: operational.prescribingMode,
        maxRxSchedule: operational.maxRxSchedule,
      },
      routing: {
        fulfilmentOwner: 'patient',
        carePortDispatched: false,
        medReachDispatched: false,
        marketplaceRouting: action === 'finalize' ? 'patient_action_required' : 'not_available_until_issued',
      },
    }, {
      status: action === 'finalize' ? 201 : 200,
      headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
    });
  } catch (err: any) {
    console.error('[api-gateway][encounters/:id/erx][POST] error', err);
    return NextResponse.json({ ok: false, error: String(err?.message || 'failed_to_create_erx') }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const who = readIdentity(req.headers);
    try { requireTrustedIdentityInProduction(req.headers, who); } catch {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    if (!who?.uid) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const encounterId = clean(params.id, 120);
    if (!encounterId) return NextResponse.json({ ok: false, error: 'encounter_id_required' }, { status: 400 });

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        appointments: {
          orderBy: { startsAt: 'desc' },
          take: 20,
          include: {
            participants: { select: { partyId: true, role: true, status: true, clinicianId: true, userId: true } },
          },
        },
      },
    });
    if (!encounter) return NextResponse.json({ ok: false, error: 'encounter_not_found' }, { status: 404 });

    const identity = await resolveClinicianIdentity(who);
    const privileged = ['admin', 'admin_staff'].includes(clean(who.role, 40).toLowerCase());
    if (!privileged && (!identity.clinician || !clinicianCanAccessEncounter(encounter, identity.refs))) {
      return NextResponse.json({ ok: false, error: 'forbidden_encounter_scope' }, { status: 403 });
    }

    const [erxOrders, labOrders] = await Promise.all([
      prisma.erxOrder.findMany({ where: { encounterId }, orderBy: { createdAt: 'desc' } }),
      prisma.labOrder.findMany({ where: { encounterId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const clinicianId = identity.clinician?.id || null;
    const draftMedOrders = clinicianId
      ? erxOrders.filter((order: any) => order.clinicianId === clinicianId && order.kind === 'medication' && order.status === 'draft').reverse()
      : [];
    const draftLabOrders = clinicianId
      ? labOrders.filter((order: any) => order.clinicianId === clinicianId && order.kind === 'lab' && order.status === 'draft').reverse()
      : [];

    return NextResponse.json({
      ok: true,
      encounterId,
      erxOrders,
      labOrders,
      draft: {
        medications: draftMedOrders.map(medDraftFromOrder),
        labs: draftLabOrders.map(labDraftFromOrder),
        hasMedicationDraft: draftMedOrders.length > 0,
        hasLabDraft: draftLabOrders.length > 0,
      },
    }, {
      headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
    });
  } catch (err: any) {
    console.error('[api-gateway][encounters/:id/erx][GET] error', err);
    return NextResponse.json({ ok: false, error: String(err?.message || 'failed_to_list_erx') }, { status: 500 });
  }
}
