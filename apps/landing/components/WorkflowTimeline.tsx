import { CheckCircle2 } from "lucide-react";

type Step = {
  title: string;
  body: string;
};

export default function WorkflowTimeline({ eyebrow, title, body, steps }: { eyebrow: string; title: string; body?: string; steps: Step[] }) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">{eyebrow}</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">{title}</h2>
        {body && <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">{body}</p>}
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="glass-panel rounded-[30px] p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-white">{index + 1}</div>
              <CheckCircle2 className="h-5 w-5 text-cyan-700" />
            </div>
            <h3 className="mt-6 text-xl font-semibold text-slate-950">{step.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
