// apps/patient-app/app/medications/new/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '../../../components/toast';

type Drug = { name: string; strengths: string[] };

const DRUGS: Drug[] = [
  { name: 'Amoxicillin', strengths: ['250 mg', '500 mg'] },
  { name: 'Paracetamol', strengths: ['500 mg', '1 g'] },
  { name: 'Ibuprofen', strengths: ['200 mg', '400 mg'] },
  { name: 'Atorvastatin', strengths: ['10 mg', '20 mg', '40 mg'] },
  { name: 'Metformin', strengths: ['500 mg', '850 mg', '1 g'] },
];

export default function NewMedicationPage() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [drug, setDrug] = useState<Drug | null>(null);
  const [strength, setStrength] = useState('');
  const [sig, setSig] = useState('');
  const [quantity, setQuantity] = useState('');
  const [refills, setRefills] = useState('0');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DRUGS;
    return DRUGS.filter(d => d.name.toLowerCase().includes(q));
  }, [query]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/erx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          drug: drug?.name ?? query.trim(),
          strength,
          sig,
          quantity,
          refills,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        toast(data?.error ?? 'Could not submit prescription', { type: 'error' });
        return;
      }
      toast('Prescription sent', { type: 'success' });
      router.push('/orders/print');
    } catch {
      toast('Network error submitting Rx', { type: 'error' });
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">New eRx</h1>

      {/* drug search/select */}
      <section className="p-4 bg-white border rounded-lg space-y-3">
        <label className="block text-sm font-medium">Search Drug</label>
        <input
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setDrug(null);
            setStrength('');
          }}
          placeholder="Type to search (e.g., Paracetamol)â€¦"
          className="w-full border rounded px-3 py-2"
        />
        {query && (
          <div className="border rounded divide-y">
            {filtered.length === 0 ? (
              <div className="p-2 text-sm text-gray-500">No matches â€” you can still freeâ€‘type.</div>
            ) : (
              filtered.slice(0, 8).map(d => (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => { setDrug(d); setQuery(d.name); }}
                  className="w-full text-left p-2 hover:bg-gray-50"
                >
                  {d.name}
                </button>
              ))
            )}
          </div>
        )}
      </section>

      {/* composer */}
      <form onSubmit={onSubmit} className="p-4 bg-white border rounded-lg space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Drug</label>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setDrug(null); }}
              className="w-full border rounded px-3 py-2"
            />
            {drug && (
              <div className="text-xs text-gray-500 mt-1">Selected from list</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Strength</label>
            {drug ? (
              <select
                value={strength}
                onChange={e => setStrength(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">â€” choose â€”</option>
                {drug.strengths.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input
                value={strength}
                onChange={e => setStrength(e.target.value)}
                placeholder="e.g., 500 mg"
                className="w-full border rounded px-3 py-2"
              />
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">SIG (directions)</label>
          <input
            value={sig}
            onChange={e => setSig(e.target.value)}
            placeholder="e.g., 1 tablet PO q6h PRN pain"
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Quantity</label>
            <input
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g., 30"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Refills</label>
            <input
              value={refills}
              onChange={e => setRefills(e.target.value)}
              placeholder="0"
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Submit eRx
          </button>
          <button
            type="button"
            onClick={() => history.back()}
            className="px-4 py-2 rounded border bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
