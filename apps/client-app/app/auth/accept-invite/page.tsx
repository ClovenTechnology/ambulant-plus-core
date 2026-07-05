import AcceptInviteForm from "./AcceptInviteForm";

export const dynamic = "force-dynamic";

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
          <AcceptInviteForm token={token} submitError={submitError} />
        )}
      </div>
    </main>
  );
}

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