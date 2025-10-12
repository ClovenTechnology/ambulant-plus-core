// apps/.../app/api/notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'notes.json');

export async function GET() {
  let notes: { text: string; ts: number }[] = [];
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    notes = JSON.parse(raw);
  } catch {
    // file may not existâ€”start with empty
  }
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newEntry = { text: body.text, ts: Date.now() };
    let notes: { text: string; ts: number }[] = [];
    try {
      const raw = await fs.readFile(DB_PATH, 'utf-8');
      notes = JSON.parse(raw);
    } catch {
      // ignore
    }
    notes.push(newEntry);
    await fs.writeFile(DB_PATH, JSON.stringify(notes, null, 2));
    return NextResponse.json(notes);
  } catch (err: any) {
    console.error('[Notes API] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
