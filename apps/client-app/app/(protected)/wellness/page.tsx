function metricTone(kind: "good" | "neutral" | "warning") {
  if (kind === "good") {
    return { bg: "#0f2a1f", border: "#14532d", text: "#bbf7d0" };
  }
  if (kind === "warning") {
    return { bg: "#3b2608", border: "#92400e", text: "#fde68a" };
  }
  return { bg: "#0c2238", border: "#1d4ed8", text: "#bfdbfe" };
}

export default function WellnessWorkspacePage() {
  const adherenceTone = metricTone("good");
  const engagementTone = metricTone("neutral");
  const fraudTone = metricTone("warning");

  return (
    <main style={{ padding: 32, maxWidth: 1380 }}>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: 1.5,
            opacity: 0.7,
            textTransform: "uppercase",
          }}
        >
          Ambulant+ Wellness Workspace
        </div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 36 }}>
          Gym & Wellness Operations
        </h1>
        <p style={{ margin: 0, opacity: 0.82, lineHeight: 1.7 }}>
          Sponsor-safe wellness operations surface for gyms and wellness partners:
          member participation, attendance, program milestones, adherence-linked rewards,
          activity verification, and escalation signals.
        </p>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Metric label="Active members in program" value="1,248" />
        <Metric label="Weekly check-ins" value="3,904" />
        <Metric label="Milestones unlocked" value="486" />
        <Metric label="Reward reversals under review" value="12" />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 18,
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Workspace intent</h2>
          <p style={{ marginTop: 0, opacity: 0.84, lineHeight: 1.7 }}>
            This workspace is intentionally different from payer operations.
            Wellness operators should focus on attendance, activity evidence,
            partner milestone completion, sponsor-approved reward triggers,
            and non-clinical engagement interventions.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <Pill label="Attendance verified" tone={engagementTone} />
            <Pill label="Milestone completion sync" tone={engagementTone} />
            <Pill label="Sponsor-safe reward evidence" tone={adherenceTone} />
            <Pill label="Anti-fraud exception queue" tone={fraudTone} />
          </div>
        </div>

        <div
          style={{
            background: "#121931",
            border: "1px solid #1f2a4d",
            borderRadius: 18,
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Recommended next modules</h2>
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <ModuleCard
              title="Attendance feed"
              body="Check-in verification, session completion, and partner-side participation logs."
            />
            <ModuleCard
              title="Reward evidence review"
              body="Program milestone evidence, sponsor scoring inputs, and reversal flags."
            />
            <ModuleCard
              title="Wellness cohorts"
              body="Program engagement trends by sponsor, location, package, and activity stream."
            />
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 18,
          padding: 18,
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Operational posture</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 14,
            marginTop: 14,
          }}
        >
          <InfoPanel
            title="Participation"
            body="Capture check-ins, session attendance, classes, trainer milestones, and partner-linked activity events."
          />
          <InfoPanel
            title="Rewards"
            body="Do not credit rewards blindly. Wellness evidence should remain distinguishable from medication and clinical verification streams."
          />
          <InfoPanel
            title="Access control"
            body="Gyms should not operate payer settlements, provider contracts, or claims adjudication lanes."
          />
        </div>
      </section>

      <section
        style={{
          background: "#121931",
          border: "1px solid #1f2a4d",
          borderRadius: 18,
          padding: 18,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>What this page is for</h2>
        <p style={{ marginTop: 0, opacity: 0.84, lineHeight: 1.7 }}>
          This is the correct landing surface for gyms and wellness operators while the deeper
          wellness modules are being built. It prevents them from landing on payer dashboards
          and reinforces the long-term architecture separation between payer ops and wellness ops.
        </p>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
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

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: { bg: string; border: string; text: string };
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        width: "fit-content",
        padding: "6px 12px",
        borderRadius: 999,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        fontSize: 13,
      }}
    >
      {label}
    </span>
  );
}

function ModuleCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: "#0f1730",
        border: "1px solid #1f2a4d",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 6, opacity: 0.8, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

function InfoPanel({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: "#0f1730",
        border: "1px solid #1f2a4d",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 6, opacity: 0.82, lineHeight: 1.65 }}>{body}</div>
    </div>
  );
}