// apps/admin-dashboard/app/api/org/designations/route.ts
import { NextResponse } from 'next/server';
import { orgdb } from '@/lib/orgdb';
import type { RoleName } from '@/lib/org';

export async function GET() {
  return NextResponse.json({ items: orgdb.listDesignations() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const des = orgdb.createDesignation({
      departmentId: String(body.departmentId),
      name: String(body.name),
      roleNames: Array.isArray(body.roleNames) ? (body.roleNames as RoleName[]) : [],
    });
    return NextResponse.json(des, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'create failed' }, { status: 400 });
  }
}
