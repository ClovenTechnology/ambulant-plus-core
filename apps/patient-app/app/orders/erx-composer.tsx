'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '../../components/toast';

type Allergy = {
  id: string;
  substance: string;
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  status: 'Active' | 'Resolved';
  notedAt: string;
};

type RxDraft = {
  drug: string;
  sig: string;
  qty: string;
  refills: string;
  notes?: string;
};

const MOCK_DRUGS = [
  'Amoxicillin 500 mg capsule',
  'Ibuprofen 200 mg tablet',
  'Paracetamol 500 mg tablet',
  'Lisinopril 10 mg tablet',
  'Metformin 500 mg tablet',
  'Penicillin V 250 mg tablet',
  'Penicillin G Benzathine 1.2 MU',
];

export default function ErxComposer() {
  const router = useRouter();

  // composer state
  const [q, setQ] = useState('');
  const [choices, setChoices] = useState<string[]>(MOCK_DRUGS);
  const [draft, setDraft] = useState<RxDraft>({
    drug: '',
    sig: '',
    qty: '',
    refills: '0',
    notes: '',
  });

  // allergies pulled from API
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loadingAllergies, setLoadingAllergies] = useState(true);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const r = await fetch('/api/allergies', { cache: 'no-store' });
        const j: Allergy[] = await r.json();
        if (!abort) setAllergies(j);
      } catch {
        if (!abort) setAllergies([]);
      } finally {
        if (!abort) setLoadingAllergies(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  // lightweight search
  useEffect(() => {
    const term = q.trim().toLowerCase();
    if (!term) return setChoices(MOCK_DRUGS);
    setChoices(
      MOCK_DRUGS.filter(d => d.toLowerCase().includes(term)).slice(0, 10)
    );
  }, [q]);

  // Drugâ€“Allergy â€œpossible matchâ€ (case-insensitive contains) on ACTIVE allergies only
  const allergyHits = useMemo(() => {
    const name = (draft.drug || '').toLowerCase();
    if (!name) return [] as Allergy[];
    return allergies
      .filter(a => a.status === 'Active')
      .filter(a => name.includes(a.substance.toLowerCase()));
  }, [draft.drug, allergies]);

  const canSubmit =
    draft.drug.trim() && draft.sig.trim() && draft.qty.trim() && draft.refills.trim();

  const submit = async () => {
    if (!canSubmit) {
      toast('Please complete drug, SIG, quantity and refills', { type: 'error' });
      return;
    }

    // softâ€‘block: confirm if allergy hit(s)
    if (allergyHits.length > 0) {
      const names = allergyHits.map(a => a.substance).join(', ');
      const ok = confirm(
        `Possible drugâ€“allergy match with: ${names}.\n\nContinue and submit anyway?`
      );
      if (!ok) return;
    }

    try {
      const body = {
        patientId: 'demo-123',
        rx: {
          drug: draft.drug.trim(),
          sig: draft.sig.trim(),
          qty: draft.qty.trim(),
          refills: Number(draft.refills) || 0,
          notes: draft.notes?.trim() || undefined,
        },
      };

      const res = await fetch('/api/erx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Could not submit eRx');
      }

      toast('eRx queued successfully', { type: 'success' });
      setTimeout(() => router.push('/orders/print'), 250); // auto-jump to printable summary
    } catch (e: any) {
      toast(e?.message ?? 'Could not submit eRx', { type: 'error' });
    }
  };

  return (
    <section className="p-4 border rounded-lg bg-white space-y-4">
      <h2 className="font-semibold">eRx Composer</h2>

      {/* Search + pick */}
      <div className="space-y-2">
        <label className="text-xs text-gray-600">Find Medicine</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search formularyâ€¦"
          className="w-full border rounded p-2"
        />
        {q && (
          <ul className="border rounded divide-y max-h-48 overflow-auto">
            {choices.length === 0 ? (
              <li className="p-2 text-sm text-gray-500">No matches</li>
            ) : choices.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  className="w-full text-left p-2 hover:bg-gray-50 text-sm"
                  onClick={() => {
                    setDraft(d => ({ ...d, drug: c }));
                    setQ('');
                  }}
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Selected & SIG */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Selected Drug</label>
          <input
            value={draft.drug}
            onChange={(e) => setDraft(d => ({ ...d, drug: e.target.value }))}
            className="w-full border rounded p-2"
            placeholder="e.g., Amoxicillin 500 mg capsule"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600">SIG (directions)</label>
          <input
            value={draft.sig}
            onChange={(e) => setDraft(d => ({ ...d, sig: e.target.value }))}
            className="w-full border rounded p-2"
            placeholder="e.g., 1 cap PO TID x 7 days"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Quantity</label>
          <input
            value={draft.qty}
            onChange={(e) => setDraft(d => ({ ...d, qty: e.target.value }))}
            className="w-full border rounded p-2"
            placeholder="e.g., 21"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Refills</label>
          <input
            value={draft.refills}
            onChange={(e) => setDraft(d => ({ ...d, refills: e.target.value }))}
            className="w-full border rounded p-2"
            placeholder="0"
            inputMode="numeric"
          />
        </div>
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs text-gray-600">Notes (optional)</label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))}
            className="w-full border rounded p-2 min-h-[80px]"
            placeholder="Pharmacy instructions or clinical noteâ€¦"
          />
        </div>
      </div>

      {/* Allergy status line */}
      <div className="text-xs">
        {loadingAllergies ? (
          <span className="text-gray-500">Checking allergiesâ€¦</span>
        ) : allergyHits.length > 0 ? (
          <span className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200">
            âš  Possible allergy match: {allergyHits.map(a => a.substance).join(', ')}
          </span>
        ) : (
          <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            âœ“ No active allergy match detected
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={submit}
          className="px-3 py-2 border rounded bg-black text-white hover:opacity-90"
          disabled={!canSubmit}
        >
          Submit eRx
        </button>
        <button
          onClick={() => {
            setDraft({ drug: '', sig: '', qty: '', refills: '0', notes: '' });
            setQ('');
          }}
          className="px-3 py-2 border rounded bg-white hover:bg-gray-50"
        >
          Clear
        </button>
      </div>
    </section>
  );
}
