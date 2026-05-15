import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.redirect(new URL("/auth/login", "http://localhost"));
  res.cookies.set("ambulant_client_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST() {
  const res = NextResponse.json({ ok: true, redirectTo: "/auth/login" });
  res.cookies.set("ambulant_client_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}