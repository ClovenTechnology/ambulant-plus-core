// apps/patient-app/app/api/plan/entitlement/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  apigwBase,
  relayJsonResponse,
} from '@/app/api/_apigw';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);

  if (!identity) {
    return NextResponse.json(
      {
        ok: false,
        error: 'patient_authentication_required',
      },
      {
        status: 401,
        headers: { 'cache-control': 'no-store' },
      },
    );
  }

  const upstream = await fetch(
    `${apigwBase()}/api/patient/plan-entitlement`,
    {
      method: 'GET',
      headers: patientGatewayHeaders({
        req,
        identity,
      }),
      cache: 'no-store',
    },
  ).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_gateway_unavailable',
      },
      {
        status: 502,
        headers: { 'cache-control': 'no-store' },
      },
    );
  }

  return relayJsonResponse(upstream);
}