import {
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  getSignedUrl,
} from '@aws-sdk/s3-request-presigner';
import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  verifyAdminRequest,
} from '../../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 180;

function cleanStr(
  value: unknown,
  max = 1000,
): string | null {
  const text =
    String(value ?? '').trim();

  if (!text) return null;

  return text.length > max
    ? text.slice(0, max)
    : text;
}

function jsonObject(
  value: unknown,
): Record<string, any> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      any
    >;
  }

  return {};
}

function storageConfig() {
  const bucket =
    cleanStr(
      process.env
        .CLINICIAN_PAYMENT_POP_S3_BUCKET ||
        process.env
          .S3_EVIDENCE_BUCKET ||
        process.env.S3_BUCKET ||
        process.env
          .TRAINING_RECORDINGS_S3_BUCKET,
      240,
    );

  const region =
    cleanStr(
      process.env
        .CLINICIAN_PAYMENT_POP_S3_REGION ||
        process.env.AWS_REGION ||
        process.env.AWS_DEFAULT_REGION ||
        process.env
          .TRAINING_RECORDINGS_S3_REGION,
      120,
    );

  if (!bucket || !region) {
    return null;
  }

  return {
    bucket,
    region,
  };
}

function parseS3Locator(
  value: unknown,
) {
  const locator =
    cleanStr(value, 2000);

  if (!locator) return null;

  const match =
    /^s3:\/\/([^/]+)\/(.+)$/i.exec(
      locator,
    );

  if (!match) return null;

  const bucket =
    cleanStr(match[1], 240);

  const key =
    cleanStr(match[2], 1800);

  if (!bucket || !key) {
    return null;
  }

  return {
    bucket,
    key,
  };
}

function safeFilename(
  value: unknown,
) {
  const filename =
    cleanStr(value, 240) ||
    'proof-of-payment';

  return filename
    .replace(/[\r\n"]/g, '')
    .replace(/[\\/]/g, '_');
}

function errorResponse(
  error: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

export async function GET(
  req: NextRequest,
  context: {
    params: {
      paymentId: string;
    };
  },
) {
  try {
    const isAdmin =
      await verifyAdminRequest(req);

    if (isAdmin.ok === false) {
      return isAdmin.response;
    }

    const paymentId =
      cleanStr(
        context.params.paymentId,
        120,
      );

    if (!paymentId) {
      return errorResponse(
        'paymentId_required',
        400,
      );
    }

    const payment =
      await prisma
        .clinicianOnboardingPayment
        .findUnique({
          where: {
            id: paymentId,
          },
          select: {
            id: true,
            provider: true,
            status: true,
            proofOfPaymentUrl: true,
            meta: true,
          },
        });

    if (!payment) {
      return errorResponse(
        'payment_not_found',
        404,
      );
    }

    const provider =
      String(payment.provider || '')
        .trim()
        .toLowerCase();

    if (
      provider !== 'eft' &&
      provider !== 'manual'
    ) {
      return errorResponse(
        'payment_provider_not_reviewable',
        409,
      );
    }

    const locator =
      parseS3Locator(
        payment.proofOfPaymentUrl,
      );

    if (!locator) {
      return errorResponse(
        'proof_of_payment_not_available',
        404,
      );
    }

    const storage =
      storageConfig();

    if (!storage) {
      return errorResponse(
        'proof_of_payment_storage_not_configured',
        503,
      );
    }

    if (
      locator.bucket !==
      storage.bucket
    ) {
      return errorResponse(
        'proof_of_payment_bucket_mismatch',
        409,
      );
    }

    const meta =
      jsonObject(payment.meta);

    const proofMeta =
      jsonObject(
        meta.proofOfPayment,
      );

    const filename =
      safeFilename(
        proofMeta.filename,
      );

    const mimeType =
      cleanStr(
        proofMeta.mimeType,
        120,
      );

    const client =
      new S3Client({
        region: storage.region,
      });

    const command =
      new GetObjectCommand({
        Bucket: locator.bucket,
        Key: locator.key,
        ResponseContentDisposition:
          `inline; filename="${filename}"`,
        ...(mimeType
          ? {
              ResponseContentType:
                mimeType,
            }
          : {}),
      });

    const url =
      await getSignedUrl(
        client,
        command,
        {
          expiresIn:
            SIGNED_URL_TTL_SECONDS,
        },
      );

    return NextResponse.json(
      {
        ok: true,
        paymentId:
          payment.id,
        status:
          payment.status,
        file: {
          filename,
          mimeType,
          sizeBytes:
            Number.isFinite(
              Number(
                proofMeta.sizeBytes,
              ),
            )
              ? Number(
                  proofMeta.sizeBytes,
                )
              : null,
          uploadedAt:
            cleanStr(
              proofMeta.uploadedAt,
              120,
            ),
        },
        url,
        expiresInSeconds:
          SIGNED_URL_TTL_SECONDS,
      },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'private, no-store, max-age=0',
          Pragma: 'no-cache',
        },
      },
    );
  } catch (err: any) {
    console.error(
      '[admin-view-clinician-payment-pop] error',
      err,
    );

    return errorResponse(
      err?.message ||
        'proof_of_payment_view_failed',
      500,
    );
  }
}