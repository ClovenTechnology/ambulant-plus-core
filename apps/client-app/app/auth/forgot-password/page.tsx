"use client";

import { useState } from "react";

export default function ClientForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!email.trim()) {
        throw new Error("Email is required.");
      }

      const res = await fetch("/auth/forgot-password/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Unable to process reset request.");
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process reset request.");
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
          maxWidth: 500,
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 1.6, opacity: 0.7, textTransform: "uppercase" }}>
          Ambulant+
        </div>
        <h1 style={{ marginTop: 10, marginBottom: 8, fontSize: 28 }}>
          Reset your password
        </h1>
        <p style={{ marginTop: 0, opacity: 0.82, lineHeight: 1.6 }}>
          Enter your work email and we’ll send password reset instructions for your client-console account.
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

        {done ? (
          <div
            style={{
              marginTop: 16,
              background: "#0f2a1f",
              border: "1px solid #14532d",
              color: "#bbf7d0",
              borderRadius: 12,
              padding: 14,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Reset instructions have been accepted for processing.  
            Please check your email for the next step.
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 16, marginTop: 18 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, opacity: 0.84 }}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organization.com"
                style={inputStyle}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <a
                href="/auth/login"
                style={{
                  color: "#93c5fd",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                Back to login
              </a>

              <button type="submit" disabled={submitting} style={primaryButton}>
                {submitting ? "Submitting…" : "Send reset link"}
              </button>
            </div>
          </form>
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
};