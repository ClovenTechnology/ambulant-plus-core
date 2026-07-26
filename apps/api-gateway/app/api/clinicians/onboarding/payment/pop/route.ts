import crypto from 'node:crypto';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  calculateOnboardingPaymentState,
  getClinicianOnboardingSettings,
  type ClinicianOnboardingPathwayKey,
} from '@/src/clinicians/onboarding/settings';
import {
  resolveAuthenticatedClinician,
} from '@/src/clinicians/onboarding/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 3 * 1024 * 1024;

const CONFIRMED_PAYMENT_STATUSES = [
  'captured',
  'confirmed',
  'redeemed',
  'paid',
];

function cleanStr(
  value: unknown,
  max = 500,
): string | null {
  const text = String(value ?? '').trim();

  if (!text) return null;

  return text.length > max
    ? text.slice(0, max)
    : text;
}

function jsonSafe(value: unknown) {
  return JSON.parse(
    JSON.stringify(value ?? null),
  );
}

function readMeta(
  value: unknown,
): Record<string, any> {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
    ? value as Record<string, any>
    : {};
}

function pathwayKeyFromValue(
  value: unknown,
): ClinicianOnboardingPathwayKey | null {
  const key = String(value || '')
    .trim()
    .toUpperCase();

  if (
    key === 'QUALIFYING_DEPOSIT' ||
    key === 'FULL_PAYMENT'
  ) {
    return key;
  }

  return null;
}

function normaliseTrainingMode(
  value: unknown,
): 'virtual' | 'in_person' | null {
  const mode = String(value || '')
    .trim()
    .toLowerCase();

  return (
    mode === 'virtual' ||
    mode === 'in_person'
  )
    ? mode
    : null;
}

function normaliseMime(value: unknown) {
  const mime = String(value || '')
    .trim()
    .toLowerCase();

  return mime === 'image/jpg'
    ? 'image/jpeg'
    : mime;
}

function detectedFileType(bytes: Buffer) {
  if (
    bytes.length >= 5 &&
    bytes.subarray(0, 5).toString('ascii') ===
      '%PDF-'
  ) {
    return {
      mimeType: 'application/pdf',
      extension: 'pdf',
    };
  }

  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(
        Buffer.from([
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
        ]),
      )
  ) {
    return {
      mimeType: 'image/png',
      extension: 'png',
    };
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return {
      mimeType: 'image/jpeg',
      extension: 'jpg',
    };
  }

  return null;
}

function safeFileName(
  value: unknown,
  extension: string,
) {
  const source =
    cleanStr(value, 200) ||
    `proof-of-payment.${extension}`;

  const withoutExtension =
    source.replace(/\.[^.]+$/, '');

  const base =
    withoutExtension
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 160) ||
    'proof-of-payment';

  return `${base}.${extension}`;
}

function storageConfig() {
  const bucket = String(
    process.env.CLINICIAN_PAYMENT_POP_S3_BUCKET ||
    process.env.S3_EVIDENCE_BUCKET ||
    process.env.S3_BUCKET ||
    process.env.TRAINING_RECORDINGS_S3_BUCKET ||
    '',
  ).trim();

  const region = String(
    process.env.CLINICIAN_PAYMENT_POP_S3_REGION ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    process.env.TRAINING_RECORDINGS_S3_REGION ||
    '',
  ).trim();

  if (!bucket || !region) {
    return null;
  }

  return {
    bucket,
    region,
    client: new S3Client({ region }),
  };
}

async function confirmedAmountCents(
  clinicianId: string,
) {
  const rows =
    await prisma
      .clinicianOnboardingPayment
      .findMany({
        where: {
          clinicianId,
          status: {
            in:
              CONFIRMED_PAYMENT_STATUSES,
          },
        },
        select: {
          amountCents: true,
          provider: true,
        },
      });

  return rows.reduce(
    (sum, row) => {
      const provider = String(
        row.provider || '',
      )
        .trim()
        .toLowerCase();

      if (
        provider === 'waiver' ||
        provider === 'deferred'
      ) {
        return sum;
      }

      const amount = Number(
        row.amountCents || 0,
      );

      return (
        sum +
        (
          Number.isFinite(amount)
            ? Math.max(
                0,
                Math.round(amount),
              )
            : 0
        )
      );
    },
    0,
  );
}

