"use client";

import { useMemo, useState } from "react";

export type ProcurementActionConfig = {
  label: string;
  method: "POST" | "PATCH";
  action: string;
  description: string;
  template: Record<string, any>;
};

type Props = {
  endpoint: string;
  title?: string;
  intro?: string;
  actions: ProcurementActionConfig[];
};

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function makeKey(action: ProcurementActionConfig) {
  return (
    "admin-" +
    action.action.replace(/[^a-zA-Z0-9_-]/g, "-") +
    "-" +
    Date.now().toString(36)
  );
}

export function ProcurementActionConsole(props: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = props.actions[selectedIndex] || props.actions[0];

  const initialPayload = useMemo(() => {
    if (!selected) return "{}";
    return pretty({ action: selected.action, ...selected.template });
  }, [selected]);

  const [payloadText, setPayloadText] = useState(initialPayload);
  const [idempotency, setIdempotency] = useState(selected ? makeKey(selected) : "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  function chooseAction(index: number) {
    const next = props.actions[index];
    setSelectedIndex(index);
    setPayloadText(pretty({ action: next.action, ...next.template }));
    setIdempotency(makeKey(next));
    setResult(null);
    setStatus("idle");
  }

  async function submit() {
    if (!selected) return;

    setBusy(true);
    setResult(null);
    setStatus("idle");

    try {
      const payload = JSON.parse(payloadText);

      const response = await fetch("/api/admin/enterprise-finance/proxy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: props.endpoint,
          method: selected.method,
          payload,
          idempotencyKey: idempotency,
        }),
      });

      const text = await response.text();
      setStatus(response.ok ? "ok" : "error");

      try {
        setResult(pretty(JSON.parse(text)));
      } catch {
        setResult(text || "(empty response)");
      }
    } catch (error: any) {
      setStatus("error");
      setResult(error?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!props.actions.length) return null;

  return (
    <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-5 shadow-2xl shadow-slate-950/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Admin action console
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {props.title || "Procurement workflow actions"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            {props.intro ||
              "Submit controlled POST/PATCH actions to the Enterprise Finance API. Review payloads carefully before running."}
          </p>
        </div>

        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
          Mutating actions
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="space-y-3">
          {props.actions.map((action, index) => (
            <button
              key={action.action}
              type="button"
              onClick={() => chooseAction(index)}
              className={
                "w-full rounded-2xl border p-4 text-left transition " +
                (index === selectedIndex
                  ? "border-cyan-300 bg-slate-950 text-white"
                  : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-cyan-500/60")
              }
            >
              <span className="block text-sm font-semibold">{action.label}</span>
              <span className="mt-1 block text-xs uppercase tracking-wide text-slate-500">
                {action.method} · {action.action}
              </span>
              <span className="mt-2 block text-sm leading-6 text-slate-400">
                {action.description}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-200">
            Idempotency key
            <input
              value={idempotency}
              onChange={(event) => setIdempotency(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-xs text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            JSON payload
            <textarea
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              rows={14}
              spellCheck={false}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-xs leading-5 text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Submitting..." : "Run selected action"}
          </button>

          {result ? (
            <div
              className={
                "rounded-2xl border p-4 text-sm " +
                (status === "ok"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                  : "border-rose-400/30 bg-rose-400/10 text-rose-100")
              }
            >
              <p className="mb-2 font-semibold">
                {status === "ok" ? "Action completed" : "Action failed"}
              </p>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-5">
                {result}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
