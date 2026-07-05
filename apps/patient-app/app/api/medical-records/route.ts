import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FetchResult = {
  ok: boolean;
  status: number;
  payload: any;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function toIso(value: unknown) {
  if (!value) return new Date().toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function arrayFromPayload(payload: any, keys: string[]) {
  for (const key of keys) {
    const value = payload?.[key];
    if (Array.isArray(value)) return value;
  }

  if (Array.isArray(payload)) return payload;
  return [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const s = clean(value, 500);
    if (s) return s;
  }
  return '';
}

function sameOriginBase(req: NextRequest) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-patient-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-org-id',
    'x-current-patient-id',
    'x-actor-ref-id',
    'x-correlation-id',
    'x-request-id',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  if (!headers.has('x-role')) headers.set('x-role', 'patient');

  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function fetchJson(req: NextRequest, path: string): Promise<FetchResult> {
  try {
    const res = await fetch(`${sameOriginBase(req)}${path}`, {
      method: 'GET',
      cache: 'no-store',
      headers: forwardHeaders(req),
    });

    return {
      ok: res.ok,
      status: res.status,
      payload: await readPayload(res),
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 503,
      payload: { ok: false, error: error?.message || 'fetch_failed' },
    };
  }
}

function normalizeEncounter(row: any) {
  if (!row || typeof row !== 'object') return null;

  const id = clean(row.id || row.encounterId, 180);
  if (!id) return null;

  const clinician = row.clinician && typeof row.clinician === 'object' ? row.clinician : null;
  const summary = row.summaryPayload && typeof row.summaryPayload === 'object' ? row.summaryPayload : null;

  const date = toIso(
    row.endedAt ||
      row.stop ||
      row.startedAt ||
      row.start ||
      row.primaryTime ||
      row.updatedAt ||
      row.createdAt,
  );

  const reason = firstText(
    row.reason,
    row.caseTitle,
    row.title,
    summary?.reason,
    summary?.diagnosisText,
    summary?.chiefComplaint,
    'Encounter',
  );

  const clinicianName = firstText(
    clinician?.displayName,
    clinician?.name,
    row.clinicianName,
    'Clinician',
  );

  return {
    id,
    date,
    clinicianName,
    specialty: firstText(clinician?.specialty, row.specialty),
    reason,
    summary: firstText(summary?.summary, summary?.clinicalSummary, summary?.assessment, row.summary),
    linkHref: `/encounters/${encodeURIComponent(id)}`,
  };
}

function normalizeMedication(row: any) {
  if (!row || typeof row !== 'object') return null;

  const id = clean(row.id || row.medicationId || row.orderId, 180);
  const name = firstText(row.name, row.drug, row.medication, row.title);
  if (!id || !name) return null;

  const rawStatus = clean(row.status || row.state || 'active', 80).toLowerCase();
  const status =
    rawStatus.includes('stop') || rawStatus.includes('cancel')
      ? 'stopped'
      : rawStatus.includes('complete') || rawStatus.includes('finish')
        ? 'completed'
        : 'active';

  return {
    id,
    name,
    dose: firstText(row.dose, row.strength),
    route: firstText(row.route),
    frequency: firstText(row.frequency, row.sig, row.instructions),
    status,
    startDate: row.started || row.startedAt || row.startDate || row.createdAt || null,
    endDate: row.ended || row.endedAt || row.endDate || null,
    prescriber: firstText(row.prescriber, row.clinicianName, row.source),
  };
}

function normalizeAllergy(row: any) {
  if (!row || typeof row !== 'object') return null;

  const id = clean(row.id || row.allergyId, 180);
  const allergen = firstText(row.allergen, row.substance, row.substanceText, row.name);
  if (!id || !allergen) return null;

  const sev = clean(row.severity, 80).toLowerCase();
  const severity =
    sev.includes('severe') ? 'severe' : sev.includes('moderate') ? 'moderate' : sev.includes('mild') ? 'mild' : undefined;

  return {
    id,
    allergen,
    reaction: firstText(row.reaction, row.reactionText, row.manifestation),
    severity,
    notedAt: row.notedAt || row.recordedAt || row.createdAt || row.updatedAt || null,
  };
}

function normalizeLabFlag(value: unknown) {
  const raw = clean(value, 80).toLowerCase();

  if (raw.includes('critical')) return 'critical';
  if (raw.includes('abnormal')) return 'abnormal';
  if (raw.includes('high')) return 'high';
  if (raw.includes('low')) return 'low';
  if (raw.includes('normal')) return 'normal';

  return undefined;
}

function normalizeLab(row: any) {
  if (!row || typeof row !== 'object') return null;

  const id = clean(row.id || row.labId || row.orderId, 180);
  const test = firstText(row.test, row.name, row.title, row.panel);
  if (!id || !test) return null;

  return {
    id,
    date: toIso(row.date || row.resultedAt || row.createdAt || row.updatedAt),
    panel: firstText(row.panel),
    test,
    value: firstText(row.value, row.result, row.status),
    unit: firstText(row.unit),
    ref: firstText(row.ref, row.reference, row.referenceRange),
    flag: normalizeLabFlag(row.flag || row.resultFlag || row.status),
    orderingClinician: firstText(row.orderingClinician, row.clinicianName, row.performer),
  };
}

function normalizeRealLabResult(row: any) {
  if (!row || typeof row !== 'object') return null;

  const id = clean(row.id, 180);
  const test = firstText(row.name, row.loincCode, 'Laboratory result');
  if (!id || !test) return null;

  const order = row.order && typeof row.order === 'object' ? row.order : null;
  const hasNumericValue = row.valueNum !== null && row.valueNum !== undefined && Number.isFinite(Number(row.valueNum));

  const value = hasNumericValue
    ? String(row.valueNum)
    : row.isPositive === true
      ? 'Positive'
      : row.isPositive === false
        ? 'Negative'
        : firstText(row.flag, 'Result available');

  return {
    id,
    date: toIso(row.createdAt || order?.updatedAt || order?.createdAt),
    panel: firstText(order?.panel),
    test,
    value,
    unit: firstText(row.unit),
    ref: firstText(row.loincCode, order?.id),
    flag: normalizeLabFlag(row.flag),
    orderingClinician: firstText(row.clinicianId, order?.clinicianId),
  };
}

function normalizeLabOrder(row: any) {
  if (!row || typeof row !== 'object') return null;

  const id = clean(row.id, 180);
  if (!id) return null;

  const tests = Array.isArray(row.tests) ? row.tests : [];
  const firstTest = tests.find((x: any) => x && typeof x === 'object') || null;

  return {
    id: `order_${id}`,
    date: toIso(row.updatedAt || row.createdAt),
    panel: firstText(row.panel, 'Laboratory order'),
    test: firstText(row.panel, firstTest?.name, firstTest?.test, 'Laboratory order'),
    value: firstText(row.status, 'Ordered'),
    unit: '',
    ref: id,
    flag: undefined,
    orderingClinician: firstText(row.clinicianId),
  };
}

function normalizePatientDocument(row: any) {
  if (!row || typeof row !== 'object') return null;

  const id = clean(row.id || row.documentId, 180);
  if (!id) return null;

  const kind = clean(row.documentKind || row.docType || row.type || 'other', 80) || 'other';

  return {
    id,
    date: toIso(row.createdAt || row.updatedAt),
    title: firstText(row.title, row.fileName, 'Uploaded document'),
    type: kind,
    source: firstText(row.sourceApp, row.sourceType, 'Ambulant+'),
    fileName: row.fileName || null,
    mimeType: row.mimeType || null,
    sizeBytes: Number.isFinite(Number(row.sizeBytes)) ? Number(row.sizeBytes) : undefined,
    downloadUrl: `/api/medical-records/file?documentId=${encodeURIComponent(id)}`,
    viewHref: undefined,
  };
}

function normalizeDocsFromEncounters(encounters: any[]) {
  const docs: any[] = [];

  for (const encounter of encounters) {
    const encounterId = clean(encounter?.id || encounter?.encounterId, 180);
    const rows = Array.isArray(encounter?.documents) ? encounter.documents : [];

    for (const row of rows) {
      const id = clean(row?.id || row?.documentId, 180);
      if (!id) continue;

      docs.push({
        id,
        date: toIso(row?.createdAt || row?.updatedAt || encounter?.primaryTime),
        title: firstText(row?.title, row?.fileName, 'Clinical document'),
        type: 'clinical-note',
        source: firstText(row?.source, row?.sourceApp, 'Ambulant+'),
        fileName: row?.fileName || null,
        mimeType: row?.mimeType || null,
        sizeBytes: Number.isFinite(Number(row?.sizeBytes)) ? Number(row.sizeBytes) : undefined,
        downloadUrl: row?.downloadUrl || undefined,
        viewHref: row?.viewHref || (encounterId ? `/encounters/${encodeURIComponent(encounterId)}` : undefined),
      });
    }

    const erxOrders = Array.isArray(encounter?.erxOrders) ? encounter.erxOrders : [];
    for (const rx of erxOrders) {
      const id = clean(rx?.id, 180);
      if (!id) continue;

      docs.push({
        id: `erx_${id}`,
        date: toIso(rx?.createdAt || rx?.updatedAt || encounter?.primaryTime),
        title: firstText(rx?.drug, 'ePrescription'),
        type: 'prescription',
        source: 'Ambulant+ eRx',
        fileName: `ambulant-erx-${id}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: undefined,
        downloadUrl: rx?.downloadUrl || rx?.pdfUrl || `/api/erx/${encodeURIComponent(id)}/pdf`,
        viewHref: encounterId ? `/encounters/${encodeURIComponent(encounterId)}` : undefined,
      });
    }
  }

  return docs;
}

export async function GET(req: NextRequest) {
  const me = await fetchJson(req, '/api/auth/me');

  if (!me.ok || !me.payload?.ok) {
    return json(
      {
        ok: false,
        error: me.payload?.error || 'patient_session_required',
        message: 'Medical records require a signed-in patient session.',
      },
      me.status || 401,
    );
  }

  const user = me.payload?.user || {};
  const profile = me.payload?.profile || user.profile || {};
  const patientId = clean(me.payload?.patientId || me.payload?.actorRefId || user.patientId || user.actorRefId || profile.id, 180);

  if (!patientId) {
    return json(
      {
        ok: false,
        error: 'patient_profile_required',
        message: 'Your patient profile could not be resolved for medical records.',
      },
      404,
    );
  }

  const patient = {
    id: patientId,
    displayName: firstText(me.payload?.displayName, user.displayName, profile.name, me.payload?.name, 'Patient'),
    dob: profile.dob || profile.dateOfBirth || undefined,
    sex: profile.sex || profile.gender || undefined,
    mrn: profile.mrn || me.payload?.mrn || undefined,
  };

  const patientDocsPromise = prisma.patientDocument.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const labResultsPromise = prisma.labResult.findMany({
    where: { patientId },
    include: {
      order: {
        select: {
          id: true,
          panel: true,
          status: true,
          clinicianId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  const labOrdersPromise = prisma.labOrder.findMany({
    where: { patientId },
    include: {
      results: {
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const [encountersRes, medsRes, allergiesRes, patientDocs, labResults, labOrders] = await Promise.all([
    fetchJson(req, '/api/encounters?limit=100&details=1'),
    fetchJson(req, `/api/medications?patientId=${encodeURIComponent(patientId)}`),
    fetchJson(req, `/api/allergies?patientId=${encodeURIComponent(patientId)}`),
    patientDocsPromise,
    labResultsPromise,
    labOrdersPromise,
  ]);

  const rawEncounters = arrayFromPayload(encountersRes.payload, ['encounters', 'items', 'data']);
  const rawMeds = arrayFromPayload(medsRes.payload, ['items', 'medications', 'meds', 'data']);
  const rawAllergies = arrayFromPayload(allergiesRes.payload, ['items', 'allergies', 'data']);

  const encounters = rawEncounters.map(normalizeEncounter).filter(Boolean);
  const medications = rawMeds.map(normalizeMedication).filter(Boolean);
  const allergies = rawAllergies.map(normalizeAllergy).filter(Boolean);
  const resultLabs = Array.isArray(labResults) ? labResults.map(normalizeRealLabResult).filter(Boolean) : [];
  const resultOrderIds = new Set((Array.isArray(labResults) ? labResults : []).map((row: any) => clean(row?.orderId, 180)).filter(Boolean));
  const pendingOrderLabs = Array.isArray(labOrders)
    ? labOrders
        .filter((row: any) => !resultOrderIds.has(clean(row?.id, 180)))
        .map(normalizeLabOrder)
        .filter(Boolean)
    : [];
  const labs = [...resultLabs, ...pendingOrderLabs];
  const encounterDocs = normalizeDocsFromEncounters(rawEncounters);
  const uploadedDocs = Array.isArray(patientDocs) ? patientDocs.map(normalizePatientDocument).filter(Boolean) : [];
  const docs = [...uploadedDocs, ...encounterDocs];

  const updatedAt = new Date().toISOString();

  return json({
    ok: true,
    patient,
    updatedAt,

    problems: [],
    encounters,
    medications,
    allergies,
    immunisations: [],
    labs,
    imaging: [],
    docs,

    source: 'patient-app.medical-records.aggregate',
    sources: {
      auth: { ok: me.ok, status: me.status },
      encounters: { ok: encountersRes.ok, status: encountersRes.status, count: encounters.length },
      medications: { ok: medsRes.ok, status: medsRes.status, count: medications.length },
      allergies: { ok: allergiesRes.ok, status: allergiesRes.status, count: allergies.length },
      labs: { ok: true, status: 200, count: labs.length, source: 'prisma.labResult/prisma.labOrder' },
      labResults: { count: Array.isArray(labResults) ? labResults.length : 0 },
      labOrders: { count: Array.isArray(labOrders) ? labOrders.length : 0 },
    },
  });
}
