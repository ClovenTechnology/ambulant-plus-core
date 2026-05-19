// apps/patient-app/app/api/conditions/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '../../../../api-gateway/src/lib/db';
import { readIdentity } from '../../../../api-gateway/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function conditionDelegate() {
  return (prisma as any).condition ?? null;
}

function cleanStr(value: unknown): string {
  return String(value ?? '').trim();
}

function readPatientId(req: NextRequest, identity: any) {
  return (
    req.headers.get('x-ambulant-patient-id') ||
    req.headers.get('x-patient-id') ||
    req.headers.get('x-ambulant-user-id') ||
    req.headers.get('x-user-id') ||
    req.headers.get('x-uid') ||
    identity?.patientId ||
    identity?.uid ||
    ''
  ).trim();
}

function parseDate(value: string | null) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

export async function GET(req: NextRequest) {
  try {
    const identity = readIdentity(req.headers);
    const patientId = readPatientId(req, identity);
    const condition = conditionDelegate();

    if (!condition?.findMany) {
      return json(
        {
          ok: false,
          error: 'condition_store_unavailable',
          data: [],
        },
        503,
      );
    }

    const url = new URL(req.url);
    const take = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get('limit') || 50)),
    );

    const where: Record<string, any> = {
      source: 'patient',
    };

    if (patientId) {
      where.OR = [
        { patientId },
        { recordedBy: patientId },
        { userId: patientId },
      ];
    }

    const items = await condition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    return json(
      {
        ok: true,
        data: Array.isArray(items) ? items : [],
      },
      200,
    );
  } catch (err: any) {
    console.error('patient.conditions.get.error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_load_conditions',
        data: [],
      },
      500,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = readIdentity(req.headers);
    const patientId = readPatientId(req, identity);
    const condition = conditionDelegate();

    if (!patientId) {
      return json({ ok: false, error: 'patient_identity_required' }, 401);
    }

    if (!condition?.create) {
      return json(
        {
          ok: false,
          error: 'condition_store_unavailable',
        },
        503,
      );
    }

    const form = await req.formData();

    const name = cleanStr(form.get('name'));
    const diagnosedAtRaw = cleanStr(form.get('diagnosedAt')) || null;
    const status = cleanStr(form.get('status')) || 'Active';
    const notes = cleanStr(form.get('notes')) || null;
    const facility = cleanStr(form.get('facility')) || null;
    const clinician = cleanStr(form.get('clinician')) || null;
    const location = cleanStr(form.get('location')) || null;

    if (!name) {
      return json({ ok: false, error: 'condition_name_required' }, 400);
    }

    const file = form.get('file');

    if (file instanceof File && file.size > 0) {
      return json(
        {
          ok: false,
          error: 'condition_file_store_not_configured',
          message:
            'Condition file upload is disabled until the production document store is connected.',
        },
        503,
      );
    }

    const created = await condition.create({
      data: {
        name,
        diagnosedAt: parseDate(diagnosedAtRaw),
        status,
        notes,
        facility,
        clinician,
        location,
        patientId,
        recordedBy: identity?.uid ?? patientId,
        source: 'patient',
      },
    });

    return json({ ok: true, record: created }, 201);
  } catch (err: any) {
    console.error('patient.conditions.post.error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_create_condition',
      },
      500,
    );
  }
}