// apps/api-gateway/app/api/reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET -> list reminders, optional ?source=erx
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const source = url.searchParams.get('source');
    const where = source ? { source } : undefined;
    const reminders = await prisma.reminder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ ok: true, reminders });
  } catch (err: any) {
    console.error('reminders GET error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// POST -> batch actions (confirm / snooze) -- keep similar contract
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const action = String(body?.action ?? '').toLowerCase();
    const ids = body?.ids ?? (body?.id ? [body.id] : []);
    if (!action || !['confirm','snooze'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
    }
    if (!ids || ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'id(s) required' }, { status: 400 });
    }

    const results: Record<string, any> = {};
    for (const id of ids) {
      const r = await prisma.reminder.findUnique({ where: { id } });
      if (!r) { results[id] = { ok: false, error: 'not_found' }; continue; }
      if (action === 'confirm') {
        const updated = await prisma.reminder.update({ where: { id }, data: { status: 'Taken', snoozedUntil: null } });
        results[id] = { ok: true, reminder: updated };
      } else {
        const snoozeMinutes = Number.isFinite(Number(body?.snoozeMinutes)) ? Math.max(1, Number(body.snoozeMinutes)) : 15;
        const snoozedUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000);
        const updated = await prisma.reminder.update({ where: { id }, data: { status: 'Pending', snoozedUntil } });
        results[id] = { ok: true, reminder: updated };
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('reminders POST error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// PUT -> create reminders (single or array)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const items = Array.isArray(body) ? body : [body];
    const created: any[] = [];
    for (const it of items) {
      if (!it?.name) continue;
      const r = await prisma.reminder.create({
        data: {
          name: String(it.name),
          dose: it?.dose ?? null,
          time: it?.time ?? null,
          status: it?.status ?? 'Pending',
          snoozedUntil: it?.snoozedUntil ? new Date(it.snoozedUntil) : null,
          source: it?.source ?? 'manual',
        },
      });
      created.push(r);
    }
    return NextResponse.json({ ok: true, created });
  } catch (err: any) {
    console.error('reminders PUT error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// DELETE -> remove reminders, id param or body { ids: [] }
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const idsFromQs = url.searchParams.getAll('id') || [];
    const body = await req.json().catch(() => ({} as any));
    const ids = [...(body?.ids || (body?.id ? [body.id] : [])), ...idsFromQs].filter(Boolean);
    if (!ids.length) return NextResponse.json({ ok: false, error: 'id(s) required' }, { status: 400 });

    const removed: string[] = [];
    const notFound: string[] = [];
    for (const id of ids) {
      try {
        await prisma.reminder.delete({ where: { id } });
        removed.push(id);
      } catch {
        notFound.push(id);
      }
    }
    return NextResponse.json({ ok: true, removed, notFound });
  } catch (err: any) {
    console.error('reminders DELETE error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
