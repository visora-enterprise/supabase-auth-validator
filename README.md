# @visora/supabase-auth-validator

Company-wide, backend-only core for validating Supabase-issued JWTs (Google
OAuth logins). No framework-specific code lives in this package — it just
exposes plain functions. Every app wires those functions into whatever
middleware shape its own framework wants, in a few lines.

It does **not** touch the frontend — it only validates the access token
your frontend already sends in the `Authorization: Bearer <token>` header.

## 1. Install it in any app

```bash
npm install git+ssh://git@github.com/visora/supabase-auth-validator.git#v1.0.0
```

`npm install` builds `dist/` automatically via the `prepare` script.

## 2. Configure per app

```ts
// auth.ts in each app
import { createSupabaseAuth } from "@visora/supabase-auth-validator";

export const auth = createSupabaseAuth({
  supabaseUrl: process.env.SUPABASE_URL!, // https://xxxxx.supabase.co
  jwtSecret: process.env.SUPABASE_JWT_SECRET, // optional
  allowedProviders: ["google"], // optional
});
```

### Advanced Configuration Options

If you need to customize the verification process, you can provide these additional options in `createSupabaseAuth`:

```ts
export const auth = createSupabaseAuth({
  supabaseUrl: process.env.SUPABASE_URL!,
  // jwtSecret: process.env.SUPABASE_JWT_SECRET,
  // allowedProviders: ["google"],

  // Advanced options:
  audience: "authenticated", // Defaults to 'authenticated'
  issuer: "https://your-project.supabase.co/auth/v1", // Defaults to `${supabaseUrl}/auth/v1`
  clockToleranceSec: 5, // Allowed clock skew in seconds. Defaults to 5.
  cacheJWKS: true, // Set false to disable JWKS caching (only when jwtSecret is not set). Defaults to true.
});
```

**About `jwtSecret`:**

- Legacy shared JWT secret (Dashboard → Settings → API → JWT Secret) →
  set it, verification happens locally (HS256), fast, no network call.
- Newer asymmetric signing keys → omit it, the package fetches and caches
  your project's public JWKS automatically.

Each app just sets its own env vars — nothing project-specific is
hardcoded in the package.

## 4. The API — four functions, that's the whole package

```ts
auth.authenticate(authorizationHeaderValue); // -> Promise<SupabaseUser>, throws AuthError
auth.verifyToken(rawTokenString); // -> Promise<SupabaseUser>, throws AuthError
auth.requireRole(user, ["admin"]); // -> void, throws AuthError if role doesn't match
auth.extractBearerToken(headerValue); // -> string ('' if missing/malformed)
```

`authenticate()` is the one you'll use almost everywhere — give it the
`Authorization` header value in whatever shape your framework hands it to
you (string, string[], or null/undefined), get the verified user back:

```ts
try {
  const user = await auth.authenticate(authorizationHeader);
  // user.id, user.email, user.appMetadata.role, user.provider, ...
} catch (err) {
  if (err instanceof AuthError) {
    // err.code: 'NO_TOKEN' | 'INVALID_TOKEN' | 'FORBIDDEN' | 'PROVIDER_NOT_ALLOWED'
    // err.statusCode: 401 or 403
  }
}
```

## 5. Wiring it into your own framework

Since there's no per-framework code in the package, you write a small
middleware/guard once per app using `authenticate()`. It's the same
handful of lines everywhere — only the request/response shape changes.

### Express

```ts
import { auth, AuthError } from "./auth";

function requireAuth(roles?: string[]) {
  return async (req, res, next) => {
    try {
      const user = await auth.authenticate(req.headers["authorization"]);
      if (roles) auth.requireRole(user, roles);
      req.user = user;
      next();
    } catch (err) {
      const e =
        err instanceof AuthError
          ? err
          : new AuthError("Unauthorized", "UNAUTHORIZED");
      res.status(e.statusCode).json({ error: e.code, message: e.message });
    }
  };
}

app.get("/me", requireAuth(), (req, res) => res.json(req.user));
app.post("/admin", requireAuth(["admin"]), (req, res) =>
  res.json({ ok: true }),
);
```

### Fastify

```ts
import { auth, AuthError } from "./auth";

function requireAuth(roles?: string[]) {
  return async (request, reply) => {
    try {
      const user = await auth.authenticate(request.headers["authorization"]);
      if (roles) auth.requireRole(user, roles);
      request.user = user;
    } catch (err) {
      const e =
        err instanceof AuthError
          ? err
          : new AuthError("Unauthorized", "UNAUTHORIZED");
      reply.code(e.statusCode).send({ error: e.code, message: e.message });
    }
  };
}

app.get("/me", { preHandler: requireAuth() }, async (request) => request.user);
```

### NestJS

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { auth, AuthError } from "./auth";

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    try {
      request.user = await auth.authenticate(request.headers["authorization"]);
      return true;
    } catch (err) {
      const e =
        err instanceof AuthError
          ? err
          : new AuthError("Unauthorized", "UNAUTHORIZED");
      throw e.statusCode === 403
        ? new ForbiddenException(e.message)
        : new UnauthorizedException(e.message);
    }
  }
}
```

### Next.js API routes / route handlers

```ts
import { auth, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await auth.authenticate(request.headers.get("authorization"));
    return Response.json(user);
  } catch (err) {
    const e =
      err instanceof AuthError
        ? err
        : new AuthError("Unauthorized", "UNAUTHORIZED");
    return Response.json(
      { error: e.code, message: e.message },
      { status: e.statusCode },
    );
  }
}
```

### Anything else (Koa, Hapi, raw `http`, a cron job, a CLI)

```ts
const user = await auth.authenticate(someHeaderValueFromWherever);
```

Same call, same return shape, same errors — every time.

## 6. What you get back on a valid token

```ts
{
  id: string;              // Supabase user id (sub claim)
  email?: string;
  role?: string;             // top-level 'role' claim, usually 'authenticated'
  appMetadata: object;      // includes provider, and any custom app_metadata.role etc.
  userMetadata: object;     // Google profile data (name, avatar_url, etc.)
  provider?: string;         // 'google'
  aud: string;
  exp: number;
  raw: object;                // full decoded JWT payload, for anything not surfaced above
}
```

## 7. Role-based access

Supabase Auth has no built-in roles, so this package reads
`app_metadata.role` (falling back to the top-level `role` claim). Set
custom roles per user via the Supabase Admin API or a Postgres trigger
that writes into `app_metadata`, then check with:

```ts
auth.requireRole(user, ["admin", "support"]); // throws AuthError if it doesn't match
```

## 8. Updating the package for all apps

1. Change this repo, bump the version, tag it: `git tag v1.1.0 && git push --tags`.
2. In each app: `npm install git+ssh://git@github.com/visora/supabase-auth-validator.git#v1.1.0`.

Apps upgrade on their own schedule since each pins an explicit tag.
