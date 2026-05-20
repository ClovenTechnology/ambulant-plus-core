// apps/patient-app/components/PillRemindersWrapper.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  TimerReset,
  XCircle,
} from "lucide-react";
import { toast } from "@/components/toast";

type Reminder = {
  id: string;
  medicationId?: string | null;
  name: string;
  dose?: string;
  time?: string;
  scheduledFor?: string | null;
  dueAt?: string | null;
  status: "Pending" | "Taken" | "Missed" | string;
  snoozedUntil?: string | null;
  verificationRequired?: boolean | null;
  verificationStatus?: string | null;
  meta?: Record<string, any> | null;
};

type ReminderAction = "confirm" | "snooze" | "missed";

const TAKE_WINDOW_BEFORE_MS = 5 * 60 * 1000;

function normaliseReminder(item: any): Reminder | null {
  if (!item || typeof item !== "object") return null;

  const id = String(item.id ?? item.reminderId ?? "").trim();
  const name = String(
    item.name ?? item.medicationName ?? item.title ?? item.meta?.name ?? "",
  ).trim();

  if (!id || !name) return null;

  return {
    id,
    medicationId: item.medicationId == null ? null : String(item.medicationId),
    name,
    dose: item.dose == null ? undefined : String(item.dose),
    time:
      item.time == null
        ? item.dueAt == null
          ? item.scheduledFor == null
            ? undefined
            : String(item.scheduledFor)
          : String(item.dueAt)
        : String(item.time),
    scheduledFor: item.scheduledFor == null ? null : String(item.scheduledFor),
    dueAt: item.dueAt == null ? null : String(item.dueAt),
    status: String(item.status ?? "Pending"),
    snoozedUntil: item.snoozedUntil == null ? null : String(item.snoozedUntil),
    verificationRequired: Boolean(
      item.verificationRequired ?? item.meta?.verificationRequired,
    ),
    verificationStatus:
      item.verificationStatus == null ? null : String(item.verificationStatus),
    meta: item.meta && typeof item.meta === "object" ? item.meta : null,
  };
}

function parseReminderDate(value?: string | null): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [hh, mm] = raw.split(":").map((x) => Number(x));
    const today = new Date();
    today.setHours(
      Number.isFinite(hh) ? hh : today.getHours(),
      Number.isFinite(mm) ? mm : 0,
      0,
      0,
    );
    return today;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function dueDate(reminder: Reminder): Date | null {
  return (
    parseReminderDate(reminder.snoozedUntil) ||
    parseReminderDate(reminder.dueAt) ||
    parseReminderDate(reminder.scheduledFor) ||
    parseReminderDate(reminder.time)
  );
}

function timeLabel(value?: string | null) {
  if (!value) return "Time not set";

  const d = parseReminderDate(value);
  if (d) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return value;
}

function statusClasses(status: string) {
  const raw = status.toLowerCase();
  if (raw.includes("taken") || raw.includes("complete"))
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (raw.includes("miss") || raw.includes("skip"))
    return "border-rose-100 bg-rose-50 text-rose-700";
  if (raw.includes("snooze"))
    return "border-indigo-100 bg-indigo-50 text-indigo-700";
  return "border-sky-100 bg-sky-50 text-sky-700";
}

function reminderState(reminder: Reminder, nowMs: number) {
  const status = String(reminder.status || "").toLowerCase();
  const snoozedUntil = parseReminderDate(reminder.snoozedUntil);
  const effectiveDue = dueDate(reminder);
  const effectiveDueMs = effectiveDue?.getTime() ?? null;

  const taken = status.includes("taken") || status.includes("complete");
  const missed = status.includes("miss") || status.includes("skip");
  const snoozed = Boolean(snoozedUntil && snoozedUntil.getTime() > nowMs);
  const canTake =
    !taken &&
    !missed &&
    !snoozed &&
    effectiveDueMs !== null &&
    nowMs >= effectiveDueMs - TAKE_WINDOW_BEFORE_MS;
  const canMarkMissed =
    !taken &&
    !missed &&
    !snoozed &&
    effectiveDueMs !== null &&
    nowMs >= effectiveDueMs;
  const overdue =
    !taken &&
    !missed &&
    !snoozed &&
    effectiveDueMs !== null &&
    nowMs > effectiveDueMs;

  return {
    taken,
    missed,
    snoozed,
    canTake,
    canMarkMissed,
    overdue,
    effectiveDue,
  };
}

async function postReminderAction(payload: any) {
  const res = await fetch("/api/reminders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || data?.ok === false) {
    throw new Error(
      data?.message || data?.error || `Reminder action failed (${res.status})`,
    );
  }

  return data;
}

