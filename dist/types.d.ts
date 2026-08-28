import type { JWTPayload } from 'jose';
export interface SupabaseAuthConfig {
    /** Your Supabase project URL, e.g. https://xxxxx.supabase.co */
    supabaseUrl: string;
    /**
     * Legacy JWT secret from Supabase Dashboard > Settings > API > JWT Secret.
     * If provided, tokens are verified locally with HS256 (fast, no network calls).
     * If omitted, the package falls back to fetching the project's public JWKS
     * (works with newer Supabase projects that use asymmetric ES256/RS256 signing keys).
     */
    jwtSecret?: string;
    /** Expected audience claim. Defaults to 'authenticated'. */
    audience?: string;
    /** Expected issuer. Defaults to `${supabaseUrl}/auth/v1`. */
    issuer?: string;
    /** Allowed clock skew in seconds. Defaults to 5. */
    clockToleranceSec?: number;
    /** If set, only tokens issued via these login providers are accepted (e.g. ['google']). */
    allowedProviders?: string[];
    /** Set false to disable JWKS caching (only relevant when jwtSecret is not set). Defaults to true (10 min cache). */
    cacheJWKS?: boolean;
}
export interface SupabaseUser {
    id: string;
    email?: string;
    role?: string;
    appMetadata: Record<string, any>;
    userMetadata: Record<string, any>;
    provider?: string;
    aud: string;
    exp: number;
    /** Full decoded JWT payload, in case an app needs a claim not surfaced above. */
    raw: JWTPayload;
}
export declare class AuthError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode?: number);
}
