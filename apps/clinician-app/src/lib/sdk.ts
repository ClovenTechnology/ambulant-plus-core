import type { Appointment } from "./types";

export const sdk = {
  async getTodayAppointments(): Promise<Appointment[]> {
    const r = await fetch("/api/appointments/today", { cache: "no-store" });
    if (!r.ok) throw new Error("Failed to load appointments");
    return r.json();
  },
  async getRtcToken(input: {
    roomName: string;
    identity: string;
    role: "moderator" | "participant";
  }): Promise<{ token: string }> {
    const r = await fetch("/api/rtc/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) throw new Error("Token request failed");
    return r.json();
  },
};
