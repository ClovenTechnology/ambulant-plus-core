import { NextRequest, NextResponse } from 'next/server';
import { readJson, forwardToGateway } from '../../../../clinicians/onboarding/_helpers';

export const runtime = 'edge';

function cleanStr(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { clinicianId: string } },
) {
  const clinicianId = cleanStr(params.clinicianId, 160);

  if (!clinicianId) {
    return NextResponse.json(
      { ok: false, error: 'clinicianId_required' },
      { status: 400 },
    );
  }

  const body = await readJson(req);

  return forwardToGateway(
    req,
    `/api/admin/simulation/clinicians/${encodeURIComponent(clinicianId)}/approve-real-patients`,
    {
      note: cleanStr(body?.note, 700) || undefined,
    },
  );
}
