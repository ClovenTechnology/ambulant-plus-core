'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  AudioLines,
  BadgeCheck,
  Bluetooth,
  Cpu,
  Eye,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  Waves,
} from 'lucide-react';

type DeviceItem = {
  id: string;
  slug: string;
  vendor: string;
  name: string;
  model: string;
  category: 'iomt' | 'wearable';
  kind: 'vitals' | 'stethoscope' | 'otoscope' | 'ring';
  summary: string;
  href: string;
  status: 'supported';
  capabilities: string[];
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function iconForKind(kind: DeviceItem['kind']) {
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

function accentForKind(kind: DeviceItem['kind']) {
  switch (kind) {
    case 'vitals':
      return {
        shell:
          'from-rose-500/18 via-pink-500/8 to-white',
        iconWrap:
          'border-rose-300/30 bg-rose-500/10',
        icon:
          'text-rose-600',
        chip:
          'border-rose-200 bg-rose-50 text-rose-700',
      };
    case 'stethoscope':
      return {
        shell:
          'from-emerald-500/18 via-teal-500/8 to-white',
        iconWrap:
          'border-emerald-300/30 bg-emerald-500/10',
        icon:
          'text-emerald-600',
        chip:
          'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    case 'otoscope':
      return {
        shell:
          'from-cyan-500/18 via-sky-500/8 to-white',
        iconWrap:
          'border-cyan-300/30 bg-cyan-500/10',
        icon:
          'text-cyan-600',
        chip:
          'border-cyan-200 bg-cyan-50 text-cyan-700',
      };
    case 'ring':
      return {
        shell:
          'from-violet-500/18 via-indigo-500/8 to-white',
        iconWrap:
          'border-violet-300/30 bg-violet-500/10',
        icon:
          'text-violet-600',
        chip:
          'border-violet-200 bg-violet-50 text-violet-700',
      };
    default:
      return {
        shell: 'from-slate-100 to-white',
        iconWrap: 'border-slate-200 bg-slate-100',
        icon: 'text-slate-700',
        chip: 'border-slate-200 bg-slate-50 text-slate-700',
      };
  }
}

function audienceLabel(category: DeviceItem['category']) {
  return category === 'wearable' ? 'Wearable' : 'IoMT';
}

function capabilityLead(kind: DeviceItem['kind']) {
  switch (kind) {
    case 'vitals':
      return 'Vitals suite';
    case 'stethoscope':
      return 'Audio diagnostics';
    case 'otoscope':
      return 'Imaging workflow';
    case 'ring':
      return 'Continuous monitoring';
    default:
      return 'Clinical device';
  }
}

export default function MyDevicesPage() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch('/api/devices/list', { cache: 'no-store' });
        const data = await res.json().catch(() => ({ devices: [] }));

        if (!mounted) return;
        setDevices(Array.isArray(data.devices) ? data.devices : []);
      } catch {
        if (!mounted) return;
        setDevices([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const counts = useMemo(() => {
    const iomt = devices.filter((d) => d.category === 'iomt').length;
    const wearable = devices.filter((d) => d.category === 'wearable').length;
    return { total: devices.length, iomt, wearable };
  }, [devices]);

  return (
    <main data-p-ui="patient-devices-page" className="min-w-0 overflow-x-clip mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] md:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_26%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="relative grid gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100 backdrop-blur">
              <BadgeCheck className="h-3.5 w-3.5" />
              Supported device ecosystem
            </div>

            <h1 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-white md:text-4xl">
              Connect, launch, and manage your four supported Ambulant+ care devices.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              This is the clean patient-facing device hub. Open each device directly, or use setup guides
              when pairing, permissions, or first-time onboarding is needed.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/iomt"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition hover:-translate-y-0.5"
              >
                Open IoMT Console
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/devices/setup/health-monitor"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15"
              >
                Setup guides
                <ShieldCheck className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-300">Total</div>
              <div className="mt-3 text-3xl font-semibold">{counts.total}</div>
              <div className="mt-1 text-xs text-slate-300">Integrated devices</div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-300">IoMT</div>
              <div className="mt-3 text-3xl font-semibold">{counts.iomt}</div>
              <div className="mt-1 text-xs text-slate-300">Clinical instruments</div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-300">Wearable</div>
              <div className="mt-3 text-3xl font-semibold">{counts.wearable}</div>
              <div className="mt-1 text-xs text-slate-300">Continuous monitoring</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
              Supported devices
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Only production-tracked devices are shown here.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
            <Bluetooth className="h-3.5 w-3.5" />
            Setup-first, launch-ready surface
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[320px] animate-pulse rounded-[28px] border border-slate-200 bg-slate-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {devices.map((device) => {
              const Icon = iconForKind(device.kind);
              const tone = accentForKind(device.kind);

              return (
                <article
                  key={device.id}
                  className={cx(
                    'group relative overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br p-5 shadow-sm transition duration-300',
                    'hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)]',
                    tone.shell,
                  )}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.52),transparent_28%)]" />
                  <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:22px_22px]" />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className={cx('rounded-[22px] border p-3 shadow-sm', tone.iconWrap)}>
                      <Icon className={cx('h-5 w-5', tone.icon)} />
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={cx('rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', tone.chip)}>
                        {audienceLabel(device.category)}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        {device.status}
                      </span>
                    </div>
                  </div>

                  <div className="relative mt-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      {device.vendor}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                      {device.name}
                    </h3>
                    <div className="mt-1 text-sm text-slate-500">{device.model}</div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{device.summary}</p>
                  </div>

                  <div className="relative mt-5">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      {capabilityLead(device.kind)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {device.capabilities.slice(0, 4).map((cap) => (
                        <span
                          key={cap}
                          className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] text-slate-700 backdrop-blur"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="relative mt-6 grid grid-cols-2 gap-2">
                    <Link
                      href={device.href}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>

                    <Link
                      href={`/devices/setup/${device.slug}`}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/85 px-3 py-2.5 text-sm font-medium text-slate-700 backdrop-blur transition hover:bg-white"
                    >
                      Setup
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Cpu className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900">
                Where `/iomt` now fits
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Keep it as the advanced quick console, not the primary hub.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Your existing <code>/iomt</code> page is still useful for fast switching between integrated device panes
              like Health Monitor, Stethoscope, Otoscope, and NexRing.
            </p>
            <p>
              That makes it ideal for power users, technical testing, demos, support, and clinician-style quick access,
              while <code>/devices</code> stays clean and patient-friendly.
            </p>
          </div>

          <div className="mt-4">
            <Link
              href="/iomt"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
            >
              Open IoMT Console
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <HeartPulse className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900">
                Recommended next route
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Add per-device setup pages and general user guides.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              href="/devices/setup/health-monitor"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
            >
              Health Monitor guide
            </Link>
            <Link
              href="/devices/setup/digital-stethoscope"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
            >
              Stethoscope guide
            </Link>
            <Link
              href="/devices/setup/hd-otoscope"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
            >
              Otoscope guide
            </Link>
            <Link
              href="/devices/setup/nexring"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
            >
              NexRing guide
            </Link>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <AudioLines className="h-3.5 w-3.5" />
            General guide + per-device guide is the right final shape
          </div>
        </div>
      </section>
    </main>
  );
}