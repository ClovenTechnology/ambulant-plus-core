// FILE: apps/api-gateway/src/lib/sse.ts
type StreamWriter = {
  write(chunk: Uint8Array): void | Promise<void>;
  close?(): void | Promise<void>;
};

type Client = { id: string; res: StreamWriter };

// channel key can be "order:<id>" | "draw:<id>" | "bundle:<id>" | "specimen:<id>"
const channels = new Map<string, Set<Client>>();

function keyOf(kind: string, id: string) {
  return `${kind}:${id}`;
}

export function addClient(channelKey: string, client: Client) {
  if (!channels.has(channelKey)) channels.set(channelKey, new Set());
  channels.get(channelKey)!.add(client);
  return () => channels.get(channelKey)?.delete(client);
}

export async function push(channelKey: string, payload: any) {
  const set = channels.get(channelKey);
  if (!set?.size) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  const enc = new TextEncoder().encode(data);
  await Promise.allSettled(Array.from(set).map((c) => c.res.write(enc)));
}

// Convenience helpers (keep your old mental model)
export const sseKeys = {
  order: (id: string) => keyOf("order", id),
  draw: (id: string) => keyOf("draw", id),
  lab: (id: string) => keyOf("lab", id),
  labOrder: (id: string) => keyOf("lab", id),
  bundle: (id: string) => keyOf("bundle", id),
  specimen: (id: string) => keyOf("specimen", id),
};