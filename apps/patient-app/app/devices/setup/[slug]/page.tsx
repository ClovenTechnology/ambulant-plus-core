'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BadgeCheck,
  Bluetooth,
  CheckCircle2,
  CircleHelp,
  Cpu,
  Eye,
  HeartPulse,
  Info,
  ShieldCheck,
  Stethoscope,
  Waves,
  Workflow,
} from 'lucide-react';

type DeviceSlug =
  | 'health-monitor'
  | 'digital-stethoscope'
  | 'hd-otoscope'
  | 'nexring';

type DeviceGuide = {
  slug: DeviceSlug;
  id: string;
  name: string;
  vendor: string;
  model: string;
  category: 'iomt' | 'wearable';
  kind: 'vitals' | 'stethoscope' | 'otoscope' | 'ring';
  summary: string;
  launchHref: string;
  consoleHref: string;
  guideBadge: string;
  setupSteps: string[];
  beforeYouBegin: string[];
  troubleshooting: string[];
  safety: string[];
  tips: string[];
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function iconForKind(kind: DeviceGuide['kind']) {
  switch (kind) {
    case 'vitals':
      return Activity;
    case 'stethoscope':
      return Stethoscope;
    case 'otoscope':
      return Eye;
    case 'ring':
      return Waves;
    default:
      return Cpu;
  }
}

function toneForKind(kind: DeviceGuide['kind']) {
  switch (kind) {
    case 'vitals':
      return {
        shell: 'from-rose-500/16 via-pink-500/8 to-white',
        iconWrap: 'border-rose-300/30 bg-rose-500/10',
        icon: 'text-rose-600',
        badge: 'border-rose-200 bg-rose-50 text-rose-700',
      };
    case 'stethoscope':
      return {
        shell: 'from-emerald-500/16 via-teal-500/8 to-white',
        iconWrap: 'border-emerald-300/30 bg-emerald-500/10',
        icon: 'text-emerald-600',
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    case 'otoscope':
      return {
        shell: 'from-cyan-500/16 via-sky-500/8 to-white',
        iconWrap: 'border-cyan-300/30 bg-cyan-500/10',
        icon: 'text-cyan-600',
        badge: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      };
    case 'ring':
      return {
        shell: 'from-violet-500/16 via-indigo-500/8 to-white',
        iconWrap: 'border-violet-300/30 bg-violet-500/10',
        icon: 'text-violet-600',
        badge: 'border-violet-200 bg-violet-50 text-violet-700',
      };
    default:
      return {
        shell: 'from-slate-100 to-white',
        iconWrap: 'border-slate-200 bg-slate-100',
        icon: 'text-slate-700',
        badge: 'border-slate-200 bg-slate-50 text-slate-700',
      };
  }
}

const GUIDES: Record<DeviceSlug, DeviceGuide> = {
  'health-monitor': {
    slug: 'health-monitor',
    id: 'duecare-health-monitor',
    name: 'Health Monitor',
    vendor: 'DueCare',
    model: 'Vitals360',
    category: 'iomt',
    kind: 'vitals',
    summary:
      'Spot-check vitals console for blood pressure, SpO₂, heart rate, temperature, glucose, and ECG.',
    launchHref: '/myCare/devices/health-monitor',
    consoleHref: '/iomt',
    guideBadge: 'Vitals setup guide',
    beforeYouBegin: [
      'Charge the device sufficiently before pairing or testing.',
      'Enable Bluetooth on the patient device and keep the monitor nearby.',
      'Make sure only one active measurement is attempted at a time.',
      'Use the proper workflow for the selected vital to avoid stale or incomplete readings.',
    ],
    setupSteps: [
      'Open the Health Monitor page from Devices or the advanced IoMT console.',
      'Connect the monitor and confirm connected state, battery, and signal indicators.',
      'Select the required vital workflow before pressing Start.',
      'Let the measurement cycle complete naturally unless you need to stop it early.',
      'Review the returned value, waveform, or cycle state before switching to another vital.',
    ],
    troubleshooting: [
      'If blood pressure, SpO₂, or temperature starts but no final result appears, disconnect and reconnect before retesting.',
      'If a measurement hangs, confirm the previous vital actually returned to idle before starting another one.',
      'If live signal appears without a final reading, repeat the workflow with better positioning and a steadier patient state.',
      'If Bluetooth pairing succeeds but values do not decode, use the latest bridge/session files and retest one vital at a time.',
    ],
    safety: [
      'Do not treat one reading in isolation as a clinical diagnosis.',
      'Repeat suspicious or outlier results before acting on them.',
      'Keep the patient still during measurement to reduce artifacts.',
    ],
    tips: [
      'Blood Oxygen and Heart Rate are related workflows and can share the same pulse/PPG capture surface.',
      'ECG is best treated as a focused capture workflow, not a background stream.',
      'For production, keep measurements sequential and explicit.',
    ],
  },
  'digital-stethoscope': {
    slug: 'digital-stethoscope',
    id: 'duecare-digital-stethoscope',
    name: 'Digital Stethoscope',
    vendor: 'DueCare',
    model: 'HC21',
    category: 'iomt',
    kind: 'stethoscope',
    summary:
      'Connect, capture, queue, upload, play back, and export auscultation clips for heart and lung assessment.',
    launchHref: '/myCare/devices/stethoscope',
    consoleHref: '/iomt',
    guideBadge: 'Auscultation guide',
    beforeYouBegin: [
      'Use a quiet environment whenever possible.',
      'Confirm consent and recording readiness before capture.',
      'Ensure the device is seated correctly on the chest site before recording.',
      'Prefer native mobile capture for production-quality audio when available.',
    ],
    setupSteps: [
      'Open the Digital Stethoscope page and connect the device.',
      'Select the correct listening mode and site before recording.',
      'Start capture and monitor live waveform or session state.',
      'Stop capture cleanly, then review playback before export or upload.',
      'Save or upload the clip only after confirming audio quality.',
    ],
    troubleshooting: [
      'If web playback is noisy, test the same workflow on Android native before blaming the device.',
      'If connect works but captured audio sounds distorted, verify transport assumptions and decoder path.',
      'If playback plumbing works but quality is poor, treat web BLE as fallback/debug, not the primary production path.',
      'If clips are saved but metadata is incomplete, inspect the session and upload pipeline before changing UI.',
    ],
    safety: [
      'Do not rely on a poor-quality clip for clinical decisions.',
      'Retake clips if excessive noise, clipping, or poor placement is suspected.',
      'Always review the recording before sharing or escalation.',
    ],
    tips: [
      'Heart and lung modes should stay easy to switch.',
      'A clean quick pane is good for demos, but the full device page remains the authoritative workflow.',
      'Native production capture is the most likely stable end state.',
    ],
  },
  'hd-otoscope': {
    slug: 'hd-otoscope',
    id: 'duecare-hd-otoscope',
    name: 'HD Otoscope',
    vendor: 'DueCare',
    model: 'HD-Pro',
    category: 'iomt',
    kind: 'otoscope',
    summary:
      'Live preview, still capture, and short clip workflow for structured otoscopy imaging.',
    launchHref: '/myCare/devices/otoscope',
    consoleHref: '/iomt',
    guideBadge: 'Imaging guide',
    beforeYouBegin: [
      'Clean the optical tip and confirm the camera feed is available.',
      'Use adequate lighting and a stable hand position.',
      'Confirm capture permissions before starting preview.',
      'Decide whether you need a still image or a short clip before beginning.',
    ],
    setupSteps: [
      'Open the HD Otoscope page and confirm preview feed is live.',
      'Position the camera carefully before any capture action.',
      'Take a still image for quick documentation, or start a short clip for motion review.',
      'Stop recording cleanly and verify the generated media output.',
      'Export or store the final media with structured metadata.',
    ],
    troubleshooting: [
      'If preview is blank, check camera permissions and stream initialization.',
      'If capture works but file output is wrong, inspect recording/export logic rather than the UI shell.',
      'If USB or accessory camera support differs by platform, validate the exact target path before broad changes.',
      'If media is captured but not clinically organized, inspect metadata and persistence rather than recoding preview.',
    ],
    safety: [
      'Do not force placement or angle if the patient is uncomfortable.',
      'Retake low-quality images rather than documenting a poor view.',
      'Use structured naming and metadata to avoid mislabeling images.',
    ],
    tips: [
      'Still capture should be one-tap simple.',
      'Short clips are useful when a still image is not enough.',
      'Preview shell can look futuristic without changing the underlying media path.',
    ],
  },
  nexring: {
    slug: 'nexring',
    id: 'duecare-nexring',
    name: 'NexRing',
    vendor: 'DueCare',
    model: 'PPG/ECG',
    category: 'wearable',
    kind: 'ring',
    summary:
      'Continuous remote monitoring wearable for heart rate, SpO₂ trends, sleep, readiness, and telemetry.',
    launchHref: '/myCare/devices/nexring',
    consoleHref: '/iomt',
    guideBadge: 'Wearable guide',
    beforeYouBegin: [
      'Ensure the ring is charged and worn on the correct finger.',
      'Enable Bluetooth and keep the phone close during pairing.',
      'Use the real normalized session path already implemented for scan, connect, and metric flow.',
      'Confirm persistence wiring is aligned with your existing vitals contracts.',
    ],
    setupSteps: [
      'Open the NexRing page and start a scan.',
      'Select the discovered device and connect.',
      'Allow the session bootstrap to complete, including battery and device info requests.',
      'Monitor normalized metrics and confirm telemetry is updating.',
      'Persist supported values through the clean metric persister path.',
    ],
    troubleshooting: [
      'If pairing succeeds but metrics are sparse, inspect bootstrap commands and notification handling.',
      'If data flows but persistence is missing, wire the session onMetric output into the vitals contract cleanly.',
      'If a ring connects under web transport but misses advanced features, compare with native plugin behavior.',
      'If duplicate metrics appear, inspect bounded history and persistence dedupe rules.',
    ],
    safety: [
      'Treat wearable readings as trend-supporting data, not a sole clinical decision engine.',
      'Confirm abnormal values with dedicated spot-check workflows where needed.',
      'Keep persistence normalized and clearly sourced as wearable telemetry.',
    ],
    tips: [
      'NexRing is best positioned as CRM/RPM rather than a one-off spot-check device.',
      'Keep wearable persistence thin and clean instead of contaminating Health Monitor logic.',
      'Use the dedicated device page for real monitoring and `/iomt` for quick access only.',
    ],
  },
};

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        {icon ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function BulletList({
  items,
  tone = 'slate',
}: {
  items: string[];
  tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';
}) {
  const map: Record<string, string> = {
    slate: 'border-slate-200 bg-slate-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50',
    rose: 'border-rose-200 bg-rose-50',
    cyan: 'border-cyan-200 bg-cyan-50',
    violet: 'border-violet-200 bg-violet-50',
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={`${i}-${item}`}
          className={cx(
            'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 text-slate-700',
            map[tone],
          )}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function DeviceSetupGuidePage() {
  const params = useParams();
  const rawSlug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const slug = (rawSlug || 'health-monitor') as DeviceSlug;

  const guide = GUIDES[slug] ?? GUIDES['health-monitor'];
  const Icon = iconForKind(guide.kind);
  const tone = toneForKind(guide.kind);

  const categoryText = useMemo(
    () => (guide.category === 'wearable' ? 'Wearable setup' : 'IoMT setup'),
    [guide.category],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-4">
        <Link
          href="/devices"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Devices
        </Link>
      </div>

      <section
        className={cx(
          'relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] md:p-7',
          tone.shell,
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cx(
                  'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em]',
                  tone.badge,
                )}
              >
                {guide.guideBadge}
              </span>
              <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                {categoryText}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className={cx('rounded-[22px] border p-3 shadow-sm', tone.iconWrap)}>
                <Icon className={cx('h-6 w-6', tone.icon)} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                  {guide.name}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {guide.vendor} • {guide.model}
                </p>
              </div>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700 md:text-base">
              {guide.summary}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={guide.launchHref}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Launch device
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href={guide.consoleHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Open advanced console
                <Workflow className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Transport</div>
              <div className="mt-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <Bluetooth className="h-4 w-4" />
                Bluetooth
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Launch</div>
              <div className="mt-3 text-base font-semibold text-slate-900">Direct page</div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Mode</div>
              <div className="mt-3 text-base font-semibold text-slate-900">
                {guide.category === 'wearable' ? 'Continuous' : 'Session'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Before you begin"
          subtitle="Check these first so setup goes smoothly."
          icon={<Info className="h-5 w-5" />}
        >
          <BulletList items={guide.beforeYouBegin} tone="slate" />
        </SectionCard>

        <SectionCard
          title="Setup steps"
          subtitle="Recommended order for first-time or repeat setup."
          icon={<ShieldCheck className="h-5 w-5" />}
        >
          <BulletList items={guide.setupSteps} tone="emerald" />
        </SectionCard>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Troubleshooting"
          subtitle="What to check when the workflow does not behave as expected."
          icon={<CircleHelp className="h-5 w-5" />}
        >
          <BulletList items={guide.troubleshooting} tone="amber" />
        </SectionCard>

        <SectionCard
          title="Safety and handling"
          subtitle="Use these rules to keep the workflow reliable and clinically sensible."
          icon={<BadgeCheck className="h-5 w-5" />}
        >
          <BulletList items={guide.safety} tone="rose" />
        </SectionCard>
      </section>

      <section className="mt-4">
        <SectionCard
          title="Practical tips"
          subtitle="Operational guidance based on how these integrations are actually shaped in the app."
          icon={<HeartPulse className="h-5 w-5" />}
        >
          <BulletList
            items={guide.tips}
            tone={guide.kind === 'ring' ? 'violet' : guide.kind === 'otoscope' ? 'cyan' : 'slate'}
          />
        </SectionCard>
      </section>
    </main>
  );
}