import { prisma } from './db';

/** Returns an open case for patient or creates one if none exists. */
export async function getOrCreateActiveCase(patientId: string, title = 'Case'): Promise<{ id: string }> {
  const existing = await prisma.case.findFirst({ where: { patientId, status: 'open' }, orderBy: { createdAt: 'desc' } });
  if (existing) return { id: existing.id };
  const row = await prisma.case.create({ data: { patientId, title, status: 'open' } });
  return { id: row.id };
}

/** Creates a new open encounter bound to (case, patient, clinician). */
export async function createEncounter(patientId: string, clinicianId?: string | null, caseId?: string) {
  let caseRowId = caseId;
  if (!caseRowId) {
    const c = await getOrCreateActiveCase(patientId);
    caseRowId = c.id;
  }
  const enc = await prisma.encounter.create({
    data: { caseId: caseRowId, patientId, clinicianId: clinicianId ?? null, status: 'open' },
  });
  return enc;
}

/** Fetch an encounter and assert it exists. */
export async function requireEncounter(encounterId: string) {
  const enc = await prisma.encounter.findUnique({ where: { id: encounterId } });
  if (!enc) throw new Error('encounter_not_found');
  return enc;
}
