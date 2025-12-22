/* apps/clinician-app/app/workspaces/physio/_components/BodyMap3D.tsx */
'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { BodyView, RegionDef } from './types';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function viewCamera(view: BodyView) {
  // tuned for a “premium product” framing
  if (view === 'back') return { pos: [0, 0.55, -2.4] as const, target: [0, 0.55, 0] as const };
  if (view === 'left') return { pos: [-2.2, 0.55, 0.0] as const, target: [0, 0.55, 0] as const };
  if (view === 'right') return { pos: [2.2, 0.55, 0.0] as const, target: [0, 0.55, 0] as const };
  return { pos: [0, 0.55, 2.4] as const, target: [0, 0.55, 0] as const };
}

function StatPill(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-full border bg-white px-2.5 py-1 text-[11px] text-gray-700 shadow-sm">
      <span className="text-gray-500">{props.label}:</span> <span className="font-mono font-semibold">{props.value}</span>
    </div>
  );
}

function HotspotDot(props: {
  active?: boolean;
  tone?: 'blue' | 'red' | 'slate';
  onClick?: () => void;
}) {
  const { active, tone } = props;
  const cls =
    tone === 'red'
      ? 'bg-rose-600 text-white'
      : tone === 'blue'
      ? 'bg-blue-600 text-white'
      : 'bg-slate-700 text-white';
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        'w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold shadow ' +
        cls +
        ' ' +
        (active ? 'ring-4 ring-blue-200' : 'ring-2 ring-white/70')
      }
      title="Select region"
    >
      •
    </button>
  );
}

