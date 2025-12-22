// apps/patient-app/app/api/v1/patients/[id]/auscultations/route.ts
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

type Row = {
  id: string;
  patientId: string;
  createdAt: string;
  bytes: number;
  mime: string;
  fileName: string;
  fileUrl: string;
  meta?: any;
};

// naive in-memory store for dev
const g = globalThis as any;
g.__AUSC__ = g.__AUSC__ || [];
const db: Row[] = g.__AUSC__;

function ensureTmp() {
  const fs = require('fs'); const p = require('path');
  const dir = p.join(process.cwd(), '.tmp_uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  return dir;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const items = db.filter(r => r.patientId === id).slice(-50).reverse();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = params.id;
  const form = await req.formData();
  const file = form.get('file') as File | null;
  const metaRaw = form.get('meta') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 });
  }

  const meta = metaRaw ? JSON.parse(metaRaw) : {};
  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  const fs = require('fs'); const p = require('path');
  const dir = ensureTmp();
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const ext = (file.name?.split('.').pop() || 'bin').toLowerCase();
  const name = `ausc_${patientId}_${id}.${ext}`;
  const fullPath = p.join(dir, name);
  fs.writeFileSync(fullPath, buf);

  // In dev, just serve via /api/dev/files
  const fileUrl = `/api/dev/files?f=${encodeURIComponent(name)}`;

  const row: Row = {
    id, patientId,
    createdAt: new Date().toISOString(),
    bytes: buf.byteLength,
    mime: file.type || 'application/octet-stream',
    fileName: name,
    fileUrl,
    meta,
  };
  db.push(row);

  return NextResponse.json({ ok: true, item: row });
}
