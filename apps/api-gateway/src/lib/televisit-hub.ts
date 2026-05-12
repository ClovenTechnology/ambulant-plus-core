// apps/api-gateway/src/lib/televisit-hub.ts

export type TelevisitWritable = {
  write: (chunk: Uint8Array) => void | Promise<void>;
};

const rooms = new Map<string, Set<TelevisitWritable>>();

function roomKey(roomId: string) {
  return String(roomId || '').trim();
}

function encodeFrame(data: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export function addClient(roomId: string, writer: TelevisitWritable) {
  const key = roomKey(roomId);

  if (!key) {
    return () => undefined;
  }

  const set = rooms.get(key) ?? new Set<TelevisitWritable>();
  set.add(writer);
  rooms.set(key, set);

  return () => {
    const current = rooms.get(key);

    if (!current) return;

    current.delete(writer);

    if (current.size === 0) {
      rooms.delete(key);
    }
  };
}

export async function pushToRoom(roomId: string, data: unknown) {
  const key = roomKey(roomId);
  const set = rooms.get(key);

  if (!set?.size) return;

  const frame = encodeFrame(data);
  const stale: TelevisitWritable[] = [];

  await Promise.allSettled(
    Array.from(set).map(async (writer) => {
      try {
        await writer.write(frame);
      } catch {
        stale.push(writer);
      }
    }),
  );

  if (stale.length > 0) {
    for (const writer of stale) {
      set.delete(writer);
    }

    if (set.size === 0) {
      rooms.delete(key);
    }
  }
}

export function roomClientCount(roomId?: string) {
  if (roomId) {
    return rooms.get(roomKey(roomId))?.size ?? 0;
  }

  let total = 0;

  for (const set of rooms.values()) {
    total += set.size;
  }

  return total;
}

export function clearRoom(roomId: string) {
  rooms.delete(roomKey(roomId));
}