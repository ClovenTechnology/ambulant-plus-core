import { Mail, MapPin, MessageCircle } from "lucide-react";
import { site } from "@/lib/site";

export const metadata = {
  title: "Contact",
  description: "Contact Ambulant+ for partnerships, clinical onboarding, diagnostics operations, pharmacy fulfilment and platform enquiries.",
};

const enquiryTypes = [
  "Clinical onboarding",
  "MedReach diagnostics operations",
  "CarePort pharmacy fulfilment",
  "Employer, scheme or sponsor programmes",
  "Platform partnerships and deployments",
  "General support and enquiries",
];

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Contact</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Speak with the Ambulant+ team.</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">
            For clinical onboarding, care-programme deployment, pharmacy fulfilment, laboratory operations, employer partnerships, medical-scheme engagement or platform enquiries, reach the Ambulant+ team through the appropriate channel.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {enquiryTypes.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[36px] p-6 md:p-8">
          <div className="grid gap-4">
            <a href={`mailto:${site.salesEmail}`} className="rounded-3xl border border-white/80 bg-white/78 p-5">
              <Mail className="h-5 w-5 text-cyan-700" />
              <div className="mt-3 font-semibold text-slate-950">Partnerships and deployments</div>
              <div className="mt-1 text-sm text-slate-600">{site.salesEmail}</div>
            </a>
            <a href={`mailto:${site.supportEmail}`} className="rounded-3xl border border-white/80 bg-white/78 p-5">
              <MessageCircle className="h-5 w-5 text-cyan-700" />
              <div className="mt-3 font-semibold text-slate-950">Support</div>
              <div className="mt-1 text-sm text-slate-600">{site.supportEmail}</div>
            </a>
            <div className="rounded-3xl border border-white/80 bg-white/78 p-5">
              <MapPin className="h-5 w-5 text-cyan-700" />
              <div className="mt-3 font-semibold text-slate-950">Operating market</div>
              <div className="mt-1 text-sm text-slate-600">South Africa, with future supported markets subject to regulatory, operational and partner readiness.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
