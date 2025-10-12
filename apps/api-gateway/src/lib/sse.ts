type Client = { id: string; res: ReadableStreamDefaultWriter<Uint8Array> };
const channels = new Map<string, Set<Client>>(); // key: orderId

export function addClient(orderId: string, client: Client) {
  if (!channels.has(orderId)) channels.set(orderId, new Set());
  channels.get(orderId)!.add(client);
  return () => channels.get(orderId)?.delete(client);
}

export async function push(orderId: string, payload: any) {
  const set = channels.get(orderId);
  if (!set?.size) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  const enc = new TextEncoder().encode(data);
  await Promise.allSettled(Array.from(set).map(c => c.res.write(enc)));
}
