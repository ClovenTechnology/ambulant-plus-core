"use client";

import { useState } from "react";

export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!email.trim()) throw new Error("Email is required.");
      if (!password.trim()) throw new Error("Password is required.");

      const res = await fetch("/auth/login/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Login failed.");
      }

      window.location.href = json?.redirectTo || "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

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
          maxWidth: 520,
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 1.6, opacity: 0.7, textTransform: "uppercase" }}>
          Ambulant+
        </div>

        <h1 style={{ marginTop: 10, marginBottom: 8, fontSize: 30 }}>
          Client Console Login
        </h1>

        <p style={{ marginTop: 0, opacity: 0.82, lineHeight: 1.6 }}>
          Sign in with your organization account. Ambulant+ will route you automatically
          to the correct workspace for your organization.
        </p>

        {error ? (
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
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16, marginTop: 18 }}>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organization.com"
              style={inputStyle}
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <a href="/auth/forgot-password" style={{ color: "#93c5fd", textDecoration: "none", fontSize: 14 }}>
              Forgot password?
            </a>

            <button type="submit" disabled={submitting} style={primaryButton}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid #1f2a4d",
            fontSize: 13,
            opacity: 0.74,
            lineHeight: 1.6,
          }}
        >
          Your workspace is resolved from your organization profile and role assignment.
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 14, opacity: 0.84 }}>{label}</span>
      {children}
    </label>
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
};