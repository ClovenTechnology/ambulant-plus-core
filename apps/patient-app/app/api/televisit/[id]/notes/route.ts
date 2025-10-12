// apps/patient-app/app/api/televisit/[id]/notes/route.ts
import { NextResponse } from 'next/server';

type Note = { id: string; ts: string; text: string };

const STORE: Record<string, Note[]> = {}; // in-memory by televisit id

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const notes = STORE[id] ?? [];
  // newest first
  return NextResponse.json(notes.slice().sort((a,b)=> (a.ts < b.ts ? 1 : -1)));
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const body = (await req.json()) as { text?: string };
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ ok:false, error:'Empty text' }, { status: 400 });

  const item: Note = {
    id: Math.random().toString(36).slice(2),
    ts: new Date().toISOString(),
    text
  };
  STORE[id] = STORE[id] ?? [];
  STORE[id].push(item);
  return NextResponse.json({ ok:true, item }, { status: 201 });
}
