import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import CTA from "@/components/CTA";

export const metadata = { title: "CarePort for pharmacies", description: "CarePort helps pharmacies participate in accountable medicine fulfilment through onboarding KYC, SKU management, prescription/order handling" };
const bullets = ['Complete pharmacy onboarding, KYC and relevant licensing/registration checks.',
'Manage medicine catalogue, SKU availability and fulfilment readiness.',
'Receive eligible prescription or order workflows through the CarePort workspace.',
'Prepare medication for dispatch and document handover to authorised delivery workflows.',
'Track fulfilment status, proof-of-delivery and operational exceptions.',
'Review applicable fees, payout rules, settlement timelines and support pathways.'];
export default function Page() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">CarePort pharmacies</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">CarePort for pharmacies</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">CarePort helps pharmacies participate in accountable medicine fulfilment through onboarding KYC, SKU management, prescription/order handling, dispatch readiness, payouts, fees and operational support.</p>
          <Link href="https://careport.ambulantplus.co.za" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">Open CarePort <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="glass-panel rounded-[38px] p-6"><div className="rounded-[30px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-6"><div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Operating guide</div><div className="mt-6 grid gap-4">{bullets.map((item)=><div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-4"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600"/><p className="text-sm leading-7 text-slate-600">{item}</p></div>)}</div></div></div>
      </section>
      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6"><CTA /></div>
    </main>
  );
}
