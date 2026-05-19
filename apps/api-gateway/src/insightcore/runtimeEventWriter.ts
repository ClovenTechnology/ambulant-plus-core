import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';

export class GatewayRuntimeEventWriter {
  async create(args: {
    kind: string;
    patientId: string;
    orgId?: string;
    payload: string;
  }): Promise<void> {
    await prisma.runtimeEvent.create({
      data: {
        id: crypto.randomUUID(),
        ts: BigInt(Date.now()),
        kind: args.kind,
        patientId: args.patientId,
        orgId: args.orgId || 'org-default',
        payload: args.payload,
      },
    });
  }
}