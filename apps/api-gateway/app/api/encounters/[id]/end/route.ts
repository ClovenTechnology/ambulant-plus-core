import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, requireTrustedIdentityInProduction, type Who } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DiagnosisDto = { code?: string; text?: string; kind?: string; status?: string };
type EncounterEndDto = {
  encounterId?: string; clinicianId?: string; patientId?: string; patientName?: string;
  caseId?: string; appointmentId?: string; mode?: string; visitMode?: string;
  synopsis?: string; diagnosisText?: string; diagnosisCode?: string; diagnoses?: DiagnosisDto[];
  plan?: string; notes?: string; disposition?: string; safetyNetting?: string;
  patientEducation?: string; referralNote?: string; followUpNote?: string;
  startedAt?: string; endedAt?: string; elapsedMs?: number;
};

function clean(value: unknown, max = 4000) { return String(value ?? '').trim().slice(0, max); }
function optionalString(value: unknown, max = 4000): string | null { const v = clean(value, max); return v || null; }
function parseIso(value: unknown): Date | null { if (!value) return null; const d = new Date(String(value)); return Number.isFinite(d.getTime()) ? d : null; }
function jsonSafe(value: unknown) { return JSON.parse(JSON.stringify(value ?? null)); }
function record(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
function unique(values: Array<string | null | undefined>) { return Array.from(new Set(values.map((v) => clean(v, 240)).filter(Boolean))); }
function normalizeVisitMode(value: unknown): 'TELEVISIT' | 'IN_PERSON' | null {
  const raw = clean(value, 40).toUpperCase();
  if (['TELEVISIT', 'REMOTE', 'VIDEO'].includes(raw)) return 'TELEVISIT';
  if (['IN_PERSON','IN-PERSON','HOME_VISIT','HOME-VISIT','CLINIC_VISIT','CLINIC-VISIT','PHYSICAL_VISIT'].includes(raw)) return 'IN_PERSON';
  return null;
}
function participantRefs(p: any) { const partyId = clean(p?.partyId, 240); return unique([p?.clinicianId, p?.userId, partyId, partyId.replace(/^clin?[-_:]/i, '')]); }
async function resolveClinicianRefs(who: Who, requested?: string | null) {
  const ids = unique([who.uid, who.actorRefId, requested]); if (!ids.length) return { clinician: null as any, refs: [] as string[] };
  const clinician = await prisma.clinicianProfile.findFirst({ where: { OR: ids.flatMap((id) => [{ id }, { userId: id }]) }, orderBy: { createdAt: 'desc' } });
  return { clinician, refs: unique([...ids, clinician?.id, clinician?.userId]) };
}
function clinicianCanAccess(encounter: any, refs: string[]) {
  const has = (v: unknown) => refs.includes(clean(v, 240));
  if (has(encounter?.clinicianId)) return true;
  return (encounter?.appointments || []).some((a: any) => has(a?.clinicianId) || (a?.participants || []).some((p: any) => {
    const role = clean(p?.role, 80).toUpperCase(); const status = clean(p?.status, 80).toUpperCase();
    return ['LEAD_CLINICIAN','CO_CLINICIAN','ADVISOR'].includes(role) && (!status || ['ACCEPTED','JOINED'].includes(status)) && participantRefs(p).some((r) => refs.includes(r));
  }));
}
function normalizeDiagnoses(body: EncounterEndDto) {
  const list = Array.isArray(body.diagnoses) ? body.diagnoses : [];
  const normalized = list.map((d, index) => ({
    code: clean(d?.code, 120), text: clean(d?.text, 1000),
    kind: clean(d?.kind, 40) || (index === 0 ? 'primary' : 'secondary'),
    status: clean(d?.status, 40) || 'confirmed',
  })).filter((d) => d.code || d.text).slice(0, 25);
  if (!normalized.length && (clean(body.diagnosisCode,120) || clean(body.diagnosisText,1000))) {
    normalized.push({ code: clean(body.diagnosisCode,120), text: clean(body.diagnosisText,1000), kind: 'primary', status: 'confirmed' });
  }
  return normalized;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const who = readIdentity(req.headers);
    try { requireTrustedIdentityInProduction(req.headers, who); } catch { return NextResponse.json({ ok:false, error:'unauthorized' }, { status:401 }); }
    if (!who?.uid) return NextResponse.json({ ok:false, error:'unauthorized' }, { status:401 });
    if (!['clinician','admin','admin_staff'].includes(clean(who.role,40).toLowerCase())) return NextResponse.json({ ok:false, error:'forbidden' }, { status:403 });

    const encounterId = clean(params.id,120); if (!encounterId) return NextResponse.json({ ok:false,error:'encounter_id_required' }, { status:400 });
    const body = await req.json().catch(() => null) as EncounterEndDto | null; if (!body) return NextResponse.json({ ok:false,error:'invalid_json_body' }, { status:400 });

    const encounter = await prisma.encounter.findUnique({
      where:{ id:encounterId },
      include:{
        appointments:{ orderBy:{startsAt:'desc'}, take:20, include:{ participants:{ select:{ partyId:true,role:true,status:true,clinicianId:true,userId:true } } } },
        erxOrders:{ orderBy:{createdAt:'desc'}, take:50 }, labOrders:{ orderBy:{createdAt:'desc'}, take:50 }, payments:{ orderBy:{createdAt:'desc'}, take:50 }, documents:{ orderBy:{createdAt:'desc'}, take:100 },
      },
    });
    if (!encounter) return NextResponse.json({ ok:false,error:'encounter_not_found' }, { status:404 });

    const identity = await resolveClinicianRefs(who, optionalString(body.clinicianId,120));
    const privileged = ['admin','admin_staff'].includes(clean(who.role,40).toLowerCase());
    if (!privileged && (!identity.clinician || !clinicianCanAccess(encounter, identity.refs))) return NextResponse.json({ ok:false,error:'forbidden_encounter_scope' }, { status:403 });
    const actorClinicianId = identity.clinician?.id || optionalString(body.clinicianId,120) || optionalString(who.actorRefId,120) || optionalString(who.uid,120);
    if (!actorClinicianId) return NextResponse.json({ ok:false,error:'clinician_id_required' }, { status:400 });

    const patientId = optionalString(body.patientId,120) || encounter.patientId; const caseId = optionalString(body.caseId,120) || encounter.caseId;
    if (!patientId) return NextResponse.json({ ok:false,error:'patient_id_required' }, { status:400 });
    if (encounter.patientId && patientId !== encounter.patientId) return NextResponse.json({ ok:false,error:'patient_mismatch' }, { status:409 });
    if (!caseId) return NextResponse.json({ ok:false,error:'case_id_required' }, { status:400 });

    const now = new Date(); const startedAt = parseIso(body.startedAt) || encounter.consultationStartedAt || null; const endedAt = parseIso(body.endedAt) || now;
    const visitMode = normalizeVisitMode(body.visitMode) || normalizeVisitMode(body.mode) || normalizeVisitMode(encounter.visitMode) || null;
    const diagnoses = normalizeDiagnoses(body); const primary = diagnoses[0] || null;
    const outstandingOrderDrafts = {
      medications: (encounter.erxOrders || []).filter((order: any) => clean(order?.status, 40).toLowerCase() === 'draft').length,
      labs: (encounter.labOrders || []).filter((order: any) => clean(order?.status, 40).toLowerCase() === 'draft').length,
    };
    const existingSummary = record(encounter.summaryPayload);
    const summaryPayload = {
      ...existingSummary,
      synopsis: optionalString(body.synopsis,5000), diagnosisText: primary?.text || optionalString(body.diagnosisText,5000), diagnosisCode: primary?.code || optionalString(body.diagnosisCode,120),
      diagnoses,
      plan: optionalString(body.plan,16000),
      notes: optionalString(body.notes,12000),
      disposition: optionalString(body.disposition,2000),
      safetyNetting: optionalString(body.safetyNetting,12000),
      patientEducation: optionalString(body.patientEducation,12000),
      referralNote: optionalString(body.referralNote,12000),
      followUpNote: optionalString(body.followUpNote,12000),
      outstandingOrderDrafts,
      patientName: optionalString(body.patientName,240), appointmentId: optionalString(body.appointmentId,120),
      elapsedMs: typeof body.elapsedMs === 'number' && Number.isFinite(body.elapsedMs) ? body.elapsedMs : startedAt ? Math.max(0,endedAt.getTime()-startedAt.getTime()) : null,
      endedByUserId: who.uid, endedByRole: who.role, endedAt: endedAt.toISOString(),
    };

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.encounter.update({
        where:{ id:encounter.id }, data:{ clinicianId: encounter.clinicianId || actorClinicianId, patientId, caseId, ...(visitMode?{visitMode}:{}), consultationStartedAt: startedAt ?? undefined, consultationEndedAt: endedAt, status:'completed', summaryPayload: jsonSafe(summaryPayload) as any },
        include:{ appointments:{orderBy:{startsAt:'desc'},take:20}, erxOrders:{orderBy:{createdAt:'desc'},take:50}, labOrders:{orderBy:{createdAt:'desc'},take:50}, payments:{orderBy:{createdAt:'desc'},take:50}, documents:{orderBy:{createdAt:'desc'},take:100} },
      });
      await tx.encounterDiagnosis.deleteMany({ where:{ encounterId:encounter.id, source:'session-conclusions' } });
      for (const d of diagnoses) {
        if (!d.code) continue;
        await tx.encounterDiagnosis.create({ data:{ encounterId:encounter.id, patientId, clinicianId:actorClinicianId, icd10:d.code, description:d.text || null, kind:d.kind, status:d.status, source:'session-conclusions' } });
      }
      return row;
    });

    await prisma.auditEvent.create({ data:{ kind:'encounter_ended', actorId:who.uid, actorRole:who.role, subjectId:updated.id, meta:jsonSafe({ patientId:updated.patientId, caseId:updated.caseId, appointmentId:summaryPayload.appointmentId, diagnoses, outstandingOrderDrafts, visitMode:updated.visitMode, consultationEndedAt:updated.consultationEndedAt?.toISOString() ?? null }) as any } }).catch(()=>null);

    return NextResponse.json({ ok:true, encounter:updated, summary:{ encounterId:updated.id, clinicianId:updated.clinicianId, patientId:updated.patientId, patientName:summaryPayload.patientName, caseId:updated.caseId, appointmentId:summaryPayload.appointmentId, mode:updated.visitMode, synopsis:summaryPayload.synopsis, diagnosisText:summaryPayload.diagnosisText, diagnosisCode:summaryPayload.diagnosisCode, diagnoses, plan:summaryPayload.plan, notes:summaryPayload.notes, disposition:summaryPayload.disposition, safetyNetting:summaryPayload.safetyNetting, patientEducation:summaryPayload.patientEducation, referralNote:summaryPayload.referralNote, followUpNote:summaryPayload.followUpNote, outstandingOrderDrafts, startedAt:updated.consultationStartedAt?.toISOString() ?? null, endedAt:updated.consultationEndedAt?.toISOString() ?? null, elapsedMs:summaryPayload.elapsedMs, status:updated.status, source:'api-gateway', createdAt:updated.updatedAt.toISOString() } }, { status:200, headers:{'Cache-Control':'no-store','access-control-allow-origin':'*'} });
  } catch (err:any) {
    console.error('[api-gateway][encounters/:id/end] error',err);
    return NextResponse.json({ ok:false,error:String(err?.message || 'failed_to_end_encounter') }, { status:500 });
  }
}
