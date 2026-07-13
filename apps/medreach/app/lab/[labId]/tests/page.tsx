'use client';

// apps/medreach/app/lab/[labId]/tests/page.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

function humanErrorMessage(value: unknown, fallback = "Unable to complete this request. Please try again.") {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value instanceof Error) {
    const text = value.message.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["message", "error", "detail", "reason", "statusText", "code"]) {
      const candidate = record[key];

      if (typeof candidate === "string") {
        const text = candidate.trim();
        if (text && text !== "[object Object]") return text;
      }

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;

        for (const nestedKey of ["message", "error", "detail", "reason", "statusText", "code"]) {
          const nestedCandidate = nested[nestedKey];

          if (typeof nestedCandidate === "string") {
            const text = nestedCandidate.trim();
            if (text && text !== "[object Object]") return text;
          }
        }
      }
    }
  }

  if (value != null) {
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }

  return fallback;
}


type OfferedTest = {
  id?: string;
  labId?: string;
  catalogTestId?: string | null;
  code?: string;
  localCode?: string | null;
  name?: string;
  localName?: string;
  catalogName?: string | null;
  category?: string | null;
  priceCents?: number;
  priceZAR?: number;
  currency?: string;
  turnaroundHours?: number;
  etaDays?: number;
  specimenType?: string | null;
  sampleType?: string | null;
  containerType?: string | null;
  requiresColdChain?: boolean;
  requiredTempMinC?: number | null;
  requiredTempMaxC?: number | null;
  maxTransitMins?: number | null;
  prepNotes?: string | null;
  instructions?: string;
  active?: boolean;
};

type LabPanel = {
  id?: string;
  labId?: string;
  code?: string;
  name?: string;
  description?: string | null;
  active?: boolean;
  priceCents?: number;
  priceZAR?: number;
  currency?: string;
  turnaroundHours?: number;
  etaDays?: number;
  tests?: OfferedTest[];
  itemCount?: number;
};

type TestDraft = {
  code: string;
  name: string;
  category: string;
  specimenType: string;
  containerType: string;
  priceZAR: number;
  turnaroundHours: number;
  requiresColdChain: boolean;
  requiredTempMinC: string;
  requiredTempMaxC: string;
  maxTransitMins: string;
  prepNotes: string;
};

type PanelDraft = {
  code: string;
  name: string;
  description: string;
  localCodes: string;
  priceZAR: string;
  turnaroundHours: string;
};

function asArray(value: any) {
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.tests)) return value.tests;
  if (Array.isArray(value?.panels)) return value.panels;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value)) return value;

  return [];
}

