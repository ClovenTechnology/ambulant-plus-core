// apps/admin-dashboard/app/admin/clinicians/onboarding/OnboardingSettingsPanel.tsx
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

type PathwayKey =
  | 'START_NOW_PAY_LATER'
  | 'QUALIFYING_DEPOSIT'
  | 'FULL_PAYMENT';

type Privileges = {
  trainingAccess: boolean;
  practiceActivation: boolean;
  starterKitRelease:
    | 'none'
    | 'deposit'
    | 'full';
  platformIndemnityEligible: boolean;
  balanceRecoveryApplies: boolean;
};

type Pathway = {
  key: PathwayKey;
  displayOrder: number;
  label: string;
  badge: string | null;
  description: string;
  ctaLabel: string;
  enabled: boolean;
  featured: boolean;
  conditions: string[];
  privileges: Privileges;
};

type TrainingPolicy = {
  heading: string;
  introduction: string;
  timezone: string;
  defaultDurationDays: number;
  defaultSessionDurationMinutes: number;
  allowedModes:
    Array<'virtual' | 'in_person'>;
  virtualDescription: string;
  inPersonDescription: string;
  operationalNotice: string | null;
  supportMessage: string | null;
};

type Settings = {
  trainingFeeCents: number;
  minimumInitialPaymentCents: number;
  allowPartialPayment: boolean;
  balanceRecoveryMode:
    | 'manual'
    | 'payout_deduction'
    | 'disabled';
  balanceRecoveryNotes: string | null;
  currency: string;
  paymentProvider:
    | 'paystack'
    | 'payfast';
  cardPaymentEnabled: boolean;
  manualPaymentEnabled: boolean;
  starterKitItems: string[];
  starterKitDepositItems: string[];
  bankInstructions:
    Record<string, string> | null;
  commercialPathways: Pathway[];
  trainingPolicy: TrainingPolicy;
  notes: string | null;
};

const DEFAULT_PATHWAYS: Pathway[] = [
  {
    key: 'START_NOW_PAY_LATER',
    displayOrder: 1,
    label: 'Start Now — Pay Later',
    badge: 'Fastest start',
    description:
      'Begin after Admin approves the Pay Later request.',
    ctaLabel:
      'Request Pay Later approval',
    enabled: true,
    featured: true,
    conditions: [
      'Training access begins after Admin approval.',
      'A C-Med Kit dispatch requires a qualifying payment.',
    ],
    privileges: {
      trainingAccess: true,
      practiceActivation: true,
      starterKitRelease: 'none',
      platformIndemnityEligible: false,
      balanceRecoveryApplies: true,
    },
  },
  {
    key: 'QUALIFYING_DEPOSIT',
    displayOrder: 2,
    label: 'Start with Initial Deposit',
    badge: 'Balanced option',
    description:
      'Pay the qualifying deposit and receive its assigned benefits.',
    ctaLabel: 'Pay initial deposit',
    enabled: true,
    featured: false,
    conditions: [
      'The qualifying amount is set by Admin.',
      'Only the selected deposit-kit items are released.',
    ],
    privileges: {
      trainingAccess: true,
      practiceActivation: true,
      starterKitRelease: 'deposit',
      platformIndemnityEligible: true,
      balanceRecoveryApplies: true,
    },
  },
  {
    key: 'FULL_PAYMENT',
    displayOrder: 3,
    label: 'Pay in Full',
    badge: 'Complete package',
    description:
      'Settle the full onboarding fee and receive the full configured package.',
    ctaLabel: 'Pay full onboarding fee',
    enabled: true,
    featured: false,
    conditions: [
      'The complete configured C-Med Kit can be released.',
      'No onboarding-fee balance remains.',
    ],
    privileges: {
      trainingAccess: true,
      practiceActivation: true,
      starterKitRelease: 'full',
      platformIndemnityEligible: true,
      balanceRecoveryApplies: false,
    },
  },
];

