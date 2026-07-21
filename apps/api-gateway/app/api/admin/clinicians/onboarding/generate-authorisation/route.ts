// apps/api-gateway/app/api/admin/clinicians/onboarding/generate-authorisation/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(value: unknown, max = 500): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function objectMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function authCodeSalt() {
  const salt = String(
    process.env.CLINICIAN_PAYMENT_AUTH_CODE_SALT ||
      process.env.NEXTAUTH_SECRET ||
      '',
  ).trim();

  if (!salt && isProductionRuntime()) {
    throw new Error('clinician_payment_auth_code_salt_not_configured');
  }

  return salt || 'ambulant-local-dev-salt';
}

function hashCode(code: string) {
  return crypto
    .createHash('sha256')
    .update(`${authCodeSalt()}:${code.trim().toUpperCase()}`)
    .digest('hex');
}

function makeCode() {
  const left = crypto.randomBytes(3).toString('hex').toUpperCase();
  const right = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `AMB-${left}-${right}`;
}

function expiryDate(days: number) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

function requestIp(req: NextRequest) {
  return cleanStr(
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip'),
    120,
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminRequest(req);
    if (admin.ok === false) return admin.response;

    const body = (await req.json().catch(() => ({}))) as any;

    const paymentId = cleanStr(body.paymentId, 120);
    const clinicianId = cleanStr(body.clinicianId, 120);
    const paymentReference = cleanStr(body.paymentReference, 180);
    const replaceExisting = body.replaceExisting === true;
    const replacementReason = cleanStr(
      body.replacementReason || body.regenerationReason,
      1000,
    );

    const expiresInDays = Math.max(
      1,
      Math.min(90, Math.round(Number(body.expiresInDays || 30))),
    );

    if (!paymentId && !clinicianId && !paymentReference) {
      return json(
        {
          ok: false,
          error: 'payment_or_clinician_selector_required',
        },
        400,
      );
    }

    const payment = paymentId
      ? await prisma.clinicianOnboardingPayment.findUnique({
          where: { id: paymentId },
        })
      : await prisma.clinicianOnboardingPayment.findFirst({
          where: {
            clinicianId: clinicianId || undefined,
            paymentReference: paymentReference || undefined,
            status: 'confirmed',
            provider: {
              in: ['eft', 'manual', 'waiver', 'deferred'],
            },
          },
          orderBy: {
            confirmedAt: 'desc',
          },
        });

    if (!payment) {
      return json(
        {
          ok: false,
          error: 'confirmed_payment_not_found',
        },
        404,
      );
    }

    if (
      clinicianId &&
      String(payment.clinicianId) !== clinicianId
    ) {
      return json(
        {
          ok: false,
          error: 'payment_clinician_mismatch',
        },
        409,
      );
    }

    if (
      !['eft', 'manual', 'waiver', 'deferred'].includes(
        String(payment.provider),
      )
    ) {
      return json(
        {
          ok: false,
          error:
            'authorisation_only_for_manual_eft_or_approved_waiver',
        },
        409,
      );
    }

    if (payment.status !== 'confirmed') {
      return json(
        {
          ok: false,
          error: 'payment_not_confirmed',
        },
        409,
      );
    }

    if (payment.authorisationUsedAt) {
      return json(
        {
          ok: false,
          error: 'authorisation_already_used',
        },
        409,
      );
    }

    const activeExistingCode =
      Boolean(payment.authorisationCodeHash) &&
      Boolean(payment.authorisationExpiresAt) &&
      Number(payment.authorisationExpiresAt?.getTime()) > Date.now();

    if (activeExistingCode && !replaceExisting) {
      return json(
        {
          ok: false,
          error: 'active_authorisation_already_exists',
          message:
            'A valid authorisation code already exists. Use the replacement action and provide a reason if it must be invalidated.',
          existing: {
            hint: payment.authorisationCodeHint,
            expiresAt:
              payment.authorisationExpiresAt?.toISOString() || null,
          },
        },
        409,
      );
    }

    if (
      activeExistingCode &&
      replaceExisting &&
      (!replacementReason || replacementReason.length < 8)
    ) {
      return json(
        {
          ok: false,
          error: 'authorisation_replacement_reason_required',
          message:
            'Provide a meaningful reason before replacing an active authorisation code.',
        },
        400,
      );
    }

    let code: string | null = null;
    let codeHash: string | null = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = makeCode();
      const candidateHash = hashCode(candidate);

      const existing =
        await prisma.clinicianOnboardingPayment.findUnique({
          where: {
            authorisationCodeHash: candidateHash,
          },
          select: {
            id: true,
          },
        });

      if (!existing) {
        code = candidate;
        codeHash = candidateHash;
        break;
      }
    }

    if (!code || !codeHash) {
      throw new Error('authorisation_code_generation_exhausted');
    }

    const adminUid =
      cleanStr(
        (admin as any)?.uid ||
          (admin as any)?.userId ||
          body.generatedByUserId,
        120,
      ) || 'admin';

    const expiresAt = expiryDate(expiresInDays);
    const hadPreviousCode = Boolean(payment.authorisationCodeHash);
    const issuedAt = new Date();
    const previousMeta = objectMeta(payment.meta);

    const updated = await prisma.$transaction(async (tx) => {
      const saved =
        await tx.clinicianOnboardingPayment.update({
          where: {
            id: payment.id,
          },
          data: {
            authorisationCodeHash: codeHash,
            authorisationCodeHint: code.slice(-4),
            authorisationExpiresAt: expiresAt,
            confirmedByUserId:
              payment.confirmedByUserId || adminUid,
            meta: jsonSafe({
              ...previousMeta,
              authorisation: {
                issuedAt: issuedAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
                issuedByUserId: adminUid,
                replacedPreviousCode: hadPreviousCode,
                replacementReason:
                  replacementReason || null,
              },
            }),
          },
        });

      await tx.auditLog.create({
        data: {
          actorUserId: adminUid,
          actorType: 'ADMIN',
          actorRefId: adminUid,
          app: 'admin-dashboard',
          action: hadPreviousCode
            ? 'CLINICIAN_PAYMENT_AUTHORISATION_REISSUED'
            : 'CLINICIAN_PAYMENT_AUTHORISATION_ISSUED',
          entityType: 'ClinicianOnboardingPayment',
          entityId: payment.id,
          description: hadPreviousCode
            ? 'Admin replaced a clinician onboarding payment authorisation code.'
            : 'Admin issued a clinician onboarding payment authorisation code.',
          ip: requestIp(req),
          userAgent: cleanStr(
            req.headers.get('user-agent'),
            1000,
          ),
          meta: jsonSafe({
            clinicianId: payment.clinicianId,
            onboardingId: payment.onboardingId,
            paymentId: payment.id,
            provider: payment.provider,
            authorisationCodeHint: code.slice(-4),
            expiresAt: expiresAt.toISOString(),
            replacedPreviousCode: hadPreviousCode,
            replacementReason:
              replacementReason || null,
          }),
        },
      });

      return saved;
    });

    return json({
      ok: true,
      payment: {
        id: updated.id,
        clinicianId: updated.clinicianId,
        onboardingId: updated.onboardingId,
        status: updated.status,
        provider: updated.provider,
        paymentReference: updated.paymentReference,
        authorisationCodeHint:
          updated.authorisationCodeHint,
        authorisationExpiresAt:
          updated.authorisationExpiresAt?.toISOString() ||
          null,
      },
      replacedPreviousCode: hadPreviousCode,
      authorisationCode: code,
      warning:
        'This one-time code cannot be retrieved again. Only its secure hash is stored.',
    });
  } catch (error: any) {
    console.error(
      '[admin-generate-clinician-authorisation] error',
      error,
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          'generate_authorisation_failed',
      },
      500,
    );
  }
}
