import Link from "next/link";

export default function CarePortNotFound() {
  return (
    <section data-a4p1="careport-not-found" className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
        CarePort route not found
      </p>
      <h1 className="mt-3 text-3xl font-black text-slate-950">This CarePort page is not available.</h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        The route may have moved or may not be enabled for this workspace yet. Use the overview to return
        to the active pharmacy, rider and admin surfaces.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/overview" className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">
          Open CarePort overview
        </Link>
        <Link href="/" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50">
          Back to CarePort home
        </Link>
      </div>
    </section>
  );
}
