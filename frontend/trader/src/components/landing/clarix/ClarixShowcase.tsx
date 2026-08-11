'use client';

/**
 * Scroll-driven 3D showcase — ported from the Clarix (GetLayers)
 * template into R3F and re-branded for PowerTradeFX.
 *
 * A 320vh section with a sticky viewport: as the visitor scrolls,
 * the GLB model enters, rotates and traverses the frame while copy
 * blocks hand over; in the final act the model gives way to a particle
 * field that assembles the PowerTradeFX monogram (particles sampled from
 * the brand favicon's pixels, Clarix's logo-particle trick) and then
 * gently disperses.
 *
 * Engineering posture: canvas mounts on
 * intersection, loop pauses off-screen/hidden, copy opacity is driven
 * through refs (no per-scroll re-renders), colors come from CSS tokens.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useLandingLang } from '../i18n';
import { sampleMonogram } from '../monogramSampler';

const MODEL_URL = '/clarix/model.glb';

function tokenColor(el: Element | null, name: string): THREE.Color {
  const raw = getComputedStyle(el ?? document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(raw || undefined);
}

/* ── scene ──────────────────────────────────────────────────────────── */
function Scene({ progressRef, activeRef, mobile, scopeRef }: {
  progressRef: React.MutableRefObject<number>;
  activeRef: React.MutableRefObject<boolean>;
  mobile: boolean;
  scopeRef: React.MutableRefObject<HTMLElement | null>;
}) {
  const { scene: model } = useGLTF(MODEL_URL);
  const modelRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const [mono, setMono] = useState<Awaited<ReturnType<typeof sampleMonogram>> | null>(null);
  useEffect(() => { void sampleMonogram(4.6).then(setMono); }, []);

  /* particle buffers: start scattered, lerp toward monogram targets */
  const particle = useMemo(() => {
    if (!mono || mono.positions.length === 0) return null;
    const n = mono.positions.length / 3;
    const start = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      start[i * 3] = (Math.random() - 0.5) * 14;
      start[i * 3 + 1] = (Math.random() - 0.5) * 9;
      start[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(start.slice(), 3));
    const accent = tokenColor(scopeRef.current, '--accent');
    const bright = accent.clone().lerp(new THREE.Color(1, 1, 1), 0.75);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const c = mono.glyph[i]! > 0.5 ? bright : accent;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.055, vertexColors: true, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    return { geo, mat, start, n };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mono]);

  useEffect(() => () => { particle?.geo.dispose(); particle?.mat.dispose(); }, [particle]);

  const ease = (a: number, b: number, p: number) =>
    Math.min(1, Math.max(0, (p - a) / (b - a)));
  const smooth = (x: number) => x * x * (3 - 2 * x);

  useFrame((state) => {
    if (!activeRef.current) return;
    // NOTE: deliberately NOT gated on prefers-reduced-motion -- target
    // machines run Windows with OS animations off, which froze the act
    // into a still image. Motion here is slow and scroll-driven.
    const p = progressRef.current;
    const t = state.clock.elapsedTime;

    /* model act: enter (0–0.12), traverse + rotate (0–0.5), exit (0.5–0.62) */
    const g = modelRef.current;
    if (g) {
      const enter = smooth(ease(0, 0.15, p));
      const exit = 1 - smooth(ease(0.5, 0.62, p));
      g.visible = exit > 0.01;
      // entrance has a 60% floor so the model is never a distant dot at
      // the top of the section; exit still shrinks it away fully
      const base = mobile ? 1.15 : 2.0;
      g.scale.setScalar(base * (0.6 + 0.4 * enter) * exit);
      const amp = mobile ? 0.9 : 2.1;
      g.position.x = THREE.MathUtils.lerp(amp, -amp, smooth(ease(0.05, 0.55, p)));
      g.position.y = -0.4 + Math.sin(t * 0.8) * 0.12;
      g.rotation.y = p * 5.2 + t * 0.12;
      g.rotation.x = 0.15 + Math.sin(t * 0.5) * 0.05;
    }

    /* particle act: form (0.58–0.8), hold, disperse (0.9–1) */
    if (particle && pointsRef.current) {
      const pts = pointsRef.current;
      const form = smooth(ease(0.58, 0.8, p));
      const burst = smooth(ease(0.9, 1, p));
      pts.visible = form > 0.001;
      (pts.material as THREE.PointsMaterial).opacity = form * (1 - burst * 0.7);
      const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const tgt = mono!.positions;
      const src = particle.start;
      for (let i = 0; i < particle.n; i++) {
        const j = i * 3;
        const driftX = Math.sin(t * 0.7 + i) * 0.04;
        const driftY = Math.cos(t * 0.6 + i * 1.3) * 0.04;
        const mScale = mobile ? 0.72 : 1.2;
        const ex = mScale * (1 + burst * (2.4 + ((i * 2654435761) % 100) / 45));
        arr[j] = THREE.MathUtils.lerp(src[j]!, tgt[j]! * ex + driftX, form);
        arr[j + 1] = THREE.MathUtils.lerp(src[j + 1]!, tgt[j + 1]! * ex + driftY, form);
        arr[j + 2] = THREE.MathUtils.lerp(src[j + 2]!, tgt[j + 2]! * ex, form);
      }
      attr.needsUpdate = true;
    }

  });

  return (
    <>
      <ambientLight intensity={1.0} />
      <directionalLight position={[5, 10, 5]} intensity={2.0} />
      <directionalLight position={[-5, -5, -5]} intensity={0.9} />
      <group ref={modelRef}>
        <primitive object={model} />
      </group>
      {particle && (
        <points ref={pointsRef} geometry={particle.geo} material={particle.mat} frustumCulled={false} />
      )}
    </>
  );
}

