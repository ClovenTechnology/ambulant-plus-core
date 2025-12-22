// apps/clinician-app/app/workspaces/physio/panels/BodyMapPanel3D.tsx
'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { BodyView, RegionDef } from '../physioModel';
import { clamp, painHeatRGBA } from '../physioModel';

type Props = {
  view: BodyView;
  regions: RegionDef[];
  selectedRegionId: string;
  counts: Map<string, number>;
  latestPainByRegion: Map<string, number>;
  onSelect: (id: string) => void;
};

/**
 * Worldclass interaction now:
 * - True 3D (Canvas)
 * - Clickable region meshes
 * - Hover labels (Html)
 * - Pain heat emissive overlay
 *
 * Optional: drop a GLB at /public/models/physio/body.glb with named meshes that match region ids.
 * If missing, this renders a clean procedural mannequin with region hit meshes.
 */
export default function BodyMapPanel3D(props: Props) {
  return (
    <div className="w-full h-[260px]">
      <Canvas
        camera={{ position: [0, 1.25, 2.65], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 3]} intensity={0.9} />
        <directionalLight position={[-3, 2, -2]} intensity={0.45} />

        <Scene {...props} />

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2.9}
          maxPolarAngle={Math.PI / 2.05}
          rotateSpeed={0.55}
        />
      </Canvas>
    </div>
  );
}

function Scene({ view, regions, selectedRegionId, counts, latestPainByRegion, onSelect }: Props) {
  const { camera } = useThree();
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Camera snap per view (keeps the “front/back/left/right” semantics identical)
  useEffect(() => {
    const lookAt = new THREE.Vector3(0, 1.05, 0);
    const pos =
      view === 'front'
        ? new THREE.Vector3(0, 1.25, 2.65)
        : view === 'back'
        ? new THREE.Vector3(0, 1.25, -2.65)
        : view === 'left'
        ? new THREE.Vector3(-2.65, 1.25, 0)
        : new THREE.Vector3(2.65, 1.25, 0);

    camera.position.copy(pos);
    camera.lookAt(lookAt);
    camera.updateProjectionMatrix();
  }, [view, camera]);

  const regionMeta = useMemo(() => {
    const m = new Map<string, { label: string; pain?: number; count: number }>();
    for (const r of regions) {
      m.set(r.id, {
        label: r.label,
        pain: latestPainByRegion.get(r.id),
        count: counts.get(r.id) ?? 0,
      });
    }
    return m;
  }, [regions, latestPainByRegion, counts]);

  return (
    <group position={[0, 0, 0]}>
      <GridBackdrop />

      {/* Try GLB if present; otherwise use procedural mannequin */}
      <OptionalGLB
        regionMeta={regionMeta}
        selectedRegionId={selectedRegionId}
        hoverId={hoverId}
        onHover={setHoverId}
        onSelect={onSelect}
      />

      <ProceduralMannequin
        regionMeta={regionMeta}
        selectedRegionId={selectedRegionId}
        hoverId={hoverId}
        onHover={setHoverId}
        onSelect={onSelect}
      />
    </group>
  );
}

function GridBackdrop() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.0} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

function OptionalGLB(props: {
  regionMeta: Map<string, { label: string; pain?: number; count: number }>;
  selectedRegionId: string;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const { regionMeta, selectedRegionId, hoverId, onHover, onSelect } = props;

  // If file doesn't exist, drei will throw; we swallow and render nothing.
  // (Procedural mannequin will still render.)
  let gltf: any = null;
  try {
    // @ts-expect-error - path is optional in runtime
    gltf = useGLTF('/models/physio/body.glb');
  } catch {
    gltf = null;
  }
  if (!gltf?.scene) return null;

  // Apply interactive materials to meshes whose names match region ids
  const scene = gltf.scene.clone(true) as THREE.Group;
  scene.traverse((obj: any) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const id = obj.name;
    if (!regionMeta.has(id)) return;

    obj.material = makeRegionMat(regionMeta.get(id)?.pain, id === selectedRegionId, id === hoverId);
    obj.castShadow = false;
    obj.receiveShadow = false;
    obj.raycast = THREE.Mesh.prototype.raycast;
  });

  return (
    <primitive
      object={scene}
      position={[0, 0.0, 0]}
      onPointerMove={(e: any) => {
        e.stopPropagation();
        const name = e.object?.name as string | undefined;
        if (name && regionMeta.has(name)) onHover(name);
      }}
      onPointerOut={(e: any) => {
        e.stopPropagation();
        onHover(null);
      }}
      onPointerDown={(e: any) => {
        e.stopPropagation();
        const name = e.object?.name as string | undefined;
        if (name && regionMeta.has(name)) onSelect(name);
      }}
    />
  );
}

