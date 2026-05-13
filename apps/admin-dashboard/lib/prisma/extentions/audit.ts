// apps/admin-dashboard/lib/prisma/extentions/audit.ts
import { Prisma } from '@prisma/client';

type LogAuditInput = Record<string, any>;

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
