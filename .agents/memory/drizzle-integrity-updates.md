---
name: Drizzle integrity updates
description: Non-obvious Drizzle push behavior when adding self-referencing identity constraints.
---

Do not assume a successful Drizzle CLI exit means new integrity constraints were applied.
Verify the database rejects invalid writes, and keep development schema updates atomic.

**Why:** Drizzle Kit 0.31 can emit a self-referencing foreign key before its new
supporting unique index, then print the SQL error but exit successfully. Using
a unique constraint instead can introduce a truncate-or-preserve prompt even
with the force flag, which is unsuitable for unattended setup.
Its introspection can also omit a unique index referenced by a foreign key,
causing later pushes to attempt recreating an index that already exists.
The API helper also drops query parameters during composite-primary-key
introspection; it cannot safely push a schema containing such keys until that
upstream adapter issue is addressed.

**How to apply:** When changing self-referencing identities, check prerequisite
index ordering and exercise rejected imports in PostgreSQL. Keep fixes in the
development schema-update tooling, never application startup or production
deployment hooks. Preserve existing organizations and contact evidence rather
than using truncation to make a schema push succeed.

Drizzle Kit 0.31.11's programmatic PostgreSQL `pushSchema` drops introspection
query parameters. Keep the version-scoped pnpm patch until an upstream version
passes the composite-primary-key introspection regression.

**Why:** Once composite primary keys existed, unattended merges failed with
PostgreSQL's “there is no parameter $1” before any schema changes could run.

**How to apply:** When upgrading the schema tool, exercise planning against a
real composite primary key. Keep SQL values bound rather than interpolating
identifiers or disabling integrity checks. The regression uses a disposable
schema inside a rolled-back transaction, so it does not modify application data.
This failure is a tooling limitation, not evidence of corrupt rows or an invalid
new index. Never delete tables or evidence to bypass it.
