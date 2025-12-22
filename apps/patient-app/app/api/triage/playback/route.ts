// apps/patient-app/app/api/triage/playback/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// If ALLOW_PLAYBACK not set to '1', refuse access (dev/demo only)
const allow = (process.env.ALLOW_PLAYBACK === '1' || process.env.NODE_ENV !== 'production');

if (!allow) {
  // We still export GET but it will return 403 by runtime check inside handler.
}

type Vital = { key: string; label?: string; value: number | string; unit?: string; min?: number; max?: number; trend?: number[] };
type Scenario = { id: string; title: string; summary?: string; tags: string[]; ageGroup?: 'pediatric' | 'adult' | 'elderly'; severityHint?: 'low' | 'medium' | 'high'; vitals: Vital[]; symptoms: Record<string, boolean>; meta?: any; demoSteps?: string[] };

const scenarios: Scenario[] = [
  // ... (use your existing scenarios array exactly as before)
  // For brevity here we assume you paste the same scenarios you already have.
];

export async function GET(request: Request) {
  // Deny access if playback disabled
  if (!allow) {
    return NextResponse.json({ error: 'playback disabled' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const tag = url.searchParams.get('tag');
    const age = url.searchParams.get('age');
    const q = url.searchParams.get('q')?.toLowerCase();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const per = Math.min(50, Math.max(5, parseInt(url.searchParams.get('per') || '10', 10)));

    if (id) {
      const found = scenarios.find((s) => s.id === id);
      if (!found) return NextResponse.json({ error: 'scenario not found' }, { status: 404 });
      return NextResponse.json({ scenario: found });
    }

    let list = scenarios.slice();
    if (tag) list = list.filter((s) => s.tags.includes(tag));
    if (age && ['pediatric', 'adult', 'elderly'].includes(age)) list = list.filter((s) => s.ageGroup === age);
    if (q) list = list.filter((s) => (s.title + ' ' + (s.summary || '') + ' ' + s.tags.join(' ')).toLowerCase().includes(q));

    const total = list.length;
    const start = (page - 1) * per;
    const paged = list.slice(start, start + per).map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary,
      tags: s.tags,
      ageGroup: s.ageGroup,
      severityHint: s.severityHint,
    }));

    return NextResponse.json({ count: total, page, per, scenarios: paged });
  } catch (err) {
    console.error('playback GET error', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
