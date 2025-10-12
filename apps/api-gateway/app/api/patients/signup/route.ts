import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.name as string;
    const email = body.email as string;

    const userId = `patient-${Math.floor(Math.random() * 10000)}`;

    await prisma.patientProfile.create({
      data: {
        userId,
        name,
        email,
      },
    });

    return NextResponse.json({ userId, name, email });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'signup_failed' }, { status: 400 });
  }
}
