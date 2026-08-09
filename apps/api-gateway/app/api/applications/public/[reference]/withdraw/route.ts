import { NextRequest } from 'next/server';
import { withdrawApplicationFromPortal } from '@/src/lib/public-application-portal';
import {
  applicationPortalErrorResponse,
  applicationPortalJson,
  applicationPortalJsonBody,
  applicationPortalRequestToken,
} from '../../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { reference: string } },
) {
  try {
    const body = await applicationPortalJsonBody(request);
    const result = await withdrawApplicationFromPortal({
      referenceCode: context.params.reference,
      token: applicationPortalRequestToken(request),
      reason: body.reason,
    });
    return applicationPortalJson(result);
  } catch (error) {
    return applicationPortalErrorResponse(error);
  }
}
