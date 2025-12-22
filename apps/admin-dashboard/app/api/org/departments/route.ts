// apps/admin-dashboard/app/api/org/departments/route.ts
import { NextResponse } from 'next/server';
import { orgdb } from '@/lib/orgdb';

export async function GET() {
  return NextResponse.json({ items: orgdb.listDepartments() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const dep = orgdb.createDepartment({ name: body.name, active: body.active });
    return NextResponse.json(dep, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'create failed' }, { status: 400 });
  }
}
