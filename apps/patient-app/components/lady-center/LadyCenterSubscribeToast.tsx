'use client';

import { X } from 'lucide-react';

export default function LadyCenterSubscribeToast(props: {
  open: boolean;
  icsUrl: string | null;
  message: string;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  const { open, icsUrl, message, copied, onClose, onCopy } = props;
  if (!open) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[min(100%,32rem)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-semibold">Subscribe in Calendar</div>
            <div className="break-all text-xs text-slate-600">{icsUrl ? message : 'Set preferences to enable: LMP + cycle length.'}</div>
          </div>
          <button className="rounded p-1 hover:bg-slate-100" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            disabled={!icsUrl}
            onClick={onCopy}
            className={[
              'rounded-xl border px-3 py-1.5 text-sm',
              copied ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
              !icsUrl ? 'cursor-not-allowed opacity-50' : '',
            ].join(' ')}
          >
            {copied ? 'Copied' : 'Copy URL'}
          </button>

          <a
            href={icsUrl ?? '#'}
            target="_blank"
            rel="noreferrer"
            className={[
              'rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50',
              !icsUrl ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
          >
            Open
          </a>
        </div>
      </div>
    </div>
  );
}