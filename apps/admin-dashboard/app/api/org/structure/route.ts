import { NextResponse } from 'next/server';

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
  ((process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production')
    ? 'https://api-gateway.ambulantplus.co.za'
    : 'http://localhost:3010');

function gatewayBase() {
  return String(APIGW || '').replace(/\/+$/, '');
}

function normaliseGatewayStructure(value: any) {
  const departments = Array.isArray(value?.departments) ? value.departments : [];
  const roles = Array.isArray(value?.roles) ? value.roles : [];

  return {
    name: value?.name || value?.orgName || 'Ambulant+',
    orgName: value?.orgName || value?.name || 'Ambulant+',
    departments: departments.map((department: any) => ({
      id: String(department?.id || ''),
      name: String(department?.name || 'Department'),
      active: department?.active !== false,
      designations: Array.isArray(department?.designations)
        ? department.designations.map((designation: any) => ({
            id: String(designation?.id || ''),
            departmentId: String(designation?.departmentId || department?.id || ''),
            name: String(designation?.name || 'Designation'),
            roleNames: Array.isArray(designation?.roleNames)
              ? designation.roleNames.map(String)
              : Array.isArray(designation?.roles)
                ? designation.roles.map((role: any) => String(role?.name || role)).filter(Boolean)
                : [],
          }))
        : [],
    })),
    roles: roles.map((role: any) => ({
      id: String(role?.id || ''),
      name: String(role?.name || 'Role'),
      scopes: Array.isArray(role?.scopes) ? role.scopes.map(String) : [],
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
    const data = text ? JSON.parse(text) : null;

    if (!upstream.ok || !data || data?.ok === false) {
      throw new Error(data?.error || upstream.statusText || 'gateway_org_structure_unavailable');
    }

    return NextResponse.json(normaliseGatewayStructure(data), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error: any) {
    console.error('[admin-dashboard] canonical org structure unavailable', error);
    return NextResponse.json(
      { ok: false, error: 'canonical_org_structure_unavailable' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
