import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { staffEmploymentErrorResponse, staffIdTemplateImage } from '@/src/lib/staff-employment';
import { enterpriseMediaResponseBody } from '@/src/lib/enterprise-media-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    const object = await staffIdTemplateImage(actor);
    return new NextResponse(enterpriseMediaResponseBody(object.bytes), {
      status: 200,
      headers: {
        'content-type': object.contentType,
        'content-length': String(object.contentLength),
        'cache-control': 'private, no-store',
      },
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const handled = staffEmploymentErrorResponse(error);
    if (handled) return NextResponse.json(handled.body, { status: handled.status });
    return NextResponse.json({ ok: false, error: 'staff_id_template_image_load_failed' }, { status: 500 });
  }
}
