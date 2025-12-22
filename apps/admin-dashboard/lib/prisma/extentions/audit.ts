// prisma/extensions/audit.ts
import { Prisma } from '@prisma/client';

export const auditExtension = Prisma.defineExtension({
  name: 'audit',
  model: {
    $allModels: {
      // nothing here; extension is for namespacing only
    },
  },
  client: {
    async logAudit(this: any, input: LogAuditInput) {
      await (this as any).auditLog.create({ data: input });
    },
  },
});
