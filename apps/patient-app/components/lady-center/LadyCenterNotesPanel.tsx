'use client';

export default function LadyCenterNotesPanel(props: {
  notes: { id: string; text: string; createdISO: string }[];
  sensitiveHidden: boolean;
  onReveal: () => void;
  formatNiceDate: (iso?: string | null) => string;
  onAdd: () => void;
}) {
  const { notes, sensitiveHidden, onReveal, formatNiceDate, onAdd } = props;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_45px_rgba(2,6,23,0.07)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Private notes</div>
          <div className="mt-0.5 text-xs text-slate-600">For patterns you don’t want to forget.</div>
        </div>
        <button
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={onAdd}
        >
          Add
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {notes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No notes yet. Add one after a symptom, log, or appointment.
          </div>
        ) : (
          notes.slice(0, 5).map((n) => (
            <div key={n.id} className="relative rounded-2xl border border-slate-200 bg-white p-3">
              <div className={`whitespace-pre-wrap text-sm text-slate-800 ${sensitiveHidden ? 'blur-[6px] select-none' : ''}`}>
                {n.text}
              </div>
              <div className="mt-2 text-xs text-slate-500">{formatNiceDate(n.createdISO)}</div>
              {sensitiveHidden ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
                  <button
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
                    onClick={onReveal}
                  >
                    Tap to reveal
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}