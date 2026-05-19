import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScreeningItem = {
  key: string;
  title: string;
  status: 'due' | 'ok' | 'overdue' | 'unknown';
  nextDueISO?: string | null;
};

type DocItem = {
  id: string;
  title: string;
  tag: string;
  createdISO: string;
};

function buildInsights(body: any) {
  const mode = String(body.mode || 'cycle');
  const prediction = body.prediction || {};
  const pregnancy = body.pregnancy || {};
  const screeningItems: ScreeningItem[] = Array.isArray(body.screeningItems) ? body.screeningItems : [];
  const docs: DocItem[] = Array.isArray(body.documents) ? body.documents : [];

  const insights: Array<{
    id: string;
    tone: 'info' | 'good' | 'attention';
    title: string;
    summary: string;
    why?: string;
    next?: string;
    source?: string;
  }> = [];

  const overdue = screeningItems.filter((x) => x.status === 'overdue');
  const unknown = screeningItems.filter((x) => x.status === 'unknown');

  if (mode === 'cycle') {
    if (prediction?.irregular) {
      insights.push({
        id: 'cycle-irregular-pattern',
        tone: 'attention',
        title: 'Cycle pattern looks more variable than usual',
        summary: 'Recent cycle timing appears less predictable, so a calmer watch-and-review plan is better than assuming one fixed rhythm.',
        why: 'Your current cycle signals suggest variability rather than a single stable pattern.',
        next: 'Keep logging for consistency and consider clinician review if the pattern remains irregular.',
        source: 'lady_center_gateway_adapter',
      });
    } else {
      insights.push({
        id: 'cycle-stable-pattern',
        tone: 'good',
        title: 'Cycle timing looks reasonably explainable',
        summary: 'Your current pattern looks stable enough to support planning and self-tracking.',
        why: 'Prediction confidence is supported by your current context and logs.',
        next: 'Keep logging cycle changes and symptoms to maintain accuracy.',
        source: 'lady_center_gateway_adapter',
      });
    }

    if (prediction?.fertileStart && prediction?.fertileEnd) {
      insights.push({
        id: 'cycle-fertile-window',
        tone: 'info',
        title: 'Timing window is available',
        summary: `Your current timing window is estimated from ${prediction.fertileStart} to ${prediction.fertileEnd}.`,
        why: 'The estimate is based on your cycle context and logged patterns.',
        next: 'Use this as planning guidance, not certainty.',
        source: 'lady_center_gateway_adapter',
      });
    }
  }

  if (pregnancy?.status === 'confirmed') {
    insights.push({
      id: 'pregnancy-confirmed',
      tone: 'good',
      title: 'Pregnancy mode should move into antenatal support',
      summary: 'This looks strong enough to shift from cycle monitoring into antenatal planning and guided check-ins.',
      why: 'Pregnancy-confirmed context should change the kind of support you receive.',
      next: 'Open the Antenatal Center and begin trimester-aware support.',
      source: 'lady_center_gateway_adapter',
    });
  } else if (pregnancy?.status === 'likely') {
    insights.push({
      id: 'pregnancy-likely',
      tone: 'attention',
      title: 'Possible early pregnancy signal',
      summary: 'A possible pregnancy pattern is present, so confirmation and gentle next-step guidance matter more than over-interpretation.',
      why: Array.isArray(pregnancy?.reasons) ? pregnancy.reasons.join(' • ') : 'Signal pattern suggests possible pregnancy.',
      next: 'Log any test result and book review if you feel unsure or symptoms change.',
      source: 'lady_center_gateway_adapter',
    });
  }

  if (overdue.length > 0) {
    insights.push({
      id: 'screening-priority',
      tone: 'attention',
      title: 'A preventive check may need attention',
      summary: `${overdue.length} screening item${overdue.length === 1 ? '' : 's'} look overdue or worth reviewing now.`,
      why: 'Preventive care matters more when timing slips quietly.',
      next: 'Prioritize the top overdue item first rather than trying to do everything at once.',
      source: 'lady_center_gateway_adapter',
    });
  } else if (unknown.length > 0) {
    insights.push({
      id: 'screening-unknown',
      tone: 'info',
      title: 'Some screening history is not yet set',
      summary: 'A few preventive items do not yet have a clear completion history.',
      why: 'Clear screening history improves care planning and reminders.',
      next: 'Mark completed items and schedule reminders for the rest.',
      source: 'lady_center_gateway_adapter',
    });
  }

  if (docs.length === 0) {
    insights.push({
      id: 'docs-empty',
      tone: 'info',
      title: 'Your health folder is still light',
      summary: 'Keeping results, scans, and clinician notes in one place makes future reviews much easier.',
      why: 'Documents become more useful over time when combined with trends and logs.',
      next: 'Upload recent labs, imaging, or clinician notes if you have them.',
      source: 'lady_center_gateway_adapter',
    });
  }

  return insights.slice(0, 5);
}

