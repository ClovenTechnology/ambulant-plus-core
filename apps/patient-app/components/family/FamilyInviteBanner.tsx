type State = 'idle' | 'submitting' | 'done' | 'error';

export default function FamilyInviteBanner({
  visible,
  acceptState,
  declineState,
  acceptError,
  declineError,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  acceptState: State;
  declineState: State;
  acceptError: string | null;
  declineError: string | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (!visible) return null;

  return (
    <section className="rounded-[24px] border border-emerald-200 bg-emerald-50/85 px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-medium text-emerald-900">
            You&apos;ve been invited to connect your care.
          </div>
          <p className="mt-1 text-xs leading-6 text-emerald-800">
            Accept this invitation to let a trusted family member or friend support your care on Ambulant+.
            You can also decline it.
          </p>
          {acceptError ? <p className="mt-1 text-xs text-rose-700">{acceptError}</p> : null}
          {declineError ? <p className="mt-1 text-xs text-rose-700">{declineError}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={onAccept}
            disabled={acceptState === 'submitting' || declineState === 'submitting'}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {acceptState === 'submitting' ? 'Accepting…' : 'Accept invite'}
          </button>
          <button
            type="button"
            onClick={onDecline}
            disabled={acceptState === 'submitting' || declineState === 'submitting'}
            className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2 font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            {declineState === 'submitting' ? 'Declining…' : 'Decline'}
          </button>
        </div>
      </div>
    </section>
  );
}