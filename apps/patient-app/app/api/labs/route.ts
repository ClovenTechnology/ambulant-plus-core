// apps/patient-app/app/api/labs/route.ts
import { NextResponse } from 'next/server';

export type LabRow = {
  id: string;
  test: string;
  date: string; // ISO
  status: 'Pending' | 'Completed' | 'Cancelled';
  result?: string;
  unit?: string;
  reference?: string;
  performer?: string;
  sample?: string;
};

// In-memory mock data (resets on dev restart)
let LABS: LabRow[] = [
  {
    id: 'lab-001',
    test: 'Complete Blood Count (CBC)',
    date: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    status: 'Completed',
    result: 'WBC 6.2; Hgb 13.8; Plt 250',
    reference: 'erx-663580',
    performer: 'Ampath Illovo',
    sample: 'Venous blood',
  },
  {
    id: 'lab-002',
    test: 'Fasting Glucose',
    date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    status: 'Completed',
    result: '5.4',
    unit: 'mmol/L',
    reference: 'erx-367280',
    performer: 'Lancet Sandton',
    sample: 'Capillary blood',
  },
  {
    id: 'lab-003',
    test: 'HbA1c',
    date: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    status: 'Pending',
    reference: 'erx-309880',
    performer: 'Ambulant+ Lab',
    sample: 'Venous blood',
  },
  {
    id: 'lab-004',
    test: 'Lipid Panel',
    date: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    status: 'Completed',
    result: 'TC 4.5; LDL 2.7; HDL 1.2; TG 1.0',
    unit: 'mmol/L',
    reference: 'erx-907280',
    performer: 'Clifton Diagnostic',
    sample: 'Serum',
  },
  {
    id: 'lab-005',
    test: 'COVID-19 PCR',
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    status: 'Cancelled',
    reference: 'erx-364890',
    performer: 'Lancet Cresta',
    sample: 'Nasopharyngeal swab',
  },
];

export async function GET() {
  const data = LABS.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  return NextResponse.json(data);
}
