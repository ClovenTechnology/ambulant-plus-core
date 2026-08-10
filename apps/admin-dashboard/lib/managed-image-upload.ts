const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class ManagedImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManagedImageUploadError';
  }
}

function uploadErrorMessage(value: unknown, fallback: string) {
  const code = String(value || '').trim();
  const messages: Record<string, string> = {
    enterprise_media_storage_not_configured: 'Image uploads are temporarily unavailable. Please contact an administrator.',
    enterprise_media_image_type_invalid: 'Choose a JPEG, PNG or WebP image.',
    enterprise_media_image_size_invalid: 'Image files must be 8 MB or smaller.',
    enterprise_media_checksum_invalid: 'The image could not be verified. Please choose the file again.',
    enterprise_media_size_mismatch: 'The uploaded image size could not be verified. Please try again.',
    enterprise_media_type_mismatch: 'The uploaded file type could not be verified. Please choose another image.',
    enterprise_media_checksum_mismatch: 'The uploaded image could not be verified. Please try again.',
    enterprise_media_signature_invalid: 'The uploaded file is not a valid JPEG, PNG or WebP image.',
    secure_admin_credential_required: 'Please sign in with your password before changing this image.',
    staff_capability_required: 'You do not have permission to change this profile photo.',
  };
  return messages[code] || (code && !code.includes('_') ? code : fallback);
}

async function sha256Hex(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function validateImage(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new ManagedImageUploadError('Choose a JPEG, PNG or WebP image.');
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new ManagedImageUploadError('Image files must be 8 MB or smaller.');
  }
}

export async function uploadManagedImage(input: {
  file: File;
  presignUrl: string;
  confirmUrl: string;
  confirmBody?: Record<string, unknown>;
}) {
  validateImage(input.file);
  const checksumSha256 = await sha256Hex(input.file);

  const presignResponse = await fetch(input.presignUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contentType: input.file.type,
      sizeBytes: input.file.size,
      checksumSha256,
    }),
  });
  const presignJson = await presignResponse.json().catch(() => null);
  if (!presignResponse.ok || !presignJson?.ok || !presignJson?.uploadUrl || !presignJson?.objectKey) {
    throw new ManagedImageUploadError(
      uploadErrorMessage(presignJson?.message || presignJson?.error, 'Unable to prepare the image upload.'),
    );
  }

  const uploadResponse = await fetch(presignJson.uploadUrl, {
    method: 'PUT',
    headers: presignJson.headers || { 'content-type': input.file.type },
    body: input.file,
  });
  if (!uploadResponse.ok) {
    throw new ManagedImageUploadError('The image could not be uploaded. Please try again.');
  }

  const confirmResponse = await fetch(input.confirmUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      objectKey: presignJson.objectKey,
      contentType: input.file.type,
      sizeBytes: input.file.size,
      checksumSha256,
      ...(input.confirmBody || {}),
    }),
  });
  const confirmJson = await confirmResponse.json().catch(() => null);
  if (!confirmResponse.ok || !confirmJson?.ok) {
    throw new ManagedImageUploadError(
      uploadErrorMessage(confirmJson?.message || confirmJson?.error, 'The uploaded image could not be saved.'),
    );
  }
  return confirmJson;
}
