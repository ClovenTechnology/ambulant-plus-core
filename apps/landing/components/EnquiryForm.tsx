"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

const enquiryOptions = [
  { value: "general", label: "General enquiry" },
  { value: "demo", label: "Request demo" },
  { value: "partnerships", label: "Medical aid / HMO / sponsor / enterprise" },
  { value: "clinician_onboarding", label: "Clinician onboarding" },
  { value: "patient_support", label: "Patient support" },
  { value: "medreach_labs", label: "MedReach laboratory onboarding" },
  { value: "medreach_phlebotomists", label: "MedReach phlebotomist onboarding" },
  { value: "careport_pharmacies", label: "CarePort pharmacy onboarding" },
  { value: "careport_riders", label: "CarePort rider onboarding" },
  { value: "training", label: "Training" },
  { value: "careers", label: "Careers" },
  { value: "franchise", label: "Franchise / international expansion" },
];

type FormState = {
  enquiryType: string;
  name: string;
  email: string;
  phone: string;
  organisation: string;
  role: string;
  country: string;
  message: string;
  consent: boolean;
  companyWebsite: string;
};

const initialState: FormState = {
  enquiryType: "general",
  name: "",
  email: "",
  phone: "",
  organisation: "",
  role: "",
  country: "South Africa",
  message: "",
  consent: false,
  companyWebsite: "",
};

function getInitialTypeFromUrl() {
  if (typeof window === "undefined") return "general";

  const params = new URLSearchParams(window.location.search);
  const value = params.get("type") || params.get("enquiry") || "";

  const allowed = new Set(enquiryOptions.map((item) => item.value));

  return allowed.has(value) ? value : "general";
}

export default function EnquiryForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const enquiryType = getInitialTypeFromUrl();
    setForm((current) => ({ ...current, enquiryType }));
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok) {
        setStatus("error");
        setMessage(data?.error || "Unable to send enquiry at the moment.");
        return;
      }

      setStatus("success");
      setMessage("Thank you. Your enquiry has been sent to the Ambulant+ team.");
      setForm({ ...initialState, enquiryType: form.enquiryType });
    } catch {
      setStatus("error");
      setMessage("Unable to send enquiry. Please try again or email the team directly.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass-panel rounded-[36px] p-6 md:p-8">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            Send a structured enquiry
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Route your message to the right Ambulant+ team for demos, partnerships, onboarding,
            support, training, operations or international expansion.
          </p>
        </div>
      </div>

      <input
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        name="companyWebsite"
        value={form.companyWebsite}
        onChange={(event) => update("companyWebsite", event.target.value)}
      />

      <div className="mt-7 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-800">Enquiry type</span>
          <select
            value={form.enquiryType}
            onChange={(event) => update("enquiryType", event.target.value)}
            className="min-h-12 rounded-2xl border border-cyan-100 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            required
          >
            {enquiryOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800">Full name</span>
            <input
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              className="min-h-12 rounded-2xl border border-cyan-100 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              className="min-h-12 rounded-2xl border border-cyan-100 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              required
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800">Phone</span>
            <input
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              className="min-h-12 rounded-2xl border border-cyan-100 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800">Country</span>
            <input
              value={form.country}
              onChange={(event) => update("country", event.target.value)}
              className="min-h-12 rounded-2xl border border-cyan-100 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800">Organisation</span>
            <input
              value={form.organisation}
              onChange={(event) => update("organisation", event.target.value)}
              placeholder="Medical aid, HMO, pharmacy, lab, employer..."
              className="min-h-12 rounded-2xl border border-cyan-100 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800">Role</span>
            <input
              value={form.role}
              onChange={(event) => update("role", event.target.value)}
              placeholder="CEO, doctor, pharmacist, lab manager..."
              className="min-h-12 rounded-2xl border border-cyan-100 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-800">Message</span>
          <textarea
            value={form.message}
            onChange={(event) => update("message", event.target.value)}
            rows={7}
            placeholder="Tell us what you want to discuss, deploy, book, integrate or evaluate..."
            className="rounded-2xl border border-cyan-100 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            required
          />
        </label>

        <label className="flex gap-3 rounded-3xl border border-cyan-100 bg-cyan-50/60 p-4">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(event) => update("consent", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-cyan-200"
            required
          />
          <span className="text-sm leading-7 text-slate-600">
            I agree that Ambulant+ may use the information submitted to respond to this enquiry.
            I understand that this form must not be used for emergencies or urgent clinical care.
          </span>
        </label>

        {message && (
          <div
            className={`rounded-3xl p-4 text-sm leading-7 ${
              status === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <div className="flex gap-2">
              {status === "success" && <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />}
              <span>{message}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending enquiry
            </>
          ) : (
            <>
              Send enquiry
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}