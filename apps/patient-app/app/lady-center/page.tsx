// apps/patient-app/app/lady-center/page.tsx
"use client";

import Link from "next/link";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { Baby, Calendar, FileText } from "lucide-react";

import { generateHealthReport } from "@/src/analytics/report";
import {
  predictCycleDates,
  type FertilityPrefs,
  type WearablePoint,
  detectPregnancy,
} from "@/src/analytics/prediction";
import { buildFertilityICSUrlFromPrefs } from "@/src/analytics/ics";
import { track } from "@/src/lib/analytics";

// Extracted components
import TodaySummaryCard from "@/components/lady-center/TodaySummaryCard";
import InsightFeed from "@/components/lady-center/InsightFeed";
import ScreeningChecklist from "@/components/lady-center/ScreeningChecklist";
import DocumentsFolder from "@/components/lady-center/DocumentsFolder";
import CarePathFlow from "@/components/lady-center/CarePathFlow";
import LadyCenterHeader from "@/components/lady-center/LadyCenterHeader";
import LadyCenterQuickActions from "@/components/lady-center/LadyCenterQuickActions";
import LadyCenterTimelinePanel from "@/components/lady-center/LadyCenterTimelinePanel";
import LadyCenterCalendarPanel from "@/components/lady-center/LadyCenterCalendarPanel";
import LadyCenterReportPanel from "@/components/lady-center/LadyCenterReportPanel";
import LadyCenterNotesPanel from "@/components/lady-center/LadyCenterNotesPanel";
import LadyCenterSettingsModal from "@/components/lady-center/LadyCenterSettingsModal";
import LadyCenterSetupModal from "@/components/lady-center/LadyCenterSetupModal";
import LadyCenterDayLogSheet from "@/components/lady-center/LadyCenterDayLogSheet";
import LadyCenterSubscribeToast from "@/components/lady-center/LadyCenterSubscribeToast";

import {
  analyzeLadyCenterWithInsightCore,
  type InsightCoreInsight,
} from "@/src/lib/insightcore/api";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

/* =========================================================
   Types
========================================================= */

type LadyMode = "cycle" | "symptoms" | "pregnancy" | "menopause";
type BannerKind = "info" | "success" | "error";
type DocTag = "Gynae" | "Labs" | "Imaging" | "Rx" | "Notes";

type LadyProfile = {
  mode: LadyMode;
  trackCycle: boolean;
  trackSymptoms: boolean;
  trackVitals: boolean;
  remindScreening: boolean;
  createdAtISO: string;

  sexAtBirth?: "female" | "male" | "intersex" | "unknown";
  contraceptiveMethod?: string;
  tryingToConceive?: boolean;
  knownConditions?: string[];
};

type ScreeningItem = {
  key: string;
  title: string;
  desc: string;
  cadence: string;
  lastDoneISO?: string | null;
  nextDueISO?: string | null;
  status: "due" | "ok" | "overdue" | "unknown";
};

type LadyDoc = {
  id: string;
  title: string;
  tag: DocTag;
  createdISO: string;
  fileName?: string;
};

type SymptomChoice =
  | "cramps"
  | "headache"
  | "fatigue"
  | "mood"
  | "acne"
  | "bloating"
  | "nausea"
  | "tenderness"
  | "migraine"
  | "hot_flashes"
  | "sleep";

type CyclePhase = "follicular" | "luteal" | "ovulation" | "period";

type CycleDay = {
  date: string;
  phase: CyclePhase;
  fertileWindow?: boolean;
  deltaTemp: number;
  rhr?: number;
  hrv?: number;
  respRate?: number;
  spo2?: number;
  sleepScore?: number;
  predicted?: boolean;
};

type DayLog = {
  date: string;
  period?: boolean;
  ovulation?: boolean;
  pregnancyTestPositive?: boolean;
  meds?: string;
  notes?: string;
  symptoms?: SymptomChoice[];

  sexualEncounter?: boolean;
  protectedSex?: boolean | null;
  withdrawalUsed?: boolean | null;
  emergencyContraception?: boolean;
  tryingToConceive?: boolean | null;
  contraceptionMethod?: string;
  contraceptionAdherence?: string;
  cycleModifiers?: string[];

  flowIntensity?: number | null;
  painScore?: number | null;
  cervicalMucus?: string;

  overnightHrPromptedAt?: string | null;
  overnightHrPromptStatus?: string | null;
};

type LadyServerState = {
  profile: LadyProfile | null;
  docs: LadyDoc[];
  notes: { id: string; text: string; createdISO: string }[];
  screening: Record<string, { lastDoneISO?: string | null }>;
  dayLogs: Record<string, DayLog>;
  updatedAtISO?: string | null;
};

type TimelineApiItem = {
  date: string;
  log: {
    period?: boolean;
    ovulation?: boolean;
    pregnancyTestPositive?: boolean;
    meds?: string;
    notes?: string;
    symptoms?: string[];

    sexualEncounter?: boolean;
    protectedSex?: boolean | null;
    withdrawalUsed?: boolean | null;
    emergencyContraception?: boolean;
    tryingToConceive?: boolean | null;
    contraceptionMethod?: string;
    contraceptionAdherence?: string;
    cycleModifiers?: string[];

    flowIntensity?: number | null;
    painScore?: number | null;
    cervicalMucus?: string;

    overnightHrPromptedAt?: string | null;
    overnightHrPromptStatus?: string | null;
  } | null;
  fertility: {
    deltaTemp?: number;
    tempC?: number;
    hrv?: number;
    rhr?: number;
    spo2?: number;
    phase?: string;
    confidence?: number;
  } | null;
};

type ViewerProfile = {
  userId?: string | null;
  patientId?: string | null;
  gender?: string | null;
  age?: number | null;
  chronicConditions?: string[] | null;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string; code?: string };
};

type ExtendedCyclePrediction = ReturnType<typeof predictCycleDates> & {
  nextPeriodEnd?: string | null;
  fertileWindowConfidence?: number | null;
  irregular?: boolean | null;
};

function asExtendedPrediction(
  prediction: ReturnType<typeof predictCycleDates> | null,
): ExtendedCyclePrediction | null {
  return prediction as ExtendedCyclePrediction | null;
}

function predictionNextPeriodEnd(
  prediction: ReturnType<typeof predictCycleDates> | null,
) {
  return asExtendedPrediction(prediction)?.nextPeriodEnd ?? prediction?.nextPeriodStart ?? null;
}

function predictionFertileWindowConfidence(
  prediction: ReturnType<typeof predictCycleDates> | null,
) {
  return asExtendedPrediction(prediction)?.fertileWindowConfidence ?? null;
}

function predictionIrregular(
  prediction: ReturnType<typeof predictCycleDates> | null,
) {
  return asExtendedPrediction(prediction)?.irregular ?? null;
}

/* =========================================================
   Storage keys
========================================================= */

const LS = {
  discreet: "ambulant.lady.discreet",
  profile: "ambulant.lady.profile.v2",
  docs: "ambulant.lady.docs.v2",
  screening: "ambulant.lady.screening.v2",
  notes: "ambulant.lady.notes.v2",
  daylogs: "ambulant.lady.daylogs.v2",
  windowDays: "ladyCenter:windowDays",
  series: "ladyCenter:series",
  pregDismiss: "ladyCenter:pregnancy:dismissedAt",
  legacyDaylogs: "fertilityDayLogs",
};

/* =========================================================
   API endpoints
========================================================= */

const LADY_API = {
  state: "/api/lady-center/state",
  profile: "/api/lady-center/profile",
  dayLogsUpsert: "/api/lady-center/daylogs",
  notes: "/api/lady-center/notes",
  documents: "/api/lady-center/documents",
  screening: "/api/lady-center/screening",
  timeline: "/api/lady-center/timeline",
  reminders: "/api/reminders",
  reportPdf: "/api/reports/lady-center",
};

