import { ShieldCheck } from "lucide-react";

export default function ComplianceBadge({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[26px] border border-white/70 bg-white/78 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
        </div>
      </div>
    </div>
  );
}
