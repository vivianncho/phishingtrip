# Stillwater

Travel phone-number evidence checker with a separate fish-companion design prototype.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API workflow command; uses its managed `PORT`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run seed:directory` — idempotent sourced airline seed; does not refresh review dates
- `pnpm --filter @workspace/api-server test` — decision, route, privacy and provider tests (requires seeded dev database)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: generated Zod API schemas, `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/api-server/README.md` — complete API/setup/privacy/provider/source-review documentation
- `lib/api-spec/openapi.yaml` — API contract; regenerate shared helpers after changes
- `lib/db/src/schema/` — persistent curated directory only
- `artifacts/api-server/src/verification/` — normalization, evidence rules, provider adapter and seed
- `artifacts/mockup-sandbox/` — independently developed design; not wired to live data

## Architecture decisions

- Directory matches are evidence of a published contact, never caller authentication or a safety guarantee.
- No submitted-number history or browsing data is persisted. Do not add this through analytics or logs.
- Reputation reports are not currently integrated.
- Twilio Basic is optional, server-only and disabled by default. Do not add premium lookup fields.

## Product

Anonymous number checks, sourced airline contact search and evidence-source capabilities.
The design's fictional scenarios are not real directory or reputation data.

## User preferences

Keep backend work separate from the design prototype. Expo and native Safari extension implementation are outside this backend's scope.

## Gotchas

- API title must remain `Api`; the health contract must remain unchanged.
- Seed reruns preserve actual review times; an expired source needs a new human review.
- Reverse-proxy trust is off by default. Verify proxy CIDRs before enabling address forwarding.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
