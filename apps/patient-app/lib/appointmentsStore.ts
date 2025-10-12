export type Appointment = {
  id: string;
  clinicianId: string;
  clinicianName: string;
  start: string; // ISO
  end: string;   // ISO
  mode: 'Televisit' | 'InPerson';
  status: 'Booked';
};

const g = globalThis as any;
if (!g.__APPTS__) g.__APPTS__ = [] as Appointment[];
export const APPOINTMENTS: Appointment[] = g.__APPTS__;
