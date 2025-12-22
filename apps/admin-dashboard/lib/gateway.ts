const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN || '';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${GATEWAY}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    credentials: 'include', // send/receive cookies
    cache: 'no-store',
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j?.error || j?.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ---- Auth ----
export const AuthApi = {
  me: () => http<{ authenticated: boolean; user?: any }>('/api/auth/me'),

  adminSignup: (payload: {
    email: string; name?: string; phone?: string;
    departmentId?: string; designationId?: string;
  }) => http('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ ...payload, kind: 'admin' }),
  }),

  adminLogin: (payload: { email: string }) =>
    http('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ ...payload, kind: 'admin' }),
    }),
};

// ---- Org Structure (departments / designations / roles) ----
export const OrgApi = {
  structure: () => http<{ departments: any[]; roles: any[] }>('/api/org/structure'),

  // Departments
  listDepartments: () => http<{ items: any[] }>('/api/org/departments'),
  createDepartment: (data: { name: string; active?: boolean }) =>
    http('/api/org/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id: string, data: { name?: string; active?: boolean }) =>
    http(`/api/org/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDepartment: (id: string) =>
    http(`/api/org/departments/${id}`, { method: 'DELETE' }),

  // Designations
  listDesignations: () => http<{ items: any[] }>('/api/org/designations'),
  createDesignation: (data: { departmentId: string; name: string }) =>
    http('/api/org/designations', { method: 'POST', body: JSON.stringify(data) }),
  updateDesignation: (id: string, data: { departmentId?: string; name?: string }) =>
    http(`/api/org/designations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDesignation: (id: string) =>
    http(`/api/org/designations/${id}`, { method: 'DELETE' }),
  setDesignationRoles: (id: string, roleIds?: string[], roleNames?: string[]) =>
    http(`/api/org/designations/${id}/roles`, { method: 'PUT', body: JSON.stringify({ roleIds, roleNames }) }),

  // Roles + scopes
  listRoles: () => http<{ items: any[] }>('/api/org/roles'),
  createRole: (data: { name: string; scopes?: string[] }) =>
    http('/api/org/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: { name?: string }) =>
    http(`/api/org/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRole: (id: string) =>
    http(`/api/org/roles/${id}`, { method: 'DELETE' }),
  replaceRoleScopes: (id: string, scopes: string[]) =>
    http(`/api/org/roles/${id}/scopes`, { method: 'PUT', body: JSON.stringify({ scopes }) }),
  addRoleScopes: (id: string, scopes: string[]) =>
    http(`/api/org/roles/${id}/scopes`, { method: 'POST', body: JSON.stringify({ scopes }) }),
  removeRoleScope: (id: string, scope: string) =>
    http(`/api/org/roles/${id}/scopes?scope=${encodeURIComponent(scope)}`, { method: 'DELETE' }),
};

// ---- Role Requests (pending / approve / deny) ----
export const RoleReqApi = {
  list: (status?: 'pending' | 'approved' | 'denied') =>
    http<{ items: any[] }>(`/api/roles/requests${status ? `?status=${status}` : ''}`),

  create: (payload: {
    email: string; name?: string; userId?: string;
    departmentId?: string; designationId?: string;
    roleIds?: string[]; roleNames?: string[];
  }) => http('/api/roles/requests', { method: 'POST', body: JSON.stringify(payload) }),

  decide: (id: string, decision: { status: 'approved' | 'denied'; decidedBy?: string; reason?: string }) =>
    http(`/api/roles/requests/${id}`, { method: 'PATCH', body: JSON.stringify(decision) }),

  remove: (id: string) => http(`/api/roles/requests/${id}`, { method: 'DELETE' }),
};
