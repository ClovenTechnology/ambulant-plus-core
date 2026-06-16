import { NextRequest, NextResponse } from 'next/server';
import { readJson, forwardToGateway } from '../../../../clinicians/onboarding/_helpers';

export const runtime = 'edge';

function cleanStr(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { appointmentId: string } },
) {
  const appointmentId = cleanStr(params.appointmentId, 160);

  if (!appointmentId) {
    return NextResponse.json(
      { ok: false, error: 'appointmentId_required' },
      { status: 400 },
    );
  }

  const body = await readJson(req);

  return forwardToGateway(
    req,
    `/api/admin/simulation/appointments/${encodeURIComponent(appointmentId)}/complete`,
    {
      clinicianId: cleanStr(body?.clinicianId, 120) || undefined,
      note: cleanStr(body?.note, 500) || undefined,
    },
  );
}
