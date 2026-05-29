import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

type HeroAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "ghost" | string;
  external?: boolean;
};

type StatusItem = {
  label: string;
  value?: string;
  body?: string;
};

type OverlayItem = {
  label: string;
  value?: string;
  body?: string;
};

type VisualHeroProps = {
  eyebrow: string;
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  imagePosition?: "left" | "right" | string;
  actions?: HeroAction[];
  statusItems?: StatusItem[];
  primaryCta?: HeroAction;
  secondaryCta?: HeroAction;
  overlayTitle?: string;
  overlayItems?: OverlayItem[];
  children?: ReactNode;
  className?: string;
};

function isExternalHref(href: string) {
  return href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:");
}

function ActionButton({ action }: { action: HeroAction }) {
  const isPrimary = !action.variant || action.variant === "primary";

  const className = isPrimary
    ? "focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
    : "focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800 transition hover:-translate-y-0.5";

  if (action.external || isExternalHref(action.href)) {
    return (
      <a href={action.href} className={className}>
        {action.label}
        <ArrowRight className="h-4 w-4" />
      </a>
    );
  }

  return (
    <Link href={action.href} className={className}>
      {action.label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export default function VisualHero({
  eyebrow,
  title,
  body,
  imageSrc,
  imageAlt,
  imagePosition = "right",
  actions,
  statusItems,
  primaryCta,
  secondaryCta,
  overlayTitle,
  overlayItems,
  children,
  className = "",
}: VisualHeroProps) {
  const resolvedActions = actions ?? ([primaryCta, secondaryCta].filter(Boolean) as HeroAction[]);
  const resolvedStatusItems = overlayItems ?? statusItems ?? [];

  const imagePanel = (
    <div className="glass-panel rounded-[42px] p-3 md:p-4">
      <div className="relative min-h-[360px] overflow-hidden rounded-[34px] border border-white/80 bg-slate-950 shadow-2xl md:min-h-[460px]">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          style={{ objectPosition: imagePosition === "left" || imagePosition === "right" ? "center" : imagePosition }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />

        {resolvedStatusItems.length > 0 && (
          <div className="absolute inset-x-4 bottom-4">
            {overlayTitle && (
              <div className="mb-3 inline-flex rounded-full border border-white/20 bg-slate-950/60 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100 backdrop-blur-xl">
                {overlayTitle}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {resolvedStatusItems.map((item) => (
                <div
                  key={`${item.label}-${item.value ?? item.body ?? ""}`}
                  className="rounded-3xl border border-white/20 bg-white/90 p-4 shadow-xl backdrop-blur-xl"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">
                        {item.label}
                      </div>
                      {item.value && (
                        <div className="mt-1 text-sm font-semibold text-slate-950">{item.value}</div>
                      )}
                      {item.body && (
                        <div className="mt-1 text-sm leading-6 text-slate-600">{item.body}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const textPanel = (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">{eyebrow}</div>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
        {title}
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">{body}</p>

      {resolvedActions.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-3">
          {resolvedActions.map((action) => (
            <ActionButton key={`${action.label}-${action.href}`} action={action} />
          ))}
        </div>
      )}

      {children && <div className="mt-8">{children}</div>}
    </div>
  );

  return (
    <section
      className={`mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.95fr] lg:items-center ${className}`}
    >
      {imagePosition === "left" ? (
        <>
          {imagePanel}
          {textPanel}
        </>
      ) : (
        <>
          {textPanel}
          {imagePanel}
        </>
      )}
    </section>
  );
}