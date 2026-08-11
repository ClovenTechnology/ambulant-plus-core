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
  standardPriceCents: number | null;
  promotionalPriceCents: number | null;
  promotionStartsAt: string | null;
  promotionEndsAt: string | null;
  amountDueTodayCents: number | null;
  promotionLabel: string | null;
};

type SignupPresentation = {
  heroHeading: string;
  heroIntroduction: string;
  noticeHeading: string;
  noticeBody: string;
  noticeSecondary: string;
  noticeCtaLabel: string;
  noticeCtaHref: string;
  optionalKitTitle: string;
  optionalKitDescription: string;
  successHeading: string;
  successBody: string;
  successSecondary: string;
  successCtaLabel: string;
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
  signupPresentation: SignupPresentation;
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
    label: 'Continue to Training',
    badge: 'Direct pathway',
    description:
      'Continue with your required training without purchasing a C-Med Kit. Once your credentials are verified, training is completed and your profile is approved, you can start consulting and earning on Ambulant+.',
    ctaLabel: 'Continue to Training',
    enabled: true,
    featured: true,
    conditions: [
      'R0 upfront — no mandatory onboarding payment is required.',
      'The C-Med Kit is optional and is not required to complete training.',
      'Credential verification, training completion and profile approval remain required before practice activation.',
    ],
    privileges: {
      trainingAccess: true,
      practiceActivation: true,
      starterKitRelease: 'none',
      platformIndemnityEligible: false,
      balanceRecoveryApplies: false,
    },
    standardPriceCents: 0,
    promotionalPriceCents: null,
    promotionStartsAt: null,
    promotionEndsAt: null,
    amountDueTodayCents: 0,
    promotionLabel: null,
  },
  {
    key: 'QUALIFYING_DEPOSIT',
    displayOrder: 2,
    label: 'C-Med Flex',
    badge: 'Flexible payment',
    description:
      'Get your discounted C-Med package with a qualifying initial payment and flexible settlement.',
    ctaLabel: 'Choose C-Med Flex',
    enabled: true,
    featured: false,
    conditions: [
      'A qualifying initial payment is due when you choose this optional C-Med pathway.',
      'Professional Indemnity / Medical Malpractice cover remains subject to eligibility and policy terms.',
    ],
    privileges: {
      trainingAccess: true,
      practiceActivation: true,
      starterKitRelease: 'deposit',
      platformIndemnityEligible: true,
      balanceRecoveryApplies: true,
    },
    standardPriceCents: null,
    promotionalPriceCents: null,
    promotionStartsAt: null,
    promotionEndsAt: null,
    amountDueTodayCents: null,
    promotionLabel: null,
  },
  {
    key: 'FULL_PAYMENT',
    displayOrder: 3,
    label: 'C-Med Full',
    badge: 'Best value',
    description:
      'Pay in full and receive the highest available C-Med package discount and priority fulfilment.',
    ctaLabel: 'Choose C-Med Full',
    enabled: true,
    featured: false,
    conditions: [
      'The current Admin-configured C-Med Full price is payable.',
      'Professional Indemnity / Medical Malpractice cover remains subject to eligibility and policy terms.',
    ],
    privileges: {
      trainingAccess: true,
      practiceActivation: true,
      starterKitRelease: 'full',
      platformIndemnityEligible: true,
      balanceRecoveryApplies: false,
    },
    standardPriceCents: null,
    promotionalPriceCents: null,
    promotionStartsAt: null,
    promotionEndsAt: null,
    amountDueTodayCents: null,
    promotionLabel: null,
  },
];

