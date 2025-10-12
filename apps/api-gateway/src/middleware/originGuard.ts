import type { Request, Response, NextFunction } from "express";

const PATIENT_ORIGIN = process.env.PATIENT_ORIGIN || "http://localhost:3000";

/** Enforce patient booking posts come from Patient app Origin. */
export function requirePatientOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.method === "POST" && req.path === "/api/appointments") {
    const origin = req.headers.origin || "";
    if (!origin || origin !== PATIENT_ORIGIN) {
      return res.status(403).json({ error: "Forbidden: invalid Origin for booking", origin });
    }
  }
  return next();
}

/** Minimal request logger for verification. */
export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  if (req.path.startsWith("/api/appointments")) {
    // why: quickly confirm traffic path during integration
    console.log(`[GW] ${req.method} ${req.path} origin=${req.headers.origin} referer=${req.headers.referer}`);
  }
  next();
}