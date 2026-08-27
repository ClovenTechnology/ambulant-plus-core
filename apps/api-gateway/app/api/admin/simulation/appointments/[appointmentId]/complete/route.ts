import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '../../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, context: { params: { appointmentId: string } }) {
  const admin = await verifyAdminRequest(req as any);
  if (!admin.ok) return admin.response;

  return NextResponse.json(
    {
      ok: false,
      error: 'assessment_required',
      appointmentId: context.params.appointmentId,
      message:
        'Legacy simulation completion is disabled. Save and finalize the seven-domain supervisor assessment in Simulation Control.',
    },
    { status: 409, headers: { 'cache-control': 'no-store' } },
  );
}
