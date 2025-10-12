// simple in-memory KV (dev only)
const store = new Map<string, any>();
export function kvGet<T=any>(key: string): T | null { return store.has(key) ? store.get(key) as T : null; }
export function kvSet<T=any>(key: string, val: T): void { store.set(key, val); }
