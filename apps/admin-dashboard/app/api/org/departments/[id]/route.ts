// apps/admin-dashboard/app/api/org/departments/[id]/route.ts
import { NextResponse } from 'next/server';
import { orgdb } from '@/lib/orgdb';

export async function PATCH(_: Request, ctx: { params: { id: string } }) {
  try {
    const body = await _.json().catch(() => ({}));
    const dep = orgdb.updateDepartment(ctx.params.id, { name: body.name, active: body.active });
    return NextResponse.json(dep);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'update failed' }, { status: 400 });
  }
}

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    orgdb.deleteDepartment(ctx.params.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'delete failed' }, { status: 400 });
  }
}
