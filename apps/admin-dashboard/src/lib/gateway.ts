// apps/admin-dashboard/src/lib/gateway.ts
// Tiny adapter for the Admin Dashboard to talk to the Gateway (3010).
// Always sends cookies (credentials: 'include') to share the adm.profile session.

import { APIGW } from './config';

type HttpInit = RequestInit & { json?: any };

async function gwFetch<T = any>(path: string, init: HttpInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${APIGW}${path}`;
  const headers = new Headers(init.headers || {});
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

export const AuthApi = {
  // Dev/stub email login
  async adminLogin(input: { email: string }) {
    return gwFetch('/api/auth/login', { method: 'POST', json: input });
  },
  // Admin signup (department/designation aware if your gateway handles it)
  async adminSignup(input: { email: string; name?: string; departmentId?: string; designationId?: string }) {
    return gwFetch('/api/auth/signup', { method: 'POST', json: input });
  },
  async me() {
    return gwFetch('/api/auth/me', { method: 'GET' });
  },
};

export type RoleName = string;

export const OrgApi = {
  async structure() {
    return gwFetch('/api/org/structure', { method: 'GET' });
  },

  // Departments
  async createDepartment(input: { name: string; active?: boolean }) {
    return gwFetch('/api/org/departments', { method: 'POST', json: input });
  },
  async updateDepartment(id: string, input: { name?: string; active?: boolean }) {
    return gwFetch(`/api/org/departments/${id}`, { method: 'PATCH', json: input });
  },
  async deleteDepartment(id: string) {
    return gwFetch(`/api/org/departments/${id}`, { method: 'DELETE' });
  },

  // Designations
  async listDesignations() {
    return gwFetch('/api/org/designations', { method: 'GET' });
  },
  async createDesignation(input: { departmentId: string; name: string }) {
    return gwFetch('/api/org/designations', { method: 'POST', json: input });
  },
  async setDesignationRoles(
    designationId: string,
    roleIds?: string[] | null,
    roleNames?: RoleName[] | null
  ) {
    return gwFetch(`/api/org/designations/${designationId}/roles`, {
      method: 'PUT',
      json: { roleIds: roleIds ?? undefined, roleNames: roleNames ?? undefined },
    });
  },
  async deleteDesignation(id: string) {
    return gwFetch(`/api/org/designations/${id}`, { method: 'DELETE' });
  },
};

export const RoleReqApi = {
  async list(status?: 'pending' | 'approved' | 'denied') {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return gwFetch(`/api/roles/requests${qs}`, { method: 'GET' });
  },
  async decide(id: string, input: { status: 'approved' | 'denied'; decidedBy?: string; reason?: string }) {
    return gwFetch(`/api/roles/requests/${id}`, { method: 'PATCH', json: input });
  },
  // (Optional) create role request (if you want to submit extra roles at signup)
  async create(input: {
    email: string;
    name?: string;
    userId?: string;
    departmentId?: string | null;
    designationId?: string | null;
    roleNames: RoleName[];
  }) {
    return gwFetch(`/api/roles/requests`, { method: 'POST', json: input });
  },
};
