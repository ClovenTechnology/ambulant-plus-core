const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function uploadManagedFinanceDocument(input: { file: File; purpose: string }) {
  if (!ACCEPTED.has(input.file.type)) throw new Error('Upload a PDF, JPEG, PNG or WebP document.');
  if (!input.file.size || input.file.size > MAX_BYTES) throw new Error('Finance documents must be 20 MB or smaller.');
  const checksumSha256 = await sha256Hex(input.file);
  const presignResponse = await fetch('/api/enterprise-finance/documents/presign', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ purpose: input.purpose, contentType: input.file.type, sizeBytes: input.file.size, checksumSha256, fileName: input.file.name }),
  });
  const presign = await presignResponse.json().catch(() => null);
  if (!presignResponse.ok || !presign?.ok || !presign?.uploadUrl || !presign?.objectKey) throw new Error(presign?.error || 'Unable to prepare the finance document upload.');
  const uploaded = await fetch(presign.uploadUrl, { method: 'PUT', headers: presign.headers || { 'content-type': input.file.type }, body: input.file });
  if (!uploaded.ok) throw new Error('The finance document could not be uploaded.');
  const confirmResponse = await fetch('/api/enterprise-finance/documents/confirm', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ purpose: input.purpose, objectKey: presign.objectKey, contentType: input.file.type, sizeBytes: input.file.size, checksumSha256, fileName: input.file.name }),
  });
  const confirmed = await confirmResponse.json().catch(() => null);
  if (!confirmResponse.ok || !confirmed?.ok || !confirmed?.objectKey) throw new Error(confirmed?.error || 'The finance document could not be confirmed.');
  return confirmed as { objectKey: string; managedRef: string };
}
