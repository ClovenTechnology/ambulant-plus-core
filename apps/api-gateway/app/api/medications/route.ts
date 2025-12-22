// apps/api-gateway/app/api/medications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET -> list meds (optional ?status=Active)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const where = status ? { status } : undefined;
    const meds = await prisma.medication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(meds);
  } catch (err: any) {
    console.error('meds GET error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST -> create medication
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const durationDays =
      body.durationDays == null
        ? null
        : Number.isFinite(Number(body.durationDays))
        ? Number(body.durationDays)
        : null;

    const med = await prisma.medication.create({
      data: {
        name: String(body.name ?? 'Unknown'),
        dose: body.dose != null ? String(body.dose) : null,
        frequency: body.frequency != null ? String(body.frequency) : null,
        route: body.route != null ? String(body.route) : null,
        started: body.started ? new Date(body.started) : new Date(),
        lastFilled: body.lastFilled ? new Date(body.lastFilled) : new Date(),
        status: (body.status as any) ?? 'Active',
        orderId: body.orderId ?? null,
        source: body.source ?? null,
        durationDays,
        meta: body.meta ?? null,
      },
    });

    return NextResponse.json(med, { status: 201 });
  } catch (err: any) {
    console.error('meds POST error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH -> update medication
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const id = body?.id;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Only admin or owner could update — simple admin check for now
    const adminOk = await verifyAdminRequest(req);
    if (!adminOk) {
      // allow limited updates from client: status only for now
      const allowed: any = {};
      if (body.status) allowed.status = body.status;
      const updated = await prisma.medication.update({
        where: { id },
        data: allowed,
      });
      return NextResponse.json({ ok: true, med: updated });
    }

    // Admin full update:
    const updateData: any = { ...body };
    delete updateData.id;

    if (updateData.started) updateData.started = new Date(updateData.started);
    if (updateData.lastFilled)
      updateData.lastFilled = new Date(updateData.lastFilled);

    if (updateData.durationDays != null) {
      updateData.durationDays = Number.isFinite(Number(updateData.durationDays))
        ? Number(updateData.durationDays)
        : null;
    }

    const updated = await prisma.medication.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ ok: true, med: updated });
  } catch (err: any) {
    console.error('meds PATCH error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE -> delete medication (admin)
export async function DELETE(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin)
      return NextResponse.json({ error: 'admin_required' }, { status: 403 });

    const url = new URL(req.url);
    const id =
      url.searchParams.get('id') ||
      (await req.json().catch(() => ({} as any))).id;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await prisma.medication.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('meds DELETE error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
