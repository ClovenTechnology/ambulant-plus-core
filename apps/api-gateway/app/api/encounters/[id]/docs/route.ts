import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeDocType(value: string) {
  const raw = clean(value, 80).toLowerCase();
  if (!raw) return 'other';

  if (raw === 'erx' || raw === 'prescription') return 'prescription';
  if (raw === 'sick-note' || raw === 'sicknote') return 'clinical-note';
  if (raw === 'fitness-note' || raw === 'fitness' || raw === 'fitness-certificate') return 'clinical-note';
  if (raw === 'lab' || raw === 'lab-report') return 'lab-report';
  if (raw === 'imaging' || raw === 'imaging-report') return 'imaging-report';
  if (raw === 'referral') return 'referral';
  if (raw === 'clinical-note' || raw === 'note') return 'clinical-note';

  return raw;
}

function outwardDocType(kind: string) {
  const raw = clean(kind, 80).toLowerCase();
  if (!raw) return 'other';

  if (raw === 'prescription') return 'erx';
  if (raw === 'clinical-note') return 'note';
  return raw;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const who = readIdentity(req.headers);

    if (!who?.uid) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 },
      );
    }

    const encounterId = clean(params.id, 120);
    if (!encounterId) {
      return NextResponse.json(
        { ok: false, error: 'encounter_id_required' },
        { status: 400 },
      );
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      select: {
        id: true,
        patientId: true,
        clinicianId: true,
      },
    });

    if (!encounter) {
      return NextResponse.json(
        { ok: false, error: 'encounter_not_found' },
        { status: 404 },
      );
    }

    if (
      who.role === 'clinician' &&
      encounter.clinicianId &&
      encounter.clinicianId !== who.uid
    ) {
      return NextResponse.json(
        { ok: false, error: 'forbidden' },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const patientIdFilter = clean(url.searchParams.get('patientId'), 120);
    const docTypeFilter = normalizeDocType(clean(url.searchParams.get('docType'), 80));

    const rows = await prisma.patientDocument.findMany({
      where: {
        encounterId,
        ...(patientIdFilter ? { patientId: patientIdFilter } : {}),
        ...(docTypeFilter && docTypeFilter !== 'other'
          ? { documentKind: docTypeFilter }
          : {}),
        status: {
          not: 'DELETED',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const items = rows.map((d) => ({
      id: d.id,
      encounterId: d.encounterId,
      patientId: d.patientId,
      docType: outwardDocType(d.documentKind),
      title: d.title,
      fileName: d.fileName || d.title,
      contentType: d.mimeType || 'application/octet-stream',
      size: d.sizeBytes ?? 0,
      createdAt: d.createdAt.toISOString(),
      source: d.sourceApp || d.sourceType || 'api-gateway',
      documentKind: d.documentKind,
      fileKey: d.fileKey,
      downloadUrl: null,
      linkedRecordType: d.linkedRecordType,
      linkedRecordId: d.linkedRecordId,
    }));

    return NextResponse.json(
      { ok: true, items },
      {
        headers: {
          'Cache-Control': 'no-store',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch (err: any) {
    console.error('[api-gateway][encounters/:id/docs][GET] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'encounter_docs_list_failed') },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const who = readIdentity(req.headers);

    if (!who?.uid) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 },
      );
    }

    if (who.role !== 'clinician' && who.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'forbidden' },
        { status: 403 },
      );
    }

    const encounterId = clean(params.id, 120);
    if (!encounterId) {
      return NextResponse.json(
        { ok: false, error: 'encounter_id_required' },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'invalid_json_body' },
        { status: 400 },
      );
    }

    const patientId = clean(body.patientId, 120);
    const docType = normalizeDocType(clean(body.docType, 80));
    const title = clean(body.title, 240) || clean(body.fileName, 240) || 'Encounter document';
    const fileName = clean(body.fileName, 240) || null;
    const mimeType = clean(body.contentType, 120) || 'application/octet-stream';
    const sizeBytes =
      typeof body.size === 'number' && Number.isFinite(body.size)
        ? body.size
        : typeof body.sizeBytes === 'number' && Number.isFinite(body.sizeBytes)
          ? body.sizeBytes
          : null;
    const fileKey = clean(body.fileKey, 500);
    const source = clean(body.source, 120) || 'clinician-app';

    if (!patientId) {
      return NextResponse.json(
        { ok: false, error: 'patient_id_required' },
        { status: 400 },
      );
    }

    if (!fileKey) {
      return NextResponse.json(
        { ok: false, error: 'file_key_required' },
        { status: 400 },
      );
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      select: {
        id: true,
        patientId: true,
        clinicianId: true,
      },
    });

    if (!encounter) {
      return NextResponse.json(
        { ok: false, error: 'encounter_not_found' },
        { status: 404 },
      );
    }

    if (encounter.patientId && encounter.patientId !== patientId) {
      return NextResponse.json(
        { ok: false, error: 'patient_encounter_mismatch' },
        { status: 400 },
      );
    }

    if (
      who.role === 'clinician' &&
      encounter.clinicianId &&
      encounter.clinicianId !== who.uid
    ) {
      return NextResponse.json(
        { ok: false, error: 'forbidden' },
        { status: 403 },
      );
    }

    const created = await prisma.patientDocument.create({
      data: {
        patientId,
        encounterId,
        title,
        documentKind: docType,
        sourceApp: 'clinician-app',
        sourceType: source,
        fileKey,
        fileName,
        mimeType,
        sizeBytes,
        status: 'READY',
        linkedRecordType: 'encounter',
        linkedRecordId: encounterId,
        notes: null,
        createdByUserId: who.uid,
        createdByRole: who.role,
        relationshipId: null,
      },
    });

    await prisma.auditEvent.create({
      data: {
        kind: 'encounter_document_uploaded',
        actorId: who.uid,
        actorRole: who.role,
        subjectId: created.id,
        meta: {
          encounterId,
          patientId,
          documentKind: docType,
          fileName,
          mimeType,
          sizeBytes,
        },
      },
    }).catch(() => null);

    return NextResponse.json(
      {
        ok: true,
        item: {
          id: created.id,
          encounterId: created.encounterId,
          patientId: created.patientId,
          docType: outwardDocType(created.documentKind),
          title: created.title,
          fileName: created.fileName || created.title,
          contentType: created.mimeType || 'application/octet-stream',
          size: created.sizeBytes ?? 0,
          createdAt: created.createdAt.toISOString(),
          source: created.sourceApp || created.sourceType || 'clinician-app',
          documentKind: created.documentKind,
          fileKey: created.fileKey,
        },
      },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch (err: any) {
    console.error('[api-gateway][encounters/:id/docs][POST] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'encounter_doc_create_failed') },
      { status: 500 },
    );
  }
}