// apps/admin-dashboard/src/lib/gateway.ts
// Tiny adapter for the Admin Dashboard.
// Auth calls use same-origin proxy routes to avoid CORS and to receive cookies reliably.
// Protected org/admin calls still go to the Gateway (3010).

import { APIGW } from './config';

type HttpInit = RequestInit & { json?: any };

async function requestJson<T = any>(url: string, init: HttpInit = {}): Promise<T> {
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
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return data as T;
}

async function gwFetch<T = any>(path: string, init: HttpInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${APIGW}${path}`;
  return requestJson<T>(url, init);
}

async function localFetch<T = any>(path: string, init: HttpInit = {}): Promise<T> {
  return requestJson<T>(path, init);
}

export const AuthApi = {
  async adminLogin(input: { email: string; password: string }) {
    return localFetch('/api/auth/login', { method: 'POST', json: input });
  },

  async adminSignup(input: {
    email: string;
    password: string;
    name?: string;
    departmentId?: string;
    designationId?: string;
    roleNames?: RoleName[];
  }) {
    return localFetch('/api/auth/signup', { method: 'POST', json: input });
  },

  async me() {
    return localFetch('/api/auth/me', { method: 'GET' });
  },
};

export type RoleName = string;

export const OrgApi = {
  async structure() {
    return gwFetch('/api/org/structure', { method: 'GET' });
  },

  async createDepartment(input: { name: string; active?: boolean }) {
    return gwFetch('/api/org/departments', { method: 'POST', json: input });
  },

  async updateDepartment(id: string, input: { name?: string; active?: boolean }) {
    return gwFetch(`/api/org/departments/${id}`, { method: 'PATCH', json: input });
  },

  async deleteDepartment(id: string) {
    return gwFetch(`/api/org/departments/${id}`, { method: 'DELETE' });
  },

  async listDesignations() {
    return gwFetch('/api/org/designations', { method: 'GET' });
  },

  async createDesignation(input: { departmentId: string; name: string }) {
    return gwFetch('/api/org/designations', { method: 'POST', json: input });
  },

  async setDesignationRoles(
    designationId: string,
    roleIds?: string[] | null,
    roleNames?: RoleName[] | null,
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
  async list(
    status?:
      | 'pending'
      | 'approved'
      | 'denied',
  ) {
    const query =
      status
        ? `?status=${encodeURIComponent(status)}`
        : '';

    return localFetch(
      `/api/roles/requests${query}`,
      {
        method: 'GET',
      },
    );
  },

  async decide(
    id: string,
    input: {
      status:
        | 'approved'
        | 'denied';
      reason?: string;
    },
  ) {
    return localFetch(
      `/api/roles/requests/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        json: input,
      },
    );
  },

  async create(
    input: {
      roleNames?: RoleName[];
      roleIds?: string[];
    },
  ) {
    return localFetch(
      '/api/roles/requests',
      {
        method: 'POST',
        json: input,
      },
    );
  },
};
