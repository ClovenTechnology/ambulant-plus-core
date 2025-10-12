// ============================================================================
// apps/patient-app/app/api/push/subscribe/route.ts
// Accepts/stubs storing push subscriptions. Replace with DB in prod.
// ============================================================================
import { NextResponse } from 'next/server';

let memSubs: any[] = []; // NOTE: dev-only in-memory store

export async function POST(req: Request) {
  try {
    const { subscription } = await req.json();
    if (!subscription?.endpoint) return NextResponse.json({ ok: false, error: 'bad subscription' }, { status: 400 });
    memSubs = [subscription]; // upsert single for demo
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE() {
  memSubs = [];
  return NextResponse.json({ ok: true });
}

// Helper (not exported): used by /api/push/test
export function __getSubs() { return memSubs; }
