// apps/patient-app/components/lady-center/DocumentsFolder.tsx
'use client';

import React, { useRef } from 'react';

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
        'rounded-2xl border border-slate-200/70 bg-white/70 shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_45px_rgba(2,6,23,42,0.07)] backdrop-blur',
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

export type LadyDocUI = {
  id: string;
  title: string;
  tag: string;
  createdISO: string;
  fileName?: string;
};

export default function DocumentsFolder(props: {
  docs: LadyDocUI[];
  sensitiveHidden: boolean;
  onReveal: () => void;

  formatNiceDate: (iso?: string | null) => string;
  formatNiceTime: (iso?: string | null) => string;

  onAddFileName: (fileName: string) => void;
  onView: (docId: string) => void;
  onSummarize: (docId: string) => void;
  onRemove: (docId: string) => void;
}) {
  const {
    docs,
    sensitiveHidden,
    onReveal,
    formatNiceDate,
    formatNiceTime,
    onAddFileName,
    onView,
    onSummarize,
    onRemove,
  } = props;

  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Card className="p-5" id="lady-docs">
      <SectionHeader
        title="Documents & Results"
        subtitle="Your private health folder."
        right={<Pill tone="slate">{docs.length} item{docs.length === 1 ? '' : 's'}</Pill>}
      />

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">Add to folder</div>
            <div className="text-xs text-slate-600">Upload PDF/images (metadata only unless wired to storage).</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,image/*"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f) onAddFileName(f.name);
                e.currentTarget.value = '';
              }}
            />
            <button
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              onClick={() => inputRef.current?.click()}
            >
              Upload
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {docs.slice(0, 6).map((d) => (
          <div key={d.id} className="relative rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{sensitiveHidden ? 'Document' : d.title}</div>
                <div className={cn('mt-0.5 text-xs text-slate-600', sensitiveHidden ? 'blur-[6px] select-none' : '')}>
                  {d.fileName ? d.fileName : 'Uploaded'} • {formatNiceDate(d.createdISO)} • {formatNiceTime(d.createdISO)}
                </div>
              </div>
              <Pill tone="slate">{d.tag}</Pill>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  if (sensitiveHidden) return onReveal();
                  onView(d.id);
                }}
              >
                View
              </button>
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  if (sensitiveHidden) return onReveal();
                  onSummarize(d.id);
                }}
              >
                Summarize
              </button>
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => onRemove(d.id)}
              >
                Remove
              </button>
            </div>

            {sensitiveHidden ? <RevealOverlay onReveal={onReveal} /> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
