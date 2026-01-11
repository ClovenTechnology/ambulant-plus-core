// apps/patient-app/api/v1/patients/[id]/auscultations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

type Row = {
  id: string;
  patientId: string;
  createdAt: string;

  bytes: number;
  sha256: string;

  mime: string;
  fileName: string; // stored on disk (tmp)
  fileUrl: string;  // download url from this route

  // Audio metadata (best-effort)
  durationSec?: number;
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;

  meta?: any;
};

const g = globalThis as any;
g.__AUSC__ = g.__AUSC__ || [];
const db: Row[] = g.__AUSC__;

function noStoreJson(body: any, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

function ensureTmp() {
  const dir = path.join(process.cwd(), '.tmp_uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeToken(s: string) {
  return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

async function parseMeta(metaPart: FormDataEntryValue | null) {
  if (!metaPart) return {};
  try {
    if (typeof metaPart === 'string') return JSON.parse(metaPart);

    const blob = metaPart as Blob;
    const text = await blob.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

const MAX_BYTES = 25 * 1024 * 1024; // dev guardrail (25MB)

/**
 * Best-effort WAV sniff (PCM little-endian). Returns undefined if not WAV.
 * Keeps it minimal: parses RIFF/WAVE, fmt, and data chunk size when present.
 */
function sniffWav(buf: Buffer): {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  durationSec?: number;
} | null {
  if (buf.length < 44) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buf.toString('ascii', 8, 12) !== 'WAVE') return null;

  let offset = 12;
  let fmtSampleRate: number | undefined;
  let fmtChannels: number | undefined;
  let fmtBits: number | undefined;
  let dataBytes: number | undefined;

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    offset += 8;

    if (chunkId === 'fmt ') {
      if (offset + 16 <= buf.length) {
        // const audioFormat = buf.readUInt16LE(offset + 0); // 1 = PCM
        fmtChannels = buf.readUInt16LE(offset + 2);
        fmtSampleRate = buf.readUInt32LE(offset + 4);
        // const byteRate = buf.readUInt32LE(offset + 8);
        // const blockAlign = buf.readUInt16LE(offset + 12);
        fmtBits = buf.readUInt16LE(offset + 14);
      }
    } else if (chunkId === 'data') {
      dataBytes = chunkSize;
      break; // enough
    }

    // chunks are word-aligned
    offset += chunkSize + (chunkSize % 2);
    if (offset > buf.length) break;
  }

  const out: any = {
    sampleRate: fmtSampleRate,
    channels: fmtChannels,
    bitsPerSample: fmtBits,
  };

  if (
    fmtSampleRate &&
    fmtChannels &&
    fmtBits &&
    dataBytes !== undefined &&
    fmtSampleRate > 0 &&
    fmtChannels > 0 &&
    fmtBits > 0
  ) {
    const bytesPerSample = (fmtBits / 8) * fmtChannels;
    if (bytesPerSample > 0) {
      out.durationSec = dataBytes / (fmtSampleRate * bytesPerSample);
    }
  }

  return out;
}

function sha256Hex(buf: Buffer) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function streamFile(fullPath: string, mime: string, downloadName?: string) {
  const stat = fs.statSync(fullPath);
  const headers: Record<string, string> = {
    'Content-Type': mime || 'application/octet-stream',
    'Content-Length': String(stat.size),
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
  };

  if (downloadName) {
    headers['Content-Disposition'] = `inline; filename="${downloadName.replace(/"/g, '')}"`;
  }

  // Node stream is allowed in NextResponse
  const nodeStream = fs.createReadStream(fullPath);
  return new NextResponse(nodeStream as any, { status: 200, headers });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = params.id;
  const url = req.nextUrl;

  // Download a specific clip
  if (url.searchParams.get('download') === '1') {
    const id = url.searchParams.get('id') || '';
    const row = db.find((r) => r.patientId === patientId && r.id === id);
    if (!row) return noStoreJson({ error: 'not_found' }, { status: 404 });

    const dir = ensureTmp();
    const fullPath = path.join(dir, row.fileName);
    if (!fs.existsSync(fullPath)) return noStoreJson({ error: 'file_missing' }, { status: 410 });

    return streamFile(fullPath, row.mime, row.fileName);
  }

  // List with basic paging
  const limitRaw = Number(url.searchParams.get('limit') || '50');
  const limit = Math.min(Math.max(1, isFinite(limitRaw) ? limitRaw : 50), 200);
  const before = url.searchParams.get('before'); // ISO string
  const items = db
    .filter((r) => r.patientId === patientId)
    .filter((r) => {
      if (!before) return true;
      return r.createdAt < before;
    })
    .slice(-1000) // dev guard
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);

  const nextBefore = items.length ? items[items.length - 1].createdAt : null;
  return noStoreJson({ items, nextBefore });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = params.id;
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return noStoreJson({ error: 'id_required' }, { status: 400 });

  const idx = db.findIndex((r) => r.patientId === patientId && r.id === id);
  if (idx === -1) return noStoreJson({ error: 'not_found' }, { status: 404 });

  const [row] = db.splice(idx, 1);

  // Best-effort delete file from disk
  try {
    const dir = ensureTmp();
    const fullPath = path.join(dir, row.fileName);
    await fsp.unlink(fullPath);
  } catch {
    // ignore
  }

  return noStoreJson({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = params.id;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return noStoreJson({ error: 'file_required' }, { status: 400 });

  // Size guard
  if (typeof file.size === 'number' && file.size > MAX_BYTES) {
    return noStoreJson({ error: 'file_too_large', maxBytes: MAX_BYTES }, { status: 413 });
  }

  const meta = await parseMeta(form.get('meta'));

  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  if (buf.byteLength > MAX_BYTES) {
    return noStoreJson({ error: 'file_too_large', maxBytes: MAX_BYTES }, { status: 413 });
  }

  const dir = ensureTmp();

  const id = crypto.randomUUID();
  const safePid = safeToken(patientId);

  const extRaw = (file.name?.split('.').pop() || 'bin').toLowerCase();
  const ext = extRaw.replace(/[^a-z0-9]/g, '').slice(0, 10) || 'bin';

  const fileName = `ausc_${safePid}_${id}.${ext}`;
  const fullPath = path.join(dir, fileName);

  await fsp.writeFile(fullPath, buf);

  const hash = sha256Hex(buf);

  // Try to infer WAV params (helps UI duration correctness)
  const wav = sniffWav(buf) || null;

  const fileUrl = `/api/v1/patients/${encodeURIComponent(patientId)}/auscultations?download=1&id=${encodeURIComponent(
    id,
  )}`;

  const row: Row = {
    id,
    patientId,
    createdAt: new Date().toISOString(),
    bytes: buf.byteLength,
    sha256: hash,
    mime: file.type || (ext === 'wav' ? 'audio/wav' : 'application/octet-stream'),
    fileName,
    fileUrl,
    meta,
    durationSec: wav?.durationSec,
    sampleRate: wav?.sampleRate,
    channels: wav?.channels,
    bitsPerSample: wav?.bitsPerSample,
  };

  db.push(row);

  return noStoreJson({ ok: true, item: row });
}
