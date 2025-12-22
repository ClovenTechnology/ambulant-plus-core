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
    if (!clinicianId) return json({ ok: false, error: 'missing_clinicianId' }, 400);

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: { metadata: true },
    });

    if (!clinician) return json({ ok: false, error: 'not_found' }, 404);

    let profileJson: any = {};
    if (clinician.metadata?.rawProfileJson) {
      try {
        profileJson = JSON.parse(clinician.metadata.rawProfileJson);
      } catch {
        profileJson = {};
      }
    }

    const out = {
      ok: true,
      clinicianId: clinician.id,
      userId: clinician.userId,
      displayName: clinician.displayName,
      status: clinician.status,
      specialty: clinician.specialty,
      profile: {
        // immutable (shown read-only in UI)
        dob: profileJson.dob ?? null,
        gender: profileJson.gender ?? null,
        hpcsaPracticeNumber: profileJson.hpcsaPracticeNumber ?? '',
        hpcsaNextRenewalDate: profileJson.hpcsaNextRenewalDate ?? null,
        qualifications: profileJson.qualifications ?? [],
        otherQualifications: profileJson.otherQualifications ?? [],
        // editable
        address: profileJson.address ?? '',
        phone: profileJson.phone ?? '',
        hasInsurance: profileJson.hasInsurance ?? null,
        insurerName: profileJson.insurerName ?? '',
        insuranceType: profileJson.insuranceType ?? '',
        insuranceCoversVirtual: profileJson.insuranceCoversVirtual ?? null,
        primaryLanguage: profileJson.primaryLanguage ?? '',
        otherLanguages:
          Array.isArray(profileJson.otherLanguages) && profileJson.otherLanguages.length
            ? profileJson.otherLanguages
            : [],
        preferredCommunication:
          Array.isArray(profileJson.preferredCommunication) && profileJson.preferredCommunication.length
            ? profileJson.preferredCommunication
            : [],
        additionalQualifications: profileJson.additionalQualifications ?? [],
        avatarDataUrl: profileJson.avatarDataUrl ?? null,
      },
    };

    return json(out);
  } catch (err: any) {
    console.error('GET /api/profile error', err);
    return json({ ok: false, error: err?.message || 'failed_to_load' }, 500);
  }
}

/**
 * PUT /api/profile?clinicianId=...
 * Accepts either JSON or multipart/form-data with:
 *  - payload: JSON string of editable fields
 *  - avatar: optional image file (profile picture)
 *
 * Editable:
 *  - phone, address
 *  - hasInsurance, insurerName, insuranceType, insuranceCoversVirtual
 *  - primaryLanguage, otherLanguages
 *  - preferredCommunication[]
 *  - additionalQualifications[]
 *
 * Immutable (NOT changed here):
 *  - name, email (handled by Auth0 / admin)
 *  - dob, gender
 *  - baseline qualifications / certs
 */
export async function PUT(req: NextRequest) {
  try {
    const clinicianId = req.nextUrl.searchParams.get('clinicianId');
    if (!clinicianId) return json({ ok: false, error: 'missing_clinicianId' }, 400);

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
      if (avatar instanceof File) avatarFile = avatar;
    } else {
      payload = await req.json().catch(() => ({}));
    }

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: { metadata: true },
    });

    if (!clinician) return json({ ok: false, error: 'not_found' }, 404);

    let profileJson: any = {};
    if (clinician.metadata?.rawProfileJson) {
      try {
        profileJson = JSON.parse(clinician.metadata.rawProfileJson);
      } catch {
        profileJson = {};
      }
    }

    // --- apply editable fields only ---

    if (typeof payload.address === 'string') profileJson.address = payload.address.trim();
    if (typeof payload.phone === 'string') profileJson.phone = payload.phone.trim();

    const hasInsurance = parseBool(payload.hasInsurance);
    if (hasInsurance !== null) profileJson.hasInsurance = hasInsurance;

    if (hasInsurance) {
      if (typeof payload.insurerName === 'string') profileJson.insurerName = payload.insurerName.trim();
      if (typeof payload.insuranceType === 'string') profileJson.insuranceType = payload.insuranceType.trim();
      const coversVirtual = parseBool(payload.insuranceCoversVirtual);
      if (coversVirtual !== null) profileJson.insuranceCoversVirtual = coversVirtual;
    } else {
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
          yearOfCompletion: q.yearOfCompletion ? String(q.yearOfCompletion) : undefined,
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

    const updatedMetaData = {
      rawProfileJson: JSON.stringify(profileJson),
      // keep existing HPCSA / insurer fields in metadata in sync, where present
      hpcsaS3Key: clinician.metadata?.hpcsaS3Key ?? null,
      hpcsaFileMeta: clinician.metadata?.hpcsaFileMeta ?? null,
      hpcsaNextRenewalDate: clinician.metadata?.hpcsaNextRenewalDate ?? null,
      insurerName: profileJson.insurerName ?? null,
      insuranceType: profileJson.insuranceType ?? null,
    };

    let updated = null;
    if (clinician.metadata) {
      updated = await prisma.clinicianProfile.update({
        where: { id: clinicianId },
        data: {
          metadata: {
            update: updatedMetaData,
          },
        },
        include: { metadata: true },
      });
    } else {
      updated = await prisma.clinicianProfile.update({
        where: { id: clinicianId },
        data: {
          metadata: {
            create: updatedMetaData,
          },
        },
        include: { metadata: true },
      });
    }

    let newProfileJson: any = {};
    if (updated.metadata?.rawProfileJson) {
      try {
        newProfileJson = JSON.parse(updated.metadata.rawProfileJson);
      } catch {
        newProfileJson = {};
      }
    }

    return json({
      ok: true,
      clinicianId: updated.id,
      userId: updated.userId,
      displayName: updated.displayName,
      status: updated.status,
      specialty: updated.specialty,
      profile: {
        dob: newProfileJson.dob ?? null,
        gender: newProfileJson.gender ?? null,
        hpcsaPracticeNumber: newProfileJson.hpcsaPracticeNumber ?? '',
        hpcsaNextRenewalDate: newProfileJson.hpcsaNextRenewalDate ?? null,
        qualifications: newProfileJson.qualifications ?? [],
        otherQualifications: newProfileJson.otherQualifications ?? [],
        address: newProfileJson.address ?? '',
        phone: newProfileJson.phone ?? '',
        hasInsurance: newProfileJson.hasInsurance ?? null,
        insurerName: newProfileJson.insurerName ?? '',
        insuranceType: newProfileJson.insuranceType ?? '',
        insuranceCoversVirtual: newProfileJson.insuranceCoversVirtual ?? null,
        primaryLanguage: newProfileJson.primaryLanguage ?? '',
        otherLanguages: newProfileJson.otherLanguages ?? [],
        preferredCommunication: newProfileJson.preferredCommunication ?? [],
        additionalQualifications: newProfileJson.additionalQualifications ?? [],
        avatarDataUrl: newProfileJson.avatarDataUrl ?? null,
      },
    });
  } catch (err: any) {
    console.error('PUT /api/profile error', err);
    return json({ ok: false, error: err?.message || 'update_failed' }, 500);
  }
}
