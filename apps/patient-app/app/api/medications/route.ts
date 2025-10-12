// apps/patient-app/app/api/medications/route.ts
import { NextResponse } from 'next/server';

type Medication = {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  route: string;
  started: string;       // ISO
  lastFilled: string;    // ISO
  status: 'Active'|'Completed'|'On Hold';
  orderId?: string | null;
};

let MEDS: Medication[] = [
  {
    id: 'm1', name: 'Metformin', dose: '500 mg', frequency: 'BID', route: 'PO',
    started: new Date(Date.now()-1000*60*60*24*40).toISOString(),
    lastFilled: new Date(Date.now()-1000*60*60*24*10).toISOString(),
    status: 'Active', orderId: 'ord-001'
  },
  {
    id: 'm2', name: 'Atorvastatin', dose: '20 mg', frequency: 'OD', route: 'PO',
    started: new Date(Date.now()-1000*60*60*24*70).toISOString(),
    lastFilled: new Date(Date.now()-1000*60*60*24*20).toISOString(),
    status: 'Active'
  },
];

export async function GET() {
  return NextResponse.json(MEDS.slice());
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<Medication>;
  const item: Medication = {
    id: crypto.randomUUID(),
    name: body.name ?? 'Unknown',
    dose: body.dose ?? '',
    frequency: body.frequency ?? '',
    route: body.route ?? '',
    started: body.started ?? new Date().toISOString(),
    lastFilled: body.lastFilled ?? new Date().toISOString(),
    status: (body.status as any) ?? 'Active',
    orderId: body.orderId ?? null,
  };
  MEDS.unshift(item);
  return NextResponse.json(item, { status: 201 });
}
