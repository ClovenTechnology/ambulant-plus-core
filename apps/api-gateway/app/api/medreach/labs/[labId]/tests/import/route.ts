import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}

function asBool(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  const raw = clean(value, 20).toLowerCase();
  if (['true', '1', 'yes', 'y', 'active', 'cold', 'coldchain'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'inactive', 'ambient'].includes(raw)) return false;
  return fallback;
}

function asInt(value: unknown, fallback = 0, min = 0, max = 1000000) {
  const n = Number(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function asFloat(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function asPriceCents(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = clean(value, 40).replace(/[^0-9.\-]/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return raw.includes('.') ? Math.max(0, Math.round(n * 100)) : Math.max(0, Math.round(n));
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && quoted && next === '"') {
      cur += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      quoted = !quoted;
      continue;
    }

    if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function normalizeHeader(value: string) {
  return clean(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseCsv(text: string) {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return [];

  const headers = splitCsvLine(rows[0]).map(normalizeHeader);
  const dataRows = rows.slice(1);

  return dataRows.map((line, index) => {
    const cells = splitCsvLine(line);
    const row: any = { _line: index + 2 };

    headers.forEach((key, i) => {
      row[key] = cells[i] ?? '';
    });

    return row;
  });
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const s = clean(value, 500);
    if (s) return s;
  }
  return '';
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function canImport(role: string) {
  return ['admin', 'lab', 'lab_staff'].includes(role);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

function normalizeRow(row: any, labCurrency: string) {
  const localCode = firstString(row.localcode, row.providercode, row.yanwidecode, row.testcode, row.code);
  const localName = firstString(row.localname, row.testname, row.name, row.displayname, row.label);
  const catalogCode = firstString(row.catalogcode, row.globalcode, row.mastercode, row.testcatalogcode);
  const loincCode = firstString(row.loinccode, row.loinc);
  const category = firstString(row.category, row.department, row.discipline) || 'General';
  const specimenType = firstString(row.specimentype, row.specimen) || 'Blood';
  const containerType = firstString(row.containertype, row.container) || null;
  const priceCents = asPriceCents(row.pricecents ?? row.price);
  const turnaroundHours = asInt(row.turnaroundhours ?? row.tat ?? row.tathours, 24, 1, 24 * 21);
  const requiresColdChain = asBool(row.requirescoldchain ?? row.coldchain, false);
  const requiredTempMinC = asFloat(row.requiredtempminc ?? row.tempminc);
  const requiredTempMaxC = asFloat(row.requiredtempmaxc ?? row.tempmaxc);
  const prepNotes = firstString(row.prepnotes, row.instructions, row.notes) || null;
  const active = asBool(row.active ?? row.isactive, true);
  const currency = clean(row.currency, 10).toUpperCase() || labCurrency || 'ZAR';

  return {
    localCode,
    localName,
    catalogCode: catalogCode || localCode || localName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 40),
    loincCode: loincCode || null,
    category,
    specimenType,
    containerType,
    priceCents,
    turnaroundHours,
    requiresColdChain,
    requiredTempMinC,
    requiredTempMaxC,
    prepNotes,
    active,
    currency,
  };
}

export async function POST(req: NextRequest, { params }: { params: { labId: string } }) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  try {
    if (!canImport(role)) return json({ ok: false, error: 'forbidden' }, 403);

    const labId = clean(params.labId, 120);
    if (!labId) return json({ ok: false, error: 'labId_required' }, 400);

    const lab = await (prisma as any).labPartner.findUnique({ where: { id: labId } });
    if (!lab) return json({ ok: false, error: 'lab_not_found' }, 404);
    if (lab.active === false) return json({ ok: false, error: 'lab_inactive' }, 409);

    if (role === 'lab' && who.uid && String(who.uid) !== labId && String(lab.ownerUserId || '') !== String(who.uid)) {
      return json({ ok: false, error: 'lab_access_denied' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const rowsRaw = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.rows)
        ? body.rows
        : parseCsv(clean(body?.csv ?? body?.text, 500_000));

    if (!rowsRaw.length) return json({ ok: false, error: 'no_lab_test_rows' }, 400);

    const errors: any[] = [];
    const valid: any[] = [];
    const seen = new Set<string>();

    rowsRaw.slice(0, 1000).forEach((row: any, index: number) => {
      const line = row?._line ?? index + 1;
      const normalized = normalizeRow(row, lab.currency || 'ZAR');

      if (!normalized.localName) {
        errors.push({ line, error: 'localName_required' });
        return;
      }

      if (!normalized.localCode) {
        errors.push({ line, error: 'localCode_required', localName: normalized.localName });
        return;
      }

      if (!normalized.priceCents) {
        errors.push({ line, error: 'valid_price_required', localName: normalized.localName });
        return;
      }

      if (lab.currency && normalized.currency !== lab.currency) {
        errors.push({ line, error: 'currency_must_match_lab_currency', localName: normalized.localName, labCurrency: lab.currency });
        return;
      }

      const key = normalized.localCode.toLowerCase();
      if (seen.has(key)) {
        errors.push({ line, error: 'duplicate_row_in_upload', localCode: normalized.localCode });
        return;
      }

      seen.add(key);
      valid.push({ line, ...normalized });
    });

    if (!valid.length) return json({ ok: false, error: 'no_valid_rows', errors }, 400);

    let catalogUpserted = 0;
    let offeredCreated = 0;
    let offeredUpdated = 0;

    await (prisma as any).$transaction(async (tx: any) => {
      for (const row of valid) {
        const catalog = await tx.medReachTestCatalog.upsert({
          where: { code: row.catalogCode },
          update: {
            name: row.localName,
            category: row.category,
            loincCode: row.loincCode,
            specimenTypeDefault: row.specimenType,
            containerTypeDefault: row.containerType,
            requiresColdChainDefault: row.requiresColdChain,
            requiredTempMinCDefault: row.requiredTempMinC,
            requiredTempMaxCDefault: row.requiredTempMaxC,
            prepNotes: row.prepNotes,
            active: true,
          },
          create: {
            code: row.catalogCode,
            name: row.localName,
            category: row.category,
            loincCode: row.loincCode,
            specimenTypeDefault: row.specimenType,
            containerTypeDefault: row.containerType,
            requiresColdChainDefault: row.requiresColdChain,
            requiredTempMinCDefault: row.requiredTempMinC,
            requiredTempMaxCDefault: row.requiredTempMaxC,
            prepNotes: row.prepNotes,
            active: true,
          },
        });

        catalogUpserted += 1;

        const existing = await tx.medReachLabOfferedTest.findFirst({
          where: { labId, localCode: row.localCode },
        });

        const data = {
          labId,
          catalogTestId: catalog.id,
          localCode: row.localCode,
          localName: row.localName,
          active: row.active,
          priceCents: row.priceCents,
          currency: row.currency,
          turnaroundHours: row.turnaroundHours,
          specimenType: row.specimenType,
          containerType: row.containerType,
          requiresColdChain: row.requiresColdChain,
          requiredTempMinC: row.requiredTempMinC,
          requiredTempMaxC: row.requiredTempMaxC,
          prepNotes: row.prepNotes,
          availabilityMeta: {
            source: 'lab_csv_import',
            providerCode: row.localCode,
            catalogCode: row.catalogCode,
            loincCode: row.loincCode,
          },
        };

        if (existing) {
          await tx.medReachLabOfferedTest.update({ where: { id: existing.id }, data });
          offeredUpdated += 1;
        } else {
          await tx.medReachLabOfferedTest.create({ data });
          offeredCreated += 1;
        }
      }

      await tx.auditEvent.create({
        data: {
          kind: 'medreach_lab_tests_imported',
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
          subjectId: labId,
          meta: {
            labId,
            submitted: rowsRaw.length,
            valid: valid.length,
            catalogUpserted,
            offeredCreated,
            offeredUpdated,
            errorCount: errors.length,
            source: clean(body?.source, 80) || 'provider_csv',
          },
        },
      });
    });

    return json({
      ok: true,
      submitted: rowsRaw.length,
      valid: valid.length,
      catalogUpserted,
      offeredCreated,
      offeredUpdated,
      errors,
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'lab_tests_import_failed' }, error?.status || 500);
  }
}
