//components/selfcheck/bodymap/BodyMapHintStrip.tsx
'use client';

import clsx from 'clsx';
import { BodyAreaKey, BodyHint } from './types';

export default function BodyMapHintStrip({
  selectedKeys,
  getHintForKey,
}: {
  selectedKeys: BodyAreaKey[];
  getHintForKey?: (k: BodyAreaKey) => BodyHint | null;
}) {
  if (!getHintForKey || selectedKeys.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Select a body area to see guidance.
      </div>
    );
  }

  const hints = selectedKeys
    .map((k) => ({ key: k, hint: getHintForKey(k) }))
    .filter((x): x is { key: BodyAreaKey; hint: BodyHint } => !!x.hint);

  if (hints.length === 0) return null;

  return (
    <div className="space-y-2">
      {hints.map(({ key, hint }) => (
        <div
          key={key}
          className={clsx(
            'rounded-xl border px-4 py-3',
            hint.tone === 'danger'
              ? 'border-rose-300 bg-rose-50'
              : hint.tone === 'warn'
              ? 'border-amber-300 bg-amber-50'
              : 'border-slate-200 bg-white'
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-sm text-slate-900">
              {hint.title}
            </div>

            <span
              className={clsx(
                'text-[11px] font-bold px-2 py-0.5 rounded-lg',
                hint.tone === 'danger'
                  ? 'bg-rose-600 text-white'
                  : hint.tone === 'warn'
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-slate-900 text-white'
              )}
            >
              {hint.tone === 'danger'
                ? 'Urgent'
                : hint.tone === 'warn'
                ? 'Watch'
                : 'Info'}
            </span>
          </div>

          <div className="mt-1 text-sm text-slate-700 leading-snug">
            {hint.body}
          </div>

          <div className="mt-2 text-[11px] text-slate-500">
            Guidance only — not a medical diagnosis.
          </div>
        </div>
      ))}
    </div>
  );
}
