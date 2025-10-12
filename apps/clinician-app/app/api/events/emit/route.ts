import { NextResponse } from 'next/server';
export async function POST() {
  // swallows events for local dev; extend to log if you want
  return NextResponse.json({ ok: true });
}