/* =========================================================
   Utils
========================================================= */

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function nowISO() {
  return new Date().toISOString();
}

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(baseISO);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function uid(prefix = "id") {
  const token =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(16)}_${performance.now().toString(16).replace(".", "")}`;

  return `${prefix}_${token}`;
}

function formatNiceDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatNiceTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function modeLabel(mode: LadyMode) {
  switch (mode) {
    case "cycle":
      return "Cycle Tracking";
    case "symptoms":
      return "Symptoms Only";
    case "pregnancy":
      return "Pregnancy";
    case "menopause":
      return "Peri/Menopause";
  }
}

function loadPrefsClient(): FertilityPrefs | null {
  try {
    const raw = localStorage.getItem("fertilityPrefs");
    return raw ? (JSON.parse(raw) as FertilityPrefs) : null;
  } catch {
    return null;
  }
}

function guessTag(fileName: string): DocTag {
  const f = fileName.toLowerCase();
  if (
    f.includes("ultra") ||
    f.includes("scan") ||
    f.includes("xray") ||
    f.includes("mri")
  )
    return "Imaging";
  if (f.includes("rx") || f.includes("prescrip") || f.includes("med"))
    return "Rx";
  if (
    f.includes("lab") ||
    f.includes("cbc") ||
    f.includes("hpv") ||
    f.includes("horm") ||
    f.includes("iron")
  )
    return "Labs";
  if (f.includes("note")) return "Notes";
  return "Gynae";
}

function defaultProfile(mode: LadyMode = "cycle"): LadyProfile {
  return {
    mode,
    trackCycle: mode === "cycle",
    trackSymptoms: true,
    trackVitals: true,
    remindScreening: true,
    createdAtISO: nowISO(),

    sexAtBirth: "unknown",
    contraceptiveMethod: "",
    tryingToConceive: false,
    knownConditions: [],
  };
}

/* =========================================================
   API helpers
========================================================= */

function unwrapEnvelope<T>(x: any): T {
  if (x && typeof x === "object" && "ok" in x) {
    const env = x as ApiEnvelope<T>;
    if (env.ok) return (env.data ?? (null as any)) as T;
    throw new Error(env.error?.message || "Request failed");
  }
  return x as T;
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 15000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: init?.signal ?? ctrl.signal,
      headers: {
        ...(init?.headers ?? {}),
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });

    const text = await res.text();
    const data = text ? safeJsonParse<any>(text) : null;

    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        res.statusText ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return unwrapEnvelope<T>(data ?? ({} as any));
  } finally {
    clearTimeout(t);
  }
}

async function fetchBlob(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Blob> {
  const timeoutMs = init?.timeoutMs ?? 25000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: init?.signal ?? ctrl.signal,
      headers: { ...(init?.headers ?? {}), Accept: "application/pdf" },
    });
    if (!res.ok) throw new Error(res.statusText || `HTTP ${res.status}`);
    return await res.blob();
  } finally {
    clearTimeout(t);
  }
}

async function apiTry<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Request failed" };
  }
}

/* =========================================================
   UI primitives
========================================================= */

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "blue" | "emerald" | "amber" | "rose" | "violet";
}) {
  const toneCls =
    tone === "blue"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
        : tone === "amber"
          ? "bg-amber-50 text-amber-800 ring-amber-200"
          : tone === "rose"
            ? "bg-rose-50 text-rose-700 ring-rose-200"
            : tone === "violet"
              ? "bg-violet-50 text-violet-700 ring-violet-200"
              : "bg-slate-50 text-slate-700 ring-slate-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1",
        toneCls,
      )}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/70 bg-white/70 shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_45px_rgba(2,6,23,0.07)] backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 text-xs text-slate-600">{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      ref.current?.querySelector<HTMLElement>('[data-autofocus="1"]')?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-950/40"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={ref}
          className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
        >
          <div className="border-b px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-slate-900">
                  {title}
                </div>
                {subtitle ? (
                  <div className="mt-0.5 text-sm text-slate-600">
                    {subtitle}
                  </div>
                ) : null}
              </div>
              <button
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={onClose}
                aria-label="Close"
              >
                Close
              </button>
            </div>
          </div>
          <div className="max-h-[75vh] overflow-auto px-5 py-4">{children}</div>
          {footer ? <div className="border-t px-5 py-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Page
========================================================= */

const SYMPTOM_CHOICES: SymptomChoice[] = [
  "cramps",
  "headache",
  "fatigue",
  "mood",
  "acne",
  "bloating",
  "nausea",
  "tenderness",
  "migraine",
  "hot_flashes",
  "sleep",
];

function LadyCenterPageContent() {
  const searchParams = useSearchParams();

  const qs = useMemo(
    () => new URLSearchParams(searchParams?.toString() ?? ''),
    [searchParams],
  );

  const patientId = qs.get("patientId") || "";

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [banner, setBanner] = useState<{
    kind: BannerKind;
    text: string;
  } | null>(null);

  const [discreet, setDiscreet] = useState(false);
  const [revealUntil, setRevealUntil] = useState<number>(0);

  const [profile, setProfile] = useState<LadyProfile | null>(null);
  const [docs, setDocs] = useState<LadyDoc[]>([]);
  const [notes, setNotes] = useState<
    { id: string; text: string; createdISO: string }[]
  >([]);
  const [screening, setScreening] = useState<
    Record<string, { lastDoneISO?: string | null }>
  >({});
  const [dayLogs, setDayLogs] = useState<Record<string, DayLog>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [timelineItems, setTimelineItems] = useState<TimelineApiItem[]>([]);
  const [pendingQuickSymptoms, setPendingQuickSymptoms] = useState<
    SymptomChoice[]
  >([]);
  const [viewerProfile, setViewerProfile] = useState<ViewerProfile | null>(
    null,
  );
  const [viewerProfileLoaded, setViewerProfileLoaded] = useState(false);

  const [ladyInsight, setLadyInsight] = useState<null | {
    requestId: string;
    generatedAt: string;
    degradedMode: boolean;
    source: "insightcore";
    todaySummary?: {
      subtitle?: string;
      primary?: { k: string; v: string };
      secondary?: Array<{ k: string; v: string }>;
      badge?: string;
    } | null;
    insights: InsightCoreInsight[];
    prioritizedScreeningKeys: string[];
    screeningNote?: string | null;
    documentSuggestion?: string | null;
    carePathGuidance?: Record<string, string>;
    reportNote?: string | null;
    whenToSeekCare?: {
      urgency: "routine" | "soon" | "urgent";
      message: string;
    } | null;
  }>(null);

  const [ladyInsightBusy, setLadyInsightBusy] = useState(false);
  const [ladyInsightError, setLadyInsightError] = useState<string | null>(null);

  const [openSettings, setOpenSettings] = useState(false);
  const [openSetup, setOpenSetup] = useState(false);
  const [openAddNote, setOpenAddNote] = useState(false);
  const [openCarePath, setOpenCarePath] = useState<null | {
    key: string;
    title: string;
    desc: string;
  }>(null);
  const [carePathAction, setCarePathAction] = useState<null | {
    title: string;
    note: string;
    primaryHref: string;
    primaryLabel: string;
    secondaryHref?: string;
    secondaryLabel?: string;
  }>(null);

  const [showChart, setShowChart] = useState(true);
  const [showCalendar, setShowCalendar] = useState(true);
  const [showReport, setShowReport] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [windowDays, setWindowDays] = useState<14 | 28 | 90>(28);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    deltaTemp: true,
    rhr: true,
    hrv: false,
    respRate: false,
    spo2: false,
    sleepScore: false,
  });

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfObjectUrlRef = useRef<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastCopied, setToastCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const [syncState, setSyncState] = useState<
    "idle" | "syncing" | "ok" | "error"
  >("idle");
  const [syncHint, setSyncHint] = useState<string>("");
  const serverHydratedRef = useRef(false);
  const lastRemoteUpdatedAtRef = useRef<string | null>(null);
  const lastPushAtRef = useRef<number>(0);

  const sensitiveHidden = discreet && Date.now() > revealUntil;
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const prefs: FertilityPrefs | null = useMemo(
    () => (mounted ? loadPrefsClient() : null),
    [mounted],
  );

  function showBanner(kind: BannerKind, text: string) {
    setBanner({ kind, text });
    window.setTimeout(() => setBanner(null), 3200);
  }

  function revealSensitive(seconds = 30) {
    setRevealUntil(Date.now() + seconds * 1000);
    track("lady_discreet_reveal", { seconds });
  }

  const apiUrl = useCallback(
    (path: string) => {
      if (!patientId) return path;
      return `${path}${path.includes("?") ? "&" : "?"}patientId=${encodeURIComponent(patientId)}`;
    },
    [patientId],
  );

  const patchProfile = useCallback((patch: Partial<LadyProfile>) => {
    setProfile((prev) => ({
      ...(prev ?? defaultProfile("cycle")),
      ...patch,
    }));
  }, []);

  // FIX 1: declared before any effect that references it
  const loadTimeline = useCallback(
    async (days: 14 | 28 | 90) => {
      const r = await apiTry(async () => {
        return await fetchJson<{
          patientId: string;
          days: number;
          items: TimelineApiItem[];
          generatedAtISO: string;
        }>(apiUrl(`${LADY_API.timeline}?days=${days}`), {
          method: "GET",
          timeoutMs: 12000,
        });
      });

      if (r.ok) {
        setTimelineItems(Array.isArray(r.data.items) ? r.data.items : []);
        return;
      }

      setTimelineItems([]);
      setSyncHint("Timeline unavailable");
    },
    [apiUrl],
  );

  // Local hydrate only
  useEffect(() => {
    if (!mounted) return;

    try {
      const d = localStorage.getItem(LS.discreet);
      setDiscreet(d === "1");
    } catch {}

    const p = safeJsonParse<LadyProfile>(localStorage.getItem(LS.profile));
    setProfile(p);

    const dd = safeJsonParse<LadyDoc[]>(localStorage.getItem(LS.docs));
    setDocs(dd ?? []);

    const nn = safeJsonParse<
      { id: string; text: string; createdISO: string }[]
    >(localStorage.getItem(LS.notes));
    setNotes(nn ?? []);

    const ss = safeJsonParse<Record<string, { lastDoneISO?: string | null }>>(
      localStorage.getItem(LS.screening),
    );
    setScreening(ss ?? {});

    const dlNew = safeJsonParse<Record<string, DayLog>>(
      localStorage.getItem(LS.daylogs),
    );
    if (dlNew) {
      setDayLogs(dlNew);
    } else {
      const legacy = safeJsonParse<Record<string, DayLog>>(
        localStorage.getItem(LS.legacyDaylogs),
      );
      if (legacy) {
        setDayLogs(legacy);
        try {
          localStorage.setItem(LS.daylogs, JSON.stringify(legacy));
        } catch {}
      }
    }

    try {
      const w = localStorage.getItem(LS.windowDays);
      if (w && ["14", "28", "90"].includes(w))
        setWindowDays(Number(w) as 14 | 28 | 90);
      const s = localStorage.getItem(LS.series);
      if (s)
        setVisibleSeries((prev) => ({
          ...prev,
          ...(safeJsonParse<Record<string, boolean>>(s) ?? {}),
        }));
    } catch {}

    try {
      const ds = localStorage.getItem(LS.pregDismiss);
      if (ds) setDismissedAt(Number(ds));
    } catch {}
  }, [mounted]);

  // FIX 4: always load a stable 90-day timeline; chart window stays visual-only
  useEffect(() => {
    if (!mounted) return;
    void loadTimeline(90);
  }, [mounted, loadTimeline]);

  // Remote hydrate
  useEffect(() => {
    if (!mounted) return;

    const ac = new AbortController();

    const hydrate = async () => {
      setSyncState("syncing");
      setSyncHint("Loading from server…");

      const r = await apiTry(async () => {
        const st = await fetchJson<LadyServerState>(apiUrl(LADY_API.state), {
          method: "GET",
          signal: ac.signal,
          timeoutMs: 12000,
        });
        return st;
      });

      if (!r.ok) {
        setSyncState("error");
        setSyncHint("Offline mode");
        return;
      }

      const remote = r.data;

      const remoteSeemsEmpty =
        !remote ||
        (!remote.profile &&
          (!remote.docs || remote.docs.length === 0) &&
          (!remote.notes || remote.notes.length === 0) &&
          (!remote.dayLogs || Object.keys(remote.dayLogs).length === 0) &&
          (!remote.screening || Object.keys(remote.screening).length === 0));

      if (!remoteSeemsEmpty) {
        setProfile(remote.profile ?? null);
        setDocs(Array.isArray(remote.docs) ? remote.docs : []);
        setNotes(Array.isArray(remote.notes) ? remote.notes : []);
        setScreening(remote.screening ?? {});
        setDayLogs(remote.dayLogs ?? {});

        try {
          localStorage.setItem(
            LS.profile,
            JSON.stringify(remote.profile ?? null),
          );
          localStorage.setItem(LS.docs, JSON.stringify(remote.docs ?? []));
          localStorage.setItem(LS.notes, JSON.stringify(remote.notes ?? []));
          localStorage.setItem(
            LS.screening,
            JSON.stringify(remote.screening ?? {}),
          );
          localStorage.setItem(
            LS.daylogs,
            JSON.stringify(remote.dayLogs ?? {}),
          );
          localStorage.setItem(
            LS.legacyDaylogs,
            JSON.stringify(remote.dayLogs ?? {}),
          );
        } catch {}

        await loadTimeline(90);
      }

      serverHydratedRef.current = true;
      lastRemoteUpdatedAtRef.current = remote.updatedAtISO ?? null;

      setSyncState("ok");
      setSyncHint("Synced");
    };

    hydrate();

    return () => ac.abort();
  }, [mounted, loadTimeline, apiUrl]);

  useEffect(() => {
    if (!mounted) return;

    const ac = new AbortController();

    (async () => {
      const r = await apiTry(async () => {
        return await fetchJson<ViewerProfile>(
          patientId
            ? `/api/profile?patientId=${encodeURIComponent(patientId)}`
            : "/api/profile",
          {
            method: "GET",
            signal: ac.signal,
            timeoutMs: 12000,
          },
        );
      });

      if (r.ok) {
        setViewerProfile(r.data ?? null);
      }

      setViewerProfileLoaded(true);
    })();

    return () => ac.abort();
  }, [mounted, patientId]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.discreet, discreet ? "1" : "0");
    } catch {}
  }, [discreet, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      if (profile) localStorage.setItem(LS.profile, JSON.stringify(profile));
      else localStorage.removeItem(LS.profile);
    } catch {}
  }, [profile, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.docs, JSON.stringify(docs));
    } catch {}
  }, [docs, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.notes, JSON.stringify(notes));
    } catch {}
  }, [notes, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.screening, JSON.stringify(screening));
    } catch {}
  }, [screening, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.daylogs, JSON.stringify(dayLogs));
      localStorage.setItem(LS.legacyDaylogs, JSON.stringify(dayLogs));
    } catch {}
  }, [dayLogs, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS.windowDays, String(windowDays));
      localStorage.setItem(LS.series, JSON.stringify(visibleSeries));
    } catch {}
  }, [windowDays, visibleSeries, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (!serverHydratedRef.current) return;

    const t = setTimeout(async () => {
      const now = Date.now();
      if (now - lastPushAtRef.current < 500) return;

      lastPushAtRef.current = now;
      await apiTry(async () => {
        await fetchJson(apiUrl(LADY_API.profile), {
          method: "PUT",
          body: JSON.stringify({ profile }),
          timeoutMs: 12000,
        });
      });
    }, 550);

    return () => clearTimeout(t);
  }, [profile, mounted, apiUrl]);

  const baseHistory: CycleDay[] = useMemo(() => {
    const base = timelineItems.map((item) => {
      const fert = item.fertility;

      let phase: CyclePhase = "follicular";
      if (fert?.phase === "period") phase = "period";
      else if (fert?.phase === "ovulation") phase = "ovulation";
      else if (fert?.phase === "luteal") phase = "luteal";
      else phase = "follicular";

      return {
        date: item.date,
        phase,
        fertileWindow: false as boolean,
        deltaTemp: typeof fert?.deltaTemp === "number" ? fert.deltaTemp : 0,
        rhr: fert?.rhr,
        hrv: fert?.hrv,
        respRate: undefined,
        spo2: fert?.spo2,
        sleepScore: undefined,
        predicted: false,
      } satisfies CycleDay;
    });

    return base.map((d) => {
      const log = dayLogs[d.date];
      if (log?.period) d.phase = "period";
      if (log?.ovulation) {
        d.phase = "ovulation";
        d.fertileWindow = true;
      }
      return d;
    });
  }, [timelineItems, dayLogs]);

  const wearableSeries: WearablePoint[] = useMemo(() => {
    return baseHistory.map((h) => ({
      date: h.date,
      deltaTemp: h.deltaTemp,
      rhr: h.rhr,
      hrv: h.hrv,
      spo2: h.spo2,
    }));
  }, [baseHistory]);

  const predictionLogs = useMemo(() => {
    const out: Record<string, any> = {};
    for (const [date, log] of Object.entries(dayLogs || {})) {
      out[date] = {
        ...log,
        pregnancyTestPositive: !!log?.pregnancyTestPositive,
        contraceptionMethod:
          log?.contraceptionMethod || profile?.contraceptiveMethod || "",
        tryingToConceive:
          typeof log?.tryingToConceive === "boolean"
            ? log.tryingToConceive
            : !!profile?.tryingToConceive,
      };
    }
    return out;
  }, [dayLogs, profile?.contraceptiveMethod, profile?.tryingToConceive]);

  const effectivePrefs = useMemo(() => {
    if (!prefs) return null;
    return {
      ...prefs,
      contraceptiveMethod: profile?.contraceptiveMethod || "",
      tryingToConceive: !!profile?.tryingToConceive,
      knownConditions: Array.isArray(profile?.knownConditions)
        ? profile.knownConditions
        : [],
    };
  }, [
    prefs,
    profile?.contraceptiveMethod,
    profile?.tryingToConceive,
    profile?.knownConditions,
  ]);

  const prediction = useMemo(() => {
    if (!mounted) return null;
    return predictCycleDates(effectivePrefs, todayISO, {
      useLogs: true,
      highAccuracy: true,
    });
  }, [mounted, effectivePrefs, todayISO]);


  const history: CycleDay[] = useMemo(() => {
    return baseHistory.map((d) => {
      const fertileWindow =
        !!prediction &&
        d.date >= prediction.fertileStart &&
        d.date <= prediction.fertileEnd;
      return {
        ...d,
        fertileWindow: d.fertileWindow || fertileWindow,
        predicted: fertileWindow,
      };
    });
  }, [baseHistory, prediction]);

  const preg = useMemo(
    () =>
      detectPregnancy(effectivePrefs, wearableSeries, predictionLogs, {
        highAccuracy: true,
        useLogs: true,
      }),
    [effectivePrefs, wearableSeries, predictionLogs],
  );

  const showPregnancyBanner = useMemo(() => {
    if (!mounted) return false;
    if (preg.status === "none") return false;
    if (!dismissedAt) return true;
    const daysSince = (Date.now() - dismissedAt) / 86400000;
    return daysSince > 7;
  }, [mounted, preg.status, dismissedAt]);

  const dismissPregnancyBanner = () => {
    const now = Date.now();
    setDismissedAt(now);
    try {
      localStorage.setItem(LS.pregDismiss, String(now));
    } catch {}
    track("pregnancy_dismiss", { status: preg.status });
  };

  const trimmedHistory = useMemo(
    () => history.slice(-windowDays),
    [history, windowDays],
  );

  const chartData = useMemo(() => {
    const labels = trimmedHistory.map((h) => h.date.slice(5));
    const ds: any[] = [];

    if (visibleSeries.deltaTemp)
      ds.push({
        label: "ΔTemp (°C)",
        data: trimmedHistory.map((h) => h.deltaTemp),
        yAxisID: "y",
      });
    if (visibleSeries.rhr)
      ds.push({
        label: "Resting HR (bpm)",
        data: trimmedHistory.map((h) => h.rhr),
        yAxisID: "y1",
      });
    if (visibleSeries.hrv)
      ds.push({
        label: "HRV (ms)",
        data: trimmedHistory.map((h) => h.hrv),
        yAxisID: "y1",
      });
    if (visibleSeries.respRate)
      ds.push({
        label: "Resp Rate",
        data: trimmedHistory.map((h) => h.respRate),
        yAxisID: "y1",
      });
    if (visibleSeries.spo2)
      ds.push({
        label: "SpO₂ (%)",
        data: trimmedHistory.map((h) => h.spo2),
        yAxisID: "y1",
      });
    if (visibleSeries.sleepScore)
      ds.push({
        label: "Sleep Score",
        data: trimmedHistory.map((h) => h.sleepScore),
        yAxisID: "y1",
      });

    return { labels, datasets: ds };
  }, [trimmedHistory, visibleSeries]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false as const,
      plugins: {
        legend: { position: "top" as const },
        tooltip: { intersect: false as const, mode: "index" as const },
      },
      scales: {
        y: {
          type: "linear" as const,
          position: "left" as const,
          title: { display: true, text: "ΔTemp (°C)" },
        },
        y1: {
          type: "linear" as const,
          position: "right" as const,
          grid: { drawOnChartArea: false },
        },
      },
    }),
    [],
  );

  const firstDay = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
    [currentMonth],
  );
  const lastDay = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0),
    [currentMonth],
  );
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendarCells = useMemo(() => {
    const cells: React.ReactNode[] = [];
    for (let pad = 0; pad < startWeekday; pad++)
      cells.push(
        <div key={`pad-${pad}`} className="h-16 sm:h-20 rounded-xl" />,
      );

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        i,
      );
      const iso = d.toISOString().slice(0, 10);
      const cd = history.find((h) => h.date === iso);
      const log = dayLogs[iso];

      const symbols: string[] = [];
      let ring = "";

      if (log?.period) symbols.push("💧");
      else if (cd) {
        if (cd.phase === "period") symbols.push("💧");
        if (cd.phase === "follicular") symbols.push("🟦");
        if (cd.phase === "luteal") symbols.push("🔴");
        if (cd.phase === "ovulation") symbols.push("⭐");
        if (cd.fertileWindow) symbols.push("🌿");
      }
      if (log?.ovulation && !symbols.includes("⭐")) symbols.push("⭐");
      if (log?.pregnancyTestPositive) symbols.push("🧪");

      if (cd?.predicted) ring = "ring-1 ring-dashed ring-emerald-500";

      let bg = "bg-slate-50";
      if (log?.period) bg = "bg-rose-100";
      else if (cd?.fertileWindow) bg = "bg-emerald-100";
      else if (cd?.phase === "ovulation") bg = "bg-emerald-200";
      else if (cd?.phase === "follicular") bg = "bg-blue-100";
      else if (cd?.phase === "luteal") bg = "bg-amber-100";

      const isToday =
        iso === todayISO ? "outline outline-1 outline-rose-500/60" : "";

      cells.push(
        <button
          key={iso}
          className={cn(
            "h-16 sm:h-20 rounded-xl border border-slate-200 p-2 text-xs cursor-pointer transition hover:scale-[1.01] text-left",
            bg,
            ring,
            isToday,
            sensitiveHidden ? "blur-sm select-none" : "",
          )}
          onClick={() => setSelectedDay(iso)}
          aria-label={`Open log for ${iso}`}
        >
          <div className="flex items-center justify-between">
            <div className="font-semibold">{i}</div>
            <div className="flex gap-1">
              {symbols.length ? (
                symbols.map((s, idx) => <span key={idx}>{s}</span>)
              ) : (
                <span className="text-slate-400">◌</span>
              )}
            </div>
          </div>
          {log?.notes ? (
            <div className="mt-1 line-clamp-2 text-[10px] opacity-70">
              📝 {log.notes}
            </div>
          ) : null}
        </button>,
      );
    }
    return cells;
  }, [
    startWeekday,
    daysInMonth,
    currentMonth,
    history,
    dayLogs,
    sensitiveHidden,
    todayISO,
  ]);

  const selectedLog: DayLog | null = useMemo(() => {
    if (!selectedDay) return null;
    return dayLogs[selectedDay] ?? { date: selectedDay };
  }, [selectedDay, dayLogs]);

  const persistDayLog = useCallback(
    async (log: DayLog) => {
      if (!serverHydratedRef.current) return;

      const r = await apiTry(async () => {
        await fetchJson(apiUrl(LADY_API.dayLogsUpsert), {
          method: "POST",
          body: JSON.stringify({ log }),
          timeoutMs: 12000,
        });
      });

      if (r.ok) return;

      await apiTry(async () => {
        const state: LadyServerState = {
          profile,
          docs,
          notes,
          screening,
          dayLogs: { ...dayLogs, [log.date]: log },
          updatedAtISO: nowISO(),
        };
        await fetchJson(apiUrl(LADY_API.state), {
          method: "PUT",
          body: JSON.stringify(state),
          timeoutMs: 15000,
        });
      });
    },
    [dayLogs, docs, notes, profile, screening, apiUrl],
  );

  function saveLog(log: DayLog) {
    setDayLogs((prev) => ({ ...prev, [log.date]: log }));
    track("lady_daylog_save", { date: log.date });
    void persistDayLog(log);
  }

  const symptomIntensity = useMemo(() => {
    const last = history.slice(-28);
    return last.map((d) => dayLogs[d.date]?.symptoms?.length ?? 0);
  }, [history, dayLogs]);
  const allZeroSymptoms = useMemo(
    () => symptomIntensity.every((n) => n === 0),
    [symptomIntensity],
  );

  const quickDate = selectedDay || todayISO;

  useEffect(() => {
    const current = (dayLogs[quickDate]?.symptoms ?? []) as SymptomChoice[];
    setPendingQuickSymptoms(current);
  }, [quickDate, dayLogs]);

  const quickSymptoms: SymptomChoice[] = pendingQuickSymptoms;

  const toggleSymptom = (name: SymptomChoice) => {
    const has = quickSymptoms.includes(name);
    const next = has
      ? quickSymptoms.filter((s) => s !== name)
      : [...quickSymptoms, name];
    setPendingQuickSymptoms(next);
    track("lady_symptom_toggle", { name, active: !has, date: quickDate });
  };

  const confirmQuickSymptoms = () => {
    const base = dayLogs[quickDate] ?? { date: quickDate };
    saveLog({ ...base, symptoms: pendingQuickSymptoms });
    showBanner("success", "Symptoms saved.");
  };

  const resetQuickSymptoms = () => {
    const current = (dayLogs[quickDate]?.symptoms ?? []) as SymptomChoice[];
    setPendingQuickSymptoms(current);
    showBanner("info", "Changes reset.");
  };

  const loadPdfOnce = useCallback(async () => {
    if (!mounted) return;
    setPdfLoading(true);
    try {
      let blob: Blob | null = null;

      const serverPdf = await apiTry(async () => {
        const b = await fetchBlob(apiUrl(LADY_API.reportPdf), {
          method: "GET",
          timeoutMs: 25000,
        });
        return b;
      });

      if (serverPdf.ok) blob = serverPdf.data;

      if (!blob) {
        const r = await generateHealthReport("current-user", {
          fertility: true,
          ladyCenter: true,
        } as any);
        blob = r.blob;
      }

      if (pdfObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(pdfObjectUrlRef.current);
        } catch {}
      }
      const url = URL.createObjectURL(blob);
      pdfObjectUrlRef.current = url;
      setPdfUrl(url);
    } catch (err) {
      console.error("Failed to generate Lady Center PDF", err);
      showBanner("error", "Could not generate report.");
    } finally {
      setPdfLoading(false);
    }
  }, [mounted, apiUrl]);

  useEffect(() => {
    return () => {
      if (pdfObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(pdfObjectUrlRef.current);
        } catch {}
        pdfObjectUrlRef.current = null;
      }
    };
  }, []);

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return;
    track("lady_report_download");
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = "lady_center_report.pdf";
    link.click();
  }, [pdfUrl]);

  const icsUrl = useMemo(() => {
    if (!mounted) return null;
    try {
      return buildFertilityICSUrlFromPrefs(prefs, window.location.origin);
    } catch {
      return null;
    }
  }, [mounted, prefs]);

  const openSubscribeToast = () => {
    const enabled = !!icsUrl;
    setToastMsg(
      enabled
        ? icsUrl!
        : "Set preferences first (LMP + cycle length) in Setup Preferences.",
    );
    setToastOpen(true);
    setToastCopied(false);
    track("lady_ics_toast", { enabled });
  };

  useEffect(() => {
    if (!toastOpen) return;
    const t = setTimeout(() => setToastOpen(false), 5000);
    return () => clearTimeout(t);
  }, [toastOpen]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setToastCopied(true);
    track("lady_ics_copy");
  };

  const carePaths = useMemo(
    () => [
      {
        key: "period_pain",
        title: "Period pain",
        desc: "Track patterns and decide next steps.",
      },
      {
        key: "irregular",
        title: "Irregular cycles",
        desc: "Spot trends and plan care.",
      },
      {
        key: "fertility",
        title: "Fertility goals",
        desc: "Timing, lifestyle, and support.",
      },
      {
        key: "pregnancy",
        title: "Pregnancy",
        desc: "Week-by-week support and checks.",
      },
      {
        key: "menopause",
        title: "Peri/Menopause",
        desc: "Symptoms, triggers, comfort tools.",
      },
      {
        key: "sexual_health",
        title: "Sexual health",
        desc: "Discreet support and screening.",
      },
    ],
    [],
  );

  const normalizedGender = useMemo(() => {
    const raw = String(viewerProfile?.gender || profile?.sexAtBirth || "")
      .trim()
      .toLowerCase();
    if (!raw) return "unknown";
    if (["male", "man", "m"].includes(raw)) return "male";
    if (["female", "woman", "f"].includes(raw)) return "female";
    if (["intersex"].includes(raw)) return "intersex";
    return "unknown";
  }, [viewerProfile?.gender, profile?.sexAtBirth]);

  const blockLadyCenterForViewer =
    viewerProfileLoaded && normalizedGender !== "female";

  const ladyCenterBlockTitle =
    normalizedGender === "unknown"
      ? "Complete your profile to use Lady Center"
      : "Lady Center requires a female profile";

  const ladyCenterBlockBody =
    normalizedGender === "unknown"
      ? "Lady Center uses verified profile gender before enabling cycle, fertility, pregnancy, menopause, and reproductive-health workflows. Please complete your profile first."
      : "Based on the current verified profile, this feature is not the right fit for this patient. Lady Center is intended for female reproductive-health journeys.";

  const screeningItems: ScreeningItem[] = useMemo(() => {
    const age = typeof viewerProfile?.age === "number" ? viewerProfile.age : null;
    const conditions = Array.isArray(profile?.knownConditions)
      ? profile.knownConditions
      : [];
    const isPregnancy = profile?.mode === "pregnancy";

    const base: Array<
      Omit<ScreeningItem, "lastDoneISO" | "nextDueISO" | "status">
    > = [];

    if (normalizedGender !== "male") {
      base.push({
        key: "pap",
        title: "Cervical screening (Pap/HPV)",
        desc: "Routine check based on local guidelines and risk factors.",
        cadence:
          age && age < 25
            ? "Discuss clinician timing"
            : "Every 3–5 years (varies)",
      });

      base.push({
        key: "breast",
        title: "Breast screening",
        desc:
          age && age >= 40
            ? "Age-aware imaging and routine review."
            : "Self-check reminders and imaging when appropriate.",
        cadence: age && age >= 40 ? "Age/clinician guided" : "As advised",
      });
    }

    base.push({
      key: "sti",
      title: "STI screening",
      desc: "Routine or symptom-based testing.",
      cadence: "As needed",
    });

    if (!age || age <= 26) {
      base.push({
        key: "hpv_vax",
        title: "HPV vaccine",
        desc: "Check status and schedule doses if eligible.",
        cadence: "Course-based",
      });
    }

    if (isPregnancy) {
      base.push({
        key: "prenatal_labs",
        title: "Prenatal baseline labs",
        desc: "Routine antenatal lab panel and booking review.",
        cadence: "First trimester / clinician guided",
      });
    }

    if (
      conditions.some((x) => /endometriosis|pcos|fibroid|adenomyosis/i.test(x))
    ) {
      base.push({
        key: "gynae_review",
        title: "Gynae review",
        desc: "Follow-up review for known reproductive-health conditions.",
        cadence: "Clinician guided",
      });
    }

    return base.map((b) => {
      const lastDoneISO = screening[b.key]?.lastDoneISO ?? null;

      let nextDueISO: string | null = null;
      if (lastDoneISO) {
        const add =
          b.key === "pap"
            ? 365 * 3
            : b.key === "breast"
              ? 365 * 2
              : b.key === "sti"
                ? 365
                : b.key === "hpv_vax"
                  ? 365
                  : b.key === "prenatal_labs"
                    ? 120
                    : b.key === "gynae_review"
                      ? 180
                      : 365;

        nextDueISO = addDaysISO(lastDoneISO, add);
      }

      const status: ScreeningItem["status"] = !lastDoneISO
        ? "unknown"
        : nextDueISO && new Date(nextDueISO).getTime() < Date.now()
          ? "overdue"
          : "ok";

      return { ...b, lastDoneISO, nextDueISO, status };
    });
  }, [
    screening,
    viewerProfile?.age,
    profile?.knownConditions,
    profile?.mode,
    normalizedGender,
  ]);

  useEffect(() => {
    if (!mounted) return;
    if (!profile) return;
    if (blockLadyCenterForViewer) return;

    let cancelled = false;

    async function run() {
      setLadyInsightBusy(true);
      setLadyInsightError(null);

      try {
        const res = await analyzeLadyCenterWithInsightCore({
          mode: profile?.mode ?? "cycle",
          todayISO,
          prediction: prediction
            ? {
                cycleDay: prediction.cycleDay ?? null,
                cycleLength: prediction.cycleLength ?? null,
                nextPeriodStart: prediction.nextPeriodStart ?? null,
                fertileStart: prediction.fertileStart ?? null,
                fertileEnd: prediction.fertileEnd ?? null,
                ovulation: prediction.ovulation ?? null,
                fertileWindowConfidence:
                  predictionFertileWindowConfidence(prediction),
                irregular: predictionIrregular(prediction),
              }
            : null,
          pregnancy: {
            status: preg?.status ?? null,
            confidence: preg?.confidence ?? null,
            reasons: Array.isArray(preg?.reasons) ? preg.reasons : [],
          },
          screeningItems: screeningItems.map((x) => ({
            key: x.key,
            title: x.title,
            status: x.status,
            nextDueISO: x.nextDueISO ?? null,
          })),
          documents: docs.map((d) => ({
            id: d.id,
            title: d.title,
            tag: d.tag,
            createdISO: d.createdISO,
          })),
          carePaths: carePaths.map((x) => ({ key: x.key, title: x.title })),
          signals: {
            pregnancyStatus: preg?.status ?? "unknown",
            cycleDay: prediction?.cycleDay ?? null,
            cycleLength: prediction?.cycleLength ?? null,
            nextPeriodStart: prediction?.nextPeriodStart ?? null,
            fertileStart: prediction?.fertileStart ?? null,
            symptomsToday: (dayLogs[todayISO]?.symptoms ?? []) as any,
            fertileWindowConfidence:
              predictionFertileWindowConfidence(prediction),
            irregular: predictionIrregular(prediction),
            tryingToConceive: profile?.tryingToConceive ?? null,
            contraceptionMethod: profile?.contraceptiveMethod || null,
            knownConditions: profile?.knownConditions ?? [],
          },
        });

        if (!cancelled) {
          setLadyInsight(res);
        }
      } catch {
        if (!cancelled) {
          setLadyInsight(null);
          setLadyInsightError(
            "InsightCore unavailable, using local Lady Center analysis.",
          );
        }
      } finally {
        if (!cancelled) setLadyInsightBusy(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [
    mounted,
    profile,
    blockLadyCenterForViewer,
    todayISO,
    prediction,
    preg,
    screeningItems,
    docs,
    carePaths,
    dayLogs,
  ]);

  const scheduleScreeningReminders = useCallback(async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const payload = {
      kind: "lady_screening",
      timezone: tz,
      items: screeningItems.map((x) => ({
        key: x.key,
        title: x.title,
        cadence: x.cadence,
        nextDueISO: x.nextDueISO ?? null,
        lastDoneISO: x.lastDoneISO ?? null,
      })),
    };

    const r = await apiTry(async () => {
      await fetchJson(apiUrl(LADY_API.reminders), {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 15000,
      });
    });

    if (r.ok) {
      showBanner("success", "Reminders scheduled.");
      track("lady_screening_reminders_scheduled");
      return;
    }

    showBanner("info", "Could not schedule reminders (offline).");
  }, [screeningItems, apiUrl]);

  const markScreeningDone = useCallback(
    async (key: string) => {
      const iso = nowISO();
      setScreening((s) => ({ ...s, [key]: { lastDoneISO: iso } }));
      showBanner("success", "Marked as done.");
      track("lady_screening_done", { key });

      if (!serverHydratedRef.current) return;

      const r = await apiTry(async () => {
        await fetchJson(apiUrl(LADY_API.screening), {
          method: "POST",
          body: JSON.stringify({ key, lastDoneISO: iso }),
          timeoutMs: 12000,
        });
      });

      if (r.ok) return;

      await apiTry(async () => {
        const state: LadyServerState = {
          profile,
          docs,
          notes,
          screening: { ...screening, [key]: { lastDoneISO: iso } },
          dayLogs,
          updatedAtISO: nowISO(),
        };
        await fetchJson(apiUrl(LADY_API.state), {
          method: "PUT",
          body: JSON.stringify(state),
          timeoutMs: 15000,
        });
      });
    },
    [dayLogs, docs, notes, profile, screening, apiUrl],
  );

  useEffect(() => {
    if (!viewerProfileLoaded) return;
    if (
      !Array.isArray(viewerProfile?.chronicConditions) ||
      viewerProfile.chronicConditions.length === 0
    )
      return;

    setProfile((prev) => {
      if (!prev) return prev;
      if (
        Array.isArray(prev.knownConditions) &&
        prev.knownConditions.length > 0
      )
        return prev;
      return {
        ...prev,
        knownConditions: (viewerProfile.chronicConditions ?? []).slice(),
      };
    });
  }, [viewerProfileLoaded, viewerProfile?.chronicConditions]);

  const rolloverParams = useMemo(() => {
    const p = new URLSearchParams();

    const lmp = prefs?.lmp || "";
    const conceivedOn = prediction?.ovulation ? prediction.ovulation : "";

    if (lmp) p.set("lmp", lmp);
    if (conceivedOn) p.set("conceivedOn", conceivedOn);
    if (prediction?.nextPeriodStart)
      p.set("source", "lady-center-pregnancy-rollover");
    if (patientId) p.set("patientId", patientId);
    if (preg.status === "confirmed") p.set("preloadMilestones", "1");

    return p.toString();
  }, [
    prefs?.lmp,
    prediction?.ovulation,
    prediction?.nextPeriodStart,
    patientId,
    preg.status,
  ]);

  useEffect(() => {
    if (!mounted) return;
    if (preg.status !== "confirmed") return;

    setProfile((prev) => {
      if (!prev)
        return {
          ...defaultProfile("pregnancy"),
          mode: "pregnancy",
          trackCycle: false,
        };
      if (prev.mode === "pregnancy") return prev;
      return {
        ...prev,
        mode: "pregnancy",
        trackCycle: false,
      };
    });
  }, [mounted, preg.status]);

  const buildCarePathPlan = useCallback(
    (key: string) => {
      const antenatalHref = rolloverParams
        ? `/antenatal-center?${rolloverParams}`
        : "/antenatal-center";

      switch (key) {
        case "pregnancy":
          return {
            title: "Pregnancy next steps",
            note: "Rollover to Antenatal Center to continue with trimester, EDD, visits, labs, and reminders.",
            primaryHref: antenatalHref,
            primaryLabel: "Open Antenatal Center",
            secondaryHref: "/clinicians?specialties=OB%2FGYN&focus=pregnancy",
            secondaryLabel: "Find OB/GYN",
          };
        case "fertility":
          return {
            title: "Fertility next steps",
            note: "Best next move is a fertility-aware clinician review and baseline lab work.",
            primaryHref: "/clinicians?specialties=OB%2FGYN&focus=fertility",
            primaryLabel: "Browse fertility clinicians",
            secondaryHref: "/labs?panel=fertility",
            secondaryLabel: "Open fertility labs",
          };
        case "sexual_health":
          return {
            title: "Sexual health next steps",
            note: "Pair clinician review with STI or related screening if needed.",
            primaryHref: "/clinicians?specialties=OB%2FGYN&focus=sexual-health",
            primaryLabel: "Browse sexual-health clinicians",
            secondaryHref: "/labs?panel=sti",
            secondaryLabel: "Open STI labs",
          };
        case "irregular":
          return {
            title: "Irregular cycle next steps",
            note: "Cycle variability benefits from gynae review plus hormone / metabolic screening.",
            primaryHref: "/clinicians?specialties=OB%2FGYN&focus=irregular-cycles",
            primaryLabel: "Browse gynae clinicians",
            secondaryHref: "/labs?panel=hormones",
            secondaryLabel: "Open suggested labs",
          };
        case "period_pain":
          return {
            title: "Period pain next steps",
            note: "A clinician review can help distinguish routine cramps from Endometriosis, fibroids, or other causes.",
            primaryHref: "/clinicians?specialties=OB%2FGYN&focus=period-pain",
            primaryLabel: "Browse gynae clinicians",
            secondaryHref: "/labs?panel=baseline",
            secondaryLabel: "Open baseline labs",
          };
        case "menopause":
          return {
            title: "Peri/Menopause next steps",
            note: "Symptoms, sleep, and hormonal changes can be reviewed with the right clinician.",
            primaryHref: "/clinicians?specialties=OB%2FGYN&focus=menopause",
            primaryLabel: "Browse menopause clinicians",
            secondaryHref: "/labs?panel=hormones",
            secondaryLabel: "Open hormone labs",
          };
        default:
          return null;
      }
    },
    [rolloverParams],
  );

  const todaySummary = useMemo(() => {
    const mode = profile?.mode ?? "cycle";

    if (mode === "cycle") {
      const cd = prediction?.cycleDay ?? null;
      const cl = prediction?.cycleLength ?? null;
      return {
        title: "Today",
        subtitle:
          cd && cl
            ? `Cycle day ${cd}/${cl} • ${predictionIrregular(prediction) ? "Irregular pattern detected" : "Calm, explainable insights"}`
            : "Your cycle & patterns at a glance",
        primary: {
          k: "Cycle",
          v: cd && cl ? `Day ${cd} of ~${cl}` : "Not configured",
        },
        secondary: [
          {
            k: "Next window",
            v: prediction
              ? `${formatNiceDate(prediction.nextPeriodStart)} → ${formatNiceDate(predictionNextPeriodEnd(prediction) ?? prediction.nextPeriodStart)}`
              : "Set preferences",
          },
          {
            k: "Timing window",
            v: prediction
              ? `${formatNiceDate(prediction.fertileStart)} → ${formatNiceDate(prediction.fertileEnd)} (${Math.round(
                  (predictionFertileWindowConfidence(prediction) ?? 0) * 100,
                )}%)`
              : "Set preferences",
          },
        ],
      };
    }

    if (mode === "pregnancy") {
      return {
        title: "Today",
        subtitle: "A calm check-in for this week",
        primary: { k: "Focus", v: "Hydration, sleep, and gentle movement" },
        secondary: [
          {
            k: "Note",
            v: "Log what you feel — patterns matter more than single days",
          },
          { k: "Care", v: "Discuss anything worrying with a clinician" },
        ],
      };
    }

    if (mode === "menopause") {
      return {
        title: "Today",
        subtitle: "Trends, triggers, and comfort tools",
        primary: { k: "Focus", v: "Sleep & temperature comfort" },
        secondary: [
          { k: "Pattern", v: "Track triggers (heat, caffeine, stress)" },
          { k: "Plan", v: "Small changes, consistent check-ins" },
        ],
      };
    }

    return {
      title: "Today",
      subtitle: "Track only what matters to you",
      primary: { k: "Focus", v: "Symptoms & notes" },
      secondary: [
        { k: "Quick log", v: "10 seconds" },
        { k: "Patterns", v: "We connect dots over time" },
      ],
    };
  }, [profile, prediction]);

  const mergedTodaySummary = useMemo(() => {
    if (!ladyInsight?.todaySummary) return todaySummary;

    return {
      ...todaySummary,
      subtitle: ladyInsight.todaySummary.subtitle ?? todaySummary.subtitle,
      primary: ladyInsight.todaySummary.primary ?? todaySummary.primary,
      secondary:
        Array.isArray(ladyInsight.todaySummary.secondary) &&
        ladyInsight.todaySummary.secondary.length
          ? ladyInsight.todaySummary.secondary
          : todaySummary.secondary,
    };
  }, [todaySummary, ladyInsight]);

  const prioritizedScreeningItems = useMemo(() => {
    const keys = ladyInsight?.prioritizedScreeningKeys || [];
    if (!keys.length) return screeningItems;

    return [...screeningItems].sort((a, b) => {
      const ai = keys.indexOf(a.key);
      const bi = keys.indexOf(b.key);
      const av = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const bv = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      return av - bv;
    });
  }, [screeningItems, ladyInsight]);

  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
        <div className="absolute -top-24 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-200/40 via-violet-200/30 to-emerald-200/30 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-10rem] h-80 w-80 rounded-full bg-gradient-to-tr from-amber-200/25 via-rose-200/25 to-blue-200/25 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <LadyCenterHeader
          title="Lady Center"
          subtitle={
            profile
              ? `${modeLabel(profile.mode)} • Private, supportive, actionable`
              : "Your cycle, hormones, and screenings—tracked privately."
          }
          syncHint={syncHint}
          syncState={syncState}
          discreet={discreet}
          onToggleDiscreet={() => {
            const next = !discreet;
            setDiscreet(next);
            if (next) showBanner("success", "Discreet Mode enabled.");
            else showBanner("info", "Discreet Mode disabled.");
            track("lady_discreet_toggle", { on: next });
          }}
          onOpenSettings={() => setOpenSettings(true)}
        />

        {banner ? (
          <div
            className={cn(
              "mt-4 rounded-2xl border px-4 py-3 text-sm",
              banner.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : banner.kind === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700",
            )}
          >
            {banner.text}
          </div>
        ) : null}

        {blockLadyCenterForViewer ? (
          <Card className="mt-6 border-sky-200 bg-sky-50/80 p-5">
            <div className="space-y-3">
              <div className="text-base font-semibold text-slate-900">
                {ladyCenterBlockTitle}
              </div>
              <div className="text-sm text-slate-700">
                {ladyCenterBlockBody}
              </div>
              <div className="text-sm text-slate-700">
                You can still use the rest of Ambulant+ for general health,
                clinician access, labs, reports, and other care journeys.
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={normalizedGender === "unknown" ? "/profile" : "/lobby"}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {normalizedGender === "unknown" ? "Complete profile" : "Back to Lobby"}
                </Link>
                <Link
                  href="/clinicians"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Browse clinicians
                </Link>
                <Link
                  href="/reports"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Open reports
                </Link>
              </div>
            </div>
          </Card>
        ) : null}

        {blockLadyCenterForViewer ? null : (
          <>
            {mounted && showPregnancyBanner ? (
              <Card
                className={cn(
                  "mt-6 p-4",
                  preg.status === "confirmed"
                    ? "border-emerald-200 bg-emerald-50/70"
                    : preg.status === "likely"
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-blue-200 bg-blue-50/70",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-xl",
                      preg.status === "confirmed"
                        ? "bg-emerald-100"
                        : preg.status === "likely"
                          ? "bg-amber-100"
                          : "bg-blue-100",
                    )}
                  >
                    <Baby className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900">
                      {preg.status === "confirmed"
                        ? "Congratulations"
                        : preg.status === "likely"
                          ? "Possible pregnancy"
                          : "Maybe pregnant"}
                      {preg.confidence ? (
                        <span className="ml-2 text-xs text-slate-500">
                          ({Math.round(preg.confidence * 100)}%)
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      {sensitiveHidden
                        ? "Discreet Mode is on. Tap reveal to see details."
                        : preg.reasons?.length
                          ? preg.reasons.join(" • ")
                          : "Keep wearing your device and logging symptoms."}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {discreet && sensitiveHidden ? (
                        <button
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                          onClick={() => {
                            revealSensitive(30);
                            showBanner("info", "Revealed for 30 seconds.");
                          }}
                        >
                          Reveal
                        </button>
                      ) : null}

                      {preg.status === "confirmed" ? (
                        <Link
                          href={
                            rolloverParams
                              ? `/antenatal-center?${rolloverParams}`
                              : "/antenatal-center"
                          }
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                          onClick={() =>
                            track("lady_pregnancy_cta", {
                              cta: "start_antenatal",
                            })
                          }
                        >
                          Start antenatal journey →
                        </Link>
                      ) : (
                        <>
                          <button
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setSelectedDay(todayISO);
                              showBanner(
                                "info",
                                "Open day log to record test result.",
                              );
                            }}
                          >
                            Log test / symptoms
                          </button>
                          <a
                            href="https://www.google.com/search?q=pregnancy+test"
                            target="_blank"
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() =>
                              track("lady_pregnancy_cta", { cta: "take_test" })
                            }
                            rel="noreferrer"
                          >
                            Take a test
                          </a>
                        </>
                      )}

                      <button
                        className="rounded-xl border border-transparent bg-white/0 px-3 py-2 text-sm text-slate-700 hover:bg-white/60"
                        onClick={dismissPregnancyBanner}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            <div className="mt-6">
              <LadyCenterQuickActions
                modeLabel={profile ? modeLabel(profile.mode) : null}
                discreet={discreet}
                onOpenSetup={() => setOpenSetup(true)}
                onLogPeriod={() => {
                  if (!profile) setProfile(defaultProfile("cycle"));
                  setSelectedDay(selectedDay ?? todayISO);
                }}
                onLogSymptom={() => {
                  if (!profile) setProfile(defaultProfile("cycle"));
                  document
                    .getElementById("lady-quick-symptoms")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  showBanner("info", "Use Quick Symptoms below, then confirm to save.");
                }}
                onExportReport={async () => {
                  setShowReport(true);
                  if (!pdfUrl) await loadPdfOnce();
                  document
                    .getElementById("lady-report")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onSubscribeCalendar={openSubscribeToast}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8 space-y-4">
                <TodaySummaryCard
                  summary={mergedTodaySummary}
                  discreet={discreet}
                  sensitiveHidden={sensitiveHidden}
                  onReveal={() => revealSensitive(30)}
                  onFindCare={() => track("lady_find_care")}
                  deliveryState={{
                    source: "insightcore",
                    degradedMode: ladyInsight?.degradedMode ?? Boolean(ladyInsightError),
                    error: ladyInsightError,
                  }}
                  summaryBadge={ladyInsight?.todaySummary?.badge ?? null}
                />

                {!profile ? (
                  <Card className="p-5">
                    <SectionHeader
                      title="Set up what you want to track"
                      subtitle="Nothing is forced. Choose a mode — you can change it anytime."
                      right={
                        <button
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                          onClick={() => setOpenSetup(true)}
                        >
                          Start setup
                        </button>
                      }
                    />
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <SetupChoice
                        title="Track cycle"
                        desc="Windows, patterns, and context."
                        onClick={() => {
                          setProfile(defaultProfile("cycle"));
                          showBanner("success", "Cycle tracking enabled.");
                        }}
                      />
                      <SetupChoice
                        title="Track symptoms only"
                        desc="No cycle labels. Just what you feel."
                        onClick={() => {
                          setProfile(defaultProfile("symptoms"));
                          showBanner(
                            "success",
                            "Symptoms-only tracking enabled.",
                          );
                        }}
                      />
                      <SetupChoice
                        title="Health mode"
                        desc="Pregnancy or peri/menopause support."
                        onClick={() => setOpenSetup(true)}
                      />
                    </div>
                  </Card>
                ) : null}

                <Card className="p-5">
                  <SectionHeader
                    title="Cycle timeline"
                    subtitle="Calendar + trends. Predictions improve with consistent logs."
                    right={
                      <div className="flex items-center gap-2">
                        <Pill tone="blue">
                          <Calendar className="h-3.5 w-3.5" /> Calendar
                        </Pill>
                        <Pill tone="violet">
                          <FileText className="h-3.5 w-3.5" /> Report
                        </Pill>
                      </div>
                    }
                  />

                  <LadyCenterTimelinePanel
                    show={showChart}
                    onToggle={() => setShowChart((v) => !v)}
                    windowDays={windowDays}
                    onChangeWindow={(days) => {
                      setWindowDays(days);
                      track("lady_chart_timeframe", { days });
                    }}
                    visibleSeries={visibleSeries}
                    onToggleSeries={(key) => {
                      setVisibleSeries((s) => ({ ...s, [key]: !s[key] }));
                      track("lady_chart_series_toggle", {
                        key,
                        enabled: !visibleSeries[key],
                      });
                    }}
                    discreet={discreet}
                    sensitiveHidden={sensitiveHidden}
                    onReveal={() => revealSensitive(30)}
                    chartData={chartData}
                    chartOptions={chartOptions}
                  />

                  <LadyCenterCalendarPanel
                    show={showCalendar}
                    onToggle={() => setShowCalendar((v) => !v)}
                    currentMonth={currentMonth}
                    onPrevMonth={() =>
                      setCurrentMonth(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() - 1,
                          1,
                        ),
                      )
                    }
                    onNextMonth={() =>
                      setCurrentMonth(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                    weekdayLabels={weekdayLabels}
                    calendarCells={calendarCells}
                    sensitiveHidden={sensitiveHidden}
                    onReveal={() => revealSensitive(30)}
                    symptomChoices={SYMPTOM_CHOICES}
                    quickDateLabel={selectedDay ? selectedDay : "today"}
                    quickSymptoms={
                      (dayLogs[quickDate]?.symptoms ?? []) as string[]
                    }
                    pendingSymptoms={pendingQuickSymptoms as string[]}
                    onToggleSymptom={(s) => toggleSymptom(s as SymptomChoice)}
                    onConfirmSymptoms={confirmQuickSymptoms}
                    onResetSymptoms={resetQuickSymptoms}
                    symptomIntensity={symptomIntensity}
                    allZeroSymptoms={allZeroSymptoms}
                  />

                  <LadyCenterReportPanel
                    show={showReport}
                    onToggle={() => setShowReport((v) => !v)}
                    pdfUrl={pdfUrl}
                    pdfLoading={pdfLoading}
                    onGenerate={loadPdfOnce}
                    onDownload={handleDownload}
                    sensitiveHidden={sensitiveHidden}
                    onReveal={() => revealSensitive(30)}
                  />
                </Card>

                {ladyInsightBusy ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Refreshing InsightCore guidance…
                  </div>
                ) : null}

                <InsightFeed
                  mode={profile?.mode ?? "cycle"}
                  todayISO={todayISO}
                  discreet={discreet}
                  sensitiveHidden={sensitiveHidden}
                  onReveal={() => revealSensitive(30)}
                  onBanner={showBanner}
                  remoteInsights={ladyInsight?.insights ?? []}
                  deliveryState={{
                    source: "insightcore",
                    degradedMode: ladyInsight?.degradedMode ?? Boolean(ladyInsightError),
                    error: ladyInsightError,
                  }}
                  fallbackInsights={
                    buildInsights(
                      profile?.mode ?? "cycle",
                      prediction,
                      preg,
                    ) as InsightCoreInsight[]
                  }
                  signals={{
                    pregnancyStatus: preg?.status ?? "unknown",
                    cycleDay: prediction?.cycleDay ?? null,
                    cycleLength: prediction?.cycleLength ?? null,
                    nextPeriodStart: prediction?.nextPeriodStart ?? null,
                    fertileStart: prediction?.fertileStart ?? null,
                    symptomsToday: (dayLogs[todayISO]?.symptoms ?? []) as any,
                    fertileWindowConfidence:
                      predictionFertileWindowConfidence(prediction),
                    irregular: predictionIrregular(prediction),
                    tryingToConceive: profile?.tryingToConceive ?? null,
                    contraceptionMethod: profile?.contraceptiveMethod || null,
                    knownConditions: profile?.knownConditions ?? [],
                  }}
                />
              </div>

              <div className="lg:col-span-4 space-y-4">
                <ScreeningChecklist
                  items={prioritizedScreeningItems as any}
                  priorityKeys={ladyInsight?.prioritizedScreeningKeys ?? []}
                  priorityNote={ladyInsight?.screeningNote ?? null}
                  formatNiceDate={formatNiceDate}
                  onReminders={scheduleScreeningReminders}
                  onMarkDone={(key) => void markScreeningDone(key)}
                  onBook={() => {
                    window.location.href = "/clinicians?specialties=OB%2FGYN";
                  }}
                />

                <Card className="p-5">
                  <SectionHeader
                    title="Care paths"
                    subtitle="I know what I need — guide me."
                    right={<Pill tone="violet">Guided</Pill>}
                  />
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    {carePaths.map((x) => (
                      <button
                        key={x.key}
                        className="group rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                        onClick={() => {
                          if (!profile) setProfile(defaultProfile("cycle"));
                          setOpenCarePath(x);
                          track("lady_carepath_open", { key: x.key });
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {x.title}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-600">
                              {x.desc}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-700">
                            Open
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>

                <DocumentsFolder
                  docs={docs as any}
                  sensitiveHidden={sensitiveHidden}
                  onReveal={() => revealSensitive(30)}
                  formatNiceDate={formatNiceDate}
                  formatNiceTime={formatNiceTime}
                  suggestionNote={ladyInsight?.documentSuggestion ?? null}
                  onAddFileName={(fileName) => {
                    const doc: LadyDoc = {
                      id: uid("doc"),
                      title: fileName.replace(/\.[a-z0-9]+$/i, ""),
                      fileName,
                      tag: guessTag(fileName),
                      createdISO: nowISO(),
                    };
                    setDocs((d) => [doc, ...d]);
                    showBanner("success", "Document added.");
                    track("lady_doc_add", { fileName });

                    void (async () => {
                      if (!serverHydratedRef.current) return;

                      const r = await apiTry(async () => {
                        await fetchJson(apiUrl(LADY_API.documents), {
                          method: "POST",
                          body: JSON.stringify({ doc }),
                          timeoutMs: 12000,
                        });
                      });

                      if (r.ok) return;

                      await apiTry(async () => {
                        const state: LadyServerState = {
                          profile,
                          docs: [doc, ...docs],
                          notes,
                          screening,
                          dayLogs,
                          updatedAtISO: nowISO(),
                        };
                        await fetchJson(apiUrl(LADY_API.state), {
                          method: "PUT",
                          body: JSON.stringify(state),
                          timeoutMs: 15000,
                        });
                      });
                    })();
                  }}
                  onView={() =>
                    showBanner(
                      "info",
                      "Open viewer + share/export controls next.",
                    )
                  }
                  onSummarize={() =>
                    showBanner(
                      "info",
                      "Route to clinician summary + AI extraction next.",
                    )
                  }
                  onRemove={(docId) => {
                    setDocs((xs) => xs.filter((x) => x.id !== docId));
                    showBanner("success", "Removed.");
                    track("lady_doc_remove", { id: docId });

                    void (async () => {
                      if (!serverHydratedRef.current) return;

                      const r = await apiTry(async () => {
                        await fetchJson(apiUrl(LADY_API.documents), {
                          method: "DELETE",
                          body: JSON.stringify({ id: docId }),
                          timeoutMs: 12000,
                        });
                      });

                      if (r.ok) return;

                      await apiTry(async () => {
                        const state: LadyServerState = {
                          profile,
                          docs: docs.filter((x) => x.id !== docId),
                          notes,
                          screening,
                          dayLogs,
                          updatedAtISO: nowISO(),
                        };
                        await fetchJson(apiUrl(LADY_API.state), {
                          method: "PUT",
                          body: JSON.stringify(state),
                          timeoutMs: 15000,
                        });
                      });
                    })();
                  }}
                />

                <LadyCenterNotesPanel
                  notes={notes}
                  sensitiveHidden={sensitiveHidden}
                  onReveal={() => revealSensitive(30)}
                  formatNiceDate={formatNiceDate}
                  onAdd={() => setOpenAddNote(true)}
                />

                <div className="text-sm text-slate-600 text-center">
                  Don’t have a wearable?{" "}
                  <a
                    href="https://nexring.cloventechnology.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-rose-400 hover:text-slate-900"
                  >
                    Get NexRing for better insights →
                  </a>
                </div>

                <Card className="p-4 bg-amber-50/70 border-amber-200">
                  <div className="text-sm text-slate-700">
                    ⚠ Tracking and predictions are estimates — not medical
                    advice. If symptoms are severe, changing, or worrying,
                    please consult a clinician.
                  </div>
                </Card>

                <Card className="p-4 bg-slate-50/80 border-slate-200">
                  <div className="text-sm text-slate-700">
                    Keep your reproductive-health context updated in Settings so
                    your logs, reports, and clinician conversations stay aligned
                    with conditions such as PCOS, fibroids, thyroid history, and
                    fertility treatment history where relevant.
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        {selectedLog ? (
          <LadyCenterDayLogSheet
            discreet={discreet}
            hidden={sensitiveHidden}
            log={selectedLog}
            onClose={() => setSelectedDay(null)}
            onSave={saveLog}
          />
        ) : null}

        <LadyCenterSettingsModal
          open={openSettings}
          onClose={() => setOpenSettings(false)}
          discreet={discreet}
          onToggleDiscreet={() => setDiscreet((x) => !x)}
          profile={profile}
          onPatchProfile={patchProfile}
          onChangeMode={(m) => {
            setProfile((p) => ({
              ...(p ?? defaultProfile(m)),
              mode: m,
              trackCycle: m === "cycle",
            }));
            track("lady_mode_change", { mode: m });
          }}
          onChangeTrackVitals={(v) =>
            setProfile((p) => ({ ...(p ?? defaultProfile()), trackVitals: v }))
          }
          onChangeRemindScreening={(v) =>
            setProfile((p) => ({
              ...(p ?? defaultProfile()),
              remindScreening: v,
            }))
          }
          onResetTracking={() => {
            try {
              localStorage.removeItem(LS.profile);
            } catch {}
            setProfile(null);
            showBanner("info", "Tracking reset.");
            setOpenSettings(false);
            track("lady_reset_tracking");

            void apiTry(async () => {
              await fetchJson(apiUrl(LADY_API.profile), {
                method: "PUT",
                body: JSON.stringify({ profile: null }),
                timeoutMs: 12000,
              });
            });
          }}
          onExportPdf={async () => {
            setShowReport(true);
            if (!pdfUrl) await loadPdfOnce();
            showBanner("success", "Report ready.");
          }}
          onSubscribeIcs={openSubscribeToast}
        />

        <LadyCenterSetupModal
          open={openSetup}
          onClose={() => setOpenSetup(false)}
          profile={profile}
          mode={(profile?.mode ?? "cycle") as any}
          onChangeMode={(m) => {
            setProfile((p) => ({
              ...(p ?? defaultProfile(m)),
              mode: m,
              trackCycle: m === "cycle",
            }));
            track("lady_mode_change", { mode: m });
          }}
          onPatchProfile={patchProfile}
          onDone={() => {
            if (!profile) setProfile(defaultProfile("cycle"));
            showBanner("success", "Saved.");
            setOpenSetup(false);
            track("lady_setup_done");
          }}
        />

        <Modal
          open={openAddNote}
          title="Add a private note"
          subtitle="Keep it short — future you will thank you."
          onClose={() => setOpenAddNote(false)}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpenAddNote(false)}
              >
                Cancel
              </button>
            </div>
          }
        >
          <NoteComposer
            onSaved={(text) => {
              const note = { id: uid("note"), text, createdISO: nowISO() };
              setNotes((n) => [note, ...n]);
              showBanner("success", "Note added.");
              setOpenAddNote(false);
              track("lady_note_add");

              void (async () => {
                if (!serverHydratedRef.current) return;

                const r = await apiTry(async () => {
                  await fetchJson(apiUrl(LADY_API.notes), {
                    method: "POST",
                    body: JSON.stringify({ note }),
                    timeoutMs: 12000,
                  });
                });

                if (r.ok) return;

                await apiTry(async () => {
                  const state: LadyServerState = {
                    profile,
                    docs,
                    notes: [note, ...notes],
                    screening,
                    dayLogs,
                    updatedAtISO: nowISO(),
                  };
                  await fetchJson(apiUrl(LADY_API.state), {
                    method: "PUT",
                    body: JSON.stringify(state),
                    timeoutMs: 15000,
                  });
                });
              })();
            }}
          />
        </Modal>

        <Modal
          open={!!openCarePath}
          title={openCarePath?.title ?? "Care path"}
          subtitle="A guided flow: a few questions → a clear next step."
          onClose={() => setOpenCarePath(null)}
        >
          {openCarePath ? (
            <CarePathFlow
              pathKey={openCarePath.key}
              discreet={discreet}
              guidanceNote={ladyInsight?.carePathGuidance?.[openCarePath.key] ?? null}
              onDone={(summary) => {
                const note = {
                  id: uid("note"),
                  text: summary,
                  createdISO: nowISO(),
                };

                setNotes((n) => [note, ...n]);
                showBanner("success", "Saved to notes.");
                const plan = buildCarePathPlan(openCarePath.key);
                setOpenCarePath(null);
                if (plan) setCarePathAction(plan);

                void apiTry(async () => {
                  await fetchJson(apiUrl(LADY_API.notes), {
                    method: "POST",
                    body: JSON.stringify({ note }),
                    timeoutMs: 12000,
                  });
                });
              }}
            />
          ) : null}
        </Modal>

        <Modal
          open={!!carePathAction}
          title={carePathAction?.title ?? "Next steps"}
          subtitle="Recommended next actions based on your selected path."
          onClose={() => setCarePathAction(null)}
        >
          {carePathAction ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {carePathAction.note}
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={carePathAction.primaryHref}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {carePathAction.primaryLabel}
                </a>

                {carePathAction.secondaryHref ? (
                  <a
                    href={carePathAction.secondaryHref}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {carePathAction.secondaryLabel}
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </Modal>

        <LadyCenterSubscribeToast
          open={toastOpen}
          icsUrl={icsUrl}
          message={toastMsg}
          copied={toastCopied}
          onClose={() => setToastOpen(false)}
          onCopy={() => icsUrl && copy(icsUrl)}
        />
      </div>
    </div>
  );
}

/* =========================================================
   Subcomponents still local
========================================================= */

function SetupChoice({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
      onClick={onClick}
    >
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{desc}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Pill tone="emerald">Private</Pill>
        <Pill tone="slate">Change anytime</Pill>
      </div>
    </button>
  );
}

function NoteComposer({ onSaved }: { onSaved: (text: string) => void }) {
  const [text, setText] = useState("");
  const left = 280 - text.length;

  return (
    <div className="space-y-3">
      <textarea
        data-autofocus="1"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 280))}
        placeholder="What happened? Any trigger? Anything to remember?"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500">{left} characters left</div>
        <button
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={!text.trim()}
          onClick={() => onSaved(text.trim())}
        >
          Save note
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   Fallback insights for InsightFeed
========================================================= */

function buildInsights(
  mode: LadyMode,
  prediction: any,
  preg: any,
): Array<{
  id: string;
  tone: "info" | "good" | "attention";
  title: string;
  summary: string;
  why: string;
  next: string;
}> {
  const out: any[] = [];

  if (mode === "cycle") {
    out.push({
      id: "i_window",
      tone: "info",
      title: prediction
        ? `Next window: ${formatNiceDate(prediction.nextPeriodStart)} → ${formatNiceDate(predictionNextPeriodEnd(prediction) ?? prediction.nextPeriodStart)}`
        : "Set preferences for predictions",
      summary: prediction
        ? "This estimate uses your preferences and improves with consistent logs."
        : "Add LMP + cycle length in Setup Preferences to unlock predictions and calendar subscription.",
      why: prediction
        ? "We use the cycle model configured in FertilitySetup, plus your logged events."
        : "No preferences are set yet.",
      next: "Log cycle starts and symptoms for 2–3 cycles to refine. If timing varies a lot, Symptoms-only mode can still give clarity.",
    });

    if (preg.status && preg.status !== "none") {
      out.push({
        id: "i_preg_signal",
        tone: preg.status === "confirmed" ? "good" : "attention",
        title:
          preg.status === "confirmed"
            ? "Pregnancy signal: confirmed"
            : "Pregnancy signal detected",
        summary:
          "If you can, confirm with a test and discuss with a clinician for next steps.",
        why: preg.reasons?.length
          ? preg.reasons.join(" • ")
          : "We noticed a pattern that can match early pregnancy signals.",
        next: "Log your test result in the day log. If you feel unwell or worried, please consult a clinician.",
      });
    }
  } else if (mode === "pregnancy") {
    out.push({
      id: "i_preg",
      tone: "info",
      title: "Weekly check-in",
      summary: "Consistency beats perfection — small steady habits compound.",
      why: "We focus on trends that are sustainable, not day-to-day noise.",
      next: "Pick one focus this week: hydration, gentle movement, or sleep consistency — then review next week.",
    });
  } else if (mode === "menopause") {
    out.push({
      id: "i_meno",
      tone: "info",
      title: "Triggers & comfort",
      summary: "Tracking triggers can be more useful than tracking everything.",
      why: "Patterns often show up around temperature, stress, caffeine, and sleep timing.",
      next: "Log the top 1–2 symptoms weekly, plus a short note about triggers. Discuss options with a clinician if symptoms affect daily life.",
    });
  } else {
    out.push({
      id: "i_symptoms",
      tone: "info",
      title: "Symptoms-only is a strong choice",
      summary: "You can gain clarity without cycle labels.",
      why: "Pattern detection can rely purely on symptoms + optional vitals context.",
      next: "Log 1–2 symptoms weekly for a month — then compare trends and decide next steps.",
    });
  }

  return out.slice(0, 4);
}

export default function LadyCenterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-6 text-sm text-slate-600">Loading Lady Center…</div>}>
      <LadyCenterPageContent />
    </Suspense>
  );
}
