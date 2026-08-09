import { NextRequest } from 'next/server';
import { getApplicationPortal } from '@/src/lib/public-application-portal';
import {
  applicationPortalErrorResponse,
  applicationPortalJson,
  applicationPortalRequestToken,
} from '../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: { reference: string } },
) {
  try {
    const result = await getApplicationPortal({
      referenceCode: context.params.reference,
      token: applicationPortalRequestToken(request),
    });
    return applicationPortalJson(result);
  } catch (error) {
    return applicationPortalErrorResponse(error);
  }
}
