import Link from "next/link";
import Brand from "@/components/Brand";
import { navLinks, productRoutes } from "@/lib/routes";
import { site } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white/78">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 md:px-6 lg:grid-cols-[1.15fr_0.85fr_0.85fr_0.85fr]">
        <div>
          <Brand />
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">
            Ambulant+ is a connected-care platform for contactless medicine, patient access,
            clinician workflows, programme operations and care-delivery coordination.
          </p>
          <p className="mt-4 text-xs leading-6 text-slate-500">
            Not an emergency service. In a medical emergency, contact local emergency services immediately.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Platform</h3>
          <div className="mt-4 grid gap-3">
            {productRoutes.slice(0, 5).map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-slate-600 hover:text-slate-950">
                {item.title}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Company</h3>
          <div className="mt-4 grid gap-3">
            {navLinks.slice(5).map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-slate-600 hover:text-slate-950">
                {item.label}
              </Link>
            ))}
            <Link href="/contact" className="text-sm text-slate-600 hover:text-slate-950">Contact</Link>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">Legal</h3>
          <div className="mt-4 grid gap-3">
            <Link href="/privacy" className="text-sm text-slate-600 hover:text-slate-950">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-slate-600 hover:text-slate-950">Terms & Conditions</Link>
            <Link href="/clinical-disclaimer" className="text-sm text-slate-600 hover:text-slate-950">Clinical Disclaimer</Link>
            <Link href="/compliance" className="text-sm text-slate-600 hover:text-slate-950">Compliance Statement</Link>
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
