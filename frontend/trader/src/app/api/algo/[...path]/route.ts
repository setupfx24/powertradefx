import { createProxyHandler } from '@/lib/api/createProxyHandler';

export const dynamic = 'force-dynamic';

/**
 * /api/algo/* → FastAPI gateway algo endpoints. Uses HMAC auth via
 * X-Api-Key / X-Api-Secret instead of JWT. No multipart needed
 * (algo endpoints take JSON only).
 */
export const { GET, POST, PUT, DELETE, OPTIONS } = createProxyHandler({
  pathPrefix: 'api/algo',
  extraRequestHeaders: ['x-api-key', 'x-api-secret'],
  logTag: 'api/algo proxy',
});
