// apps/api-gateway/app/api/medications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}

function normalizeMedicationStatus(value: unknown): any {
  const s = String(value ?? '').trim();

  if (!s) return undefined;

  // Keep runtime compatibility with the current schema enum values.
  // Prisma will validate the actual enum value at runtime.
  return s as any;
}

function normalizeDate(value: unknown, fallback = new Date()): Date {
  if (!value) return fallback;

  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function normalizeDurationDays(value: unknown): number | null {
  if (value == null) return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return String(value) as Prisma.InputJsonValue;
  }
}

// GET -> list meds, optional ?status=Active
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = normalizeMedicationStatus(url.searchParams.get('status'));

    const where: any = status ? { status } : undefined;

    const meds = await prisma.medication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(meds);
  } catch (err: any) {
    console.error('meds GET error', err);

    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

// POST -> create medication
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const data: any = {
      name: cleanStr(body.name) || 'Unknown',
      dose: cleanStr(body.dose),
      frequency: cleanStr(body.frequency),
      route: cleanStr(body.route),
      started: normalizeDate(body.started),
      lastFilled: normalizeDate(body.lastFilled),
      status: normalizeMedicationStatus(body.status) ?? 'Active',
      orderId: cleanStr(body.orderId),
      source: cleanStr(body.source),
      durationDays: normalizeDurationDays(body.durationDays),
      meta: normalizeJson(body.meta),
    };

    const med = await prisma.medication.create({ data });

    return NextResponse.json(med, { status: 201 });
  } catch (err: any) {
    console.error('meds POST error', err);

    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

// PATCH -> update medication
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const id = cleanStr(body?.id);

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const adminOk = await verifyAdminRequest(req);

    if (!adminOk) {
      // Limited non-admin update: status only.
      const status = normalizeMedicationStatus(body.status);

      if (!status) {
        return NextResponse.json(
          { error: 'status required' },
          { status: 400 },
        );
      }

      const updated = await prisma.medication.update({
        where: { id },
        data: { status } as any,
      });

      return NextResponse.json({ ok: true, med: updated });
    }

    // Admin full update.
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = cleanStr(body.name) || 'Unknown';
    if (body.dose !== undefined) updateData.dose = cleanStr(body.dose);
    if (body.frequency !== undefined) updateData.frequency = cleanStr(body.frequency);
    if (body.route !== undefined) updateData.route = cleanStr(body.route);
    if (body.started !== undefined) updateData.started = normalizeDate(body.started);
    if (body.lastFilled !== undefined) updateData.lastFilled = normalizeDate(body.lastFilled);
    if (body.status !== undefined) updateData.status = normalizeMedicationStatus(body.status);
    if (body.orderId !== undefined) updateData.orderId = cleanStr(body.orderId);
    if (body.source !== undefined) updateData.source = cleanStr(body.source);
    if (body.durationDays !== undefined) {
      updateData.durationDays = normalizeDurationDays(body.durationDays);
    }
    if (body.meta !== undefined) {
      updateData.meta = normalizeJson(body.meta);
    }

    const updated = await prisma.medication.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, med: updated });
  } catch (err: any) {
    console.error('meds PATCH error', err);

    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

// DELETE -> delete medication, admin only
export async function DELETE(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);

    if (!isAdmin) {
      return NextResponse.json({ error: 'admin_required' }, { status: 403 });
    }

    const url = new URL(req.url);
    let id = cleanStr(url.searchParams.get('id'));

    if (!id) {
      const body = await req.json().catch(() => ({} as any));
      id = cleanStr(body.id);
    }

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    await prisma.medication.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('meds DELETE error', err);

    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}