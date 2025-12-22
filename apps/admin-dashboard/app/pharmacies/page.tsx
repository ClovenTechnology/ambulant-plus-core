'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Service = {
  code: string;
  name: string;
  feeZAR: number;
  slaMinutes: number;
};

type Pharmacy = {
  id: string;
  name: string;
  city: string;
  contact: string;
  logoUrl?: string;
  services: Service[];
  active?: boolean; // optional, default true
};

export default function PharmaciesPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/pharmacies', { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!mounted) return;
        setPharmacies(d.pharmacies || []);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unable to load pharmacies');
        setPharmacies([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function addPharmacy() {
    const name = prompt('Pharmacy name (e.g., CarePort Pharmacy Sandton)');
    if (!name) return;
    const city = prompt('City (e.g., Sandton)') || '';
    const contact = prompt('Contact (+27 …)') || '';
    try {
      const res = await fetch('/api/pharmacies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, city, contact }),
      });
      const d = await res.json();
      setPharmacies(d.pharmacies || []);
    } catch {
      // best-effort
    }
  }

  async function addService(pharmacyId: string) {
    const code = prompt('Service code (e.g., SAME_DAY)') || '';
    if (!code) return;
    const name = prompt('Service name (e.g., Same-day local delivery)') || '';
    const feeZAR = parseInt(prompt('Delivery fee (ZAR)') || '0', 10);
    const slaMinutes = parseInt(
      prompt('Target SLA (minutes)') || '180',
      10,
    );
    try {
      const res = await fetch('/api/pharmacies/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmacyId, code, name, feeZAR, slaMinutes }),
      });
      const d = await res.json();
      setPharmacies(d.pharmacies || []);
    } catch {
      // best-effort
    }
  }

  async function toggleActive(pharmacy: Pharmacy) {
    const current = pharmacy.active !== false;
    const next = !current;

    // optimistic UI
    setPharmacies((prev) =>
      prev.map((p) => (p.id === pharmacy.id ? { ...p, active: next } : p)),
    );

    try {
      await fetch('/api/pharmacies/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pharmacy.id, active: next }),
      });
    } catch {
      // revert on error
      setPharmacies((prev) =>
        prev.map((p) => (p.id === pharmacy.id ? { ...p, active: current } : p)),
      );
    }
  }

  function copySelfServiceLink(pharmacy: Pharmacy) {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/pharmacy/${encodeURIComponent(
      pharmacy.id,
    )}`;
    navigator.clipboard.writeText(url).catch(() => {});
    alert('Self-service link copied to clipboard:\n' + url);
  }

  if (loading) {
    return <main className="p-6 text-sm text-gray-500">Loading…</main>;
  }

  return (
    <main className="p-6 space-y-4 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">CarePort — Pharmacies</h1>
          <p className="text-xs text-gray-500 mt-1">
            Onboard and manage partner pharmacies for CarePort deliveries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addPharmacy}
            className="px-3 py-1 border rounded bg-black text-white text-sm"
          >
            Add Pharmacy
          </button>
          <Link href="/careport" className="text-xs underline text-indigo-700">
            CarePort dashboard →
          </Link>
        </div>
      </header>

      {err ? (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        {pharmacies.map((pharm) => {
          const active = pharm.active !== false;
          const workspaceHref = `/pharmacy/${encodeURIComponent(pharm.id)}`;
          return (
            <div
              key={pharm.id}
              className={`border rounded p-4 bg-white space-y-3 ${
                active ? '' : 'opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {pharm.logoUrl ? (
                      <img
                        src={pharm.logoUrl}
                        alt={pharm.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : null}
                    <span>{pharm.name}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {pharm.city} • {pharm.contact}
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
                    onClick={() => toggleActive(pharm)}
                    className="px-2 py-1 rounded border bg-white hover:bg-gray-50"
                  >
                    {active ? 'Disable' : 'Enable'}
                  </button>
                  <Link
                    href={workspaceHref}
                    className="text-indigo-700 underline"
                  >
                    Manage workspace
                  </Link>
                  <button
                    onClick={() => copySelfServiceLink(pharm)}
                    className="text-gray-500 underline"
                  >
                    Copy self-service link
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Delivery Services</div>
                <ul className="text-sm border rounded divide-y">
                  {pharm.services.map((s) => (
                    <li
                      key={s.code}
                      className="p-2 flex justify-between gap-2"
                    >
                      <span>
                        {s.name} ({s.code})
                      </span>
                      <span className="text-xs text-gray-600 text-right">
                        R {s.feeZAR} • SLA {s.slaMinutes} min
                      </span>
                    </li>
                  ))}
                  {pharm.services.length === 0 && (
                    <li className="p-2 text-gray-500 text-xs">
                      No services configured yet.
                    </li>
                  )}
                </ul>
                <button
                  onClick={() => addService(pharm.id)}
                  className="mt-2 px-3 py-1 border rounded text-xs"
                >
                  Add Service
                </button>
              </div>
            </div>
          );
        })}

        {pharmacies.length === 0 && (
          <div className="text-sm text-gray-500 border rounded bg-white p-4">
            No pharmacies onboarded yet. Use “Add Pharmacy” to create one.
          </div>
        )}
      </div>
    </main>
  );
}