useGLTF.preload(MODEL_URL);

/* ── section wrapper ────────────────────────────────────────────────── */
export default function ClarixShowcase() {
  const { t } = useLandingLang();
  const rootRef = useRef<HTMLElement>(null);
  const copyRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const progressRef = useRef(0);
  const activeRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mb = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobile(mb.matches);
    sync();
    mb.addEventListener('change', sync);
    return () => mb.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      const vis = !!e?.isIntersecting;
      activeRef.current = vis && document.visibilityState === 'visible';
      if (vis) setMounted(true);
    }, { threshold: 0.02 });
    io.observe(el);

    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      progressRef.current = p;
      // copy block opacity handled via refs — zero React re-renders on scroll
      const windows: [number, number, number, number][] = [
        [0.02, 0.12, 0.30, 0.42],
        [0.34, 0.44, 0.54, 0.62],
        [0.60, 0.72, 0.92, 1.01],
      ];
      copyRefs.forEach((ref, i) => {
        const [a, b, c, d] = windows[i]!;
        const up = Math.min(1, Math.max(0, (p - a) / (b - a)));
        const down = 1 - Math.min(1, Math.max(0, (p - c) / (d - c)));
        const o = Math.min(up, down);
        if (ref.current) {
          ref.current.style.opacity = String(o);
          ref.current.style.transform = `translateY(${(1 - o) * 18}px)`;
        }
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const onVis = () => { activeRef.current = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section ref={rootRef} className="cx-wrap" aria-label={t('cx.eyebrow')}>
      <div className="cx-sticky">
        {mounted && (
          <div className="cx-canvas">
            <Canvas
              dpr={[1, 1.75]}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
              camera={{ fov: 45, position: [0, 0.5, mobile ? 7.4 : 5.4], near: 0.1, far: 40 }}
            >
              <Suspense fallback={null}>
                <Scene
                  progressRef={progressRef}
                  activeRef={activeRef}
                  mobile={mobile}
                  scopeRef={rootRef as React.MutableRefObject<HTMLElement | null>}
                />
              </Suspense>
            </Canvas>
          </div>
        )}

        <div className="cx-copy cx-right" ref={copyRefs[0]}>
          <p className="cx-eyebrow">{t('cx.eyebrow')}</p>
          <h3 className="cx-title">{t('cx.t1')}</h3>
          <p className="cx-desc">{t('cx.d1')}</p>
        </div>
        <div className="cx-copy cx-left" ref={copyRefs[1]}>
          <p className="cx-eyebrow">{t('cx.eyebrow')}</p>
          <h3 className="cx-title">{t('cx.t2')}</h3>
          <p className="cx-desc">{t('cx.d2')}</p>
        </div>
        <div className="cx-copy cx-center" ref={copyRefs[2]}>
          <h3 className="cx-title">{t('cx.t3')}</h3>
          <p className="cx-desc">{t('cx.d3')}</p>
        </div>
      </div>
    </section>
  );
}
