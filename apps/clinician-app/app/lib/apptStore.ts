// apps/clinician-app/app/lib/apptStore.ts
export type Appt = {
  id: string;
  when: string; // ISO
  patientName: string;
  clinicianName: string;
  reason: string;
  status: "Scheduled" | "Completed" | "Cancelled";
  roomId: string;
};

// Module-scoped, hot-reload friendly in dev.
let DB: Appt[] | null = null;

function seed(): Appt[] {
  return [
    {
      id: "APT-1001",
      when: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      patientName: "Sibusiso Mthembu",
      clinicianName: "Dr. A. Dlamini",
      reason: "Follow-up: hypertension",
      status: "Scheduled",
      roomId: "room-1001",
    },
    {
      id: "APT-1002",
      when: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      patientName: "Thandi Nkosi",
      clinicianName: "Dr. A. Dlamini",
      reason: "New: chest discomfort",
      status: "Scheduled",
      roomId: "room-1002",
    },
    {
      id: "APT-0999",
      when: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      patientName: "Kgomotso Lebo",
      clinicianName: "Dr. A. Dlamini",
      reason: "Results review",
      status: "Completed",
      roomId: "room-0999",
    },
  ];
}

function ensureDB() {
  if (!DB) DB = seed();
  return DB!;
}

export function listAppts(): Appt[] {
  return ensureDB();
}

export function getAppt(id: string): Appt | undefined {
  return ensureDB().find(a => a.id === id);
}

type Patch = Partial<Pick<Appt, "when" | "reason" | "status" | "roomId">>;

export function patchAppt(id: string, patch: Patch): Appt | undefined {
  const db = ensureDB();
  const i = db.findIndex(a => a.id === id);
  if (i === -1) return undefined;
  db[i] = { ...db[i], ...patch };
  return db[i];
}
