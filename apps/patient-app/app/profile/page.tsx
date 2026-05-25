// apps/patient-app/app/profile/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Edit3,
  Shield,
  Smartphone,
  Sparkles,
  UserRound,
  Waves,
} from "lucide-react";

import Sparkline from "@/components/Sparkline";
import AllergiesPanel from "@/components/AllergiesPanel";
import CareTeamCard from "@/components/CareTeamCard";
import MedicalAidManager from "@/components/MedicalAidManager";

type DeviceCatalogItem = {
  id: string;
  slug: string;
  vendor: string;
  name: string;
  model: string;
  category: "iomt" | "wearable";
  kind: "vitals" | "stethoscope" | "otoscope" | "ring";
  summary: string;
  href: string;
  status: "supported";
  capabilities: string[];
  battery?: number;
  recent?: Array<{ value: number }>;
  connected?: boolean;
  lastSeenHuman?: string;
};

type VitalsSummary = {
  hr?: number | { value?: number };
  hrNow?: number | { value?: number };
  bp?: string;
  bpNow?: string | { s?: number | null; d?: number | null } | null;
  temp?: number;
  tempNow?: number;
  spo2?: number;
  spo2Now?: number;
  overallStatus?: string;
  lastSyncHuman?: string;
  score?: number;
  insights?: string[];
  [key: string]: any;
};

type AdherenceSummaryPayload = {
  ok?: boolean;
  summary?: {
    weightedPct?: number;
    confidencePct?: number;
    verifiedRatio?: number;
    missedDoseRate?: number;
    lateDoseRate?: number;
    trackedDoseCount?: number;
    verifiedTaken?: number;
    selfReportedTaken?: number;
    missed?: number;
    pending?: number;
    activeMedicationCount?: number;
    coveredActiveMedicationCount?: number;
    uncoveredMedicationCount?: number;
    reminderCoveragePct?: number;
  };
  dailyTrend?: Array<{
    date: string;
    weightedPct: number;
    confidencePct: number;
    verifiedTaken: number;
    selfReportedTaken: number;
    missed: number;
    pending: number;
  }>;
  medicationBreakdown?: Array<{
    medicationId: string;
    name: string;
    dose?: string | null;
    source?: string | null;
    pending: number;
    missed: number;
    verifiedTaken: number;
    selfReportedTaken: number;
    lateCount: number;
    reminderCount: number;
    weightedPct: number;
    confidencePct: number;
    remindersConfigured: boolean;
    state: string;
  }>;
  uncoveredMedications?: Array<{
    medicationId: string;
    name: string;
    dose?: string | null;
    source?: string | null;
    status?: string | null;
  }>;
  interventions?: {
    highRiskMedications?: any[];
    weakEvidenceMedications?: any[];
    needsReminderSetup?: any[];
  };
  rewardSignals?: {
    verifiedDays?: number;
    rewardPointsEstimate?: number;
    rewardEligible?: boolean;
  };
};

type SharingPreference = {
  patientId?: string;
  allowClinicianAccess?: boolean;
  allowMedicalAidAdherenceAccess?: boolean;
  allowCorporateSponsorAdherenceAccess?: boolean;
  allowRewardProgramAccess?: boolean;
  allowEvidenceImages?: boolean;
};

type EmergencyContact = {
  name?: string;
  phone?: string;
  relationship?: string;
  email?: string;
};

type ProfileForm = {
  name: string;
  contactEmail: string;
  phone: string;
  primaryComm: string;
  dob: string;
  gender: string;
  idNumber: string;
  mrn: string;
  photoUrl: string;

  heightCm: number | "";
  weightKg: number | "";
  bloodType: string;

  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  useAsDefaultDelivery: boolean;

  // legacy display compatibility
  address: string;
  mobile: string;

  emergencyContact: EmergencyContact;
};

const SURFACE =
  "relative overflow-hidden rounded-[30px] border border-white/55 bg-white/72 backdrop-blur-2xl shadow-[0_16px_60px_rgba(15,23,42,0.08)]";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof value === "object" && value && "value" in (value as any)) {
    return toNumber((value as any).value);
  }
  return null;
}

function formatBpNow(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;

  if (value && typeof value === "object") {
    const s = (value as any).s ?? (value as any).systolic;
    const d = (value as any).d ?? (value as any).diastolic;

    if (s || d) {
      return `${s ?? "—"}/${d ?? "—"}`;
    }
  }

  return null;
}

function normalizeVitalsSummaryPayload(payload: any): VitalsSummary | null {
  if (!payload || payload?.ok === false) return null;

  return {
    ...payload,
    hr: payload.hr ?? payload.hrNow,
    spo2: payload.spo2 ?? payload.spo2Now,
    bp: payload.bp ?? formatBpNow(payload.bpNow),
    temp: payload.temp ?? payload.tempNow,
  };
}

function hasVitals(summary: VitalsSummary | null) {
  const hr = toNumber(summary?.hr);
  const spo2 = toNumber(summary?.spo2);
  const temp = toNumber(summary?.temp);
  const bp = typeof summary?.bp === "string" && summary.bp.includes("/");
  return hr !== null || spo2 !== null || temp !== null || bp;
}

function deriveHealthScore(summary: VitalsSummary | null, completeness: number) {
  if (!hasVitals(summary)) {
    return Math.max(35, Math.min(80, Math.round(45 + completeness * 0.35)));
  }

  const hr = toNumber(summary?.hr) ?? 72;
  const spo2 = toNumber(summary?.spo2) ?? 98;
  const temp = toNumber(summary?.temp) ?? 36.8;

  const bpRaw = String(summary?.bp ?? "");
  const [systolicRaw, diastolicRaw] = bpRaw.split("/");
  const systolic = toNumber(systolicRaw) ?? 120;
  const diastolic = toNumber(diastolicRaw) ?? 80;

  const spo2Score = Math.max(0, Math.min(100, spo2));
  const hrScore = Math.max(0, 100 - Math.abs(hr - 72) * 2);
  const tempScore = Math.max(0, 100 - Math.abs(temp - 36.9) * 28);
  const bpScore = Math.max(
    0,
    100 - (Math.abs(systolic - 120) * 0.8 + Math.abs(diastolic - 80) * 0.6),
  );

  const raw =
    spo2Score * 0.34 +
    hrScore * 0.22 +
    tempScore * 0.16 +
    bpScore * 0.16 +
    completeness * 0.12;

  return Math.max(35, Math.min(99, Math.round(raw)));
}

