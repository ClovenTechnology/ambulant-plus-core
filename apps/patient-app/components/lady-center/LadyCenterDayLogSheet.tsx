'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

const CYCLE_MODIFIERS = [
  'illness',
  'travel',
  'stress',
  'night_shift',
  'poor_sleep',
  'alcohol',
  'intense_exercise',
] as const;

const CONTRACEPTION_METHODS = [
  '',
  'none',
  'condom',
  'pill',
  'iud',
  'implant',
  'injection',
  'ring',
  'patch',
  'withdrawal',
  'other',
] as const;

const CERVICAL_MUCUS = [
  '',
  'dry',
  'sticky',
  'creamy',
  'watery',
  'egg_white',
] as const;

function neutralize(label: string, discreet: boolean) {
  if (!discreet) return label;
  if (/period|bleeding/i.test(label)) return 'Tracking window';
  if (/fertile|ovulation/i.test(label)) return 'Timing window';
  if (/pregnan/i.test(label)) return 'Health mode';
  if (/sex|intercourse|encounter/i.test(label)) return 'Private event';
  return label;
}

export default function LadyCenterDayLogSheet(props: {
  discreet: boolean;
  hidden: boolean;
  log: any;
  onClose: () => void;
  onSave: (log: any) => void;
}) {
  const { discreet, hidden, log, onClose, onSave } = props;
  const [draft, setDraft] = useState<any>(log);

  const symptomSummary = useMemo(() => {
    const count = Array.isArray(draft.symptoms) ? draft.symptoms.length : 0;
    return count === 0 ? 'None' : `${count} selected`;
  }, [draft.symptoms]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="absolute inset-x-0 bottom-0 w-full rounded-t-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:inset-0 sm:m-auto sm:h-auto sm:max-w-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{hidden ? neutralize('Day log', true) : `Day log – ${draft.date}`}</h3>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className={`mt-4 space-y-5 ${hidden ? 'blur-sm select-none' : ''}`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={!!draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.checked })} />
              {neutralize('Period started', discreet)}
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={!!draft.ovulation} onChange={(e) => setDraft({ ...draft, ovulation: e.target.checked })} />
              {neutralize('Ovulation confirmed', discreet)}
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={!!draft.pregnancyTestPositive}
                onChange={(e) => setDraft({ ...draft, pregnancyTestPositive: e.target.checked })}
              />
              {neutralize('Positive pregnancy test', discreet)}
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">{neutralize('Sex / fertility context', discreet)}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={!!draft.sexualEncounter}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sexualEncounter: e.target.checked,
                      protectedSex: e.target.checked ? draft.protectedSex : null,
                      withdrawalUsed: e.target.checked ? draft.withdrawalUsed : null,
                    })
                  }
                />
                {neutralize('Sexual encounter', discreet)}
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={!!draft.tryingToConceive}
                  onChange={(e) => setDraft({ ...draft, tryingToConceive: e.target.checked })}
                />
                Trying to conceive
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-700">Contraception method</span>
                <select
                  value={draft.contraceptionMethod ?? ''}
                  onChange={(e) => setDraft({ ...draft, contraceptionMethod: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-900"
                >
                  {CONTRACEPTION_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m || 'Select'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-700">Adherence</span>
                <input
                  type="text"
                  value={draft.contraceptionAdherence ?? ''}
                  onChange={(e) => setDraft({ ...draft, contraceptionAdherence: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-900"
                  placeholder="e.g. missed pill, on time, unsure"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={!!draft.protectedSex}
                  onChange={(e) => setDraft({ ...draft, protectedSex: e.target.checked })}
                  disabled={!draft.sexualEncounter}
                />
                Protected
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={!!draft.withdrawalUsed}
                  onChange={(e) => setDraft({ ...draft, withdrawalUsed: e.target.checked })}
                  disabled={!draft.sexualEncounter}
                />
                Withdrawal used
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-800 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={!!draft.emergencyContraception}
                  onChange={(e) => setDraft({ ...draft, emergencyContraception: e.target.checked })}
                />
                Emergency contraception taken
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Flow intensity</span>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={draft.flowIntensity ?? 0}
                onChange={(e) => setDraft({ ...draft, flowIntensity: Number(e.target.value) })}
                className="mt-2 w-full"
              />
              <div className="mt-1 text-xs text-slate-500">{draft.flowIntensity ?? 0} / 5</div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Pain score</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={draft.painScore ?? 0}
                onChange={(e) => setDraft({ ...draft, painScore: Number(e.target.value) })}
                className="mt-2 w-full"
              />
              <div className="mt-1 text-xs text-slate-500">{draft.painScore ?? 0} / 10</div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Cervical mucus</span>
              <select
                value={draft.cervicalMucus ?? ''}
                onChange={(e) => setDraft({ ...draft, cervicalMucus: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-900"
              >
                {CERVICAL_MUCUS.map((m) => (
                  <option key={m} value={m}>
                    {m || 'Select'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Cycle modifiers</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {CYCLE_MODIFIERS.map((m) => {
                const active = Array.isArray(draft.cycleModifiers) && draft.cycleModifiers.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      const prev = Array.isArray(draft.cycleModifiers) ? draft.cycleModifiers : [];
                      const next = active ? prev.filter((x: string) => x !== m) : [...prev, m];
                      setDraft({ ...draft, cycleModifiers: next });
                    }}
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm transition',
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {m.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Medication / Contraceptives</span>
              <input
                type="text"
                value={draft.meds ?? ''}
                onChange={(e) => setDraft({ ...draft, meds: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
                placeholder={discreet ? 'Optional' : 'e.g., iron, pill, pain relief'}
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-700">Symptoms</div>
              <div className="mt-1 text-sm text-slate-600">{symptomSummary}</div>
              <div className="mt-1 text-[11px] text-slate-500">Use Quick Symptoms on the main calendar to edit these.</div>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-700">Notes</span>
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
              rows={3}
              placeholder={discreet ? 'Optional' : 'Anything to remember?'}
            />
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Save changes
          </button>
        </div>

        {hidden ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-800" onClick={onClose}>
              Close (discreet)
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}