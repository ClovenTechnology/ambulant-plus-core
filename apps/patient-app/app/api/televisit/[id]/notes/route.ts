// apps/patient-app/app/api/televisit/[id]/notes/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Note = { id: string; ts: string; text: string; authorUid?: string | null };

const STORE: Record<string, Note[]> = {}; // in-memory by televisit id (dev)

function safeId() {
  return Math.random().toString(36).slice(2);
}

function clampText(s: string, max = 2000) {
  const t = (s || '').trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max) : t;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const notes = STORE[id] ?? [];
  const sorted = notes
    .slice()
    .sort((a, b) => (Date.parse(a.ts) < Date.parse(b.ts) ? 1 : -1));
  return NextResponse.json(sorted, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = clampText(body?.text ?? '');

  if (!text) {
    return NextResponse.json({ ok: false, error: 'empty_text' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const authorUid = req.headers.get('x-uid') || req.headers.get('X-Uid');

  const item: Note = {
    id: safeId(),
    ts: new Date().toISOString(),
    text,
    authorUid: authorUid || null,
  };

  STORE[id] = STORE[id] ?? [];
  STORE[id].push(item);

  return NextResponse.json(item, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