function getHealthLabel(score: number) {
  if (score >= 86) return "Stable";
  if (score >= 74) return "Good";
  if (score >= 62) return "Watchful";
  return "Needs attention";
}

function getHealthNarrative(score: number, summary: VitalsSummary | null) {
  if (!hasVitals(summary)) {
    return "No recent vitals have been synced yet. Complete a reading or connect a supported device to strengthen your live health picture.";
  }

  const spo2 = toNumber(summary?.spo2) ?? 98;
  const hr = toNumber(summary?.hr) ?? 72;
  const bp = String(summary?.bp ?? "");
  const systolic = toNumber(bp.split("/")[0]) ?? 120;

  if (score < 62) {
    return "A few signals need a closer look today. Review your latest vitals and keep your care team updated.";
  }
  if (spo2 < 94 || systolic > 140 || hr > 105) {
    return "Most readings look manageable, but one or two trends deserve extra attention and follow-up.";
  }
  return "Your latest readings suggest a calm, connected profile with no immediate concern signals.";
}

function displayMetric(value: unknown, suffix = "") {
  const n = toNumber(value);
  if (n === null) return "—";
  return `${n}${suffix}`;
}

function displayBloodPressure(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "—";
  return value;
}

function displayLockedValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "Not yet verified";
}

function LockedProfileField({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="text-sm text-slate-500">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
          Verified
        </span>
      </div>
      <div className="mt-1 min-h-[48px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-800">
        {displayLockedValue(value)}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        This identity field is locked. Contact support if it needs correction.
      </p>
    </div>
  );
}

function normalizeDeviceKind(value: unknown): DeviceCatalogItem["kind"] {
  const raw = String(value || "").trim().toLowerCase();

  if (raw === "vitals" || raw === "monitor" || raw === "health-monitor") {
    return "vitals";
  }

  if (raw === "stethoscope") {
    return "stethoscope";
  }

  if (raw === "otoscope") {
    return "otoscope";
  }

  if (raw === "ring" || raw === "wearable" || raw === "nexring") {
    return "ring";
  }

  return "vitals";
}

function normalizeDeviceCategory(value: unknown): DeviceCatalogItem["category"] {
  return String(value || "").toLowerCase() === "wearable" ? "wearable" : "iomt";
}

function defaultDeviceHref(kind: DeviceCatalogItem["kind"]) {
  switch (kind) {
    case "stethoscope":
      return "/myCare/devices/stethoscope";
    case "otoscope":
      return "/myCare/devices/otoscope";
    case "ring":
      return "/myCare/devices/nexring";
    case "vitals":
    default:
      return "/myCare/devices/health-monitor";
  }
}

function defaultDeviceSummary(kind: DeviceCatalogItem["kind"]) {
  switch (kind) {
    case "stethoscope":
      return "Digital auscultation workflow for heart and lung sounds, playback, session review and clinician sharing.";
    case "otoscope":
      return "High-definition otoscope workflow for ear imaging, capture review and care-team sharing.";
    case "ring":
      return "Ring-based wearable insights for pulse, SpO₂, HRV, sleep, recovery and longitudinal wellness signals.";
    case "vitals":
    default:
      return "Multi-parameter health monitor for temperature, oxygen saturation, blood pressure, glucose, heart rate and ECG workflows.";
  }
}

function defaultDeviceCapabilities(kind: DeviceCatalogItem["kind"]) {
  switch (kind) {
    case "stethoscope":
      return ["Heart auscultation", "Lung auscultation", "Playback"];
    case "otoscope":
      return ["HD imaging", "Image capture", "Review"];
    case "ring":
      return ["Pulse", "SpO₂", "HRV", "Sleep insights"];
    case "vitals":
    default:
      return [
        "Temperature",
        "SpO₂",
        "Blood pressure",
        "Glucose",
        "Heart rate",
        "ECG",
      ];
  }
}

function normalizeRecentTelemetry(value: unknown): Array<{ value: number }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "number" && Number.isFinite(item)) {
        return { value: item };
      }

      const n = toNumber((item as any)?.value ?? (item as any)?.y);
      return n === null ? null : { value: n };
    })
    .filter((item): item is { value: number } => Boolean(item));
}

function normalizeDeviceCatalogItem(item: any): DeviceCatalogItem | null {
  if (!item || typeof item !== "object") return null;

  const id = String(item.id ?? item.slug ?? item.name ?? "").trim();
  const name = String(item.name ?? item.label ?? item.model ?? "").trim();

  if (!id || !name) return null;

  const kind = normalizeDeviceKind(item.kind ?? item.modality ?? item.type);
  const capabilities = Array.isArray(item.capabilities)
    ? item.capabilities
        .map((cap: unknown) => String(cap || "").trim())
        .filter(Boolean)
    : defaultDeviceCapabilities(kind);

  return {
    id,
    slug: String(item.slug ?? id),
    vendor: String(item.vendor ?? "DueCare"),
    name,
    model: String(item.model ?? ""),
    category: normalizeDeviceCategory(item.category),
    kind,
    summary: String(
      item.summary ?? item.description ?? defaultDeviceSummary(kind),
    ),
    href: String(item.href ?? defaultDeviceHref(kind)),
    status: "supported",
    capabilities,
    battery: typeof item.battery === "number" ? item.battery : undefined,
    recent: normalizeRecentTelemetry(item.recent),
    connected: Boolean(item.connected ?? item.paired),
    lastSeenHuman:
      typeof item.lastSeenHuman === "string"
        ? item.lastSeenHuman
        : typeof item.lastSeenAt === "string" && item.lastSeenAt
          ? "Recently synced"
          : undefined,
  };
}

