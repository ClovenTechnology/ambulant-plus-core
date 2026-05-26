import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ProductCardProps = {
  title: string;
  summary: string;
  href: string;
  icon: LucideIcon;
};

export default function ProductCard({ title, summary, href, icon: Icon }: ProductCardProps) {
  return (
    <Link href={href} className="group glass-panel block rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-700">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-700" />
      </div>
      <h3 className="mt-6 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{summary}</p>
    </Link>
  );
}
