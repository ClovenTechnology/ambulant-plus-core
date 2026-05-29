import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

const devices = [
  {
    title: "Health Monitor",
    body: "Blood pressure, SpO₂, temperature, blood glucose, heart rate and ECG workflows.",
    signal: "Multi-parameter review",
  },
  {
    title: "Digital Stethoscope",
    body: "Heart and lung auscultation capture, playback, review and sharing.",
    signal: "Auscultation context",
  },
  {
    title: "HD Otoscope",
    body: "Ear-imaging capture and review for supported remote assessment workflows.",
    signal: "Clinical image support",
  },
  {
    title: "NexRing",
    body: "Longitudinal signals for sleep, readiness, recovery trends and supported telemetry.",
    signal: "Trend intelligence",
  },
];

export default function DeviceShowcase({ imageSrc = "/visuals/devices/device-ecosystem.webp" }: { imageSrc?: string }) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Defined device ecosystem</div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">Four supported device pathways. No wearable sprawl.</h2>
          <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
            Ambulant+ focuses on a disciplined device scope: Health Monitor, Digital Stethoscope, HD Otoscope and NexRing. Each device maps to a specific care workflow and clinical boundary.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {devices.map((device) => (
              <div key={device.title} className="rounded-3xl border border-white/80 bg-white/78 p-5 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="mt-4 font-semibold text-slate-950">{device.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{device.body}</p>
                <div className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">{device.signal}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-panel rounded-[38px] p-3 md:p-5">
          <div className="relative min-h-[360px] overflow-hidden rounded-[30px] border border-white/70 bg-white md:min-h-[520px]">
            <Image src={imageSrc} alt="Ambulant+ supported connected clinical device ecosystem" fill sizes="(min-width: 1024px) 48vw, 100vw" className="object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}
