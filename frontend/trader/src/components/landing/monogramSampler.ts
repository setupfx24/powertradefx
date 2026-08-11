'use client';

/**
 * Samples the brand favicon's pixels into particle target positions —
 * the Clarix logo-particle technique, shared by the hero monogram and
 * the scroll showcase.
 */
export const MONOGRAM_URL = '/marketing/powertradefx_fevicon.png';

export interface MonogramSample {
  positions: Float32Array;
  /** 1 = white glyph pixel, 0 = accent square pixel */
  glyph: Float32Array;
}

export function sampleMonogram(worldSize = 4.6, grid = 96): Promise<MonogramSample> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const N = grid;
      const c = document.createElement('canvas');
      c.width = N; c.height = N;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, N, N);
      const px = ctx.getImageData(0, 0, N, N).data;
      const pos: number[] = [];
      const gly: number[] = [];
      const scale = worldSize / N;
      for (let y = 0; y < N; y += 1) {
        for (let x = 0; x < N; x += 1) {
          const i = (y * N + x) * 4;
          if (px[i + 3]! < 100) continue;
          if ((x + y) % 2 !== 0) continue; // thin to ~half density
          pos.push((x - N / 2) * scale, -(y - N / 2) * scale, (Math.random() - 0.5) * 0.25);
          gly.push(px[i]! > 180 && px[i + 1]! > 180 ? 1 : 0);
        }
      }
      resolve({ positions: new Float32Array(pos), glyph: new Float32Array(gly) });
    };
    img.onerror = () => resolve({ positions: new Float32Array(0), glyph: new Float32Array(0) });
    img.src = MONOGRAM_URL;
  });
}
