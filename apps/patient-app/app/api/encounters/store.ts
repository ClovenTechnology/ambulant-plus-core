// apps/patient-app/app/api/encounters/store.ts
import crypto from 'node:crypto';

export type Encounter = {
  id: string;
  status: 'Triage' | 'Consult' | 'Completed';
  startedAt: string;     // ISO
  updatedAt: string;     // ISO
  summary?: string;
  notes: Array<{ id: string; ts: string; text: string; source?: string; visitId?: string }>;
  vitals?: { hr?: number; sys?: number; dia?: number; spo2?: number; temp_c?: number };
};

// Inâ€‘memory demo data
let ENCOUNTERS: Encounter[] = [
  {
    id: 'enc-1001',
    status: 'Consult',
    startedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    summary: 'Followâ€‘up for cough and fatigue.',
    notes: [
      { id: crypto.randomUUID(), ts: new Date(Date.now() - 1000 * 60 * 55).toISOString(), text: 'Triage intake complete.' },
      { id: crypto.randomUUID(), ts: new Date(Date.now() - 1000 * 60 * 20).toISOString(), text: 'Televisit connected, discussed symptoms.', source: 'televisit', visitId: 'demo-123' },
    ],
    vitals: { hr: 78, sys: 126, dia: 81, spo2: 98, temp_c: 36.9 },
  },
  {
    id: 'enc-1002',
    status: 'Triage',
    startedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
    notes: [],
  },
];

export function listEncounters(): Encounter[] {
  // newest first
  return [...ENCOUNTERS].sort((a, b) => (b.updatedAt.localeCompare(a.updatedAt)));
}

export function getEncounter(id: string): Encounter | undefined {
  return ENCOUNTERS.find(e => e.id === id);
}

export function addNoteToEncounter(encId: string, note: { ts: string; text: string; source?: string; visitId?: string }) {
  const enc = getEncounter(encId);
  if (!enc) return undefined;

  // simple duplicate guard: same text within last 2 minutes
  const twoMinAgo = Date.now() - 120000;
  const dup = enc.notes.find(n => n.text.trim() === note.text.trim() && new Date(n.ts).getTime() >= twoMinAgo);
  if (dup) return { dup: true, enc };

  const row = { id: crypto.randomUUID(), ...note };
  enc.notes.unshift(row);
  enc.updatedAt = new Date().toISOString();
  return { enc, note: row };
}

export function createEncounter(payload: Partial<Encounter>): Encounter {
  const id = payload.id ?? `enc-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const enc: Encounter = {
    id,
    status: payload.status ?? 'Triage',
    startedAt: payload.startedAt ?? now,
    updatedAt: now,
    summary: payload.summary ?? '',
    notes: payload.notes ?? [],
    vitals: payload.vitals ?? {},
  };
  ENCOUNTERS.unshift(enc);
  return enc;
}
