// apps/patient-app/components/lady-center/InsightFeed.tsx
'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ThumbsDown, ThumbsUp, X } from 'lucide-react';

import type { InsightCoreInsight, InsightTone, InsightFeedbackVerdict } from '@/src/lib/insightcore/api';
import { listInsightCoreInsights, postInsightCoreFeedback } from '@/src/lib/insightcore/api';

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function Pill({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const toneCls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700 ring-blue-200'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : tone === 'rose'
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : tone === 'violet'
      ? 'bg-violet-50 text-violet-700 ring-violet-200'
      : 'bg-slate-50 text-slate-700 ring-slate-200';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1', toneCls)}>
      {children}
    </span>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/70 bg-white/70 shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_45px_rgba(2,6,23,0.07)] backdrop-blur',
        className
      )}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-slate-600">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function IconDot({ tone }: { tone: InsightTone }) {
  const cls = tone === 'good' ? 'bg-emerald-500' : tone === 'attention' ? 'bg-amber-500' : 'bg-blue-500';
  return <span className={cn('inline-block h-2 w-2 rounded-full', cls)} />;
}

function RevealOverlay({ onReveal }: { onReveal: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
      <button
        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
        onClick={onReveal}
      >
        Tap to reveal
      </button>
    </div>
  );
}

function MiniExplain({ title, text, blurred }: { title: string; text: string; blurred: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium text-slate-700">{title}</div>
      <div className={cn('mt-1 text-sm text-slate-700', blurred ? 'blur-[6px] select-none' : '')}>{text}</div>
    </div>
  );
}

export default function InsightFeed(props: {
  mode: string;
  todayISO: string;
  sensitiveHidden: boolean;
  discreet: boolean;
  onReveal: () => void;

  // optional “page banner” hook
  onBanner?: (kind: 'info' | 'success' | 'error', text: string) => void;

  // your local fallback builder (so UI never goes empty in dev)
  fallbackInsights: InsightCoreInsight[];

  // context signals to send to InsightCore (API can ignore unknown)
  signals?: Record<string, unknown>;
}) {
  const { mode, todayISO, sensitiveHidden, discreet, onReveal, onBanner, fallbackInsights, signals } = props;

  const swrKey = useMemo(() => ['insightcore', 'lady_center', mode, todayISO], [mode, todayISO]);

  const { data, isLoading, mutate } = useSWR<InsightCoreInsight[]>(
    swrKey,
    async () => {
      const insights = await listInsightCoreInsights({
        context: 'lady_center',
        mode,
        dateISO: todayISO,
        limit: 6,
        signals: signals ?? {},
      });
      return insights;
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const insights = (data && data.length ? data : fallbackInsights).slice(0, 4);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [voted, setVoted] = useState<Record<string, InsightFeedbackVerdict | undefined>>({});

  async function sendFeedback(insightId: string, verdict: InsightFeedbackVerdict) {
    if (sending[insightId]) return;

    setSending((m) => ({ ...m, [insightId]: true }));
    setVoted((m) => ({ ...m, [insightId]: verdict }));

    try {
      const ok = await postInsightCoreFeedback({
        context: 'lady_center',
        insightId,
        verdict,
        meta: { mode, dateISO: todayISO },
      });

      if (ok) {
        onBanner?.('success', 'Thanks — your feedback improves future insights.');
        // let API reweight / reorder if it wants
        mutate();
      } else {
        onBanner?.('error', 'Could not send feedback. Try again.');
        setVoted((m) => ({ ...m, [insightId]: undefined }));
      }
    } catch (e) {
      console.error(e);
      onBanner?.('error', 'Could not send feedback. Check connection.');
      setVoted((m) => ({ ...m, [insightId]: undefined }));
    } finally {
      setSending((m) => ({ ...m, [insightId]: false }));
    }
  }

  return (
    <Card className="p-5">
      <SectionHeader
        title="Insights"
        subtitle="Explainable patterns with calm next steps."
        right={<Pill tone="blue">InsightCore</Pill>}
      />

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Loading insights…
          </div>
        ) : null}

        {insights.map((it) => {
          const isOpen = !!expanded[it.id];
          const verdict = voted[it.id];

          return (
            <div key={it.id} className="relative rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <IconDot tone={it.tone} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      {sensitiveHidden ? 'Health insight' : it.title}
                    </div>
                    <div className={cn('mt-1 text-sm text-slate-600', sensitiveHidden ? 'blur-[6px] select-none' : '')}>
                      {it.summary}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      if (sensitiveHidden) return onReveal();
                      setExpanded((m) => ({ ...m, [it.id]: !m[it.id] }));
                    }}
                  >
                    {isOpen ? 'Hide' : 'Read more'}
                  </button>

                  <Link
                    href="/clinicians"
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    onClick={(e) => {
                      if (sensitiveHidden) {
                        e.preventDefault();
                        onReveal();
                        onBanner?.('info', 'Revealed for 30 seconds.');
                      }
                    }}
                  >
                    Discuss
                  </Link>
                </div>
              </div>

              {isOpen ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MiniExplain title="Why we think this" text={it.why ?? '—'} blurred={sensitiveHidden} />
                  <MiniExplain title="What you can do" text={it.next ?? '—'} blurred={sensitiveHidden} />
                </div>
              ) : null}

              {/* Feedback row */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                    verdict === 'helpful'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                  disabled={!!sending[it.id]}
                  onClick={() => {
                    if (sensitiveHidden) return onReveal();
                    sendFeedback(it.id, 'helpful');
                  }}
                  title="Helpful"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Helpful
                </button>

                <button
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                    verdict === 'not_helpful'
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                  disabled={!!sending[it.id]}
                  onClick={() => {
                    if (sensitiveHidden) return onReveal();
                    sendFeedback(it.id, 'not_helpful');
                  }}
                  title="Not helpful"
                >
                  <ThumbsDown className="h-4 w-4" />
                  Not helpful
                </button>

                <button
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                    verdict === 'dismissed'
                      ? 'border-slate-300 bg-slate-100 text-slate-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                  disabled={!!sending[it.id]}
                  onClick={() => {
                    if (sensitiveHidden) return onReveal();
                    sendFeedback(it.id, 'dismissed');
                  }}
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                  Dismiss
                </button>

                <div className="ml-auto flex items-center gap-2">
                  <Pill tone="slate">No scary labels</Pill>
                  <Pill tone="emerald">Action-first</Pill>
                  <Pill tone="violet">You’re in control</Pill>
                </div>
              </div>

              {sensitiveHidden ? <RevealOverlay onReveal={onReveal} /> : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
