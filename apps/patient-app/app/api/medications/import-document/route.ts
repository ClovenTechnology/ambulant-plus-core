// apps/patient-app/app/api/medications/import-document/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  return configured ? trimSlash(configured) : '';
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-correlation-id',
    'x-request-id',
    'idempotency-key',
    'x-idempotency-key',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isAllowedFile(file: File) {
  const allowedTypes = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
  ]);

  if (file.type && !allowedTypes.has(file.type)) return false;
  return file.size > 0 && file.size <= 8 * 1024 * 1024;
}

export async function POST(req: NextRequest) {
  const base = gatewayBase();
  if (!base) {
    return json(
      {
        ok: false,
        error: 'api_gateway_base_required',
        message: 'External eRx document import is unavailable because the API gateway is not configured.',
      },
      503,
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return json({ ok: false, error: 'invalid_multipart_form' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return json({ ok: false, error: 'file_required' }, 400);
  }

  if (!isAllowedFile(file)) {
    return json(
      {
        ok: false,
        error: 'unsupported_or_oversized_file',
        message: 'Upload a PDF, PNG, JPG, or WebP eRx document up to 8 MB.',
      },
      400,
    );
  }

  const upstream = new URL(`${base}/api/medications/import-document`);

  const res = await fetch(upstream.toString(), {
    method: 'POST',
    cache: 'no-store',
    headers: forwardHeaders(req),
    body: form,
  });

  const payload = await readPayload(res);

  return json(payload ?? { ok: res.ok }, res.status);
}
