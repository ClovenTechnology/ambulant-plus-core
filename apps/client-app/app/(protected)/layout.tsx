import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessClientPath } from "@/src/lib/client-rbac";

type SessionPayload = {
  uid?: string | null;
  orgId?: string | null;
  email?: string | null;
  orgType?:
    | "MEDICAL_AID"
    | "HMO"
    | "CORPORATE_SPONSOR"
    | "GYM"
    | "WELLNESS_PARTNER"
    | null;
  workspace?:
    | "payer_ops"
    | "corporate_sponsor"
    | "wellness_partner"
    | null;
  role?: string | null;
  scopes?: unknown;
};

function safeParseSession(value: string | undefined): SessionPayload | null {
  if (!value) return null;

  try {
    const json = JSON.parse(value);
    return json && typeof json === "object" ? (json as SessionPayload) : null;
  } catch {
    return null;
  }
}

function homePathForWorkspace(workspace?: string | null) {
  return workspace === "wellness_partner" ? "/wellness" : "/dashboard";
}

function workspaceLabel(session: SessionPayload) {
  switch (session.workspace) {
    case "wellness_partner":
      return "Wellness Workspace";
    case "corporate_sponsor":
      return "Corporate Sponsor Workspace";
    default:
      return "Payer Operations Workspace";
  }
}

function permittedNavItems(
  session: SessionPayload,
  items: Array<{ href: string; label: string }>
) {
  return items.filter((item) => canAccessClientPath(session, item.href));
}

function navItemsForSession(session: SessionPayload) {
  if (session.workspace === "wellness_partner") {
    return permittedNavItems(session, [
      { href: "/wellness", label: "Wellness Workspace" },
      { href: "/members", label: "Members" },
      { href: "/eligibility", label: "Eligibility" },
      { href: "/authorizations", label: "Authorizations" },
      { href: "/claims", label: "Claims" },
      { href: "/member-reimbursements", label: "Member Reimbursements" },
      { href: "/audit", label: "Audit" },
      { href: "/org/users", label: "Org Users" },
      { href: "/org/invitations", label: "Invitations" },
    ]);
  }

  if (session.workspace === "corporate_sponsor") {
    return permittedNavItems(session, [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/members", label: "Members" },
      { href: "/eligibility", label: "Eligibility" },
      { href: "/products", label: "Sponsor Programs" },
      { href: "/preflight", label: "Coverage Preflight" },
      { href: "/authorizations", label: "Authorizations" },
      { href: "/claims", label: "Claims" },
      { href: "/wallet", label: "Wallet" },
      { href: "/careport", label: "CarePort" },
      { href: "/medreach", label: "MedReach" },
      { href: "/member-reimbursements", label: "Member Reimbursements" },
      { href: "/org/users", label: "Org Users" },
      { href: "/audit", label: "Audit" },
      { href: "/org/invitations", label: "Invitations" },
    ]);
  }

  return permittedNavItems(session, [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/members", label: "Members" },
    { href: "/eligibility", label: "Eligibility" },
    { href: "/coverage", label: "Coverage" },
    { href: "/products", label: "Products" },
    { href: "/preflight", label: "Coverage Preflight" },
    { href: "/authorizations", label: "Authorizations" },
    { href: "/claims", label: "Claims" },
    { href: "/wallet", label: "Wallet" },
    { href: "/exports", label: "Exports" },
    { href: "/settlements", label: "Settlements" },
    { href: "/settlements/providers", label: "Settlement Providers" },
    { href: "/providers", label: "Providers" },
    { href: "/devices", label: "Devices" },
    { href: "/careport", label: "CarePort" },
    { href: "/medreach", label: "MedReach" },
    { href: "/member-reimbursements", label: "Member Reimbursements" },
    { href: "/audit", label: "Audit" },
    { href: "/org", label: "Org Admin" },
    { href: "/org/users", label: "Org Users" },
    { href: "/org/invitations", label: "Invitations" },
  ]);
}

async function logoutAction() {
  "use server";

  const cookieStore = cookies();

  cookieStore.set("ambulant_client_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  redirect("/auth/login");
}

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = cookies();
  const raw = cookieStore.get("ambulant_client_session")?.value;
  const session = safeParseSession(raw);

  if (!session?.uid || !session?.workspace) {
    redirect("/auth/login");
  }

  const navItems = navItemsForSession(session);
  const homePath = homePathForWorkspace(session.workspace);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "280px 1fr",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid #1f2a4d",
          background: "#0f1730",
          padding: 20,
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 1.6,
            opacity: 0.7,
            textTransform: "uppercase",
          }}
        >
          Ambulant+
        </div>

        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
          Client Console
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            opacity: 0.76,
            lineHeight: 1.5,
          }}
        >
          {workspaceLabel(session)}
        </div>

        <div
          style={{
            marginTop: 18,
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 14,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div style={{ opacity: 0.64 }}>Signed in as</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>
            {session.email || session.uid}
          </div>
          <div style={{ opacity: 0.72, marginTop: 4 }}>
            {session.orgType || "Unknown org"} · {session.role || "Unknown role"}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <Link
            href={homePath}
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: 10,
              background: "#0c2238",
              border: "1px solid #1d4ed8",
              color: "#bfdbfe",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Workspace Home
          </Link>
        </div>

        <nav style={{ display: "grid", gap: 10, marginTop: 22 }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "#121931",
                border: "1px solid #1f2a4d",
                color: "#e8ecf3",
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 20 }}>
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                display: "inline-block",
                padding: "10px 12px",
                borderRadius: 10,
                background: "#3a1017",
                border: "1px solid #7f1d1d",
                color: "#fecaca",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main>{children}</main>
    </div>
  );
}

export async function generateMetadata() {
  return {
    title: "Ambulant+ Client Workspace",
    description: "Protected workspace for payer, sponsor, and wellness operators",
  };
}