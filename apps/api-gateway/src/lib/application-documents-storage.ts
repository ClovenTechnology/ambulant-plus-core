import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { applicationDocumentSignatureMatches } from './application-documents-policy';

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

export class ApplicationDocumentStorageError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 503) {
    super(code);
    this.name = 'ApplicationDocumentStorageError';
    this.status = status;
    this.code = code;
  }
}

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function storageConfig() {
  const bucket = clean(
    process.env.APPLICATION_DOCUMENT_S3_BUCKET ||
      process.env.FORM_SUBMISSION_S3_BUCKET ||
      process.env.S3_EVIDENCE_BUCKET ||
      process.env.S3_BUCKET,
    255,
  );
  const region = clean(
    process.env.APPLICATION_DOCUMENT_S3_REGION ||
      process.env.FORM_SUBMISSION_S3_REGION ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION,
    120,
  );

  if (!bucket || !region) {
    throw new ApplicationDocumentStorageError('application_document_storage_not_configured');
  }

  return { bucket, client: new S3Client({ region }) };
}

export function safeApplicationDocumentFileName(value: unknown) {
  const source = clean(value, 255) || 'document';
  return source
    .replace(/[\\/\u0000-\u001f\u007f]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 255);
}

function safeObjectSegment(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 160);
}

export function applicationDocumentObjectKey(input: {
  applicationId: string;
  requestId: string;
}) {
  return [
    'application-documents',
    safeObjectSegment(input.applicationId),
    safeObjectSegment(input.requestId),
    randomUUID(),
  ].join('/');
}

export async function presignApplicationDocumentUpload(input: {
  objectKey: string;
  contentType: string;
  checksumSha256Hex: string;
}) {
  const storage = storageConfig();
  const checksumBase64 = Buffer.from(input.checksumSha256Hex, 'hex').toString('base64');

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

export async function headApplicationDocument(objectKey: string) {
  const storage = storageConfig();
  return storage.client.send(
    new HeadObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
      ChecksumMode: 'ENABLED',
    }),
  );
}

export async function verifyApplicationDocumentSignature(
  objectKey: string,
  contentType: string,
) {
  const storage = storageConfig();
  const response = await storage.client.send(
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
      Range: 'bytes=0-15',
    }),
  );
  const body = response.Body as
    | { transformToByteArray?: () => Promise<Uint8Array> }
    | undefined;

  if (!body?.transformToByteArray) {
    throw new ApplicationDocumentStorageError('application_document_signature_unavailable');
  }

  const bytes = await body.transformToByteArray();
  return applicationDocumentSignatureMatches(contentType, bytes);
}

export async function deleteApplicationDocument(objectKey: string) {
  const storage = storageConfig();
  await storage.client.send(
    new DeleteObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
    }),
  );
}

export async function presignApplicationDocumentDownload(
  objectKey: string,
  fileName: string,
) {
  const storage = storageConfig();
  const safeName = safeApplicationDocumentFileName(fileName);
  const encodedName = encodeURIComponent(safeName);
  const downloadUrl = await getSignedUrl(
    storage.client,
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="document"; filename*=UTF-8''${encodedName}`,
      ResponseContentType: 'application/octet-stream',
      ResponseCacheControl: 'no-store',
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );

  return {
    downloadUrl,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
  };
}
