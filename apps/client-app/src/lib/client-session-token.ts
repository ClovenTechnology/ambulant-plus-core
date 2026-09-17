import { cookies } from "next/headers";

export const CLIENT_SESSION_TOKEN_COOKIE = "ambulant_client_session_token";

export function readClientSessionToken() {
  return String(cookies().get(CLIENT_SESSION_TOKEN_COOKIE)?.value || "").trim();
}

export function requireClientSessionToken() {
  const token = readClientSessionToken();
  if (!token) {
    const error = new Error("signed_client_session_required") as Error & { status?: number };
    error.status = 401;
    throw error;
  }
  return token;
}

export function clientGatewaySessionCookieHeader() {
  const token = requireClientSessionToken();
  return `${CLIENT_SESSION_TOKEN_COOKIE}=${encodeURIComponent(token)}`;
}
