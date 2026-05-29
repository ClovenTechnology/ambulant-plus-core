import { Building2, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { site } from "@/lib/site";

export const metadata = {
  title: "Contact",
  description: "Contact Ambulant+ for clinical onboarding, partnerships, MedReach, CarePort and enterprise deployment enquiries.",
};

const contactCards = [
  {
    title: "General and partnerships",
    body: "Enterprise deployments, partnerships, medical-scheme engagement, employer programmes and strategic enquiries.",
    icon: Mail,
    href: `mailto:${site.salesEmail}`,
    label: site.salesEmail,
  },
  {
    title: "Support",
    body: "Patient, clinician, partner and platform-support enquiries.",
    icon: MessageCircle,
    href: `mailto:${site.supportEmail}`,
    label: site.supportEmail,
  },
  {
    title: "Phone",
    body: "Direct contact for appropriate business and operational enquiries.",
    icon: Phone,
    href: site.phoneHref,
    label: site.phone,
  },
];

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
      <section className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Contact</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            Speak with the Ambulant+ team.
          </h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">
            For clinical onboarding, care-programme deployment, pharmacy fulfilment, laboratory operations,
            employer partnerships, medical-scheme engagement or platform enquiries, reach the Ambulant+ team
            through the appropriate channel.
          </p>

          <div className="mt-8 rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-cyan-700 shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{site.parentCompany}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{site.address.full}</p>
                <p className="mt-3 text-xs leading-6 text-slate-500">
                  Owner of Ambulant+, CarePort, MedReach, InsightCore, DueCare and MediRun.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[36px] p-6 md:p-8">
          <div className="grid gap-4">
            {contactCards.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.title} href={item.href} className="rounded-3xl border border-white/80 bg-white/78 p-5 transition hover:-translate-y-0.5 hover:shadow-glow">
                  <Icon className="h-5 w-5 text-cyan-700" />
                  <div className="mt-3 font-semibold text-slate-950">{item.title}</div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                  <div className="mt-3 text-sm font-semibold text-cyan-800">{item.label}</div>
                </a>
              );
            })}

            <div className="rounded-3xl border border-white/80 bg-white/78 p-5">
              <MapPin className="h-5 w-5 text-cyan-700" />
              <div className="mt-3 font-semibold text-slate-950">Operating market</div>
              <div className="mt-1 text-sm leading-7 text-slate-600">
                South Africa, with future supported markets subject to regulatory, clinical and partner readiness.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
