// apps/admin-dashboard/app/api/org/designations/[id]/route.ts
import { NextResponse } from 'next/server';
import { orgdb } from '@/lib/orgdb';
import type { RoleName } from '@/lib/org';

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const des = orgdb.updateDesignation(ctx.params.id, {
      name: body.name,
      departmentId: body.departmentId,
      roleNames: Array.isArray(body.roleNames) ? (body.roleNames as RoleName[]) : undefined,
    });
    return NextResponse.json(des);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'update failed' }, { status: 400 });
  }
}

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    orgdb.deleteDesignation(ctx.params.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'delete failed' }, { status: 400 });
  }
}
