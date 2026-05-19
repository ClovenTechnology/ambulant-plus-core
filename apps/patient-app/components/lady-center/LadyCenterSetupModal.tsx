'use client';

import { useMemo } from 'react';
import { FertilitySetup } from '@/src/screens/FertilitySetup';

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

const KNOWN_CONDITION_OPTIONS = [
  'Endometriosis',
  'PCOS',
  'Fibroids',
  'Adenomyosis',
  'Thyroid disorder',
  'Infertility history',
  'Pelvic inflammatory disease',
] as const;

function Pill({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'emerald';
}) {
  const toneCls =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : 'bg-slate-50 text-slate-700 ring-slate-200';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ${toneCls}`}>{children}</span>;
}

function modeLabel(mode: string) {
  switch (mode) {
    case 'cycle':
      return 'Cycle tracking';
    case 'symptoms':
      return 'Symptoms only';
    case 'pregnancy':
      return 'Pregnancy';
    case 'menopause':
      return 'Peri/Menopause';
    default:
      return 'Cycle tracking';
  }
}

function toggleListItem(list: string[] | undefined, item: string) {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export default function LadyCenterSetupModal(props: {
  open: boolean;
  onClose: () => void;
  profile: any;
  mode: 'cycle' | 'symptoms' | 'pregnancy' | 'menopause';
  onChangeMode: (mode: 'cycle' | 'symptoms' | 'pregnancy' | 'menopause') => void;
  onPatchProfile: (patch: Partial<any>) => void;
  onDone: () => void;
}) {
  const { open, onClose, profile, mode, onChangeMode, onPatchProfile, onDone } = props;
  if (!open) return null;

  const conditions = useMemo<string[]>(
    () => (Array.isArray(profile?.knownConditions) ? profile.knownConditions : []),
    [profile?.knownConditions]
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-slate-900">Setup preferences</div>
                <div className="mt-0.5 text-sm text-slate-600">Set cycle preferences and reproductive context for better predictions.</div>
              </div>
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

          <div className="max-h-[75vh] overflow-auto px-5 py-4">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Mode</div>
                <div className="mt-1 text-sm text-slate-600">Choose the experience you want. You can change this anytime.</div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(['cycle', 'symptoms', 'pregnancy', 'menopause'] as const).map((m) => (
                    <button
                      key={m}
                      className={[
                        'rounded-2xl border p-4 text-left hover:bg-slate-50',
                        mode === m ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900',
                      ].join(' ')}
                      onClick={() => onChangeMode(m)}
                    >
                      <div className="text-sm font-semibold">{modeLabel(m)}</div>
                      <div className={`mt-1 text-sm ${mode === m ? 'text-white/80' : 'text-slate-600'}`}>
                        {m === 'cycle'
                          ? 'Windows + patterns, with discreet controls.'
                          : m === 'symptoms'
                          ? 'No cycle labels — track symptoms & notes.'
                          : m === 'pregnancy'
                          ? 'Weekly check-ins and supportive reminders.'
                          : 'Comfort tools, triggers, and trend tracking.'}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill tone="emerald">Private</Pill>
                        <Pill tone="slate">Change anytime</Pill>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Reproductive context</div>
                <div className="mt-1 text-sm text-slate-600">
                  These settings improve fertility, pregnancy, and irregularity interpretation.
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Sex at birth</span>
                    <select
                      value={profile?.sexAtBirth ?? 'unknown'}
                      onChange={(e) => onPatchProfile({ sexAtBirth: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="female">Female</option>
                      <option value="intersex">Intersex</option>
                      <option value="male">Male</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Contraception method</span>
                    <select
                      value={profile?.contraceptiveMethod ?? ''}
                      onChange={(e) => onPatchProfile({ contraceptiveMethod: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      {CONTRACEPTION_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m || 'Select'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2">
                    <div>
                      <div className="text-sm font-medium text-slate-900">Trying to conceive</div>
                      <div className="text-xs text-slate-600">This helps tune fertile-window and pregnancy interpretation.</div>
                    </div>
                    <button
                      className={[
                        'rounded-xl px-3 py-2 text-sm font-medium',
                        profile?.tryingToConceive ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                      onClick={() => onPatchProfile({ tryingToConceive: !profile?.tryingToConceive })}
                    >
                      {profile?.tryingToConceive ? 'On' : 'Off'}
                    </button>
                  </label>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-medium text-slate-700">Known conditions</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {KNOWN_CONDITION_OPTIONS.map((item) => {
                      const active = conditions.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => onPatchProfile({ knownConditions: toggleListItem(conditions, item) })}
                          className={[
                            'rounded-full border px-3 py-1.5 text-sm transition',
                            active
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Cycle preferences</div>
                <div className="mt-1 text-sm text-slate-600">
                  This stores preferences used for predictions and calendar subscription.
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <FertilitySetup />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={onClose}
              >
                Close
              </button>
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={onDone}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}