'use client';

/**
 * Animated dot-matrix backdrop — a full-bleed WebGL plane that fades a
 * grid of square dots in from the centre outwards, then keeps flickering
 * them at random opacities.
 *
 * Uses the `three` already in package.json rather than a CDN <script>:
 * a second copy of three on the page breaks instanceof checks against the
 * bundled one, and the CDN build is unavailable offline / under a strict
 * connect-src policy.
 *
 * No prefers-reduced-motion gate here on purpose — see the note in
 * landing-fx.css: the kill-switch was removed on client request because
 * several target machines run Windows with OS animations disabled, which
 * froze every effect on the site. This animation is slow and ambient with
 * no flashing.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface DotMatrixBackdropProps {
  className?: string;
  /** Grid pitch, in the shader's notional pixel space. */
  totalSize?: number;
  /** Side of each square dot; must be < totalSize or the grid closes up. */
  dotSize?: number;
  /** Dot colours as 0..1 RGB triples. The shader picks one per cell. */
  colors?: Array<[number, number, number]>;
}

const VERTEX = /* glsl */ `
  precision mediump float;
  uniform vec2 u_resolution;
  out vec2 fragCoord;
  void main() {
    gl_Position = vec4(position, 1.0);
    fragCoord = (position.xy + 1.0) * 0.5 * u_resolution;
    fragCoord.y = u_resolution.y - fragCoord.y;
  }
`;

const FRAGMENT = /* glsl */ `
  precision mediump float;
  in vec2 fragCoord;

  uniform float u_time;
  uniform float u_opacities[10];
  uniform vec3 u_colors[6];
  uniform float u_total_size;
  uniform float u_dot_size;
  uniform vec2 u_resolution;

  out vec4 fragColor;

  float PHI = 1.61803398874989484820459;
  float random(vec2 xy) {
    return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
  }

  void main() {
    vec2 st = fragCoord.xy;
    st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
    st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

    float opacity = step(0.0, st.x) * step(0.0, st.y);

    vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

    float frequency = 5.0;
    float show_offset = random(st2);
    float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
    opacity *= u_opacities[int(rand * 10.0)];
    opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
    opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

    vec3 color = u_colors[int(show_offset * 6.0)];

    /* Intro sweep: cells light up in rings expanding from the centre. */
    float animation_speed_factor = 3.0;
    vec2 center_grid = u_resolution / 2.0 / u_total_size;
    float dist_from_center = distance(center_grid, st2);
    float timing_offset = dist_from_center * 0.01 + (random(st2) * 0.15);

    opacity *= step(timing_offset, u_time * animation_speed_factor);
    opacity *= clamp((1.0 - step(timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);

    fragColor = vec4(color, opacity);
    fragColor.rgb *= fragColor.a;
  }
`;

export function DotMatrixBackdrop({
  className,
  totalSize = 20,
  dotSize = 6,
  colors = [[1, 1, 1]],
}: DotMatrixBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /* Read inside the effect so changing them does not tear down the GL
     context — the effect intentionally runs once. */
  const optsRef = useRef({ totalSize, dotSize, colors });
  optsRef.current = { totalSize, dotSize, colors };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { totalSize: pitch, dotSize: dot, colors: palette } = optsRef.current;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    } catch {
      /* No WebGL (old browser, blocklisted GPU, headless). The parent
         paints its own background, so silently render nothing. */
      return;
    }
    // Uncapped devicePixelRatio means a 3x phone renders 9x the fragments
    // for a backdrop nobody inspects. 2 is plenty for hard-edged squares.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    /* The shader wants six colours; repeat the palette to fill it so a
       single-colour palette still indexes safely. */
    const swatches = Array.from({ length: 6 }, (_, i) => {
      const [r, g, b] = palette[i % palette.length] ?? [1, 1, 1];
      return new THREE.Vector3(r, g, b);
    });

    const uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_opacities: { value: [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1.0] },
      u_colors: { value: swatches },
      u_total_size: { value: pitch },
      u_dot_size: { value: dot },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      glslVersion: THREE.GLSL3,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /* Size off the canvas box, not window.innerWidth — the element is
       inset-0 on a positioned parent, and mobile URL-bar collapse changes
       its height without firing a useful window resize. */
    const resize = () => {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      // `false`: never touch inline style, CSS owns the layout box.
      renderer.setSize(w, h, false);
      // The x2 is the grid's density constant, not the pixel ratio — it
      // is what makes the dots read as fine at this pitch.
      uniforms.u_resolution.value.set(w * 2, h * 2);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let frame = 0;
    const start = performance.now();
    const tick = () => {
      frame = requestAnimationFrame(tick);
      uniforms.u_time.value = (performance.now() - start) / 1000;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      // Frees the GL context outright; without it a few route changes
      // hit the browser's ~16 live context limit and the canvas blanks.
      renderer.forceContextLoss();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

export default DotMatrixBackdrop;
