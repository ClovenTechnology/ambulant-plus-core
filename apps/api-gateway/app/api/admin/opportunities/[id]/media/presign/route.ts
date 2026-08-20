import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { requireOpportunityScope } from '@/src/lib/admin-opportunity-access';
import { canEditOpportunity } from '@/src/lib/opportunities-policy';
import {
  enterpriseMediaErrorResponse,
  enterpriseMediaObjectKey,
  presignEnterpriseMediaUpload,
  validateEnterpriseMediaUploadInput,
} from '@/src/lib/enterprise-media-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    requireOpportunityScope(await requireAdminStaffActor(request), 'opportunities.manage');
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: context.params.id },
      select: { id: true, status: true },
    });
    if (!opportunity) return json({ ok: false, error: 'opportunity_not_found' }, 404);
    if (!canEditOpportunity(opportunity.status)) {
      return json({ ok: false, error: 'opportunity_pause_before_edit' }, 409);
    }

    const contentCount = await prisma.opportunityGalleryImage.count({
      where: { opportunityId: opportunity.id, role: 'CONTENT' },
    });
    if (contentCount >= 40) {
      return json({ ok: false, error: 'opportunity_content_media_limit_reached' }, 409);
    }

    const body = await request.json().catch(() => ({}));
    const upload = validateEnterpriseMediaUploadInput({
      contentType: (body as any)?.contentType,
      sizeBytes: (body as any)?.sizeBytes,
      checksumSha256: (body as any)?.checksumSha256,
    });
    const objectKey = enterpriseMediaObjectKey({ kind: 'opportunity-image', ownerId: opportunity.id });
    const signed = await presignEnterpriseMediaUpload({
      objectKey,
      contentType: upload.contentType,
      checksumSha256: upload.checksumSha256,
    });
    return json({ ok: true, objectKey, ...signed });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const media = enterpriseMediaErrorResponse(error);
    if (media) return json(media.body, media.status);
    console.error('[admin opportunities] content media presign failed', error);
    return json({ ok: false, error: 'opportunity_content_media_presign_failed' }, 500);
  }
}
