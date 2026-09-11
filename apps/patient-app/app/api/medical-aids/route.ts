import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readPatientGatewayIdentity } from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelemedCover = 'none' | 'full' | 'partial';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function nullable(value: unknown, max = 500) {
  return clean(value, max) || null;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function coverFromRow(row: any): TelemedCover {
  const raw = clean(row?.telemedicineCoverType, 40).toLowerCase();
  if (raw === 'none' || raw === 'partial' || raw === 'full') return raw;
  return row?.coversTelemedicine === false ? 'none' : 'full';
}

function managedRefFromInput(body: any) {
  const direct = clean(body?.comManagedRef || body?.comFileStoredAs, 1200);
  if (direct.startsWith('managed://ambulant-patient-medical-aid-documents/')) return direct;

  const pathValue = clean(body?.comFilePath, 2000);
  if (pathValue.startsWith('managed://ambulant-patient-medical-aid-documents/')) return pathValue;

  try {
    const parsed = new URL(pathValue, 'https://patient.invalid');
    const fromQuery = clean(parsed.searchParams.get('managedRef'), 1200);
    if (fromQuery.startsWith('managed://ambulant-patient-medical-aid-documents/')) return fromQuery;
  } catch {}

  return null;
}

function shape(row: any) {
  const managedRef = clean(row?.comFileStoredAs, 1200) || null;
  return {
    id: String(row?.id || ''),
    patientId: String(row?.patientId || ''),
    createdAt: row?.createdAt?.toISOString?.() ?? row?.createdAt ?? null,
    updatedAt: row?.updatedAt?.toISOString?.() ?? row?.updatedAt ?? null,
    payerName: row?.schemeName ?? '',
    schemeName: row?.schemeName ?? '',
    planName: row?.planName ?? '',
    membershipNumber: row?.membershipNumber ?? '',
    dependentCode: row?.dependentCode ?? '',
    principalName: row?.principalName ?? '',
    telemedCover: coverFromRow(row),
    telemedCopayType: row?.coPaymentType ?? undefined,
    telemedCopayValue: row?.coPaymentValue ?? undefined,
    comFileName: row?.comFileOriginalName ?? undefined,
    comManagedRef: managedRef ?? undefined,
    comFilePath: managedRef
      ? `/api/medical-aids/documents/view?managedRef=${encodeURIComponent(managedRef)}`
      : undefined,
    hasCom: Boolean(row?.hasCom && managedRef),
    notes: row?.notes ?? '',
    active: Boolean(row?.isDefault),
  };
}

async function requireIdentity(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) return { ok: false as const, response: json({ ok: false, error: 'patient_authentication_required' }, 401) };

  const requested = clean(req.nextUrl.searchParams.get('patientId'), 160);
  if (requested && requested !== identity.patientId) {
    return { ok: false as const, response: json({ ok: false, error: 'patient_context_mismatch' }, 403) };
  }

  return { ok: true as const, identity };
}

