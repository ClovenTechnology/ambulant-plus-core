const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED = new Set(['application/pdf', 'image/jpeg', 'image/png']);

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function uploadStaffEmploymentDocument(input: {
  file: File;
  presignUrl: string;
  confirmUrl: string;
  documentType: string;
  title: string;
  effectiveAt?: string | null;
  expiresAt?: string | null;
}) {
  if (!ACCEPTED.has(input.file.type)) throw new Error('Upload a PDF, JPEG or PNG document.');
  if (!input.file.size || input.file.size > MAX_BYTES) throw new Error('Employment documents must be 15 MB or smaller.');
  const checksumSha256 = await sha256Hex(input.file);
  const presignResponse = await fetch(input.presignUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentType: input.file.type, sizeBytes: input.file.size, checksumSha256 }),
  });
  const presign = await presignResponse.json().catch(() => null);
  if (!presignResponse.ok || !presign?.ok || !presign?.uploadUrl || !presign?.objectKey) {
    throw new Error(presign?.message || presign?.error || 'Unable to prepare the document upload.');
  }
  const uploaded = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: presign.headers || { 'content-type': input.file.type },
    body: input.file,
  });
  if (!uploaded.ok) throw new Error('The document could not be uploaded. Please try again.');
  const confirmResponse = await fetch(input.confirmUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      objectKey: presign.objectKey,
      contentType: input.file.type,
      sizeBytes: input.file.size,
      checksumSha256,
      fileName: input.file.name,
      documentType: input.documentType,
      title: input.title || input.file.name,
      effectiveAt: input.effectiveAt || null,
      expiresAt: input.expiresAt || null,
    }),
  });
  const confirmed = await confirmResponse.json().catch(() => null);
  if (!confirmResponse.ok || !confirmed?.ok) throw new Error(confirmed?.message || confirmed?.error || 'The document could not be saved.');
  return confirmed;
}
