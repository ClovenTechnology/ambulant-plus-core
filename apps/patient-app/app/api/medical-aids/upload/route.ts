// apps/patient-app/app/api/medical-aids/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.resolve(process.cwd(), '../../uploads/medical-aids');

function safeExt(name: string) {
  const parts = name.split('.');
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : 'bin';
  return /^[a-z0-9]{1,10}$/.test(ext) ? ext : 'bin';
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  const patientId = (form.get('patientId') as string) || 'pt-za-001';

  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'file_required' }, { status: 400 });
  }

  const blob = file as File;

  // Basic size guard (15MB)
  const maxBytes = 15 * 1024 * 1024;
  if ((blob as any).size && (blob as any).size > maxBytes) {
    return NextResponse.json({ ok: false, error: 'file_too_large' }, { status: 413 });
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  const originalName = blob.name || 'com.pdf';
  const ext = safeExt(originalName);
  const fname = `com-${patientId}-${Date.now()}.${ext}`;

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filePath = path.join(UPLOAD_DIR, fname);
  await fs.writeFile(filePath, buf);

  // Return a repo-relative path so other apps can read it in dev
  const relPath = `uploads/medical-aids/${fname}`;

  return NextResponse.json({
    ok: true,
    comFilePath: relPath,
    comFileName: originalName,
  });
}
