type BrandProps = {
  compact?: boolean;
  className?: string;
};

export default function Brand({ compact = false, className = "" }: BrandProps) {
  if (compact) {
    return (
      <div className={`flex min-w-0 items-center ${className}`}>
        <img
          src="/brand/ambulant-mark.png"
          alt="Ambulant+"
          className="h-11 w-11 shrink-0 rounded-2xl object-contain"
          loading="eager"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 items-center ${className}`}>
      <img
        src="/brand/ambulant-mark.png"
        alt=""
        aria-hidden="true"
        className="h-11 w-11 shrink-0 rounded-2xl object-contain sm:hidden"
        loading="eager"
        decoding="async"
      />

      <img
        src="/brand/ambulant-logo-full.png"
        alt="Ambulant+ Contactless Medicine"
        className="hidden h-12 w-auto max-w-[220px] object-contain sm:block lg:max-w-[240px]"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}