import SimulationControl from './SimulationControl';

export const dynamic = 'force-dynamic';

export default function AdminSimulationPage() {
  const defaultPatient = {
    id: String(process.env.ADMIN_SIMULATION_PATIENT_ID || process.env.SIMULATION_PATIENT_ID || '').trim(),
    email: String(process.env.ADMIN_SIMULATION_PATIENT_EMAIL || process.env.SIMULATION_PATIENT_EMAIL || '').trim(),
    name: String(process.env.ADMIN_SIMULATION_PATIENT_NAME || process.env.SIMULATION_PATIENT_NAME || '').trim(),
  };
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Governed readiness</p>
          <h1 className="mt-2 text-3xl font-black">Simulation Control</h1>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">Schedule supervised contactless medicine simulations, assign an observer or coach, manage lifecycle events and finalize the private seven-domain readiness assessment.</p>
        </header>
        <SimulationControl defaultPatient={defaultPatient} />
      </div>
    </main>
  );
}
