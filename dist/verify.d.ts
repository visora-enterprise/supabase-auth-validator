import type { SupabaseAuthConfig, SupabaseUser } from "~/types";
export type VerifyFn = (token: string) => Promise<SupabaseUser>;
export declare function createVerifier(config: SupabaseAuthConfig): VerifyFn;
