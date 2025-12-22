// apps/patient-app/app/api/wearable-insights/route.ts
import { NextResponse } from 'next/server';
import { getWearableInsights } from '../_lib/broadcaster';

export async function GET() {
  return NextResponse.json(getWearableInsights());
}
