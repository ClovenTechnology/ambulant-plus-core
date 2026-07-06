import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type SessionPayload = {
  uid?: string | null;
  orgId?: string | null;
  email?: string | null;
  role?: string | null;
  scopes?: string[];
};

function safeParse(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function appOrigin() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";

  if (!host) {
    throw new Error("client_app_origin_required");
  }

  return `${proto}://${host}`;
}

function internalRequestHeaders(extra: Record<string, string> = {}) {
  return {
    cookie: cookies().toString(),
    ...extra,
  };
}

function internalApiUrl(
  pathname: string,
  params: Record<string, string | number | undefined> = {},
) {
  const url = new URL(pathname, appOrigin());

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function canManageUsers(session: SessionPayload) {
  return (
    session.role === "ORG_OWNER" ||
    session.role === "ORG_ADMIN" ||
    session.scopes?.includes("org.users.manage")
  );
}

async function getOrg(orgId: string) {
  const res = await fetch(
    internalApiUrl("/api/client/orgs", { orgId }).toString(),
    {
      cache: "no-store",
      headers: internalRequestHeaders(),
    },
  );

  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return Array.isArray(json?.items) ? json.items[0] : null;
}

async function getInvitations(orgId: string) {
  const res = await fetch(
    internalApiUrl(`/api/client/orgs/${encodeURIComponent(orgId)}/invitations`).toString(),
    {
      cache: "no-store",
      headers: internalRequestHeaders(),
    },
  );

  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  return Array.isArray(json?.items) ? json.items : [];
}

function workspaceOptionsForOrgType(orgType: string) {
  if (orgType === "GYM" || orgType === "WELLNESS_PARTNER") {
    return [{ value: "WELLNESS_PARTNER", label: "Wellness Partner" }];
  }

  if (orgType === "CORPORATE_SPONSOR") {
    return [{ value: "CORPORATE_SPONSOR", label: "Corporate Sponsor" }];
  }

  return [{ value: "PAYER_OPS", label: "Payer Operations" }];
}

async function inviteStaff(formData: FormData) {
  "use server";

  const raw = cookies().get("ambulant_client_session")?.value;
  const session = safeParse(raw);

  if (!session?.uid || !session?.orgId) {
    redirect("/auth/login");
  }

  if (!canManageUsers(session)) {
    throw new Error("You do not have permission to invite users.");
  }

  const body = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    role: String(formData.get("role") || "READ_ONLY_ANALYST").trim(),
    defaultWorkspace: String(formData.get("defaultWorkspace") || "PAYER_OPS").trim(),
  };

  const res = await fetch(
    internalApiUrl(`/api/client/orgs/${encodeURIComponent(session.orgId)}/invitations`).toString(),
    {
      method: "POST",
      headers: internalRequestHeaders({
        "content-type": "application/json",
        "x-ambulant-user-id": session.uid || "",
        "x-ambulant-org-id": session.orgId || "",
      }),
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error || "Failed to create invitation.");
  }

  revalidatePath("/org/invitations");
  revalidatePath("/org/users");
}

