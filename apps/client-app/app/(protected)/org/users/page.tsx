import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

function apigwBase() {
  return process.env.NEXT_PUBLIC_APIGW_BASE || process.env.APIGW_BASE || "http://localhost:3010";
}

function canManageUsers(session: SessionPayload) {
  return (
    session.role === "ORG_OWNER" ||
    session.role === "ORG_ADMIN" ||
    session.scopes?.includes("org.users.manage")
  );
}

async function getOrg(orgId: string) {
  const res = await fetch(`${apigwBase()}/api/client/orgs?orgId=${encodeURIComponent(orgId)}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return Array.isArray(json?.items) ? json.items[0] : null;
}

export default async function OrgUsersPage() {
  const raw = cookies().get("ambulant_client_session")?.value;
  const session = safeParse(raw);

  if (!session?.uid || !session?.orgId) {
    redirect("/auth/login");
  }

  const org = await getOrg(session.orgId);
  const users = Array.isArray(org?.users) ? org.users : [];

  if (!org) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ marginTop: 0 }}>Organization not found</h1>
      </main>
    );
  }

  return (
    <main style={{ padding: 32, maxWidth: 1320 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.7, textTransform: "uppercase" }}>
          Organization Administration
        </div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Users & Access</h1>
        <p style={{ margin: 0, opacity: 0.82 }}>
          Manage staff access for {org.name}. Super admins can invite staff, assign roles, and control workspace permissions.
        </p>
      </div>

      <section style={grid}>
        <Metric label="Organization" value={org.name} />
        <Metric label="Org type" value={String(org.orgType)} />
        <Metric label="Status" value={String(org.status)} />
        <Metric label="Users" value={String(users.length)} />
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Staff members</h2>
            <div style={{ opacity: 0.75, fontSize: 14 }}>
              Active, invited, suspended, and removed users bound to this organization.
            </div>
          </div>

          {canManageUsers(session) ? (
            <a href="/org/invitations" style={primaryLink}>
              Invite staff
            </a>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          {users.length === 0 ? (
            <div style={{ opacity: 0.72 }}>No users found for this organization.</div>
          ) : (
            users.map((user: any) => (
              <div key={user.id} style={rowCard}>
                <div>
                  <div style={{ fontWeight: 700 }}>{user.name || user.email}</div>
                  <div style={{ opacity: 0.72, fontSize: 13, marginTop: 4 }}>
                    {user.email} · {user.role} · {String(user.defaultWorkspace)}
                  </div>
                  <div style={{ opacity: 0.6, fontSize: 12, marginTop: 4 }}>
                    User ID: {user.userId || "—"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Badge label={String(user.status)} tone={user.status === "ACTIVE" ? "good" : user.status === "INVITED" ? "warn" : "muted"} />
                  {(Array.isArray(user.scopes) ? user.scopes : []).slice(0, 4).map((scope: string) => (
                    <Badge key={scope} label={scope} tone="neutral" />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={card}>
      <div style={{ opacity: 0.7, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "good" | "warn" | "neutral" | "muted" }) {
  const colors =
    tone === "good"
      ? { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" }
      : tone === "warn"
      ? { bg: "#3b2608", border: "#92400e", text: "#fde68a" }
      : tone === "neutral"
      ? { bg: "#0c2238", border: "#1d4ed8", text: "#bfdbfe" }
      : { bg: "#1f2937", border: "#374151", text: "#d1d5db" };

  return (
    <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
      {label}
    </span>
  );
}

const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 18 };
const card: React.CSSProperties = { background: "#121931", border: "1px solid #1f2a4d", borderRadius: 16, padding: 18 };
const rowCard: React.CSSProperties = { background: "#0f1730", border: "1px solid #1f2a4d", borderRadius: 14, padding: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" };
const primaryLink: React.CSSProperties = { background: "#2563eb", border: "1px solid #1d4ed8", color: "white", borderRadius: 12, padding: "12px 16px", fontWeight: 700, textDecoration: "none" };