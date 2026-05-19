import Link from 'next/link';
import { ChevronRight, Sparkles, Users } from 'lucide-react';
import type { FamilyStats } from './types';

export default function FamilyHero({
  stats,
  isPremium,
}: {
  stats: FamilyStats;
  isPremium: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/60 bg-white/82 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-7 xl:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.46),rgba(255,255,255,0.08))]" />
      <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700 shadow-sm">
            <Users className="h-4 w-4" />
            Family &amp; Friends
          </div>

          <div className="mt-5">
            <h1 className="max-w-[820px] text-[2.1rem] font-semibold leading-[0.98] tracking-[-0.04em] text-slate-900 sm:text-[2.55rem] md:text-[2.9rem] xl:text-[3.4rem]">
              Coordinate care for the people you support, from one calm shared console.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-500 md:text-base">
              Add spouses, children, parents and trusted friends, then manage appointments,
              reminders, reports and Televisit support with clear consent and family-aware access.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/90 px-3 py-1.5 text-xs font-medium text-cyan-700">
              <Sparkles className="h-3.5 w-3.5" />
              Premium family care orchestration
            </div>
            <div className="text-sm text-slate-500">
              Invite, coordinate and stay in sync without losing individual ownership.
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
          <HeroStatCard label="Care circle" value={stats.total} subtext="People connected" />
          <HeroStatCard label="Active links" value={stats.active} subtext="Ready now" />
          <HeroStatCard label="Pending" value={stats.pending} subtext="Awaiting response" />
        </div>
      </div>

      <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="#family-invite"
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]"
        >
          Add family member
          <ChevronRight className="h-4 w-4" />
        </Link>
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/92 px-5 py-3 text-sm font-medium text-slate-700 shadow-sm"
        >
          {isPremium ? 'Review plan' : 'Upgrade from profile & plan'}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function HeroStatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: number;
  subtext: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/72 bg-white/88 p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{subtext}</div>
    </div>
  );
}