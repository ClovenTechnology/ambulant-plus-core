import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const VIEW_URL_TTL_SECONDS = 5 * 60;
export const ENTERPRISE_FINANCE_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const ENTERPRISE_FINANCE_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type EnterpriseFinanceDocumentPurpose =
  | 'expenditure-invoice'
  | 'expenditure-evidence'
  | 'proof-of-payment'
  | 'vendor-invoice'
  | 'revenue-evidence'
  | 'shareholder-document'
  | 'annual-return'
  | 'agm-document'
  | 'board-resolution'
  | 'valuation-document'
  | 'import-document';

const MANAGED_REF_PREFIX = 'managed://ambulant-finance-documents/';

export class EnterpriseFinanceDocumentStorageError extends Error {
  status: number;
  code: string;
  constructor(code: string, status = 503) {
    super(code);
    this.name = 'EnterpriseFinanceDocumentStorageError';
    this.status = status;
    this.code = code;
  }
}

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function safeSegment(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 160);
}

function configuredValue(candidates: Array<{ name: string; value: unknown }>, max: number) {
  for (const candidate of candidates) {
    const value = clean(candidate.value, max);
    if (value) return { value, source: candidate.name };
  }
  return { value: '', source: null as string | null };
}

function config() {
  const bucket = configuredValue([
    { name: 'ADMIN_MEDIA_S3_BUCKET', value: process.env.ADMIN_MEDIA_S3_BUCKET },
    { name: 'APPLICATION_DOCUMENT_S3_BUCKET', value: process.env.APPLICATION_DOCUMENT_S3_BUCKET },
    { name: 'FORM_SUBMISSION_S3_BUCKET', value: process.env.FORM_SUBMISSION_S3_BUCKET },
    { name: 'S3_EVIDENCE_BUCKET', value: process.env.S3_EVIDENCE_BUCKET },
    { name: 'S3_BUCKET', value: process.env.S3_BUCKET },
  ], 255);
  const region = configuredValue([
    { name: 'ADMIN_MEDIA_S3_REGION', value: process.env.ADMIN_MEDIA_S3_REGION },
    { name: 'APPLICATION_DOCUMENT_S3_REGION', value: process.env.APPLICATION_DOCUMENT_S3_REGION },
    { name: 'FORM_SUBMISSION_S3_REGION', value: process.env.FORM_SUBMISSION_S3_REGION },
    { name: 'AWS_REGION', value: process.env.AWS_REGION },
    { name: 'AWS_DEFAULT_REGION', value: process.env.AWS_DEFAULT_REGION },
  ], 120);
  if (!bucket.value || !region.value) {
    throw new EnterpriseFinanceDocumentStorageError('enterprise_finance_document_storage_not_configured');
  }
  return { bucket: bucket.value, region: region.value, client: new S3Client({ region: region.value }) };
}

export function validateEnterpriseFinanceDocumentUploadInput(input: {
  contentType: unknown;
  sizeBytes: unknown;
  checksumSha256: unknown;
}) {
  const contentType = clean(input.contentType, 160).toLowerCase();
  const sizeBytes = Number(input.sizeBytes);
  const checksumSha256 = clean(input.checksumSha256, 64).toLowerCase();
  if (!ENTERPRISE_FINANCE_DOCUMENT_TYPES.includes(contentType as any)) {
    throw new EnterpriseFinanceDocumentStorageError('enterprise_finance_document_type_invalid', 400);
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > ENTERPRISE_FINANCE_DOCUMENT_MAX_BYTES) {
    throw new EnterpriseFinanceDocumentStorageError('enterprise_finance_document_size_invalid', 400);
  }
  if (!/^[a-f0-9]{64}$/i.test(checksumSha256)) {
    throw new EnterpriseFinanceDocumentStorageError('enterprise_finance_document_checksum_invalid', 400);
  }
  return { contentType, sizeBytes, checksumSha256 };
}