const DEFAULT_POLICY: TrainingPolicy = {
  heading:
    'Mandatory clinician onboarding training',
  introduction:
    'Choose an available programme, select a training mode, and complete the applicable onboarding pathway.',
  timezone: 'Africa/Johannesburg',
  defaultDurationDays: 1,
  defaultSessionDurationMinutes: 60,
  allowedModes: [
    'virtual',
    'in_person',
  ],
  virtualDescription:
    'Attend remotely using the secure training room.',
  inPersonDescription:
    'Attend at the venue shown in the programme.',
  operationalNotice: null,
  supportMessage:
    'Contact Ambulant+ if you need accessibility support or a special arrangement.',
};

function clonePathways(value = DEFAULT_PATHWAYS) {
  return value.map((pathway) => ({
    ...pathway,
    conditions: [...pathway.conditions],
    privileges: {...pathway.privileges},
  }));
}

function cleanLines(value: string) {
  const seen = new Set<string>();

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      const identity = line.toLowerCase();
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
}

function centsToAmount(value: number) {
  return String(
    Number(value || 0) / 100,
  );
}

function amountToCents(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? Math.max(
        0,
        Math.round(amount * 100),
      )
    : 0;
}

function errorText(value: unknown) {
  return String(
    value || 'Unable to save settings.',
  ).replace(/_/g, ' ');
}

function mergeSettings(raw: any): Settings {
  const incoming =
    Array.isArray(raw?.commercialPathways)
      ? raw.commercialPathways
      : [];

  const commercialPathways =
    DEFAULT_PATHWAYS.map((fallback) => {
      const found =
        incoming.find(
          (item: any) =>
            String(item?.key || '')
              .toUpperCase() ===
            fallback.key,
        );

      if (!found) {
        return {
          ...fallback,
          conditions: [...fallback.conditions],
          privileges:
            {...fallback.privileges},
        };
      }

      return {
        ...fallback,
        ...found,
        conditions:
          Array.isArray(found.conditions)
            ? found.conditions
            : fallback.conditions,
        privileges: {
          ...fallback.privileges,
          ...(found.privileges || {}),
        },
      };
    }).sort(
      (left, right) =>
        left.displayOrder -
        right.displayOrder,
    );

  return {
    trainingFeeCents:
      Number(raw?.trainingFeeCents || 0),
    minimumInitialPaymentCents:
      Number(
        raw?.minimumInitialPaymentCents || 0,
      ),
    allowPartialPayment:
      raw?.allowPartialPayment === true,
    balanceRecoveryMode:
      raw?.balanceRecoveryMode ===
      'payout_deduction'
        ? 'payout_deduction'
        : raw?.balanceRecoveryMode ===
            'disabled'
          ? 'disabled'
          : 'manual',
    balanceRecoveryNotes:
      raw?.balanceRecoveryNotes || null,
    currency:
      String(raw?.currency || 'ZAR'),
    paymentProvider:
      raw?.paymentProvider === 'payfast'
        ? 'payfast'
        : 'paystack',
    cardPaymentEnabled:
      raw?.cardPaymentEnabled !== false,
    manualPaymentEnabled:
      raw?.manualPaymentEnabled !== false,
    starterKitItems:
      Array.isArray(raw?.starterKitItems)
        ? raw.starterKitItems
        : [],
    starterKitDepositItems:
      Array.isArray(
        raw?.starterKitDepositItems,
      )
        ? raw.starterKitDepositItems
        : [],
    bankInstructions:
      raw?.bankInstructions &&
      typeof raw.bankInstructions ===
        'object'
        ? raw.bankInstructions
        : {},
    commercialPathways,
    trainingPolicy: {
      ...DEFAULT_POLICY,
      ...(raw?.trainingPolicy || {}),
      allowedModes:
        Array.isArray(
          raw?.trainingPolicy?.allowedModes,
        ) &&
        raw.trainingPolicy
          .allowedModes.length
          ? raw.trainingPolicy.allowedModes
          : DEFAULT_POLICY.allowedModes,
    },
    notes: raw?.notes || null,
  };
}

