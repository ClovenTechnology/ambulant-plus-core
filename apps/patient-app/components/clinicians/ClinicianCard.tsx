// apps/patient-app/components/clinicians/ClinicianCard.tsx
import { Star } from 'lucide-react';
import Link from 'next/link';

export function ClinicianCard({ c, isPremium }: { c: Clinician; isPremium: boolean }) {
  const showBook = isPremium && c.isOnline;
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition">
      <div className="flex items-center gap-4">
        <img src={c.avatarUrl} alt={c.name} className="size-12 rounded-full object-cover" />
        <div>
          <div className="font-semibold">{c.name}</div>
          <div className="text-sm text-white/70">{c.specialty} • {c.location}</div>
          <div className="flex items-center gap-2 text-sm mt-1">
            <Star className="size-4" /><span>{c.rating.toFixed(1)}</span>
            <span className="opacity-60">•</span>
            <span>R{c.price}</span>
            {!c.isOnline && <span className="ml-2 inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-white/10">Offline</span>}
            {c.isOnline && <span className="ml-2 inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Online</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Link href={`/clinicians/${c.id}`} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20">View</Link>
        {showBook && (
          <button
            onClick={() => bookTelevisit(c.id)}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white"
          >Book Tele-visit</button>
        )}
      </div>
    </div>
  );
}
