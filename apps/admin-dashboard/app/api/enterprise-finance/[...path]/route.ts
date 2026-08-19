import { NextRequest } from 'next/server';
import {
  proxyAdminJsonBody,
  proxyAdminJsonGET,
} from '@/app/api/_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    path: string[];
  };
};

function upstreamPath(request: NextRequest, context: RouteContext) {
  const segments = Array.isArray(context.params.path)
    ? context.params.path
    : [];

  if (
    segments.length === 0 ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('enterprise_finance_proxy_path_invalid');
  }

  return (
    '/api/enterprise-finance/' +
    segments.map((segment) => encodeURIComponent(segment)).join('/') +
    request.nextUrl.search
  );
}

function mutationHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const key = request.headers.get('idempotency-key');

  if (key) {
    headers['Idempotency-Key'] = key;
  }

  return headers;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  return proxyAdminJsonGET(request, {
    path: upstreamPath(request, context),
  });
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  return proxyAdminJsonBody(request, 'POST', {
    path: upstreamPath(request, context),
    headers: mutationHeaders(request),
  });
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  return proxyAdminJsonBody(request, 'PUT', {
    path: upstreamPath(request, context),
    headers: mutationHeaders(request),
  });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  return proxyAdminJsonBody(request, 'PATCH', {
    path: upstreamPath(request, context),
    headers: mutationHeaders(request),
  });
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  return proxyAdminJsonBody(request, 'DELETE', {
    path: upstreamPath(request, context),
    headers: mutationHeaders(request),
  });
}
