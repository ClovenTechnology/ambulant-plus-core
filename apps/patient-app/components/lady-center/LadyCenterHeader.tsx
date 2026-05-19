'use client';

import { Eye, EyeOff, Settings, ShieldCheck } from 'lucide-react';

export default function LadyCenterHeader(props: {
  title: string;
  subtitle: string;
  syncHint: string;
  syncState: 'idle' | 'syncing' | 'ok' | 'error';
  discreet: boolean;
  onToggleDiscreet: () => void;
  onOpenSettings: () => void;
}) {
  const { title, subtitle, syncHint, syncState, discreet, onToggleDiscreet, onOpenSettings } = props;

  const syncTone =
    syncState === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : syncState === 'syncing'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : syncState === 'error'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  const syncLabel =
    syncState === 'ok'
      ? 'Synced'
      : syncState === 'syncing'
      ? 'Syncing…'
      : syncState === 'error'
      ? 'Offline'
      : 'Local';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 shadow-sm" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${syncTone}`}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {syncLabel}
              </span>
              <span className="text-xs text-slate-500">{syncHint}</span>
            </div>
            <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className={[
            'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
            discreet
              ? 'border-slate-300 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          ].join(' ')}
          onClick={onToggleDiscreet}
          aria-pressed={discreet}
          title="Discreet Mode"
        >
          {discreet ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          Discreet Mode
        </button>

        <button
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          onClick={onOpenSettings}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
      </div>
    </div>
  );
}