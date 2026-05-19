import Link from 'next/link';

export default function EvaluationPage() {
  const items = [
    { href: '/evaluation/models', title: 'Model scorecards' },
    { href: '/evaluation/families', title: 'Family scorecards' },
    { href: '/evaluation/runtime-drift', title: 'Runtime drift' },
    { href: '/evaluation/baseline-drift', title: 'Baseline drift' },
    { href: '/evaluation/research', title: 'Research scorecards' },
    { href: '/evaluation/execution', title: 'Execution quality' },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">InsightCore Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Evaluation</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Review model, family, runtime, baseline, research and execution scorecards.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[24px] border border-white/10 bg-white/5 p-5"
            >
              <div className="text-lg font-semibold">{item.title}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}