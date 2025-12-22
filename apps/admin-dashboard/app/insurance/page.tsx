//apps/admin-dashboard/app/insurance/page.tsx
'use client';

import { useEffect, useState } from 'react';

type TelemedCover = 'none' | 'partial' | 'full';

type Scheme = {
  code: string;
  name: string;
  telemedCover: TelemedCover;
  telemedCopayType?: 'fixed' | 'percent';
  telemedCopayValue?: number;
};

type Insurer = {
  id: string;
  name: string;
  contact: string;
  email?: string;
  phone?: string;
  city?: string;
  active?: boolean;
  schemes: Scheme[];
};

export default function InsurancePage() {
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/insurance', { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!mounted) return;
        setInsurers(d.insurers || []);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unable to load insurers');
        setInsurers([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function addInsurer() {
    const name = prompt('Insurer / medical aid name (e.g., Discovery Health)');
    if (!name) return;
    const city = prompt('Head office city (optional)') || '';
    const contact = prompt('Contact person / role (optional)') || '';
    const email = prompt('Claims email (optional)') || '';
    const phone = prompt('Phone (optional)') || '';
    try {
      const res = await fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, city, contact, email, phone }),
      });
      const d = await res.json();
      setInsurers(d.insurers || []);
    } catch {
      // best-effort
    }
  }

  async function addScheme(insurerId: string) {
    const code = prompt('Scheme / plan code (e.g., CLASSIC_SAVER)') || '';
    if (!code) return;
    const name =
      prompt('Scheme / plan name (e.g., Classic Saver)') || code;
    const telemedCoverRaw =
      prompt(
        'Telemed cover (none / partial / full) [default: partial]',
      ) || 'partial';
    const telemedCover = (['none', 'partial', 'full'] as TelemedCover[]).includes(
      telemedCoverRaw as TelemedCover,
    )
      ? (telemedCoverRaw as TelemedCover)
      : 'partial';

    let telemedCopayType: 'fixed' | 'percent' | undefined;
    let telemedCopayValue: number | undefined;

    if (telemedCover === 'partial') {
      const typeRaw =
        prompt(
          'Co-pay type for telemed (fixed / percent) [optional]',
        ) || '';
      if (typeRaw === 'fixed' || typeRaw === 'percent') {
        telemedCopayType = typeRaw;
        const valueRaw =
          prompt(
            `Co-pay value (R amount for fixed, % for percent)`,
          ) || '0';
        const v = parseFloat(valueRaw);
        if (!Number.isNaN(v) && v > 0) {
          telemedCopayValue = v;
        }
      }
    }

    try {
      const res = await fetch('/api/insurance/schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insurerId,
          code,
          name,
          telemedCover,
          telemedCopayType,
          telemedCopayValue,
        }),
      });
      const d = await res.json();
      setInsurers(d.insurers || []);
    } catch {
      // best-effort
    }
  }

  async function toggleActive(ins: Insurer) {
    const current = ins.active !== false;
    const next = !current;

    // optimistic
    setInsurers((prev) =>
      prev.map((i) => (i.id === ins.id ? { ...i, active: next } : i)),
    );

    try {
      await fetch('/api/insurance/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ins.id, active: next }),
      });
    } catch {
      // revert
      setInsurers((prev) =>
        prev.map((i) =>
          i.id === ins.id ? { ...i, active: current } : i,
        ),
      );
    }
  }

  if (loading) {
    return <main className="p-6 text-sm text-gray-500">Loading…</main>;
  }

  return (
    <main className="p-6 space-y-4 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Insurance &amp; Medical Aids</h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure insurers, schemes and telemedicine cover. Patient
            medical aid profiles and clinician claims read from this
            configuration and the shared <code>medical-aids.json</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addInsurer}
            className="px-3 py-1 border rounded bg-black text-white text-sm"
          >
            Add Insurer
          </button>
        </div>
      </header>

      {err ? (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        {insurers.map((ins) => {
          const active = ins.active !== false;
          return (
            <div
              key={ins.id}
              className={`border rounded p-4 bg-white space-y-3 ${
                active ? '' : 'opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <span>{ins.name}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {ins.city || '—'} • {ins.contact || 'No contact'}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    {ins.email || 'No email'} •{' '}
                    {ins.phone || 'No phone'}
                  </div>
                  <div className="mt-1 text-[11px]">
                    Status:{' '}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 text-[11px]">
                  <button
                    onClick={() => toggleActive(ins)}
                    className="px-2 py-1 rounded border bg-white hover:bg-gray-50"
                  >
                    {active ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">
                  Schemes / Plans
                </div>
                <ul className="text-sm border rounded divide-y">
                  {ins.schemes.map((s) => (
                    <li
                      key={s.code}
                      className="p-2 flex justify-between gap-2"
                    >
                      <span>
                        {s.name} ({s.code})
                      </span>
                      <span className="text-xs text-gray-600 text-right space-y-0.5">
                        <div>Telemed: {s.telemedCover}</div>
                        {s.telemedCover === 'partial' &&
                          s.telemedCopayType &&
                          s.telemedCopayValue != null && (
                            <div>
                              Co-pay:{' '}
                              {s.telemedCopayType === 'percent'
                                ? `${s.telemedCopayValue}%`
                                : `R ${s.telemedCopayValue.toFixed(2)}`}
                            </div>
                          )}
                      </span>
                    </li>
                  ))}
                  {ins.schemes.length === 0 && (
                    <li className="p-2 text-gray-500 text-xs">
                      No schemes configured yet.
                    </li>
                  )}
                </ul>
                <button
                  onClick={() => addScheme(ins.id)}
                  className="mt-2 px-3 py-1 border rounded text-xs"
                >
                  Add Scheme
                </button>
              </div>
            </div>
          );
        })}

        {insurers.length === 0 && (
          <div className="text-sm text-gray-500 border rounded bg-white p-4">
            No insurers configured yet. Use “Add Insurer” to create one.
          </div>
        )}
      </div>
    </main>
  );
}
