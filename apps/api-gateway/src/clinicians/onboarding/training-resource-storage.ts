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
const ACCESS_URL_TTL_SECONDS = 5 * 60;

export const TRAINING_RESOURCE_MAX_BYTES =
  25 * 1024 * 1024;

export const TRAINING_RESOURCE_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type TrainingResourceContentType =
  (typeof TRAINING_RESOURCE_CONTENT_TYPES)[number];

export type TrainingResourceDisposition =
  | 'inline'
  | 'attachment';

export class TrainingResourceStorageError extends Error {
  status: number;
  code: string;

  constructor(
    code: string,
    status = 503,
  ) {
    super(code);
    this.name =
      'TrainingResourceStorageError';
    this.status =
      status;
    this.code =
      code;
  }
}

function clean(
  value: unknown,
  max: number,
) {
  return String(
    value ?? '',
  )
    .trim()
    .slice(
      0,
      max,
    );
}

function configuredValue(
  candidates: Array<{
    name: string;
    value: unknown;
  }>,
  max: number,
) {
  for (
    const candidate of
    candidates
  ) {
    const value =
      clean(
        candidate.value,
        max,
      );

    if (value) {
      return {
        value,
        source:
          candidate.name,
      };
    }
  }

  return {
    value: '',
    source:
      null as string | null,
  };
}

export function trainingResourceStorageStatus() {
  const bucket =
    configuredValue(
      [
        {
          name:
            'TRAINING_RESOURCE_S3_BUCKET',
          value:
            process.env
              .TRAINING_RESOURCE_S3_BUCKET,
        },
        {
          name:
            'ADMIN_MEDIA_S3_BUCKET',
          value:
            process.env
              .ADMIN_MEDIA_S3_BUCKET,
        },
        {
          name:
            'APPLICATION_DOCUMENT_S3_BUCKET',
          value:
            process.env
              .APPLICATION_DOCUMENT_S3_BUCKET,
        },
        {
          name:
            'FORM_SUBMISSION_S3_BUCKET',
          value:
            process.env
              .FORM_SUBMISSION_S3_BUCKET,
        },
        {
          name:
            'S3_EVIDENCE_BUCKET',
          value:
            process.env
              .S3_EVIDENCE_BUCKET,
        },
        {
          name:
            'S3_BUCKET',
          value:
            process.env
              .S3_BUCKET,
        },
      ],
      255,
    );

  const region =
    configuredValue(
      [
        {
          name:
            'TRAINING_RESOURCE_S3_REGION',
          value:
            process.env
              .TRAINING_RESOURCE_S3_REGION,
        },
        {
          name:
            'ADMIN_MEDIA_S3_REGION',
          value:
            process.env
              .ADMIN_MEDIA_S3_REGION,
        },
        {
          name:
            'APPLICATION_DOCUMENT_S3_REGION',
          value:
            process.env
              .APPLICATION_DOCUMENT_S3_REGION,
        },
        {
          name:
            'FORM_SUBMISSION_S3_REGION',
          value:
            process.env
              .FORM_SUBMISSION_S3_REGION,
        },
        {
          name:
            'AWS_REGION',
          value:
            process.env
              .AWS_REGION,
        },
        {
          name:
            'AWS_DEFAULT_REGION',
          value:
            process.env
              .AWS_DEFAULT_REGION,
        },
      ],
      120,
    );

  return {
    configured:
      Boolean(
        bucket.value &&
        region.value,
      ),
    bucketSource:
      bucket.source,
    regionSource:
      region.source,
    preferred: {
      bucket:
        'TRAINING_RESOURCE_S3_BUCKET',
      region:
        'TRAINING_RESOURCE_S3_REGION',
    },
  };
}

function storageConfig() {
  const status =
    trainingResourceStorageStatus();

  const bucketName =
    status.bucketSource
      ? clean(
          process.env[
            status.bucketSource
          ],
          255,
        )
      : '';

  const regionName =
    status.regionSource
      ? clean(
          process.env[
            status.regionSource
          ],
          120,
        )
      : '';

  if (
    !bucketName ||
    !regionName
  ) {
    throw new TrainingResourceStorageError(
      'training_resource_storage_not_configured',
      503,
    );
  }

  return {
    bucket:
      bucketName,
    client:
      new S3Client({
        region:
          regionName,
      }),
  };
}

