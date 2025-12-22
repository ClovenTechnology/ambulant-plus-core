import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function minutesAgo(n: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n);
  return d.toISOString();
}

export async function GET() {
  // realistic mixed recent items (newest first)
  const items = [
    { timestamp: minutesAgo(8),  type: 'blood_pressure', panel: 'bp',   label: 'Blood Pressure' },
    { timestamp: minutesAgo(22), type: 'spo2',           panel: 'spo2', label: 'SpO₂' },
    { timestamp: minutesAgo(41), type: 'temperature',    panel: 'temp', label: 'Temperature' },
    { timestamp: minutesAgo(95), type: 'blood_glucose',  panel: 'glu',  label: 'Glucose' },
    { timestamp: minutesAgo(120),type: 'heart_rate',     panel: 'hr',   label: 'Heart Rate' },
  ];
  return NextResponse.json({ items });
}
