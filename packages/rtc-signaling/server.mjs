import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";

const PORT = process.env.RTC_SIGNAL_PORT ? Number(process.env.RTC_SIGNAL_PORT) : 4010;
const wss = new WebSocketServer({ port: PORT });

/**
 * Memory rooms:
 * rooms: {
 *   [roomId]: Map<clientId, ws>
 * }
 */
const rooms = new Map();

function send(ws, msg) {
  try { ws.send(JSON.stringify(msg)); } catch {}
}
function broadcast(roomId, exceptId, msg) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const [id, ws] of room.entries()) {
    if (id === exceptId) continue;
    send(ws, msg);
  }
}

wss.on("connection", (ws) => {
  let roomId = null;
  let clientId = nanoid(8);
  let role = "guest"; // patient | clinician | guest

  ws.on("message", (buf) => {
    let msg = {};
    try { msg = JSON.parse(buf.toString()); } catch { return; }

    if (msg.type === "join") {
      roomId = String(msg.roomId || "default");
      role = msg.role || role;
      if (!rooms.has(roomId)) rooms.set(roomId, new Map());
      rooms.get(roomId).set(clientId, ws);

      // Send current peers to the newcomer
      const peers = Array.from(rooms.get(roomId).keys()).filter(id => id !== clientId);
      send(ws, { type: "welcome", clientId, peers });

      // Tell others a new peer has joined
      broadcast(roomId, clientId, { type: "peer-joined", clientId });

      // Presence ping
      return;
    }

    // WebRTC signaling
    if (msg.type === "signal" && msg.to) {
      const room = rooms.get(roomId);
      if (!room) return;
      const peer = room.get(msg.to);
      if (peer) send(peer, { type: "signal", from: clientId, data: msg.data });
      return;
    }

    // Chat (optional)
    if (msg.type === "chat" && roomId) {
      broadcast(roomId, null, { type: "chat", from: clientId, text: msg.text, ts: Date.now() });
      return;
    }
  });

  ws.on("close", () => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.delete(clientId);
      broadcast(roomId, clientId, { type: "peer-left", clientId });
      if (room.size === 0) rooms.delete(roomId);
    }
  });
});

console.log(`[rtc-signaling] listening on ws://localhost:${PORT}`);