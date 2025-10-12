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
