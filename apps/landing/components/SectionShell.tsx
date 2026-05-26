type SectionShellProps = {
  eyebrow?: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
  className?: string;
};

export default function SectionShell({ eyebrow, title, body, children, className = "" }: SectionShellProps) {
  return (
    <section className={`mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16 ${className}`}>
      <div className="mx-auto max-w-3xl text-center">
        {eyebrow && <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">{eyebrow}</div>}
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">{title}</h2>
        {body && <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">{body}</p>}
      </div>
      {children && <div className="mt-10">{children}</div>}
    </section>
  );
}
