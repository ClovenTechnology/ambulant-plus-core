// No React imports here; plain helpers usable on client components.
// All paths are RELATIVE-only to avoid alias issues.

import type { ToastKind } from '../../components/useToast';

// Basic JSON response shape you often return from APIs
type OkJson = { ok?: boolean; error?: string; [k: string]: any };

function showToast(msg: string, kind: ToastKind) {
  // Lazy import = no circular deps
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { toast } = require('../../components/toast');
  toast(msg, { type: kind });
}

/**
 * Fetch JSON and return it. If anything goes wrong, toast + return null,
 * so your UI stays in place instead of crashing.
 */
export async function safeJsonOrToast<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { label?: string; successMsg?: string }
): Promise<T | null> {
  const label = opts?.label ?? 'Request';
  try {
    const res = await fetch(input, init);
    let data: any = null;
    try { data = await res.json(); } catch { /* ignore parse */ }

    if (!res.ok) {
      const msg = (data?.error as string) || `${label} failed`;
      showToast(msg, 'error');
      return null;
    }
    if (opts?.successMsg) showToast(opts.successMsg, 'success');
    return data as T;
  } catch {
    showToast(`${label} failed`, 'error');
    return null;
  }
}

/**
 * POST JSON with body; toast on failure; returns parsed JSON or null.
 */
export async function postJsonOrToast<T = OkJson>(
  url: string,
  body: unknown,
  opts?: { label?: string; successMsg?: string }
): Promise<T | null> {
  return safeJsonOrToast<T>(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
    opts
  );
}