function normalizeDeviceCatalogPayload(payload: any): DeviceCatalogItem[] {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.devices)
      ? payload.devices
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  return raw
    .map((item: any) => normalizeDeviceCatalogItem(item))
    .filter((item): item is DeviceCatalogItem => Boolean(item));
}

function initialsFromName(value: unknown) {
  const name = String(value || "").trim();
  if (!name) return "PT";

  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "PT";
}

function OrbitalScore({ score }: { score: number }) {
  return (
    <div className="relative flex h-[250px] w-[250px] items-center justify-center sm:h-[280px] sm:w-[280px]">
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/20 via-indigo-400/10 to-fuchsia-400/20 blur-3xl"
        animate={{ scale: [1, 1.04, 1], opacity: [0.65, 0.95, 0.65] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute inset-[8%] rounded-full border border-cyan-300/40"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="pointer-events-none absolute inset-[18%] rounded-full border border-fuchsia-300/30"
        animate={{ rotate: -360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative z-10 flex h-[68%] w-[68%] flex-col items-center justify-center rounded-full border border-white/65 bg-white/84 shadow-[0_24px_90px_rgba(59,130,246,0.14)] backdrop-blur-xl">
        <div className="text-[10px] font-medium uppercase tracking-[0.3em] text-slate-500">
          Connected care signal
        </div>
        <div className="mt-2 bg-gradient-to-br from-slate-900 via-indigo-700 to-cyan-600 bg-clip-text text-5xl font-semibold text-transparent sm:text-6xl">
          {score}
        </div>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {getHealthLabel(score)}
        </div>
        <div className="mt-3 px-5 text-center text-[11px] leading-5 text-slate-500">
          Shaped by vitals, profile completeness and recent connected care
          signals
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    contactEmail: "",
    phone: "",
    primaryComm: "sms",
    dob: "",
    gender: "",
    idNumber: "",
    mrn: "",
    photoUrl: "",

    heightCm: "",
    weightKg: "",
    bloodType: "",

    addressLine1: "",
    addressLine2: "",
    city: "",
    postalCode: "",
    useAsDefaultDelivery: false,

    address: "",
    mobile: "",

    emergencyContact: {
      name: "",
      phone: "",
      relationship: "",
      email: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<DeviceCatalogItem[]>([]);
  const [vitalsSummary, setVitalsSummary] = useState<VitalsSummary | null>(null);
  const [careTeam, setCareTeam] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [adherenceSummary, setAdherenceSummary] =
    useState<AdherenceSummaryPayload | null>(null);
  const [sharingPreference, setSharingPreference] =
    useState<SharingPreference | null>(null);
  const [sharingBusy, setSharingBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [pRes, dRes, vRes, cRes, fRes] = await Promise.all([
          fetch("/api/profile", { cache: "no-store" }),
          fetch("/api/devices/list", { cache: "no-store" }),
          fetch("/api/vitals/summary", { cache: "no-store" }),
          fetch("/api/care-team", { cache: "no-store" }),
          fetch("/api/favourites", { cache: "no-store" }),
        ]);

        if (!mounted) return;

        const [p, d, v, c, f] = await Promise.all([
          pRes.json().catch(() => ({})),
          dRes.json().catch(() => ({ devices: [] })),
          vRes.json().catch(() => ({})),
          cRes.json().catch(() => []),
          fRes.json().catch(() => ({ ids: [] })),
        ]);

        if (!mounted) return;

        const safeProfile = p?.ok === false ? null : p?.profile || p || null;

        setProfile(safeProfile);
        setAdherenceSummary(safeProfile?.adherenceSummary ?? null);
        setForm((prev) => ({
          ...prev,
          name: safeProfile?.name || "",
          contactEmail: safeProfile?.contactEmail || safeProfile?.email || "",
          phone: safeProfile?.phone || safeProfile?.mobile || "",
          primaryComm: safeProfile?.primaryComm || "sms",
          dob: safeProfile?.dob || "",
          gender: safeProfile?.gender || "",
          idNumber: safeProfile?.idNumber || "",
          mrn: safeProfile?.mrn || "",
          photoUrl: safeProfile?.photoUrl || safeProfile?.avatarUrl || "",

          heightCm:
            typeof safeProfile?.heightCm === "number"
              ? safeProfile.heightCm
              : "",
          weightKg:
            typeof safeProfile?.weightKg === "number"
              ? safeProfile.weightKg
              : "",
          bloodType:
            safeProfile?.bloodType || safeProfile?.profileMetadata?.bloodType || "",

          addressLine1: safeProfile?.addressLine1 || safeProfile?.address || "",
          addressLine2: safeProfile?.addressLine2 || "",
          city: safeProfile?.city || "",
          postalCode: safeProfile?.postalCode || "",
          useAsDefaultDelivery: Boolean(safeProfile?.useAsDefaultDelivery),

          address:
            safeProfile?.address ||
            [
              safeProfile?.addressLine1,
              safeProfile?.addressLine2,
              safeProfile?.city,
              safeProfile?.postalCode,
            ]
              .filter(Boolean)
              .join(", "),
          mobile: safeProfile?.phone || safeProfile?.mobile || "",

          emergencyContact: {
            name: safeProfile?.emergencyContact?.name || "",
            phone: safeProfile?.emergencyContact?.phone || "",
            relationship: safeProfile?.emergencyContact?.relationship || "",
            email: safeProfile?.emergencyContact?.email || "",
          },
        }));

        try {
          const patientId = safeProfile?.patientId || safeProfile?.id;
          if (patientId) {
            const sharingRes = await fetch(
              `/api/profile/sharing?patientId=${encodeURIComponent(patientId)}`,
              {
                cache: "no-store",
              },
            );
            const sharingData = await sharingRes.json().catch(() => null);
            if (mounted) {
              setSharingPreference(sharingData?.sharingPreference ?? null);
            }
          } else if (mounted) {
            setSharingPreference(null);
          }
        } catch (err) {
          console.error("Failed to load sharing preference", err);
        }

        setDevices(normalizeDeviceCatalogPayload(d));
        setVitalsSummary(normalizeVitalsSummaryPayload(v));
        setCareTeam(Array.isArray(c) ? c : []);
        setFavs(Array.isArray(f?.ids) ? f.ids : []);
      } catch (err) {
        console.error("Failed to load profile data", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const bmi =
    typeof form.weightKg === "number" &&
    typeof form.heightCm === "number" &&
    form.heightCm > 0
      ? form.weightKg / Math.pow(form.heightCm / 100, 2)
      : null;

  function completenessScore() {
    const fields = ["name", "phone", "address", "emergencyContact"];
    let filled = 0;
    if (form.name?.trim()) filled++;
    if ((form.phone || form.mobile)?.trim()) filled++;
    if ((form.addressLine1 || form.address)?.trim()) filled++;
    if (
      form.emergencyContact?.name?.trim() &&
      form.emergencyContact?.phone?.trim()
    ) {
      filled++;
    }
    return Math.round((filled / fields.length) * 100);
  }

  const completeness = useMemo(() => completenessScore(), [form]);

  const healthScore = useMemo(
    () => deriveHealthScore(vitalsSummary, completeness),
    [vitalsSummary, completeness],
  );

  const healthNarrative = useMemo(
    () => getHealthNarrative(healthScore, vitalsSummary),
    [healthScore, vitalsSummary],
  );

  const enhancedVitalsSummary = useMemo(
    () => ({
      ...(vitalsSummary || {}),
      score: healthScore,
      overallStatus:
        vitalsSummary?.overallStatus || getHealthLabel(healthScore),
      lastSyncHuman: vitalsSummary?.lastSyncHuman || "No vitals synced yet",
      insights: vitalsSummary?.insights || [healthNarrative],
    }),
    [vitalsSummary, healthScore, healthNarrative],
  );

  const adherenceHeadline = useMemo(() => {
    const s = adherenceSummary?.summary;
    if (!s) {
      return {
        weightedPct: 0,
        confidencePct: 0,
        verifiedRatio: 0,
        reminderCoveragePct: 0,
      };
    }

    return {
      weightedPct: s.weightedPct ?? 0,
      confidencePct: s.confidencePct ?? 0,
      verifiedRatio: s.verifiedRatio ?? 0,
      reminderCoveragePct: s.reminderCoveragePct ?? 0,
    };
  }, [adherenceSummary]);

  async function save() {
    setSaving(true);

    try {
      const payload = {
        patientId: profile?.patientId || profile?.id || undefined,
        userId: profile?.userId || undefined,

        phone: form.phone || form.mobile || null,
        mobile: form.phone || form.mobile || null,
        primaryComm: form.primaryComm || null,
        photoUrl: form.photoUrl || null,

        heightCm:
          typeof form.heightCm === "number" ? Number(form.heightCm) : null,
        weightKg:
          typeof form.weightKg === "number" ? Number(form.weightKg) : null,
        bloodType: form.bloodType || null,

        addressLine1: form.addressLine1 || form.address || null,
        addressLine2: form.addressLine2 || null,
        city: form.city || null,
        postalCode: form.postalCode || null,
        useAsDefaultDelivery: form.useAsDefaultDelivery,

        address:
          form.address ||
          [form.addressLine1, form.addressLine2, form.city, form.postalCode]
            .filter(Boolean)
            .join(", ") ||
          null,

        emergencyContact: form.emergencyContact || null,
      };

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Profile save failed (${res.status})`);
      }

      const saved = data.profile || data;

      setProfile((prev: any) => ({
        ...(prev || {}),
        ...saved,
      }));

      setForm((prev) => ({
        ...prev,
        name: saved.name || prev.name,
        contactEmail: saved.contactEmail || saved.email || prev.contactEmail,
        phone: saved.phone || saved.mobile || prev.phone,
        mobile: saved.phone || saved.mobile || prev.mobile,
        primaryComm: saved.primaryComm || prev.primaryComm,
        dob: saved.dob || prev.dob,
        gender: saved.gender || prev.gender,
        idNumber: saved.idNumber || prev.idNumber,
        mrn: saved.mrn || prev.mrn,
        photoUrl: saved.photoUrl || saved.avatarUrl || prev.photoUrl,

        heightCm:
          typeof saved.heightCm === "number" ? saved.heightCm : prev.heightCm,
        weightKg:
          typeof saved.weightKg === "number" ? saved.weightKg : prev.weightKg,
        bloodType:
          saved.bloodType || saved.profileMetadata?.bloodType || prev.bloodType,

        addressLine1: saved.addressLine1 || prev.addressLine1,
        addressLine2: saved.addressLine2 || prev.addressLine2,
        city: saved.city || prev.city,
        postalCode: saved.postalCode || prev.postalCode,
        useAsDefaultDelivery:
          typeof saved.useAsDefaultDelivery === "boolean"
            ? saved.useAsDefaultDelivery
            : prev.useAsDefaultDelivery,

        address:
          saved.address ||
          [saved.addressLine1, saved.addressLine2, saved.city, saved.postalCode]
            .filter(Boolean)
            .join(", ") ||
          prev.address,

        emergencyContact: saved.emergencyContact || prev.emergencyContact,
      }));

      setEditing(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function patchSharingPreference(next: Partial<SharingPreference>) {
    const patientId = profile?.patientId || profile?.id;
    if (!patientId) return;

    const merged = {
      patientId,
      allowClinicianAccess: sharingPreference?.allowClinicianAccess ?? true,
      allowMedicalAidAdherenceAccess:
        sharingPreference?.allowMedicalAidAdherenceAccess ?? false,
      allowCorporateSponsorAdherenceAccess:
        sharingPreference?.allowCorporateSponsorAdherenceAccess ?? false,
      allowRewardProgramAccess:
        sharingPreference?.allowRewardProgramAccess ?? false,
      allowEvidenceImages: sharingPreference?.allowEvidenceImages ?? false,
      ...next,
    };

    setSharingBusy(true);
    try {
      const res = await fetch("/api/profile/sharing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        alert("Could not save sharing preferences");
        return;
      }

      setSharingPreference(data.sharingPreference);
    } catch (err) {
      console.error("Failed to save sharing preference", err);
      alert("Could not save sharing preferences");
    } finally {
      setSharingBusy(false);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync-devices", { method: "POST" });
      if (res.ok) {
        const payload = await res.json();

        setDevices((prev) => {
          const next = normalizeDeviceCatalogPayload(payload);
          return next.length > 0 ? next : prev;
        });

        setVitalsSummary(
          normalizeVitalsSummaryPayload(payload.vitalsSummary) || vitalsSummary,
        );
      }
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setSyncing(false);
    }
  }

  async function toggleFavourite(clinicianId: string) {
    try {
      const isFav = favs.includes(clinicianId);
      if (isFav) {
        await fetch(`/api/favourites?id=${clinicianId}`, { method: "DELETE" });
        setFavs((prev) => prev.filter((x) => x !== clinicianId));
      } else {
        await fetch("/api/favourites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: clinicianId }),
        });
        setFavs((prev) => [...prev, clinicianId]);
      }
    } catch (err) {
      console.error("fav toggle failed", err);
    }
  }

  const patientIdForMedicalAid = profile?.patientId || profile?.id || "";
  const profilePhotoUrl = profile?.photoUrl || profile?.avatarUrl;

  const orderedDevices = useMemo(() => {
    const rank: Record<DeviceCatalogItem["kind"], number> = {
      vitals: 0,
      ring: 1,
      stethoscope: 2,
      otoscope: 3,
    };

    return [...devices].sort((a, b) => rank[a.kind] - rank[b.kind]);
  }, [devices]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_42%,_#f8faff_100%)] px-4 pb-12 pt-4 md:px-6 md:pb-14 md:pt-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute left-[-12%] top-[-8%] h-[420px] w-[420px] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute right-[-8%] top-[10%] h-[360px] w-[360px] rounded-full bg-fuchsia-300/15 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[18%] h-[300px] w-[300px] rounded-full bg-indigo-300/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-5 md:gap-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className={cn(SURFACE, "p-5 md:p-8 xl:p-10")}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.42),rgba(255,255,255,0.10))]" />
          <div className="relative z-10 grid gap-8 xl:grid-cols-[1.12fr_0.88fr] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/78 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                <Sparkles className="h-4 w-4 text-cyan-600" />
                Ambulant+ Identity & Wellness
              </div>

              <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="relative text-left"
                  title="Edit profile photo"
                >
                  <motion.div
                    animate={syncing ? { rotate: 360 } : { rotate: 0 }}
                    transition={{
                      repeat: syncing ? Infinity : 0,
                      duration: 8,
                      ease: "linear",
                    }}
                    className="rounded-full bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 p-[3px] shadow-[0_12px_40px_rgba(59,130,246,0.28)]"
                  >
                    {typeof profilePhotoUrl === "string" &&
                    profilePhotoUrl.trim() ? (
                      <img
                        src={profilePhotoUrl}
                        alt={`${profile?.name || "Patient"} profile`}
                        className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-md sm:h-32 sm:w-32"
                      />
                    ) : (
                      <div className="grid h-28 w-28 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-slate-900 via-indigo-700 to-cyan-600 text-3xl font-semibold text-white shadow-md sm:h-32 sm:w-32">
                        {initialsFromName(profile?.name || form.name)}
                      </div>
                    )}
                  </motion.div>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur">
                    ID {profile?.patientId || "Not assigned"}
                  </span>
                </button>

                <div className="flex-1">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    {profile?.name || form.name || "Your profile"}
                  </h1>
                  <div className="mt-2 text-sm text-slate-500">
                    {profile?.age ? `${profile.age} yrs` : "Patient profile"}{" "}
                    {profile?.gender ? `• ${profile.gender}` : ""}
                  </div>
                  <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600 md:text-lg">
                    {healthNarrative}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/65 bg-white/82 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <Waves className="h-4 w-4 text-cyan-600" />
                        Latest sync
                      </div>
                      <div className="mt-3 text-xl font-semibold text-slate-900">
                        {enhancedVitalsSummary.lastSyncHuman}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/65 bg-white/82 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <Shield className="h-4 w-4 text-indigo-600" />
                        Profile completeness
                      </div>
                      <div className="mt-3 text-xl font-semibold text-slate-900">
                        {completeness}%
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/65 bg-white/82 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <Cpu className="h-4 w-4 text-fuchsia-600" />
                        Health state
                      </div>
                      <div className="mt-3 text-xl font-semibold text-slate-900">
                        {enhancedVitalsSummary.overallStatus}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit profile
                </button>
                <button
                  onClick={triggerSync}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <Activity className="h-4 w-4" />
                  {syncing ? "Syncing..." : "Sync devices"}
                </button>
                <button
                  onClick={() => {
                    if (typeof navigator.share === "function") {
                      void navigator.share({
                        title: "Ambulant+ Profile",
                        text: "Sharing my Ambulant+ profile",
                        url: window.location.href,
                      });
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/85 px-5 py-3 text-sm font-medium text-cyan-700 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <ArrowRight className="h-4 w-4" />
                  Share record
                </button>
                <Link
                  href="/join-scheme"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/85 px-5 py-3 text-sm font-medium text-emerald-700 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <Shield className="h-4 w-4" />
                  Join a Scheme
                </Link>
              </div>
            </div>

            <div className="relative flex items-center justify-center xl:justify-end">
              <div className="relative w-full max-w-[430px] rounded-[38px] border border-white/65 bg-white/58 p-5 shadow-[0_28px_90px_rgba(59,130,246,0.12)] backdrop-blur-2xl sm:p-6">
                <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
                  <span>Adaptive profile radar</span>
                  <span>{getHealthLabel(healthScore)}</span>
                </div>
                <div className="flex justify-center">
                  <OrbitalScore score={healthScore} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/70 bg-white/78 p-3 text-center">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      SpO₂
                    </div>
                    <div className="mt-2 text-xl font-semibold text-slate-900">
                      {displayMetric(vitalsSummary?.spo2, "%")}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/78 p-3 text-center">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Pulse
                    </div>
                    <div className="mt-2 text-xl font-semibold text-slate-900">
                      {displayMetric(vitalsSummary?.hr)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/78 p-3 text-center">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      BP
                    </div>
                    <div className="mt-2 text-xl font-semibold text-slate-900">
                      {displayBloodPressure(vitalsSummary?.bp)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={cn(SURFACE, "p-5 md:p-6")}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Health passport
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Identity, allergies, emergency readiness
                </h2>
              </div>
              <Link
                href="/careport"
                className="text-sm font-medium text-indigo-600"
              >
                Open CarePort
              </Link>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-white/72 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                      <UserRound className="h-3.5 w-3.5" />
                      Patient passport
                    </div>
                    <div className="mt-4 text-2xl font-semibold text-slate-900">
                      {profile?.name || form.name || "Your profile"}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      Blood: {profile?.bloodType || form.bloodType || "Not provided"} • Allergies:{" "}
                      {Array.isArray(profile?.allergies) &&
                      profile.allergies.length > 0
                        ? profile.allergies.join(", ")
                        : "None recorded"}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      Emergency:{" "}
                      {profile?.emergencyContact?.name ||
                        form.emergencyContact?.name ||
                        "Not provided"}{" "}
                      (
                      {profile?.emergencyContact?.phone ||
                        form.emergencyContact?.phone ||
                        "Not provided"}
                      )
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      Address: {form.address || "Not provided"}
                    </div>
                  </div>
                  <div className="grid h-24 w-24 place-items-center rounded-3xl border border-dashed border-slate-200 bg-white text-xs text-slate-400">
                    Profile QR
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/allergies"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Manage allergies
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="rounded-[28px] border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-cyan-50/70 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Body metrics
                </div>
                <div className="mt-3 text-4xl font-semibold text-slate-900">
                  {bmi ? bmi.toFixed(1) : "—"}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  BMI • Height{" "}
                  {typeof form.heightCm === "number"
                    ? `${form.heightCm} cm`
                    : "—"}{" "}
                  • Weight{" "}
                  {typeof form.weightKg === "number"
                    ? `${form.weightKg} kg`
                    : "—"}
                </div>
                <div className="mt-5 rounded-2xl border border-white/70 bg-white/78 p-4">
                  <div className="text-sm font-medium text-slate-500">
                    Guidance
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    Keeping your profile metrics up to date strengthens your
                    health snapshot and improves downstream recommendations.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={cn(SURFACE, "p-5 md:p-6")}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Health snapshot
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Stronger score framing and quick insight
                </h2>
              </div>
              <div className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500">
                Live overview
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-[26px] border border-white/72 bg-white/82 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Activity className="h-4 w-4 text-cyan-600" />
                  Heart Rate
                </div>
                <div className="mt-4 text-3xl font-semibold text-slate-900">
                  {displayMetric(enhancedVitalsSummary?.hr)}
                  <span className="ml-1 text-sm font-medium text-slate-400">
                    bpm
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {hasVitals(enhancedVitalsSummary)
                    ? "Latest synced pulse reading from your connected vitals profile."
                    : "No heart-rate reading has been synced yet."}
                </p>
              </div>
              <div className="rounded-[26px] border border-white/72 bg-white/82 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Care Readiness
                </div>
                <div className="mt-4 text-3xl font-semibold text-slate-900">
                  {healthScore}
                  <span className="ml-1 text-sm font-medium text-slate-400">
                    /100
                  </span>
                </div>
                <div className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  {getHealthLabel(healthScore)}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {enhancedVitalsSummary.overallStatus ||
                    "Calculated from your profile completeness and latest synced vitals."}
                </p>
              </div>
              <div className="rounded-[26px] border border-white/72 bg-white/82 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Bell className="h-4 w-4 text-indigo-600" />
                  Health pulse note
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {healthNarrative}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="text-slate-500">Status</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {getHealthLabel(healthScore)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="text-slate-500">Sync</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {enhancedVitalsSummary.lastSyncHuman}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={cn(SURFACE, "p-5 md:p-6")}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Connected devices
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                Supported Ambulant+ devices
              </h2>
            </div>
            <Link
              href="/myCare/devices"
              className="text-sm font-medium text-indigo-600"
            >
              Manage devices
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {orderedDevices.length === 0 && (
              <div className="col-span-full rounded-[24px] border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-500">
                No devices connected.
              </div>
            )}

            {orderedDevices.map((d) => {
              const capabilities = Array.isArray(d.capabilities)
                ? d.capabilities
                : [];

              return (
                <motion.div
                  key={d.id || d.name}
                  whileHover={{ y: -4 }}
                  className="rounded-[28px] border border-white/72 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                        {d.category === "wearable" ? (
                          <Smartphone className="h-3.5 w-3.5" />
                        ) : (
                          <Cpu className="h-3.5 w-3.5" />
                        )}
                        {d.category}
                      </div>
                      <div className="mt-4 text-lg font-semibold text-slate-900">
                        {d.name}
                      </div>
                      <div className="text-sm text-slate-500">
                        {d.vendor} • {d.model}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      {d.connected ? "Active" : d.status}
                    </div>
                  </div>

                  <p className="mt-4 min-h-[48px] text-sm leading-6 text-slate-600">
                    {d.summary}
                  </p>

                  <div className="mt-4 rounded-2xl border border-white/70 bg-white/78 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Telemetry preview</span>
                      <span>
                        {typeof d.battery === "number"
                          ? `${d.battery}% battery`
                          : d.lastSeenHuman || "No live telemetry preview"}
                      </span>
                    </div>
                    <div className="mt-2 h-[64px]">
                      {Array.isArray(d.recent) && d.recent.length > 0 ? (
                        <Sparkline
                          data={d.recent.map((x, index) => ({
                            t: index,
                            y: x.value,
                          }))}
                          height={64}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400">
                          No recent telemetry available
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {capabilities.slice(0, 3).map((cap) => (
                      <span
                        key={cap}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4">
                    <Link
                      href={d.href}
                      className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600"
                    >
                      Open device
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className={cn(SURFACE, "p-5 md:p-6")}>
            <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Safety & allergies
            </div>
            <AllergiesPanel
              allergies={profile?.allergiesList || []}
              onRefresh={async () => {
                try {
                  const res = await fetch("/api/allergies");
                  const data = await res.json().catch(() => null);

                  setProfile((prev: any) => ({
                    ...(prev || {}),
                    allergiesList: Array.isArray(data?.items)
                      ? data.items
                      : Array.isArray(data?.allergies)
                        ? data.allergies
                        : [],
                  }));
                } catch (err) {
                  console.error("Allergies refresh failed", err);
                }
              }}
              onExport={() => {
                alert("Exporting allergies (implement server export).");
              }}
            />
          </div>

          <div className={cn(SURFACE, "p-5 md:p-6")}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Care team
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Your linked clinicians and collaborators
                </h2>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {careTeam.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-500">
                  No clinicians linked.
                </div>
              )}
              {careTeam.map((c: any) => (
                <CareTeamCard
                  key={c.id}
                  clinician={c}
                  isFav={favs.includes(c.id)}
                  onToggleFav={() => toggleFavourite(c.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className={cn(SURFACE, "p-5 md:p-6")}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Medication adherence intelligence
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Interpretable adherence for payers and care teams
                </h2>
              </div>
              <div className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500">
                Last 30 days
              </div>
            </div>

            {!adherenceSummary?.summary ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-500">
                No adherence summary available yet.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                    <div className="text-xs text-slate-500">
                      Weighted adherence
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {adherenceHeadline.weightedPct}%
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                    <div className="text-xs text-slate-500">Confidence</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {adherenceHeadline.confidencePct}%
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                    <div className="text-xs text-slate-500">Verified ratio</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {adherenceHeadline.verifiedRatio}%
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                    <div className="text-xs text-slate-500">
                      Reminder coverage
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {adherenceHeadline.reminderCoveragePct}%
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        30-day trend
                      </div>
                      <div className="text-xs text-slate-500">
                        Weighted adherence by day
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 h-[72px]">
                    <Sparkline
                      data={(adherenceSummary.dailyTrend || []).map(
                        (x, index) => ({
                          t: index,
                          y: x.weightedPct,
                        }),
                      )}
                      height={72}
                    />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Highest intervention need
                    </div>
                    <div className="mt-3 space-y-2">
                      {(
                        adherenceSummary.interventions?.highRiskMedications ||
                        []
                      )
                        .slice(0, 5)
                        .map((m: any) => (
                          <div
                            key={m.medicationId}
                            className="rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2"
                          >
                            <div className="text-sm font-medium text-slate-900">
                              {m.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {m.missed} missed · {m.pending} pending ·{" "}
                              {m.weightedPct}% adherence
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Reward readiness
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                        <div className="text-xs text-slate-500">
                          Verified days
                        </div>
                        <div className="mt-1 text-xl font-semibold text-slate-900">
                          {adherenceSummary.rewardSignals?.verifiedDays ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                        <div className="text-xs text-slate-500">
                          Reward points estimate
                        </div>
                        <div className="mt-1 text-xl font-semibold text-slate-900">
                          {adherenceSummary.rewardSignals
                            ?.rewardPointsEstimate ?? 0}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border px-3 py-2 text-sm font-medium">
                      {adherenceSummary.rewardSignals?.rewardEligible ?? false
                        ? "Reward eligible"
                        : "Not yet reward eligible"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={cn(SURFACE, "p-5 md:p-6")}>
            <MedicalAidManager patientId={patientIdForMedicalAid} />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className={cn(SURFACE, "p-5 md:p-6")}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Data & Privacy
                </div>
                <div className="text-sm text-slate-500">
                  Manage who can access your health data
                </div>
              </div>
              <div className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500">
                Secure controls
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/78 px-4 py-3">
                <span className="text-sm text-slate-700">
                  Clinician access
                </span>
                <input
                  type="checkbox"
                  checked={sharingPreference?.allowClinicianAccess ?? true}
                  disabled={sharingBusy}
                  onChange={(e) =>
                    patchSharingPreference({
                      allowClinicianAccess: e.target.checked,
                    })
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/78 px-4 py-3">
                <span className="text-sm text-slate-700">
                  Medical Aid adherence sharing
                </span>
                <input
                  type="checkbox"
                  checked={
                    sharingPreference?.allowMedicalAidAdherenceAccess ?? false
                  }
                  disabled={sharingBusy}
                  onChange={(e) =>
                    patchSharingPreference({
                      allowMedicalAidAdherenceAccess: e.target.checked,
                    })
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/78 px-4 py-3">
                <span className="text-sm text-slate-700">
                  Corporate sponsor adherence sharing
                </span>
                <input
                  type="checkbox"
                  checked={
                    sharingPreference?.allowCorporateSponsorAdherenceAccess ??
                    false
                  }
                  disabled={sharingBusy}
                  onChange={(e) =>
                    patchSharingPreference({
                      allowCorporateSponsorAdherenceAccess: e.target.checked,
                    })
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/78 px-4 py-3">
                <span className="text-sm text-slate-700">
                  Reward program access
                </span>
                <input
                  type="checkbox"
                  checked={sharingPreference?.allowRewardProgramAccess ?? false}
                  disabled={sharingBusy}
                  onChange={(e) =>
                    patchSharingPreference({
                      allowRewardProgramAccess: e.target.checked,
                    })
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/78 px-4 py-3">
                <span className="text-sm text-slate-700">
                  Allow evidence images
                </span>
                <input
                  type="checkbox"
                  checked={sharingPreference?.allowEvidenceImages ?? false}
                  disabled={sharingBusy}
                  onChange={(e) =>
                    patchSharingPreference({
                      allowEvidenceImages: e.target.checked,
                    })
                  }
                />
              </label>
            </div>
          </div>

          <div className={cn(SURFACE, "p-5 md:p-6")}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Privacy snapshot
                </div>
                <div className="text-sm text-slate-500">
                  Review your connected-care permissions at a glance
                </div>
              </div>
              <div className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500">
                Patient controls
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-white/70 bg-white/78 p-4 text-sm text-slate-600">
              Your data sharing controls remain available here while the
              medical aid area stays focused on payer-linked workflow.
            </div>
          </div>
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-5xl rounded-[32px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
          >
            <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
              Edit Profile
            </h3>

            <div className="mt-5 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 gap-5">
                <section className="rounded-3xl border border-slate-200 bg-white/80 p-4">
                  <div className="text-sm font-semibold text-slate-900">Photo & identity</div>
                  <div className="mt-4 grid gap-4 md:grid-cols-[120px_1fr]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                        {form.photoUrl ? (
                          <img src={form.photoUrl} alt="Profile preview" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xl font-semibold text-slate-500">
                            {initialsFromName(form.name)}
                          </span>
                        )}
                      </div>
                      <div className="text-center text-[11px] text-slate-500">
                        Paste a secure image URL for now. File upload can be connected to document storage next.
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <label className="text-sm text-slate-500">
                        Photo URL
                        <input
                          value={form.photoUrl}
                          onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                          placeholder="https://..."
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                        />
                      </label>

                      <div className="rounded-3xl border border-emerald-100 bg-emerald-50/55 p-4">
                        <div className="flex items-start gap-3">
                          <Shield className="mt-0.5 h-5 w-5 text-emerald-700" />
                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              Verified identity fields
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              MRN, name, email, date of birth, gender, and ID/passport
                              details are locked on the patient profile to protect
                              clinical eligibility, gender-gated modules, and account integrity.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <LockedProfileField label="MRN" value={form.mrn} />
                          <LockedProfileField label="Full name" value={form.name} />
                          <LockedProfileField
                            label="Email"
                            value={form.contactEmail}
                          />
                          <LockedProfileField
                            label="ID / Passport number"
                            value={form.idNumber}
                          />
                          <LockedProfileField
                            label="Date of birth"
                            value={form.dob}
                          />
                          <LockedProfileField label="Gender" value={form.gender} />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white/80 p-4">
                  <div className="text-sm font-semibold text-slate-900">Contact</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <label className="text-sm text-slate-500">
                      Email
                      <input
                        type="email"
                        value={form.contactEmail}
                        onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <label className="text-sm text-slate-500">
                      Mobile
                      <input
                        value={form.phone || form.mobile}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value, mobile: e.target.value })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <label className="text-sm text-slate-500">
                      Preferred contact
                      <select
                        value={form.primaryComm}
                        onChange={(e) => setForm({ ...form, primaryComm: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      >
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone call</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white/80 p-4">
                  <div className="text-sm font-semibold text-slate-900">Delivery address</div>
                  <div className="mt-4 grid gap-3">
                    <label className="text-sm text-slate-500">
                      Address line 1
                      <input
                        value={form.addressLine1}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            addressLine1: e.target.value,
                            address: [e.target.value, form.addressLine2, form.city, form.postalCode]
                              .filter(Boolean)
                              .join(", "),
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <label className="text-sm text-slate-500">
                      Address line 2
                      <input
                        value={form.addressLine2}
                        onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm text-slate-500">
                        City
                        <input
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                        />
                      </label>

                      <label className="text-sm text-slate-500">
                        Postal code
                        <input
                          value={form.postalCode}
                          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                        />
                      </label>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={form.useAsDefaultDelivery}
                        onChange={(e) =>
                          setForm({ ...form, useAsDefaultDelivery: e.target.checked })
                        }
                      />
                      Use this as my default delivery address
                    </label>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white/80 p-4">
                  <div className="text-sm font-semibold text-slate-900">Clinical basics</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <label className="text-sm text-slate-500">
                      Height (cm)
                      <input
                        type="number"
                        value={form.heightCm}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            heightCm: e.target.value ? Number(e.target.value) : "",
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <label className="text-sm text-slate-500">
                      Weight (kg)
                      <input
                        type="number"
                        value={form.weightKg}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            weightKg: e.target.value ? Number(e.target.value) : "",
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <label className="text-sm text-slate-500">
                      Blood group
                      <select
                        value={form.bloodType}
                        onChange={(e) => setForm({ ...form, bloodType: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      >
                        <option value="">Unknown</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white/80 p-4">
                  <div className="text-sm font-semibold text-slate-900">Emergency contact</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-slate-500">
                      Name
                      <input
                        value={form.emergencyContact?.name || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            emergencyContact: {
                              ...form.emergencyContact,
                              name: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <label className="text-sm text-slate-500">
                      Phone
                      <input
                        value={form.emergencyContact?.phone || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            emergencyContact: {
                              ...form.emergencyContact,
                              phone: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <label className="text-sm text-slate-500">
                      Relationship
                      <input
                        value={form.emergencyContact?.relationship || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            emergencyContact: {
                              ...form.emergencyContact,
                              relationship: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <label className="text-sm text-slate-500">
                      Email
                      <input
                        type="email"
                        value={form.emergencyContact?.email || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            emergencyContact: {
                              ...form.emergencyContact,
                              email: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </label>
                  </div>
                </section>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditing(false)}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}