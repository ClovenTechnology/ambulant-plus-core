export const dynamic = "force-dynamic";

function errorText(value: string) {
  if (!value) return "";
  return decodeURIComponent(value).replace(/_/g, " ");
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string };
}) {
  const token = String(searchParams.token || "").trim();
  const submitError = String(searchParams.error || "").trim();
  const missingToken = !token;

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

        {missingToken ? (
          <>
            <p style={{ opacity: 0.82, lineHeight: 1.6 }}>
              This invitation link is missing its token. Please ask Ambulant+ admin to reissue the invite.
            </p>

            <a href="/auth/login" style={primaryLink}>
              Go to login
            </a>
          </>
        ) : (
          <>
            <p style={{ opacity: 0.82, lineHeight: 1.6 }}>
              Create your password to activate your organization account. Ambulant+ will verify this invitation securely before access is granted.
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
                  lineHeight: 1.5,
                }}
              >
                {errorText(submitError)}
              </div>
            ) : null}

            <form
              action="/auth/accept-invite/complete"
              method="POST"
              style={{ display: "grid", gap: 16, marginTop: 18 }}
            >
              <input type="hidden" name="token" value={token} />

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 14, opacity: 0.84 }}>Full name</span>
                <input
                  name="name"
                  placeholder="Your name"
                  style={inputStyle}
                  autoComplete="name"
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
                  autoComplete="new-password"
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