const DEFAULT_SIGNUP_PRESENTATION: SignupPresentation = {
  heroHeading: 'Join the Contactless Care Network',
  heroIntroduction: 'Complete your application and required training. Once verified, trained and approved, your profile can go live and you can start consulting on Ambulant+. No upfront onboarding payment is required.',
  noticeHeading: 'Start now - no mandatory upfront payment',
  noticeBody: 'Training is required, but payment is not. Complete your Ambulant+ training and, once your credentials are verified and your profile is approved, you can start consulting and earning on Ambulant+ without purchasing a C-Med Kit.',
  noticeSecondary: 'The Contactless Medicine Kit (C-Med Kit) is optional. If you choose one, clinicians receive discounted pricing with flexible payment options and tracked delivery.',
  noticeCtaLabel: 'View C-Med Kit & payment options',
  noticeCtaHref: '/clinicians/c-med-options',
  optionalKitTitle: 'Optional C-Med Kit',
  optionalKitDescription: "Add a discounted C-Med Kit if you want one, with flexible payment options and tracked delivery. Qualifying C-Med options also include access to Ambulant+'s platform-wide Professional Indemnity / Medical Malpractice cover, subject to eligibility and policy terms.",
  successHeading: 'Application submitted successfully',
  successBody: 'Your Ambulant+ clinician account has been created. Sign in to choose an available Ambulant+ training programme and complete your onboarding.',
  successSecondary: 'No upfront onboarding payment is required to continue. You can choose a discounted C-Med Kit with flexible payment options during the next step.',
  successCtaLabel: 'Sign in & continue to training',
};


