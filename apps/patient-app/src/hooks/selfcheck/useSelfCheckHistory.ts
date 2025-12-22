'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadHistory, saveHistory } from '@/src/analytics/history';

type HistoryItem = {
  timestamp: string;
  data: any;
};

export default function useSelfCheckHistory(storageKey = 'selfcheck', bucket = 'vitals') {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const existing = (await loadHistory(storageKey, bucket)) || [];
    setItems(Array.isArray(existing) ? existing : []);
    setLoaded(true);
  }, [storageKey, bucket]);

  useEffect(() => { refresh(); }, [refresh]);

  const append = useCallback(async (data: any) => {
    const existing = (await loadHistory(storageKey, bucket)) || [];
    const next = [...(Array.isArray(existing) ? existing : []), { data, timestamp: new Date().toISOString() }];
    const sliced = next.slice(-90);
    await saveHistory(storageKey, bucket, sliced);
    setItems(sliced);
  }, [storageKey, bucket]);

  return { items, loaded, refresh, append };
}
