type BrandProps = {
  compact?: boolean;
  className?: string;
};

export default function Brand({ compact = false, className = "" }: BrandProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-100 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-sm font-black tracking-tight text-cyan-100 shadow-sm">
        A+
      </div>

      {!compact && (
        <div className="hidden min-w-0 leading-none sm:block">
          <div className="whitespace-nowrap text-[1.35rem] font-black tracking-[-0.05em] text-slate-950">
            Ambulant<span className="text-cyan-600">+</span>
          </div>
          <div className="mt-0.5 whitespace-nowrap text-[0.72rem] font-semibold tracking-[-0.02em] text-slate-600">
            Contactless Medicine
          </div>
        </div>
      )}
    </div>
  );
}
