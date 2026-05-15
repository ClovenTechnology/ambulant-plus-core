"use client";

import React, { CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Department = {
  id: string;
  name: string;
  active?: boolean;
  designations?: Designation[];
};

type Designation = {
  id: string;
  name: string;
  departmentId?: string | null;
  department?: Department | null;
  roles?: Array<{ role?: Role; id?: string; name?: string }>;
};

type Role = {
  id: string;
  name: string;
  scopes?: Array<{ scope: string }> | string[];
};

type RoleRequest = {
  id: string;
  email: string;
  name?: string | null;
  userId?: string | null;
  status?: string | null;
  reason?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  requestedRoles?: string[];
  createdAt?: string | null;
  decidedAt?: string | null;
  department?: Department | null;
  designation?: Designation | null;
};

type Structure = {
  departments: Department[];
  roles: Array<{ id: string; name: string; scopes: string[] }>;
};

type ScopeGroup = {
  label: string;
  scopes: string[];
};

type RoleTemplate = {
  name: string;
  description: string;
  scopes: string[];
};

const SCOPE_GROUPS: ScopeGroup[] = [
  {
    label: "Members",
    scopes: ["members.read", "members.update", "members.export"],
  },
  {
    label: "Coverage and products",
    scopes: [
      "coverage.read",
      "coverage.rules.write",
      "products.read",
      "products.write",
      "preflight.run",
    ],
  },
  {
    label: "Authorizations",
    scopes: [
      "authorizations.read",
      "authorizations.approve",
      "authorizations.deny",
      "authorizations.consume",
    ],
  },
  {
    label: "Claims",
    scopes: [
      "claims.read",
      "claims.review",
      "claims.approve",
      "claims.deny",
      "claims.request_info",
      "claims.reprocess",
    ],
  },
  {
    label: "Wallet and rewards",
    scopes: [
      "wallet.read",
      "wallet.fund",
      "wallet.reserve",
      "wallet.capture",
      "wallet.release",
      "rewards.read",
      "rewards.manage",
    ],
  },
  {
    label: "Settlements",
    scopes: ["settlements.read", "settlements.run", "settlements.export"],
  },
  {
    label: "Providers",
    scopes: [
      "providers.read",
      "providers.write",
      "providers.banking.update",
      "providers.contracts.manage",
    ],
  },
  {
    label: "Devices and health context",
    scopes: [
      "devices.read",
      "device_trends.read",
      "health_context.read",
      "health_context.export",
    ],
  },
  {
    label: "CarePort and MedReach",
    scopes: ["careport.read", "medreach.read", "billables.read"],
  },
  {
    label: "Exports and scheme adapters",
    scopes: [
      "exports.read",
      "exports.download",
      "scheme_adapters.read",
      "scheme_adapters.manage",
    ],
  },
  {
    label: "Organisation administration",
    scopes: [
      "org.structure.read",
      "org.departments.manage",
      "org.designations.manage",
      "org.users.read",
      "org.users.manage",
      "org.roles.read",
      "org.roles.manage",
      "org.invitations.manage",
      "org.role_requests.manage",
    ],
  },
  {
    label: "Audit",
    scopes: ["audit.read", "audit.export"],
  },
];

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: "Claims Manager",
    description: "Review, approve, deny, request information, and reprocess claims.",
    scopes: [
      "members.read",
      "claims.read",
      "claims.review",
      "claims.approve",
      "claims.deny",
      "claims.request_info",
      "claims.reprocess",
      "authorizations.read",
      "coverage.read",
      "health_context.read",
    ],
  },
  {
    name: "Authorization Reviewer",
    description: "Run preflight checks and decide authorization requests.",
    scopes: [
      "members.read",
      "coverage.read",
      "preflight.run",
      "authorizations.read",
      "authorizations.approve",
      "authorizations.deny",
      "authorizations.consume",
      "health_context.read",
    ],
  },
  {
    name: "Settlement Operator",
    description: "Run settlement batches and export settlement/remittance outputs.",
    scopes: [
      "claims.read",
      "settlements.read",
      "settlements.run",
      "settlements.export",
      "wallet.read",
      "providers.read",
    ],
  },
  {
    name: "Wallet Operator",
    description: "Fund, reserve, capture, and release sponsor wallet balances.",
    scopes: [
      "wallet.read",
      "wallet.fund",
      "wallet.reserve",
      "wallet.capture",
      "wallet.release",
      "rewards.read",
    ],
  },
  {
    name: "Provider Network Manager",
    description: "Manage providers, contracts, banking posture, and network readiness.",
    scopes: [
      "providers.read",
      "providers.write",
      "providers.banking.update",
      "providers.contracts.manage",
      "settlements.read",
    ],
  },
  {
    name: "Scheme Export Operator",
    description: "Download CSV/JSON exports and manage scheme adapter readiness.",
    scopes: [
      "members.read",
      "claims.read",
      "authorizations.read",
      "settlements.read",
      "exports.read",
      "exports.download",
      "scheme_adapters.read",
      "scheme_adapters.manage",
    ],
  },
  {
    name: "Org Administrator",
    description: "Manage users, invitations, departments, designations, roles, and scopes.",
    scopes: [
      "org.structure.read",
      "org.departments.manage",
      "org.designations.manage",
      "org.users.read",
      "org.users.manage",
      "org.roles.read",
      "org.roles.manage",
      "org.invitations.manage",
      "org.role_requests.manage",
      "audit.read",
    ],
  },
  {
    name: "Read-only Auditor",
    description: "View operational data and audit outputs without mutation access.",
    scopes: [
      "members.read",
      "coverage.read",
      "products.read",
      "authorizations.read",
      "claims.read",
      "settlements.read",
      "wallet.read",
      "providers.read",
      "devices.read",
      "health_context.read",
      "exports.read",
      "audit.read",
    ],
  },
];