export default function OnboardingSettingsPanel() {
  const [open, setOpen] =
    useState(true);

  const [settings, setSettings] =
    useState<Settings | null>(null);

  const [kitText, setKitText] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [notice, setNotice] =
    useState<{
      tone: 'ok' | 'err';
      text: string;
    } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    try {
      const response =
        await fetch(
          '/api/admin/clinicians/onboarding/settings',
          {
            cache: 'no-store',
            headers: {
              accept: 'application/json',
            },
          },
        );

      const body =
        await response
          .json()
          .catch(() => ({}));

      if (
        !response.ok ||
        body?.ok !== true ||
        !body?.settings
      ) {
        throw new Error(
          body?.error ||
          `HTTP ${response.status}`,
        );
      }

      const next =
        mergeSettings(body.settings);

      setSettings(next);
      setKitText(
        next.starterKitItems.join('\n'),
      );
    } catch (error: any) {
      setNotice({
        tone: 'err',
        text:
          error?.message ||
          'Unable to load settings.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fullKit =
    useMemo(
      () => cleanLines(kitText),
      [kitText],
    );

  function patchSettings(
    patch: Partial<Settings>,
  ) {
    setSettings((current) =>
      current
        ? {...current, ...patch}
        : current,
    );
  }

  function patchPolicy(
    patch: Partial<TrainingPolicy>,
  ) {
    setSettings((current) =>
      current
        ? {
            ...current,
            trainingPolicy: {
              ...current.trainingPolicy,
              ...patch,
            },
          }
        : current,
    );
  }

  function patchPathway(
    key: PathwayKey,
    patch: Omit<Partial<Pathway>, 'privileges'> & {
      privileges?: Partial<Privileges>;
    },
  ) {
    setSettings((current) => {
      if (!current) return current;

      return {
        ...current,
        commercialPathways:
          current.commercialPathways.map(
            (pathway) =>
              pathway.key === key
                ? {
                    ...pathway,
                    ...patch,
                    privileges:
                      patch.privileges
                        ? {
                            ...pathway
                              .privileges,
                            ...patch
                              .privileges,
                          }
                        : pathway
                            .privileges,
                  }
                : pathway,
          ),
      };
    });
  }

  function featurePathway(key: PathwayKey) {
    setSettings((current) =>
      current
        ? {
            ...current,
            commercialPathways:
              current.commercialPathways.map(
                (pathway) => ({
                  ...pathway,
                  enabled:
                    pathway.key === key
                      ? true
                      : pathway.enabled,
                  featured:
                    pathway.key === key,
                }),
              ),
          }
        : current,
    );
  }

  function toggleDepositItem(item: string) {
    if (!settings) return;

    const selected =
      settings.starterKitDepositItems
        .some(
          (current) =>
            current.toLowerCase() ===
            item.toLowerCase(),
        );

    patchSettings({
      starterKitDepositItems:
        selected
          ? settings
              .starterKitDepositItems
              .filter(
                (current) =>
                  current.toLowerCase() !==
                  item.toLowerCase(),
              )
          : [
              ...settings
                .starterKitDepositItems,
              item,
            ],
    });
  }

  function toggleMode(
    mode: 'virtual' | 'in_person',
  ) {
    if (!settings) return;

    const current =
      settings.trainingPolicy.allowedModes;

    const next =
      current.includes(mode)
        ? current.filter(
            (item) => item !== mode,
          )
        : [...current, mode];

    if (next.length) {
      patchPolicy({
        allowedModes: next,
      });
    }
  }

  async function save() {
    if (!settings) return;

    setSaving(true);
    setNotice(null);

    try {
      const kitByIdentity =
        new Map(
          fullKit.map((item) => [
            item.toLowerCase(),
            item,
          ]),
        );

      const starterKitDepositItems =
        settings.starterKitDepositItems
          .map((item) =>
            kitByIdentity.get(
              item.toLowerCase(),
            ),
          )
          .filter(Boolean);

      const response =
        await fetch(
          '/api/admin/clinicians/onboarding/settings',
          {
            method: 'PATCH',
            headers: {
              accept: 'application/json',
              'content-type':
                'application/json',
            },
            body: JSON.stringify({
              ...settings,
              starterKitItems:
                fullKit,
              starterKitDepositItems,
            }),
          },
        );

      const body =
        await response
          .json()
          .catch(() => ({}));

      if (
        !response.ok ||
        body?.ok !== true
      ) {
        throw new Error(
          body?.error ||
          `HTTP ${response.status}`,
        );
      }

      const next =
        mergeSettings(body.settings);

      setSettings(next);
      setKitText(
        next.starterKitItems.join('\n'),
      );

      setNotice({
        tone: 'ok',
        text:
          'Training, payment and C-Med policy saved successfully.',
      });
    } catch (error: any) {
      setNotice({
        tone: 'err',
        text: errorText(error?.message),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading && !settings) {
    return (
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">
          Loading clinician onboarding policy…
        </div>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <div className="text-sm font-semibold text-rose-900">
          The onboarding policy could not be loaded.
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white"
        >
          Retry
        </button>
      </section>
    );
  }

  const bank =
    settings.bankInstructions || {};

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b bg-gradient-to-r from-slate-950 to-indigo-950 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
            Admin-configured control plane
          </div>
          <h2 className="mt-1 text-xl font-black">
            Training, payments and C-Med policy
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">
            These settings drive the clinician-facing onboarding experience and fulfilment rules.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/15"
        >
          {open ? 'Collapse policy' : 'Open policy'}
        </button>
      </header>

      {notice ? (
        <div
          className={[
            'mx-5 mt-5 rounded-xl border p-3 text-sm',
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900',
          ].join(' ')}
        >
          {notice.text}
        </div>
      ) : null}

      {open ? (
        <div className="space-y-6 p-5">
          <section className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <h3 className="font-black text-slate-950">
                Payment amounts
              </h3>

              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Full onboarding fee
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={centsToAmount(
                      settings.trainingFeeCents,
                    )}
                    onChange={(event) =>
                      patchSettings({
                        trainingFeeCents:
                          amountToCents(
                            event.target.value,
                          ),
                      })
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="flex gap-2 rounded-xl border bg-white p-3 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      settings.allowPartialPayment
                    }
                    onChange={(event) =>
                      patchSettings({
                        allowPartialPayment:
                          event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong className="block text-slate-950">
                      Enable deposit pathway
                    </strong>
                    Allow a qualifying partial payment.
                  </span>
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Minimum qualifying deposit
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={
                      !settings.allowPartialPayment
                    }
                    value={centsToAmount(
                      settings
                        .minimumInitialPaymentCents,
                    )}
                    onChange={(event) =>
                      patchSettings({
                        minimumInitialPaymentCents:
                          amountToCents(
                            event.target.value,
                          ),
                      })
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold text-slate-700">
                    Currency
                    <input
                      value={settings.currency}
                      maxLength={3}
                      onChange={(event) =>
                        patchSettings({
                          currency:
                            event.target.value
                              .toUpperCase(),
                        })
                      }
                      className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="text-xs font-bold text-slate-700">
                    Provider
                    <select
                      value={
                        settings.paymentProvider
                      }
                      onChange={(event) =>
                        patchSettings({
                          paymentProvider:
                            event.target.value as
                              | 'paystack'
                              | 'payfast',
                        })
                      }
                      className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    >
                      <option value="paystack">
                        Paystack
                      </option>
                      <option value="payfast">
                        PayFast
                      </option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-slate-50 p-4">
              <h3 className="font-black text-slate-950">
                Accepted payment routes
              </h3>

              <div className="mt-4 space-y-3">
                <label className="flex gap-2 rounded-xl border bg-white p-3 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      settings.cardPaymentEnabled
                    }
                    onChange={(event) =>
                      patchSettings({
                        cardPaymentEnabled:
                          event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong className="block text-slate-950">
                      Card checkout
                    </strong>
                    Use the configured provider.
                  </span>
                </label>

                <label className="flex gap-2 rounded-xl border bg-white p-3 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      settings.manualPaymentEnabled
                    }
                    onChange={(event) =>
                      patchSettings({
                        manualPaymentEnabled:
                          event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong className="block text-slate-950">
                      EFT/manual confirmation
                    </strong>
                    Admin confirms payment before issuing authorisation.
                  </span>
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Balance recovery
                  <select
                    value={
                      settings.balanceRecoveryMode
                    }
                    onChange={(event) =>
                      patchSettings({
                        balanceRecoveryMode:
                          event.target.value as
                            Settings['balanceRecoveryMode'],
                      })
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  >
                    <option value="manual">
                      Manual follow-up
                    </option>
                    <option value="payout_deduction">
                      Future payout deduction
                    </option>
                    <option value="disabled">
                      Disabled
                    </option>
                  </select>
                </label>

                <textarea
                  value={
                    settings.balanceRecoveryNotes ||
                    ''
                  }
                  onChange={(event) =>
                    patchSettings({
                      balanceRecoveryNotes:
                        event.target.value,
                    })
                  }
                  rows={4}
                  placeholder="Balance recovery instructions"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <h3 className="font-black text-indigo-950">
                Notice governance
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-indigo-900">
                Operational training notices are configured here. Contractual and Professional Indemnity wording must come from an approved published Legal version.
              </p>

              <a
                href="/admin/legal"
                className="mt-4 inline-flex rounded-xl bg-indigo-900 px-3 py-2 text-xs font-bold text-white"
              >
                Open Legal Department
              </a>

              <textarea
                value={
                  settings.trainingPolicy
                    .operationalNotice || ''
                }
                onChange={(event) =>
                  patchPolicy({
                    operationalNotice:
                      event.target.value,
                  })
                }
                rows={5}
                placeholder="Optional clinician-facing operational notice"
                className="mt-4 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </section>

          <section className="rounded-2xl border p-4">
            <h3 className="text-lg font-black text-slate-950">
              Training programme defaults
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Individual published programmes can override their dates, sessions, capacity and venue.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-bold text-slate-700 xl:col-span-2">
                Clinician-facing heading
                <input
                  value={
                    settings.trainingPolicy.heading
                  }
                  onChange={(event) =>
                    patchPolicy({
                      heading:
                        event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                Default duration (days)
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={
                    settings.trainingPolicy
                      .defaultDurationDays
                  }
                  onChange={(event) =>
                    patchPolicy({
                      defaultDurationDays:
                        Number(
                          event.target.value,
                        ) || 1,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                Default session minutes
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={
                    settings.trainingPolicy
                      .defaultSessionDurationMinutes
                  }
                  onChange={(event) =>
                    patchPolicy({
                      defaultSessionDurationMinutes:
                        Number(
                          event.target.value,
                        ) || 60,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                Timezone
                <input
                  value={
                    settings.trainingPolicy.timezone
                  }
                  onChange={(event) =>
                    patchPolicy({
                      timezone:
                        event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <div className="rounded-xl border bg-slate-50 p-3 xl:col-span-3">
                <div className="text-xs font-bold text-slate-700">
                  Available training modes
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                  {[
                    ['virtual', 'Virtual'],
                    ['in_person', 'In person'],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={
                          settings.trainingPolicy
                            .allowedModes
                            .includes(
                              value as
                                | 'virtual'
                                | 'in_person',
                            )
                        }
                        onChange={() =>
                          toggleMode(
                            value as
                              | 'virtual'
                              | 'in_person',
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <label className="text-xs font-bold text-slate-700 md:col-span-2">
                Introduction
                <textarea
                  value={
                    settings.trainingPolicy
                      .introduction
                  }
                  onChange={(event) =>
                    patchPolicy({
                      introduction:
                        event.target.value,
                    })
                  }
                  rows={4}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700 md:col-span-2">
                Support message
                <textarea
                  value={
                    settings.trainingPolicy
                      .supportMessage || ''
                  }
                  onChange={(event) =>
                    patchPolicy({
                      supportMessage:
                        event.target.value,
                    })
                  }
                  rows={4}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700 md:col-span-2">
                Virtual description
                <textarea
                  value={
                    settings.trainingPolicy
                      .virtualDescription
                  }
                  onChange={(event) =>
                    patchPolicy({
                      virtualDescription:
                        event.target.value,
                    })
                  }
                  rows={3}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700 md:col-span-2">
                In-person description
                <textarea
                  value={
                    settings.trainingPolicy
                      .inPersonDescription
                  }
                  onChange={(event) =>
                    patchPolicy({
                      inPersonDescription:
                        event.target.value,
                    })
                  }
                  rows={3}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-black text-slate-950">
              Payment options and attached privileges
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Order, wording, availability and benefits are consumed by the clinician experience.
            </p>

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              {settings.commercialPathways
                .slice()
                .sort(
                  (left, right) =>
                    left.displayOrder -
                    right.displayOrder,
                )
                .map((pathway) => (
                  <article
                    key={pathway.key}
                    className={[
                      'rounded-2xl border p-4',
                      pathway.featured
                        ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100'
                        : 'bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        {pathway.key}
                      </div>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={
                            pathway.enabled
                          }
                          disabled={
                            pathway.featured
                          }
                          onChange={(event) =>
                            patchPathway(
                              pathway.key,
                              {
                                enabled:
                                  event.target
                                    .checked,
                              },
                            )
                          }
                        />
                        Enabled
                      </label>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <label className="text-[11px] font-bold text-slate-700">
                        Order
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={
                            pathway.displayOrder
                          }
                          onChange={(event) =>
                            patchPathway(
                              pathway.key,
                              {
                                displayOrder:
                                  Number(
                                    event.target
                                      .value,
                                  ) || 1,
                              },
                            )
                          }
                          className="mt-1 w-full rounded-lg border px-2 py-2"
                        />
                      </label>

                      <label className="col-span-2 text-[11px] font-bold text-slate-700">
                        Badge
                        <input
                          value={
                            pathway.badge || ''
                          }
                          onChange={(event) =>
                            patchPathway(
                              pathway.key,
                              {
                                badge:
                                  event.target
                                    .value,
                              },
                            )
                          }
                          className="mt-1 w-full rounded-lg border px-2 py-2"
                        />
                      </label>
                    </div>

                    <input
                      value={pathway.label}
                      onChange={(event) =>
                        patchPathway(
                          pathway.key,
                          {
                            label:
                              event.target.value,
                          },
                        )
                      }
                      className="mt-3 w-full rounded-xl border px-3 py-2 text-sm font-bold"
                    />

                    <textarea
                      value={
                        pathway.description
                      }
                      onChange={(event) =>
                        patchPathway(
                          pathway.key,
                          {
                            description:
                              event.target.value,
                          },
                        )
                      }
                      rows={3}
                      className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                    />

                    <input
                      value={pathway.ctaLabel}
                      onChange={(event) =>
                        patchPathway(
                          pathway.key,
                          {
                            ctaLabel:
                              event.target.value,
                          },
                        )
                      }
                      className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                    />

                    <textarea
                      value={
                        pathway.conditions.join(
                          '\n',
                        )
                      }
                      onChange={(event) =>
                        patchPathway(
                          pathway.key,
                          {
                            conditions:
                              cleanLines(
                                event.target
                                  .value,
                              ),
                          },
                        )
                      }
                      rows={5}
                      className="mt-2 w-full rounded-xl border px-3 py-2 text-xs"
                      aria-label="Conditions, one per line"
                    />

                    <div className="mt-3 space-y-2 rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs font-black text-slate-900">
                        Privileges
                      </div>

                      {[
                        [
                          'trainingAccess',
                          'Training access',
                        ],
                        [
                          'practiceActivation',
                          'Practice activation',
                        ],
                        [
                          'platformIndemnityEligible',
                          'PI eligibility',
                        ],
                        [
                          'balanceRecoveryApplies',
                          'Balance recovery',
                        ],
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center justify-between gap-2 text-xs text-slate-700"
                        >
                          {label}
                          <input
                            type="checkbox"
                            checked={
                              Boolean(
                                pathway
                                  .privileges[
                                  key as keyof Privileges
                                ],
                              )
                            }
                            onChange={(event) =>
                              patchPathway(
                                pathway.key,
                                {
                                  privileges: {
                                    [key]:
                                      event.target
                                        .checked,
                                  },
                                },
                              )
                            }
                          />
                        </label>
                      ))}

                      <label className="block text-xs font-bold text-slate-700">
                        C-Med release
                        <select
                          value={
                            pathway.privileges
                              .starterKitRelease
                          }
                          onChange={(event) =>
                            patchPathway(
                              pathway.key,
                              {
                                privileges: {
                                  starterKitRelease:
                                    event.target
                                      .value as
                                      Privileges['starterKitRelease'],
                                },
                              },
                            )
                          }
                          className="mt-1 w-full rounded-lg border bg-white px-2 py-2"
                        >
                          <option value="none">
                            No C-Med Kit dispatch
                          </option>
                          <option value="deposit">
                            Deposit-kit subset
                          </option>
                          <option value="full">
                            Full configured kit
                          </option>
                        </select>
                      </label>
                    </div>

                    <label className="mt-3 flex gap-2 rounded-xl border border-indigo-200 bg-white p-3 text-xs font-bold text-indigo-950">
                      <input
                        type="radio"
                        name="featured-pathway"
                        checked={
                          pathway.featured
                        }
                        onChange={() =>
                          featurePathway(
                            pathway.key,
                          )
                        }
                      />
                      Feature this option
                    </label>
                  </article>
                ))}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border p-4">
              <h3 className="font-black text-slate-950">
                Full C-Med Kit
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                This is the sole source displayed to clinicians. One item per line.
              </p>
              <textarea
                value={kitText}
                onChange={(event) =>
                  setKitText(
                    event.target.value,
                  )
                }
                rows={13}
                className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
              />
              <div className="mt-2 text-xs text-slate-500">
                {fullKit.length} configured item(s)
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <h3 className="font-black text-slate-950">
                Deposit-pathway C-Med entitlement
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Select the full-kit items released after a qualifying deposit.
              </p>

              <div className="mt-3 max-h-80 space-y-2 overflow-auto rounded-xl border bg-slate-50 p-3">
                {fullKit.length ? (
                  fullKit.map((item) => (
                    <label
                      key={item}
                      className="flex items-start gap-2 rounded-lg border bg-white p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={
                          settings
                            .starterKitDepositItems
                            .some(
                              (selected) =>
                                selected
                                  .toLowerCase() ===
                                item
                                  .toLowerCase(),
                            )
                        }
                        onChange={() =>
                          toggleDepositItem(item)
                        }
                      />
                      {item}
                    </label>
                  ))
                ) : (
                  <div className="text-sm text-slate-600">
                    Add full-kit items first.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border p-4">
              <h3 className="font-black text-slate-950">
                EFT instructions
              </h3>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  ['bankName', 'Bank name'],
                  ['accountName', 'Account name'],
                  ['accountNumber', 'Account number'],
                  ['branchCode', 'Branch code'],
                  ['swiftCode', 'SWIFT code'],
                  [
                    'referenceFormat',
                    'Payment reference',
                  ],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="text-xs font-bold text-slate-700"
                  >
                    {label}
                    <input
                      value={bank[key] || ''}
                      onChange={(event) =>
                        patchSettings({
                          bankInstructions: {
                            ...bank,
                            [key]:
                              event.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    />
                  </label>
                ))}

                <label className="text-xs font-bold text-slate-700 sm:col-span-2">
                  Additional instructions
                  <textarea
                    value={
                      bank.instructions || ''
                    }
                    onChange={(event) =>
                      patchSettings({
                        bankInstructions: {
                          ...bank,
                          instructions:
                            event.target.value,
                        },
                      })
                    }
                    rows={4}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <h3 className="font-black text-slate-950">
                Internal operational notes
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Admin-only notes are never displayed to clinicians.
              </p>
              <textarea
                value={settings.notes || ''}
                onChange={(event) =>
                  patchSettings({
                    notes:
                      event.target.value,
                  })
                }
                rows={8}
                className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
          </section>

          <footer className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Saving updates the authoritative Gateway policy and records an Admin audit event.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void load()}
                className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                Reload
              </button>

              <button
                type="button"
                disabled={
                  saving ||
                  loading
                }
                onClick={() => void save()}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving
                  ? 'Saving…'
                  : 'Save authoritative policy'}
              </button>
            </div>
          </footer>
        </div>
      ) : null}
    </section>
  );
}
