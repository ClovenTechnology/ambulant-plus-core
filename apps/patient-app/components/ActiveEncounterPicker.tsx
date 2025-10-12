'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Encounter = {
  id: string;
  case?: string;
  createdAt?: string;
};

// Accept either an array or { items: [...] } or { data: [...] }
function normalize(input: any): Encounter[] {
  if (Array.isArray(input)) return input;
  if (input?.items && Array.isArray(input.items)) return input.items;
  if (input?.data && Array.isArray(input.data)) return input.data;
  return [];
}

export default function ActiveEncounterPicker() {
  const router = useRouter();
  const [list, setList] = useState<Encounter[] | null>(null);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/encounters', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setList(normalize(data));
      } catch (e) {
        console.error('Failed to load encounters', e);
        if (!cancelled) setList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (id: string) => {
    setActiveId(id);
    if (id) router.push(`/encounters/${id}`);
  };

  if (!list || list.length === 0) {
    return (
      <select disabled className="border rounded px-2 py-1 text-sm text-gray-400">
        <option>No Encounters</option>
      </select>
    );
  }

  return (
    <select
      value={activeId}
      onChange={(e) => handleChange(e.target.value)}
      className="border rounded px-2 py-1 text-sm"
    >
      <option value="">Select Encounter</option>
      {list.map((enc) => (
        <option key={enc.id} value={enc.id}>
          {enc.case || enc.id}
        </option>
      ))}
    </select>
  );
}
