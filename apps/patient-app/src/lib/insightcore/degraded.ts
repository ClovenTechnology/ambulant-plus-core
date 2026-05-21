// apps/patient-app/src/lib/insightcore/degraded.ts
export type InsightDeliveryState =
  | { source: 'insightcore'; degradedMode: false }
  | { source: 'insightcore'; degradedMode: true; reason: string };