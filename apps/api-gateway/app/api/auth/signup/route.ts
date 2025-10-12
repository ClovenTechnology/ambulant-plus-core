// apps/api-gateway/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../src/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, phone } = body ?? {};

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    // Use email as userId for dev stub
    const userId = email.trim().toLowerCase();

    // Upsert PatientProfile
    const profile = await prisma.patientProfile.upsert({
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

    // In a real system you'd create a proper session/JWT with secrets.
    const token = `dev-token:${userId}:${Date.now()}`;

    return NextResponse.json({ ok: true, token, profile });
  } catch (err: any) {
    console.error('signup error', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
