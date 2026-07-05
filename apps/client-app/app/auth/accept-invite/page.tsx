const CANONICAL_APIGW_BASE = "https://api-gateway.ambulantplus.co.za";

function apigwBase() {
  const raw = String(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      CANONICAL_APIGW_BASE,
  ).trim();

  const candidate = raw.replace(/\/+$/, "") || CANONICAL_APIGW_BASE;

  try {
    const parsed = new URL(candidate);
    const host = parsed.host.toLowerCase();

    if (
      host.includes("clients.ambulantplus.co.za") ||
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1")
    ) {
      return CANONICAL_APIGW_BASE;
    }

    return candidate;
  } catch {
    return CANONICAL_APIGW_BASE;
  }
}

function workspaceLabel(workspace: string) {
  if (workspace === "WELLNESS_PARTNER") return "Wellness Partner";
  if (workspace === "CORPORATE_SPONSOR") return "Corporate Sponsor";
  return "Payer Operations";
}

async function getInvite(token: string) {
  if (!token) {
    return { invite: null, reason: "missing_token" };
  }

  try {
    const res = await fetch(
      `${apigwBase()}/api/client/org-invitations/${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      return {
        invite: null,
        reason: json?.error || `lookup_failed_${res.status}`,
      };
    }

    return { invite: json.invitation, reason: "" };
  } catch (error) {
    return {
      invite: null,
      reason: error instanceof Error ? error.message : "lookup_failed",
    };
  }
}

function invalidMessage(reason: string) {
  if (reason === "missing_token") return "This invitation link is missing its token.";
  if (reason === "invitation_not_found") return "This invitation token was not found.";
  if (reason === "invitation_expired") return "This invitation has expired.";
  if (reason === "invitation_not_open") return "This invitation is already accepted or no longer open.";
  return "This invitation is invalid, expired, or already accepted.";
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string };
}) {
  const token = String(searchParams.token || "").trim();
  const result = await getInvite(token);
  const invite = result.invite as any;

  let reason = result.reason;

  if (invite?.status && invite.status !== "INVITED") {
    reason = "invitation_not_open";
  }

  if (invite?.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    reason = "invitation_expired";
  }

  const invalid = !invite || Boolean(reason);
  const submitError = String(searchParams.error || "").trim();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#0b1020",
        color: "#e8ecf3",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 20,
          padding: 24,
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

        <h1 style={{ marginTop: 10, marginBottom: 8, fontSize: 30 }}>
          Accept organization invite
        </h1>

        {invalid ? (
          <>
            <p style={{ opacity: 0.82, lineHeight: 1.6 }}>
              {invalidMessage(reason)}
            </p>

            <a href="/auth/login" style={primaryLink}>
              Go to login
            </a>
          </>
        ) : (
          <>
            <p style={{ opacity: 0.82, lineHeight: 1.6 }}>
              You have been invited to join{" "}
              <strong>{invite.org.name}</strong> as{" "}
              <strong>{invite.role}</strong> in the{" "}
              <strong>{workspaceLabel(String(invite.defaultWorkspace))}</strong>{" "}
              workspace.
            </p>

            {submitError ? (
              <div
                style={{
                  marginTop: 14,
                  background: "#3a1017",
                  border: "1px solid #7f1d1d",
                  color: "#fecaca",
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                }}
              >
                {submitError}
              </div>
            ) : null}

            <form
              action="/api/auth/accept-invite/submit"
              method="POST"
              style={{ display: "grid", gap: 16, marginTop: 18 }}
            >
              <input type="hidden" name="token" value={token} />

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 14, opacity: 0.84 }}>Email</span>
                <input name="email" value={invite.email} readOnly style={inputStyle} />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 14, opacity: 0.84 }}>Full name</span>
                <input
                  name="name"
                  defaultValue={invite.name || ""}
                  placeholder="Your name"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 14, opacity: 0.84 }}>Password</span>
                <input
                  name="password"
                  type="password"
                  placeholder="Create password, minimum 8 characters"
                  minLength={8}
                  style={inputStyle}
                  required
                />
              </label>

              <button type="submit" style={primaryButton}>
                Accept invite and set password
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  color: "#e8ecf3",
  borderRadius: 12,
  padding: "12px 14px",
  outline: "none",
  boxSizing: "border-box",
};

const primaryButton: React.CSSProperties = {
  background: "#2563eb",
  border: "1px solid #1d4ed8",
  color: "white",
  borderRadius: 12,
  padding: "12px 18px",
  fontWeight: 700,
  cursor: "pointer",
  width: "fit-content",
};

const primaryLink: React.CSSProperties = {
  display: "inline-block",
  background: "#2563eb",
  border: "1px solid #1d4ed8",
  color: "white",
  borderRadius: 12,
  padding: "12px 18px",
  fontWeight: 700,
  textDecoration: "none",
};