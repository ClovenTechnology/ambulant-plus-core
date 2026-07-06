import { cookies, headers } from "next/headers";
﻿type ProfileContext = {
  ok?: boolean;
  item?: {
    member?: {
      id: string;
      memberNumber?: string | null;
      employeeNumber?: string | null;
      memberStatus?: string | null;
      memberKind?: string | null;
      dependentCode?: string | null;
      principalMemberNumber?: string | null;
      patientId?: string | null;
      joinedAt?: string | null;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
    };
    coverage?: {
      program?: { id?: string; name?: string } | null;
      plan?: {
        id?: string;
        name?: string;
        description?: string | null;
        status?: string | null;
        currency?: string;
        annualLimitMinor?: number | null;
        monthlyLimitMinor?: number | null;
        lifetimeLimitMinor?: number | null;
        serviceRules?: Array<{
          id?: string;
          serviceType?: string;
          decision?: string;
          enabled?: boolean;
          preauthRequired?: boolean;
          sponsorCapMinor?: number | null;
          memberCopayMinor?: number | null;
          memberCopayPercent?: number | null;
          limitCount?: number | null;
          limitMinor?: number | null;
          limitPeriod?: string | null;
          allowedVisitModes?: string[];
        }>;
      } | null;
      badges?: Array<{ code: string; label: string }>;
    };
    consent?: {
      sponsorAdherence?: boolean;
      corporateAdherence?: boolean;
      rewardProgram?: boolean;
      evidenceImages?: boolean;
      iomtFull?: boolean;
      iomtDevices?: string[];
      iomtMetrics?: string[];
    };
    healthContext?: {
      consent?: {
        vitals?: boolean;
        wearableInsights?: boolean;
        clinicalHistory?: boolean;
        reproductiveHealth?: boolean;
        antenatal?: boolean;
      };
      vitals?: {
        latestClinicalSpotCheck?: any;
        trendSummary?: any;
        abnormalFlags?: any[];
        sourceCoverage?: any;
      };
      wearable?: {
        sleepSummary?: any;
        activitySummary?: any;
        rhrHrvSummary?: any;
        rewardSignals?: any[];
      };
      clinicalHistory?: {
        allergies?: any[];
        conditions?: any[];
        vaccinations?: any[];
        operations?: any[];
      };
      reproductiveHealth?: {
        visible?: boolean;
        pregnancySignalAvailable?: boolean;
        pregnancyDetected?: boolean;
        confidence?: number | string | null;
        lastUpdated?: string | null;
      };
      antenatal?: {
        visible?: boolean;
        pregnancyActive?: boolean;
        edd?: string | null;
        gestationalAge?: string | number | null;
        trimester?: string | number | null;
        riskFlags?: any[];
        birthRecordAvailable?: boolean;
      };
    };
    adherence?: {
      allowed?: boolean;
      riskStatus?: string;
      rewardEligible?: boolean;
      rewardPointsEstimate?: number;
      interventionFlags?: string[];
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
        uncoveredMedicationCount?: number;
        reminderCoveragePct?: number;
      } | null;
      dailyTrend?: Array<{
        date: string;
        weightedPct: number;
        confidencePct: number;
        missed: number;
        pending: number;
      }>;
    } | null;
    utilization?: {
      claims?: {
        count?: number;
        submittedAmountMinor?: number;
        approvedAmountMinor?: number;
        paidAmountMinor?: number;
        currency?: string;
      };
      authorizations?: {
        total?: number;
        pending?: number;
        approved?: number;
        denied?: number;
        expired?: number;
        consumed?: number;
      };
      sponsorFunded?: {
        pharmacyOrders?: number;
        labOrders?: number;
        logisticsOrders?: number;
      };
    };
    iomtSharing?: {
      mode?: string;
      allowEvidenceImages?: boolean;
      devices?: string[];
      metrics?: string[];
    };
    gymWellness?: {
      name?: string | null;
      membershipType?: string | null;
      status?: string | null;
      checkInCount?: number;
      sessionCalories?: number | null;
      sessionDistanceKm?: number | null;
      sessionAvgHr?: number | null;
      sessionAvgSpo2?: number | null;
      lastCheckIn?: string | null;
      lastSessionMinutes?: number | null;
      notes?: string | null;
    };
    rewards?: {
      eligible?: boolean;
      pointsEstimate?: number;
      walletDestination?: string | null;
      tier?: string | null;
      monthlyCap?: number | null;
      reversalPolicy?: string | null;
      allowedUses?: string[];
    };
    latestPreflight?: {
      decision?: string | null;
      sponsorAmountMinor?: number;
      patientCopayMinor?: number;
      uncoveredGapMinor?: number;
      authorizationRequired?: boolean;
      reason?: string;
    } | null;
    recentAuthorizations?: Array<{
      id: string;
      status?: string;
      serviceType?: string;
      requestedAmountMinor?: number;
      approvedAmountMinor?: number;
      currency?: string;
      decisionReason?: string | null;
      expiresAt?: string | null;
      createdAt?: string | null;
    }>;
  };
};

