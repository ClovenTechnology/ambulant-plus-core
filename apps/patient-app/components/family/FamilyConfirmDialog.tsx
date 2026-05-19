// apps/patient-app/components/family/FamilyConfirmDialog.tsx
export default function FamilyConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busy,
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  tone?: 'danger' | 'neutral';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const confirmClass =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-slate-950 hover:bg-slate-800 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-white p-5 shadow-2xl">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60 ${confirmClass}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}