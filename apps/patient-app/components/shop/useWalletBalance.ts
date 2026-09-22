// apps/patient-app/components/shop/useWalletBalance.ts
'use client';

import useSWR from 'swr';

async function fetcher(url: string) {
  const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok === false) throw new Error(j?.error || 'Wallet fetch failed');
  return j;
}

export function useWalletBalance() {
  const { data, error, isLoading, mutate } = useSWR('/api/wallet/balance', fetcher, {
    revalidateOnFocus: false,
  });

  return {
    loading: isLoading,
    error: error ? String(error.message || error) : null,
    balanceZar: data?.balanceZar ?? 0,
    heldZar: data?.heldZar ?? 0,
    availableZar: data?.availableZar ?? 0,
    refresh: mutate,
  };
}