const DEFAULT_POLICY: TrainingPolicy = {
  heading:
    'Mandatory clinician onboarding training',
  introduction:
    'Choose an available programme, select an eligible training mode, then choose how you would like to continue. No upfront payment is required for the direct training pathway.',
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
  signupPresentation: { ...DEFAULT_SIGNUP_PRESENTATION },
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

function optionalAmountToCents(value: string) {
  const clean = value.trim();
  return clean ? amountToCents(clean) : null;
}

function optionalCentsToAmount(value: number | null | undefined) {
  return value == null ? '' : centsToAmount(value);
}

function localDateTimeValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
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
        standardPriceCents:
          found.standardPriceCents == null ? fallback.standardPriceCents : Number(found.standardPriceCents),
        promotionalPriceCents:
          found.promotionalPriceCents == null ? null : Number(found.promotionalPriceCents),
        promotionStartsAt: found.promotionStartsAt || null,
        promotionEndsAt: found.promotionEndsAt || null,
        amountDueTodayCents:
          found.amountDueTodayCents == null ? fallback.amountDueTodayCents : Number(found.amountDueTodayCents),
        promotionLabel: String(found.promotionLabel || '').trim() || null,
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
      signupPresentation: {
        ...DEFAULT_SIGNUP_PRESENTATION,
        ...(raw?.trainingPolicy?.signupPresentation || {}),
      },
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

  function patchSignupPresentation(
    patch: Partial<SignupPresentation>,
  ) {
    setSettings((current) =>
      current
        ? {
            ...current,
            trainingPolicy: {
              ...current.trainingPolicy,
              signupPresentation: {
                ...current.trainingPolicy.signupPresentation,
                ...patch,
              },
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
          'Training and C-Med continuation policy saved successfully.',
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
            Training & C-Med commercial policy
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
                Compatibility amounts (derived)
              </h3>

              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Derived full-package reference
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled
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
                    disabled
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
                      C-Med Flex enabled
                    </strong>
                    This compatibility flag follows the C-Med Flex pathway.
                  </span>
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Derived C-Med Flex amount due today
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled
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

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
            <h3 className="text-lg font-black text-slate-950">Signup & public C-Med presentation</h3>
            <p className="mt-1 text-xs text-slate-600">Commercial messaging is published from this control plane. Identity, security, HPCSA and legal acknowledgement mechanics remain fixed in source.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ['heroHeading', 'Signup hero heading', 1],
                ['noticeHeading', 'Green notice heading', 1],
                ['noticeCtaLabel', 'Notice CTA label', 1],
                ['noticeCtaHref', 'Notice CTA path', 1],
                ['optionalKitTitle', 'Optional C-Med card title', 1],
                ['successHeading', 'Success heading', 1],
                ['successCtaLabel', 'Success CTA label', 1],
              ].map(([key, label]) => (
                <label key={String(key)} className="text-xs font-bold text-slate-700">
                  {label}
                  <input
                    value={String(settings.trainingPolicy.signupPresentation[key as keyof SignupPresentation] || '')}
                    onChange={(event) => patchSignupPresentation({ [key]: event.target.value } as Partial<SignupPresentation>)}
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  />
                </label>
              ))}
              {[
                ['heroIntroduction', 'Signup introduction'],
                ['noticeBody', 'Green notice main message'],
                ['noticeSecondary', 'Green notice C-Med message'],
                ['optionalKitDescription', 'Optional C-Med card description'],
                ['successBody', 'Success main message'],
                ['successSecondary', 'Success secondary message'],
              ].map(([key, label]) => (
                <label key={String(key)} className="text-xs font-bold text-slate-700 md:col-span-2">
                  {label}
                  <textarea
                    value={String(settings.trainingPolicy.signupPresentation[key as keyof SignupPresentation] || '')}
                    onChange={(event) => patchSignupPresentation({ [key]: event.target.value } as Partial<SignupPresentation>)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  />
                </label>
              ))}
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
              Continuation options, pricing and attached privileges
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Order, wording, pricing, promotion dates, availability and benefits are consumed by the public C-Med page and clinician training flow.
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

                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                      <div className="text-xs font-black text-emerald-950">Commercial pricing</div>
                      {pathway.key === 'START_NOW_PAY_LATER' ? (
                        <div className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-emerald-800">R0 upfront · direct training pathway</div>
                      ) : (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <label className="text-[11px] font-bold text-slate-700">
                            Standard total price
                            <input type="number" min="0" step="0.01" value={optionalCentsToAmount(pathway.standardPriceCents)} onChange={(event) => patchPathway(pathway.key, { standardPriceCents: optionalAmountToCents(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-2 py-2" />
                          </label>
                          <label className="text-[11px] font-bold text-slate-700">
                            Promotional total price
                            <input type="number" min="0" step="0.01" value={optionalCentsToAmount(pathway.promotionalPriceCents)} onChange={(event) => patchPathway(pathway.key, { promotionalPriceCents: optionalAmountToCents(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-2 py-2" />
                          </label>
                          {pathway.key === 'QUALIFYING_DEPOSIT' ? (
                            <label className="text-[11px] font-bold text-slate-700">
                              Amount due today
                              <input type="number" min="0" step="0.01" value={optionalCentsToAmount(pathway.amountDueTodayCents)} onChange={(event) => patchPathway(pathway.key, { amountDueTodayCents: optionalAmountToCents(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-2 py-2" />
                            </label>
                          ) : null}
                          <label className="text-[11px] font-bold text-slate-700">
                            Promotion label
                            <input value={pathway.promotionLabel || ''} onChange={(event) => patchPathway(pathway.key, { promotionLabel: event.target.value || null })} placeholder="Limited offer" className="mt-1 w-full rounded-lg border bg-white px-2 py-2" />
                          </label>
                          <label className="text-[11px] font-bold text-slate-700">
                            Promotion starts
                            <input type="datetime-local" value={localDateTimeValue(pathway.promotionStartsAt)} onChange={(event) => patchPathway(pathway.key, { promotionStartsAt: localDateTimeToIso(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-2 py-2" />
                          </label>
                          <label className="text-[11px] font-bold text-slate-700">
                            Promotion expires
                            <input type="datetime-local" value={localDateTimeValue(pathway.promotionEndsAt)} onChange={(event) => patchPathway(pathway.key, { promotionEndsAt: localDateTimeToIso(event.target.value) })} className="mt-1 w-full rounded-lg border bg-white px-2 py-2" />
                          </label>
                        </div>
                      )}
                    </div>

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
                            disabled={pathway.key === 'START_NOW_PAY_LATER'}
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
