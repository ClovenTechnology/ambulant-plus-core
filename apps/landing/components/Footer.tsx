import Link from "next/link";
import Brand from "@/components/Brand";
import { productRoutes } from "@/lib/routes";
import { site } from "@/lib/site";

const companyLinks = [
  { label: "Platform", href: "/platform" },
  { label: "Use Cases", href: "/use-cases" },
  { label: "Operations", href: "/operations" },
  { label: "Partnerships", href: "/partnerships" },
  { label: "Resources", href: "/resources" },
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
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 md:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <Brand />
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">
            Ambulant+ is the operating layer for contactless medicine, connecting patients,
            clinicians, devices, home diagnostics, pharmacy fulfilment, care logistics and
            programme intelligence through governed digital infrastructure.
          </p>
          <p className="mt-4 text-xs leading-6 text-slate-500">
            Not an emergency service. In a medical emergency, contact local emergency services immediately.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Platform</h3>
          <div className="mt-4 grid gap-3">
            {productRoutes.slice(0, 6).map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-slate-600 hover:text-slate-950">
                {item.title}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Company</h3>
          <div className="mt-4 grid gap-3">
            {companyLinks.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-slate-600 hover:text-slate-950">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Trust</h3>
          <div className="mt-4 grid gap-3">
            {trustLinks.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-slate-600 hover:text-slate-950">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/70 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} {site.legalName}. All rights reserved.</span>
          <span>Built for privacy-aware, clinician-supervised connected care.</span>
        </div>
      </div>
    </footer>
  );
}
