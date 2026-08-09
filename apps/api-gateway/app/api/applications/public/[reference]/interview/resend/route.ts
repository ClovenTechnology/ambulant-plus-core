import { NextRequest } from 'next/server';
import { resendApplicationInterviewFromPortal } from '@/src/lib/public-application-portal';
import {
  applicationPortalErrorResponse,
  applicationPortalJson,
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
    const result = await resendApplicationInterviewFromPortal({
      referenceCode: context.params.reference,
      token: applicationPortalRequestToken(request),
      clientKey: applicationPortalRequestClientKey(request),
    });
    return applicationPortalJson(result);
  } catch (error) {
    return applicationPortalErrorResponse(error);
  }
}
