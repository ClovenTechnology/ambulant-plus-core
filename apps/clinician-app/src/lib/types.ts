export type AppointmentStatus =
  | "waiting"
  | "checked_in"
  | "no_show"
  | "in_progress"
  | "completed";

export interface Appointment {
  id: string;
  start: string; // ISO
  end: string;   // ISO
  reason: string;
  visitType: "Video" | "Phone" | "In-person";
  status: AppointmentStatus;
  roomName: string;
  patient: { id: string; name: string; avatarUrl?: string };
  clinician: { id: string; name: string };
}
