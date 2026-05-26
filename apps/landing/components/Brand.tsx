import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  className?: string;
};

export default function Brand({ compact = false, className = "" }: BrandProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-100 bg-white shadow-sm">
        <Image
          src="/brand/ambulant-mark.png"
          alt="Ambulant+ mark"
          width={30}
          height={30}
          priority
          className="h-7 w-7 object-contain"
        />
      </div>
      {!compact && (
        <Image
          src="/brand/ambulant-logo-full.png"
          alt="Ambulant+ Contactless Medicine"
          width={180}
          height={54}
          priority
          className="h-9 w-auto object-contain"
        />
      )}
    </div>
  );
}
