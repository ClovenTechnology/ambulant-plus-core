// apps/clinician-app/app/insightcore/services/sources/internal-inference-api.ts

export type InferencePayload = {
  patientId: string;
  model: string;
  riskScore: number;
  deteriorationScore?: number;
  signals: string[];
  timestamp: number;
};

/**
 * Adapter boundary for real inference streams.
 * This will later connect to:
 * - AI inference microservice
 * - model-serving layer
 * - Kafka/NATS topics
 * - gRPC streams
 * - WebSocket inference gateway
 * - internal streaming APIs
 */
export function subscribeToInference(
  onEvent: (data: InferencePayload) => void
) {
  console.info('[InsightCore] Internal Inference API adapter initialised');

  // 🔌 No mocks
  // 🔌 No timers
  // 🔌 No synthetic events
  // 🔌 Real transport boundary only

  // Later this becomes:
  // socket.on('inference', onEvent)
  // kafka.subscribe('inference.outputs', onEvent)
  // grpc.streamInference(onEvent)
  // etc.

  return () => {
    console.info('[InsightCore] Internal Inference API adapter closed');
  };
}
