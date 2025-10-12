// apps/patient-app/app/orders/orders-client.tsx
'use client';

import { useEffect, useState } from 'react';
import { useActiveEncounter } from '../../components/context/ActiveEncounterContext';
import { useToast } from '../../components/ToastMount';

type Order = { id: string; drug: string; sig: string };

export default function OrdersClient() {
  const toast = useToast();
  const { activeEncounter } = useActiveEncounter();

  const [drug, setDrug] = useState('');
  const [sig, setSig] = useState('');
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<Record<string, Order[]>>({});

  // Seed some mock prescriptions when encounter first selected
  useEffect(() => {
    if (activeEncounter && !orders[activeEncounter.id]) {
      setOrders((prev) => ({
        ...prev,
        [activeEncounter.id]: [
          { id: 'mock1', drug: 'Paracetamol 500mg', sig: '1 tablet every 6 hours as needed' },
          { id: 'mock2', drug: 'Amoxicillin 500mg', sig: '1 capsule three times daily for 7 days' },
        ],
      }));
    }
  }, [activeEncounter, orders]);

  if (!activeEncounter) {
    return (
      <div className="p-6 text-gray-500">
        Please select an encounter from the Encounters page first.
      </div>
    );
  }

  const encounterOrders = orders[activeEncounter.id] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      const newOrder: Order = {
        id: Math.random().toString(36).slice(2, 9),
        drug,
        sig,
      };
      setOrders((prev) => ({
        ...prev,
        [activeEncounter.id]: [...(prev[activeEncounter.id] || []), newOrder],
      }));
      toast(`Prescription for ${drug} saved`, 'success');
      setDrug('');
      setSig('');
    } catch {
      toast('Failed to save prescription', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setOrders((prev) => ({
      ...prev,
      [activeEncounter.id]: prev[activeEncounter.id].filter((o) => o.id !== id),
    }));
    toast('Order deleted', 'success');
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-lg font-semibold mb-4">
          New Prescription (Encounter: {activeEncounter.id})
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Drug</label>
            <input
              value={drug}
              onChange={(e) => setDrug(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., Amoxicillin 500mg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sig / Instructions</label>
            <input
              value={sig}
              onChange={(e) => setSig(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., 1 tablet twice daily for 7 days"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Prescription'}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-md font-semibold mb-3">Orders for this Encounter</h2>
        {encounterOrders.length === 0 ? (
          <div className="text-gray-500">No prescriptions yet.</div>
        ) : (
          <ul className="divide-y border rounded bg-white">
            {encounterOrders.map((o) => (
              <li key={o.id} className="p-3 flex justify-between items-center">
                <div>
                  <span className="font-medium block">{o.drug}</span>
                  <span className="text-sm text-gray-600">{o.sig}</span>
                </div>
                <button
                  onClick={() => handleDelete(o.id)}
                  className="text-rose-600 hover:underline text-sm"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