export function enterpriseFinanceDocumentObjectKey(input: {
  purpose: EnterpriseFinanceDocumentPurpose;
  actorId: string;
}) {
  return ['enterprise-finance-documents', input.purpose, safeSegment(input.actorId), randomUUID()].join('/');
}

export function managedEnterpriseFinanceDocumentRef(objectKey: string) {
  return `${MANAGED_REF_PREFIX}${clean(objectKey, 700)}`;
}

export function objectKeyFromManagedEnterpriseFinanceDocumentRef(value: unknown) {
  const raw = clean(value, 1200);
  return raw.startsWith(MANAGED_REF_PREFIX) ? raw.slice(MANAGED_REF_PREFIX.length) || null : null;
}

export async function presignEnterpriseFinanceDocumentUpload(input: {
  objectKey: string;
  contentType: string;
  checksumSha256: string;
}) {
  const storage = config();
  const checksumBase64 = Buffer.from(input.checksumSha256, 'hex').toString('base64');
  const uploadUrl = await getSignedUrl(
    storage.client,
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      ChecksumSHA256: checksumBase64,
    }),
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      unhoistableHeaders: new Set(['x-amz-checksum-sha256']),
      signableHeaders: new Set(['content-type']),
    },
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

function signatureMatches(contentType: string, bytes: Uint8Array) {
  if (contentType === 'application/pdf') {
    return bytes.length >= 5 && String.fromCharCode(...Array.from(bytes.slice(0, 5))) === '%PDF-';
  }
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= sig.length && sig.every((v, i) => bytes[i] === v);
  }
  if (contentType === 'image/webp') {
    if (bytes.length < 12) return false;
    const ascii = (start: number, end: number) => String.fromCharCode(...Array.from(bytes.slice(start, end)));
    return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  }
  return false;
}

export async function verifyEnterpriseFinanceDocumentUpload(input: {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
}) {
  const storage = config();
  const head = await storage.client.send(new HeadObjectCommand({
    Bucket: storage.bucket,
    Key: input.objectKey,
    ChecksumMode: 'ENABLED',
  }));
  if (Number(head.ContentLength ?? -1) !== input.sizeBytes) {
    throw new EnterpriseFinanceDocumentStorageError('enterprise_finance_document_size_mismatch', 409);
  }
  if (clean(head.ContentType, 160).toLowerCase() !== input.contentType) {
    throw new EnterpriseFinanceDocumentStorageError('enterprise_finance_document_type_mismatch', 409);
  }
  const expectedChecksum = Buffer.from(input.checksumSha256, 'hex').toString('base64');
  if (head.ChecksumSHA256 && head.ChecksumSHA256 !== expectedChecksum) {
    throw new EnterpriseFinanceDocumentStorageError('enterprise_finance_document_checksum_mismatch', 409);
  }
  const response = await storage.client.send(new GetObjectCommand({
    Bucket: storage.bucket,
    Key: input.objectKey,
    Range: 'bytes=0-31',
  }));
  const body = response.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
  if (!body?.transformToByteArray) {
    throw new EnterpriseFinanceDocumentStorageError('enterprise_finance_document_signature_unavailable');
  }
  const bytes = await body.transformToByteArray();
  if (!signatureMatches(input.contentType, bytes)) {
    throw new EnterpriseFinanceDocumentStorageError('enterprise_finance_document_signature_invalid', 400);
  }
}

export async function presignEnterpriseFinanceDocumentView(objectKey: string) {
  const storage = config();
  const viewUrl = await getSignedUrl(
    storage.client,
    new GetObjectCommand({ Bucket: storage.bucket, Key: clean(objectKey, 700), ResponseCacheControl: 'private, max-age=300' }),
    { expiresIn: VIEW_URL_TTL_SECONDS },
  );
  return { viewUrl, expiresInSeconds: VIEW_URL_TTL_SECONDS };
}

export function enterpriseFinanceDocumentErrorResponse(error: unknown) {
  if (error instanceof EnterpriseFinanceDocumentStorageError) {
    return { status: error.status, body: { ok: false, error: error.code } };
  }
  return null;
}
