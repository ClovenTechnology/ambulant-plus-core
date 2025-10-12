import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.name as string;
    const specialty = body.specialty as string;
    const feeZAR = Number(body.feeZAR ?? 650);

    const userId = `doctor-${Math.floor(Math.random() * 10000)}`;

    await prisma.clinicianProfile.create({
      data: {
        userId,
        feeCents: feeZAR * 100,
        currency: 'ZAR',
      },
    });

    return NextResponse.json({ userId, name, specialty });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'signup_failed' }, { status: 400 });
  }
}
