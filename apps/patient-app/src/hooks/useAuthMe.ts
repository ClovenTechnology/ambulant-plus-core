//apps/patient-app/src/hooks/useAuthMe.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type AuthMeUser = {
  id: string | null;
  actorType: string | null;
  actorRefId: string | null;
  sid: string | null;
  orgId: string | null;
};

type State = {
  loading: boolean;
  user: AuthMeUser | null;
  error: string | null;
};

let _cache: { at: number; user: AuthMeUser | null } = { at: 0, user: null };
const CACHE_MS = 30_000;

export function useAuthMe() {
  const [state, setState] = useState<State>(() => {
    const fresh = Date.now() - _cache.at < CACHE_MS;
    return { loading: !fresh, user: fresh ? _cache.user : null, error: null };
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        _cache = { at: Date.now(), user: null };
        setState({ loading: false, user: null, error: data?.error || 'Not signed in.' });
        return;
      }
      const u: AuthMeUser = data.user || null;
      _cache = { at: Date.now(), user: u };
      setState({ loading: false, user: u, error: null });
    } catch (e: any) {
      setState({ loading: false, user: null, error: e?.message ? String(e.message) : 'Auth check failed.' });
    }
  }, []);

  useEffect(() => {
    const fresh = Date.now() - _cache.at < CACHE_MS;
    if (!fresh) void refresh();
  }, [refresh]);

  return useMemo(() => ({ ...state, refresh }), [state, refresh]);
}
