// apps/admin-dashboard/app/api/org/structure/route.ts
import { NextResponse } from 'next/server';
import { orgdb } from '@/lib/orgdb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APIGW =
  process.env.APIGW_BASE ||
  process.env.APIGW_BASE_URL ||
  process.env.API_GATEWAY_BASE_URL ||
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  ((process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010');

function gatewayBase() {
  return String(APIGW || '').replace(/\/+$/, '');
}

function normaliseGatewayStructure(value: any) {
  const departments = Array.isArray(value?.departments) ? value.departments : [];

  return {
    name: value?.name || value?.orgName || 'Ambulant+',
    orgName: value?.orgName || value?.name || 'Ambulant+',
    departments: departments.map((d: any) => ({
      id: String(d?.id || ''),
      name: String(d?.name || 'Department'),
      active: d?.active !== false,
      designations: Array.isArray(d?.designations)
        ? d.designations.map((z: any) => ({
            id: String(z?.id || ''),
            departmentId: String(z?.departmentId || d?.id || ''),
            name: String(z?.name || 'Designation'),
            roleNames: Array.isArray(z?.roleNames)
              ? z.roleNames.map(String)
              : Array.isArray(z?.roles)
                ? z.roles.map((r: any) => String(r?.name || r)).filter(Boolean)
                : [],
          }))
        : [],
    })),
  };
}

export async function GET() {
  try {
    const upstream = await fetch(`${gatewayBase()}/api/org/structure`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    const text = await upstream.text();
    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!upstream.ok || !data || data?.ok === false) {
      throw new Error(data?.error || upstream.statusText || 'gateway_org_structure_unavailable');
    }

    return NextResponse.json(normaliseGatewayStructure(data), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (err: any) {
    console.warn('[admin-dashboard] gateway org structure unavailable; using local fallback', err);

    return NextResponse.json(
      {
        ...orgdb.structure(),
        warning: 'gateway_org_structure_unavailable_using_local_fallback',
      },
      {
        status: 200,
        headers: { 'cache-control': 'no-store' },
      },
    );
  }
}
