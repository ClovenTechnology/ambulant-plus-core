// apps/admin-dashboard/app/admin/clinicians/onboarding/OnboardingSettingsPanel.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type BalanceRecoveryMode = 'manual' | 'payout_deduction' | 'disabled';

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
  paymentProvider: 'paystack' | 'payfast' | 'mock';
  cardPaymentEnabled: boolean;
  manualPaymentEnabled: boolean;
  starterKitItems: string[];
  bankInstructions: BankInstructions | null;
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
  const [paymentProvider, setPaymentProvider] = useState<'paystack' | 'payfast' | 'mock'>('paystack');
  const [cardPaymentEnabled, setCardPaymentEnabled] = useState(true);
  const [manualPaymentEnabled, setManualPaymentEnabled] = useState(true);
  const [starterKitText, setStarterKitText] = useState(DEFAULT_STARTER_KIT_TEXT);
  const [notes, setNotes] = useState('');

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
      setPaymentProvider(s.paymentProvider || 'paystack');
      setCardPaymentEnabled(s.cardPaymentEnabled !== false);
      setManualPaymentEnabled(s.manualPaymentEnabled !== false);
      setStarterKitText((s.starterKitItems || []).length ? s.starterKitItems.join('\n') : DEFAULT_STARTER_KIT_TEXT);
      setNotes(s.notes || '');

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

      setNotice({ tone: 'ok', text: 'Onboarding payment settings saved successfully.' });
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
                    onChange={(e) => setPaymentProvider(e.target.value as 'paystack' | 'payfast' | 'mock')}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    <option value="paystack">Paystack</option>
                    <option value="payfast">PayFast</option>
                    <option value="mock">Mock / disabled sandbox</option>
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