export async function POST(
  request: NextRequest,
) {
  let uploaded:
    | {
        client: S3Client;
        bucket: string;
        key: string;
      }
    | null = null;

  try {
    const body =
      await request
        .json()
        .catch(() => ({} as any));

    const clinicianId =
      cleanStr(
        body.clinicianId,
        120,
      );

    const slotId =
      cleanStr(
        body.slotId ||
        body.trainingSlotId,
        120,
      );

    const pathwayKey =
      pathwayKeyFromValue(
        body.pathwayKey ||
        body.paymentPathway ||
        body.onboardingPathway,
      );

    const trainingMode =
      normaliseTrainingMode(
        body.trainingMode ||
        body.mode,
      );

    if (!clinicianId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'clinicianId_required',
        },
        { status: 400 },
      );
    }

    if (!slotId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'slotId_required',
        },
        { status: 400 },
      );
    }

    if (!pathwayKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'manual_payment_pathway_required',
        },
        { status: 400 },
      );
    }

    const identity =
      await resolveAuthenticatedClinician(
        request,
        clinicianId,
      );

    if (!identity.ok) {
      return identity.response;
    }

    const settings =
      await getClinicianOnboardingSettings();

    if (!settings.manualPaymentEnabled) {
      return NextResponse.json(
        {
          ok: false,
          error: 'manual_payment_disabled',
        },
        { status: 409 },
      );
    }

    if (settings.trainingFeeCents <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'training_fee_not_configured',
        },
        { status: 409 },
      );
    }

    const configuredPathway =
      settings.commercialPathways.find(
        (pathway) =>
          pathway.key === pathwayKey,
      );

    if (
      !configuredPathway ||
      configuredPathway.enabled !== true
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'onboarding_pathway_disabled',
          pathwayKey,
        },
        { status: 409 },
      );
    }

    const slot =
      await prisma
        .clinicianTrainingSlot
        .findUnique({
          where: { id: slotId },
        });

    if (!slot) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'training_slot_not_found',
        },
        { status: 404 },
      );
    }

    if (
      String(slot.status || '')
        .trim()
        .toLowerCase() !==
      'published'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'training_slot_not_published',
        },
        { status: 409 },
      );
    }

    const now = Date.now();

    if (
      slot.bookingOpensAt &&
      slot.bookingOpensAt.getTime() > now
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'training_slot_booking_not_open',
        },
        { status: 409 },
      );
    }

    if (
      slot.bookingClosesAt &&
      slot.bookingClosesAt.getTime() <= now
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'training_slot_booking_closed',
        },
        { status: 409 },
      );
    }

    const allowedModes =
      Array.isArray(slot.allowedModes)
        ? slot.allowedModes
            .map((value: unknown) =>
              normaliseTrainingMode(value),
            )
            .filter(Boolean)
        : [];

    const selectedMode =
      trainingMode ||
      normaliseTrainingMode(slot.mode) ||
      'virtual';

    if (
      allowedModes.length > 0 &&
      !allowedModes.includes(
        selectedMode,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'training_mode_not_available',
        },
        { status: 409 },
      );
    }

    const onboarding =
      await prisma
        .clinicianOnboarding
        .upsert({
          where: { clinicianId },
          update: {},
          create: {
            clinicianId,
            status: 'pending',
            depositPaid: false,
          },
        });

    const alreadyOnThisSlot =
      String(
        onboarding.trainingSlotId ||
        '',
      ) === slotId;

    const seatsLeft = Math.max(
      0,
      Number(slot.capacity || 0) -
      Number(slot.usedCount || 0),
    );

    if (
      !alreadyOnThisSlot &&
      seatsLeft <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'training_slot_full',
        },
        { status: 409 },
      );
    }

    const paidCents =
      await confirmedAmountCents(
        clinicianId,
      );

    const paymentState =
      calculateOnboardingPaymentState({
        trainingFeeCents:
          settings.trainingFeeCents,
        minimumInitialPaymentCents:
          settings.minimumInitialPaymentCents,
        amountPaidCents:
          paidCents,
      });

    const amountCents =
      pathwayKey ===
      'QUALIFYING_DEPOSIT'
        ? Math.max(
            0,
            paymentState
              .minimumInitialPaymentCents -
            paymentState
              .amountPaidCents,
          )
        : paymentState
            .outstandingCents;

    if (amountCents <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'manual_payment_not_required',
          pathwayKey,
          paymentState,
        },
        { status: 409 },
      );
    }

    const rawBase64 =
      String(body.base64 || '')
        .trim();

    const maxBase64Length =
      Math.ceil(MAX_BYTES * 4 / 3) +
      16;

    if (!rawBase64) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'proof_of_payment_file_required',
        },
        { status: 400 },
      );
    }

    if (
      rawBase64.length >
      maxBase64Length
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'proof_of_payment_file_too_large',
          maxBytes: MAX_BYTES,
        },
        { status: 413 },
      );
    }

    if (
      !/^[A-Za-z0-9+/]+={0,2}$/
        .test(rawBase64)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'invalid_proof_of_payment_encoding',
        },
        { status: 400 },
      );
    }

    const bytes =
      Buffer.from(
        rawBase64,
        'base64',
      );

    if (
      bytes.length <= 0 ||
      bytes.length > MAX_BYTES
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            bytes.length > MAX_BYTES
              ? 'proof_of_payment_file_too_large'
              : 'proof_of_payment_file_empty',
          maxBytes: MAX_BYTES,
        },
        {
          status:
            bytes.length > MAX_BYTES
              ? 413
              : 400,
        },
      );
    }

    const detected =
      detectedFileType(bytes);

    if (!detected) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'unsupported_proof_of_payment_file_type',
        },
        { status: 415 },
      );
    }

    const claimedMime =
      normaliseMime(body.mimeType);

    if (
      claimedMime &&
      claimedMime !==
        detected.mimeType
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'proof_of_payment_file_type_mismatch',
        },
        { status: 415 },
      );
    }

    const storage = storageConfig();

    if (!storage) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'proof_of_payment_storage_not_configured',
        },
        { status: 503 },
      );
    }

    const filename =
      safeFileName(
        body.filename,
        detected.extension,
      );

    const objectId =
      crypto.randomUUID();

    const safeClinicianId =
      clinicianId.replace(
        /[^A-Za-z0-9_-]/g,
        '_',
      );

    const key = [
      'clinician-onboarding',
      'payment-pop',
      safeClinicianId,
      `${objectId}.${detected.extension}`,
    ].join('/');

    await storage.client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        Body: bytes,
        ContentType:
          detected.mimeType,
        ContentDisposition:
          `attachment; filename="${filename}"`,
        Metadata: {
          clinicianId:
            clinicianId.slice(0, 200),
          trainingSlotId:
            slotId.slice(0, 200),
          pathwayKey,
          originalName:
            filename.slice(0, 200),
          sourceApp:
            'clinician-app',
        },
      }),
    );

    uploaded = {
      client: storage.client,
      bucket: storage.bucket,
      key,
    };

    const proofLocator =
      `s3://${storage.bucket}/${key}`;

    const existingPending =
      await prisma
        .clinicianOnboardingPayment
        .findFirst({
          where: {
            clinicianId,
            onboardingId:
              onboarding.id,
            provider: 'eft',
            status: 'pending',
            proofOfPaymentUrl: {
              not: null,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

    const uploadedAt =
      new Date();

    const meta = jsonSafe({
      ...readMeta(
        existingPending?.meta,
      ),
      source:
        'clinician_payment_pop_upload',
      pathwayKey,
      slotId,
      trainingMode:
        selectedMode,
      proofOfPayment: {
        objectKey: key,
        bucket:
          storage.bucket,
        filename,
        mimeType:
          detected.mimeType,
        sizeBytes:
          bytes.length,
        uploadedAt:
          uploadedAt.toISOString(),
        status:
          'pending_admin_review',
      },
      paymentStateAtUpload:
        paymentState,
    });

    const payment =
      existingPending
        ? await prisma
            .clinicianOnboardingPayment
            .update({
              where: {
                id:
                  existingPending.id,
              },
              data: {
                amountCents,
                currency:
                  settings.currency,
                proofOfPaymentUrl:
                  proofLocator,
                meta,
              },
            })
        : await prisma
            .clinicianOnboardingPayment
            .create({
              data: {
                clinicianId,
                onboardingId:
                  onboarding.id,
                amountCents,
                currency:
                  settings.currency,
                provider: 'eft',
                status: 'pending',
                providerReference:
                  `amb_pop_${objectId}`,
                proofOfPaymentUrl:
                  proofLocator,
                meta,
              },
            });

    await prisma
      .clinicianOnboarding
      .update({
        where: {
          id: onboarding.id,
        },
        data: {
          trainingSlotId:
            slotId,
          trainingMode:
            selectedMode,
          paymentPlan:
            pathwayKey,
        },
      });

    uploaded = null;

    return NextResponse.json(
      {
        ok: true,
        message:
          'Proof of Payment uploaded for Admin review.',
        reviewStatus:
          'pending',
        pathwayKey,
        payment: {
          id: payment.id,
          status:
            payment.status,
          provider:
            payment.provider,
          amountCents:
            payment.amountCents,
          currency:
            payment.currency,
          uploadedAt:
            uploadedAt.toISOString(),
        },
      },
      {
        status:
          existingPending
            ? 200
            : 201,
      },
    );
  }
  catch (error: any) {
    if (uploaded) {
      try {
        await uploaded.client.send(
          new DeleteObjectCommand({
            Bucket:
              uploaded.bucket,
            Key:
              uploaded.key,
          }),
        );
      }
      catch {
        // Preserve the original failure.
      }
    }

    console.error(
      '[clinician-payment-pop-upload] error',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'proof_of_payment_upload_failed',
        message:
          'We could not complete the Proof of Payment upload. Please try again or contact Ambulant+ support.',
      },
      {
        status: 500,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  }
}
