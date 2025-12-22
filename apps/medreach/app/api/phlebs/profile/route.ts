// apps/medreach/app/api/phlebs/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';

export type PhlebProfile = {
  phlebId: string;
  fullName: string;
  dob: string;
  gender?: string;
  qualification?: string;
  email: string;
  basePhone?: string;
};

const profiles: Record<string, PhlebProfile> = {
  'thabo-m': {
    phlebId: 'thabo-m',
    fullName: 'Thabo Mokoena',
    dob: '1990-03-15',
    gender: 'Male',
    qualification: 'Registered Phlebotomist',
    email: 'thabo.m@example.com',
    basePhone: '+27 82 000 0000',
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phlebId = searchParams.get('phlebId');
  if (!phlebId) {
    return NextResponse.json({ error: 'Missing phlebId' }, { status: 400 });
  }

  if (!profiles[phlebId]) {
    profiles[phlebId] = {
      phlebId,
      fullName: phlebId
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' '),
      dob: '1990-01-01',
      email: `${phlebId}@example.com`,
    };
  }

  return NextResponse.json(profiles[phlebId]);
}
