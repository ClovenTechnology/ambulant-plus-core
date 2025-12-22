// apps/clinician-app/app/dental-workspace/_components/Scan3DViewer.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DentalEvidence, DentalAnnotation, ToothSystem, ModelPinPayload, ScreenPinPayload } from '../_lib/types';
import { extFromUrl, useLatestRef } from '../_lib/helpers';
import { fdiToUniversal, meshNameToToothId, toothNodeName, universalToFdi } from '../_lib/toothMap';

export default function Scan3DViewer({
  evidence,
  pins,
  disabled,
  selectedToothUniversal,
  toothSystem,
  onSelectToothUniversal,
  onAddModelPin,
}: {
  evidence: DentalEvidence;
  pins: DentalAnnotation[];
  disabled?: boolean;
  selectedToothUniversal: string; // internal universal
  toothSystem: ToothSystem; // display-only (kept for UI text if you want)
  onSelectToothUniversal: (universalTooth: string) => void;
  onAddModelPin: (payload: ModelPinPayload, overrideToothId?: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<any>(null);
  const [viewerReady, setViewerReady] = useState(false);

  const url = evidence.url ?? '';
  const ext = extFromUrl(url);

  const segmentationScheme: 'FDI' | 'universal' | null =
    evidence.meta?.segmentation?.perTooth ? (evidence.meta?.segmentation?.scheme ?? 'FDI') : null;

  // Which tooth node should we highlight? (node names in GLB)
  // ✅ Option A: selection is universal always; convert to FDI only for node lookup
  const targetNodeName = useMemo(() => {
    if (!evidence.meta?.segmentation?.perTooth) return null;

    if (segmentationScheme === 'FDI') {
      const fdi = universalToFdi(selectedToothUniversal);
      return fdi ? toothNodeName(fdi) : null;
    }

    return toothNodeName(selectedToothUniversal);
  }, [evidence.meta, segmentationScheme, selectedToothUniversal]);

  // ✅ Ref-fix: RAF loop reads latest pins + target
  const pinsRef = useLatestRef(pins);
  const targetNodeNameRef = useLatestRef<string | null>(targetNodeName);
  const disabledRef = useLatestRef(!!disabled);
  const onSelectToothUniversalRef = useLatestRef(onSelectToothUniversal);
  const onAddModelPinRef = useLatestRef(onAddModelPin);

  useEffect(() => {
    let disposed = false;

    (async () => {
      const host = hostRef.current;
      if (!host) return;
      if (!url) return;

      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader');
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader');

      if (disposed) return;

      host.innerHTML = '';
      host.style.position = 'relative';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 2000);
      camera.position.set(0, 0.1, 1.8);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
      renderer.shadowMap.enabled = true;

      host.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 0.35;
      controls.maxDistance = 6;
      controls.target.set(0, 0, 0);
      controls.update();

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 0.85);
      key.position.set(1.2, 2.0, 1.4);
      key.castShadow = true;
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xffffff, 0.35);
      fill.position.set(-1.2, 1.0, -1.0);
      scene.add(fill);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.95, metalness: 0.0 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.45;
      ground.receiveShadow = true;
      scene.add(ground);

      // ---------- Load model ----------
      let root: any = null;

      if (ext === 'glb' || ext === 'gltf' || evidence.contentType?.includes('gltf')) {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);
        root = gltf.scene || gltf.scenes?.[0];
      } else if (ext === 'obj') {
        const loader = new OBJLoader();
        root = await loader.loadAsync(url);
      } else if (ext === 'stl') {
        const loader = new STLLoader();
        const geo = await loader.loadAsync(url);
        const mat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.55, metalness: 0.05 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'stl_mesh';
        root = new THREE.Group();
        root.add(mesh);
      } else {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);
        root = gltf.scene || gltf.scenes?.[0];
      }

      if (disposed) return;

      // ---------- Index meshes ----------
      const meshList: any[] = [];
      const objByName = new Map<string, any>();
      const toothMeshesByRootName = new Map<string, any[]>();

      const ensureBucket = (toothName: string) => {
        let arr = toothMeshesByRootName.get(toothName);
        if (!arr) {
          arr = [];
          toothMeshesByRootName.set(toothName, arr);
        }
        return arr;
      };

      root.traverse((obj: any) => {
        if (obj?.name) objByName.set(String(obj.name), obj);

        if (obj?.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;

          if (!obj.material || Array.isArray(obj.material)) {
            obj.material = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.55, metalness: 0.05 });
          } else {
            obj.material.transparent = false;
          }

          meshList.push(obj);
        }
      });

      const findToothRootForObject = (start: any) => {
        let cur = start;
        while (cur) {
          const meta = meshNameToToothId(cur?.name);
          if (meta) return cur;
          cur = cur.parent;
        }
        return null;
      };

      for (const m of meshList) {
        const rootTooth = findToothRootForObject(m);
        if (rootTooth?.name) ensureBucket(String(rootTooth.name)).push(m);
      }

      scene.add(root);

      // ---------- Fit camera ----------
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const dist = maxDim * 1.6;

      controls.target.copy(center);
      camera.position.set(center.x, center.y + maxDim * 0.12, center.z + dist);
      camera.near = Math.max(0.0005, dist / 5000);
      camera.far = Math.max(50, dist * 10);
      camera.updateProjectionMatrix();
      controls.update();

      // ---------- Outline edges ----------
      const OUTLINE_THRESHOLD_ANGLE = 28;
      const outlineMat = new THREE.LineBasicMaterial({
        color: 0x111827,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      });

      const outlineByMeshUuid = new Map<string, any>();

      const addOutlineToMesh = (mesh: any) => {
        try {
          if (!mesh?.geometry) return;
          const edges = new THREE.EdgesGeometry(mesh.geometry, OUTLINE_THRESHOLD_ANGLE);
          const line = new THREE.LineSegments(edges, outlineMat.clone());
          line.name = '__tooth_outline__';
          line.renderOrder = 999;
          line.visible = false;
          mesh.add(line);
          outlineByMeshUuid.set(String(mesh.uuid), line);
        } catch {}
      };

      for (const [, meshes] of toothMeshesByRootName.entries()) {
        for (const m of meshes) addOutlineToMesh(m);
      }

      // ---------- Store original colors ----------
      const originalColors = new Map<string, any>();
      for (const m of meshList) {
        const key = String(m.uuid);
        const mat = m.material;
        const color = mat?.color ? mat.color.clone() : null;
        originalColors.set(key, color);
      }

      // ---------- DOM overlay ----------
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '2';
      host.appendChild(overlay);

      const pinEls = new Map<string, HTMLDivElement>();
      const ensurePinEl = (id: string) => {
        let el = pinEls.get(id);
        if (!el) {
          el = document.createElement('div');
          el.style.position = 'absolute';
          el.style.transform = 'translate(-50%,-50%)';
          el.style.width = '10px';
          el.style.height = '10px';
          el.style.borderRadius = '999px';
          el.style.background = '#2563eb';
          el.style.boxShadow = '0 0 0 6px rgba(37, 99, 235, 0.22)';
          el.title = 'Pin';
          overlay.appendChild(el);
          pinEls.set(id, el);
        }
        return el;
      };
      const hideUnusedPins = (keep: Set<string>) => {
        for (const [id, el] of pinEls.entries()) {
          if (!keep.has(id)) el.style.display = 'none';
        }
      };

      const tip = document.createElement('div');
      tip.style.position = 'absolute';
      tip.style.pointerEvents = 'none';
      tip.style.zIndex = '3';
      tip.style.padding = '6px 8px';
      tip.style.borderRadius = '10px';
      tip.style.border = '1px solid rgba(0,0,0,0.10)';
      tip.style.background = 'rgba(255,255,255,0.92)';
      tip.style.backdropFilter = 'blur(6px)';
      tip.style.fontSize = '11px';
      tip.style.color = '#111827';
      tip.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
      tip.style.display = 'none';
      overlay.appendChild(tip);

      const formatBothSystems = (meta: { scheme: 'FDI' | 'universal'; toothId: string }) => {
        if (meta.scheme === 'FDI') {
          const fdi = meta.toothId;
          const uni = fdiToUniversal(fdi);
          return { fdi, uni: uni ?? '—', text: `FDI ${fdi} / Universal ${uni ?? '—'}` };
        } else {
          const uni = meta.toothId;
          const fdi = universalToFdi(uni);
          return { fdi: fdi ?? '—', uni, text: `FDI ${fdi ?? '—'} / Universal ${uni}` };
        }
      };

      // ---------- Picking ----------
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const pick = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        pointer.set(x, y);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(meshList, true);
        return hits?.[0] ?? null;
      };

      const resolveToothNodeFromHit = (hit: any) => {
        if (!hit?.object) return null;
        let cur: any = hit.object;
        while (cur) {
          const meta = meshNameToToothId(cur?.name);
          if (meta) return { node: cur, meta };
          cur = cur.parent;
        }
        return null;
      };

      const hoverRef = { toothNodeName: '' };

      const onPointerMove = (ev: PointerEvent) => {
        if (disposed) return;

        const hit = pick(ev.clientX, ev.clientY);
        const resolved = resolveToothNodeFromHit(hit);

        if (!resolved) {
          hoverRef.toothNodeName = '';
          tip.style.display = 'none';
          return;
        }

        const toothNodeNameNow = String(resolved.node?.name || '');
        hoverRef.toothNodeName = toothNodeNameNow;

        const both = formatBothSystems(resolved.meta);
        tip.textContent = both.text;
        tip.style.display = 'block';

        const rect = renderer.domElement.getBoundingClientRect();
        const x = ev.clientX - rect.left + 12;
        const y = ev.clientY - rect.top + 12;
        tip.style.left = `${Math.max(6, Math.min(rect.width - 6, x))}px`;
        tip.style.top = `${Math.max(6, Math.min(rect.height - 6, y))}px`;
      };

      const onPointerLeave = () => {
        hoverRef.toothNodeName = '';
        tip.style.display = 'none';
      };

      const onPointerDown = (ev: PointerEvent) => {
        if (disabledRef.current) return;

        const hit = pick(ev.clientX, ev.clientY);
        if (!hit || !hit.object) return;

        const resolved = resolveToothNodeFromHit(hit);

        let overrideToothId: string | undefined = undefined;

        if (resolved?.meta) {
          const meta = resolved.meta;
          if (meta.scheme === 'FDI') {
            const uni = fdiToUniversal(meta.toothId);
            if (uni) {
              onSelectToothUniversalRef.current(uni);
              overrideToothId = uni;
            }
          } else {
            onSelectToothUniversalRef.current(meta.toothId);
            overrideToothId = meta.toothId;
          }
        }

        const pinTargetObj = resolved?.node ?? hit.object;
        const meshId = String(pinTargetObj.name || hit.object.name || hit.object.uuid);

        try {
          pinTargetObj.updateWorldMatrix(true, false);
          hit.object.updateWorldMatrix(true, false);
        } catch {}

        const pWorld = hit.point.clone();
        const pLocal = pinTargetObj.worldToLocal(pWorld.clone());

        let nLocal: [number, number, number] | undefined = undefined;
        if (hit.face?.normal) {
          const n = hit.face.normal.clone().normalize();
          const nWorld = n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();

          const inv = pinTargetObj.matrixWorld.clone().invert();
          const nLocVec = nWorld.clone().transformDirection(inv).normalize();

          nLocal = [nLocVec.x, nLocVec.y, nLocVec.z];
        }

        const label =
          resolved?.meta ? formatBothSystems(resolved.meta).text : meshId ? `Mesh ${meshId}` : '3D Pin';

        const payload: ModelPinPayload = {
          kind: 'model',
          meshId,
          p: [pLocal.x, pLocal.y, pLocal.z],
          n: nLocal,
          label,
        };

        onAddModelPinRef.current(payload, overrideToothId);
      };

      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerleave', onPointerLeave);
      renderer.domElement.addEventListener('pointerdown', onPointerDown);

      // ---------- Resize ----------
      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host);
      resize();

      // ---------- Projection helper ----------
      const toScreen = (v: any) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const p = v.clone().project(camera);
        const x = ((p.x + 1) / 2) * rect.width;
        const y = ((-p.y + 1) / 2) * rect.height;
        return { x, y, visible: p.z >= -1 && p.z <= 1 };
      };

      // ---------- Render loop ----------
      const tick = () => {
        if (disposed) return;

        const selectedToothNodeName = targetNodeNameRef.current ? String(targetNodeNameRef.current) : '';
        const hoveredToothNodeName = hoverRef.toothNodeName ? String(hoverRef.toothNodeName) : '';

        for (const m of meshList) {
          const key = String(m.uuid);
          const orig = originalColors.get(key);
          if (m.material?.color && orig) m.material.color.copy(orig);
        }

        const applyToToothMeshes = (toothName: string, fn: (mesh: any) => void) => {
          const meshes = toothMeshesByRootName.get(toothName);
          if (!meshes) return;
          for (const m of meshes) fn(m);
        };

        if (selectedToothNodeName) {
          applyToToothMeshes(selectedToothNodeName, (m) => {
            if (m.material?.color) m.material.color.setHex(0x93c5fd);
          });
        }

        if (hoveredToothNodeName && hoveredToothNodeName !== selectedToothNodeName) {
          applyToToothMeshes(hoveredToothNodeName, (m) => {
            if (m.material?.color) m.material.color.setHex(0xbfdbfe);
          });
        }

        for (const [toothName, meshes] of toothMeshesByRootName.entries()) {
          const show = toothName === selectedToothNodeName || toothName === hoveredToothNodeName;
          for (const m of meshes) {
            const outline = outlineByMeshUuid.get(String(m.uuid));
            if (outline) outline.visible = !!show;
          }
        }

        controls.update();
        renderer.render(scene, camera);

        // Project pins (latest via ref)
        const keep = new Set<string>();
        for (const a of pinsRef.current) {
          if (a.type !== 'pin') continue;
          const payload = a.payload as ScreenPinPayload | ModelPinPayload;
          if (!payload || payload.kind !== 'model') continue;

          const obj = objByName.get(String(payload.meshId));
          if (!obj) continue;

          const pLocal = payload.p;
          const world = obj.localToWorld(new THREE.Vector3(pLocal[0], pLocal[1], pLocal[2]));
          const { x, y, visible } = toScreen(world);

          const el = ensurePinEl(a.id);
          keep.add(a.id);
          el.style.display = visible ? 'block' : 'none';
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.title = String(payload.label || '3D Pin');
        }
        hideUnusedPins(keep);

        requestAnimationFrame(tick);
      };

      setViewerReady(true);
      tick();

      stateRef.current = {
        renderer,
        controls,
        ro,
        overlay,
        tip,
        onPointerDown,
        onPointerMove,
        onPointerLeave,
        pinEls,
      };
    })();

    return () => {
      disposed = true;
      const st = stateRef.current;

      try {
        st?.renderer?.domElement?.removeEventListener?.('pointerdown', st?.onPointerDown);
        st?.renderer?.domElement?.removeEventListener?.('pointermove', st?.onPointerMove);
        st?.renderer?.domElement?.removeEventListener?.('pointerleave', st?.onPointerLeave);
      } catch {}

      try {
        st?.ro?.disconnect?.();
      } catch {}
      try {
        st?.controls?.dispose?.();
      } catch {}
      try {
        st?.renderer?.dispose?.();
      } catch {}

      try {
        if (st?.overlay?.parentNode) st.overlay.parentNode.removeChild(st.overlay);
      } catch {}
      try {
        st?.pinEls?.clear?.();
      } catch {}

      if (hostRef.current) hostRef.current.innerHTML = '';
      stateRef.current = null;
      setViewerReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div className="h-full w-full relative bg-white">
      {!url ? (
        <div className="h-full grid place-items-center text-gray-700">
          <div className="text-center">
            <div className="text-sm font-medium">3D scan pending</div>
            <div className="text-xs text-gray-500 mt-1">
              status: {evidence.status}
              {evidence.jobId ? ` · job: ${evidence.jobId}` : ''}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute left-3 top-3 z-10 rounded-full border bg-white/90 px-3 py-1 text-[11px] text-gray-700">
            Drag to orbit · Hover to identify tooth · Click to select + snap a 3D pin
            {evidence.meta?.segmentation?.perTooth ? ' · segmented teeth' : ''}
          </div>

          <div className="absolute right-3 top-3 z-10 rounded-full border bg-white/90 px-3 py-1 text-[11px] text-gray-700">
            {viewerReady ? (
              <>
                {ext.toUpperCase() || '3D'} ·{' '}
                {evidence.meta?.segmentation?.perTooth
                  ? `Highlight: ${targetNodeName ?? '—'}`
                  : 'Unsegmented'}
              </>
            ) : (
              'Loading…'
            )}
          </div>

          <div ref={hostRef} className="absolute inset-0" />
          {!viewerReady ? <div className="absolute inset-0 bg-white/60" /> : null}
        </>
      )}
    </div>
  );
}
