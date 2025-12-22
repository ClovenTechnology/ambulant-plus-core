// apps/admin-dashboard/app/api/roles/requests/[id]/route.ts
import { NextResponse } from 'next/server';
import { roleReqStore } from '@/lib/rolerequests';

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { status, decidedBy, reason } = body;
    if (status !== 'approved' && status !== 'denied') {
      return NextResponse.json({ error: 'status must be approved|denied' }, { status: 400 });
    }
    const rr = roleReqStore.decide(ctx.params.id, status, decidedBy || 'admin', reason);
    return NextResponse.json(rr);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 });
  }
}

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  roleReqStore.remove(ctx.params.id);
  return NextResponse.json({ ok: true });
}
