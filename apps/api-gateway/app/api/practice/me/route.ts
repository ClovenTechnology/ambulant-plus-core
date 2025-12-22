// apps/api-gateway/app/api/practice/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const uid = req.headers.get('x-uid');
    if (!uid) {
      return jsonError('Missing x-uid header', 401);
    }

    // Find the member record for this user
    const member = await prisma.practiceMember.findFirst({
      where: { userId: uid },
      include: {
        practice: {
          include: {
            locations: true,
            members: true,
          },
        },
      },
    });

    if (!member || !member.practice) {
      return jsonError('No practice found for this user', 404);
    }

    const practice = member.practice;
    const members = practice.members;

    // Derive accepted schemes (string[]) from Practice.acceptedSchemes (String[])
    const acceptedSchemes = practice.acceptedSchemes ?? [];

    // Find owner name (first member with role 'owner'), fallback to this member
    const owner = members.find((m) => m.role === 'owner') ?? member;
    const ownerName = owner.fullName ?? owner.email ?? null;

    // Build response – keep it simple, normalizer on the frontend will reshape it
    const payload = {
      id: practice.id,
      name: practice.name,
      practiceNumber: practice.practiceNumber,
      status: practice.status,
      createdAt: practice.createdAt.toISOString(),
      ownerName,
      acceptsMedicalAid: practice.acceptsMedicalAid,
      acceptedSchemes,
      smartIdDispatch: practice.smartIdDispatch,
      locations: practice.locations.map((l) => ({
        id: l.id,
        label: l.label,
        addressLine1: l.addressLine1,
        addressLine2: l.addressLine2,
        city: l.city,
        province: l.province,
        country: l.country,
        isPrimary: l.isPrimary,
      })),
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        fullName: m.fullName,
        email: m.email,
        role: m.role,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
    };

    return NextResponse.json({ ok: true, practice: payload, members: payload.members });
  } catch (err: any) {
    console.error('[practice/me] error', err);
    return jsonError(err?.message || 'Failed to load practice', 500);
  }
}