function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function money(centsOrZar: unknown, isZar = false) {
  const raw = n(centsOrZar);
  const zar = isZar ? raw : raw / 100;

  return `R ${zar.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function testCode(test: OfferedTest) {
  return String(test.localCode || test.code || test.id || '').trim();
}

function testName(test: OfferedTest) {
  return String(test.localName || test.name || test.catalogName || 'Unnamed test').trim();
}

function panelCode(panel: LabPanel) {
  return String(panel.code || panel.id || '').trim();
}

function panelName(panel: LabPanel) {
  return String(panel.name || panel.code || 'Unnamed panel').trim();
}

function resetTestDraft(): TestDraft {
  return {
    code: '',
    name: '',
    category: '',
    specimenType: '',
    containerType: '',
    priceZAR: 0,
    turnaroundHours: 24,
    requiresColdChain: false,
    requiredTempMinC: '',
    requiredTempMaxC: '',
    maxTransitMins: '',
    prepNotes: '',
  };
}

function resetPanelDraft(): PanelDraft {
  return {
    code: '',
    name: '',
    description: '',
    localCodes: '',
    priceZAR: '',
    turnaroundHours: '',
  };
}

function offerSummary(raw: any) {
  const data = raw?.data || raw || {};
  return {
    canFulfil:
      data.canFulfil ??
      data.canFulfill ??
      data.fulfillable ??
      data.ok ??
      false,
    missingTests:
      data.missingTests ||
      data.missing ||
      data.unmatchedTests ||
      [],
    priceCents:
      data.totalPriceCents ||
      data.priceCents ||
      data.estimatedPriceCents ||
      data.finance?.subtotalCents ||
      null,
    turnaroundHours:
      data.turnaroundHours ||
      data.etaHours ||
      data.estimatedTurnaroundHours ||
      null,
    requiresColdChain:
      data.requiresColdChain ||
      data.coldChainRequired ||
      false,
    raw: data,
  };
}

export default function LabTestsPage() {
  const params = useParams<{ labId: string }>();
  const labId = params.labId;

  const [tests, setTests] = useState<OfferedTest[]>([]);
  const [panels, setPanels] = useState<LabPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTest, setSavingTest] = useState(false);
  const [savingPanel, setSavingPanel] = useState(false);
  const [checkingOffer, setCheckingOffer] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [testDraft, setTestDraft] = useState<TestDraft>(() => resetTestDraft());
  const [panelDraft, setPanelDraft] = useState<PanelDraft>(() => resetPanelDraft());
  const [offerCodes, setOfferCodes] = useState('');
  const [offerPanelCodes, setOfferPanelCodes] = useState('');
  const [offerResult, setOfferResult] = useState<any | null>(null);

  const niceLabName =
    labId
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const [testRes, panelRes] = await Promise.all([
        fetch(`/api/lab-tests?labId=${encodeURIComponent(labId)}&limit=300`, {
          cache: 'no-store',
        }),
        fetch(`/api/lab-panels?labId=${encodeURIComponent(labId)}&limit=300`, {
          cache: 'no-store',
        }),
      ]);

      const testJson = await testRes.json().catch(() => null);
      const panelJson = await panelRes.json().catch(() => null);

      if (!testRes.ok || testJson?.ok === false) {
        throw new Error(testJson?.error || `Tests HTTP ${testRes.status}`);
      }

      if (!panelRes.ok || panelJson?.ok === false) {
        throw new Error(panelJson?.error || `Panels HTTP ${panelRes.status}`);
      }

      setTests(asArray(testJson));
      setPanels(asArray(panelJson));
    } catch (e: any) {
      setErr(e?.message || 'Unable to load tests and panels');
      setTests([]);
      setPanels([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId]);

  const coldChainCount = useMemo(
    () => tests.filter((test) => test.requiresColdChain).length,
    [tests],
  );

  async function handleSaveTest() {
    if (!testDraft.code.trim() || !testDraft.name.trim()) {
      setErr('Test code and name are required.');
      return;
    }

    setSavingTest(true);
    setErr(null);

    try {
      const body = {
        labId,
        code: testDraft.code.trim().toUpperCase(),
        localCode: testDraft.code.trim().toUpperCase(),
        name: testDraft.name.trim(),
        localName: testDraft.name.trim(),
        category: testDraft.category.trim() || null,
        specimenType: testDraft.specimenType.trim() || 'Blood',
        sampleType: testDraft.specimenType.trim() || 'Blood',
        containerType: testDraft.containerType.trim() || null,
        priceZAR: Number(testDraft.priceZAR || 0),
        turnaroundHours: Number(testDraft.turnaroundHours || 24),
        requiresColdChain: testDraft.requiresColdChain,
        requiredTempMinC: testDraft.requiredTempMinC
          ? Number(testDraft.requiredTempMinC)
          : null,
        requiredTempMaxC: testDraft.requiredTempMaxC
          ? Number(testDraft.requiredTempMaxC)
          : null,
        maxTransitMins: testDraft.maxTransitMins
          ? Number(testDraft.maxTransitMins)
          : null,
        prepNotes: testDraft.prepNotes.trim() || null,
        instructions: testDraft.prepNotes.trim() || '',
        active: true,
      };

      const res = await fetch('/api/lab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      setTestDraft(resetTestDraft());
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Unable to save test');
    } finally {
      setSavingTest(false);
    }
  }

  async function handleToggleTest(test: OfferedTest) {
    const id = test.id;
    const code = testCode(test);

    if (!id && !code) return;

    setErr(null);

    try {
      const res = await fetch('/api/lab-tests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labId,
          id,
          localCode: code,
          code,
          active: test.active === false,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      await load();
    } catch (e: any) {
      setErr(e?.message || 'Unable to update test');
    }
  }

  async function handleSavePanel() {
    if (!panelDraft.code.trim() || !panelDraft.name.trim()) {
      setErr('Panel code and name are required.');
      return;
    }

    const localCodes = splitCsv(panelDraft.localCodes);

    if (!localCodes.length) {
      setErr('Add at least one local test code to create a panel.');
      return;
    }

    setSavingPanel(true);
    setErr(null);

    try {
      const body = {
        labId,
        code: panelDraft.code.trim().toUpperCase(),
        name: panelDraft.name.trim(),
        description: panelDraft.description.trim() || null,
        localCodes,
        priceZAR: panelDraft.priceZAR ? Number(panelDraft.priceZAR) : null,
        turnaroundHours: panelDraft.turnaroundHours
          ? Number(panelDraft.turnaroundHours)
          : null,
        active: true,
      };

      const res = await fetch('/api/lab-panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      setPanelDraft(resetPanelDraft());
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Unable to save panel');
    } finally {
      setSavingPanel(false);
    }
  }

  async function handleOfferPreview() {
    const testsRequested = splitCsv(offerCodes).map((code) => ({
      code: code.toUpperCase(),
      localCode: code.toUpperCase(),
    }));

    const panelsRequested = splitCsv(offerPanelCodes).map((code) => ({
      code: code.toUpperCase(),
    }));

    if (!testsRequested.length && !panelsRequested.length) {
      setErr('Enter at least one test or panel code to preview an offer.');
      return;
    }

    setCheckingOffer(true);
    setErr(null);
    setOfferResult(null);

    try {
      const res = await fetch('/api/lab-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labId,
          tests: testsRequested,
          panels: panelsRequested,
          fulfillmentMode: 'HOME_DRAW',
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      setOfferResult(json);
    } catch (e: any) {
      setErr(e?.message || 'Unable to preview offer');
    } finally {
      setCheckingOffer(false);
    }
  }

  const offer = offerSummary(offerResult);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">
            {niceLabName} — Tests, Panels & Offers
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Configure lab-offered tests, build panels, and preview whether this lab can
            fulfil a requested MedReach order with price, ETA and cold-chain implications.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={`/lab/${encodeURIComponent(labId)}`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Workspace
          </Link>
          <Link
            href={`/lab/${encodeURIComponent(labId)}/dashboard`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Dashboard
          </Link>
          <Link
            href={`/lab/${encodeURIComponent(labId)}/settings`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Settings
          </Link>
        </div>
      </header>

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {humanErrorMessage(err, "Unable to complete this request. Please try again.")}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Offered tests</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : tests.length}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Active tests</div>
          <div className="mt-1 text-2xl font-semibold">
            {loading ? '...' : tests.filter((test) => test.active !== false).length}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Panels</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : panels.length}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Cold-chain tests</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : coldChainCount}</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-950">Add or update offered test</h2>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={testDraft.code}
              onChange={(e) =>
                setTestDraft((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Code e.g. FBC"
            />
            <input
              value={testDraft.name}
              onChange={(e) =>
                setTestDraft((prev) => ({ ...prev, name: e.target.value }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Name e.g. Full blood count"
            />
            <input
              value={testDraft.category}
              onChange={(e) =>
                setTestDraft((prev) => ({ ...prev, category: e.target.value }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Category e.g. Haematology"
            />
            <input
              value={testDraft.specimenType}
              onChange={(e) =>
                setTestDraft((prev) => ({ ...prev, specimenType: e.target.value }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Specimen e.g. Blood"
            />
            <input
              value={testDraft.containerType}
              onChange={(e) =>
                setTestDraft((prev) => ({ ...prev, containerType: e.target.value }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Container e.g. EDTA"
            />
            <input
              type="number"
              value={testDraft.priceZAR}
              onChange={(e) =>
                setTestDraft((prev) => ({ ...prev, priceZAR: Number(e.target.value) }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Price ZAR"
            />
            <input
              type="number"
              value={testDraft.turnaroundHours}
              onChange={(e) =>
                setTestDraft((prev) => ({
                  ...prev,
                  turnaroundHours: Number(e.target.value),
                }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Turnaround hours"
            />
            <input
              value={testDraft.maxTransitMins}
              onChange={(e) =>
                setTestDraft((prev) => ({ ...prev, maxTransitMins: e.target.value }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Max transit mins"
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={testDraft.requiresColdChain}
                onChange={(e) =>
                  setTestDraft((prev) => ({
                    ...prev,
                    requiresColdChain: e.target.checked,
                  }))
                }
              />
              Requires cold chain
            </label>
            <input
              value={testDraft.requiredTempMinC}
              onChange={(e) =>
                setTestDraft((prev) => ({ ...prev, requiredTempMinC: e.target.value }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Min temp C"
            />
            <input
              value={testDraft.requiredTempMaxC}
              onChange={(e) =>
                setTestDraft((prev) => ({ ...prev, requiredTempMaxC: e.target.value }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Max temp C"
            />
          </div>

          <textarea
            value={testDraft.prepNotes}
            onChange={(e) =>
              setTestDraft((prev) => ({ ...prev, prepNotes: e.target.value }))
            }
            className="mt-3 w-full rounded border px-3 py-2 text-sm"
            rows={3}
            placeholder="Preparation notes, fasting rules, transport notes"
          />

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSaveTest}
              disabled={savingTest}
              className={`rounded border px-4 py-2 text-sm ${
                savingTest
                  ? 'bg-gray-200 text-gray-500'
                  : 'bg-gray-900 text-white hover:bg-black'
              }`}
            >
              {savingTest ? 'Saving...' : 'Save offered test'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-950">Panel builder</h2>
          <p className="mt-1 text-xs text-gray-500">
            Build panels from existing lab local test codes. Example: FBC, CRP, UEC.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={panelDraft.code}
              onChange={(e) =>
                setPanelDraft((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Panel code e.g. WELLNESS"
            />
            <input
              value={panelDraft.name}
              onChange={(e) =>
                setPanelDraft((prev) => ({ ...prev, name: e.target.value }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Panel name"
            />
            <input
              value={panelDraft.priceZAR}
              onChange={(e) =>
                setPanelDraft((prev) => ({ ...prev, priceZAR: e.target.value }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Optional panel price ZAR"
            />
            <input
              value={panelDraft.turnaroundHours}
              onChange={(e) =>
                setPanelDraft((prev) => ({ ...prev, turnaroundHours: e.target.value }))
              }
              className="rounded border px-3 py-2 text-sm"
              placeholder="Optional panel TAT hours"
            />
          </div>

          <input
            value={panelDraft.localCodes}
            onChange={(e) =>
              setPanelDraft((prev) => ({ ...prev, localCodes: e.target.value }))
            }
            className="mt-3 w-full rounded border px-3 py-2 text-sm"
            placeholder="Local codes: FBC, CRP, UEC"
          />

          <textarea
            value={panelDraft.description}
            onChange={(e) =>
              setPanelDraft((prev) => ({ ...prev, description: e.target.value }))
            }
            className="mt-3 w-full rounded border px-3 py-2 text-sm"
            rows={3}
            placeholder="Panel description"
          />

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSavePanel}
              disabled={savingPanel}
              className={`rounded border px-4 py-2 text-sm ${
                savingPanel
                  ? 'bg-gray-200 text-gray-500'
                  : 'bg-gray-900 text-white hover:bg-black'
              }`}
            >
              {savingPanel ? 'Saving...' : 'Save panel'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-950">Offer preview</h2>
        <p className="mt-1 text-xs text-gray-500">
          Test whether this lab can fulfil an incoming order. This checks availability,
          missing tests/panels, price, ETA, cold-chain and specimen implications.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={offerCodes}
            onChange={(e) => setOfferCodes(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
            placeholder="Requested test codes: FBC, CRP"
          />
          <input
            value={offerPanelCodes}
            onChange={(e) => setOfferPanelCodes(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
            placeholder="Requested panel codes: WELLNESS"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleOfferPreview}
            disabled={checkingOffer}
            className={`rounded border px-4 py-2 text-sm ${
              checkingOffer
                ? 'bg-gray-200 text-gray-500'
                : 'bg-indigo-700 text-white hover:bg-indigo-800'
            }`}
          >
            {checkingOffer ? 'Checking...' : 'Preview fulfilment offer'}
          </button>
        </div>

        {offerResult ? (
          <div className="mt-4 rounded-xl border bg-gray-50 p-4 text-xs">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <div className="text-gray-500">Can fulfil</div>
                <div className="font-semibold">
                  {offer.canFulfil ? 'Yes' : 'Needs review'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Estimated price</div>
                <div className="font-semibold">
                  {offer.priceCents == null ? '-' : money(offer.priceCents)}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Turnaround</div>
                <div className="font-semibold">
                  {offer.turnaroundHours ? `${offer.turnaroundHours}h` : '-'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Cold-chain</div>
                <div className="font-semibold">
                  {offer.requiresColdChain ? 'Required' : 'Not required'}
                </div>
              </div>
            </div>

            {Array.isArray(offer.missingTests) && offer.missingTests.length > 0 ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                Missing: {offer.missingTests.map(String).join(', ')}
              </div>
            ) : null}

            <details className="mt-3">
              <summary className="cursor-pointer text-gray-600">Raw gateway offer payload</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded bg-white p-3 text-[11px] text-gray-700">
                {JSON.stringify(offer.raw, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-950">Offered tests</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="text-sm text-gray-500">Loading tests...</div>
            ) : tests.length === 0 ? (
              <div className="text-sm text-gray-500">
                No tests published yet. Add at least one test before this lab can safely
                respond to marketplace orders.
              </div>
            ) : (
              tests.map((test) => (
                <article key={test.id || testCode(test)} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-950">
                        {testName(test)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {testCode(test) || 'No code'} / {test.category || 'Uncategorised'} /{' '}
                        {test.specimenType || test.sampleType || 'Specimen not set'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleTest(test)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        test.active === false
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-50'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {test.active === false ? 'Inactive' : 'Active'}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div>
                      <div className="text-gray-500">Price</div>
                      <div className="font-semibold">
                        {test.priceCents != null
                          ? money(test.priceCents)
                          : money(test.priceZAR, true)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">ETA</div>
                      <div className="font-semibold">
                        {test.turnaroundHours || test.etaDays
                          ? test.turnaroundHours
                            ? `${test.turnaroundHours}h`
                            : `${test.etaDays}d`
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Container</div>
                      <div className="font-semibold">{test.containerType || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Cold chain</div>
                      <div className="font-semibold">
                        {test.requiresColdChain ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-950">Panels</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="text-sm text-gray-500">Loading panels...</div>
            ) : panels.length === 0 ? (
              <div className="text-sm text-gray-500">
                No panels configured yet. Panels improve marketplace offer matching and
                simplify common order bundles.
              </div>
            ) : (
              panels.map((panel) => (
                <article key={panel.id || panelCode(panel)} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-950">
                        {panelName(panel)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {panelCode(panel)} / {panel.itemCount || panel.tests?.length || 0} tests
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${
                        panel.active === false
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {panel.active === false ? 'Inactive' : 'Active'}
                    </span>
                  </div>

                  {panel.description ? (
                    <p className="mt-2 text-xs text-gray-600">{panel.description}</p>
                  ) : null}

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
                    <div>
                      <div className="text-gray-500">Price</div>
                      <div className="font-semibold">
                        {panel.priceCents != null
                          ? money(panel.priceCents)
                          : money(panel.priceZAR, true)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">ETA</div>
                      <div className="font-semibold">
                        {panel.turnaroundHours || panel.etaDays
                          ? panel.turnaroundHours
                            ? `${panel.turnaroundHours}h`
                            : `${panel.etaDays}d`
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Currency</div>
                      <div className="font-semibold">{panel.currency || 'ZAR'}</div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}