function apigwBase() {
  return (
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.APIGW_BASE ||
    "http://localhost:3010"
  );
}

function workspaceLabel(workspace: string) {
  if (workspace === "WELLNESS_PARTNER") return "Wellness Partner";
  if (workspace === "CORPORATE_SPONSOR") return "Corporate Sponsor";
  return "Payer Operations";
}

async function getInvite(token: string) {
  if (!token) return null;

  const res = await fetch(
    `${apigwBase()}/api/client/org-invitations/${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );

  if (!res.ok) return null;

  const json = await res.json().catch(() => null);
  return json?.ok ? json.invitation : null;
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = String(searchParams.token || "").trim();
  const invite = await getInvite(token);

  const invalid =
    !invite ||
    invite.status !== "INVITED" ||
    new Date(invite.expiresAt).getTime() < Date.now();

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
              This invitation is invalid, expired, or already accepted.
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
              <strong>
                {workspaceLabel(String(invite.defaultWorkspace))}
              </strong>{" "}
              workspace.
            </p>

            <form
              action="/auth/accept-invite/submit"
              method="POST"
              style={{ display: "grid", gap: 16, marginTop: 18 }}
            >
              <input type="hidden" name="token" value={token} />

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 14, opacity: 0.84 }}>Email</span>
                <input
                  name="email"
                  value={invite.email}
                  readOnly
                  style={inputStyle}
                />
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
                  placeholder="Create password"
                  style={inputStyle}
                  required
                />
              </label>

              <button type="submit" style={primaryButton}>
                Accept invite
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