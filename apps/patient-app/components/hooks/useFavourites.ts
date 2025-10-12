'use client';
import { useCallback, useEffect, useState } from 'react';

const LS_KEY = 'clinician.favs';

export function useFavourites(userId?: string | null) {
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (userId) {
          const res = await fetch('/api/favourites', { cache: 'no-store' });
          const data = await res.json();
          if (!cancelled) setIds(Array.isArray(data.ids) ? data.ids : []);
        } else {
          const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : '[]';
          setIds(raw ? JSON.parse(raw) : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // persist for guests
  useEffect(() => {
    if (!userId && typeof window !== 'undefined')
      localStorage.setItem(LS_KEY, JSON.stringify(ids));
  }, [userId, ids]);

  const toggle = useCallback(async (id: string) => {
    const existed = ids.includes(id);
    // optimistic
    setIds(prev => existed ? prev.filter(x => x !== id) : [...prev, id]);

    if (userId) {
      try {
        const method = existed ? 'DELETE' : 'POST';
        const url = existed ? `/api/favourites?id=${encodeURIComponent(id)}` : '/api/favourites';
        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json' },
          body: method === 'POST' ? JSON.stringify({ id }) : undefined,
        });
        if (!res.ok) throw new Error('Sync failed');
      } catch {
        // revert on failure
        setIds(prev => existed ? [...prev, id] : prev.filter(x => x !== id));
      }
    }
  }, [ids, userId]);

  return { ids, toggle, loading };
}