export default async function OrgInvitationsPage() {
  const raw = cookies().get("ambulant_client_session")?.value;
  const session = safeParse(raw);

  if (!session?.uid || !session?.orgId) {
    redirect("/auth/login");
  }

  const [org, invitations] = await Promise.all([
    getOrg(session.orgId),
    getInvitations(session.orgId),
  ]);

  if (!org) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ marginTop: 0 }}>Organization not found</h1>
      </main>
    );
  }

  const workspaceOptions = workspaceOptionsForOrgType(String(org.orgType));
  const mayInvite = canManageUsers(session);

  return (
    <main style={{ padding: 32, maxWidth: 1320 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.7, textTransform: "uppercase" }}>
          Organization Administration
        </div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Staff Invitations</h1>
        <p style={{ margin: 0, opacity: 0.82 }}>
          Invite staff into {org.name}, assign workspace, role, and initial scopes.
        </p>
      </div>

      <section style={grid}>
        <Metric label="Organization" value={org.name} />
        <Metric label="Org type" value={String(org.orgType)} />
        <Metric label="Invitations" value={String(invitations.length)} />
        <Metric label="Open invites" value={String(invitations.filter((x: any) => x.status === "INVITED").length)} />
      </section>

      {mayInvite ? (
        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Invite staff member</h2>

          <form action={inviteStaff} style={{ display: "grid", gap: 14, marginTop: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              <Field label="Full name">
                <input name="name" placeholder="e.g. Claims Officer" style={inputStyle} />
              </Field>

              <Field label="Email">
                <input name="email" type="email" placeholder="person@organization.com" style={inputStyle} required />
              </Field>

              <Field label="Role">
                <select name="role" style={inputStyle} defaultValue="READ_ONLY_ANALYST">
                  <option value="ORG_ADMIN">Org Admin</option>
                  <option value="BENEFITS_MANAGER">Benefits Manager</option>
                  <option value="AUTH_REVIEWER">Authorization Reviewer</option>
                  <option value="CLAIMS_OFFICER">Claims Officer</option>
                  <option value="FINANCE_OFFICER">Finance Officer</option>
                  <option value="CASE_MANAGER">Case Manager</option>
                  <option value="WELLNESS_MANAGER">Wellness Manager</option>
                  <option value="WELLNESS_OPERATOR">Wellness Operator</option>
                  <option value="READ_ONLY_ANALYST">Read-only Analyst</option>
                </select>
              </Field>

              <Field label="Default workspace">
                <select name="defaultWorkspace" style={inputStyle} defaultValue={workspaceOptions[0]?.value}>
                  {workspaceOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <button type="submit" style={primaryButton}>
              Create invitation
            </button>
          </form>
        </section>
      ) : null}

      <section style={{ ...card, marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Invitation history</h2>
            <div style={{ opacity: 0.75, fontSize: 14 }}>
              Invitations are generated now; email delivery can be wired later.
            </div>
          </div>

          <a href="/org/users" style={secondaryLink}>
            View users
          </a>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          {invitations.length === 0 ? (
            <div style={{ opacity: 0.72 }}>No invitations created yet.</div>
          ) : (
            invitations.map((invite: any) => (
              <div key={invite.id} style={rowCard}>
                <div>
                  <div style={{ fontWeight: 700 }}>{invite.name || invite.email}</div>
                  <div style={{ opacity: 0.72, fontSize: 13, marginTop: 4 }}>
                    {invite.email} · {invite.role} · {String(invite.defaultWorkspace)}
                  </div>
                  <div style={{ opacity: 0.6, fontSize: 12, marginTop: 4 }}>
                    Invite URL: /auth/accept-invite?token={invite.token}
                  </div>
                </div>

                <Badge label={String(invite.status)} tone={invite.status === "INVITED" ? "warn" : invite.status === "ACTIVE" ? "good" : "muted"} />
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 8 }}><span style={{ fontSize: 13, opacity: 0.8 }}>{label}</span>{children}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={card}><div style={{ opacity: 0.7, marginBottom: 8 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div></div>;
}

function Badge({ label, tone }: { label: string; tone: "good" | "warn" | "muted" }) {
  const colors = tone === "good" ? { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" } : tone === "warn" ? { bg: "#3b2608", border: "#92400e", text: "#fde68a" } : { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  return <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>{label}</span>;
}

const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 18 };
const card: React.CSSProperties = { background: "#121931", border: "1px solid #1f2a4d", borderRadius: 16, padding: 18 };
const rowCard: React.CSSProperties = { background: "#0f1730", border: "1px solid #1f2a4d", borderRadius: 14, padding: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" };
const inputStyle: React.CSSProperties = { width: "100%", background: "#0f1730", border: "1px solid #1f2a4d", color: "inherit", borderRadius: 12, padding: "12px 14px", outline: "none", boxSizing: "border-box" };
const primaryButton: React.CSSProperties = { background: "#2563eb", border: "1px solid #1d4ed8", color: "white", borderRadius: 12, padding: "12px 16px", fontWeight: 700, cursor: "pointer", width: "fit-content" };
const secondaryLink: React.CSSProperties = { background: "#121931", border: "1px solid #334155", color: "white", borderRadius: 12, padding: "12px 16px", fontWeight: 700, textDecoration: "none" };