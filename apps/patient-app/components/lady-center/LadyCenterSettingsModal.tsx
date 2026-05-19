'use client';

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

function toggleListItem(list: string[] | undefined, item: string) {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function SettingRow({ label, desc, right }: { label: string; desc: string; right: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-600">{desc}</div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function SettingToggle(props: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { label, desc, value, onChange } = props;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-600">{desc}</div>
      </div>
      <button
        className={[
          'rounded-xl px-3 py-2 text-sm font-medium',
          value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        ].join(' ')}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        {value ? 'On' : 'Off'}
      </button>
    </div>
  );
}

export default function LadyCenterSettingsModal(props: {
  open: boolean;
  onClose: () => void;
  discreet: boolean;
  onToggleDiscreet: () => void;
  profile: any;
  onChangeMode: (mode: 'cycle' | 'symptoms' | 'pregnancy' | 'menopause') => void;
  onChangeTrackVitals: (v: boolean) => void;
  onChangeRemindScreening: (v: boolean) => void;
  onPatchProfile: (patch: Partial<any>) => void;
  onResetTracking: () => void;
  onExportPdf: () => void | Promise<void>;
  onSubscribeIcs: () => void;
}) {
  const {
    open,
    onClose,
    discreet,
    onToggleDiscreet,
    profile,
    onChangeMode,
    onChangeTrackVitals,
    onChangeRemindScreening,
    onPatchProfile,
    onResetTracking,
    onExportPdf,
    onSubscribeIcs,
  } = props;

  if (!open) return null;

  const conditions = Array.isArray(profile?.knownConditions) ? profile.knownConditions : [];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-slate-900">Lady Center settings</div>
                <div className="mt-0.5 text-sm text-slate-600">Choose what you want to track and how it appears.</div>
              </div>
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

          <div className="max-h-[75vh] overflow-auto px-5 py-4">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Privacy</div>
                <div className="mt-1 text-sm text-slate-600">
                  Discreet Mode keeps labels neutral and details hidden until you tap Reveal.
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Discreet Mode</div>
                    <div className="text-xs text-slate-600">Hide sensitive labels & blur details</div>
                  </div>
                  <button
                    className={[
                      'rounded-xl px-3 py-2 text-sm font-medium',
                      discreet ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                    onClick={onToggleDiscreet}
                  >
                    {discreet ? 'On' : 'Off'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Tracking</div>
                <div className="mt-1 text-sm text-slate-600">Your choices control home cards, insights, and reminders.</div>

                <div className="mt-3 grid grid-cols-1 gap-3">
                  <SettingRow
                    label="Mode"
                    desc="Pick the experience you want."
                    right={
                      <select
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        value={profile?.mode ?? 'cycle'}
                        onChange={(e) => onChangeMode(e.target.value as any)}
                      >
                        <option value="cycle">Cycle tracking</option>
                        <option value="symptoms">Symptoms only</option>
                        <option value="pregnancy">Pregnancy</option>
                        <option value="menopause">Peri/Menopause</option>
                      </select>
                    }
                  />

                  <SettingRow
                    label="Sex at birth"
                    desc="Used for feature sensitivity and reproductive logic."
                    right={
                      <select
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        value={profile?.sexAtBirth ?? 'unknown'}
                        onChange={(e) => onPatchProfile({ sexAtBirth: e.target.value })}
                      >
                        <option value="unknown">Unknown</option>
                        <option value="female">Female</option>
                        <option value="intersex">Intersex</option>
                        <option value="male">Male</option>
                      </select>
                    }
                  />

                  <SettingRow
                    label="Contraception method"
                    desc="Helps tune period and pregnancy interpretation."
                    right={
                      <select
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        value={profile?.contraceptiveMethod ?? ''}
                        onChange={(e) => onPatchProfile({ contraceptiveMethod: e.target.value })}
                      >
                        {CONTRACEPTION_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m || 'Select'}
                          </option>
                        ))}
                      </select>
                    }
                  />

                  <SettingToggle
                    label="Trying to conceive"
                    desc="Improves fertile-window and pregnancy guidance."
                    value={!!profile?.tryingToConceive}
                    onChange={(v) => onPatchProfile({ tryingToConceive: v })}
                  />

                  <SettingToggle
                    label="Track vitals context"
                    desc="Sleep, resting HR, temperature trend (optional)."
                    value={profile?.trackVitals ?? true}
                    onChange={onChangeTrackVitals}
                  />

                  <SettingToggle
                    label="Preventive reminders"
                    desc="Screening checklist nudges."
                    value={profile?.remindScreening ?? true}
                    onChange={onChangeRemindScreening}
                  />
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
                <div className="text-sm font-semibold text-slate-900">Export</div>
                <div className="mt-1 text-sm text-slate-600">PDF report and calendar subscription.</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    onClick={onExportPdf}
                  >
                    Export PDF
                  </button>
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={onSubscribeIcs}
                  >
                    Subscribe calendar (.ics)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={onResetTracking}
              >
                Reset tracking
              </button>
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={onClose}
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