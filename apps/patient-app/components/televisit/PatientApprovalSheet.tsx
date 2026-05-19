'use client';

import type { InvitedClinicianInput } from '@/src/lib/televisit/multiparty';

type Props = {
  open: boolean;
  quoteId: string | null;
  totalZar: number | null;
  invitedClinicians: InvitedClinicianInput[];
  onApprove: () => void;
  onDecline: () => void;
  onClose: () => void;
  busy?: boolean;
};

function roleLabel(role: InvitedClinicianInput['role']) {
  switch (role) {
    case 'advisor':
      return 'Advisor';
    case 'co_clinician':
      return 'Co-clinician';
    case 'takeover_followup':
      return 'Takeover follow-up';
    default:
      return role;
  }
}

export default function PatientApprovalSheet({
  open,
  quoteId,
  totalZar,
  invitedClinicians,
  onApprove,
  onDecline,
  onClose,
  busy = false,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] bg-black/40" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-[28px] border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-lg font-semibold text-slate-900">
            Additional clinician approval
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Your clinician has requested specialist support for this consultation.
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {quoteId ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Quote ID: <span className="font-mono">{quoteId}</span>
            </div>
          ) : null}

          <div className="space-y-3">
            {invitedClinicians.map((c, idx) => (
              <div
                key={`${c.clinicianId}-${idx}`}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {c.displayName || c.specialty || 'Invited clinician'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {roleLabel(c.role)}
                      {c.specialty ? ` · ${c.specialty}` : ''}
                      {typeof c.expectedMinutes === 'number'
                        ? ` · ~${c.expectedMinutes} min`
                        : ''}
                    </div>
                  </div>

                  <div className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                    {c.required === false ? 'Optional' : 'Required'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="text-sm text-emerald-800">Total additional charge</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-900">
              {typeof totalZar === 'number' ? `R${totalZar.toFixed(2)}` : '—'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            Decline
          </button>

          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Processing…' : 'Approve and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}