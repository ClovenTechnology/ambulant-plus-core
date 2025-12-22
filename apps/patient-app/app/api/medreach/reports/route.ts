// apps/patient-app/app/api/medreach/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const filePath = path.resolve(process.cwd(), '../../packages/medreach/reports.json');

// Helper to strip BOM if present
async function readJsonSafe(p: string) {
  const txt = await fs.readFile(p, 'utf-8');
  const cleaned = txt.replace(/^\uFEFF/, '');
  return JSON.parse(cleaned);
}

// Very light mock fallback – you can extend structure as needed
const MOCK_REPORTS = [
  {
    id: 'LAB-2001',
    patient: 'John Doe',
    type: 'Full Blood Count',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    file: 'sample-lab-report.pdf',
  },
  {
    id: 'LAB-2002',
    patient: 'Jane Smith',
    type: 'Lipid Profile',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    file: 'sample-lab-report-2.pdf',
  },
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const encId = url.searchParams.get('encId') || url.searchParams.get('id');
  const patient = url.searchParams.get('patient');

  try {
    const data = await readJsonSafe(filePath);

    // Expect either { reports: [...] } or plain [...]
    let reports: any[] = [];
    if (Array.isArray((data as any).reports)) {
      reports = (data as any).reports;
    } else if (Array.isArray(data)) {
      reports = data as any[];
    }

    // Optional filtering
    if (encId) {
      reports = reports.filter(
        (r) => r.encounterId === encId || r.id === encId || r.labId === encId,
      );
    }
    if (patient) {
      const needle = patient.toLowerCase();
      reports = reports.filter(
        (r) =>
          (r.patient && String(r.patient).toLowerCase().includes(needle)) ||
          (r.patientId && String(r.patientId).toLowerCase().includes(needle)),
      );
    }

    return NextResponse.json({ reports });
  } catch (err) {
    console.warn('MedReach reports: failed to read file, using mock', err);
    let reports = MOCK_REPORTS;

    if (encId) {
      reports = reports.filter((r) => r.id === encId);
    }
    if (patient) {
      const needle = patient.toLowerCase();
      reports = reports.filter((r) =>
        String(r.patient).toLowerCase().includes(needle),
      );
    }

    return NextResponse.json({ reports });
  }
}
