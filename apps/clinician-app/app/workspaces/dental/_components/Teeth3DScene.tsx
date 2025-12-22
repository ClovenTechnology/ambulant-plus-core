// apps/clinician-app/app/dental-workspace/_components/Teeth3DScene.tsx
'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useLatestRef } from '../_lib/helpers';

export default function Teeth3DScene({
  selectedTooth,
  counts,
  onSelectTooth,
}: {
  selectedTooth: string; // universal
  counts: Map<string, number>;
  onSelectTooth: (toothIdUniversal: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<any>(null);

  const countsObj = useMemo(() => {
    const o: Record<string, number> = {};
    counts.forEach((v, k) => (o[k] = v));
    return o;
  }, [counts]);

  // ✅ Ref-fix: RAF loop reads latest values
  const selectedToothRef = useLatestRef(selectedTooth);
  const countsObjRef = useLatestRef(countsObj);

  useEffect(() => {
    let disposed = false;

    (async () => {
      if (!hostRef.current) return;

      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls');

      if (disposed) return;

      const host = hostRef.current;
      host.innerHTML = '';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf3f4f6);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
      camera.position.set(0, 0.8, 2.4);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      host.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 1.2;
      controls.maxDistance = 4.5;
      controls.target.set(0, 0.15, 0);
      controls.update();

      // lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 0.8);
      key.position.set(1.4, 2.4, 1.2);
      key.castShadow = true;
      key.shadow.mapSize.width = 1024;
      key.shadow.mapSize.height = 1024;
      scene.add(key);

      // base plane
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 }),
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = -0.15;
      plane.receiveShadow = true;
      scene.add(plane);

      // jaw arches
      const teethGroup = new THREE.Group();
      scene.add(teethGroup);

      const toothMeshes = new Map<string, any>();

      const makeTooth = (id: string) => {
        const g1 = new THREE.CapsuleGeometry(0.04, 0.12, 6, 10);
        const m1 = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6, metalness: 0.05 });
        const mesh = new THREE.Mesh(g1, m1);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { toothId: id };

        const crown = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.05 }),
        );
        crown.position.y = 0.07;
        crown.scale.set(1.1, 0.75, 1.05);
        crown.castShadow = true;
        mesh.add(crown);

        return mesh;
      };

      const placeArc = (ids: string[], y: number, zBend: number, flip: boolean) => {
        const n = ids.length;
        for (let i = 0; i < n; i++) {
          const id = ids[i];
          const t = i / (n - 1);
          const ang = (t - 0.5) * Math.PI * 0.9;
          const r = 0.72;

          const x = Math.sin(ang) * r;
          const z = Math.cos(ang) * r * zBend;

          const tooth = makeTooth(id);
          tooth.position.set(x, y, z - 0.35);
          tooth.rotation.y = -ang;
          tooth.rotation.x = flip ? Math.PI : 0;

          const idx = i + 1;
          const scale = idx <= 4 || idx >= 13 ? 1.15 : idx <= 6 || idx >= 11 ? 1.05 : 0.95;
          tooth.scale.set(scale, scale, scale);

          teethGroup.add(tooth);
          toothMeshes.set(id, tooth);
        }
      };

      const upper = Array.from({ length: 16 }, (_, i) => String(i + 1));
      const lower = Array.from({ length: 16 }, (_, i) => String(32 - i));

      placeArc(upper, 0.32, 0.92, false);
      placeArc(lower, 0.02, 0.96, true);

      const gum = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.09, 10, 64),
        new THREE.MeshStandardMaterial({ color: 0xf7d4d6, roughness: 0.9, metalness: 0.0 }),
      );
      gum.rotation.x = Math.PI / 2;
      gum.position.set(0, 0.18, -0.35);
      gum.receiveShadow = true;
      scene.add(gum);

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
        const toothId = hit?.object?.userData?.toothId || hit?.object?.parent?.userData?.toothId;
        if (toothId) onSelectTooth(String(toothId));
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      resize();

      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const tick = () => {
        if (disposed) return;

        const selTooth = String(selectedToothRef.current);
        const cObj = countsObjRef.current;

        toothMeshes.forEach((mesh, id) => {
          const sel = String(id) === selTooth;
          const c = Number((cObj as any)[id] ?? 0);

          const base = sel ? 0x93c5fd : c > 0 ? 0x86efac : 0xfafafa;
          const mat = mesh.material as any;
          if (mat?.color) mat.color.setHex(base);

          mesh.position.y = mesh.userData._baseY ?? mesh.position.y;
          if (!mesh.userData._baseY) mesh.userData._baseY = mesh.position.y;
          if (sel) mesh.position.y = mesh.userData._baseY + 0.025;
        });

        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
      };
      tick();

      stateRef.current = { renderer, controls, ro, onPointerDown };
    })();

    return () => {
      disposed = true;
      const st = stateRef.current;
      if (st?.renderer?.domElement && st?.onPointerDown) {
        st.renderer.domElement.removeEventListener('pointerdown', st.onPointerDown);
      }
      try {
        st?.ro?.disconnect?.();
      } catch {}
      try {
        st?.controls?.dispose?.();
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
    <div className="absolute inset-0">
      <div className="absolute left-3 top-3 z-10 rounded-full border bg-white/90 px-3 py-1 text-[11px] text-gray-700">
        Drag to orbit · Click a tooth to select
      </div>
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
}
