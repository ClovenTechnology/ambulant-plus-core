// apps/clinician-app/app/api/encounters/[id]/docs/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readDb } from '../../../../erx/_lib_db_compat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');

type EncounterDoc = {
  id: string;
  encounterId: string;
  patientId: string | null;
  docType: string;
  title: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  source: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const encounterId = params.id;
  if (!encounterId) {
    return NextResponse.json(
      { error: 'encounterId is required in the URL' },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const patientIdFilter = searchParams.get('patientId');
  const docTypeFilter = searchParams.get('docType');

  // If there is an API gateway, try that first
  if (GW) {
    try {
      const gwUrl = new URL(
        `${GW}/api/encounters/${encodeURIComponent(encounterId)}/docs`,
      );
      if (patientIdFilter) gwUrl.searchParams.set('patientId', patientIdFilter);
      if (docTypeFilter) gwUrl.searchParams.set('docType', docTypeFilter);

      const r = await fetch(gwUrl.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
      });

      if (r.ok) {
        const json = await r.json().catch(() => ({}));
        // pass-through whatever the gateway returns (ideally { items: [...] })
        return NextResponse.json(json, { status: r.status });
      }

      console.warn(
        '[encounters/docs/list] GW upstream non-OK, falling back to local store',
        r.status,
      );
    } catch (err) {
      console.error(
        '[encounters/docs/list] GW upstream error, falling back to local store',
        err,
      );
    }
  }

  // ---- local fallback: read from db.docs ----
  try {
    const db = await readDb();
    const docs: EncounterDoc[] = Array.isArray(db.docs) ? db.docs : [];

    let filtered = docs.filter((d) => d.encounterId === encounterId);

    if (patientIdFilter) {
      filtered = filtered.filter((d) => d.patientId === patientIdFilter);
    }
    if (docTypeFilter) {
      const wanted = docTypeFilter.toLowerCase();
      filtered = filtered.filter(
        (d) => d.docType && d.docType.toLowerCase() === wanted,
      );
    }

    // Sort newest first
    filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json(
      {
        items: filtered,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[encounters/docs/list] local readDb failed', err);
    return NextResponse.json(
      { items: [], error: 'Failed to load docs from local store' },
      { status: 500 },
    );
  }
}
