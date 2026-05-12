// apps/api-gateway/app/api/patients/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

function cleanEmail(value: unknown): string | null {
  const s = String(value ?? '').trim().toLowerCase();
  return s.includes('@') ? s : null;
}

function cleanStr(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = cleanEmail(body.email ?? body.contactEmail);
    const name = cleanStr(body.name);
    const phone = cleanStr(body.phone);
    const userId = cleanStr(body.userId) || email;

    if (!email || !userId) {
      return NextResponse.json(
        { ok: false, error: 'email_required' },
        { status: 400 },
      );
    }

    const patient = await prisma.patientProfile.upsert({
      where: { userId },
      update: {
        name: name ?? undefined,
        contactEmail: email,
        phone: phone ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        userId,
        name: name ?? undefined,
        contactEmail: email,
        phone: phone ?? undefined,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        patient,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('patients signup error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'patient_signup_failed',
      },
      { status: 500 },
    );
  }
}