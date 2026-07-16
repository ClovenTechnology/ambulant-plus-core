// apps/admin-dashboard/app/admin/clinicians/onboarding/OnboardingSettingsPanel.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type BalanceRecoveryMode = 'manual' | 'payout_deduction' | 'disabled';

type OnboardingPathwayKey =
  | 'START_NOW_PAY_LATER'
  | 'QUALIFYING_DEPOSIT'
  | 'FULL_PAYMENT';

type CommercialPathway = {
  key: OnboardingPathwayKey;
  displayOrder: number;
  label: string;
  badge: string | null;
  description: string;
  ctaLabel: string;
  enabled: boolean;
  featured: boolean;
  conditions: string[];
};

const DEFAULT_COMMERCIAL_PATHWAYS: CommercialPathway[] = [
  {
    key: 'START_NOW_PAY_LATER',
    displayOrder: 1,
    label: 'Start Now — Pay Later',
    badge: 'Fastest start',
    description:
      'Begin training after Ambulant+ Admin approves your Pay Later request, without making an upfront onboarding payment.',
    ctaLabel: 'Request Pay Later approval',
    enabled: true,
    featured: true,
    conditions: [
      'Training access begins after Admin approval.',
      'No permanent C-Med Kit is dispatched until the qualifying initial payment is received.',
      'Platform-wide Professional Indemnity cover does not commence until a qualifying payment is received and all applicable policy conditions are satisfied.',
      'Any outstanding onboarding balance remains payable under the applicable agreement.',
    ],
  },
  {
    key: 'QUALIFYING_DEPOSIT',
    displayOrder: 2,
    label: 'Start with Initial Deposit',
    badge: 'Balanced option',
    description:
      'Pay the Admin-configured qualifying initial amount and proceed with training and partial C-Med Kit fulfilment.',
    ctaLabel: 'Pay initial deposit',
    enabled: true,
    featured: false,
    conditions: [
      'The qualifying initial amount is configured by Ambulant+ Admin.',
      'Initial C-Med Kit fulfilment excludes the HD Otoscope and complimentary merchandise until the outstanding balance is settled.',
      'Platform-wide Professional Indemnity cover becomes available subject to all applicable eligibility and policy conditions.',
      'The remaining onboarding balance remains payable under the applicable agreement.',
    ],
  },
  {
    key: 'FULL_PAYMENT',
    displayOrder: 3,
    label: 'Pay in Full',
    badge: 'Complete package',
    description:
      'Settle the complete onboarding fee and proceed with full C-Med Kit fulfilment.',
    ctaLabel: 'Pay full onboarding fee',
    enabled: true,
    featured: false,
    conditions: [
      'The full Admin-configured onboarding fee is payable.',
      'The complete C-Med Kit, including the HD Otoscope and eligible complimentary merchandise, can be dispatched.',
      'Platform-wide Professional Indemnity cover becomes available subject to all applicable eligibility and policy conditions.',
      'There is no outstanding onboarding-fee balance after confirmed full payment.',
    ],
  },
];

type BankInstructions = {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branchCode?: string;
  swiftCode?: string;
  referenceFormat?: string;
  instructions?: string;
};

type OnboardingSettings = {
  trainingFeeCents: number;
  minimumInitialPaymentCents: number;
  allowPartialPayment: boolean;
  balanceRecoveryMode: BalanceRecoveryMode;
  balanceRecoveryNotes: string | null;
  currency: string;
  paymentProvider: 'paystack' | 'payfast';
  cardPaymentEnabled: boolean;
  manualPaymentEnabled: boolean;
  starterKitItems: string[];
  bankInstructions: BankInstructions | null;
  commercialPathways: CommercialPathway[];
  notes: string | null;
};

type SettingsResponse = {
  ok: boolean;
  settings?: OnboardingSettings;
  publicSettings?: Partial<OnboardingSettings>;
  error?: string;
};

const DEFAULT_STARTER_KIT_TEXT = [
  'DueCare 6-in-1 Health Monitor (IoMT)',
  'NexRing (IoMT)',
  'Digital Stethoscope (IoMT)',
  'HD Otoscope (IoMT)',
  'Clinician Handbook',
  'Consumables pack',
  'Ambulant+ formal shirt (Black)',
  'Ambulant+ formal shirt (White)',
  'Ambulant+ Mug',
  'Ambulant+ Thermo Bottle',
  'Smart ID + card holder + lanyard',
].join('\n');