export async function GET(req: NextRequest) {
  const access = await requireIdentity(req);
  if (!access.ok) return access.response;

  const rows = await prisma.medicalAidPolicy.findMany({
    where: { patientId: access.identity.patientId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    take: 20,
  });

  return json({ ok: true, items: rows.map(shape) });
}

export async function POST(req: NextRequest) {
  const access = await requireIdentity(req);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => ({} as any));
  const suppliedPatientId = clean(body?.patientId, 160);
  if (suppliedPatientId && suppliedPatientId !== access.identity.patientId) {
    return json({ ok: false, error: 'patient_context_mismatch' }, 403);
  }

  const schemeName = clean(body?.payerName || body?.schemeName, 240);
  const membershipNumber = clean(body?.membershipNumber, 240);
  if (!schemeName || !membershipNumber) {
    return json({ ok: false, error: 'payerName_and_membershipNumber_required' }, 400);
  }

  const telemedCover = clean(body?.telemedCover, 40).toLowerCase() as TelemedCover;
  const isDefault = body?.active === undefined
    ? (await prisma.medicalAidPolicy.count({ where: { patientId: access.identity.patientId } })) === 0
    : Boolean(body.active);
  const managedRef = managedRefFromInput(body);

  const saved = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.medicalAidPolicy.updateMany({
        where: { patientId: access.identity.patientId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.medicalAidPolicy.create({
      data: {
        patientId: access.identity.patientId,
        schemeName,
        planName: nullable(body?.planName, 240),
        membershipNumber,
        dependentCode: nullable(body?.dependentCode, 120),
        principalName: nullable(body?.principalName, 240),
        coversTelemedicine: telemedCover !== 'none',
        telemedicineCoverType: ['none', 'partial', 'full'].includes(telemedCover) ? telemedCover : 'partial',
        coPaymentType: nullable(body?.telemedCopayType, 40),
        coPaymentValue: Number.isFinite(Number(body?.telemedCopayValue)) ? Math.round(Number(body.telemedCopayValue)) : null,
        notes: nullable(body?.notes, 2000),
        comFileOriginalName: nullable(body?.comFileName, 500),
        comFileStoredAs: managedRef,
        hasCom: Boolean(managedRef),
        isDefault,
      },
    });
  });

  return json({ ok: true, item: shape(saved) }, 201);
}

export async function PUT(req: NextRequest) {
  const access = await requireIdentity(req);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => ({} as any));
  const id = clean(body?.id, 160);
  if (!id) return json({ ok: false, error: 'id_required' }, 400);

  const existing = await prisma.medicalAidPolicy.findFirst({
    where: { id, patientId: access.identity.patientId },
  });
  if (!existing) return json({ ok: false, error: 'not_found' }, 404);

  const suppliedPatientId = clean(body?.patientId, 160);
  if (suppliedPatientId && suppliedPatientId !== access.identity.patientId) {
    return json({ ok: false, error: 'patient_context_mismatch' }, 403);
  }

  const managedRef = managedRefFromInput(body);
  const setDefault = body?.active === true;
  const saved = await prisma.$transaction(async (tx) => {
    if (setDefault) {
      await tx.medicalAidPolicy.updateMany({
        where: { patientId: access.identity.patientId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return tx.medicalAidPolicy.update({
      where: { id },
      data: {
        ...(body?.payerName !== undefined || body?.schemeName !== undefined
          ? { schemeName: clean(body?.payerName || body?.schemeName, 240) || existing.schemeName }
          : {}),
        ...(body?.planName !== undefined ? { planName: nullable(body.planName, 240) } : {}),
        ...(body?.membershipNumber !== undefined
          ? { membershipNumber: clean(body.membershipNumber, 240) || existing.membershipNumber }
          : {}),
        ...(body?.dependentCode !== undefined ? { dependentCode: nullable(body.dependentCode, 120) } : {}),
        ...(body?.principalName !== undefined ? { principalName: nullable(body.principalName, 240) } : {}),
        ...(body?.telemedCover !== undefined
          ? {
              coversTelemedicine: clean(body.telemedCover, 40).toLowerCase() !== 'none',
              telemedicineCoverType: ['none', 'partial', 'full'].includes(clean(body.telemedCover, 40).toLowerCase())
                ? clean(body.telemedCover, 40).toLowerCase()
                : existing.telemedicineCoverType,
            }
          : {}),
        ...(body?.telemedCopayType !== undefined ? { coPaymentType: nullable(body.telemedCopayType, 40) } : {}),
        ...(body?.telemedCopayValue !== undefined
          ? { coPaymentValue: Number.isFinite(Number(body.telemedCopayValue)) ? Math.round(Number(body.telemedCopayValue)) : null }
          : {}),
        ...(body?.notes !== undefined ? { notes: nullable(body.notes, 2000) } : {}),
        ...(body?.comFileName !== undefined ? { comFileOriginalName: nullable(body.comFileName, 500) } : {}),
        ...(managedRef ? { comFileStoredAs: managedRef, hasCom: true } : {}),
        ...(body?.active !== undefined ? { isDefault: Boolean(body.active) } : {}),
      },
    });
  });

  return json({ ok: true, item: shape(saved) });
}

export async function DELETE(req: NextRequest) {
  const access = await requireIdentity(req);
  if (!access.ok) return access.response;

  const id = clean(req.nextUrl.searchParams.get('id'), 160);
  if (!id) return json({ ok: false, error: 'id_required' }, 400);

  const existing = await prisma.medicalAidPolicy.findFirst({
    where: { id, patientId: access.identity.patientId },
    select: { id: true },
  });
  if (!existing) return json({ ok: false, error: 'not_found' }, 404);

  await prisma.medicalAidPolicy.delete({ where: { id } });
  return json({ ok: true });
}
