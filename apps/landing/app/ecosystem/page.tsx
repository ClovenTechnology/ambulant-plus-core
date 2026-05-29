import { Building2, CheckCircle2 } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Cloven Technology Impilo Ecosystem",
  description: "The relationship between Cloven Technology Impilo, Ambulant+, CarePort, MedReach, InsightCore, DueCare and MediRun.",
};

export default function EcosystemPage() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-4 py-14 md:px-6 md:py-20">
        <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Ecosystem</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
          One parent company. Multiple healthcare technology lines.
        </h1>
        <p className="mt-6 text-lg leading-9 text-slate-600">
          {site.parentCompany} owns Ambulant+, CarePort, MedReach, InsightCore, DueCare and MediRun. Ambulant+ is the Contactless Medicine ecosystem; DueCare is the broader IoMT device portfolio; MediRun is a separate Hospital Management System.
        </p>
      </section>

      <SectionShell
        eyebrow="Brand architecture"
        title="Clear separation prevents product confusion."
        body="The ecosystem is connected by ownership and health-technology strategy, but each product has a distinct role and operating boundary."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {site.brandFamily.map((item) => (
            <div key={item.name} className="glass-panel rounded-[30px] p-6">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-950">{item.name}</h3>
              <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">{item.role}</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.summary}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] border border-emerald-200 bg-emerald-50 p-6 md:p-10">
          <div className="grid gap-3">
            {["CarePort, MedReach and InsightCore are part of the Ambulant+ Contactless Medicine operating model.", "DueCare covers the broader range of IoMT devices beyond the devices integrated into Ambulant+.", "MediRun is a Hospital Management System and should not be presented as part of Ambulant+."] .map((item) => (
              <div key={item} className="flex gap-3 rounded-3xl border border-emerald-200 bg-white/80 p-5">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6"><CTA /></div>
    </main>
  );
}