function prioritizeScreening(body: any): string[] {
  const items: ScreeningItem[] = Array.isArray(body.screeningItems) ? body.screeningItems : [];
  const mode = String(body.mode || 'cycle');

  const scored = items.map((x) => {
    let score = 0;
    if (x.status === 'overdue') score += 100;
    if (x.status === 'unknown') score += 60;
    if (x.status === 'due') score += 40;

    if (mode === 'pregnancy' && x.key === 'prenatal_labs') score += 30;
    if ((mode === 'cycle' || mode === 'symptoms') && x.key === 'pap') score += 20;
    if (mode === 'sexual_health' && x.key === 'sti') score += 20;

    return { key: x.key, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((x) => x.key);
}

function buildTodaySummary(body: any) {
  const mode = String(body.mode || 'cycle');
  const prediction = body.prediction || {};
  const pregnancy = body.pregnancy || {};

  if (pregnancy?.status === 'confirmed') {
    return {
      subtitle: 'Antenatal-style support is now the calmer next step.',
      primary: { k: 'Focus', v: 'Early pregnancy support' },
      secondary: [
        { k: 'Next step', v: 'Open Antenatal Center' },
        { k: 'Priority', v: 'Hydration, rest, and guided review' },
      ],
      badge: 'Pregnancy-aware',
    };
  }

  if (pregnancy?.status === 'likely') {
    return {
      subtitle: 'Possible pregnancy signals are present, so confirmation matters more than guessing.',
      primary: { k: 'Focus', v: 'Confirm and monitor' },
      secondary: [
        { k: 'Next step', v: 'Log test result or review with a clinician' },
        { k: 'Approach', v: 'Calm monitoring, not panic' },
      ],
      badge: 'Watch closely',
    };
  }

  if (mode === 'cycle' && prediction?.irregular) {
    return {
      subtitle: 'Recent patterns look more variable, so trend-aware guidance matters today.',
      primary: { k: 'Cycle pattern', v: 'More variable than usual' },
      secondary: [
        { k: 'Approach', v: 'Track consistently and compare trends' },
        { k: 'Care option', v: 'Review if irregularity persists' },
      ],
      badge: 'Trend-aware',
    };
  }

  if (mode === 'menopause') {
    return {
      subtitle: 'A calm symptom-and-trigger view is more useful than trying to track everything at once.',
      primary: { k: 'Focus', v: 'Comfort, sleep, and triggers' },
      secondary: [
        { k: 'Approach', v: 'Track a small number of repeated symptoms' },
        { k: 'Care option', v: 'Review if quality of life is affected' },
      ],
      badge: 'Comfort-first',
    };
  }

  return {
    subtitle: 'InsightCore reviewed your current reproductive-health context and highlighted the most useful next steps.',
    primary: { k: 'Focus', v: 'Context-aware tracking' },
    secondary: [
      { k: 'Approach', v: 'Use trends, not one-off readings' },
      { k: 'Care option', v: 'Escalate if symptoms change or persist' },
    ],
    badge: 'InsightCore',
  };
}

function buildCarePathGuidance(body: any) {
  const mode = String(body.mode || 'cycle');
  const pregnancy = body.pregnancy || {};

  const base: Record<string, string> = {
    period_pain:
      'Track severity and timing, then use the care path to decide whether this looks like something to monitor or review.',
    irregular:
      'Irregular timing benefits from consistency first, then clinician review if the pattern stays unstable.',
    fertility:
      'Use the fertility path to focus on timing, logs, and the next best clinician or lab step.',
    pregnancy:
      'Move from cycle interpretation to antenatal support and avoid over-relying on prediction language.',
    menopause:
      'Focus on the symptom that affects you most and build a simpler comfort plan around it.',
    sexual_health:
      'Use a discreet path that balances privacy, screening, and the right clinician route.',
  };

  if (pregnancy?.status === 'confirmed') {
    base.pregnancy =
      'This path should now hand off into antenatal support rather than remain purely in cycle guidance.';
  }

  if (mode === 'pregnancy') {
    base.pregnancy =
      'Pregnancy support should emphasize week-by-week check-ins, logs, hydration, and clinician follow-up when needed.';
  }

  return base;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const requestId = crypto.randomUUID();

  const prioritizedScreeningKeys = prioritizeScreening(body);
  const insights = buildInsights(body);

  const docs: DocItem[] = Array.isArray(body.documents) ? body.documents : [];
  const documentSuggestion =
    docs.length === 0
      ? 'Upload a recent result, scan, or clinician note to make future summaries stronger.'
      : docs.some((d) => String(d.tag).toLowerCase() === 'labs')
      ? 'Your document folder already has useful material. Next step: summarize or share the most relevant item when needed.'
      : 'Consider adding a recent lab or imaging result so your folder reflects the most useful context.';

  return NextResponse.json({
    requestId,
    generatedAt: new Date().toISOString(),
    degradedMode: false,
    source: 'hybrid',
    todaySummary: buildTodaySummary(body),
    insights,
    prioritizedScreeningKeys,
    screeningNote:
      prioritizedScreeningKeys.length > 0
        ? 'The checklist below is ordered to highlight what likely deserves attention first.'
        : null,
    documentSuggestion,
    carePathGuidance: buildCarePathGuidance(body),
    reportNote:
      'Report export should summarise what changed, what matters now, and what is worth discussing with a clinician.',
    whenToSeekCare:
      body?.pregnancy?.status === 'likely' || body?.pregnancy?.status === 'confirmed'
        ? {
            urgency: 'soon',
            message:
              'Seek earlier review if symptoms feel severe, bleeding is concerning, or you feel unsafe.',
          }
        : {
            urgency: 'routine',
            message:
              'Use clinician review if symptoms persist, feel unusual for you, or your pattern becomes harder to explain.',
          },
  });
}