import Link from "next/link";
import Brand from "@/components/Brand";
import { productRoutes } from "@/lib/routes";
import { site } from "@/lib/site";

const careCentreLinks = [
  { label: "Ladies’ Health", href: "/centres/ladies-health" },
  { label: "Paediatric", href: "/centres/paediatric" },
  { label: "Antenatal", href: "/centres/antenatal" },
  { label: "Gentlemen’s Health", href: "/centres/gentlemens-health" },
];

const operationsLinks = [
  { label: "MedReach", href: "/medreach" },
  { label: "Labs", href: "/medreach/labs" },
  { label: "Phlebotomists", href: "/medreach/phlebotomists" },
  { label: "CarePort", href: "/careport" },
  { label: "Pharmacies", href: "/careport/pharmacies" },
  { label: "Riders", href: "/careport/riders" },
  { label: "Bookings", href: "/bookings" },
  { label: "Demos", href: "/demos" },
];

const companyLinks = [
  { label: "Platform", href: "/platform" },
  { label: "Features", href: "/features" },
  { label: "Innovation", href: "/innovation" },
  { label: "Research & Development", href: "/research-and-development" },
  { label: "Ecosystem", href: "/ecosystem" },
  { label: "Use Cases", href: "/use-cases" },
  { label: "Operations", href: "/operations" },
  { label: "Partnerships", href: "/partnerships" },
  { label: "Resources", href: "/resources" },
  { label: "Find a Doctor", href: "/resources/find-a-doctor-and-book-appointment" },
  { label: "Health Monitor Setup", href: "/resources/health-monitor-setup" },
  { label: "Digital Stethoscope Workflow", href: "/resources/digital-stethoscope-workflow" },
  { label: "HD Otoscope Guide", href: "/resources/hd-otoscope-workflow" },
  { label: "NexRing Setup", href: "/resources/nexring-setup" },
  { label: "Medical Aid Deployment Guide", href: "/resources/medical-aid-deployment-guide" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

const trustLinks = [
  { label: "Security", href: "/security" },
  { label: "Compliance", href: "/compliance" },
  { label: "Clinical Disclaimer", href: "/clinical-disclaimer" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "FAQ", href: "/faq" },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white/78">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 md:px-6 lg:grid-cols-[1.25fr_0.7fr_0.75fr_0.85fr_0.85fr_0.75fr]">
        <div>
          <Brand />

          <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">
            Ambulant+ is a governed Contactless Medicine ecosystem by{" "}
            {site.parentCompany}, connecting patients, clinicians,
            connected-device workflows, MedReach diagnostics, CarePort pharmacy
            fulfilment and InsightCore programme intelligence.
          </p>

          <div className="mt-4 grid gap-1 text-xs leading-6 text-slate-500">
            <span>{site.parentCompany}</span>
            <span>{site.address.short}</span>

            <a href={site.phoneHref} className="hover:text-slate-900">
              {site.phone}
            </a>

            <a
              href={`mailto:${site.generalEmail}`}
              className="hover:text-slate-900"
            >
              {site.generalEmail}
            </a>

            <a
              href={`mailto:${site.supportEmail}`}
              className="hover:text-slate-900"
            >
              {site.supportEmail}
            </a>
          </div>

          <p className="mt-4 text-xs leading-6 text-slate-500">
            Not an emergency service. In a medical emergency, contact local
            emergency services immediately.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Platform</h3>
          <div className="mt-4 grid gap-3">
            <Link
              href="/features"
              className="text-sm text-slate-600 hover:text-slate-950"
            >
              Features
            </Link>

            {productRoutes.slice(0, 6).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-slate-600 hover:text-slate-950"
              >
                {item.title}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Care Centres</h3>
          <div className="mt-4 grid gap-3">
            {careCentreLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-slate-600 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Operations</h3>
          <div className="mt-4 grid gap-3">
            {operationsLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-slate-600 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Company</h3>
          <div className="mt-4 grid gap-3">
            {companyLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-slate-600 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}

            <a
              href={`mailto:${site.careersEmail}`}
              className="text-sm text-slate-600 hover:text-slate-950"
            >
              Careers
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Trust</h3>
          <div className="mt-4 grid gap-3">
            {trustLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-slate-600 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/70 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {site.legalName}. All rights
            reserved. A {site.parentCompany} platform.
          </span>

          <span>
            Built for governed connected care, clinical accountability and
            precision healthcare operations.
          </span>
        </div>
      </div>
    </footer>
  );
}