function safeSegment(
  value: unknown,
) {
  return clean(
    value,
    180,
  )
    .replace(
      /[^A-Za-z0-9_-]+/g,
      '_',
    )
    .slice(
      0,
      160,
    );
}

export function safeTrainingResourceFileName(
  value: unknown,
) {
  const source =
    clean(
      value,
      255,
    ) ||
    'training-resource';

  return source
    .replace(
      /[\\/\u0000-\u001f\u007f]+/g,
      '_',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .replace(
      /"/g,
      '',
    )
    .slice(
      0,
      255,
    );
}

export function isTrainingResourceContentType(
  value: unknown,
): value is TrainingResourceContentType {
  return TRAINING_RESOURCE_CONTENT_TYPES.includes(
    clean(
      value,
      180,
    )
      .toLowerCase() as
      TrainingResourceContentType,
  );
}

export function validateTrainingResourceUploadInput(
  input: {
    fileName: unknown;
    contentType: unknown;
    sizeBytes: unknown;
    checksumSha256: unknown;
  },
) {
  const fileName =
    safeTrainingResourceFileName(
      input.fileName,
    );

  const contentType =
    clean(
      input.contentType,
      180,
    )
      .toLowerCase();

  const sizeBytes =
    Math.floor(
      Number(
        input.sizeBytes,
      ),
    );

  const checksumSha256 =
    clean(
      input.checksumSha256,
      64,
    )
      .toLowerCase();

  if (
    !isTrainingResourceContentType(
      contentType,
    )
  ) {
    throw new TrainingResourceStorageError(
      'training_resource_type_invalid',
      415,
    );
  }

  if (
    !Number.isInteger(
      sizeBytes,
    ) ||
    sizeBytes < 1 ||
    sizeBytes >
      TRAINING_RESOURCE_MAX_BYTES
  ) {
    throw new TrainingResourceStorageError(
      'training_resource_size_invalid',
      413,
    );
  }

  if (
    !/^[a-f0-9]{64}$/.test(
      checksumSha256,
    )
  ) {
    throw new TrainingResourceStorageError(
      'training_resource_checksum_invalid',
      400,
    );
  }

  const lowerName =
    fileName.toLowerCase();

  const expectedExtensions:
    Partial<
      Record<
        TrainingResourceContentType,
        string[]
      >
    > = {
      'application/pdf': [
        '.pdf',
      ],
      'application/msword': [
        '.doc',
      ],
      'application/vnd.ms-powerpoint': [
        '.ppt',
      ],
      'application/vnd.ms-excel': [
        '.xls',
      ],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        [
          '.docx',
        ],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        [
          '.pptx',
        ],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        [
          '.xlsx',
        ],
      'image/jpeg': [
        '.jpg',
        '.jpeg',
      ],
      'image/png': [
        '.png',
      ],
      'image/webp': [
        '.webp',
      ],
    };

  const extensions =
    expectedExtensions[
      contentType as
        TrainingResourceContentType
    ] ||
    [];

  if (
    extensions.length &&
    !extensions.some(
      (extension) =>
        lowerName.endsWith(
          extension,
        ),
    )
  ) {
    throw new TrainingResourceStorageError(
      'training_resource_extension_mismatch',
      415,
    );
  }

  return {
    fileName,
    contentType:
      contentType as
        TrainingResourceContentType,
    sizeBytes,
    checksumSha256,
  };
}

export function trainingResourceObjectKey(
  input: {
    resourceId: string;
    versionId: string;
  },
) {
  return [
    'training-resources',
    safeSegment(
      input.resourceId,
    ),
    safeSegment(
      input.versionId,
    ),
    randomUUID(),
  ].join('/');
}

export function trainingResourceObjectBelongsTo(
  input: {
    objectKey: unknown;
    resourceId: string;
    versionId: string;
  },
) {
  const prefix = [
    'training-resources',
    safeSegment(
      input.resourceId,
    ),
    safeSegment(
      input.versionId,
    ),
    '',
  ].join('/');

  return clean(
    input.objectKey,
    1000,
  ).startsWith(
    prefix,
  );
}

export async function presignTrainingResourceUpload(
  input: {
    objectKey: string;
    contentType:
      TrainingResourceContentType;
    checksumSha256: string;
  },
) {
  const storage =
    storageConfig();

  const checksumBase64 =
    Buffer.from(
      input.checksumSha256,
      'hex',
    ).toString(
      'base64',
    );

  const uploadUrl =
    await getSignedUrl(
      storage.client,
      new PutObjectCommand({
        Bucket:
          storage.bucket,
        Key:
          input.objectKey,
        ContentType:
          input.contentType,
        ChecksumSHA256:
          checksumBase64,
      }),
      {
        expiresIn:
          UPLOAD_URL_TTL_SECONDS,
      },
    );

  return {
    uploadUrl,
    expiresInSeconds:
      UPLOAD_URL_TTL_SECONDS,
    headers: {
      'content-type':
        input.contentType,
      'x-amz-checksum-sha256':
        checksumBase64,
    },
  };
}

function bytesStartWith(
  bytes: Uint8Array,
  signature: number[],
) {
  return (
    bytes.length >=
      signature.length &&
    signature.every(
      (
        value,
        index,
      ) =>
        bytes[index] ===
        value,
    )
  );
}

function zipSignature(
  bytes: Uint8Array,
) {
  return (
    bytesStartWith(
      bytes,
      [
        0x50,
        0x4b,
        0x03,
        0x04,
      ],
    ) ||
    bytesStartWith(
      bytes,
      [
        0x50,
        0x4b,
        0x05,
        0x06,
      ],
    ) ||
    bytesStartWith(
      bytes,
      [
        0x50,
        0x4b,
        0x07,
        0x08,
      ],
    )
  );
}

function oleSignature(
  bytes: Uint8Array,
) {
  return bytesStartWith(
    bytes,
    [
      0xd0,
      0xcf,
      0x11,
      0xe0,
      0xa1,
      0xb1,
      0x1a,
      0xe1,
    ],
  );
}

export function trainingResourceSignatureMatches(
  contentType:
    TrainingResourceContentType,
  bytes: Uint8Array,
) {
  if (
    contentType ===
    'application/pdf'
  ) {
    return bytesStartWith(
      bytes,
      [
        0x25,
        0x50,
        0x44,
        0x46,
        0x2d,
      ],
    );
  }

  if (
    contentType ===
    'image/jpeg'
  ) {
    return bytesStartWith(
      bytes,
      [
        0xff,
        0xd8,
        0xff,
      ],
    );
  }

  if (
    contentType ===
    'image/png'
  ) {
    return bytesStartWith(
      bytes,
      [
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ],
    );
  }

  if (
    contentType ===
    'image/webp'
  ) {
    if (
      bytes.length < 12
    ) {
      return false;
    }

    const ascii =
      (
        start: number,
        end: number,
      ) =>
        String.fromCharCode(
          ...Array.from(
            bytes.slice(
              start,
              end,
            ),
          ),
        );

    return (
      ascii(
        0,
        4,
      ) ===
        'RIFF' &&
      ascii(
        8,
        12,
      ) ===
        'WEBP'
    );
  }

  if (
    contentType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    contentType ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    contentType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return zipSignature(
      bytes,
    );
  }

  if (
    contentType ===
      'application/msword' ||
    contentType ===
      'application/vnd.ms-powerpoint' ||
    contentType ===
      'application/vnd.ms-excel'
  ) {
    return oleSignature(
      bytes,
    );
  }

  return false;
}

export async function verifyTrainingResourceUpload(
  input: {
    objectKey: string;
    contentType:
      TrainingResourceContentType;
    sizeBytes: number;
    checksumSha256: string;
  },
) {
  const storage =
    storageConfig();

  const head =
    await storage.client.send(
      new HeadObjectCommand({
        Bucket:
          storage.bucket,
        Key:
          input.objectKey,
        ChecksumMode:
          'ENABLED',
      }),
    );

  if (
    Number(
      head.ContentLength ??
      -1,
    ) !==
    input.sizeBytes
  ) {
    throw new TrainingResourceStorageError(
      'training_resource_size_mismatch',
      409,
    );
  }

  if (
    clean(
      head.ContentType,
      180,
    )
      .toLowerCase() !==
    input.contentType
  ) {
    throw new TrainingResourceStorageError(
      'training_resource_type_mismatch',
      409,
    );
  }

  const expectedChecksum =
    Buffer.from(
      input.checksumSha256,
      'hex',
    ).toString(
      'base64',
    );

  const actualChecksum =
    clean(
      head.ChecksumSHA256,
      200,
    );

  if (
    !actualChecksum ||
    actualChecksum !==
      expectedChecksum
  ) {
    throw new TrainingResourceStorageError(
      'training_resource_checksum_mismatch',
      409,
    );
  }

  const response =
    await storage.client.send(
      new GetObjectCommand({
        Bucket:
          storage.bucket,
        Key:
          input.objectKey,
        Range:
          'bytes=0-31',
      }),
    );

  const body =
    response.Body as
      | {
          transformToByteArray?:
            () =>
              Promise<
                Uint8Array
              >;
        }
      | undefined;

  if (
    !body
      ?.transformToByteArray
  ) {
    throw new TrainingResourceStorageError(
      'training_resource_signature_unavailable',
      503,
    );
  }

  const bytes =
    await body
      .transformToByteArray();

  if (
    !trainingResourceSignatureMatches(
      input.contentType,
      bytes,
    )
  ) {
    throw new TrainingResourceStorageError(
      'training_resource_signature_invalid',
      415,
    );
  }
}

export async function presignTrainingResourceAccess(
  input: {
    objectKey: string;
    fileName: string;
    contentType:
      TrainingResourceContentType;
    disposition:
      TrainingResourceDisposition;
  },
) {
  const storage =
    storageConfig();

  const safeName =
    safeTrainingResourceFileName(
      input.fileName,
    );

  const encodedName =
    encodeURIComponent(
      safeName,
    );

  const accessUrl =
    await getSignedUrl(
      storage.client,
      new GetObjectCommand({
        Bucket:
          storage.bucket,
        Key:
          input.objectKey,
        ResponseContentDisposition:
          `${input.disposition}; filename="training-resource"; filename*=UTF-8''${encodedName}`,
        ResponseContentType:
          input.contentType,
        ResponseCacheControl:
          'private, no-store, max-age=0',
      }),
      {
        expiresIn:
          ACCESS_URL_TTL_SECONDS,
      },
    );

  return {
    accessUrl,
    disposition:
      input.disposition,
    expiresInSeconds:
      ACCESS_URL_TTL_SECONDS,
  };
}

export async function deleteTrainingResourceObject(
  objectKey: string,
) {
  const storage =
    storageConfig();

  await storage.client.send(
    new DeleteObjectCommand({
      Bucket:
        storage.bucket,
      Key:
        clean(
          objectKey,
          1000,
        ),
    }),
  );
}

export async function bestEffortDeleteTrainingResourceObject(
  objectKey: unknown,
) {
  const key =
    clean(
      objectKey,
      1000,
    );

  if (!key) {
    return;
  }

  try {
    await deleteTrainingResourceObject(
      key,
    );
  } catch (error) {
    console.error(
      '[training-resource-storage] cleanup failed',
      {
        objectKey:
          key,
        error,
      },
    );
  }
}

export function trainingResourceStorageResponse(
  error: unknown,
) {
  if (
    error instanceof
    TrainingResourceStorageError
  ) {
    return {
      status:
        error.status,
      body: {
        ok: false,
        error:
          error.code,
        ...(
          error.code ===
            'training_resource_storage_not_configured'
            ? {
                message:
                  'Training resource storage is not configured for this environment.',
                configuration:
                  trainingResourceStorageStatus(),
              }
            : {}
        ),
      },
    };
  }

  return null;
}