function ProceduralMannequin(props: {
  regionMeta: Map<string, { label: string; pain?: number; count: number }>;
  selectedRegionId: string;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const { regionMeta, selectedRegionId, hoverId, onHover, onSelect } = props;

  // If a GLB exists, we still render procedural but extremely subtle; however we avoid duplicate by checking a flag:
  // The OptionalGLB renders first; we can't easily detect. Keep procedural low-key but still interactive.
  const baseMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#94a3b8', transparent: true, opacity: 0.18 }), []);
  const softMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#64748b', transparent: true, opacity: 0.10 }), []);

  const labelFor = (id: string) => regionMeta.get(id)?.label ?? id;
  const painFor = (id: string) => regionMeta.get(id)?.pain;
  const countFor = (id: string) => regionMeta.get(id)?.count ?? 0;

  return (
    <group position={[0, 0, 0]}>
      {/* Torso + head (non-click base) */}
      <mesh position={[0, 1.25, 0]} material={baseMat}>
        <capsuleGeometry args={[0.35, 0.75, 12, 24]} />
      </mesh>

      <mesh position={[0, 1.95, 0]} material={softMat}>
        <sphereGeometry args={[0.22, 24, 24]} />
      </mesh>

      {/* Arms (base) */}
      <mesh position={[-0.55, 1.35, 0]} rotation={[0, 0, Math.PI / 12]} material={softMat}>
        <capsuleGeometry args={[0.12, 0.65, 10, 18]} />
      </mesh>
      <mesh position={[0.55, 1.35, 0]} rotation={[0, 0, -Math.PI / 12]} material={softMat}>
        <capsuleGeometry args={[0.12, 0.65, 10, 18]} />
      </mesh>

      {/* Legs (base) */}
      <mesh position={[-0.18, 0.55, 0]} material={softMat}>
        <capsuleGeometry args={[0.14, 0.95, 10, 18]} />
      </mesh>
      <mesh position={[0.18, 0.55, 0]} material={softMat}>
        <capsuleGeometry args={[0.14, 0.95, 10, 18]} />
      </mesh>

      {/* Clickable region hit-meshes */}
      <HitRegion
        id="neck"
        pos={[0, 1.72, 0.0]}
        geo={<capsuleGeometry args={[0.12, 0.20, 10, 18]} />}
        label={labelFor('neck')}
        pain={painFor('neck')}
        count={countFor('neck')}
        selected={selectedRegionId === 'neck'}
        hovered={hoverId === 'neck'}
        onHover={onHover}
        onSelect={onSelect}
      />

      <HitRegion
        id="left_shoulder"
        pos={[-0.45, 1.55, 0.05]}
        geo={<sphereGeometry args={[0.18, 24, 24]} />}
        label={labelFor('left_shoulder')}
        pain={painFor('left_shoulder')}
        count={countFor('left_shoulder')}
        selected={selectedRegionId === 'left_shoulder'}
        hovered={hoverId === 'left_shoulder'}
        onHover={onHover}
        onSelect={onSelect}
      />

      <HitRegion
        id="right_shoulder"
        pos={[0.45, 1.55, 0.05]}
        geo={<sphereGeometry args={[0.18, 24, 24]} />}
        label={labelFor('right_shoulder')}
        pain={painFor('right_shoulder')}
        count={countFor('right_shoulder')}
        selected={selectedRegionId === 'right_shoulder'}
        hovered={hoverId === 'right_shoulder'}
        onHover={onHover}
        onSelect={onSelect}
      />

      <HitRegion
        id="thoracic_spine"
        pos={[0, 1.28, -0.06]}
        geo={<boxGeometry args={[0.34, 0.38, 0.18]} />}
        label={labelFor('thoracic_spine')}
        pain={painFor('thoracic_spine')}
        count={countFor('thoracic_spine')}
        selected={selectedRegionId === 'thoracic_spine'}
        hovered={hoverId === 'thoracic_spine'}
        onHover={onHover}
        onSelect={onSelect}
      />

      <HitRegion
        id="lumbar_spine"
        pos={[0, 0.96, -0.05]}
        geo={<boxGeometry args={[0.34, 0.32, 0.18]} />}
        label={labelFor('lumbar_spine')}
        pain={painFor('lumbar_spine')}
        count={countFor('lumbar_spine')}
        selected={selectedRegionId === 'lumbar_spine'}
        hovered={hoverId === 'lumbar_spine'}
        onHover={onHover}
        onSelect={onSelect}
      />

      <HitRegion
        id="left_knee"
        pos={[-0.18, 0.62, 0.08]}
        geo={<sphereGeometry args={[0.14, 24, 24]} />}
        label={labelFor('left_knee')}
        pain={painFor('left_knee')}
        count={countFor('left_knee')}
        selected={selectedRegionId === 'left_knee'}
        hovered={hoverId === 'left_knee'}
        onHover={onHover}
        onSelect={onSelect}
      />

      <HitRegion
        id="right_knee"
        pos={[0.18, 0.62, 0.08]}
        geo={<sphereGeometry args={[0.14, 24, 24]} />}
        label={labelFor('right_knee')}
        pain={painFor('right_knee')}
        count={countFor('right_knee')}
        selected={selectedRegionId === 'right_knee'}
        hovered={hoverId === 'right_knee'}
        onHover={onHover}
        onSelect={onSelect}
      />

      <HitRegion
        id="left_ankle"
        pos={[-0.18, 0.12, 0.06]}
        geo={<sphereGeometry args={[0.12, 24, 24]} />}
        label={labelFor('left_ankle')}
        pain={painFor('left_ankle')}
        count={countFor('left_ankle')}
        selected={selectedRegionId === 'left_ankle'}
        hovered={hoverId === 'left_ankle'}
        onHover={onHover}
        onSelect={onSelect}
      />

      <HitRegion
        id="right_ankle"
        pos={[0.18, 0.12, 0.06]}
        geo={<sphereGeometry args={[0.12, 24, 24]} />}
        label={labelFor('right_ankle')}
        pain={painFor('right_ankle')}
        count={countFor('right_ankle')}
        selected={selectedRegionId === 'right_ankle'}
        hovered={hoverId === 'right_ankle'}
        onHover={onHover}
        onSelect={onSelect}
      />
    </group>
  );
}

function HitRegion(props: {
  id: string;
  pos: [number, number, number];
  geo: React.ReactNode;
  label: string;
  pain?: number;
  count: number;
  selected: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const { id, pos, geo, label, pain, count, selected, hovered, onHover, onSelect } = props;
  const mat = useMemo(() => makeRegionMat(pain, selected, hovered), [pain, selected, hovered]);

  // subtle pulse on selected
  const ref = useRef<THREE.Mesh | null>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const k = selected ? 1 + 0.04 * Math.sin(t * 3.0) : 1;
    ref.current.scale.set(k, k, k);
  });

  return (
    <mesh
      ref={ref}
      name={id}
      position={pos}
      material={mat}
      onPointerMove={(e) => {
        e.stopPropagation();
        onHover(id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
    >
      {geo}

      {(hovered || selected) ? (
        <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div className="rounded-lg border bg-white shadow px-3 py-2 max-w-[240px]">
            <div className="text-xs font-semibold text-gray-900 flex items-center justify-between gap-2">
              <span className="truncate">{label}</span>
              {selected ? (
                <span className="text-[10px] rounded-full border border-blue-200 bg-blue-50 text-blue-800 px-2 py-0.5">
                  Selected
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[11px] text-gray-600">
              Findings: <span className="font-mono">{count}</span>
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
    </mesh>
  );
}

function makeRegionMat(pain: number | undefined, selected: boolean, hovered: boolean) {
  const heat = painHeatRGBA(pain);
  const base = new THREE.Color('#64748b');
  const heatColor = new THREE.Color(`rgb(${heat.r},${heat.g},${heat.b})`);

  const color = base.clone().lerp(heatColor, clamp((pain ?? 0) / 10, 0, 1) * 0.85);
  const emissive = heatColor.clone().multiplyScalar(clamp((pain ?? 0) / 10, 0, 1) * 0.6);

  const opacity = selected ? 0.92 : hovered ? 0.82 : 0.55 + (heat.a ?? 0) * 0.25;

  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: selected ? 0.9 : hovered ? 0.7 : 0.55,
    transparent: true,
    opacity,
    roughness: 0.55,
    metalness: 0.05,
  });

  return mat;
}
