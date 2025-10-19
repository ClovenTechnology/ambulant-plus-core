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
    // protected? allow patient UI to add via authenticated session later
    const body = await req.json().catch(() => ({} as any));
    const med = await prisma.medication.create({
      data: {
        name: String(body.name ?? 'Unknown'),
        dose: String(body.dose ?? ''),
        frequency: String(body.frequency ?? ''),
        route: String(body.route ?? ''),
        started: body.started ? new Date(body.started) : new Date(),
        lastFilled: body.lastFilled ? new Date(body.lastFilled) : new Date(),
        status: (body.status as any) ?? 'Active',
        orderId: body.orderId ?? null,
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
      // allow limited updates from client: status/dose only (you can adapt)
      // For now require admin for patching anything except status
      const allowed = { status: body.status };
      const updated = await prisma.medication.update({ where: { id }, data: allowed as any });
      return NextResponse.json({ ok: true, med: updated });
    }

    // Admin full update:
    const updateData: any = { ...body };
    delete updateData.id;
    if (updateData.started) updateData.started = new Date(updateData.started);
    if (updateData.lastFilled) updateData.lastFilled = new Date(updateData.lastFilled);
    const updated = await prisma.medication.update({ where: { id }, data: updateData });
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
    if (!isAdmin) return NextResponse.json({ error: 'admin_required' }, { status: 403 });
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || (await req.json().catch(() => ({})).then((b:any)=>b?.id));
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.medication.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('meds DELETE error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
