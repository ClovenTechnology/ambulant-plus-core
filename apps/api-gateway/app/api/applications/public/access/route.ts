import { NextRequest } from 'next/server';
import { requestApplicationAccessLink } from '@/src/lib/public-application-portal';
import {
  applicationPortalErrorResponse,
  applicationPortalJson,
  applicationPortalJsonBody,
  applicationPortalRequestClientKey,
} from '../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await applicationPortalJsonBody(request);
    const result = await requestApplicationAccessLink({
      referenceCode: body.referenceCode,
      email: body.email,
      clientKey: applicationPortalRequestClientKey(request),
    });
    return applicationPortalJson(result);
  } catch (error) {
    return applicationPortalErrorResponse(error);
  }
}
