// apps/api-gateway/src/insightcore/syndromeHeatmap.ts
import { prisma } from '@/src/lib/db';

export type InsightCoreConfig = {
  country?: string;
  region?: string;
  district?: string;
  postalCode?: string;
  syndrome?: string;
  ageBand?: string;
  gender?: string;
  [key: string]: any;
};

export type SyndromeHeatmapRow = {
  country?: string | null;
  region?: string | null;
  district?: string | null;
  postalCode?: string | null;
  syndrome: string;
  ageBand?: string | null;
  gender?: string | null;
  count: number;
  from: string;
  to: string;
};

function asDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const d = new Date(String(value ?? ''));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function parseJsonObject(raw: unknown): Record<string, any> {
  if (!raw) return {};

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, any>;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function normaliseSyndrome(value: unknown) {
  const s = String(value ?? '').trim().toLowerCase();
  return s || 'unknown';
}

function ageBandFromAge(age: unknown): string | null {
  const n = Number(age);

  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 5) return '0-4';
  if (n < 18) return '5-17';
  if (n < 45) return '18-44';
  if (n < 65) return '45-64';

  return '65+';
}

function getRowKey(row: SyndromeHeatmapRow) {
  return [
    row.country || '',
    row.region || '',
    row.district || '',
    row.postalCode || '',
    row.syndrome || '',
    row.ageBand || '',
    row.gender || '',
  ].join('|');
}

function applyConfigFilter(rows: SyndromeHeatmapRow[], config?: InsightCoreConfig) {
  if (!config) return rows;

  return rows.filter((row) => {
    if (config.country && row.country !== config.country) return false;
    if (config.region && row.region !== config.region) return false;
    if (config.district && row.district !== config.district) return false;
    if (config.postalCode && row.postalCode !== config.postalCode) return false;
    if (config.syndrome && row.syndrome !== config.syndrome) return false;
    if (config.ageBand && row.ageBand !== config.ageBand) return false;
    if (config.gender && row.gender !== config.gender) return false;

    return true;
  });
}

async function computeSyndromeHeatmapForRange(
  from: Date,
  to: Date,
): Promise<SyndromeHeatmapRow[]> {
  const rowsByKey = new Map<string, SyndromeHeatmapRow>();

  /*
   * Prefer runtimeEvent because InsightCore/feedback/alerts routes already use it.
   * Keep this dynamic so deployment does not depend on a specific analytics table.
   */
  const runtimeEventDelegate = (prisma as any).runtimeEvent;

  if (!runtimeEventDelegate?.findMany) {
    return [];
  }

  const events = await runtimeEventDelegate
    .findMany({
      where: {
        kind: {
          in: [
            'insight.syndrome',
            'syndrome',
            'syndromic_signal',
            'clinical.syndrome',
            'triage.syndrome',
          ],
        },
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      select: {
        payload: true,
        createdAt: true,
      },
      take: 5000,
      orderBy: {
        createdAt: 'desc',
      },
    })
    .catch(() => []);

  for (const event of events) {
    const payload = parseJsonObject(event.payload);

    const syndrome = normaliseSyndrome(
      payload.syndrome ??
        payload.syndromeGroup ??
        payload.category ??
        payload.label,
    );

    const row: SyndromeHeatmapRow = {
      country: payload.country ? String(payload.country) : null,
      region: payload.region ?? payload.province
        ? String(payload.region ?? payload.province)
        : null,
      district: payload.district ?? payload.city
        ? String(payload.district ?? payload.city)
        : null,
      postalCode: payload.postalCode ?? payload.postcode
        ? String(payload.postalCode ?? payload.postcode)
        : null,
      syndrome,
      ageBand: payload.ageBand ? String(payload.ageBand) : ageBandFromAge(payload.age),
      gender: payload.gender ? String(payload.gender).toLowerCase() : null,
      count: 0,
      from: from.toISOString(),
      to: to.toISOString(),
    };

    const key = getRowKey(row);
    const existing = rowsByKey.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      rowsByKey.set(key, {
        ...row,
        count: 1,
      });
    }
  }

  return Array.from(rowsByKey.values()).sort((a, b) => b.count - a.count);
}

export async function buildSyndromicHeatmap(args: {
  from: Date;
  to: Date;
  config?: InsightCoreConfig;
}) {
  const from = asDate(args.from);
  const to = asDate(args.to);

  const rows = await computeSyndromeHeatmapForRange(from, to);

  return applyConfigFilter(rows, args.config);
}

export async function buildSyndromeHeatmap(args: {
  from: Date;
  to: Date;
  config?: InsightCoreConfig;
}) {
  return buildSyndromicHeatmap(args);
}