const rooms = new Map<string, Set<WritableStreamDefaultWriter<string>>>();

export function addClient(roomId: string, w: WritableStreamDefaultWriter<string>) {
  const set = rooms.get(roomId) ?? new Set();
  set.add(w); rooms.set(roomId, set);
  return () => { set.delete(w); };
}

export async function pushToRoom(roomId: string, data: any) {
  const set = rooms.get(roomId); if (!set) return;
  const frame = `data: ${JSON.stringify(data)}\n\n`;
  for (const w of set) { try { await w.write(frame); } catch {} }
}
