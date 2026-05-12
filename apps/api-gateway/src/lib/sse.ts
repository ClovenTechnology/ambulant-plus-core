// apps/api-gateway/src/lib/sse.ts

export type SseWritable = {
  write: (chunk: Uint8Array) => void | Promise<void>;
};

type Client = {
  id: string;
  res: SseWritable;
};

const channels = new Map<string, Set<Client>>();

function channelKey(orderId: string) {
  return String(orderId || '').trim();
}

function encodeSse(payload: unknown) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  return new TextEncoder().encode(data);
}

export function addClient(orderId: string, client: Client) {
  const key = channelKey(orderId);

  if (!key) {
    return () => undefined;
  }

  if (!channels.has(key)) {
    channels.set(key, new Set());
  }

  const set = channels.get(key)!;
  set.add(client);

  return () => {
    const current = channels.get(key);

    if (!current) return;

    current.delete(client);

    if (current.size === 0) {
      channels.delete(key);
    }
  };
}

export async function push(orderId: string, payload: unknown) {
  const key = channelKey(orderId);
  const set = channels.get(key);

  if (!set?.size) return;

  const frame = encodeSse(payload);
  const stale: Client[] = [];

  await Promise.allSettled(
    Array.from(set).map(async (client) => {
      try {
        await client.res.write(frame);
      } catch {
        stale.push(client);
      }
    }),
  );

  if (stale.length > 0) {
    for (const client of stale) {
      set.delete(client);
    }

    if (set.size === 0) {
      channels.delete(key);
    }
  }
}

export function clientCount(orderId?: string) {
  if (orderId) {
    return channels.get(channelKey(orderId))?.size ?? 0;
  }

  let total = 0;

  for (const set of channels.values()) {
    total += set.size;
  }

  return total;
}

export function clearChannel(orderId: string) {
  channels.delete(channelKey(orderId));
}