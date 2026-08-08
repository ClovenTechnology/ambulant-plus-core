import { NextRequest } from 'next/server';
import { formGatewayFetch, upstreamJson } from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: { slug: string } },
) {
  const slug = encodeURIComponent(String(context.params.slug || '').trim());
  const { response, json } = await formGatewayFetch(
    request,
    `/api/forms/public/${slug}`,
  );

  return upstreamJson(response, json);
}
