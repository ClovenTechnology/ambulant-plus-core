import { NextResponse } from "next/server";

function isoFromNow({ hours = 0, minutes = 0 }) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(d.getHours() + hours, minutes, 0, 0);
  return d.toISOString();
}

export async function GET() {
  const items = [
    {
      id: "appt_001",
      start: isoFromNow({ hours: 0, minutes: 15 }),
      end: isoFromNow({ hours: 0, minutes: 45 }),
      reason: "Follow-up: Hypertension meds titration",
      visitType: "Video",
      status: "waiting",
      roomName: "room-001",
      patient: { id: "pt_101", name: "Grace Ndlovu" },
      clinician: { id: "cln_001", name: "Dr A." },
    },
    {
      id: "appt_002",
      start: isoFromNow({ hours: 1, minutes: 0 }),
      end: isoFromNow({ hours: 1, minutes: 30 }),
      reason: "Lab review: Lipid panel",
      visitType: "Video",
      status: "checked_in",
      roomName: "room-002",
      patient: { id: "pt_102", name: "Sipho Dlamini" },
      clinician: { id: "cln_001", name: "Dr A." },
    },
    {
      id: "appt_003",
      start: isoFromNow({ hours: 2, minutes: 0 }),
      end: isoFromNow({ hours: 2, minutes: 20 }),
      reason: "Acute: Cough & fever",
      visitType: "Video",
      status: "waiting",
      roomName: "room-003",
      patient: { id: "pt_103", name: "Nokuthula Maseko" },
      clinician: { id: "cln_001", name: "Dr A." },
    },
  ];
  return NextResponse.json(items);
}
