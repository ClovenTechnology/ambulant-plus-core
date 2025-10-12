import { createAppointment, updateAppointment } from '@/src/store/appointments';

const base = () => ({
  encounterId: 'enc-1',
  sessionId: 'sess-1',
  caseId: 'case-1',
  clinicianId: 'clin-A',
  patientId: 'pat-1',
  startsAt: new Date(Date.now() + 60e3).toISOString(),
  endsAt: new Date(Date.now() + 31*60e3).toISOString(),
  meta: {}
});

describe('appointment overlap logic', () => {
  it('allows first booking, blocks patient double-book same time', async () => {
    const a = await createAppointment({ id: 'a1', ...base() });
    expect(a.id).toBeDefined();

    // Same time different clinician should be blocked for the same patient
    await expect(createAppointment({
      id: 'a2',
      ...base(),
      clinicianId: 'clin-B'
    })).rejects.toHaveProperty('code', 'patient_conflict');
  });

  it('blocks clinician double-book on same slot', async () => {
    const s = new Date(Date.now() + 2*60e3).toISOString();
    const e = new Date(Date.now() + 33*60e3).toISOString();
    await expect(createAppointment({
      id: 'a3',
      ...base(),
      patientId: 'pat-2',
      startsAt: s, endsAt: e
    })).rejects.toHaveProperty('code', 'clinician_conflict');
  });

  it('reschedule triggers same checks', async () => {
    const first = await createAppointment({
      id: 'a4',
      ...base(),
      patientId: 'pat-3',
      startsAt: new Date(Date.now() + 60*60e3).toISOString(),
      endsAt:   new Date(Date.now() + 61*60e3).toISOString(),
    });
    expect(first.id).toBe('a4');

    // Reschedule into an occupied clinician slot
    await expect(updateAppointment('a4', {
      startsAt: new Date(Date.now() + 2*60e3).toISOString(),
      endsAt:   new Date(Date.now() + 33*60e3).toISOString(),
    })).rejects.toHaveProperty('code', 'clinician_conflict');
  });
});
