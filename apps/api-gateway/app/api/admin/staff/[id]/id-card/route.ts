import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { generateStaffIdSvg, staffEmploymentErrorResponse } from '@/src/lib/staff-employment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request);
    const card = await generateStaffIdSvg({ actor, staffProfileId: params.id });
    return new NextResponse(card.svg, {
      status: 200,
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'content-disposition': `attachment; filename="${card.fileName.replace(/"/g, '')}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const handled = staffEmploymentErrorResponse(error);
    if (handled) return NextResponse.json(handled.body, { status: handled.status });
    console.error('[staff id-card] GET failed', error);
    return NextResponse.json({ ok: false, error: 'staff_id_card_generation_failed' }, { status: 500 });
  }
}
