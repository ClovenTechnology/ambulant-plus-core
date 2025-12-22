//apps/patient-app/app/api/plan/upgrade/route.ts
import { NextRequest } from 'next/server';

// Reuse the same handler so you don’t maintain two diverging endpoints
export { POST } from '../checkout/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// (Optional) keep NextRequest import so the file doesn’t look empty to linters
void NextRequest;
