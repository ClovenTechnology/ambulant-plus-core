import { prisma } from '../apps/api-gateway/src/lib/db'; // adjust if different
import { randomUUID } from 'node:crypto';

function isoShift(minutes: number) {
  const t = new Date(); t.setSeconds(0,0); t.setMinutes(t.getMinutes()+minutes); return t.toISOString();
}

describe('appointments conflict checks', () => {
  const clinicianA = 'clin-A';
  const clinicianB = 'clin-B';
  const patientX = 'pat-X';

  beforeAll(async () => {
    await prisma.appointment.deleteMany({});
  });

  it('prevents patient overlapping across clinicians', async () => {
    await prisma.appointment.create({
      data: {
        id: randomUUID(), encounterId:'e1', sessionId:'s1', caseId:'c1',
        clinicianId: clinicianA, patientId: patientX,
        startsAt: new Date(isoShift(30)), endsAt: new Date(isoShift(60)),
        status: 'pending', priceCents: 0, currency: 'ZAR', platformFeeCents: 0, clinicianTakeCents: 0, paymentProvider: 'manual'
      }
    });
    // attempt overlap same patient with different clinician
    const res = await fetch('http://localhost:3010/api/appointments', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        encounterId:'e2', sessionId:'s2', caseId:'c2',
        clinicianId: clinicianB, patientId: patientX,
        startsAt: isoShift(45), endsAt: isoShift(75),
      })
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.conflict.scope).toBe('patient');
  });

  it('prevents clinician double-book with any patient', async () => {
    // clinicianA already has the slot; try another patient overlapping
    const res = await fetch('http://localhost:3010/api/appointments', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        encounterId:'e3', sessionId:'s3', caseId:'c3',
        clinicianId: clinicianA, patientId: 'pat-Y',
        startsAt: isoShift(35), endsAt: isoShift(65),
      })
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.conflict.scope).toBe('clinician');
  });

  it('allows non-overlapping bookings', async () => {
    const res = await fetch('http://localhost:3010/api/appointments', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        encounterId:'e4', sessionId:'s4', caseId:'c4',
        clinicianId: clinicianB, patientId: patientX,
        startsAt: isoShift(90), endsAt: isoShift(120),
      })
    });
    expect(res.status).toBe(201);
  });
});