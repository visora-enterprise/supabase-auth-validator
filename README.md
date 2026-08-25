# @visora/supabase-auth-validator

Company-wide, backend-only core for validating Supabase-issued JWTs (Google
OAuth logins). No framework-specific code lives in this package — it just
exposes plain functions. Every app wires those functions into whatever
middleware shape its own framework wants, in a few lines.

It does **not** touch the frontend — it only validates the access token
your frontend already sends in the `Authorization: Bearer <token>` header.

## 1. Install it in any app

```bash
npm install git+ssh://git@github.com/visora-enterprise/supabase-auth-validator.git#v1.0.0
```

`npm install` builds `dist/` automatically via the `prepare` script.

## 2. Configure per app

### TypeScript

```ts
import { createSupabaseAuth } from "@visora/supabase-auth-validator";
import type { SupabaseAuthConfig } from "@visora/supabase-auth-validator";

const config: SupabaseAuthConfig = {
  supabaseUrl: process.env.SUPABASE_URL!,
  jwtSecret: process.env.SUPABASE_JWT_SECRET,
  allowedProviders: ["google"],
};

export const auth = createSupabaseAuth(config);
```

### JavaScript

```js
const { createSupabaseAuth } = require("@visora/supabase-auth-validator");

export const auth = createSupabaseAuth({
  supabaseUrl: process.env.SUPABASE_URL,
  jwtSecret: process.env.SUPABASE_JWT_SECRET,
  allowedProviders: ["google"],
});
```

## 3. Advanced Configuration Options

If you need to customize the verification process, you can provide these additional options in `createSupabaseAuth`:

```ts
// Example in TypeScript
export const auth = createSupabaseAuth({
  supabaseUrl: process.env.SUPABASE_URL!,
  audience: "authenticated",
  issuer: "https://your-project.supabase.co/auth/v1",
  clockToleranceSec: 5,
  cacheJWKS: true,
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

## 5. Wiring it into your own framework

### Express

#### TypeScript
```ts
import { Request, Response, NextFunction } from "express";
import { auth, AuthError } from "./auth";

function requireAuth(roles?: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await auth.authenticate(req.headers["authorization"]);
      if (roles) auth.requireRole(user, roles);
      (req as any).user = user;
      next();
    } catch (err) {
      const e = err instanceof AuthError ? err : new AuthError("Unauthorized", "UNAUTHORIZED");
      res.status(e.statusCode).json({ error: e.code, message: e.message });
    }
  };
}
```

#### JavaScript
```js
const { auth, AuthError } = require("./auth");

function requireAuth(roles) {
  return async (req, res, next) => {
    try {
      const user = await auth.authenticate(req.headers["authorization"]);
      if (roles) auth.requireRole(user, roles);
      req.user = user;
      next();
    } catch (err) {
      const e = err instanceof AuthError ? err : new AuthError("Unauthorized", "UNAUTHORIZED");
      res.status(e.statusCode).json({ error: e.code, message: e.message });
    }
  };
}
```

### Fastify

#### TypeScript
```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { auth, AuthError } from "./auth";

function requireAuth(roles?: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await auth.authenticate(request.headers["authorization"]);
      if (roles) auth.requireRole(user, roles);
      (request as any).user = user;
    } catch (err) {
      const e = err instanceof AuthError ? err : new AuthError("Unauthorized", "UNAUTHORIZED");
      reply.code(e.statusCode).send({ error: e.code, message: e.message });
    }
  };
}
```

#### JavaScript
```js
const { auth, AuthError } = require("./auth");

function requireAuth(roles) {
  return async (request, reply) => {
    try {
      const user = await auth.authenticate(request.headers["authorization"]);
      if (roles) auth.requireRole(user, roles);
      request.user = user;
    } catch (err) {
      const e = err instanceof AuthError ? err : new AuthError("Unauthorized", "UNAUTHORIZED");
      reply.code(e.statusCode).send({ error: e.code, message: e.message });
    }
  };
}
```

### NestJS (TypeScript only)

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { auth, AuthError } from "./auth";

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    try {
      request.user = await auth.authenticate(request.headers["authorization"]);
      return true;
    } catch (err) {
      const e = err instanceof AuthError ? err : new AuthError("Unauthorized", "UNAUTHORIZED");
      throw e.statusCode === 403 ? new ForbiddenException(e.message) : new UnauthorizedException(e.message);
    }
  }
}
```

### Next.js API routes

#### TypeScript
```ts
import { auth, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await auth.authenticate(request.headers.get("authorization"));
    return Response.json(user);
  } catch (err) {
    const e = err instanceof AuthError ? err : new AuthError("Unauthorized", "UNAUTHORIZED");
    return Response.json({ error: e.code, message: e.message }, { status: e.statusCode });
  }
}
```

#### JavaScript
```js
const { auth, AuthError } = require("@/lib/auth");

export async function GET(request) {
  try {
    const user = await auth.authenticate(request.headers.get("authorization"));
    return Response.json(user);
  } catch (err) {
    const e = err instanceof AuthError ? err : new AuthError("Unauthorized", "UNAUTHORIZED");
    return Response.json({ error: e.code, message: e.message }, { status: e.statusCode });
  }
}
```

## 6. What you get back on a valid token

```ts
// TypeScript interface
interface SupabaseUser {
  id: string;
  email?: string;
  role?: string;
  appMetadata: object;
  userMetadata: object;
  provider?: string;
  aud: string;
  exp: number;
  raw: object;
}
```

## 7. Role-based access

```ts
// Check roles
auth.requireRole(user, ["admin", "support"]); // throws AuthError if it doesn't match
```

## 8. Updating the package for all apps

1. Change this repo, bump the version, tag it: `git tag v1.1.0 && git push --tags`.
2. In each app: `npm install git+ssh://git@github.com/visora/supabase-auth-validator.git#v1.1.0`.
