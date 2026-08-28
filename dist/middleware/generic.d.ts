/**
 * Pulls a bearer token out of an `Authorization` header value.
 * Works the same regardless of framework — pass in whatever header
 * string your framework gives you (Express, Fastify, Next.js, Koa, raw http, ...).
 */
export declare function extractBearerToken(header?: string | string[] | null): string;
