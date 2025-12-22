import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns a richer summary so Overview tiles don't need to mock unless fields are missing.
 * If you later wire this to your gateway, just keep these keys stable.
 */
export async function GET() {
  const lastSync = new Date();

  // Mock-but-realistic 24h series (7 points -> last 24h snapshots)
  const hr24   = [72, 74, 71, 76, 79, 77, 75];
  const spo224 = [97, 96, 98, 97, 95, 97, 98];
  const bp24   = [120, 118, 121, 124, 119, 122, 123]; // e.g., systolic snapshot stream
  const temp24 = [36.7, 36.8, 36.9, 36.8, 37.0, 36.9, 36.8];

  // Current-ish values
  const payload = {
    lastSync: lastSync.toISOString(),
    lastSyncHuman: lastSync.toLocaleString(),
    overallStatus: 'stable',

    // KPIs expected by Overview
    hrNow: 74,
    spo2Now: 97,
    bpNow: { s: 122, d: 78 },
    tempNow: 36.8,

    // Series for sparklines
    hr24,
    spo224,
    bp24,
    temp24,
  };

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
