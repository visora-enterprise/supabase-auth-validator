import { extractBearerToken } from "~/middleware/generic";
import { AuthError } from "~/types";
import type { SupabaseAuthConfig, SupabaseUser } from "~/types";
export declare function createSupabaseAuth(config: SupabaseAuthConfig): {
    /** One call that works the same in every framework: pass the Authorization header, get the user back. */
    authenticate: (authorizationHeader?: string | string[] | null) => Promise<SupabaseUser>;
    /** Verify a raw JWT string directly, if you already have the token without the "Bearer " prefix logic. */
    verifyToken: import("~/verify").VerifyFn;
    /** Manually check a role on an already-verified user. */
    requireRole: (user: SupabaseUser, roles: string[]) => void;
    /** Pull a bearer token out of any framework's Authorization header, if you need it separately. */
    extractBearerToken: typeof extractBearerToken;
};
export type { SupabaseAuthConfig, SupabaseUser };
export { AuthError };
