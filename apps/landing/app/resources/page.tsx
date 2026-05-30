import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BriefcaseMedical,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  HeartPulse,
  Pill,
  ShieldCheck,
  Stethoscope,
  Store,
  TestTube2,
  Truck,
  Users,
  Video,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Ambulant+ Resources",
  description:
    "Guides, training pathways, clinical safety notes, device workflow resources and operational knowledge for the Ambulant+ Contactless Medicine ecosystem.",
};

const resourceCollections: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "Patient guides",
    body:
      "Account setup, profile completion, medical-aid readiness, device setup, booking, wallet, reminders, MedReach and CarePort guidance.",
    icon: HeartPulse,
    href: "/patients/getting-started",
  },
  {
    title: "Clinician resources",
    body:
      "Onboarding, Contactless Medicine training, device-supported consultation, documentation, escalation, compliance and workflow readiness.",
    icon: Stethoscope,
    href: "/clinicians/onboarding",
  },
  {
    title: "Device workflow guides",
    body:
      "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows mapped to safe Contactless Medicine use cases.",
    icon: Watch,
    href: "/devices",
  },
  {
    title: "Medical-aid and sponsor resources",
    body:
      "Programme visibility, eligibility, payment preflight, claims, rewards, adherence, remote monitoring and InsightCore use cases.",
    icon: Building2,
    href: "/clients",
  },
  {
    title: "MedReach resources",
    body:
      "Home phlebotomy, specimen collection, laboratory handover, chain-of-custody, result routing and diagnostics operations.",
    icon: TestTube2,
    href: "/medreach",
  },
  {
    title: "CarePort resources",
    body:
      "eRx fulfilment, pharmacy SKU readiness, rider dispatch, patient updates, proof-of-delivery and medicine-continuity operations.",
    icon: Pill,
    href: "/careport",
  },
];

const audienceGuides: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "For patients",
    body:
      "Learn how to prepare your profile, connect supported devices, book consultations and continue care safely.",
    icon: Users,
    href: "/patients",
  },
  {
    title: "For clinicians",
    body:
      "Understand platform onboarding, training, professional boundaries, device-supported review and remote practice readiness.",
    icon: BriefcaseMedical,
    href: "/clinicians",
  },
  {
    title: "For labs",
    body:
      "Review MedReach laboratory onboarding, catalogue setup, specimen acceptance and result-routing workflows.",
    icon: TestTube2,
    href: "/medreach/labs",
  },
  {
    title: "For phlebotomists",
    body:
      "Understand home-draw assignment, patient verification, specimen labelling, custody and earnings visibility.",
    icon: ClipboardCheck,
    href: "/medreach/phlebotomists",
  },
  {
    title: "For pharmacies",
    body:
      "Review CarePort pharmacy onboarding, SKU readiness, prescription handling, handover and payout workflows.",
    icon: Store,
    href: "/careport/pharmacies",
  },
  {
    title: "For riders",
    body:
      "Understand rider verification, handover, route progression, delivery rules, proof-of-delivery and payout visibility.",
    icon: Truck,
    href: "/careport/riders",
  },
];

const learningTracks = [
  {
    title: "Contactless Medicine foundation",
    body:
      "The operating principles behind Ambulant+: remote care supported by devices, diagnostics, fulfilment and governance-aware intelligence.",
  },
  {
    title: "Clinical safety and escalation",
    body:
      "When remote care is appropriate, when urgent care is required, and how clinicians should document device-supported review.",
  },
  {
    title: "Device-supported workflows",
    body:
      "How supported devices fit into the consultation journey without replacing professional clinical judgement.",
  },
  {
    title: "Programme and payer operations",
    body:
      "How medical aids, HMOs, employers and sponsors can use visibility, benefits, rewards and claims pathways responsibly.",
  },
];

const contentRoadmap = [
  "Patient quick-start guide",
  "Clinician onboarding guide",
  "Contactless Medicine compliance training overview",
  "Health Monitor setup guide",
  "Digital Stethoscope workflow guide",
  "HD Otoscope workflow guide",
  "NexRing wellness and fertility-context guide",
  "Medication reminders and camera verification guide",
  "MedReach home phlebotomy guide",
  "CarePort pharmacy fulfilment guide",
  "Medical-aid programme deployment guide",
  "Enterprise demo preparation guide",
];

const governanceNotes = [
  "Resources should support safe use, not encourage self-diagnosis.",
  "Device guides should remain tied to exact supported devices and intended use.",
  "Clinical resources should preserve professional judgement and escalation boundaries.",
  "Payer resources should respect consent, role permissions and appropriate data-sharing limits.",
];

export default function ResourcesPage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Resources
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Knowledge infrastructure for Contactless Medicine.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ resources help patients, clinicians, medical aids, employers, laboratories,
              pharmacies, riders and programme teams understand how to use Contactless Medicine
              safely, operationally and responsibly.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demos"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Request guided walkthrough <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href={`mailto:${site.trainingEmail}`}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Ask about training <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/previews/dashboard-operations-collage-v1.webp"
                alt="Ambulant+ knowledge and operations preview"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Resource library
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Guides, training pathways, workflow notes and governance resources for a full
                  Contactless Medicine ecosystem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Resource collections"
        title="Guidance organised by workflow."
        body="Each resource collection supports a specific operating layer of Ambulant+: patient access, clinician practice, devices, diagnostics, pharmacy fulfilment, payers and governance."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resourceCollections.map(({ title, body, icon: Icon, href }) => (
            <Link
              key={title}
              href={href}
              className="glass-panel rounded-[30px] p-6 transition hover:-translate-y-1"
            >
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </Link>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Audience guides"
        title="Start with the role you play in the ecosystem."
        body="Patients, clinicians, labs, phlebotomists, pharmacies, riders and enterprise partners need different resources."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {audienceGuides.map(({ title, body, icon: Icon, href }) => (
            <Link
              key={title}
              href={href}
              className="rounded-3xl border border-white/80 bg-white/78 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
            >
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </Link>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Learning tracks
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Training should make the platform safer, not just easier to use.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Ambulant+ resources should help every user understand not only what the platform
                can do, but also when to escalate, when not to over-rely on technology, and how to
                preserve clinical accountability.
              </p>
            </div>

            <div className="grid gap-3">
              {learningTracks.map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <BookOpen className="h-5 w-5 text-cyan-200" />
                  <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Publishing roadmap"
        title="The resource library should grow into a serious knowledge base."
        body="These resource categories can be expanded into downloadable guides, onboarding packs, training modules, videos and operational playbooks."
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {contentRoadmap.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-5">
              <FileText className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-[0.95fr_1.05fr] md:px-6 md:py-16">
        <div className="glass-panel rounded-[34px] p-7">
          <GraduationCap className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Training, demos, CPDs and webinars
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            Ambulant+ resources can support structured training for clinicians, programme teams,
            laboratories, pharmacies, riders and enterprise partners. Demo sessions should be tied
            to implementation planning, not superficial product tours.
          </p>
          <Link
            href="/demos"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
          >
            View demos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-panel rounded-[34px] p-7">
          <ShieldCheck className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Governance notes
          </h2>
          <div className="mt-5 grid gap-3">
            {governanceNotes.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}