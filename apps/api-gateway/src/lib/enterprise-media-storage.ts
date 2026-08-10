import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const VIEW_URL_TTL_SECONDS = 5 * 60;
export const ENTERPRISE_MEDIA_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ENTERPRISE_MEDIA_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type EnterpriseMediaKind = 'opportunity-image' | 'staff-avatar' | 'staff-id-template';

const MANAGED_REF_PREFIX = 'managed://ambulant-enterprise-media/';

export class EnterpriseMediaStorageError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 503) {
    super(code);
    this.name = 'EnterpriseMediaStorageError';
    this.status = status;
    this.code = code;
  }
}

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function safeObjectSegment(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 160);
}

function configuredValue(
  candidates: Array<{ name: string; value: unknown }>,
  max: number,
) {
  for (const candidate of candidates) {
    const value = clean(candidate.value, max);
    if (value) return { value, source: candidate.name };
  }
  return { value: '', source: null as string | null };
}

export function enterpriseMediaStorageStatus() {
  const bucket = configuredValue(
    [
      { name: 'ADMIN_MEDIA_S3_BUCKET', value: process.env.ADMIN_MEDIA_S3_BUCKET },
      { name: 'APPLICATION_DOCUMENT_S3_BUCKET', value: process.env.APPLICATION_DOCUMENT_S3_BUCKET },
      { name: 'FORM_SUBMISSION_S3_BUCKET', value: process.env.FORM_SUBMISSION_S3_BUCKET },
      { name: 'S3_EVIDENCE_BUCKET', value: process.env.S3_EVIDENCE_BUCKET },
      { name: 'S3_BUCKET', value: process.env.S3_BUCKET },
    ],
    255,
  );
  const region = configuredValue(
    [
      { name: 'ADMIN_MEDIA_S3_REGION', value: process.env.ADMIN_MEDIA_S3_REGION },
      { name: 'APPLICATION_DOCUMENT_S3_REGION', value: process.env.APPLICATION_DOCUMENT_S3_REGION },
      { name: 'FORM_SUBMISSION_S3_REGION', value: process.env.FORM_SUBMISSION_S3_REGION },
      { name: 'AWS_REGION', value: process.env.AWS_REGION },
      { name: 'AWS_DEFAULT_REGION', value: process.env.AWS_DEFAULT_REGION },
    ],
    120,
  );

  return {
    configured: Boolean(bucket.value && region.value),
    bucketSource: bucket.source,
    regionSource: region.source,
    required: {
      preferredBucket: 'ADMIN_MEDIA_S3_BUCKET',
      preferredRegion: 'ADMIN_MEDIA_S3_REGION',
    },
  };
}

function storageConfig() {
  const bucket = configuredValue(
    [
      { name: 'ADMIN_MEDIA_S3_BUCKET', value: process.env.ADMIN_MEDIA_S3_BUCKET },
      { name: 'APPLICATION_DOCUMENT_S3_BUCKET', value: process.env.APPLICATION_DOCUMENT_S3_BUCKET },
      { name: 'FORM_SUBMISSION_S3_BUCKET', value: process.env.FORM_SUBMISSION_S3_BUCKET },
      { name: 'S3_EVIDENCE_BUCKET', value: process.env.S3_EVIDENCE_BUCKET },
      { name: 'S3_BUCKET', value: process.env.S3_BUCKET },
    ],
    255,
  );
  const region = configuredValue(
    [
      { name: 'ADMIN_MEDIA_S3_REGION', value: process.env.ADMIN_MEDIA_S3_REGION },
      { name: 'APPLICATION_DOCUMENT_S3_REGION', value: process.env.APPLICATION_DOCUMENT_S3_REGION },
      { name: 'FORM_SUBMISSION_S3_REGION', value: process.env.FORM_SUBMISSION_S3_REGION },
      { name: 'AWS_REGION', value: process.env.AWS_REGION },
      { name: 'AWS_DEFAULT_REGION', value: process.env.AWS_DEFAULT_REGION },
    ],
    120,
  );

  if (!bucket.value || !region.value) {
    throw new EnterpriseMediaStorageError('enterprise_media_storage_not_configured');
  }

  return {
    bucket: bucket.value,
    region: region.value,
    client: new S3Client({ region: region.value }),
  };
}