function appOrigin() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";

  if (!host) {
    throw new Error("client_app_origin_required");
  }

  return `${proto}://${host}`;
}

function internalRequestHeaders() {
  return {
    cookie: cookies().toString(),
  };
}

function internalApiUrl(
  pathname: string,
  params: Record<string, string | number | undefined> = {},
) {
  const url = new URL(pathname, appOrigin());

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function getProfileContext(id: string): Promise<ProfileContext | null> {
  try {
    const res = await fetch(
      internalApiUrl(`/api/client/members/${encodeURIComponent(id)}/profile-context`, {
        days: 30,
      }).toString(),
      {
        cache: "no-store",
        headers: internalRequestHeaders(),
      },
    );

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function money(minor?: number | null, currency = "ZAR") {
  const value = Number(minor || 0) / 100;
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function average(nums: number[]) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function riskTone(risk?: string) {
  switch ((risk || "").toLowerCase()) {
    case "high":
      return { bg: "#3a1017", border: "#7f1d1d", text: "#fecaca" };
    case "moderate":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    default:
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
  }
}

function badgeTone(code: string) {
  switch (code) {
    case "MEDICAL_AID":
      return { bg: "#0c2238", border: "#1d4ed8", text: "#bfdbfe" };
    case "HOSPITAL_COVER":
      return { bg: "#1f123a", border: "#6d28d9", text: "#ddd6fe" };
    case "CORPORATE_SPONSOR":
      return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
    case "GYM":
      return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
    case "IOMT_FULL":
      return { bg: "#083344", border: "#0e7490", text: "#a5f3fc" };
    case "IOMT_PARTIAL":
      return { bg: "#164e63", border: "#0891b2", text: "#cffafe" };
    case "REWARD_ELIGIBLE":
      return { bg: "#1f123a", border: "#7c3aed", text: "#e9d5ff" };
    default:
      return { bg: "#1f2937", border: "#374151", text: "#d1d5db" };
  }
}

function styleBadge(code: string) {
  const tone = badgeTone(code);
  return {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    background: tone.bg,
    border: `1px solid ${tone.border}`,
    color: tone.text,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  } as React.CSSProperties;
}

function yesNo(value?: boolean) {
  return value ? "Yes" : "No";
}

function consentLabel(value?: boolean) {
  return value ? "Consented" : "Not shared";
}

function pickDisplay(value: any, fallback = "—") {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return String(value.value);
    if (value.label !== undefined) return String(value.label);
    if (value.summary !== undefined) return String(value.summary);
    if (value.status !== undefined) return String(value.status);
  }
  return fallback;
}

function countItems(value?: any[]) {
  return Array.isArray(value) ? value.length : 0;
}

function TrendBars({ values }: { values: number[] }) {
  if (!values.length) {
    return <div style={{ opacity: 0.62, fontSize: 13 }}>No trend points yet.</div>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))`,
        gap: 6,
        alignItems: "end",
        minHeight: 110,
        marginTop: 12,
      }}
    >
      {values.map((value, i) => (
        <div key={`${value}-${i}`} style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              height: `${Math.max(10, value)}px`,
              background: value >= 80 ? "#34d399" : value >= 60 ? "#60a5fa" : "#f59e0b",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            title={`${value}%`}
          />
          <div style={{ fontSize: 10, opacity: 0.62, textAlign: "center" }}>{i + 1}</div>
        </div>
      ))}
    </div>
  );
}

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const profile = await getProfileContext(params.id);

  if (!profile?.ok || !profile.item?.member) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ marginTop: 0 }}>Member not found</h1>
      </main>
    );
  }

  const item = profile.item!;
  const member = item.member as NonNullable<NonNullable<ProfileContext["item"]>["member"]>;
  const plan = item.coverage?.plan || null;
  const program = item.coverage?.program || null;
  const badges = Array.isArray(item.coverage?.badges) ? item.coverage!.badges! : [];
  const adherence = item.adherence || null;
  const summary = adherence?.summary || null;
  const risk = adherence?.riskStatus || "unknown";
  const riskStyle = riskTone(risk);
  const iomt = item.iomtSharing || {};
  const gym = item.gymWellness || {};
  const rewards = item.rewards || {};
  const utilization = item.utilization || {};
  const recentAuthorizations = Array.isArray(item.recentAuthorizations) ? item.recentAuthorizations : [];

  const healthContext = item.healthContext || {};
  const healthConsent = healthContext.consent || {};
  const vitals = healthContext.vitals || {};
  const wearable = healthContext.wearable || {};
  const clinicalHistory = healthContext.clinicalHistory || {};
  const reproductiveHealth = healthContext.reproductiveHealth || {};
  const antenatal = healthContext.antenatal || {};

  const latestSpotCheck = vitals.latestClinicalSpotCheck || {};
  const abnormalFlags = Array.isArray(vitals.abnormalFlags) ? vitals.abnormalFlags : [];
  const rewardSignals = Array.isArray(wearable.rewardSignals) ? wearable.rewardSignals : [];
  const antenatalRiskFlags = Array.isArray(antenatal.riskFlags) ? antenatal.riskFlags : [];

  const trendValues = Array.isArray(adherence?.dailyTrend)
    ? adherence!.dailyTrend!.slice(-14).map((x) => x.weightedPct)
    : [];

  const avgConfidenceTrend = Array.isArray(adherence?.dailyTrend)
    ? average(adherence!.dailyTrend!.slice(-14).map((x) => x.confidencePct))
    : 0;

  return (
    <main style={{ padding: 32, maxWidth: 1380 }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.68, textTransform: "uppercase" }}>
          Member Profile
        </div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>
          {member.memberNumber || member.employeeNumber || member.id}
        </h1>
        <p style={{ margin: 0, opacity: 0.82 }}>
          Sponsor-safe 360 view across coverage, adherence, IoMT sharing, wellness participation, rewards, claims, and authorizations.
        </p>
      </div>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 18,
          padding: 20,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: riskStyle.bg,
                  border: `1px solid ${riskStyle.border}`,
                  color: riskStyle.text,
                  textTransform: "capitalize",
                }}
              >
                {risk} adherence risk
              </span>

              <span
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "#0c2238",
                  border: "1px solid #1d4ed8",
                  color: "#bfdbfe",
                }}
              >
                {member.memberStatus || "Unknown status"}
              </span>

              <span
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "#1f2937",
                  border: "1px solid #374151",
                  color: "#d1d5db",
                }}
              >
                {member.memberKind || "Unknown kind"}
              </span>

              {!adherence?.allowed ? (
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "#1f2937",
                    border: "1px solid #374151",
                    color: "#d1d5db",
                  }}
                >
                  adherence sharing off
                </span>
              ) : null}
            </div>

            <div style={{ marginTop: 12, opacity: 0.86, fontSize: 14 }}>
              Coverage Plan: {plan?.name || "—"} · Program: {program?.name || "—"}
            </div>

            <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
              Dependent Code: {member.dependentCode || "—"} · Principal Member: {member.principalMemberNumber || "—"}
            </div>

            <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
              Effective: {fmtDate(member.effectiveFrom)} → {fmtDate(member.effectiveTo)} · Joined: {fmtDate(member.joinedAt)}
            </div>

            <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>
              Patient ID: {member.patientId || "—"} · Employee No: {member.employeeNumber || "—"}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <Metric label="Weighted adherence" value={`${summary?.weightedPct ?? 0}%`} />
            <Metric label="Confidence" value={`${summary?.confidencePct ?? 0}%`} />
            <Metric label="Verified ratio" value={`${summary?.verifiedRatio ?? 0}%`} />
            <Metric label="Reward points est." value={String(adherence?.rewardPointsEstimate ?? rewards?.pointsEstimate ?? 0)} />
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {badges.length === 0 ? (
            <span
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 999,
                background: "#1f2937",
                border: "1px solid #374151",
                color: "#d1d5db",
              }}
            >
              No cross-coverage badges yet
            </span>
          ) : (
            badges.map((badge, index) => (
              <span key={`${badge.code}-${index}`} style={styleBadge(badge.code)}>
                {badge.label}
              </span>
            ))
          )}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <Metric label="Tracked doses" value={String(summary?.trackedDoseCount ?? 0)} />
        <Metric label="Missed-dose rate" value={`${summary?.missedDoseRate ?? 0}%`} />
        <Metric label="Reminder coverage" value={`${summary?.reminderCoveragePct ?? 0}%`} />
        <Metric label="Uncovered medications" value={String(summary?.uncoveredMedicationCount ?? 0)} />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr 1fr",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Medication adherence panel</h2>
          <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
            Weighted adherence, confidence, trend, intervention posture, and uncovered medication exposure.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginTop: 16,
            }}
          >
            <MiniMetric label="Verified taken" value={summary?.verifiedTaken ?? 0} />
            <MiniMetric label="Self-reported" value={summary?.selfReportedTaken ?? 0} />
            <MiniMetric label="Pending" value={summary?.pending ?? 0} />
            <MiniMetric label="Late-dose rate" value={`${summary?.lateDoseRate ?? 0}%`} />
          </div>

          <div
            style={{
              marginTop: 16,
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.68 }}>
              Last 14 trend points · avg confidence {avgConfidenceTrend}%
            </div>
            <TrendBars values={trendValues} />
          </div>

          <div
            style={{
              marginTop: 16,
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
              fontSize: 13,
              opacity: 0.92,
            }}
          >
            {risk === "high"
              ? "High case-management priority: recurrent misses or weak adherence score suggest the member needs immediate intervention, reminder reinforcement, and benefit-aware support."
              : risk === "moderate"
              ? "Moderate intervention signal: member is tracking but would benefit from stronger verification, reminder setup completion, and wellness nudges."
              : "Stable medication adherence posture: this member is a strong candidate for positive reinforcement and reward-program conversion."}
          </div>

          <div
            style={{
              marginTop: 12,
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Intervention flags</div>
            <div style={{ opacity: 0.86 }}>
              {Array.isArray(adherence?.interventionFlags) && adherence!.interventionFlags!.length
                ? adherence!.interventionFlags!.join(", ")
                : "No active intervention flags"}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>IoMT sharing</h2>
          <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
            Device and metric visibility posture for sponsors, payers, and partners.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
              marginTop: 16,
            }}
          >
            <MiniMetric label="Mode" value={iomt.mode || "Not configured"} />
            <MiniMetric label="Evidence sharing" value={iomt.allowEvidenceImages ? "Allowed" : "Off"} />
            <MiniMetric label="Devices shared" value={Array.isArray(iomt.devices) ? iomt.devices.length : 0} />
            <MiniMetric label="Metrics shared" value={Array.isArray(iomt.metrics) ? iomt.metrics.length : 0} />
          </div>

          <div
            style={{
              marginTop: 16,
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Devices / metrics</div>
            <div style={{ opacity: 0.86 }}>
              Devices: {Array.isArray(iomt.devices) && iomt.devices.length ? iomt.devices.join(", ") : "—"}
            </div>
            <div style={{ opacity: 0.72, marginTop: 6 }}>
              Metrics: {Array.isArray(iomt.metrics) && iomt.metrics.length ? iomt.metrics.join(", ") : "—"}
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Consent posture</div>
            <div style={{ opacity: 0.86 }}>
              Payer adherence: {item.consent?.sponsorAdherence ? "On" : "Off"} · Corporate: {item.consent?.corporateAdherence ? "On" : "Off"}
            </div>
            <div style={{ opacity: 0.72, marginTop: 6 }}>
              Reward sharing: {item.consent?.rewardProgram ? "On" : "Off"} · Evidence images: {item.consent?.evidenceImages ? "On" : "Off"}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 16,
          padding: 18,
          marginBottom: 18,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>Member Health Context</h2>
        <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
          Payer-safe aggregation across clinical-grade spot checks, wearable wellness signals,
          clinical history, reproductive/antenatal visibility, and reward-relevant health evidence.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 10,
            marginTop: 16,
          }}
        >
          <MiniMetric label="Vitals consent" value={consentLabel(healthConsent.vitals)} />
          <MiniMetric label="Wearable insights" value={consentLabel(healthConsent.wearableInsights)} />
          <MiniMetric label="Clinical history" value={consentLabel(healthConsent.clinicalHistory)} />
          <MiniMetric label="Reproductive health" value={consentLabel(healthConsent.reproductiveHealth)} />
          <MiniMetric label="Antenatal" value={consentLabel(healthConsent.antenatal)} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 16,
          }}
        >
          <div
            style={{
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Clinical-grade spot checks
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <MiniMetric label="BP" value={pickDisplay(latestSpotCheck.bp || latestSpotCheck.bloodPressure)} />
              <MiniMetric label="HR" value={pickDisplay(latestSpotCheck.hr || latestSpotCheck.heartRate)} />
              <MiniMetric label="SpO₂" value={pickDisplay(latestSpotCheck.spo2)} />
              <MiniMetric label="Temp" value={pickDisplay(latestSpotCheck.temp || latestSpotCheck.temperature)} />
            </div>

            <div style={{ marginTop: 12, opacity: 0.78, fontSize: 13 }}>
              Abnormal flags: {abnormalFlags.length ? abnormalFlags.join(", ") : "None reported"}
            </div>
            <div style={{ marginTop: 6, opacity: 0.64, fontSize: 12 }}>
              Source coverage: {pickDisplay(vitals.sourceCoverage, "Not configured")}
            </div>
          </div>

          <div
            style={{
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Wearable wellness insights
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              <MiniMetric label="Sleep" value={pickDisplay(wearable.sleepSummary)} />
              <MiniMetric label="Activity" value={pickDisplay(wearable.activitySummary)} />
              <MiniMetric label="RHR / HRV" value={pickDisplay(wearable.rhrHrvSummary)} />
            </div>

            <div style={{ marginTop: 12, opacity: 0.78, fontSize: 13 }}>
              Reward signals: {rewardSignals.length ? rewardSignals.map((x: any) => pickDisplay(x)).join(", ") : "No wearable reward signals yet"}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 16,
          }}
        >
          <div
            style={{
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Clinical history summary
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <MiniMetric label="Allergies" value={countItems(clinicalHistory.allergies)} />
              <MiniMetric label="Conditions" value={countItems(clinicalHistory.conditions)} />
              <MiniMetric label="Vaccinations" value={countItems(clinicalHistory.vaccinations)} />
              <MiniMetric label="Operations" value={countItems(clinicalHistory.operations)} />
            </div>

            <div style={{ marginTop: 12, opacity: 0.72, fontSize: 13 }}>
              Full clinical details remain patient-consent controlled. This payer view exposes summary counts and flags only.
            </div>
          </div>

          <div
            style={{
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Pregnancy / antenatal visibility
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              <MiniMetric label="Pregnancy signal" value={yesNo(reproductiveHealth.pregnancySignalAvailable)} />
              <MiniMetric label="Pregnancy detected" value={yesNo(reproductiveHealth.pregnancyDetected)} />
              <MiniMetric label="Birth record" value={yesNo(antenatal.birthRecordAvailable)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
              <MiniMetric label="EDD" value={antenatal.edd ? fmtDate(antenatal.edd) : "—"} />
              <MiniMetric label="Gestational age" value={pickDisplay(antenatal.gestationalAge)} />
              <MiniMetric label="Trimester" value={pickDisplay(antenatal.trimester)} />
            </div>

            <div style={{ marginTop: 12, opacity: 0.78, fontSize: 13 }}>
              Antenatal risk flags: {antenatalRiskFlags.length ? antenatalRiskFlags.join(", ") : "None reported"}
            </div>
            <div style={{ marginTop: 6, opacity: 0.64, fontSize: 12 }}>
              Pregnancy confidence: {pickDisplay(reproductiveHealth.confidence)} · Updated: {fmtDate(reproductiveHealth.lastUpdated)}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Gym / wellness membership</h2>
          <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
            Partner fitness participation, usage, and activity-linked reward context.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
              marginTop: 16,
            }}
          >
            <MiniMetric label="Gym / partner" value={gym.name || "Not linked"} />
            <MiniMetric label="Membership type" value={gym.membershipType || "—"} />
            <MiniMetric label="Status" value={gym.status || "—"} />
            <MiniMetric label="Check-ins" value={gym.checkInCount ?? 0} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginTop: 10,
            }}
          >
            <MiniMetric label="Calories / session" value={gym.sessionCalories ?? "—"} />
            <MiniMetric label="Distance / session" value={gym.sessionDistanceKm ?? "—"} />
            <MiniMetric label="Avg HR" value={gym.sessionAvgHr ?? "—"} />
            <MiniMetric label="SpO2" value={gym.sessionAvgSpo2 ?? "—"} />
          </div>

          <div
            style={{
              marginTop: 16,
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Latest session context</div>
            <div style={{ opacity: 0.86 }}>
              Last check-in: {gym.lastCheckIn ? fmtDate(gym.lastCheckIn) : "—"}
            </div>
            <div style={{ opacity: 0.72, marginTop: 6 }}>
              Session duration: {gym.lastSessionMinutes ? `${gym.lastSessionMinutes} min` : "—"} · Notes: {gym.notes || "—"}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Reward profile</h2>
          <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
            Reward readiness, funding destination, and cross-benefit redemption posture.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
              marginTop: 16,
            }}
          >
            <MiniMetric label="Reward eligible" value={rewards.eligible ? "Yes" : "No"} />
            <MiniMetric label="Points estimate" value={rewards.pointsEstimate ?? 0} />
            <MiniMetric label="Wallet destination" value={rewards.walletDestination || "Not set"} />
            <MiniMetric label="Tier" value={rewards.tier || "Standard"} />
          </div>

          <div
            style={{
              marginTop: 16,
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Redemption policy</div>
            <div style={{ opacity: 0.86 }}>
              Uses: {Array.isArray(rewards.allowedUses) && rewards.allowedUses.length ? rewards.allowedUses.join(", ") : "Consultations, partner benefits, premium offsets"}
            </div>
            <div style={{ opacity: 0.72, marginTop: 6 }}>
              Sponsor caps: {rewards.monthlyCap ? `${rewards.monthlyCap} / month` : "—"} · Reversal rules: {rewards.reversalPolicy || "Not configured"}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Claims context</h2>
          <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
            Current claim exposure and financial trajectory for this member.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginTop: 16,
            }}
          >
            <MiniMetric label="Claims" value={utilization.claims?.count ?? 0} />
            <MiniMetric label="Submitted" value={money(utilization.claims?.submittedAmountMinor, utilization.claims?.currency || "ZAR")} />
            <MiniMetric label="Approved" value={money(utilization.claims?.approvedAmountMinor, utilization.claims?.currency || "ZAR")} />
            <MiniMetric label="Paid" value={money(utilization.claims?.paidAmountMinor, utilization.claims?.currency || "ZAR")} />
          </div>
        </div>

        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Authorization context</h2>
          <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
            Pending approvals, benefit-control posture, and latest adjudication preview.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginTop: 16,
            }}
          >
            <MiniMetric label="Authorizations" value={utilization.authorizations?.total ?? 0} />
            <MiniMetric label="Pending" value={utilization.authorizations?.pending ?? 0} />
            <MiniMetric label="Approved" value={utilization.authorizations?.approved ?? 0} />
            <MiniMetric label="Denied" value={utilization.authorizations?.denied ?? 0} />
          </div>

          <div
            style={{
              marginTop: 16,
              background: "#0f1730",
              border: "1px solid #1f2a4d",
              borderRadius: 12,
              padding: 14,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Latest preflight / auth posture</div>
            <div style={{ opacity: 0.86 }}>
              Decision: {item.latestPreflight?.decision || "—"} · Auth required: {item.latestPreflight?.authorizationRequired ? "Yes" : "No"}
            </div>
            <div style={{ opacity: 0.72, marginTop: 6 }}>
              Sponsor liability: {money(item.latestPreflight?.sponsorAmountMinor, plan?.currency || "ZAR")} · Member liability: {money((item.latestPreflight?.patientCopayMinor || 0) + (item.latestPreflight?.uncoveredGapMinor || 0), plan?.currency || "ZAR")}
            </div>
            <div style={{ opacity: 0.72, marginTop: 6 }}>
              Reason: {item.latestPreflight?.reason || "—"}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 16,
          padding: 18,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>Recent authorization events</h2>
        <div style={{ marginTop: 8, opacity: 0.82, fontSize: 14 }}>
          Useful for case-management, turnaround review, and benefit-control tracing.
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {recentAuthorizations.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No recent authorization history found.</div>
          ) : (
            recentAuthorizations.map((auth) => (
              <div
                key={auth.id}
                style={{
                  background: "#0f1730",
                  border: "1px solid #1f2a4d",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700 }}>
                    {auth.serviceType || "Authorization"} · {auth.status || "—"}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 13 }}>
                    {auth.createdAt ? new Date(auth.createdAt).toLocaleString() : "—"}
                  </div>
                </div>
                <div style={{ marginTop: 6, opacity: 0.82, fontSize: 13 }}>
                  Requested: {money(auth.requestedAmountMinor, auth.currency || plan?.currency || "ZAR")} · Approved: {money(auth.approvedAmountMinor, auth.currency || plan?.currency || "ZAR")}
                </div>
                <div style={{ marginTop: 6, opacity: 0.68, fontSize: 12 }}>
                  Reason: {auth.decisionReason || "—"} · Expires: {fmtDate(auth.expiresAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#121931",
        border: "1px solid #1f2a4d",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ opacity: 0.7, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#0f1730",
        border: "1px solid #1f2a4d",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.68 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

