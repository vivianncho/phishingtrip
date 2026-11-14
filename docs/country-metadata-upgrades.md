# Upgrading phone country metadata

The runtime property-country allowlist comes from the installed
`libphonenumber-js/max` metadata. PostgreSQL retains a literal CHECK allowlist;
updating dependencies alone does not update that installed rule.

## Release procedure

1. Pin and review the dependency/lockfile update in a candidate release. Run the
   database package tests. Do not serve the candidate runtime yet.
2. Against the intended database, from that candidate checkout, run
   `pnpm --filter @workspace/db countries:check`. Use the project's secure
   environment configuration for `DATABASE_URL`, never a command-line password.
   This is a repeatable-read, read-only transaction. JSON output is deterministic
   for an unchanged database and metadata: sorted runtime/installed lists,
   added and removed codes, validation state, and affected property IDs/codes.
   Exit 0 means aligned, 2 means drift, and 1 means the check could not complete.
3. Review **every removed code**, even if no properties currently use it.
   `blockedProperties` lists records incompatible with the candidate set,
   including NULL/invalid codes. Resolve these through an explicit, audited
   location correction based on authoritative property evidence. Never infer a
   location from a phone number, delete records to pass the check, or refresh
   phone evidence/review dates. If a supported location has no replacement,
   postpone the metadata upgrade and decide policy with the operator.
4. Stop/drain all app replicas, importers, scheduled writers and review workers,
   retaining the old release for rollback. A database transaction cannot
   atomically replace code in multiple running processes. Keep traffic stopped
   until both constraint and runtime checks pass.
5. From the candidate checkout, with a schema-owner connection, run
   `pnpm --filter @workspace/db countries:upgrade`. It locks `public.companies`
   before auditing, refuses unknown/missing rules or incompatible records,
   replaces only `companies_property_country_check`, validates all rows and
   verifies alignment inside one transaction. Failure rolls back the whole
   replacement; the old constraint remains. Lock waits time out after 5 seconds;
   individual statements after 60 seconds. Resolve contention before retrying.
   An already-aligned constraint is a no-op. Exit codes match the check command.
6. Run `countries:check` again using the exact release metadata, start the new
   runtime, and resume traffic. Make this check a mandatory release gate for
   every phone metadata upgrade. Do not use a generic schema push as a substitute.

No command updates hotel rows, phone evidence, or review timestamps. The upgrade
only issues constraint DDL; it does not repair data automatically. An unknown or
missing constraint produces drift with null installed codes (not a guessed
removed-code list); have the schema owner investigate before continuing.
This tool is deliberately independent of Drizzle's composite-key schema tooling.
It targets the application table in `public`, not a search-path-selected table.

## Rollback

If the constraint transaction fails, keep the old application release running
only if its check still passes. If deployment fails after a successful upgrade,
keep writers stopped, use the old checkout to check and upgrade back to its
metadata, then restart the old runtime. A rollback can itself remove codes newly
introduced by the candidate; inspect affected records first. Never force past
those blockers or silently change country identity. The database change and
runtime rollout require this maintenance window; neither command runs on app
startup or automatically against production.
