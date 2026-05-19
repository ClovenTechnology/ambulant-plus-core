'use client';

import React from 'react';
import Link from 'next/link';
import type { ClinicianCardItem } from './ClinicianCard';

type MetaShape = {
  nextAvailableAt: number | null;
  consultMins: number | null;
  followupMins: number | null;
  responseTimeMins: number | null;
  isSynthetic?: boolean;
  hasReal?: boolean;
};

type Props = {
  open: boolean;
  isPremium: boolean;
  clinicians: ClinicianCardItem[];
  demoMode: boolean;
  getMeta: (c: ClinicianCardItem) => MetaShape;
  formatMoney: (currency?: string, cents?: number, fallbackZar?: number) => string;
  formatAvailabilityLabel: (ts: number) => string;
  onClose: () => void;
  onToggleCompare: (c: ClinicianCardItem) => void;
  onBook: (c: ClinicianCardItem) => void;
};

export function CliniciansCompareDrawer({
  open,
  isPremium,
  clinicians,
  demoMode,
  getMeta,
  formatMoney,
  formatAvailabilityLabel,
  onClose,
  onToggleCompare,
  onBook,
}: Props) {
  if (!open || !isPremium) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-white/60 bg-white/88 backdrop-blur-2xl shadow-[0_-18px_50px_rgba(15,23,42,0.14)] max-h-[85vh] overflow-auto">
        <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Compare clinicians</div>
            <div className="text-xs text-slate-500">Pin up to 3 clinicians to compare side-by-side.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-full border border-slate-200 bg-white/90 hover:bg-white shadow-sm"
          >
            Close
          </button>
        </div>

        {clinicians.length === 0 ? (
          <div className="p-4 text-sm text-slate-600">No clinicians pinned yet.</div>
        ) : (
          <div className="p-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="hidden md:block" />
              {clinicians.map((c) => {
                const meta = getMeta(c);
                const priceStr = formatMoney(
                  (c as any).currency,
                  (c as any).priceCents,
                  (c as any).priceZAR,
                );

                return (
                  <div
                    key={c.id}
                    className="rounded-[22px] border border-white/70 bg-white/82 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{c.name}</div>
                        <div className="text-xs text-slate-500 truncate">{c.specialty}</div>
                      </div>
                      <button
                        type="button"
                        className="text-xs px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50"
                        onClick={() => onToggleCompare(c)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-3 text-xs text-slate-700">
                      {meta.nextAvailableAt && (demoMode || meta.hasReal) ? (
                        <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1">
                          Availability:
                          <span className="ml-1 font-medium">
                            {formatAvailabilityLabel(meta.nextAvailableAt)}
                          </span>
                          {demoMode && meta.isSynthetic ? (
                            <span className="ml-1 text-slate-400">(demo)</span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-slate-400">Availability not yet available</div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        href={`/clinicians/${c.id}`}
                        className="text-xs underline text-slate-600 hover:text-slate-900"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => onBook(c)}
                        className="ml-auto px-3.5 py-1.5 text-xs rounded-full bg-slate-950 text-white hover:bg-slate-800 shadow-sm"
                      >
                        Book
                      </button>
                    </div>

                    {priceStr ? (
                      <div className="mt-3 text-xs text-slate-600">
                        From <b className="text-slate-900">{priceStr}</b>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 overflow-auto">
              <table className="w-full text-sm border border-slate-200 rounded-[22px] overflow-hidden bg-white/80">
                <thead className="bg-slate-50/90">
                  <tr>
                    <th className="text-left p-3 border-b w-48 text-slate-600 font-medium">Field</th>
                    {clinicians.map((c) => (
                      <th
                        key={c.id}
                        className="text-left p-3 border-b min-w-[220px] font-medium text-slate-900"
                      >
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: 'Availability',
                      render: (c: ClinicianCardItem) => {
                        const meta = getMeta(c);
                        if (!meta.nextAvailableAt) return '—';
                        if (!demoMode && !meta.hasReal) return '—';
                        return `${formatAvailabilityLabel(meta.nextAvailableAt)}${
                          demoMode && meta.isSynthetic ? ' (demo)' : ''
                        }`;
                      },
                    },
                    {
                      label: 'Price',
                      render: (c: any) =>
                        formatMoney(c.currency, c.priceCents, c.priceZAR) || '—',
                    },
                    {
                      label: 'Languages',
                      render: (c: ClinicianCardItem) =>
                        Array.isArray(c.speaks) && c.speaks.length ? c.speaks.join(', ') : '—',
                    },
                    {
                      label: 'Experience',
                      render: (c: ClinicianCardItem) =>
                        typeof c.yearsExp === 'number' ? `${c.yearsExp} yrs` : '—',
                    },
                    {
                      label: 'Rating',
                      render: (c: ClinicianCardItem) =>
                        typeof c.rating === 'number'
                          ? `${c.rating.toFixed(1)}${
                              typeof c.ratingCount === 'number' ? ` (${c.ratingCount})` : ''
                            }`
                          : '—',
                    },
                    {
                      label: 'Trust (avg lengths)',
                      render: (c: ClinicianCardItem) => {
                        const meta = getMeta(c);
                        if (!demoMode && !meta.hasReal) return '—';

                        const resp = meta.responseTimeMins;
                        const respLabel =
                          typeof resp === 'number'
                            ? resp < 60
                              ? `~${resp}m`
                              : `~${Math.round(resp / 60)}h`
                            : '—';

                        return `Consult ${meta.consultMins ?? '—'}m · Follow-up ${
                          meta.followupMins ?? '—'
                        }m · Response ${respLabel}${
                          demoMode && meta.isSynthetic ? ' (demo)' : ''
                        }`;
                      },
                    },
                  ].map((row) => (
                    <tr key={row.label} className="odd:bg-white even:bg-slate-50/40">
                      <td className="p-3 border-b text-slate-600">{row.label}</td>
                      {clinicians.map((c) => (
                        <td key={c.id} className="p-3 border-b text-slate-900">
                          {row.render(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}