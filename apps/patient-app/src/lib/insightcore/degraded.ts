export type InsightDeliveryState =
  | { source: 'insightcore'; degradedMode: false }
  | { source: 'hybrid'; degradedMode: false }
  | { source: 'local_fallback'; degradedMode: true; reason?: string };