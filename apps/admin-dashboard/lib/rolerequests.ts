// apps/admin-dashboard/lib/rolerequests.ts
import { uid } from './org';
import type { RoleName } from './org';

export type RoleRequestStatus = 'pending' | 'approved' | 'denied';

export type RoleRequest = {
  id: string;
  userId?: string | null;
  email: string;          // useful if user not fully provisioned
  name?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  requestedRoles: RoleName[];
  status: RoleRequestStatus;
  reason?: string | null; // admin decision note
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
};

const db = new Map<string, RoleRequest>();

// Seed a couple of examples
(function seed() {
  const demo: RoleRequest = {
    id: uid('rr'),
    email: 'dev@company.com',
    name: 'Dev Example',
    userId: 'u_dev_001',
    departmentId: null,
    designationId: null,
    requestedRoles: ['Tech & IT', 'Reports & Research'],
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.set(demo.id, demo);
})();

export const roleReqStore = {
  list(status?: RoleRequestStatus) {
    const all = [...db.values()];
    return status ? all.filter(r => r.status === status) : all;
  },
  get(id: string) {
    return db.get(id) || null;
  },
  create(input: Omit<RoleRequest,'id'|'status'|'createdAt'> & { status?: RoleRequestStatus }) {
    const rr: RoleRequest = {
      id: uid('rr'),
      status: input.status ?? 'pending',
      createdAt: new Date().toISOString(),
      ...input,
    };
    db.set(rr.id, rr);
    return rr;
  },
  decide(id: string, status: Exclude<RoleRequestStatus, 'pending'>, decidedBy: string, reason?: string) {
    const cur = db.get(id);
    if (!cur) throw new Error('Role request not found');
    cur.status = status;
    cur.decidedBy = decidedBy;
    cur.decidedAt = new Date().toISOString();
    cur.reason = reason ?? null;
    db.set(id, cur);
    return cur;
  },
  remove(id: string) {
    db.delete(id);
  },
};
