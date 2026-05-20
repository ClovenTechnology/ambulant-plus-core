// apps/patient-app/app/api/reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  return configured ? trimSlash(configured) : '';
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest, includeJson = false) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-patient-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-correlation-id',
    'x-request-id',
    'idempotency-key',
    'x-idempotency-key',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  if (includeJson) headers.set('content-type', 'application/json');
  if (!headers.has('x-role')) headers.set('x-role', 'patient');

  return headers;
}

async function readPayload(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getReminderList(payload: any): any[] {
  if (Array.isArray(payload?.reminders)) return payload.reminders;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function filterTodayMedication(payload: any, source: string | null) {
  const filtered = getReminderList(payload).filter((r) => {
    if (!r || typeof r !== 'object') return false;

    const status = String(r.status || '').toLowerCase();
    if (status && !['pending', 'scheduled', 'due'].some((item) => status.includes(item))) {
      return false;
    }

    if (source) {
      const recordSource = String(r.source || r.type || r.category || '').toLowerCase();
      if (recordSource && !recordSource.includes(source.toLowerCase())) return false;
    }

    return true;
  });

  if (Array.isArray(payload?.reminders)) return { ...payload, reminders: filtered };
  if (Array.isArray(payload?.items)) return { ...payload, items: filtered };
  if (Array.isArray(payload)) return filtered;
  return { ok: true, reminders: filtered };
}

async function fetchUpstream(args: {
  root: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: Headers;
  body?: unknown;
}) {
  const res = await fetch(`${args.root}${args.path}`, {
    method: args.method,
    cache: 'no-store',
    headers: args.headers,
    body: args.method === 'GET' ? undefined : JSON.stringify(args.body ?? {}),
  });

  const payload = await readPayload(res);
  return { res, payload };
}

function isConfirmAction(body: any) {
  const action = String(body?.action || body?.type || '').toLowerCase();
  return action.includes('confirm') || action.includes('taken') || action.includes('complete');
}

function isSnoozeAction(body: any) {
  return String(body?.action || body?.type || '').toLowerCase().includes('snooze');
}

function isMissedAction(body: any) {
  const action = String(body?.action || body?.type || body?.status || '').toLowerCase();
  return action.includes('missed') || action.includes('skip');
}

function isCreateAction(body: any) {
  const action = String(body?.action || body?.type || '').toLowerCase();
  return action.includes('create') || Array.isArray(body) || Array.isArray(body?.reminders) || Array.isArray(body?.items);
}

function reminderIds(body: any): string[] {
  const ids = [
    ...(Array.isArray(body?.ids) ? body.ids : []),
    ...(Array.isArray(body?.reminderIds) ? body.reminderIds : []),
    body?.id,
    body?.reminderId,
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return Array.from(new Set(ids));
}

function asReminderArray(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.reminders)) return body.reminders;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

async function forwardMutation(req: NextRequest, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE') {
  const base = gatewayBase();
  if (!base) {
    return json(
      {
        ok: false,
        error: 'api_gateway_base_required',
        message: 'Reminder service is temporarily unavailable because the API gateway is not configured.',
      },
      503,
    );
  }

  const root = base;
  const incoming = new URL(req.url);
  const qs = incoming.searchParams.toString();
  const headers = forwardHeaders(req, true);
  const bodyText = await req.text().catch(() => '');
  let body: any = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const basePath = qs ? `/api/reminders?${qs}` : '/api/reminders';

  const ids = reminderIds(body);
  const takenAt = String(body?.takenAt || body?.reportedTakenAt || new Date().toISOString());
  const snoozeMinutes = Number(body?.snoozeMinutes || body?.minutes || 15);

  const attempts: Array<{
    path: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body: unknown;
    label: string;
  }> = [];

  if (method === 'DELETE') {
    attempts.push({ path: basePath, method: 'DELETE', body, label: 'delete_base' });
  } else if (isConfirmAction(body) && ids.length > 0) {
    const confirmBody = {
      ...body,
      action: 'confirm',
      id: ids[0],
      ids,
      reminderId: ids[0],
      reminderIds: ids,
      takenAt,
      reportedTakenAt: takenAt,
      status: 'Taken',
      takenSource: body?.takenSource || 'SELF_REPORTED',
      verificationStatus: body?.verificationStatus || 'SELF_REPORTED',
    };

    attempts.push(
      { path: basePath, method: 'POST', body: confirmBody, label: 'confirm_base_post' },
      { path: '/api/reminders/confirm', method: 'POST', body: confirmBody, label: 'confirm_action_post' },
      { path: `/api/reminders/${encodeURIComponent(ids[0])}/confirm`, method: 'POST', body: confirmBody, label: 'confirm_id_post' },
      { path: `/api/reminders/${encodeURIComponent(ids[0])}`, method: 'PATCH', body: confirmBody, label: 'confirm_id_patch' },
    );
  } else if (isSnoozeAction(body) && ids.length > 0) {
    const snoozeBody = {
      ...body,
      action: 'snooze',
      id: ids[0],
      ids,
      reminderId: ids[0],
      reminderIds: ids,
      snoozeMinutes,
    };

    attempts.push(
      { path: basePath, method: 'POST', body: snoozeBody, label: 'snooze_base_post' },
      { path: '/api/reminders/snooze', method: 'POST', body: snoozeBody, label: 'snooze_action_post' },
      { path: `/api/reminders/${encodeURIComponent(ids[0])}/snooze`, method: 'POST', body: snoozeBody, label: 'snooze_id_post' },
      { path: `/api/reminders/${encodeURIComponent(ids[0])}`, method: 'PATCH', body: snoozeBody, label: 'snooze_id_patch' },
    );
  } else if (isMissedAction(body) && ids.length > 0) {
    const missedAt = String(body?.missedAt || body?.skippedAt || new Date().toISOString());
    const missedBody = {
      ...body,
      action: 'missed',
      id: ids[0],
      ids,
      reminderId: ids[0],
      reminderIds: ids,
      status: 'Missed',
      missedAt,
      skippedAt: missedAt,
      reason: body?.reason || 'patient_skipped_or_missed',
      meta: {
        ...(body?.meta && typeof body.meta === 'object' ? body.meta : {}),
        missedReason: body?.meta?.missedReason || body?.reason || 'patient_skipped_or_missed',
        refillSignalCandidate: body?.meta?.refillSignalCandidate ?? true,
      },
    };

    attempts.push(
      { path: basePath, method: 'POST', body: missedBody, label: 'missed_base_post' },
      { path: '/api/reminders/missed', method: 'POST', body: missedBody, label: 'missed_action_post' },
      { path: '/api/reminders/skip', method: 'POST', body: missedBody, label: 'skip_action_post' },
      { path: `/api/reminders/${encodeURIComponent(ids[0])}/missed`, method: 'POST', body: missedBody, label: 'missed_id_post' },
      { path: `/api/reminders/${encodeURIComponent(ids[0])}/skip`, method: 'POST', body: missedBody, label: 'skip_id_post' },
      { path: `/api/reminders/${encodeURIComponent(ids[0])}`, method: 'PATCH', body: missedBody, label: 'missed_id_patch' },
    );
  } else if (isCreateAction(body)) {
    const items = asReminderArray(body);
    const createBody = Array.isArray(body) ? { action: 'create', reminders: body, items: body } : body;

    attempts.push(
      { path: basePath, method: method === 'PATCH' ? 'PATCH' : 'POST', body: createBody, label: 'create_base_original' },
      { path: basePath, method: 'POST', body: { action: 'create', reminders: items, items }, label: 'create_base_wrapped' },
      { path: '/api/reminders/create', method: 'POST', body: { reminders: items, items }, label: 'create_action_post' },
      { path: basePath, method: 'PUT', body: items.length ? items : body, label: 'create_base_put' },
    );
  } else {
    attempts.push({ path: basePath, method, body, label: 'generic_base' });
  }

  let last: { status: number; payload: unknown; label: string } | null = null;

  for (const attempt of attempts) {
    const result = await fetchUpstream({ root, path: attempt.path, method: attempt.method, headers, body: attempt.body });

    const payload = result.payload;
    const explicitFail = payload && typeof payload === 'object' && !Array.isArray(payload) && (payload as any).ok === false;

    if (result.res.ok && !explicitFail) {
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return json({ ok: true, ...(payload as any), proxyAttempt: attempt.label }, result.res.status);
      }
      return json({ ok: true, data: payload, proxyAttempt: attempt.label }, result.res.status);
    }

    last = { status: result.res.status, payload, label: attempt.label };

    if (![400, 404, 405, 409, 422].includes(result.res.status)) break;
  }

  return json(
    {
      ok: false,
      error:
        last?.payload && typeof last.payload === 'object' && !Array.isArray(last.payload)
          ? (last.payload as any).error || (last.payload as any).message || `reminder_gateway_http_${last.status}`
          : `reminder_gateway_http_${last?.status ?? 0}`,
      proxyAttempt: last?.label,
      upstreamStatus: last?.status,
      upstream: last?.payload,
    },
    last?.status && last.status >= 400 ? last.status : 502,
  );
}

async function forwardGet(req: NextRequest) {
  const base = gatewayBase();
  if (!base) {
    return json(
      {
        ok: false,
        error: 'api_gateway_base_required',
        message: 'Reminder service is temporarily unavailable because the API gateway is not configured.',
      },
      503,
    );
  }

  const incoming = new URL(req.url);
  const forParam = incoming.searchParams.get('for');
  const source = incoming.searchParams.get('source');
  const upstream = new URL(`${base}/api/reminders`);
  incoming.searchParams.forEach((value, key) => {
    if (key !== 'for') upstream.searchParams.set(key, value);
  });

  const res = await fetch(upstream.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: forwardHeaders(req),
  });
  const payload = await readPayload(res);

  if (forParam === 'today') return json(filterTodayMedication(payload, source), res.status);
  return json(payload ?? { ok: res.ok }, res.status);
}

export async function GET(req: NextRequest) {
  return forwardGet(req);
}

export async function POST(req: NextRequest) {
  return forwardMutation(req, 'POST');
}

export async function PUT(req: NextRequest) {
  return forwardMutation(req, 'PUT');
}

export async function PATCH(req: NextRequest) {
  return forwardMutation(req, 'PATCH');
}

export async function DELETE(req: NextRequest) {
  return forwardMutation(req, 'DELETE');
}
