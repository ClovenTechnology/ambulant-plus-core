import {
  BriefcaseBusiness,
  Building2,
  GraduationCap,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Presentation,
} from "lucide-react";
import EnquiryForm from "@/components/EnquiryForm";
import { site } from "@/lib/site";

export const metadata = {
  title: "Contact",
  description:
    "Contact Ambulant+ for clinical onboarding, partnerships, demos, training, MedReach, CarePort and enterprise deployment enquiries.",
};

const contactCards = [
  {
    title: "General enquiries",
    body: "General Ambulant+ enquiries, platform questions and routing to the appropriate team.",
    icon: Mail,
    href: `mailto:${site.generalEmail}`,
    label: site.generalEmail,
  },
  {
    title: "Partnerships and enterprise",
    body: "Enterprise deployments, medical-scheme engagement, employer programmes, strategic partnerships and commercial enquiries.",
    icon: BriefcaseBusiness,
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
    title: "Demos",
    body: "Structured walkthroughs for patient care, clinician workflows, MedReach diagnostics, CarePort fulfilment and programme intelligence.",
    icon: Presentation,
    href: `mailto:${site.demoEmail}`,
    label: site.demoEmail,
  },
  {
    title: "Training",
    body: "Clinician onboarding, platform training, device-workflow readiness and operational enablement.",
    icon: GraduationCap,
    href: `mailto:${site.trainingEmail}`,
    label: site.trainingEmail,
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
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Contact
          </div>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            Speak with the Ambulant+ team.
          </h1>

          <p className="mt-6 text-lg leading-9 text-slate-600">
            For clinical onboarding, care-programme deployment, pharmacy fulfilment, laboratory
            operations, employer partnerships, medical-scheme engagement, demos, training,
            international expansion or platform enquiries, send a structured enquiry and we will
            route it to the appropriate team.
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

          <div className="mt-5 rounded-[34px] border border-slate-200 bg-white/80 p-6">
            <h2 className="text-lg font-semibold text-slate-950">Careers and internships</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Ambulant+ product-specific roles can be routed through the Ambulant+ careers inbox.
              Wider Cloven Technology corporate roles, internships and graduate opportunities can
              also be routed through the parent-company channels.
            </p>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-cyan-800">
              <a href={`mailto:${site.careersEmail}`}>{site.careersEmail}</a>
              <a href={`mailto:${site.corporateCareersEmail}`}>
                {site.corporateCareersEmail}
              </a>
              <a href={`mailto:${site.internshipEmail}`}>{site.internshipEmail}</a>
            </div>
          </div>

          <div className="mt-5 rounded-[34px] border border-slate-200 bg-white/80 p-6">
            <h2 className="text-lg font-semibold text-slate-950">
              International expansion and franchise enquiries
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Ambulant+ is built from South Africa for global Contactless Medicine deployment.
              International expansion enquiries can be submitted through the structured enquiry
              form using the franchise / international expansion option.
            </p>
          </div>
        </div>

        <EnquiryForm />
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contactCards.map((item) => {
          const Icon = item.icon;

          return (
            <a
              key={item.title}
              href={item.href}
              className="rounded-3xl border border-white/80 bg-white/78 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-glow"
            >
              <Icon className="h-5 w-5 text-cyan-700" />
              <div className="mt-3 font-semibold text-slate-950">{item.title}</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
              <div className="mt-3 text-sm font-semibold text-cyan-800">{item.label}</div>
            </a>
          );
        })}

        <div className="rounded-3xl border border-white/80 bg-white/78 p-5 shadow-sm">
          <MapPin className="h-5 w-5 text-cyan-700" />
          <div className="mt-3 font-semibold text-slate-950">Operating market</div>
          <div className="mt-1 text-sm leading-7 text-slate-600">
            South Africa, with future supported markets subject to regulatory, clinical,
            operational and partner readiness. Franchise opportunities already open for the United Kindgom, the United States, the Netherlands, Canada, Australia, New Zealand UAE, Qatar, Saudi Arabia, Singapore, Malaysia, and Brazil. For rest of Europe, Asia, Middle and Africa, contact franchise@ambulantplus.com or franchise@cloventechnology.com 
          </div>
        </div>
      </section>
    </main>
  );
}