async function startCameraVerification(reminder: Reminder) {
  if (
    typeof navigator !== "undefined" &&
    navigator.mediaDevices?.getUserMedia
  ) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    stream.getTracks().forEach((track) => track.stop());
  }

  const res = await fetch("/api/medication-verifications/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      reminderId: reminder.id,
      medicationId: reminder.medicationId ?? null,
      requiredMode: "CAMERA_SEQUENCE",
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok || !data?.sessionId) {
    throw new Error(
      data?.message || data?.error || "Could not start camera verification.",
    );
  }

  const returnTo = encodeURIComponent("/");
  window.location.href = `/reminder/verify?reminderId=${encodeURIComponent(reminder.id)}&sessionId=${encodeURIComponent(data.sessionId)}&returnTo=${returnTo}`;
}

export default function PillRemindersWrapper(_props: {
  pills?: {
    id?: string;
    name: string;
    dose?: string;
    time?: string;
    status?: string;
  }[];
}) {
  void _props;

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [takePromptReminder, setTakePromptReminder] = useState<Reminder | null>(
    null,
  );
  const [takeUseCameraVerification, setTakeUseCameraVerification] =
    useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/reminders?source=medication&for=today", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);

      const raw = Array.isArray(data?.reminders)
        ? data.reminders
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];

      const normalised = raw
        .map(normaliseReminder)
        .filter(Boolean) as Reminder[];

      setReminders(
        normalised.sort((a, b) => {
          const ad = dueDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bd = dueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return ad - bd;
        }),
      );
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function openTakePrompt(reminder: Reminder) {
    if (busyId) return;
    setTakePromptReminder(reminder);
    setTakeUseCameraVerification(Boolean(reminder.verificationRequired));
  }

  function closeTakePrompt(force = false) {
    if (busyId && !force) return;
    setTakePromptReminder(null);
    setTakeUseCameraVerification(false);
  }

  async function recordTakenSelfReported(reminder: Reminder) {
    const takenAt = new Date().toISOString();
    await postReminderAction({
      action: "confirm",
      id: reminder.id,
      ids: [reminder.id],
      reminderId: reminder.id,
      takenAt,
      reportedTakenAt: takenAt,
      takenSource: "SELF_REPORTED",
      verificationStatus: "SELF_REPORTED",
      reason: "homepage_take_now_self_reported",
    });

    setReminders((prev) =>
      prev.map((r) =>
        r.id === reminder.id
          ? {
              ...r,
              status: "Taken",
              snoozedUntil: null,
              verificationStatus: "SELF_REPORTED",
            }
          : r,
      ),
    );

    toast("Medication marked as taken.", { type: "success" });
  }

  async function handleTakePromptSubmit() {
    if (!takePromptReminder || busyId) return;

    setBusyId(takePromptReminder.id);
    try {
      if (takeUseCameraVerification) {
        await startCameraVerification(takePromptReminder);
        return;
      }

      await recordTakenSelfReported(takePromptReminder);
      closeTakePrompt(true);
    } catch (err: any) {
      toast(err?.message || "Could not complete this medication action.", {
        type: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function runAction(reminder: Reminder, action: ReminderAction) {
    if (busyId) return;

    setBusyId(reminder.id);

    try {
      if (action === "confirm") {
        await recordTakenSelfReported(reminder);
        return;
      }

      if (action === "snooze") {
        await postReminderAction({
          action: "snooze",
          id: reminder.id,
          ids: [reminder.id],
          reminderId: reminder.id,
          snoozeMinutes: 15,
          reason: "homepage_snooze",
        });

        const snoozedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
        setReminders((prev) =>
          prev.map((r) =>
            r.id === reminder.id
              ? { ...r, snoozedUntil, status: "Pending" }
              : r,
          ),
        );

        toast("Reminder snoozed for 15 minutes.", { type: "success" });
        return;
      }

      await postReminderAction({
        action: "missed",
        id: reminder.id,
        ids: [reminder.id],
        reminderId: reminder.id,
        status: "Missed",
        missedAt: new Date().toISOString(),
        reason: "patient_skipped_or_missed",
        meta: {
          ...(reminder.meta ?? {}),
          missedReason: "patient_skipped_or_missed",
          refillSignalCandidate: true,
          sourceSurface: "homepage_medication_schedule",
        },
      });

      setReminders((prev) =>
        prev.map((r) =>
          r.id === reminder.id
            ? { ...r, status: "Missed", snoozedUntil: null }
            : r,
        ),
      );

      toast(
        "Marked as missed. This can support refill/reconciliation logic later.",
        { type: "info" },
      );
    } catch (err: any) {
      toast(err?.message || "Could not update this reminder.", {
        type: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = useMemo(
    () =>
      reminders.filter((r) => {
        const state = reminderState(r, nowMs);
        return !state.taken && !state.missed;
      }).length,
    [reminders, nowMs],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Today’s medication schedule
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {pendingCount > 0
              ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} still due today`
              : "No pending medication reminders"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw
            className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
          />
          Refresh
        </button>
      </div>

      {loading && reminders.length === 0 ? (
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100/70" />
      ) : null}

      {!loading && reminders.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/72 p-4 text-sm leading-6 text-slate-600">
          Your medication schedule is clear for today. New reminders will appear
          here when a plan is active.
        </div>
      ) : null}

      {reminders.length > 0 ? (
        <ul className="space-y-2.5">
          {reminders.slice(0, 5).map((r) => {
            const state = reminderState(r, nowMs);
            const disabled = busyId === r.id;
            const snoozeLabel = r.snoozedUntil
              ? `Snoozed until ${timeLabel(r.snoozedUntil)}`
              : null;

            return (
              <li
                key={r.id}
                className="rounded-[22px] border border-white/75 bg-white/88 p-3.5 shadow-sm"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {r.name}
                        {r.dose ? (
                          <span className="font-medium text-slate-500">
                            {" "}
                            • {r.dose}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {timeLabel(
                            r.snoozedUntil ||
                              r.dueAt ||
                              r.scheduledFor ||
                              r.time,
                          )}
                        </span>
                        {snoozeLabel ? <span>• {snoozeLabel}</span> : null}
                        {state.overdue ? (
                          <span className="font-semibold text-amber-700">
                            • Due now
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClasses(String(r.status))}`}
                    >
                      {state.snoozed ? "Snoozed" : r.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {state.canTake ? (
                      <button
                        type="button"
                        onClick={() => openTakePrompt(r)}
                        disabled={disabled}
                        title={
                          r.verificationRequired
                            ? "Take now with camera verification"
                            : "Mark medication as taken now"
                        }
                        aria-label={
                          r.verificationRequired
                            ? `Take ${r.name} now with camera verification`
                            : `Mark ${r.name} as taken now`
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Take now
                      </button>
                    ) : null}

                    {!state.taken && !state.missed && !state.snoozed ? (
                      <button
                        type="button"
                        onClick={() => void runAction(r, "snooze")}
                        disabled={disabled}
                        title="Snooze this reminder for 15 minutes"
                        aria-label={`Snooze ${r.name} for 15 minutes`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                      >
                        <TimerReset className="h-3.5 w-3.5" />
                        Snooze
                      </button>
                    ) : null}

                    {state.canMarkMissed ? (
                      <button
                        type="button"
                        onClick={() => void runAction(r, "missed")}
                        disabled={disabled}
                        title="Mark as missed or skipped"
                        aria-label={`Mark ${r.name} as missed or skipped`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Missed
                      </button>
                    ) : null}

                    {!state.canTake &&
                    !state.canMarkMissed &&
                    !state.taken &&
                    !state.missed &&
                    !state.snoozed ? (
                      <span className="text-xs text-slate-500">
                        Take now opens 5 minutes before due time.
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {takePromptReminder ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Take medication"
        >
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-950/20">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="min-w-0">
                <div className="text-base font-bold text-slate-950">
                  Take medication
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Confirm this dose now, or use camera verification when
                  required.
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeTakePrompt()}
                disabled={Boolean(busyId)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-sm font-bold text-slate-950">
                {takePromptReminder.name}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {[
                  takePromptReminder.dose,
                  timeLabel(
                    takePromptReminder.snoozedUntil ||
                      takePromptReminder.dueAt ||
                      takePromptReminder.scheduledFor ||
                      takePromptReminder.time,
                  ),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {takePromptReminder.verificationRequired ? (
                <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-800">
                  This reminder is set to use camera verification by default.
                </div>
              ) : null}
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={takeUseCameraVerification}
                onChange={(event) =>
                  setTakeUseCameraVerification(event.target.checked)
                }
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block font-bold text-slate-950">
                  Use camera verification
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  If selected, your webcam will open and you will complete the
                  guided dose-verification sequence.
                </span>
              </span>
            </label>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => closeTakePrompt()}
                disabled={Boolean(busyId)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleTakePromptSubmit()}
                disabled={Boolean(busyId)}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {busyId
                  ? "Opening…"
                  : takeUseCameraVerification
                    ? "Start camera verification"
                    : "Record dose"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