export function isEnterpriseMediaImageType(value: unknown) {
  return ENTERPRISE_MEDIA_IMAGE_TYPES.includes(
    clean(value, 160).toLowerCase() as (typeof ENTERPRISE_MEDIA_IMAGE_TYPES)[number],
  );
}

export function validEnterpriseMediaSize(value: unknown) {
  const size = Number(value);
  return (
    Number.isInteger(size) &&
    size > 0 &&
    size <= ENTERPRISE_MEDIA_MAX_IMAGE_BYTES
  );
}

export function validEnterpriseMediaChecksum(value: unknown) {
  return /^[a-f0-9]{64}$/i.test(clean(value, 64));
}

export function enterpriseMediaObjectKey(input: {
  kind: EnterpriseMediaKind;
  ownerId: string;
}) {
  return [
    'enterprise-media',
    input.kind,
    safeObjectSegment(input.ownerId),
    randomUUID(),
  ].join('/');
}

export function enterpriseMediaObjectBelongsTo(input: {
  objectKey: string;
  kind: EnterpriseMediaKind;
  ownerId: string;
}) {
  const prefix = [
    'enterprise-media',
    input.kind,
    safeObjectSegment(input.ownerId),
    '',
  ].join('/');
  return clean(input.objectKey, 512).startsWith(prefix);
}

export function managedEnterpriseMediaRef(objectKey: string) {
  return `${MANAGED_REF_PREFIX}${clean(objectKey, 512)}`;
}

export function isManagedEnterpriseMediaRef(value: unknown) {
  const raw = clean(value, 2048);
  return raw.startsWith(MANAGED_REF_PREFIX) && raw.length > MANAGED_REF_PREFIX.length;
}

export function objectKeyFromManagedEnterpriseMediaRef(value: unknown) {
  if (!isManagedEnterpriseMediaRef(value)) return null;
  const objectKey = clean(value, 2048).slice(MANAGED_REF_PREFIX.length);
  return objectKey || null;
}

export function managedEnterpriseMediaKind(value: unknown): EnterpriseMediaKind | null {
  const objectKey = objectKeyFromManagedEnterpriseMediaRef(value);
  if (!objectKey) return null;
  if (objectKey.startsWith('enterprise-media/opportunity-image/')) {
    return 'opportunity-image';
  }
  if (objectKey.startsWith('enterprise-media/staff-avatar/')) {
    return 'staff-avatar';
  }
  if (objectKey.startsWith('enterprise-media/staff-id-template/')) {
    return 'staff-id-template';
  }
  return null;
}

export function enterpriseMediaSignatureMatches(
  contentType: string,
  bytes: Uint8Array,
) {
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (contentType === 'image/webp') {
    if (bytes.length < 12) return false;
    const ascii = (start: number, end: number) =>
      String.fromCharCode(...Array.from(bytes.slice(start, end)));
    return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  }
  return false;
}

export function validateEnterpriseMediaUploadInput(input: {
  contentType: unknown;
  sizeBytes: unknown;
  checksumSha256: unknown;
}) {
  const contentType = clean(input.contentType, 160).toLowerCase();
  const sizeBytes = Number(input.sizeBytes);
  const checksumSha256 = clean(input.checksumSha256, 64).toLowerCase();

  if (!isEnterpriseMediaImageType(contentType)) {
    throw new EnterpriseMediaStorageError('enterprise_media_image_type_invalid', 400);
  }
  if (!validEnterpriseMediaSize(sizeBytes)) {
    throw new EnterpriseMediaStorageError('enterprise_media_image_size_invalid', 400);
  }
  if (!validEnterpriseMediaChecksum(checksumSha256)) {
    throw new EnterpriseMediaStorageError('enterprise_media_checksum_invalid', 400);
  }

  return { contentType, sizeBytes, checksumSha256 };
}

