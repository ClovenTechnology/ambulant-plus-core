import { Activity, CheckCircle2, RadioTower, ShieldCheck } from "lucide-react";

type Metric = {
  label: string;
  value: string;
};

type Row = {
  title: string;
  body: string;
};

export default function CommandDashboard({ eyebrow, title, body, metrics, rows }: { eyebrow: string; title: string; body: string; metrics: Metric[]; rows: Row[] }) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <div className="overflow-hidden rounded-[38px] border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-100">
              <RadioTower className="h-4 w-4" /> {eyebrow}
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">{title}</h2>
            <p className="mt-5 text-base leading-8 text-slate-300 md:text-lg">{body}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/6 p-4">
                  <div className="text-2xl font-semibold text-white">{metric.value}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {rows.map((row, index) => (
              <div key={row.title} className="rounded-3xl border border-white/10 bg-white/6 p-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-100">
                    {index % 3 === 0 ? <Activity className="h-5 w-5" /> : index % 3 === 1 ? <ShieldCheck className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{row.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{row.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
