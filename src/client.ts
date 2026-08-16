import { createVerifier } from './verify';
import { AuthError, type SupabaseAuthConfig, type SupabaseUser } from './types';
import { extractBearerToken } from './middleware/generic';

export function createSupabaseAuth(config: SupabaseAuthConfig) {
  if (!config.supabaseUrl) {
    throw new Error('[supabase-auth-validator] supabaseUrl is required');
  }
  if (!config.jwtSecret) {
    // Not fatal — JWKS fallback works fine — but worth flagging since it's slower.
    console.warn(
      '[supabase-auth-validator] No jwtSecret configured for this app. ' +
        'Falling back to remote JWKS verification (network call + cache). ' +
        'If your Supabase project still uses the legacy HS256 JWT secret, set SUPABASE_JWT_SECRET for faster, offline-capable verification.'
    );
  }

  const verifyToken = createVerifier(config);

  /**
   * The one call every integration is built on: pass whatever the
   * Authorization header value is (string, string[], or null/undefined —
   * every framework hands it to you in one of these shapes) and get back
   * the verified user. Throws AuthError if missing/invalid.
   */
  async function authenticate(authorizationHeader?: string | string[] | null): Promise<SupabaseUser> {
    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw new AuthError('Missing bearer token', 'NO_TOKEN');
    }
    return verifyToken(token);
  }

  /** Throws AuthError if the user doesn't have one of the given roles. */
  function requireRole(user: SupabaseUser, roles: string[]) {
    const userRole = user.appMetadata?.role ?? user.role;
    if (!userRole || !roles.includes(userRole)) {
      throw new AuthError(`Requires one of roles: ${roles.join(', ')}`, 'FORBIDDEN', 403);
    }
  }

  return {
    /** One call that works the same in every framework: pass the Authorization header, get the user back. */
    authenticate,
    /** Verify a raw JWT string directly, if you already have the token without the "Bearer " prefix logic. */
    verifyToken,
    /** Manually check a role on an already-verified user. */
    requireRole,
    /** Pull a bearer token out of any framework's Authorization header, if you need it separately. */
    extractBearerToken,
  };
}

export type { SupabaseAuthConfig, SupabaseUser };
export { AuthError };
