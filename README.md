# Streamyst

A form builder: creators compose forms, share a link or QR code, and collect
responses from an audience.

Monorepo on [Turborepo](https://turborepo.com) + [pnpm](https://pnpm.io), 100% TypeScript.

## Layout

```
apps/
  api/          Express 5 + tRPC v11. Serves /trpc, /api (OpenAPI), /docs, /health
  web/          Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui
packages/
  trpc/         Router, context, procedures, OpenAPI metadata, cookie helpers
  services/     Business logic. Owns its own zod input models and DB access
  database/     Drizzle ORM schema + migrations against PostgreSQL
  logger/       Winston logger with zod-validated env
  eslint-config/  Shared flat ESLint configs (base, node, next-js, react-internal)
  typescript-config/  Shared tsconfig presets
```

A request flows `route (tRPC, OpenAPI meta, zod input/output) → service (re-validates
input, checks ownership, talks to Drizzle) → PostgreSQL`. The web app wraps each
procedure in a React Query hook under `apps/web/hooks/api/`.

## Prerequisites

- Node 18+ (developed on 22)
- pnpm 9
- PostgreSQL 15+ — `docker compose up -d` from the repo root

## Setup

```sh
pnpm install
cp .env.example .env      # then edit it
./setup.sh                # symlinks .env into every apps/* and packages/*
docker compose up -d
pnpm db:migrate
```

`setup.sh` is what lets each package resolve `.env`, since every script is prefixed
with `dotenv --` and runs with the package directory as its cwd.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the API (`:8000`) and web (`:3000`) together |
| `pnpm build` | Builds every package and app |
| `pnpm lint` | ESLint across the monorepo |
| `pnpm check-types` | `tsc --noEmit` in every package |
| `pnpm test` | Vitest unit tests |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm format` | Prettier over all TS/TSX/MD |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Drizzle Studio |

Run any task scoped to one package with a filter, e.g.
`pnpm turbo dev --filter=web`.

## API

Once `pnpm dev` is running:

- `GET /health` — liveness
- `GET /openapi.json` — generated OpenAPI 3.1 document
- `GET /docs` — Scalar API reference, rendered from that document
- `POST|GET|PATCH|DELETE /api/...` — the same router over plain REST
- `/trpc/*` — the tRPC HTTP endpoint used by the web app

Sessions are httpOnly cookies named `authentication-token` holding a JWT. The
OpenAPI document describes this as an `apiKey`/`cookie` security scheme.

## Environment

`apps/api/src/env.ts`, `packages/services/env.ts`, `packages/database/env.ts` and
`packages/logger/env.ts` each parse their own slice of `process.env` with zod and
throw at boot if anything is missing or malformed. See `.env.example` for the full
list. `apps/web/env.js` validates the `NEXT_PUBLIC_*` variables with
`@t3-oss/env-nextjs`.

## Conventions

- **Errors.** Services raise `AppError` (`packages/services/utils/errors.ts`) and
  never import `@trpc/server`. `packages/trpc/server/trpc.ts` maps them onto tRPC
  codes in one middleware; the Express error handler maps them onto HTTP statuses.
  Anything else is treated as a bug, logged in full and reported to the caller as a
  generic 500 with no stack outside development.
- **Ownership.** Every service method that touches a form takes a required `userId`.
  The check lives in the service (`packages/services/utils/ownership.ts`) so that
  forgetting it is a compile error rather than a data leak.
- **Input schemas.** Service `model.ts` files own the zod schemas. Route files
  re-export them; only output schemas live in the router.
- **`labelKey`.** Field slugs are derived once at creation and never updated, so
  existing responses keep resolving after a field is renamed.

## Design

`DESIGN.md` is the source of truth for the visual language — colour, type scale,
radius, spacing and component surfaces. The current token values in
`apps/web/app/globals.css` are still shadcn defaults and have **not** been mapped
to it yet; that is scheduled for the design-system phase.
