import { NextRequest, NextResponse } from 'next/server';
import { requireAdminCaller } from '../../../../clinicians/onboarding/_helpers';

export const runtime = 'edge';
export async function POST(req: NextRequest, { params }: { params: { appointmentId: string } }) {
  const caller = await requireAdminCaller(req);
  if (!caller.ok) return caller.response;
  return NextResponse.json(
    {
      ok: false,
      error: 'assessment_required',
      appointmentId: params.appointmentId,
      message: 'Legacy mark-complete is disabled. Finalize the supervisor assessment in Simulation Control.',
    },
    { status: 409, headers: { 'cache-control': 'no-store' } },
  );
}