export async function presignEnterpriseMediaUpload(input: {
  objectKey: string;
  contentType: string;
  checksumSha256: string;
}) {
  const storage = storageConfig();
  const checksumBase64 = Buffer.from(input.checksumSha256, 'hex').toString('base64');

  const uploadUrl = await getSignedUrl(
    storage.client,
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      ChecksumSHA256: checksumBase64,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

  return {
    uploadUrl,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    headers: {
      'content-type': input.contentType,
      'x-amz-checksum-sha256': checksumBase64,
    },
  };
}

export async function verifyEnterpriseMediaUpload(input: {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
}) {
  const storage = storageConfig();
  const head = await storage.client.send(
    new HeadObjectCommand({
      Bucket: storage.bucket,
      Key: input.objectKey,
      ChecksumMode: 'ENABLED',
    }),
  );

  if (Number(head.ContentLength ?? -1) !== input.sizeBytes) {
    throw new EnterpriseMediaStorageError('enterprise_media_size_mismatch', 409);
  }
  if (clean(head.ContentType, 160).toLowerCase() !== input.contentType) {
    throw new EnterpriseMediaStorageError('enterprise_media_type_mismatch', 409);
  }

  const expectedChecksum = Buffer.from(input.checksumSha256, 'hex').toString('base64');
  if (head.ChecksumSHA256 && head.ChecksumSHA256 !== expectedChecksum) {
    throw new EnterpriseMediaStorageError('enterprise_media_checksum_mismatch', 409);
  }

  const response = await storage.client.send(
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: input.objectKey,
      Range: 'bytes=0-31',
    }),
  );
  const body = response.Body as
    | { transformToByteArray?: () => Promise<Uint8Array> }
    | undefined;

  if (!body?.transformToByteArray) {
    throw new EnterpriseMediaStorageError('enterprise_media_signature_unavailable');
  }
  const bytes = await body.transformToByteArray();
  if (!enterpriseMediaSignatureMatches(input.contentType, bytes)) {
    throw new EnterpriseMediaStorageError('enterprise_media_signature_invalid', 400);
  }
}

export function enterpriseMediaResponseBody(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function getEnterpriseMediaObject(objectKey: string) {
  const storage = storageConfig();
  const response = await storage.client.send(
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: clean(objectKey, 700),
    }),
  );

  const body = response.Body as
    | { transformToByteArray?: () => Promise<Uint8Array> }
    | undefined;

  if (!body?.transformToByteArray) {
    throw new EnterpriseMediaStorageError('enterprise_media_object_unavailable', 503);
  }

  const bytes = await body.transformToByteArray();
  return {
    bytes,
    contentType: clean(response.ContentType, 160) || 'application/octet-stream',
    contentLength: Number(response.ContentLength ?? bytes.byteLength),
    etag: clean(response.ETag, 240) || null,
    lastModified: response.LastModified || null,
  };
}

export async function presignEnterpriseMediaView(objectKey: string) {
  const storage = storageConfig();
  const viewUrl = await getSignedUrl(
    storage.client,
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
      ResponseCacheControl: 'private, max-age=300',
    }),
    { expiresIn: VIEW_URL_TTL_SECONDS },
  );
  return { viewUrl, expiresInSeconds: VIEW_URL_TTL_SECONDS };
}

export async function deleteEnterpriseMedia(objectKey: string) {
  const storage = storageConfig();
  await storage.client.send(
    new DeleteObjectCommand({ Bucket: storage.bucket, Key: objectKey }),
  );
}

export async function bestEffortDeleteManagedEnterpriseMedia(value: unknown) {
  const objectKey = objectKeyFromManagedEnterpriseMediaRef(value);
  if (!objectKey) return;
  try {
    await deleteEnterpriseMedia(objectKey);
  } catch (error) {
    console.error('[enterprise media] cleanup failed', { objectKey, error });
  }
}

export function enterpriseMediaErrorResponse(error: unknown) {
  if (error instanceof EnterpriseMediaStorageError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: error.code,
        ...(error.code === 'enterprise_media_storage_not_configured'
          ? {
              message:
                'Image storage is not configured for this environment. Configure the Ambulant+ enterprise media bucket and region, then retry.',
              configuration: enterpriseMediaStorageStatus(),
            }
          : {}),
      },
    };
  }
  return null;
}
