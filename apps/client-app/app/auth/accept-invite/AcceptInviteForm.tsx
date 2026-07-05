"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

type Props = {
  token: string;
  submitError?: string;
};

function safeDecode(value: string) {
  if (!value) return "";

  try {
    return decodeURIComponent(value).replace(/_/g, " ");
  } catch {
    return value.replace(/_/g, " ");
  }
}

export default function AcceptInviteForm({ token, submitError = "" }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordHint = useMemo(() => {
    if (!password) return "Use at least 8 characters.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (confirmPassword && confirmPassword !== password) return "Passwords do not match.";
    return "Password requirement met.";
  }, [password, confirmPassword]);

  const hasMismatch = Boolean(confirmPassword && confirmPassword !== password);

  return (
    <>
      <p style={{ opacity: 0.82, lineHeight: 1.6 }}>
        Create your password to activate your organization account. Ambulant+ will verify this
        invitation securely before access is granted.
      </p>

      {submitError ? (
        <div style={errorBox}>
          {safeDecode(submitError)}
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
          <div style={passwordWrap}>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create password, minimum 8 characters"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={passwordInput}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              style={eyeButton}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 14, opacity: 0.84 }}>Confirm password</span>
          <input
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Retype password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            style={{
              ...inputStyle,
              borderColor: hasMismatch ? "#ef4444" : "#1f2a4d",
            }}
            autoComplete="new-password"
            required
          />
        </label>

        <div
          aria-live="polite"
          style={{
            fontSize: 13,
            color: hasMismatch || password.length > 0 && password.length < 8 ? "#fecaca" : "#a7f3d0",
            minHeight: 20,
          }}
        >
          {passwordHint}
        </div>

        <button
          type="submit"
          disabled={password.length < 8 || hasMismatch}
          style={{
            ...primaryButton,
            opacity: password.length < 8 || hasMismatch ? 0.6 : 1,
            cursor: password.length < 8 || hasMismatch ? "not-allowed" : "pointer",
          }}
        >
          Accept invite and set password
        </button>
      </form>
    </>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  color: "#e8ecf3",
  borderRadius: 12,
  padding: "12px 14px",
  outline: "none",
  boxSizing: "border-box",
};

const passwordWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  background: "#0f1730",
  border: "1px solid #1f2a4d",
  borderRadius: 12,
  overflow: "hidden",
};

const passwordInput: CSSProperties = {
  ...inputStyle,
  border: "none",
  borderRadius: 0,
  flex: 1,
};

const eyeButton: CSSProperties = {
  border: "none",
  borderLeft: "1px solid #1f2a4d",
  background: "#111b38",
  color: "#bfdbfe",
  padding: "0 14px",
  alignSelf: "stretch",
  fontWeight: 700,
  cursor: "pointer",
};

const primaryButton: CSSProperties = {
  background: "#2563eb",
  border: "1px solid #1d4ed8",
  color: "white",
  borderRadius: 12,
  padding: "12px 18px",
  fontWeight: 700,
  width: "fit-content",
};

const errorBox: CSSProperties = {
  marginTop: 14,
  background: "#3a1017",
  border: "1px solid #7f1d1d",
  color: "#fecaca",
  borderRadius: 12,
  padding: 12,
  fontSize: 14,
  lineHeight: 1.5,
};