/**
 * Pulls a bearer token out of an `Authorization` header value.
 * Works the same regardless of framework — pass in whatever header
 * string your framework gives you (Express, Fastify, Next.js, Koa, raw http, ...).
 */
export function extractBearerToken(header?: string | string[] | null): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return '';
  const [scheme, token] = value.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') return '';
  return token;
}
