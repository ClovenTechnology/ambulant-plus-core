// apps/clinician-app/app/api/devices/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const devicesPath = path.join(process.cwd(), '../../packages/iot-sdk/devices.json');

export async function GET() {
  try {
    const buf = await fs.readFile(devicesPath, 'utf-8');
    const parsed = JSON.parse(buf);
    return NextResponse.json(parsed, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.warn('[devices] failed to read devices.json; returning empty list', e);
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
  }
}
