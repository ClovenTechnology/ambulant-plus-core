// file: apps/clinician-app/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Simple clinician login endpoint.
 *
 * - Looks up clinicianProfile by userId === email (matches signup fallback).
 * - Does NOT implement real password verification (dev scaffold only).
 * - Enforces `status === 'active'` before issuing token + profile.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ error: 'Invalid request body' }, 400);
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email) return json({ error: 'Email required' }, 400);
    if (!password) return json({ error: 'Password required' }, 400);

    // For this scaffold we assume userId === email for clinicians created via signup.
    const clinician = await prisma.clinicianProfile.findFirst({
      where: { userId: email },
      include: { metadata: true },
    });

    if (!clinician) {
      return json({ error: 'Clinician account not found. Please sign up first.' }, 401);
    }

    if (clinician.status !== 'active') {
      return json(
        {
          error:
            'Your profile is not active yet. An admin must complete training / verification before you can log in.',
          status: clinician.status,
        },
        403,
      );
    }

    let profileJson: any = {};
    if (clinician.metadata?.rawProfileJson) {
      try {
        profileJson = JSON.parse(clinician.metadata.rawProfileJson);
      } catch {
        profileJson = {};
      }
    }

    // Dev-only token (NOT a real JWT)
    const token = `dev-${clinician.id}-${Date.now()}`;

    const profile = {
      id: clinician.id,
      userId: clinician.userId,
      name: clinician.displayName,
      email,
      status: clinician.status,
      specialty: clinician.specialty,
      dob: profileJson.dob ?? null,
      gender: profileJson.gender ?? null,
      phone: profileJson.phone ?? null,
      address: profileJson.address ?? null,
      avatarDataUrl: profileJson.avatarDataUrl ?? null,
    };

    return json({ ok: true, token, profile });
  } catch (err: any) {
    console.error('clinician login error', err);
    return json({ error: err?.message || 'Login failed' }, 500);
  }
}
