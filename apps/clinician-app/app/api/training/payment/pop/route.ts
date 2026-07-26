import { NextRequest, NextResponse } from 'next/server';
import {
  createTrustedClinicianIdentityHeader,
} from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 3 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

function gatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.APIGW_BASE_URL ||
    process.env.GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_GATEWAY_BASE ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');
}

function normaliseMime(value: unknown) {
  const mime = String(value || '')
    .trim()
    .toLowerCase();

  return mime === 'image/jpg'
    ? 'image/jpeg'
    : mime;
}

function safeText(value: FormDataEntryValue | null, max = 240) {
  const text = String(value || '').trim();

  if (!text) return null;

  return text.length > max
    ? text.slice(0, max)
    : text;
}

export async function POST(request: NextRequest) {
  try {
    const gateway = gatewayBase();

    if (!gateway) {
      return NextResponse.json(
        {
          ok: false,
          error: 'gateway_not_configured',
        },
        { status: 500 },
      );
    }

    const form = await request.formData();

    const fileValue = form.get('file');

    if (
      !fileValue ||
      typeof fileValue !== 'object' ||
      !('arrayBuffer' in fileValue)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'proof_of_payment_file_required',
        },
        { status: 400 },
      );
    }

    const file = fileValue as File;

    if (
      !Number.isFinite(file.size) ||
      file.size <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'proof_of_payment_file_empty',
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: 'proof_of_payment_file_too_large',
          maxBytes: MAX_BYTES,
        },
        { status: 413 },
      );
    }

    const mimeType = normaliseMime(file.type);

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'unsupported_proof_of_payment_file_type',
          allowedTypes: Array.from(ALLOWED_MIME_TYPES),
        },
        { status: 415 },
      );
    }

    const clinicianId = safeText(
      form.get('clinicianId'),
      120,
    );

    const slotId = safeText(
      form.get('slotId'),
      120,
    );

    const pathwayKey = safeText(
      form.get('pathwayKey'),
      80,
    );

    const trainingMode = safeText(
      form.get('trainingMode'),
      40,
    );

    if (!clinicianId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'clinicianId_required',
        },
        { status: 400 },
      );
    }

    if (!slotId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'slotId_required',
        },
        { status: 400 },
      );
    }

    if (!pathwayKey) {
      return NextResponse.json(
        {
          ok: false,
          error: 'pathwayKey_required',
        },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(
      await file.arrayBuffer(),
    );

    const headers = new Headers({
      accept: 'application/json',
      'content-type': 'application/json',
    });

    headers.set(
      'x-ambulant-identity',
      createTrustedClinicianIdentityHeader(
        request,
      ),
    );

    const upstream = await fetch(
      `${gateway}/api/clinicians/onboarding/payment/pop`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clinicianId,
          slotId,
          pathwayKey,
          trainingMode,
          filename: file.name,
          mimeType,
          base64: bytes.toString('base64'),
        }),
        cache: 'no-store',
      },
    );

    const text = await upstream.text();

    if (upstream.status >= 500) {
      console.error(
        '[clinician-app][payment-pop proxy] upstream failure',
        {
          status: upstream.status,
          body: text,
        },
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            'proof_of_payment_upload_failed',
          message:
            'We could not complete the Proof of Payment upload. Please try again or contact Ambulant+ support.',
        },
        {
          status: upstream.status,
          headers: {
            'cache-control': 'no-store',
          },
        },
      );
    }

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ||
          'application/json',
        'cache-control': 'no-store',
      },
    });
  }
  catch (error: any) {
    console.error(
      '[clinician-app][payment-pop proxy] error',
      error,
    );

    const status =
      typeof error?.status === 'number'
        ? error.status
        : 500;

    return NextResponse.json(
      {
        ok: false,
        error:
          'proof_of_payment_proxy_failed',
        message:
          'We could not complete the Proof of Payment upload. Please try again or contact Ambulant+ support.',
      },
      {
        status,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  }
}
