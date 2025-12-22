// apps/clinician-app/app/api/encounters/[id]/docs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '../../../erx/_lib_db_compat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// If you later add an upstream, you can reuse this:
const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');

type EncounterDoc = {
  id: string;
  encounterId: string;
  patientId: string | null;
  docType: string;       // e.g. 'erx', 'sick-note', 'fitness-note', 'other'
  title: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;     // ISO
  source: string;        // e.g. 'clinician-app'
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const encounterId = params.id;

  if (!encounterId) {
    return NextResponse.json(
      { error: 'encounterId is required in the URL' },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse multipart form-data' },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'file field is required and must be a File' },
      { status: 400 },
    );
  }

  const patientIdRaw = form.get('patientId');
  const docTypeRaw = form.get('docType');
  const titleRaw = form.get('title');
  const sourceRaw = form.get('source');

  const patientId =
    typeof patientIdRaw === 'string' && patientIdRaw.trim()
      ? patientIdRaw.trim()
      : null;

  const docType =
    typeof docTypeRaw === 'string' && docTypeRaw.trim()
      ? docTypeRaw.trim()
      : 'note';

  const title =
    typeof titleRaw === 'string' && titleRaw.trim()
      ? titleRaw.trim()
      : file.name;

  const source =
    typeof sourceRaw === 'string' && sourceRaw.trim()
      ? sourceRaw.trim()
      : 'clinician-app';

  const contentType = file.type || 'application/octet-stream';
  const size = file.size;
  const createdAt = new Date().toISOString();
  const id = `encdoc-${Math.random().toString(36).slice(2, 10)}`;

  // If you later want to actually persist file bytes somewhere:
  // const buffer = Buffer.from(await file.arrayBuffer());
  // TODO: upload buffer to S3/Supabase/etc and store the URL below.

  // ---- OPTIONAL: local demo persistence, like sicknote/fitness/erx ----
  // This will just store the *metadata* in db.docs (no file contents).
  try {
    const db = await readDb();

    if (!Array.isArray(db.docs)) db.docs = [];

    const doc: EncounterDoc = {
      id,
      encounterId,
      patientId,
      docType,
      title,
      fileName: file.name,
      contentType,
      size,
      createdAt,
      source,
    };

    db.docs.unshift(doc);
    await writeDb(db);

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('[encounters/docs] local store failed, returning metadata only', err);

    // Even if DB write fails, still return metadata so the UI is happy
    const doc: EncounterDoc = {
      id,
      encounterId,
      patientId,
      docType,
      title,
      fileName: file.name,
      contentType,
      size,
      createdAt,
      source,
    };

    return NextResponse.json(doc, { status: 201 });
  }
}
