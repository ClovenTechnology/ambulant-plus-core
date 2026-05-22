import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, pharmacyIdForStaff, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  const raw = clean(value, 20).toLowerCase();
  if (['true', '1', 'yes', 'y', 'generic', 'active'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'brand', 'original', 'inactive'].includes(raw)) return false;
  return fallback;
}

function asPriceCents(value: unknown): number {
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

function parseCsv(text: string) {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return [];
  const headers = splitCsvLine(rows[0]).map((h) => h.trim().toLowerCase());
  const hasHeader = headers.some((h) => ['name', 'drugcode', 'drug_code', 'price', 'pricecents', 'price_cents'].includes(h));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const fallbackHeaders = ['drugcode', 'name', 'pricecents', 'currency', 'isgeneric', 'isactive'];
  const keys = hasHeader ? headers : fallbackHeaders;
  return dataRows.map((line, index) => {
    const cells = splitCsvLine(line);
    const row: any = { _line: hasHeader ? index + 2 : index + 1 };
    keys.forEach((key, i) => { row[key] = cells[i] ?? ''; });
    return row;
  });
}

async function resolvePharmacyId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  const orgId = orgIdFromHeaders(req.headers);
  const explicit = clean(req.nextUrl.searchParams.get('pharmacyId'), 120);
  if (who.role === 'admin' && explicit) return explicit;
  if (who.role === 'pharmacy' && who.uid) return String(who.uid);
  if (who.role === 'pharmacy_staff' && who.uid) return await pharmacyIdForStaff(orgId, who.uid);
  return null;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

function normalizeRow(row: any, pharmacyCurrency: string) {
  const name = clean(row.name ?? row.displayname ?? row.drugname ?? row.medication ?? row.label, 500);
  const drugCode = clean(row.drugcode ?? row.drug_code ?? row.code ?? row.nappi ?? row.nappicode ?? row.rxnorm, 120) || null;
  const priceCents = asPriceCents(row.pricecents ?? row.price_cents ?? row.price ?? row.unitprice ?? row.unit_price);
  const currency = clean(row.currency, 10).toUpperCase() || pharmacyCurrency || 'ZAR';
  return {
    name,
    drugCode,
    priceCents,
    currency,
    isGeneric: asBool(row.isgeneric ?? row.is_generic ?? row.generic, false),
    isActive: asBool(row.isactive ?? row.is_active ?? row.active, true),
  };
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);
    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved' }, 409);
    const pharmacy = await (prisma as any).pharmacyPartner.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) return json({ ok: false, error: 'pharmacy_not_found' }, 404);

    const body = await req.json().catch(() => ({}));
    const rowsRaw = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.rows)
        ? body.rows
        : parseCsv(clean(body?.csv ?? body?.text, 200_000));

    if (!rowsRaw.length) return json({ ok: false, error: 'no_inventory_rows' }, 400);

    const errors: any[] = [];
    const valid: any[] = [];

    rowsRaw.slice(0, 1000).forEach((row: any, index: number) => {
      const normalized = normalizeRow(row, pharmacy.currency || 'ZAR');
      const line = row?._line ?? index + 1;
      if (!normalized.name) {
        errors.push({ line, error: 'name_required' });
        return;
      }
      if (!normalized.priceCents) {
        errors.push({ line, error: 'valid_price_required', name: normalized.name });
        return;
      }
      if (pharmacy.currency && normalized.currency !== pharmacy.currency) {
        errors.push({ line, error: 'currency_must_match_pharmacy_currency', name: normalized.name, pharmacyCurrency: pharmacy.currency });
        return;
      }
      valid.push({
        orgId,
        pharmacyId,
        name: normalized.name,
        drugCode: normalized.drugCode,
        priceCents: normalized.priceCents,
        currency: normalized.currency,
        isGeneric: normalized.isGeneric,
        isActive: normalized.isActive,
      });
    });

    if (!valid.length) return json({ ok: false, error: 'no_valid_rows', errors }, 400);
    const result = await (prisma as any).carePortPharmacySku.createMany({ data: valid, skipDuplicates: true });
    await (prisma as any).auditEvent.create({
      data: {
        kind: 'careport_inventory_imported',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: pharmacyId,
        meta: { orgId, pharmacyId, submitted: rowsRaw.length, valid: valid.length, created: result?.count ?? null, errorCount: errors.length },
      },
    }).catch(() => null);

    return json({ ok: true, submitted: rowsRaw.length, valid: valid.length, created: result?.count ?? valid.length, errors });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'inventory_import_failed' }, error?.status || 500);
  }
}
