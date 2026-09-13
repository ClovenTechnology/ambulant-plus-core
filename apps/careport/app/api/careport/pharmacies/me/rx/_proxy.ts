import { NextRequest, NextResponse } from "next/server";
import { apigwBase } from "@/app/api/_apigw";

function headers(req: NextRequest, json = false) {
  const h = new Headers();
  for (const key of [
    "authorization","cookie","x-ambulant-identity","x-ambulant-user-id","x-ambulant-org-id",
    "x-ambulant-role","x-user-id","x-uid","x-role","x-email","x-name","x-display-name",
    "x-org-id","x-correlation-id","x-request-id",
  ]) {
    const value = req.headers.get(key); if (value) h.set(key, value);
  }
  h.set("accept", "application/json"); if (json) h.set("content-type", "application/json");
  return h;
}
async function jsonBody(res: Response) {
  const text = await res.text().catch(() => "");
  try { return text ? JSON.parse(text) : {}; } catch { return { ok: false, error: "invalid_gateway_json", raw: text.slice(0,500) }; }
}
export async function proxyRx(req: NextRequest, path: string, method: "GET"|"POST"|"PATCH") {
  try {
    const incoming = new URL(req.url); const upstream = new URL(path, apigwBase());
    incoming.searchParams.forEach((v,k) => upstream.searchParams.set(k,v));
    const body = method === "GET" ? undefined : await req.text();
    const res = await fetch(upstream.toString(), { method, headers: headers(req, method !== "GET"), ...(body !== undefined ? { body } : {}), cache: "no-store" });
    return NextResponse.json(await jsonBody(res), { status: res.status, headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "careport_rx_partner_proxy_failed" }, { status: 502 });
  }
}
export async function proxyRxStream(req: NextRequest, path: string) {
  try {
    const incoming = new URL(req.url); const upstream = new URL(path, apigwBase());
    incoming.searchParams.forEach((v,k) => upstream.searchParams.set(k,v));
    const res = await fetch(upstream.toString(), { method: "GET", headers: headers(req), cache: "no-store" });
    if (!res.ok || !res.body) return NextResponse.json({ ok: false, error: await res.text().catch(() => "rx_stream_failed") }, { status: res.status || 502 });
    return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") || "text/event-stream", "cache-control": "no-cache, no-transform" } });
  } catch (error: any) { return NextResponse.json({ ok: false, error: error?.message || "rx_stream_proxy_failed" }, { status: 502 }); }
}
