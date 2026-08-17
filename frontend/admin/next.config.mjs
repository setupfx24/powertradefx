import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
// Baked at `next build`; use .env.local GATEWAY_INTERNAL_URL=http://127.0.0.1:8000 for local `next dev`.
const gatewayTarget = process.env.GATEWAY_INTERNAL_URL || 'http://gateway:8000';
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  ...(isDev && {
    experimental: {
      staleTimes: { dynamic: 0, static: 0 },
    },
  }),

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${gatewayTarget.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
  async headers() {
    if (isDev) {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
            { key: 'Pragma', value: 'no-cache' },
          ],
        },
      ];
    }
    /* Stale-deploy / ChunkLoadError prevention (production).
     *
     * Next.js stamps statically-rendered pages with a one-year shared-cache
     * `Cache-Control: s-maxage=31536000`, so a browser/CDN keeps serving old
     * HTML whose content-hashed chunk <script> tags a later deploy replaced →
     * the dynamic import 404s → ChunkLoadError. Force HTML + RSC payloads to
     * revalidate every request; the negative lookahead leaves the immutable
     * `/_next/static/*` chunks and `/_next/image` caching intact. */
    return [
      {
        source: '/((?!_next/static/|_next/image).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
