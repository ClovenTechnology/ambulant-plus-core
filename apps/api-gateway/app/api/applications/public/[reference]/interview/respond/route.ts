import { NextRequest } from 'next/server';
import { respondToApplicationInterviewFromPortal } from '@/src/lib/public-application-portal';
import {
  applicationPortalErrorResponse,
  applicationPortalJson,
  applicationPortalJsonBody,
  applicationPortalRequestClientKey,
  applicationPortalRequestToken,
} from '../../../_http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { reference: string } },
) {
  try {
    const body = await applicationPortalJsonBody(request);
    const result = await respondToApplicationInterviewFromPortal({
      referenceCode: context.params.reference,
      token: applicationPortalRequestToken(request),
      clientKey: applicationPortalRequestClientKey(request),
      response: body.response,
    });
    return applicationPortalJson(result);
  } catch (error) {
    return applicationPortalErrorResponse(error);
  }
}
