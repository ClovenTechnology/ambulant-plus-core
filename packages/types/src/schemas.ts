import { z } from "zod";

export const appointment_id = z.string().min(1);
export const vitals_schema = z.object({
  spo2: z.number().min(50).max(100),
  pulse_bpm: z.number().min(20).max(250),
  systolic: z.number().min(60).max(250),
  diastolic: z.number().min(30).max(200),
  collected_at: z.string() // ISO
});
export type Vitals = z.infer<typeof vitals_schema>;