function centsToRand(cents: number) {
  const n = Number(cents || 0) / 100;
  return Number.isFinite(n) ? String(n) : '0';
}

function randToCents(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function normaliseItems(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function cloneDefaultCommercialPathways(): CommercialPathway[] {
  return DEFAULT_COMMERCIAL_PATHWAYS.map(
    (pathway) => ({
      ...pathway,
      conditions: [
        ...pathway.conditions,
      ],
    }),
  );
}

function normaliseCommercialPathways(
  value: unknown,
): CommercialPathway[] {
  const incoming =
    Array.isArray(value)
      ? value
      : [];

  const result =
    cloneDefaultCommercialPathways().map(
      (fallback) => {
        const raw = incoming.find(
          (candidate: any) =>
            String(
              candidate?.key || '',
            )
              .trim()
              .toUpperCase() ===
            fallback.key,
        ) as any;

        if (!raw) {
          return fallback;
        }

        const requestedOrder =
          Number(raw.displayOrder);

        const conditions =
          Array.isArray(raw.conditions)
            ? raw.conditions
                .map((item: unknown) =>
                  String(item || '').trim(),
                )
                .filter(Boolean)
                .slice(0, 12)
            : fallback.conditions;

        const hasBadge =
          Object.prototype.hasOwnProperty.call(
            raw,
            'badge',
          );

        return {
          key: fallback.key,
          displayOrder:
            Number.isFinite(requestedOrder)
              ? Math.min(
                  99,
                  Math.max(
                    1,
                    Math.round(
                      requestedOrder,
                    ),
                  ),
                )
              : fallback.displayOrder,
          label:
            String(
              raw.label || '',
            ).trim() ||
            fallback.label,
          badge: hasBadge
            ? String(
                raw.badge || '',
              ).trim() ||
              null
            : fallback.badge,
          description:
            String(
              raw.description || '',
            ).trim() ||
            fallback.description,
          ctaLabel:
            String(
              raw.ctaLabel || '',
            ).trim() ||
            fallback.ctaLabel,
          enabled:
            raw.enabled !== false,
          featured:
            raw.featured === true,
          conditions:
            conditions.length > 0
              ? conditions
              : [
                  ...fallback.conditions,
                ],
        };
      },
    );

  return result.sort(
    (left, right) =>
      left.displayOrder -
        right.displayOrder ||
      DEFAULT_COMMERCIAL_PATHWAYS.findIndex(
        (item) =>
          item.key === left.key,
      ) -
        DEFAULT_COMMERCIAL_PATHWAYS.findIndex(
          (item) =>
            item.key === right.key,
        ),
  );
}

function moneyPreview(amount: string, currency: string) {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency || 'ZAR',
    }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return `${currency || 'ZAR'} ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
  }
}

export default function OnboardingSettingsPanel() {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const [trainingFee, setTrainingFee] = useState('0');
  const [minimumInitialPayment, setMinimumInitialPayment] = useState('0');
  const [allowPartialPayment, setAllowPartialPayment] = useState(false);
  const [balanceRecoveryMode, setBalanceRecoveryMode] = useState<BalanceRecoveryMode>('manual');
  const [balanceRecoveryNotes, setBalanceRecoveryNotes] = useState('');

  const [currency, setCurrency] = useState('ZAR');
  const [paymentProvider, setPaymentProvider] = useState<'paystack' | 'payfast'>('paystack');
  const [cardPaymentEnabled, setCardPaymentEnabled] = useState(true);
  const [manualPaymentEnabled, setManualPaymentEnabled] = useState(true);
  const [starterKitText, setStarterKitText] = useState(DEFAULT_STARTER_KIT_TEXT);
  const [notes, setNotes] = useState('');
  const [commercialPathways, setCommercialPathways] =
    useState<CommercialPathway[]>(
      cloneDefaultCommercialPathways,
    );

  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [referenceFormat, setReferenceFormat] = useState(
    'Use your full name and Ambulant+ clinician ID as payment reference.',
  );
  const [bankInstructions, setBankInstructions] = useState('');

  const starterKitCount = useMemo(() => normaliseItems(starterKitText).length, [starterKitText]);

  const orderedCommercialPathways =
    useMemo(
      () =>
        normaliseCommercialPathways(
          commercialPathways,
        ),
      [commercialPathways],
    );

  const updateCommercialPathway = (
    key: OnboardingPathwayKey,
    patch: Partial<CommercialPathway>,
  ) => {
    setCommercialPathways(
      (current) =>
        current.map(
          (pathway) =>
            pathway.key === key
              ? {
                  ...pathway,
                  ...patch,
                  key,
                }
              : pathway,
        ),
    );
  };

  const featureCommercialPathway = (
    key: OnboardingPathwayKey,
  ) => {
    setCommercialPathways(
      (current) =>
        current.map(
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
    );
  };

  const fullFeeCents = randToCents(trainingFee);
  const minimumCents = randToCents(minimumInitialPayment);
  const outstandingAfterMinimum = Math.max(0, fullFeeCents - minimumCents);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/clinicians/onboarding/settings', {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });

      const js = (await res.json().catch(() => ({}))) as SettingsResponse;
      if (!res.ok || !js.ok || !js.settings) {
        throw new Error(js.error || `HTTP ${res.status} loading settings`);
      }

      const s = js.settings;
      setTrainingFee(centsToRand(s.trainingFeeCents));
      setMinimumInitialPayment(centsToRand(s.minimumInitialPaymentCents || 0));
      setAllowPartialPayment(s.allowPartialPayment === true);
      setBalanceRecoveryMode(s.balanceRecoveryMode || 'manual');
      setBalanceRecoveryNotes(s.balanceRecoveryNotes || '');

      setCurrency(s.currency || 'ZAR');
      setPaymentProvider(s.paymentProvider === 'payfast' ? 'payfast' : 'paystack');
      setCardPaymentEnabled(s.cardPaymentEnabled !== false);
      setManualPaymentEnabled(s.manualPaymentEnabled !== false);
      setStarterKitText((s.starterKitItems || []).length ? s.starterKitItems.join('\n') : DEFAULT_STARTER_KIT_TEXT);
      setNotes(s.notes || '');
      setCommercialPathways(
        normaliseCommercialPathways(
          s.commercialPathways,
        ),
      );

      const bank = s.bankInstructions || {};
      setBankName(bank.bankName || '');
      setAccountName(bank.accountName || '');
      setAccountNumber(bank.accountNumber || '');
      setBranchCode(bank.branchCode || '');
      setSwiftCode(bank.swiftCode || '');
      setReferenceFormat(bank.referenceFormat || 'Use your full name and Ambulant+ clinician ID as payment reference.');
      setBankInstructions(bank.instructions || '');
    } catch (err: any) {
      setNotice({ tone: 'err', text: err?.message || 'Failed to load onboarding settings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    setNotice(null);

    const trainingFeeCents = randToCents(trainingFee);
    const minimumInitialPaymentCents = randToCents(minimumInitialPayment);
    const starterKitItems = normaliseItems(starterKitText);
    const configuredPathways =
      normaliseCommercialPathways(
        commercialPathways,
      );

    const enabledPathways =
      configuredPathways.filter(
        (pathway) =>
          pathway.enabled,
      );

    const featuredPathways =
      configuredPathways.filter(
        (pathway) =>
          pathway.featured,
      );

    const displayOrders =
      configuredPathways.map(
        (pathway) =>
          pathway.displayOrder,
      );

    if (enabledPathways.length === 0) {
      setNotice({
        tone: 'err',
        text: 'Enable at least one clinician onboarding pathway.',
      });
      return;
    }

    if (
      featuredPathways.length !== 1 ||
      featuredPathways[0]?.enabled !== true
    ) {
      setNotice({
        tone: 'err',
        text: 'Select exactly one enabled pathway as the featured option.',
      });
      return;
    }

    if (
      new Set(displayOrders).size !==
      displayOrders.length
    ) {
      setNotice({
        tone: 'err',
        text: 'Each onboarding pathway must have a unique display order.',
      });
      return;
    }

    const incompletePathway =
      configuredPathways.find(
        (pathway) =>
          !pathway.label.trim() ||
          !pathway.description.trim() ||
          !pathway.ctaLabel.trim() ||
          pathway.conditions.length === 0,
      );

    if (incompletePathway) {
      setNotice({
        tone: 'err',
        text: 'Every pathway requires a heading, description, action label and at least one condition.',
      });
      return;
    }

    if (trainingFeeCents <= 0) {
      setNotice({ tone: 'err', text: 'Full onboarding fee must be greater than zero before clinicians can pay online.' });
      return;
    }

    if (allowPartialPayment && minimumInitialPaymentCents <= 0) {
      setNotice({ tone: 'err', text: 'Minimum initial deposit is required when partial payment is enabled.' });
      return;
    }

    if (allowPartialPayment && minimumInitialPaymentCents > trainingFeeCents) {
      setNotice({ tone: 'err', text: 'Minimum initial deposit cannot exceed the full onboarding fee.' });
      return;
    }

    if (!cardPaymentEnabled && !manualPaymentEnabled) {
      setNotice({ tone: 'err', text: 'Enable at least one payment method: card or EFT/manual payment.' });
      return;
    }

    if (starterKitItems.length === 0) {
      setNotice({ tone: 'err', text: 'Add at least one C-Med Kit item.' });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/admin/clinicians/onboarding/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          trainingFeeCents,
          minimumInitialPaymentCents,
          allowPartialPayment,
          balanceRecoveryMode,
          balanceRecoveryNotes: balanceRecoveryNotes.trim() || null,
          currency,
          paymentProvider,
          cardPaymentEnabled,
          manualPaymentEnabled,
          starterKitItems,
          commercialPathways:
            configuredPathways,
          bankInstructions: {
            bankName: bankName.trim(),
            accountName: accountName.trim(),
            accountNumber: accountNumber.trim(),
            branchCode: branchCode.trim(),
            swiftCode: swiftCode.trim(),
            referenceFormat: referenceFormat.trim(),
            instructions: bankInstructions.trim(),
          },
          notes: notes.trim() || null,
        }),
      });

      const js = (await res.json().catch(() => ({}))) as SettingsResponse;
      if (!res.ok || !js.ok) {
        throw new Error(js.error || `HTTP ${res.status} saving settings`);
      }

      setNotice({ tone: 'ok', text: 'Onboarding payment and pathway settings saved successfully.' });
      await loadSettings();
    } catch (err: any) {
      setNotice({ tone: 'err', text: err?.message || 'Failed to save onboarding settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Clinician onboarding payment settings</h2>
          <p className="mt-1 text-xs text-gray-600">
            Configure onboarding fees, partial-payment rules, payment methods, EFT details and C-Med Kit contents.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
        >
          {open ? 'Hide settings' : 'Show settings'}
        </button>
      </div>

      {notice && (
        <div
          className={[
            'mx-4 mt-3 rounded border p-3 text-xs',
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900',
          ].join(' ')}
        >
          {notice.text}
        </div>
      )}

      {open && (
        <div className="space-y-4 px-4 py-4">
          {loading ? (
            <div className="rounded border bg-slate-50 p-3 text-xs text-gray-600">
              Loading onboarding settings...
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-slate-50 p-3 lg:col-span-1">
              <div className="text-xs font-semibold text-gray-900">Fee and deposit</div>

              <div className="mt-3 grid gap-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-gray-700">Full onboarding fee</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={trainingFee}
                    onChange={(e) => setTrainingFee(e.target.value)}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    placeholder="26500"
                  />
                </label>

                <label className="flex items-start gap-2 rounded-lg border bg-white p-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={allowPartialPayment}
                    onChange={(e) => setAllowPartialPayment(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-semibold text-gray-800">Allow partial initial payment</span>
                    Clinicians can train/start after paying the configured minimum deposit.
                  </span>
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-gray-700">Minimum initial deposit</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minimumInitialPayment}
                    onChange={(e) => setMinimumInitialPayment(e.target.value)}
                    disabled={!allowPartialPayment}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="7950"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-gray-700">Currency</span>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    <option value="ZAR">ZAR</option>
                    <option value="NGN">NGN</option>
                    <option value="GBP">GBP</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 space-y-2 rounded-lg border bg-white p-2 text-xs text-gray-700">
                <div>
                  Full fee:{' '}
                  <span className="font-semibold text-gray-900">{moneyPreview(trainingFee, currency)}</span>
                </div>
                <div>
                  Initial amount due:{' '}
                  <span className="font-semibold text-gray-900">
                    {allowPartialPayment ? moneyPreview(minimumInitialPayment, currency) : moneyPreview(trainingFee, currency)}
                  </span>
                </div>
                {allowPartialPayment ? (
                  <div>
                    Outstanding after minimum:{' '}
                    <span className="font-semibold text-gray-900">
                      {moneyPreview(String(outstandingAfterMinimum / 100), currency)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border bg-slate-50 p-3 lg:col-span-1">
              <div className="text-xs font-semibold text-gray-900">Payment methods</div>

              <div className="mt-3 space-y-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-gray-700">Card provider</span>
                  <select
                    value={paymentProvider}
                    onChange={(e) => setPaymentProvider(e.target.value as 'paystack' | 'payfast')}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    <option value="paystack">Paystack</option>
                    <option value="payfast">PayFast</option>
                  </select>
                </label>

                <label className="flex items-start gap-2 rounded-lg border bg-white p-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={cardPaymentEnabled}
                    onChange={(e) => setCardPaymentEnabled(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-semibold text-gray-800">Enable card checkout</span>
                    Clinicians can pay online using the configured card provider.
                  </span>
                </label>

                <label className="flex items-start gap-2 rounded-lg border bg-white p-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={manualPaymentEnabled}
                    onChange={(e) => setManualPaymentEnabled(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-semibold text-gray-800">Enable EFT/manual authorisation</span>
                    Admin can confirm direct EFT payments and generate one-time authorisation codes.
                  </span>
                </label>
              </div>
            </div>

            <div className="rounded-xl border bg-slate-50 p-3 lg:col-span-1">
              <div className="text-xs font-semibold text-gray-900">Balance recovery</div>

              <div className="mt-3 space-y-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-gray-700">Recovery mode</span>
                  <select
                    value={balanceRecoveryMode}
                    onChange={(e) => setBalanceRecoveryMode(e.target.value as BalanceRecoveryMode)}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    <option value="manual">Manual follow-up</option>
                    <option value="payout_deduction">Deduct from future payouts</option>
                    <option value="disabled">No recovery configured</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-gray-700">Balance recovery notes</span>
                  <textarea
                    value={balanceRecoveryNotes}
                    onChange={(e) => setBalanceRecoveryNotes(e.target.value)}
                    rows={5}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    placeholder="Example: deduct outstanding balance from clinician payouts before release."
                  />
                </label>

                <div className="rounded-lg border bg-white p-3 text-xs text-gray-700">
                  <span className="font-semibold text-gray-900">{starterKitCount}</span> C-Med Kit item(s) configured.
                </div>
              </div>
            </div>
          </div>


          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
            <div className="flex flex-col gap-3 border-b border-indigo-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-black text-slate-950">
                  Clinician-facing onboarding pathways
                </div>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
                  Configure the order and presentation of the three approved commercial pathways.
                  The featured pathway is visually emphasised but is never silently selected for the clinician.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCommercialPathways(
                    cloneDefaultCommercialPathways(),
                  )
                }
                disabled={saving || loading}
                className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-50"
              >
                Restore default presentation
              </button>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              {orderedCommercialPathways.map(
                (pathway) => (
                  <article
                    key={pathway.key}
                    className={[
                      'rounded-2xl border p-4 shadow-sm transition',
                      pathway.featured
                        ? 'border-purple-300 bg-white ring-2 ring-purple-100'
                        : 'border-slate-200 bg-white',
                      pathway.enabled
                        ? ''
                        : 'opacity-60',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                          {pathway.key}
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-950">
                          {pathway.label}
                        </div>
                      </div>

                      {pathway.featured ? (
                        <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-black text-purple-800">
                          Featured
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-700">
                          Display order
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          step="1"
                          value={pathway.displayOrder}
                          onChange={(event) =>
                            updateCommercialPathway(
                              pathway.key,
                              {
                                displayOrder:
                                  Number(
                                    event.target.value,
                                  ) || 1,
                              },
                            )
                          }
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-700">
                          Promotional badge
                        </span>
                        <input
                          value={pathway.badge || ''}
                          onChange={(event) =>
                            updateCommercialPathway(
                              pathway.key,
                              {
                                badge:
                                  event.target.value,
                              },
                            )
                          }
                          placeholder="Optional badge"
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-700">
                          Card heading
                        </span>
                        <input
                          value={pathway.label}
                          onChange={(event) =>
                            updateCommercialPathway(
                              pathway.key,
                              {
                                label:
                                  event.target.value,
                              },
                            )
                          }
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-700">
                          Action label
                        </span>
                        <input
                          value={pathway.ctaLabel}
                          onChange={(event) =>
                            updateCommercialPathway(
                              pathway.key,
                              {
                                ctaLabel:
                                  event.target.value,
                              },
                            )
                          }
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-700">
                          Description
                        </span>
                        <textarea
                          value={pathway.description}
                          onChange={(event) =>
                            updateCommercialPathway(
                              pathway.key,
                              {
                                description:
                                  event.target.value,
                              },
                            )
                          }
                          rows={4}
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-700">
                          Conditions — one per line
                        </span>
                        <textarea
                          value={pathway.conditions.join('\n')}
                          onChange={(event) =>
                            updateCommercialPathway(
                              pathway.key,
                              {
                                conditions:
                                  normaliseItems(
                                    event.target.value,
                                  ),
                              },
                            )
                          }
                          rows={7}
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        />
                      </label>
                    </div>

                    <div className="mt-4 grid gap-2 border-t pt-3">
                      <label className="flex items-start gap-2 rounded-lg border bg-slate-50 p-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={pathway.enabled}
                          disabled={pathway.featured}
                          onChange={(event) =>
                            updateCommercialPathway(
                              pathway.key,
                              {
                                enabled:
                                  event.target.checked,
                              },
                            )
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block font-semibold text-slate-900">
                            Enabled
                          </span>
                          {pathway.featured
                            ? 'Choose another featured pathway before disabling this one.'
                            : 'Show this option to clinicians.'}
                        </span>
                      </label>

                      <label className="flex items-start gap-2 rounded-lg border border-purple-100 bg-purple-50 p-2 text-xs text-purple-900">
                        <input
                          type="radio"
                          name="featured-onboarding-pathway"
                          checked={pathway.featured}
                          onChange={() =>
                            featureCommercialPathway(
                              pathway.key,
                            )
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block font-semibold">
                            Feature this pathway
                          </span>
                          Visual emphasis only; it does not preselect or accept the pathway for the clinician.
                        </span>
                      </label>
                    </div>

                    <div className="mt-4 rounded-xl border border-dashed bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Card preview
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-950">
                          {pathway.label}
                        </span>
                        {pathway.badge ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                            {pathway.badge}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        {pathway.description}
                      </p>
                      <div className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white">
                        {pathway.ctaLabel}
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-xs font-semibold text-gray-900">EFT / bank details</div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-gray-700">Bank name</span>
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-gray-700">Account name</span>
                  <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-gray-700">Account number</span>
                  <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-gray-700">Branch code</span>
                  <input value={branchCode} onChange={(e) => setBranchCode(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
                </label>

                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-gray-700">SWIFT code / extra banking code</span>
                  <input value={swiftCode} onChange={(e) => setSwiftCode(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
                </label>

                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-gray-700">Payment reference instruction</span>
                  <input value={referenceFormat} onChange={(e) => setReferenceFormat(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
                </label>

                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-gray-700">Additional EFT instructions</span>
                  <textarea value={bankInstructions} onChange={(e) => setBankInstructions(e.target.value)} rows={4} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
                </label>
              </div>
            </div>

            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-xs font-semibold text-gray-900">C-Med Kit contents</div>

              <label className="mt-3 block space-y-1">
                <span className="text-[11px] font-semibold text-gray-700">One item per line</span>
                <textarea
                  value={starterKitText}
                  onChange={(e) => setStarterKitText(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="mt-3 block space-y-1">
                <span className="text-[11px] font-semibold text-gray-700">Internal notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  placeholder="Optional admin-only operational note"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] text-gray-500">
              Prices are stored in the gateway database and can be changed by authorised Admin users whenever management changes onboarding pricing.
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadSettings}
                disabled={saving || loading}
                className="rounded-lg border bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                Reload
              </button>

              <button
                type="button"
                onClick={saveSettings}
                disabled={saving || loading}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save onboarding settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

