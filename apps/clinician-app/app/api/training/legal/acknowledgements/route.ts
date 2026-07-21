import { NextRequest } from 'next/server';
import {
  proxyTrainingRequest,
} from '../../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
) {
  return proxyTrainingRequest(
    request,
    '/api/legal/acknowledgements',
  );
}
