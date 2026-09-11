import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { patientGatewayHeaders, readPatientGatewayIdentity } from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayOrigin() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    ''
  ).replace(/\/+$/, '');
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) return json({ ok: false, error: 'patient_authentication_required' }, 401);

  const gateway = gatewayOrigin();
  if (!gateway) return json({ ok: false, error: 'api_gateway_base_not_configured' }, 503);

  const form = await req.formData().catch(() => null);
  if (!form) return json({ ok: false, error: 'expected_multipart_form_data' }, 400);

  const suppliedPatientId = String(form.get('patientId') || '').trim();
  if (suppliedPatientId && suppliedPatientId !== identity.patientId) {
    return json({ ok: false, error: 'patient_context_mismatch' }, 403);
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ ok: false, error: 'file_required' }, 400);

  const blob = file as File;
  if (!Number.isFinite(blob.size) || blob.size <= 0 || blob.size > 15 * 1024 * 1024) {
    return json({ ok: false, error: 'file_size_invalid' }, blob.size > 15 * 1024 * 1024 ? 413 : 400);
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  const checksumSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const contentType = String(blob.type || 'application/octet-stream').toLowerCase();
  const headers = patientGatewayHeaders({ req, identity, includeJson: true });

  const presignResponse = await fetch(`${gateway}/api/patient-medical-aids/documents/presign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contentType, sizeBytes: bytes.length, checksumSha256 }),
    cache: 'no-store',
  });
  const presign = await presignResponse.json().catch(() => null);
  if (!presignResponse.ok || !presign?.uploadUrl || !presign?.objectKey) {
    return json({ ok: false, error: presign?.error || 'patient_document_presign_failed' }, presignResponse.status || 502);
  }

  const uploadHeaders = new Headers();
  for (const [key, value] of Object.entries(presign.headers || {})) {
    if (typeof value === 'string' && value) uploadHeaders.set(key, value);
  }

  const uploadResponse = await fetch(String(presign.uploadUrl), {
    method: 'PUT',
    headers: uploadHeaders,
    body: bytes,
  });
  if (!uploadResponse.ok) {
    return json({ ok: false, error: 'patient_document_object_upload_failed', upstreamStatus: uploadResponse.status }, 502);
  }

  const confirmResponse = await fetch(`${gateway}/api/patient-medical-aids/documents/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      objectKey: presign.objectKey,
      contentType,
      sizeBytes: bytes.length,
      checksumSha256,
    }),
    cache: 'no-store',
  });
  const confirm = await confirmResponse.json().catch(() => null);
  if (!confirmResponse.ok || !confirm?.managedRef) {
    return json({ ok: false, error: confirm?.error || 'patient_document_confirm_failed' }, confirmResponse.status || 502);
  }

  const viewPath = `/api/medical-aids/documents/view?managedRef=${encodeURIComponent(confirm.managedRef)}`;
  return json({
    ok: true,
    comFilePath: viewPath,
    comManagedRef: confirm.managedRef,
    comFileName: blob.name || 'certificate-of-membership',
    contentType,
    sizeBytes: bytes.length,
    checksumSha256,
  });
}
