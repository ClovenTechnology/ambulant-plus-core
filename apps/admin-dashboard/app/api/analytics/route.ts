// apps/admin-dashboard/app/api/analytics/route.ts
import { GET as overviewGet } from './overview/route';

// Simply re-export the overview handler so /api/analytics works too.
export const GET = overviewGet;
