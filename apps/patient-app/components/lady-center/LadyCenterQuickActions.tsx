'use client';

import Link from 'next/link';

function QuickAction(props: {
  label: string;
  hint: string;
  onClick?: () => void;
  asLink?: boolean;
  href?: string;
}) {
  const { label, hint, onClick, asLink, href } = props;
  const cls =
    'group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50';

  const content = (
    <>
      <span className="font-medium">{label}</span>
      <span className="text-xs text-slate-500">{hint}</span>
    </>
  );

  if (asLink && href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }

  return (
    <button className={cls} onClick={onClick}>
      {content}
    </button>
  );
}

export default function LadyCenterQuickActions(props: {
  modeLabel?: string | null;
  discreet: boolean;
  onOpenSetup: () => void;
  onLogPeriod: () => void;
  onLogSymptom: () => void;
  onExportReport: () => void;
  onSubscribeCalendar: () => void;
}) {
  const { modeLabel, discreet, onOpenSetup, onLogPeriod, onLogSymptom, onExportReport, onSubscribeCalendar } = props;

  const periodLabel = discreet ? 'Log tracking day' : 'Log period';
  const periodHint = discreet ? 'selected day / today' : 'selected day / today';
  const symptomLabel = discreet ? 'Log check-in' : 'Log symptom';

  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_45px_rgba(2,6,23,0.07)] backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <QuickAction label="Setup preferences" hint="LMP & cycle length" onClick={onOpenSetup} />
          <QuickAction label={periodLabel} hint={periodHint} onClick={onLogPeriod} />
          <QuickAction label={symptomLabel} hint="review before save" onClick={onLogSymptom} />
          <QuickAction label="Book consult" hint="clinicians" asLink href="/clinicians" />
          <QuickAction label="Order tests" hint="labs" asLink href="/labs" />
          <QuickAction label="Export report" hint="PDF" onClick={onExportReport} />
          <QuickAction label="Subscribe calendar" hint=".ics" onClick={onSubscribeCalendar} />

          <div className="ml-auto flex items-center gap-2">
            {modeLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                Mode: <span className="font-semibold">{modeLabel}</span>
              </span>
            ) : (
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={onOpenSetup}
              >
                Set up tracking
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}