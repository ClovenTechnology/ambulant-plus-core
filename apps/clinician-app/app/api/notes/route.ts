import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DB_PATH = path.join(process.cwd(), 'notes.json');

export async function GET() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    const entry = { text: String(text ?? ''), ts: Date.now() };
    let notes: any[] = [];
    try { notes = JSON.parse(await fs.readFile(DB_PATH, 'utf-8')); } catch {}
    notes.push(entry);
    await fs.writeFile(DB_PATH, JSON.stringify(notes, null, 2));
    return NextResponse.json(notes);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'notes error' }, { status: 500 });
  }
}
