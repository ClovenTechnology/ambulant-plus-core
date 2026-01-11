// apps/api-gateway/app/api/clinicians/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toInt(n: any, fallback: number) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : fallback;
}

function parseDateMaybe(v: any): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

function cleanStr(v: any): string | null {
  const s = (v ?? '').toString().trim();
  return s.length ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;

    // Core signup inputs
    const displayName = cleanStr(body.displayName ?? body.name);
    const specialty = cleanStr(body.specialty);
    const email = cleanStr(body.email);
    const phone = cleanStr(body.phone);

    // Pricing
    const currency = cleanStr(body.currency) ?? 'ZAR';
    const feeZAR = toInt(body.feeZAR ?? body.fee ?? 650, 650);
    const feeCents = Math.max(0, feeZAR) * 100;

    if (!displayName) {
      return NextResponse.json({ ok: false, error: 'displayName required' }, { status: 400 });
    }
    if (!specialty) {
      return NextResponse.json({ ok: false, error: 'specialty required' }, { status: 400 });
    }

    // Identity / practice / regulator inputs (optional but strongly recommended)
    const practiceName = cleanStr(body.practiceName);
    const practiceNumber = cleanStr(body.practiceNumber);
    const regulatorBody = cleanStr(body.regulatorBody); // HPCSA / SANC / SAPC etc
    const regulatorRegistration = cleanStr(body.regulatorRegistration);

    const idNumber = cleanStr(body.idNumber);
    const idIssuingCountry = cleanStr(body.idIssuingCountry);
    const idExpiry = parseDateMaybe(body.idExpiry);

    const boardCertificateUrl = cleanStr(body.boardCertificateUrl);
    const boardCertificateNumber = cleanStr(body.boardCertificateNumber);
    const boardCertificateIssuer = cleanStr(body.boardCertificateIssuer);
    const boardCertificateExpires = parseDateMaybe(body.boardCertificateExpires);

    const qualification = cleanStr(body.qualification);
    const qualificationYear =
      body.qualificationYear != null ? toInt(body.qualificationYear, 0) : null;
    const qualificationInstitution = cleanStr(body.qualificationInstitution);

    const piInsuranceProvider = cleanStr(body.piInsuranceProvider);
    const piInsurancePolicyName = cleanStr(body.piInsurancePolicyName);
    const piInsuranceCoverType = cleanStr(body.piInsuranceCoverType);
    const piInsuranceExpiry = parseDateMaybe(body.piInsuranceExpiry);
    const piInsuranceNumber = cleanStr(body.piInsuranceNumber);

    // If you have an auth provider later, pass their stable userId (Auth0 sub etc).
    const userId = cleanStr(body.userId) ?? `clinician-${randomUUID()}`;

    // Prevent accidental duplicates on userId
    const existing = await prisma.clinicianProfile.findUnique({ where: { userId } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'clinician already exists for this userId', clinicianId: existing.id, userId },
        { status: 409 },
      );
    }

    // Seed serviceFees in rawProfileJson so your fees/extended route has something sane.
    const baseService = {
      id: 'base_consult',
      kind: 'base_consult',
      name: 'Base consultation',
      description: null,
      amountCents: feeCents,
      currency,
      minMinutes: 30,
      maxMinutes: 45,
      active: true,
      includesMedicalStaff: false,
    };

    const followupService = {
      id: 'followup',
      kind: 'followup',
      name: 'Follow-up consultation',
      description: null,
      amountCents: Math.max(0, Math.round(feeCents * 0.75)),
      currency,
      minMinutes: 15,
      maxMinutes: 20,
      active: true,
      includesMedicalStaff: false,
    };

    const submittedAt = new Date().toISOString();

    const rawProfileJson = {
      serviceFees: [baseService, followupService],
      adminStaffComp: [],

      // No schema fields exist yet for these; keep in meta until you add ClinicianVerification.
      compliance: {
        regulator: { status: regulatorBody && regulatorRegistration ? 'submitted' : 'missing', submittedAt },
        kyc: { status: idNumber ? 'submitted' : 'missing', submittedAt },
        dueDiligence: { status: 'pending', submittedAt },
        insurance: { status: piInsuranceNumber ? 'submitted' : 'missing', submittedAt },
        training: { status: 'pending', submittedAt },
      },
    };

    const created = await prisma.clinicianProfile.create({
      data: {
        userId,
        displayName,
        specialty,
        phone,
        email,

        practiceName,
        practiceNumber,
        regulatorBody,
        regulatorRegistration,

        idNumber,
        idIssuingCountry,
        idExpiry,

        boardCertificateUrl,
        boardCertificateNumber,
        boardCertificateIssuer,
        boardCertificateExpires,

        qualification,
        qualificationYear: qualificationYear && qualificationYear > 0 ? qualificationYear : null,
        qualificationInstitution,

        piInsuranceProvider,
        piInsurancePolicyName,
        piInsuranceCoverType,
        piInsuranceExpiry,
        piInsuranceNumber,

        feeCents,
        currency,

        // lifecycle controls
        status: 'pending',
        trainingCompleted: false,
        disabled: false,
        archived: false,

        meta: {
          rawProfileJson,
          applicant: { submittedAt },
        },
      },
      select: { id: true, userId: true, displayName: true, specialty: true, status: true, createdAt: true },
    });

    // Ensure onboarding row exists (for your onboarding-board + dispatch/training flows)
    await prisma.clinicianOnboarding.upsert({
      where: { clinicianId: created.id },
      update: {},
      create: {
        clinicianId: created.id,
        status: 'pending',
        depositPaid: false,
      },
    });

    // Backward-compatible response + richer fields
    return NextResponse.json({
      ok: true,
      clinicianId: created.id,
      userId: created.userId,
      name: created.displayName, // backward compat
      specialty: created.specialty, // backward compat
      status: created.status,
      createdAt: created.createdAt,
    });
  } catch (e: any) {
    console.error('clinicians/signup error', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'signup_failed' },
      { status: 400 },
    );
  }
}
