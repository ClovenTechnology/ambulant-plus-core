import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_LK_WS_URL: z.string().url(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  ML_API_URL: z.string().url().optional()
});

export const ENV = schema.parse(process.env);