const ALL_KNOWN_SCOPES = SCOPE_GROUPS.flatMap((group) => group.scopes);

function uniqueSortedScopes(scopes: string[]) {
  return Array.from(
    new Set(scopes.map((scope) => scope.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function formatScopeLabel(scope: string) {
  return scope
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function roleScopes(role: Role | { scopes?: string[] }) {
  const scopes = asArray<any>(role.scopes);
  return scopes.map((s) => (typeof s === "string" ? s : String(s.scope || ""))).filter(Boolean);
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers || {}),
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.error || json?.message || `Request failed: ${res.status}`);
  }

  return json;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

export default function OrgAdminPage() {
  const [structure, setStructure] = useState<Structure>({ departments: [], roles: [] });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
  const [roleRequestsSupported, setRoleRequestsSupported] = useState(true);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [departmentName, setDepartmentName] = useState("");
  const [designationName, setDesignationName] = useState("");
  const [designationDepartmentId, setDesignationDepartmentId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleScopesInput, setRoleScopesInput] = useState("");
  const [roleTemplateName, setRoleTemplateName] = useState("");
  const [roleScopeSelection, setRoleScopeSelection] = useState<string[]>([]);
  const [showCustomCreateScopes, setShowCustomCreateScopes] = useState(false);

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedRoleScopesInput, setSelectedRoleScopesInput] = useState("");
  const [selectedRoleScopeSelection, setSelectedRoleScopeSelection] = useState<string[]>([]);
  const [showCustomSelectedScopes, setShowCustomSelectedScopes] = useState(false);

  const [selectedDesignationId, setSelectedDesignationId] = useState("");
  const [selectedDesignationRoleIds, setSelectedDesignationRoleIds] = useState<string[]>([]);

  const [requestEmail, setRequestEmail] = useState("");
  const [requestName, setRequestName] = useState("");
  const [requestUserId, setRequestUserId] = useState("");
  const [requestDepartmentId, setRequestDepartmentId] = useState("");
  const [requestDesignationId, setRequestDesignationId] = useState("");
  const [requestRoleIds, setRequestRoleIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const [structureJson, departmentsJson, designationsJson, rolesJson] =
        await Promise.all([
          fetchJson("/api/org/structure"),
          fetchJson("/api/org/departments"),
          fetchJson("/api/org/designations"),
          fetchJson("/api/org/roles"),
        ]);

      setStructure({
        departments: asArray(structureJson?.departments),
        roles: asArray(structureJson?.roles),
      });
      setDepartments(asArray(departmentsJson?.items));
      setDesignations(asArray(designationsJson?.items));
      setRoles(asArray(rolesJson?.items));

      try {
        const requestsJson = await fetchJson("/api/roles/requests");
        setRoleRequests(asArray(requestsJson?.items));
        setRoleRequestsSupported(true);
      } catch {
        setRoleRequests([]);
        setRoleRequestsSupported(false);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load organisation administration.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedRoleId) {
      setSelectedRoleScopesInput("");
      setSelectedRoleScopeSelection([]);
      return;
    }

    const role = roles.find((x) => x.id === selectedRoleId);
    const scopes = roleScopes(role || {});
    const knownScopes = scopes.filter((scope) => ALL_KNOWN_SCOPES.includes(scope));
    const customScopes = scopes.filter((scope) => !ALL_KNOWN_SCOPES.includes(scope));

    setSelectedRoleScopeSelection(knownScopes);
    setSelectedRoleScopesInput(customScopes.join("\n"));
  }, [selectedRoleId, roles]);

  useEffect(() => {
    if (!selectedDesignationId) {
      setSelectedDesignationRoleIds([]);
      return;
    }

    const designation = designations.find((x) => x.id === selectedDesignationId);
    const ids = asArray<any>(designation?.roles)
      .map((item) => item?.role?.id || item?.id)
      .filter(Boolean);

    setSelectedDesignationRoleIds(ids);
  }, [selectedDesignationId, designations]);

  const activeDepartments = departments.filter((d) => d.active !== false);
  const pendingRequests = roleRequests.filter(
    (x) => String(x.status || "pending").toLowerCase() === "pending"
  );

  const roleScopeCount = useMemo(() => {
    return roles.reduce((sum, role) => sum + roleScopes(role).length, 0);
  }, [roles]);

  function parseScopes(input: string) {
    return input
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function applyRoleTemplate(templateName: string) {
    setRoleTemplateName(templateName);

    const template = ROLE_TEMPLATES.find((item) => item.name === templateName);

    if (!template) return;

    setRoleName(template.name);
    setRoleScopeSelection(template.scopes);
    setRoleScopesInput("");
    setShowCustomCreateScopes(false);
  }

  function toggleCreateScope(scope: string) {
    setRoleScopeSelection((prev) =>
      prev.includes(scope)
        ? prev.filter((item) => item !== scope)
        : uniqueSortedScopes([...prev, scope])
    );
  }

  function toggleSelectedRoleScope(scope: string) {
    setSelectedRoleScopeSelection((prev) =>
      prev.includes(scope)
        ? prev.filter((item) => item !== scope)
        : uniqueSortedScopes([...prev, scope])
    );
  }

  async function mutate(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");

    try {
      await fn();
      setNotice(`${label} completed.`);
      await load();
    } catch (err: any) {
      setError(err?.message || `${label} failed.`);
    } finally {
      setBusy("");
    }
  }

  async function createDepartment() {
    const name = departmentName.trim();
    if (!name) {
      setError("Department name is required.");
      return;
    }

    await mutate("Create department", async () => {
      await fetchJson("/api/org/departments", {
        method: "POST",
        body: JSON.stringify({ name, active: true }),
      });
      setDepartmentName("");
    });
  }

  async function createDesignation() {
    const name = designationName.trim();
    if (!name || !designationDepartmentId) {
      setError("Designation name and department are required.");
      return;
    }

    await mutate("Create designation", async () => {
      await fetchJson("/api/org/designations", {
        method: "POST",
        body: JSON.stringify({
          name,
          departmentId: designationDepartmentId,
        }),
      });
      setDesignationName("");
      setDesignationDepartmentId("");
    });
  }

  async function createRole() {
    const name = roleName.trim();
    if (!name) {
      setError("Role name is required.");
      return;
    }

    await mutate("Create role", async () => {
      await fetchJson("/api/org/roles", {
        method: "POST",
        body: JSON.stringify({
          name,
          scopes: uniqueSortedScopes([
            ...roleScopeSelection,
            ...parseScopes(roleScopesInput),
          ]),
        }),
      });
      setRoleName("");
      setRoleScopesInput("");
      setRoleTemplateName("");
      setRoleScopeSelection([]);
      setShowCustomCreateScopes(false);
    });
  }

  async function replaceRoleScopes() {
    if (!selectedRoleId) {
      setError("Select a role first.");
      return;
    }

    await mutate("Update role scopes", async () => {
      await fetchJson(`/api/org/roles/${encodeURIComponent(selectedRoleId)}/scopes`, {
        method: "PUT",
        body: JSON.stringify({
          scopes: uniqueSortedScopes([
            ...selectedRoleScopeSelection,
            ...parseScopes(selectedRoleScopesInput),
          ]),
        }),
      });
    });
  }

  function toggleDesignationRole(roleId: string) {
    setSelectedDesignationRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((x) => x !== roleId) : [...prev, roleId]
    );
  }

  function toggleRequestRole(roleId: string) {
    setRequestRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((x) => x !== roleId) : [...prev, roleId]
    );
  }

  async function updateDesignationRoles() {
    if (!selectedDesignationId) {
      setError("Select a designation first.");
      return;
    }

    await mutate("Update designation roles", async () => {
      await fetchJson(
        `/api/org/designations/${encodeURIComponent(selectedDesignationId)}/roles`,
        {
          method: "PUT",
          body: JSON.stringify({
            roleIds: selectedDesignationRoleIds,
          }),
        }
      );
    });
  }

  async function createRoleRequest() {
    const email = requestEmail.trim();

    if (!roleRequestsSupported) {
      setError("Role request API is not available.");
      return;
    }

    if (!email) {
      setError("Request email is required.");
      return;
    }

    await mutate("Create role request", async () => {
      await fetchJson("/api/roles/requests", {
        method: "POST",
        body: JSON.stringify({
          email,
          name: requestName.trim() || null,
          userId: requestUserId.trim() || null,
          departmentId: requestDepartmentId || null,
          designationId: requestDesignationId || null,
          roleIds: requestRoleIds,
        }),
      });

      setRequestEmail("");
      setRequestName("");
      setRequestUserId("");
      setRequestDepartmentId("");
      setRequestDesignationId("");
      setRequestRoleIds([]);
    });
  }

  async function decideRoleRequest(id: string, status: "approved" | "denied") {
    const reason =
      status === "denied"
        ? window.prompt("Reason for denial?", "Access request denied.") || ""
        : window.prompt("Approval note?", "Approved by org admin.") || "";

    await mutate(`${status === "approved" ? "Approve" : "Deny"} role request`, async () => {
      await fetchJson(`/api/roles/requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          reason,
        }),
      });
    });
  }

  async function deleteRoleRequest(id: string) {
    if (!window.confirm("Delete this role request?")) return;

    await mutate("Delete role request", async () => {
      await fetchJson(`/api/roles/requests/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    });
  }

  return (
    <main style={{ padding: 32, maxWidth: 1500 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>PayerOps Administration</div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>
          Organisation Administration
        </h1>
        <p style={{ opacity: 0.82, margin: 0, maxWidth: 980 }}>
          Manage departments, designations, roles, role scopes, role requests, users,
          and invitations for the current Medical Aid / sponsor workspace.
        </p>
      </div>

      <section style={metricGrid}>
        <Metric label="Departments" value={departments.length} sub={`${activeDepartments.length} active`} />
        <Metric label="Designations" value={designations.length} sub="Mapped to departments" />
        <Metric label="Roles" value={roles.length} sub={`${roleScopeCount} scopes`} />
        <Metric label="Pending role requests" value={pendingRequests.length} sub={roleRequestsSupported ? "Review queue" : "API unavailable"} />
      </section>

      {error ? <div style={errorBox}>{error}</div> : null}
      {notice ? <div style={noticeBox}>{notice}</div> : null}
      {loading ? <div style={card}>Loading organisation controls...</div> : null}

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Quick links</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/org/users" style={buttonSecondary}>Manage users</Link>
          <Link href="/org/invitations" style={buttonSecondary}>Manage invitations</Link>
          <button onClick={load} type="button" style={buttonSecondary}>
            Refresh structure
          </button>
        </div>
      </section>

      <section style={twoCol}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Departments</h2>
          <div style={formGrid}>
            <input
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              placeholder="Department name, e.g. Claims Operations"
              style={input}
            />
            <button onClick={createDepartment} disabled={Boolean(busy)} style={buttonPrimary}>
              Create department
            </button>
          </div>

          <div style={list}>
            {departments.map((d) => (
              <div key={d.id} style={rowCard}>
                <div>
                  <strong>{d.name}</strong>
                  <div style={muted}>
                    {d.active === false ? "Inactive" : "Active"} ·{" "}
                    {asArray(d.designations).length} designations
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Designations</h2>
          <div style={formGrid}>
            <input
              value={designationName}
              onChange={(e) => setDesignationName(e.target.value)}
              placeholder="Designation, e.g. Claims Reviewer"
              style={input}
            />

            <select
              value={designationDepartmentId}
              onChange={(e) => setDesignationDepartmentId(e.target.value)}
              style={input}
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <button onClick={createDesignation} disabled={Boolean(busy)} style={buttonPrimary}>
              Create designation
            </button>
          </div>

          <div style={list}>
            {designations.map((d) => (
              <div key={d.id} style={rowCard}>
                <div>
                  <strong>{d.name}</strong>
                  <div style={muted}>
                    Department: {d.department?.name || d.departmentId || "—"} · Roles:{" "}
                    {asArray(d.roles)
                      .map((r: any) => r.role?.name || r.name)
                      .filter(Boolean)
                      .join(", ") || "None"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={twoCol}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Roles</h2>

          <div style={formGrid}>
            <select
              value={roleTemplateName}
              onChange={(e) => applyRoleTemplate(e.target.value)}
              style={input}
            >
              <option value="">Select role template optional</option>
              {ROLE_TEMPLATES.map((template) => (
                <option key={template.name} value={template.name}>
                  {template.name}
                </option>
              ))}
            </select>

            {roleTemplateName ? (
              <div style={contextBox}>
                {ROLE_TEMPLATES.find((item) => item.name === roleTemplateName)?.description}
              </div>
            ) : null}

            <input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="Role name, e.g. Claims Manager"
              style={input}
            />

            <ScopeChecklist
              selected={roleScopeSelection}
              onToggle={toggleCreateScope}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setRoleTemplateName("");
                  setRoleScopeSelection([]);
                  setRoleScopesInput("");
                }}
                style={buttonSecondary}
              >
                Clear scopes
              </button>

              <button
                type="button"
                onClick={() => setShowCustomCreateScopes((value) => !value)}
                style={buttonSecondary}
              >
                {showCustomCreateScopes ? "Hide custom scopes" : "Advanced custom scopes"}
              </button>
            </div>

            {showCustomCreateScopes ? (
              <textarea
                value={roleScopesInput}
                onChange={(e) => setRoleScopesInput(e.target.value)}
                placeholder={"Custom scopes not listed above, one per line\nscheme.private_api.manage"}
                style={{ ...input, minHeight: 90 }}
              />
            ) : null}

            <button onClick={createRole} disabled={Boolean(busy)} style={buttonPrimary}>
              Create role
            </button>
          </div>

          <div style={list}>
            {roles.map((r) => (
              <div key={r.id} style={rowCard}>
                <div>
                  <strong>{r.name}</strong>
                  <div style={muted}>
                    {roleScopes(r).length ? roleScopes(r).join(", ") : "No scopes"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Role scopes</h2>

          <div style={formGrid}>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              style={input}
            >
              <option value="">Select role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <ScopeChecklist
              selected={selectedRoleScopeSelection}
              onToggle={toggleSelectedRoleScope}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSelectedRoleScopeSelection([])}
                style={buttonSecondary}
              >
                Clear selected scopes
              </button>

              <button
                type="button"
                onClick={() => setShowCustomSelectedScopes((value) => !value)}
                style={buttonSecondary}
              >
                {showCustomSelectedScopes ? "Hide custom scopes" : "Advanced custom scopes"}
              </button>
            </div>

            {showCustomSelectedScopes ? (
              <textarea
                value={selectedRoleScopesInput}
                onChange={(e) => setSelectedRoleScopesInput(e.target.value)}
                placeholder={"Custom scopes not listed above, one per line\nwallet.fund\nsettlement.run"}
                style={{ ...input, minHeight: 120 }}
              />
            ) : null}

            <button onClick={replaceRoleScopes} disabled={Boolean(busy)} style={buttonPrimary}>
              Replace scopes
            </button>
          </div>
        </div>
      </section>

      <section style={twoCol}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Designation role mapping</h2>

          <select
            value={selectedDesignationId}
            onChange={(e) => setSelectedDesignationId(e.target.value)}
            style={input}
          >
            <option value="">Select designation</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {roles.map((r) => (
              <label key={r.id} style={checkRow}>
                <input
                  type="checkbox"
                  checked={selectedDesignationRoleIds.includes(r.id)}
                  onChange={() => toggleDesignationRole(r.id)}
                />
                <span>{r.name}</span>
              </label>
            ))}
          </div>

          <button
            onClick={updateDesignationRoles}
            disabled={Boolean(busy)}
            style={{ ...buttonPrimary, marginTop: 14 }}
          >
            Save designation roles
          </button>
        </div>

        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Role request intake</h2>

          {!roleRequestsSupported ? (
            <div style={warningBox}>
              Role request API did not respond. Confirm the gateway route exists and proxy is created.
            </div>
          ) : null}

          <div style={formGrid}>
            <input
              value={requestEmail}
              onChange={(e) => setRequestEmail(e.target.value)}
              placeholder="User email"
              style={input}
            />
            <input
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="Name"
              style={input}
            />
            <input
              value={requestUserId}
              onChange={(e) => setRequestUserId(e.target.value)}
              placeholder="Existing userId, if known"
              style={input}
            />

            <select
              value={requestDepartmentId}
              onChange={(e) => setRequestDepartmentId(e.target.value)}
              style={input}
            >
              <option value="">Department optional</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={requestDesignationId}
              onChange={(e) => setRequestDesignationId(e.target.value)}
              style={input}
            >
              <option value="">Designation optional</option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <div style={{ display: "grid", gap: 8 }}>
              {roles.map((r) => (
                <label key={r.id} style={checkRow}>
                  <input
                    type="checkbox"
                    checked={requestRoleIds.includes(r.id)}
                    onChange={() => toggleRequestRole(r.id)}
                  />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>

            <button onClick={createRoleRequest} disabled={Boolean(busy)} style={buttonPrimary}>
              Create role request
            </button>
          </div>
        </div>
      </section>

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Role request review queue</h2>

        <div style={list}>
          {roleRequests.length === 0 ? (
            <div style={muted}>No role requests found.</div>
          ) : (
            roleRequests.map((request) => {
              const status = String(request.status || "pending").toLowerCase();

              return (
                <div key={request.id} style={rowCard}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{request.email}</strong>
                      <span style={status === "approved" ? goodPill : status === "denied" ? dangerPill : warnPill}>
                        {status.toUpperCase()}
                      </span>
                    </div>

                    <div style={muted}>
                      {request.name || "No name"} · User: {request.userId || "not linked"} · Created:{" "}
                      {fmtDate(request.createdAt)}
                    </div>

                    <div style={muted}>
                      Department: {request.department?.name || request.departmentId || "—"} ·
                      Designation: {request.designation?.name || request.designationId || "—"}
                    </div>

                    <div style={muted}>
                      Requested roles: {asArray(request.requestedRoles).join(", ") || "None"}
                    </div>

                    {request.reason ? <div style={contextBox}>Reason: {request.reason}</div> : null}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => decideRoleRequest(request.id, "approved")}
                      disabled={Boolean(busy) || status === "approved"}
                      style={buttonPrimary}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decideRoleRequest(request.id, "denied")}
                      disabled={Boolean(busy) || status === "denied"}
                      style={buttonSecondary}
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRoleRequest(request.id)}
                      disabled={Boolean(busy)}
                      style={dangerButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Structure overview</h2>

        {structure.departments.length === 0 && structure.roles.length === 0 ? (
          <div style={muted}>No structure rows found yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {structure.departments.map((department) => (
              <div key={department.id} style={rowCard}>
                <div>
                  <strong>{department.name}</strong>
                  <div style={muted}>{department.active === false ? "Inactive" : "Active"}</div>

                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {asArray(department.designations).map((designation) => (
                      <div key={designation.id} style={contextBox}>
                        <strong>{designation.name}</strong>
                        <div style={muted}>
                          Roles:{" "}
                          {asArray<any>(designation.roles)
                            .map((r) => r.name || r.role?.name)
                            .filter(Boolean)
                            .join(", ") || "None"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ScopeChecklist({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (scope: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {SCOPE_GROUPS.map((group) => (
        <div key={group.label} style={contextBox}>
          <strong>{group.label}</strong>

          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {group.scopes.map((scope) => (
              <label key={scope} style={checkRow}>
                <input
                  type="checkbox"
                  checked={selected.includes(scope)}
                  onChange={() => onToggle(scope)}
                />
                <span>
                  <strong>{formatScopeLabel(scope)}</strong>
                  <span style={{ ...muted, marginLeft: 8 }}>{scope}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div style={card}>
      <div style={{ opacity: 0.7, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
      <div style={{ marginTop: 8, opacity: 0.72, fontSize: 13 }}>{sub}</div>
    </div>
  );
}

const eyebrow: CSSProperties = {
  fontSize: 12,
  letterSpacing: 1.5,
  opacity: 0.7,
  textTransform: "uppercase",
};

const metricGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
  gap: 16,
  marginTop: 20,
};

const card: CSSProperties = {
  background: "#121931",
  border: "1px solid #1f2a4d",
  borderRadius: 16,
  padding: 18,
};

const rowCard: CSSProperties = {
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  borderRadius: 14,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const contextBox: CSSProperties = {
  background: "#0b1228",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  padding: 10,
  fontSize: 13,
  marginTop: 8,
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0b1228",
  border: "1px solid #334155",
  color: "white",
  borderRadius: 12,
  padding: "10px 12px",
  outline: "none",
};

const formGrid: CSSProperties = {
  display: "grid",
  gap: 10,
};

const list: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
};

const muted: CSSProperties = {
  opacity: 0.7,
  fontSize: 13,
  marginTop: 4,
};

const buttonPrimary: CSSProperties = {
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "white",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const buttonSecondary: CSSProperties = {
  border: "1px solid #334155",
  background: "#0f1730",
  color: "white",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 800,
  textDecoration: "none",
  cursor: "pointer",
};

const dangerButton: CSSProperties = {
  border: "1px solid #7f1d1d",
  background: "#3a1017",
  color: "#fecaca",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const checkRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "#0b1228",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  padding: "8px 10px",
  fontSize: 13,
};

const errorBox: CSSProperties = {
  background: "#4c1118",
  border: "1px solid #991b1b",
  color: "#fecaca",
  borderRadius: 14,
  padding: 14,
  marginTop: 18,
};

const warningBox: CSSProperties = {
  background: "#3b2608",
  border: "1px solid #92400e",
  color: "#fde68a",
  borderRadius: 14,
  padding: 12,
  marginBottom: 12,
};

const noticeBox: CSSProperties = {
  background: "#0f2a1f",
  border: "1px solid #14532d",
  color: "#bbf7d0",
  borderRadius: 14,
  padding: 14,
  marginTop: 18,
};

const pillBase: CSSProperties = {
  display: "inline-flex",
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 11,
  fontWeight: 800,
};

const goodPill: CSSProperties = {
  ...pillBase,
  background: "#0f2a1f",
  borderColor: "#14532d",
  color: "#bbf7d0",
};

const warnPill: CSSProperties = {
  ...pillBase,
  background: "#3b2608",
  borderColor: "#92400e",
  color: "#fde68a",
};

const dangerPill: CSSProperties = {
  ...pillBase,
  background: "#3a1017",
  borderColor: "#7f1d1d",
  color: "#fecaca",
};