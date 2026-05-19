import { NextRequest } from 'next/server';
import { jsonErr, jsonOk, mapLadyDoc, resolveLadyPatientContext, tagToEnum } from '@/app/api/lady-center/_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const rows = await ctx.prisma.ladyCenterDocument.findMany({
    where: { patientId: ctx.patientId },
    orderBy: { createdAt: 'desc' },
  });

  return jsonOk({ items: rows.map(mapLadyDoc) });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const body = await req.json().catch(() => null);
  const doc = body?.doc;

  if (!doc?.title) return jsonErr('Missing document title.', 400, 'missing_title');

  const row = await ctx.prisma.ladyCenterDocument.create({
    data: {
      patientId: ctx.patientId,
      id: doc.id || undefined,
      title: doc.title,
      tag: tagToEnum(doc.tag),
      fileName: doc.fileName || null,
      createdISO: doc.createdISO ? new Date(doc.createdISO) : new Date(),
    },
  });

  return jsonOk({ item: mapLadyDoc(row) }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const body = await req.json().catch(() => null);
  const id = body?.id;

  if (!id) return jsonErr('Missing document id.', 400, 'missing_id');

  await ctx.prisma.ladyCenterDocument.deleteMany({
    where: {
      id,
      patientId: ctx.patientId,
    },
  });

  return jsonOk({ id });
}