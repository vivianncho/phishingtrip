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

**How to apply:** When changing self-referencing identities, check prerequisite
index ordering and exercise rejected imports in PostgreSQL. Keep fixes in the
development schema-update tooling, never application startup or production
deployment hooks. Preserve existing organizations and contact evidence rather
than using truncation to make a schema push succeed.
