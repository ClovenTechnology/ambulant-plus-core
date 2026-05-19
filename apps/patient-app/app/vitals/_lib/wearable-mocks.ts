// apps/patient-app/app/vitals/_lib/wearable-mocks.ts

/**
 * Production-disabled compatibility shim.
 *
 * This file previously returned synthetic NexRing/wearable insights. Patient-app
 * should now use real API-backed wearable data only. These exports remain only
 * to avoid breaking older imports during the production cleanup.
 */

export type MockWearableInsights = {
  generatedAt: string;
  sleep_score: number;
  hrv_ms: number;
  readiness: number;
  steps: number;
  steps_goal: number;
  calories: number;
  calories_goal: number;
  distance_km: number;
  distance_goal_km: number;
  sleep_hours: number;
  resting_hr: number;
  stress_level: number;
  temp_delta_c: number;
};

export function shouldUseMockWearable(_args?: {
  searchParamMock?: string | null;
  envMock?: string | undefined;
}): false {
  return false;
}

export function generateMockWearableInsights(): MockWearableInsights {
  throw new Error(
    'wearable_mock_data_disabled: production patient-app must use real wearable-insights API data',
  );
}