import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { AuthError, type SupabaseAuthConfig, type SupabaseUser } from './types';

export type VerifyFn = (token: string) => Promise<SupabaseUser>;

export function createVerifier(config: SupabaseAuthConfig): VerifyFn {
  const baseUrl = config.supabaseUrl.replace(/\/$/, '');
  const issuer = config.issuer ?? `${baseUrl}/auth/v1`;
  const audience = config.audience ?? 'authenticated';
  const clockTolerance = config.clockToleranceSec ?? 5;

  const secretKey = config.jwtSecret ? new TextEncoder().encode(config.jwtSecret) : null;

  // Only created when there's no static secret — resolved lazily so we don't
  // make a network call until the first request actually needs verifying.
  let remoteJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
  function getRemoteJWKS() {
    if (!remoteJWKS) {
      const jwksUrl = new URL(`${baseUrl}/auth/v1/.well-known/jwks.json`);
      remoteJWKS = createRemoteJWKSet(jwksUrl, {
        cooldownDuration: 30_000,
        cacheMaxAge: config.cacheJWKS === false ? 0 : 10 * 60 * 1000,
      });
    }
    return remoteJWKS;
  }

  return async function verifyToken(token: string): Promise<SupabaseUser> {
    if (!token) {
      throw new AuthError('No token provided', 'NO_TOKEN');
    }

    let payload: JWTPayload;
    try {
      if (secretKey) {
        const result = await jwtVerify(token, secretKey, { issuer, audience, clockTolerance });
        payload = result.payload;
      } else {
        const result = await jwtVerify(token, getRemoteJWKS(), { issuer, audience, clockTolerance });
        payload = result.payload;
      }
    } catch (err: any) {
      throw new AuthError(`Invalid or expired token: ${err?.message ?? 'unknown error'}`, 'INVALID_TOKEN');
    }

    const appMetadata = (payload.app_metadata as Record<string, any>) ?? {};
    const userMetadata = (payload.user_metadata as Record<string, any>) ?? {};
    const provider = appMetadata.provider as string | undefined;

    if (config.allowedProviders && config.allowedProviders.length > 0) {
      if (!provider || !config.allowedProviders.includes(provider)) {
        throw new AuthError(
          `Login provider "${provider ?? 'unknown'}" is not allowed for this app`,
          'PROVIDER_NOT_ALLOWED',
          403
        );
      }
    }

    return {
      id: payload.sub as string,
      email: payload.email as string | undefined,
      role: payload.role as string | undefined,
      appMetadata,
      userMetadata,
      provider,
      aud: Array.isArray(payload.aud) ? payload.aud[0] : (payload.aud as string),
      exp: payload.exp as number,
      raw: payload,
    };
  };
}
