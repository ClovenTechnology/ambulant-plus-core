import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

type ImageStoryBandProps = { eyebrow?: string; title: string; body?: string; imageSrc: string; imageAlt: string; imageSide?: "left" | "right" | string; imagePosition?: string; points?: string[]; ctaLabel?: string; ctaHref?: string; reverse?: boolean; children?: ReactNode; className?: string; };

function isExternalHref(href: string) { return href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:"); }

export default function ImageStoryBand({ eyebrow, title, body, imageSrc, imageAlt, imageSide = "right", imagePosition = "center", points = [], ctaLabel, ctaHref, reverse, children, className = "" }: ImageStoryBandProps) {
  const resolvedImageFirst = reverse ?? imageSide === "left";
  const imagePanel = <div className="glass-panel rounded-[38px] p-3 md:p-4"><div className="relative min-h-[320px] overflow-hidden rounded-[30px] border border-white/80 bg-slate-950 shadow-2xl md:min-h-[430px]"><img src={imageSrc} alt={imageAlt} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: imagePosition }} loading="lazy" decoding="async" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" /></div></div>;
  const cta = ctaLabel && ctaHref ? (isExternalHref(ctaHref) ? <a href={ctaHref} className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5">{ctaLabel}<ArrowRight className="h-4 w-4" /></a> : <Link href={ctaHref} className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5">{ctaLabel}<ArrowRight className="h-4 w-4" /></Link>) : null;
  const textPanel = <div>{eyebrow && <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">{eyebrow}</div>}<h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">{title}</h2>{body && <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">{body}</p>}{points.length > 0 && <div className="mt-7 grid gap-3">{points.map((point) => <div key={point} className="flex gap-3 rounded-3xl border border-white/70 bg-white/78 p-4 shadow-sm"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><p className="text-sm leading-7 text-slate-600">{point}</p></div>)}</div>}{cta}{children && <div className="mt-7">{children}</div>}</div>;
  return <section className={`mx-auto grid max-w-7xl gap-10 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center ${className}`}>{resolvedImageFirst ? <>{imagePanel}{textPanel}</> : <>{textPanel}{imagePanel}</>}</section>;
}
