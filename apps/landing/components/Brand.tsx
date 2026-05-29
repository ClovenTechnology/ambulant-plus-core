import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  className?: string;
};

export default function Brand({ compact = false, className = "" }: BrandProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-100 bg-white shadow-sm">
        <Image
          src="/brand/ambulant-mark.png"
          alt="Ambulant+ mark"
          width={32}
          height={32}
          priority
          unoptimized
          className="h-7 w-7 object-contain"
        />
      </div>

      {!compact && (
        <div className="relative hidden h-10 w-[164px] shrink-0 sm:block">
          <Image
            src="/brand/ambulant-logo-full.png"
            alt="Ambulant+ Contactless Medicine"
            fill
            priority
            unoptimized
            sizes="164px"
            className="object-contain object-left"
          />
        </div>
      )}
    </div>
  );
}
