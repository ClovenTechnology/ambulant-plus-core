// apps/api-gateway/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../src/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body ?? {};

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    const userId = email.trim().toLowerCase();
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });

    if (!profile) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Dev token
    const token = `dev-token:${userId}:${Date.now()}`;

    return NextResponse.json({ ok: true, token, profile });
  } catch (err: any) {
    console.error('login error', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
