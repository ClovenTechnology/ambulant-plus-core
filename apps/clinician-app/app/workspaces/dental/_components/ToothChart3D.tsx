'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ToothSystem } from '../_lib/types';
import { toDisplayToothId } from '../_lib/toothMap';
import { useLatestRef } from '../_lib/helpers';

type Props = {
  toothSystem: ToothSystem;
  selectedUniversal: string; // universal (internal)
  onSelectUniversal: (toothIdUniversal: string) => void;
  counts: Map<string, number>;
};

export default function ToothChart3D({
  toothSystem,
  selectedUniversal,
  onSelectUniversal,
  counts,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<any>(null);

  // 4 rows x 8 cols grid mapping:
  // row0: upper 1..8, row1: upper 9..16
  // row2: lower 32..25, row3: lower 24..17
  const idsByCell = useMemo(() => {
    const upper = Array.from({ length: 16 }, (_, i) => String(i + 1)); // 1..16
    const lower = Array.from({ length: 16 }, (_, i) => String(32 - i)); // 32..17
    const rows: string[][] = [
      upper.slice(0, 8),
      upper.slice(8, 16),
      lower.slice(0, 8),
      lower.slice(8, 16),
    ];
    return rows;
  }, []);

  const countsObj = useMemo(() => {
    const o: Record<string, number> = {};
    counts.forEach((v, k) => (o[k] = v));
    return o;
  }, [counts]);

  // ✅ No stale closures in RAF
  const selectedRef = useLatestRef(String(selectedUniversal));
  const hoverRef = useRef<string>('');
  const countsRef = useLatestRef(countsObj);
  const onSelectRef = useLatestRef(onSelectUniversal);

  const [hovered, setHovered] = useState<string>('');

  useEffect(() => {
    hoverRef.current = hovered;
  }, [hovered]);

  useEffect(() => {
    let disposed = false;

    (async () => {
      const host = hostRef.current;
      if (!host) return;

      const THREE = await import('three');

      if (disposed) return;

      host.innerHTML = '';
      host.style.position = 'relative';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      host.appendChild(renderer.domElement);

      // Orthographic camera feels more “icon grid”
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50);
      camera.position.set(0.0, 1.6, 2.2);
      camera.lookAt(0, 0, 0);

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.95));
      const key = new THREE.DirectionalLight(0xffffff, 0.65);
      key.position.set(2.2, 3.0, 2.2);
      scene.add(key);

      // Layout helpers
      const teethGroup = new THREE.Group();
      scene.add(teethGroup);

      const toothMeshes = new Map<string, any>();

      const makeTooth = (id: string) => {
        const bodyGeo = new THREE.CapsuleGeometry(0.055, 0.12, 6, 12);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xfafafa,
          roughness: 0.55,
          metalness: 0.04,
        });

        const body = new THREE.Mesh(bodyGeo, mat);
        body.userData = { toothId: id, kind: 'tooth' };

        const crown = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.04 }),
        );
        crown.position.y = 0.07;
        crown.scale.set(1.15, 0.78, 1.08);
        crown.userData = { toothId: id, kind: 'tooth' };

        body.add(crown);

        // tiny tilt so it looks “3D icon”, not a pill
        body.rotation.x = -0.35;
        body.rotation.y = 0.25;

        return body;
      };

      // Place teeth in a 4x8 grid in world space
      // We keep the grid centered and put a bigger gap between upper and lower arches.
      const cellW = 0.28;
      const cellH = 0.28;
      const gapBetweenArches = 0.18;

      const cellPos = (row: number, col: number) => {
        const x = (col - 3.5) * cellW;
        let y = (1.5 - row) * cellH;

        // extra gap between row1 and row2
        if (row >= 2) y -= gapBetweenArches;

        return { x, y };
      };

      for (let row = 0; row < idsByCell.length; row++) {
        for (let col = 0; col < idsByCell[row].length; col++) {
          const id = idsByCell[row][col];
          const t = makeTooth(id);
          const { x, y } = cellPos(row, col);
          t.position.set(x, y, 0);

          // Slight size variation (molars bigger)
          const n = Number(id);
          const molarish = (n >= 1 && n <= 3) || (n >= 14 && n <= 16) || (n >= 17 && n <= 19) || (n >= 30 && n <= 32);
          t.scale.setScalar(molarish ? 1.05 : 0.98);

          teethGroup.add(t);
          toothMeshes.set(id, t);
        }
      }

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;

        renderer.setSize(w, h, false);

        // Fit camera bounds to content based on aspect ratio
        const aspect = w / h;

        // These bounds were tuned for the grid size above
        const halfH = 0.95;
        const halfW = halfH * aspect;

        camera.left = -halfW;
        camera.right = halfW;
        camera.top = halfH;
        camera.bottom = -halfH;
        camera.updateProjectionMatrix();
      };

      const ro = new ResizeObserver(resize);
      ro.observe(host);
      resize();

      // Optional raycast select if user clicks canvas gaps (overlay handles most clicks)
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const onPointerDown = (ev: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
        pointer.set(x, y);

        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(Array.from(toothMeshes.values()), true);
        const hit = hits.find((h) => h.object?.userData?.toothId || h.object?.parent?.userData?.toothId);
        const toothId =
          hit?.object?.userData?.toothId || hit?.object?.parent?.userData?.toothId;

        if (toothId) onSelectRef.current(String(toothId));
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);

      const tick = () => {
        if (disposed) return;

        const sel = String(selectedRef.current);
        const hov = String(hoverRef.current || '');
        const cObj = countsRef.current;

        toothMeshes.forEach((mesh, id) => {
          const isSel = id === sel;
          const isHov = id === hov && !isSel;
          const c = Number((cObj as any)[id] ?? 0);

          const mat = mesh.material as any;
          if (mat?.color) {
            // Selected: blue, Hover: light blue, Has findings: green tint, Default: enamel
            const hex = isSel ? 0x93c5fd : isHov ? 0xbfdbfe : c > 0 ? 0x86efac : 0xfafafa;
            mat.color.setHex(hex);
          }

          // Small “pop” for selection
          mesh.position.z = isSel ? 0.03 : 0.0;
        });

        renderer.render(scene, camera);
        requestAnimationFrame(tick);
      };
      tick();

      stateRef.current = { renderer, ro, onPointerDown };
    })();

    return () => {
      disposed = true;
      const st = stateRef.current;

      try {
        st?.renderer?.domElement?.removeEventListener?.('pointerdown', st?.onPointerDown);
      } catch {}
      try {
        st?.ro?.disconnect?.();
      } catch {}
      try {
        st?.renderer?.dispose?.();
      } catch {}

      if (hostRef.current) hostRef.current.innerHTML = '';
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      {/* 3D canvas */}
      <div ref={hostRef} className="h-[320px] w-full rounded-lg border bg-white overflow-hidden" />

      {/* Overlay grid: labels + click targets + badges */}
      <div className="pointer-events-auto absolute inset-0 p-3">
        <div className="grid grid-rows-4 gap-2 h-full">
          {idsByCell.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-8 gap-2">
              {row.map((id) => {
                const isSel = String(id) === String(selectedUniversal);
                const c = counts.get(id) ?? 0;
                const label = toDisplayToothId(id, toothSystem);

                return (
                  <button
                    key={id}
                    type="button"
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered('')}
                    onClick={() => onSelectUniversal(id)}
                    className={
                      'relative rounded-md text-[11px] font-medium px-1.5 py-1 border bg-white/70 backdrop-blur ' +
                      (isSel
                        ? 'border-blue-300 text-blue-800'
                        : 'border-transparent text-gray-700 hover:border-gray-200')
                    }
                    title={`Tooth ${label} (universal ${id})`}
                  >
                    {label}
                    {c > 0 ? (
                      <span className="absolute -top-1 -right-1 text-[10px] rounded-full bg-emerald-600 text-white px-1.5 py-0.5">
                        {c}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="absolute left-4 top-4 text-[11px] text-gray-600 bg-white/90 border rounded-full px-2 py-1">
          3D chart · hover + click to select
        </div>
      </div>
    </div>
  );
}
