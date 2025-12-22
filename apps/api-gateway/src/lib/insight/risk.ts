import { prisma } from '@/src/lib/db';

type RiskSeverity = 'low' | 'moderate' | 'high';

export type RiskAlertPayload = {
  orgId?: string | null;
  patientId: string;
  encounterId?: string | null;
  score: number;              // 0–1
  severity: RiskSeverity;
  riskType: string;           // 'deterioration' | 'adherence' | etc.
  reasons?: string[];         // human-readable reasons
  vitalsSnapshot?: any;       // latest vital signs
  source?: string;            // 'insightcore'
};

export async function writeRiskAlert(payload: RiskAlertPayload) {
  const ts = BigInt(Date.now());

  const ev = await prisma.runtimeEvent.create({
    data: {
      orgId: payload.orgId ?? null,
      patientId: payload.patientId,
      encounterId: payload.encounterId ?? null,
      kind: 'insight.alert.risk',
      ts,
      severity: payload.severity,
      payload,
    },
  });

  // Optionally: fan out via SSE (InsightStreamPanel)
  // For SSE, your stream handler can query recent RuntimeEvents by patientId/encounterId
  // OR you can push to some in-memory broadcast.
  return ev;
}
