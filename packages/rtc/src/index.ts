// /ambulant-plus-scaffold/packages/rtc/src/index.ts
import { Room, type RoomConnectOptions } from "livekit-client";

/** Thin helper so apps don’t new Room() everywhere */
export async function connectRoom(
  wsUrl: string,
  token: string,
  opts?: RoomConnectOptions
) {
  const room = new Room();
  await room.connect(wsUrl, token, opts ?? { autoSubscribe: true });
  return room;
}

/** Identity headers expected by api-gateway + your patient-app /api/rtc/token route */
export type RTCWho = {
  role: "patient" | "clinician" | "admin";
  uid: string;
};

/** Params to mint a LiveKit token via Next route (/api/rtc/token) */
export type RTCTokenRequest = {
  roomId: string;
  visitId?: string;        // if omitted, backend may treat roomId as visitId
  identity?: string;       // defaults to who.uid
  who?: RTCWho;            // required in secure mode
  joinToken?: string;      // x-join-token (Televisit ticket token)
  endpoint?: string;       // default: "/api/rtc/token" (same-origin)
};

/** Response shape from /api/rtc/token */
export type RTCTokenResponse = {
  token: string;
  room?: string;
  identity?: string;
  expSec?: number;
};

/**
 * Fetch a LiveKit JWT from your Next route.
 * This is where we forward x-role / x-uid / x-join-token so the route can verify Televisit ticket.
 */
export async function fetchRtcToken(req: RTCTokenRequest): Promise<RTCTokenResponse> {
  const endpoint = req.endpoint ?? "/api/rtc/token";
  const roomId = req.roomId;
  const visitId = req.visitId ?? req.roomId;
  const identity = req.identity ?? req.who?.uid ?? "guest";

  const headers: Record<string, string> = { "content-type": "application/json" };

  if (req.who?.role) headers["x-role"] = req.who.role;
  if (req.who?.uid) headers["x-uid"] = req.who.uid;
  if (req.joinToken) headers["x-join-token"] = req.joinToken;

  const r = await fetch(endpoint, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({ roomId, visitId, identity }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`RTC token endpoint ${r.status}: ${t || "request failed"}`);
  }

  const j = (await r.json()) as RTCTokenResponse;
  if (!j?.token) throw new Error("RTC token endpoint returned no token");
  return j;
}

/**
 * Convenience: fetch token then connect.
 * Keeps your app code super clean:
 *   const room = await connectRoomWithToken(wsUrl, { roomId, visitId, who, joinToken });
 */
export async function connectRoomWithToken(
  wsUrl: string,
  tokenReq: RTCTokenRequest,
  opts?: RoomConnectOptions
) {
  const { token } = await fetchRtcToken(tokenReq);
  return connectRoom(wsUrl, token, opts);
}

/**
 * Re-exports for app pages
 * Make sure these files exist:
 *   packages/rtc/src/components/DeviceSettings.tsx
 *   packages/rtc/src/components/MonitorPanel.tsx
 *   packages/rtc/src/components/CaptionsOverlay.tsx
 *   packages/rtc/src/iomt.ts
 */
export { DeviceSettings } from "./components/DeviceSettings";
export { MonitorPanel } from "./components/MonitorPanel";
export { CaptionsOverlay } from "./components/CaptionsOverlay";
export { startWearableDemo } from "./iomt";