function StylizedBody(props: { view: BodyView }) {
  // Clean “tech silhouette” body: intentionally simple but premium looking.
  // Swappable later with a GLB segmented model (same coordinate system).
  const mat = useMemo(
    () => ({
      color: '#e5e7eb',
      roughness: 0.45,
      metalness: 0.05,
    }),
    []
  );

  const facing = props.view === 'back' ? -1 : 1;

  return (
    <group rotation={[0, 0, 0]} scale={1}>
      {/* head */}
      <mesh position={[0, 1.58, 0.05 * facing]}>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* torso */}
      <mesh position={[0, 1.02, 0]}>
        <capsuleGeometry args={[0.32, 0.62, 10, 24]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* pelvis */}
      <mesh position={[0, 0.62, 0]}>
        <capsuleGeometry args={[0.26, 0.25, 10, 24]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* left arm */}
      <mesh position={[-0.55, 1.04, 0]} rotation={[0, 0, 0.35]}>
        <capsuleGeometry args={[0.12, 0.62, 10, 24]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* right arm */}
      <mesh position={[0.55, 1.04, 0]} rotation={[0, 0, -0.35]}>
        <capsuleGeometry args={[0.12, 0.62, 10, 24]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* left leg */}
      <mesh position={[-0.20, 0.05, 0]} rotation={[0, 0, 0.05]}>
        <capsuleGeometry args={[0.14, 0.95, 10, 24]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* right leg */}
      <mesh position={[0.20, 0.05, 0]} rotation={[0, 0, -0.05]}>
        <capsuleGeometry args={[0.14, 0.95, 10, 24]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* subtle “muscle map” lines (dashboard aesthetic) */}
      <mesh position={[0, 1.02, 0.012 * facing]}>
        <planeGeometry args={[0.75, 1.2]} />
        <meshStandardMaterial color="#0f172a" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

export default function BodyMap3D(props: {
  view: BodyView;
  regions: RegionDef[];
  selectedRegionId: string;
  counts: Map<string, number>;
  latestPainByRegion: Map<string, number>;
  onSelect: (id: string) => void;
}) {
  const { view, regions, selectedRegionId, counts, latestPainByRegion, onSelect } = props;

  const cam = viewCamera(view);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const hotRegions = useMemo(
    () =>
      regions
        .filter((r) => r.views.includes(view))
        .filter((r) => r.hotspot?.[view]?.pos),
    [regions, view]
  );

  const selected = regions.find((r) => r.id === selectedRegionId);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* header like the screenshot, but light */}
      <div className="border-b px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Interactive 3D Map</div>
          <div className="text-xs text-gray-500">Drag to rotate · Click markers to select a region</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatPill label="Regions" value={hotRegions.length} />
          <StatPill label="Selected" value={selected?.label ?? '—'} />
        </div>
      </div>

      <div className="relative bg-gradient-to-b from-slate-50 to-white">
        {/* top “dashboard pills” inspired by your screenshot */}
        <div className="absolute z-10 left-3 top-3 right-3 flex flex-wrap gap-2">
          <div className="rounded-xl border bg-white/90 backdrop-blur px-3 py-2 shadow-sm">
            <div className="text-[11px] text-gray-500">View</div>
            <div className="text-sm font-semibold text-gray-900">{view.toUpperCase()}</div>
          </div>

          <div className="rounded-xl border bg-white/90 backdrop-blur px-3 py-2 shadow-sm">
            <div className="text-[11px] text-gray-500">Findings</div>
            <div className="text-sm font-semibold text-gray-900">{counts.get(selectedRegionId) ?? 0}</div>
          </div>

          <div className="rounded-xl border bg-white/90 backdrop-blur px-3 py-2 shadow-sm">
            <div className="text-[11px] text-gray-500">Pain (latest)</div>
            <div className="text-sm font-semibold text-gray-900">
              {typeof latestPainByRegion.get(selectedRegionId) === 'number' ? latestPainByRegion.get(selectedRegionId) : '—'}
            </div>
          </div>
        </div>

        <div className="h-[320px]">
          <Canvas
            camera={{ position: cam.pos as any, fov: 38, near: 0.1, far: 100 }}
            dpr={[1, 2]}
          >
            <ambientLight intensity={0.7} />
            <directionalLight position={[3, 4, 3]} intensity={0.85} />
            <directionalLight position={[-3, 2, -2]} intensity={0.35} />

            {/* “floor glow” */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]}>
              <planeGeometry args={[10, 10]} />
              <meshStandardMaterial color="#ffffff" roughness={0.95} metalness={0} />
            </mesh>

            {/* body */}
            <group position={[0, -0.15, 0]}>
              <StylizedBody view={view} />

              {/* hotspots + callouts */}
              {hotRegions.map((r) => {
                const hs = r.hotspot?.[view]!;
                const pain = latestPainByRegion.get(r.id);
                const c = counts.get(r.id) ?? 0;
                const active = r.id === selectedRegionId;

                // tone inspired by screenshot (red/blue badges), but based on pain presence
                const tone =
                  typeof pain === 'number' && pain >= 7 ? 'red' : typeof pain === 'number' ? 'blue' : 'slate';

                return (
                  <group key={r.id}>
                    <mesh
                      position={hs.pos}
                      onPointerOver={() => setHoverId(r.id)}
                      onPointerOut={() => setHoverId((cur) => (cur === r.id ? null : cur))}
                      onClick={() => onSelect(r.id)}
                    >
                      <sphereGeometry args={[0.06, 24, 24]} />
                      <meshStandardMaterial
                        color={tone === 'red' ? '#e11d48' : tone === 'blue' ? '#2563eb' : '#334155'}
                        emissive={active ? '#60a5fa' : '#000000'}
                        emissiveIntensity={active ? 0.25 : 0}
                        roughness={0.35}
                        metalness={0.15}
                      />
                    </mesh>

                    {/* badge */}
                    <Html position={hs.labelPos ?? hs.pos} center>
                      <div
                        className={
                          'pointer-events-auto flex items-center gap-2 rounded-full border bg-white px-2.5 py-1 shadow-sm ' +
                          (active ? 'border-blue-200 ring-4 ring-blue-100' : 'border-gray-200')
                        }
                        onMouseEnter={() => setHoverId(r.id)}
                        onMouseLeave={() => setHoverId((cur) => (cur === r.id ? null : cur))}
                      >
                        <HotspotDot active={active} tone={tone} onClick={() => onSelect(r.id)} />
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-gray-900 leading-tight truncate max-w-[140px]">
                            {r.label}
                          </div>
                          <div className="text-[10px] text-gray-500 leading-tight">
                            {typeof pain === 'number' ? `Pain ${pain}/10` : 'No pain'} · {c} finding{c === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                    </Html>

                    {/* hover tooltip (extra detail) */}
                    {hoverId === r.id ? (
                      <Html position={[hs.pos[0], hs.pos[1] + 0.14, hs.pos[2]]} center>
                        <div className="rounded-lg border bg-white px-3 py-2 shadow text-[11px] text-gray-700">
                          <div className="font-semibold text-gray-900">{r.label}</div>
                          <div className="mt-1">
                            Findings: <span className="font-mono">{c}</span>
                            {typeof pain === 'number' ? (
                              <>
                                {' '}
                                · Pain: <span className="font-mono font-semibold">{pain}</span>/10
                              </>
                            ) : null}
                          </div>
                        </div>
                      </Html>
                    ) : null}
                  </group>
                );
              })}
            </group>

            <OrbitControls
              enablePan={false}
              enableZoom={true}
              minDistance={1.7}
              maxDistance={3.2}
              enableDamping
              dampingFactor={0.08}
              rotateSpeed={0.75}
              target={cam.target as any}
            />
          </Canvas>
        </div>

        <div className="border-t px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            Tip: the look is already “premium”; swapping in a segmented GLB body later will make it “world’s best”.
          </div>
          <div className="text-xs text-gray-600">
            Selected: <span className="font-semibold text-gray-900">{selected?.label ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
