// apps/clinician-app/app/api/_lib/db.ts
import fs from 'fs/promises';
import path from 'path';

export type Appointment = {
  id: string;
  patientName: string;
  clinicianName: string;
  timeISO: string;
  roomId: string;
  status: 'scheduled'|'in_progress'|'completed'|'cancelled';
  notes?: string;
  diagnosis?: string;
  disposition?: 'home'|'admit'|'refer'|'followup';
};

export type Erx = {
  id: string;
  appointmentId: string;
  patientName: string;
  clinicianName: string;
  meds: { drug: string; sig: string; qty?: string; refills?: number }[];
  status: 'draft'|'sent'|'dispensed';
  dispenseCode?: string;
  createdAt: string;
};

type Db = { appointments: Appointment[]; erx: Erx[] };

const DB_FILE = path.join(process.cwd(), 'data-dev.json');

async function ensureFile(): Promise<void> {
  try { await fs.access(DB_FILE); } catch {
    const now = Date.now();
    const seed: Db = {
      appointments: [
        {
          id: `apt-${Math.random().toString(36).slice(2,8)}`,
          patientName: 'John Doe',
          clinicianName: 'Dr. Ada',
          timeISO: new Date(now + 30*60*1000).toISOString(),
          roomId: `room-${Math.random().toString(36).slice(2,8)}`,
          status: 'scheduled',
        },
        {
          id: `apt-${Math.random().toString(36).slice(2,8)}`,
          patientName: 'Jane Smith',
          clinicianName: 'Dr. Ada',
          timeISO: new Date(now + 90*60*1000).toISOString(),
          roomId: `room-${Math.random().toString(36).slice(2,8)}`,
          status: 'scheduled',
        },
      ],
      erx: [],
    };
    await fs.writeFile(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
  }
}

export async function readDb(): Promise<Db> {
  await ensureFile();
  const raw = await fs.readFile(DB_FILE, 'utf8');
  try { return JSON.parse(raw) as Db; } catch { return { appointments: [], erx: [] }; }
}

export async function writeDb(db: Db): Promise<void> {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}
