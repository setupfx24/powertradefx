import { createProxyHandler } from '@/lib/api/createProxyHandler';

export const dynamic = 'force-dynamic';

/**
 * /api/v1/* → FastAPI gateway. Multipart enabled for KYC docs +
 * deposit receipts. See createProxyHandler for the full security model
 * (redirect origin validation, CORS sanitization, multi-cookie support).
 */
export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = createProxyHandler({
  pathPrefix: 'api/v1',
  handleMultipart: true,
  logTag: 'api/v1 proxy',
});
