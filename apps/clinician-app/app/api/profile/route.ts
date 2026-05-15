// file: apps/clinician-app/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function parseBool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;

  if (typeof v === 'boolean') return v;

  const s = String(v).toLowerCase().trim();

  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;

  return null;
}

function parseObject(value: unknown): Record<string, any> {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function getProfileJson(clinician: any): Record<string, any> {
  const meta = parseObject(clinician?.meta);

  if (meta.rawProfile && typeof meta.rawProfile === 'object') {
    return meta.rawProfile as Record<string, any>;
  }

  if (typeof meta.rawProfileJson === 'string') {
    return parseObject(meta.rawProfileJson);
  }

  return meta;
}

function buildProfileResponse(clinician: any, profileJson: Record<string, any>) {
  return {
    ok: true,
    clinicianId: clinician.id,
    userId: clinician.userId,
    displayName: clinician.displayName,
    status: clinician.status,
    specialty: clinician.specialty,
    profile: {
      // immutable / read-only in UI
      dob: profileJson.dob ?? null,
      gender: profileJson.gender ?? null,
      hpcsaPracticeNumber: profileJson.hpcsaPracticeNumber ?? '',
      hpcsaNextRenewalDate: profileJson.hpcsaNextRenewalDate ?? null,
      qualifications: Array.isArray(profileJson.qualifications)
        ? profileJson.qualifications
        : [],
      otherQualifications: Array.isArray(profileJson.otherQualifications)
        ? profileJson.otherQualifications
        : [],

      // editable
      address: profileJson.address ?? '',
      phone: profileJson.phone ?? '',
      hasInsurance: profileJson.hasInsurance ?? null,
      insurerName: profileJson.insurerName ?? '',
      insuranceType: profileJson.insuranceType ?? '',
      insuranceCoversVirtual: profileJson.insuranceCoversVirtual ?? null,
      primaryLanguage: profileJson.primaryLanguage ?? '',
      otherLanguages: Array.isArray(profileJson.otherLanguages)
        ? profileJson.otherLanguages
        : [],
      preferredCommunication: Array.isArray(profileJson.preferredCommunication)
        ? profileJson.preferredCommunication
        : [],
      additionalQualifications: Array.isArray(profileJson.additionalQualifications)
        ? profileJson.additionalQualifications
        : [],
      avatarDataUrl: profileJson.avatarDataUrl ?? null,
    },
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  const arrayBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const base64 = buffer.toString('base64');
  const mime = file.type || 'application/octet-stream';

  return `data:${mime};base64,${base64}`;
}

/**
 * GET /api/profile?clinicianId=...
 * Returns clinician identity + immutable fields + editable profile block.
 */
export async function GET(req: NextRequest) {
  try {
    const clinicianId = req.nextUrl.searchParams.get('clinicianId');

    if (!clinicianId) {
      return json({ ok: false, error: 'missing_clinicianId' }, 400);
    }

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
    });

    if (!clinician) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    const profileJson = getProfileJson(clinician);

    return json(buildProfileResponse(clinician, profileJson));
  } catch (err: any) {
    console.error('GET /api/profile error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_load',
      },
      500,
    );
  }
}

/**
 * PUT /api/profile?clinicianId=...
 * Accepts either JSON or multipart/form-data with:
 * - payload: JSON string of editable fields
 * - avatar: optional image file
 */
export async function PUT(req: NextRequest) {
  try {
    const clinicianId = req.nextUrl.searchParams.get('clinicianId');

    if (!clinicianId) {
      return json({ ok: false, error: 'missing_clinicianId' }, 400);
    }

    const contentType = req.headers.get('content-type') || '';
    let payload: any = {};
    let avatarFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const fd = await req.formData();
      const rawPayload = fd.get('payload');

      if (rawPayload && typeof rawPayload === 'string') {
        try {
          payload = JSON.parse(rawPayload);
        } catch {
          payload = {};
        }
      }

      const avatar = fd.get('avatar');

      if (avatar instanceof File) {
        avatarFile = avatar;
      }
    } else {
      payload = await req.json().catch(() => ({}));
    }

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
    });

    if (!clinician) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    const clinicianAny = clinician as any;
    const existingMeta = parseObject(clinicianAny.meta);
    const profileJson = getProfileJson(clinician);

    // Apply editable fields only.
    if (typeof payload.address === 'string') {
      profileJson.address = payload.address.trim();
    }

    if (typeof payload.phone === 'string') {
      profileJson.phone = payload.phone.trim();
    }

    const hasInsurance = parseBool(payload.hasInsurance);

    if (hasInsurance !== null) {
      profileJson.hasInsurance = hasInsurance;
    }

    if (hasInsurance) {
      if (typeof payload.insurerName === 'string') {
        profileJson.insurerName = payload.insurerName.trim();
      }

      if (typeof payload.insuranceType === 'string') {
        profileJson.insuranceType = payload.insuranceType.trim();
      }

      const coversVirtual = parseBool(payload.insuranceCoversVirtual);

      if (coversVirtual !== null) {
        profileJson.insuranceCoversVirtual = coversVirtual;
      }
    } else if (hasInsurance === false) {
      profileJson.insurerName = '';
      profileJson.insuranceType = '';
      profileJson.insuranceCoversVirtual = null;
    }

    if (typeof payload.primaryLanguage === 'string') {
      profileJson.primaryLanguage = payload.primaryLanguage.trim();
    }

    if (Array.isArray(payload.otherLanguages)) {
      profileJson.otherLanguages = payload.otherLanguages
        .map((x: any) => String(x || '').trim())
        .filter(Boolean);
    } else if (typeof payload.otherLanguages === 'string') {
      profileJson.otherLanguages = payload.otherLanguages
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    if (Array.isArray(payload.preferredCommunication)) {
      profileJson.preferredCommunication = payload.preferredCommunication
        .map((x: any) => String(x || '').trim())
        .filter(Boolean);
    }

    if (Array.isArray(payload.additionalQualifications)) {
      profileJson.additionalQualifications = payload.additionalQualifications
        .map((q: any) => ({
          degree: String(q.degree || '').trim(),
          institution: String(q.institution || '').trim(),
          yearOfCompletion: q.yearOfCompletion
            ? String(q.yearOfCompletion)
            : undefined,
        }))
        .filter((q: any) => q.degree || q.institution);
    }

    if (avatarFile) {
      try {
        const dataUrl = await fileToDataUrl(avatarFile);
        profileJson.avatarDataUrl = dataUrl;
      } catch (e) {
        console.warn('Failed to process avatar file', e);
      }
    }

    const nextMeta = {
      ...existingMeta,
      rawProfile: profileJson,
      rawProfileJson: JSON.stringify(profileJson),
      insurerName: profileJson.insurerName ?? null,
      insuranceType: profileJson.insuranceType ?? null,
      hpcsaNextRenewalDate: profileJson.hpcsaNextRenewalDate ?? null,
    };

    const updated = await prisma.clinicianProfile.update({
      where: { id: clinicianId },
      data: {
        meta: nextMeta as any,
      } as any,
    });

    const newProfileJson = getProfileJson(updated);

    return json(buildProfileResponse(updated, newProfileJson));
  } catch (err: any) {
    console.error('PUT /api/profile error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'update_failed',
      },
      500,
    );
  }
}