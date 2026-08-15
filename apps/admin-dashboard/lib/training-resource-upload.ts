export const TRAINING_RESOURCE_MAX_BYTES =
  25 * 1024 * 1024;

export const TRAINING_RESOURCE_ACCEPT =
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp';

const MIME_BY_EXTENSION:
  Record<
    string,
    string
  > = {
    pdf:
      'application/pdf',
    doc:
      'application/msword',
    docx:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt:
      'application/vnd.ms-powerpoint',
    pptx:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls:
      'application/vnd.ms-excel',
    xlsx:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg:
      'image/jpeg',
    jpeg:
      'image/jpeg',
    png:
      'image/png',
    webp:
      'image/webp',
  };

const ACCEPTED_TYPES =
  new Set(
    Object.values(
      MIME_BY_EXTENSION,
    ),
  );

export type TrainingResourceUploadStage =
  | 'hashing'
  | 'preparing'
  | 'uploading'
  | 'confirming';

export class TrainingResourceUploadError
  extends Error {
  constructor(
    message: string,
  ) {
    super(message);
    this.name =
      'TrainingResourceUploadError';
  }
}

function extension(
  fileName: string,
) {
  const value =
    String(
      fileName ||
      '',
    )
      .trim()
      .toLowerCase();

  const index =
    value.lastIndexOf(
      '.',
    );

  return index >= 0
    ? value.slice(
        index + 1,
      )
    : '';
}

export function trainingResourceContentType(
  file: File,
) {
  const fromExtension =
    MIME_BY_EXTENSION[
      extension(
        file.name,
      )
    ] ||
    '';

  const browserType =
    String(
      file.type ||
      '',
    )
      .trim()
      .toLowerCase();

  if (
    browserType &&
    browserType !==
      'application/octet-stream' &&
    ACCEPTED_TYPES.has(
      browserType,
    )
  ) {
    return browserType;
  }

  return fromExtension;
}

function errorMessage(
  value: unknown,
  fallback: string,
) {
  const code =
    String(
      value ||
      '',
    )
      .trim();

  const messages:
    Record<
      string,
      string
    > = {
      training_resource_storage_not_configured:
        'Training file storage is not configured for this environment.',
      training_resource_type_invalid:
        'Upload a PDF, Word, PowerPoint, Excel, JPEG, PNG or WebP file.',
      training_resource_extension_mismatch:
        'The file extension does not match the detected document type.',
      training_resource_size_invalid:
        'Training files must be 25 MB or smaller.',
      training_resource_checksum_invalid:
        'The file could not be cryptographically verified. Choose it again.',
      training_resource_size_mismatch:
        'The uploaded file size could not be verified. Please retry.',
      training_resource_type_mismatch:
        'The uploaded file type could not be verified. Please retry.',
      training_resource_checksum_mismatch:
        'The uploaded file checksum does not match the selected file.',
      training_resource_signature_invalid:
        'The uploaded file contents do not match the selected document type.',
      training_resource_not_found:
        'Save the resource library before uploading a file to this resource.',
      training_resource_version_not_found:
        'Save the current resource version before uploading its file.',
      training_resource_object_invalid:
        'The uploaded object could not be associated with this resource version.',
    };

  return (
    messages[
      code
    ] ||
    (
      code &&
      !code.includes(
        '_',
      )
        ? code
        : fallback
    )
  );
}

async function sha256Hex(
  file: File,
) {
  const digest =
    await crypto.subtle
      .digest(
        'SHA-256',
        await file
          .arrayBuffer(),
      );

  return Array.from(
    new Uint8Array(
      digest,
    ),
  )
    .map(
      (value) =>
        value
          .toString(
            16,
          )
          .padStart(
            2,
            '0',
          ),
    )
    .join('');
}

export async function uploadTrainingResourceFile(
  input: {
    file: File;
    resourceId: string;
    versionId: string;
    onStage?: (
      stage:
        TrainingResourceUploadStage,
    ) => void;
  },
) {
  const contentType =
    trainingResourceContentType(
      input.file,
    );

  if (
    !contentType ||
    !ACCEPTED_TYPES.has(
      contentType,
    )
  ) {
    throw new TrainingResourceUploadError(
      'Upload a PDF, Word, PowerPoint, Excel, JPEG, PNG or WebP file.',
    );
  }

  if (
    !input.file.size ||
    input.file.size >
      TRAINING_RESOURCE_MAX_BYTES
  ) {
    throw new TrainingResourceUploadError(
      'Training files must be 25 MB or smaller.',
    );
  }

  input.onStage?.(
    'hashing',
  );

  const checksumSha256 =
    await sha256Hex(
      input.file,
    );

  input.onStage?.(
    'preparing',
  );

  const presignResponse =
    await fetch(
      '/api/admin/training/materials',
      {
        method:
          'POST',
        headers: {
          accept:
            'application/json',
          'content-type':
            'application/json',
        },
        body:
          JSON.stringify({
            action:
              'presign_upload',
            resourceId:
              input.resourceId,
            versionId:
              input.versionId,
            fileName:
              input.file.name,
            contentType,
            sizeBytes:
              input.file.size,
            checksumSha256,
          }),
      },
    );

  const presign =
    await presignResponse
      .json()
      .catch(
        () => null,
      );

  if (
    !presignResponse.ok ||
    !presign?.ok ||
    !presign?.uploadUrl ||
    !presign?.objectKey
  ) {
    throw new TrainingResourceUploadError(
      errorMessage(
        presign?.message ||
        presign?.error,
        'Unable to prepare the training file upload.',
      ),
    );
  }

  input.onStage?.(
    'uploading',
  );

  const uploadResponse =
    await fetch(
      presign.uploadUrl,
      {
        method:
          'PUT',
        headers:
          presign.headers ||
          {
            'content-type':
              contentType,
          },
        body:
          input.file,
      },
    );

  if (
    !uploadResponse.ok
  ) {
    throw new TrainingResourceUploadError(
      'The training file could not be uploaded. Please try again.',
    );
  }

  input.onStage?.(
    'confirming',
  );

  const confirmResponse =
    await fetch(
      '/api/admin/training/materials',
      {
        method:
          'POST',
        headers: {
          accept:
            'application/json',
          'content-type':
            'application/json',
        },
        body:
          JSON.stringify({
            action:
              'confirm_upload',
            resourceId:
              input.resourceId,
            versionId:
              input.versionId,
            objectKey:
              presign.objectKey,
            fileName:
              input.file.name,
            contentType,
            sizeBytes:
              input.file.size,
            checksumSha256,
          }),
      },
    );

  const confirmed =
    await confirmResponse
      .json()
      .catch(
        () => null,
      );

  if (
    !confirmResponse.ok ||
    !confirmed?.ok
  ) {
    throw new TrainingResourceUploadError(
      errorMessage(
        confirmed?.message ||
        confirmed?.error,
        'The uploaded training file could not be confirmed.',
      ),
    );
  }

  return confirmed;
}
