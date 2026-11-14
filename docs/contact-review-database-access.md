# Contact review database access

Audit notes and before/after snapshots are private operational records, not
traveler evidence. Table permissions, rather than a maintenance convention,
protect them. The database owner and superusers can still change records:
this is protection against ordinary operator mistakes, not tamper-proof storage
against the DBA.

## Roles

| NOLOGIN role | Allowed access |
| --- | --- |
| `phishing_history` | SELECT audit records and source IDs only |
| `phishing_review` | SELECT provenance, UPDATE only source URL/assertion/review dates, INSERT audit records, execute the provenance-lock helper |
| `phishing_api` | SELECT public directory data, SELECT/INSERT/UPDATE reminder delivery bookkeeping, SELECT/INSERT/UPDATE/DELETE shared usage counters; no audit access |

All three lack UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER on the audit
table. The review role deliberately cannot read private audit history; use a
separate history operator when needed. No role can delete a source or modify
company/contact identity. No broad grants on future tables are made.

## Initial provisioning

1. The trusted DBA creates/updates the ordinary Drizzle schema using the existing
   project process. Never run schema setup as an operator/API login.
2. Review and explicitly run `lib/db/security/contact-review-roles.sql` as the
   trusted schema owner/DBA against the intended database. In development:
   `pnpm --filter @workspace/db run access:configure`.
   This is access administration, not an application startup/build step, a
   post-merge migration, or an automatic production migration. This task does
   not change production permissions. The DBA must arrange equivalent access
   provisioning for the target environment using its supported administration
   tools. Schema publishing alone must not be assumed to copy cluster roles,
   memberships, function ownership, or ACLs.
3. Create distinct authentication identities using the database provider's secure
   administration flow. Do not put passwords, connection strings, or credentials
   in SQL files, source control, review JSON, logs, or chat. Authentication and
   credential rotation belong to the provider/secret manager, not this code.
4. Grant each identity **only one** matching role (without ADMIN OPTION):

   ```sql
   -- Example identity names, created separately through secure administration.
   GRANT phishing_history TO contact_history_operator;
   GRANT phishing_review TO contact_review_operator;
   GRANT phishing_api TO travel_api_service;
   ```

   Login identities must be NOSUPERUSER, NOCREATEDB, NOCREATEROLE,
   NOREPLICATION, NOBYPASSRLS, NOINHERIT; must own no application objects;
   and must have no direct table/column grants or other role memberships.
   Grant database CONNECT and schema USAGE if required by the provider.
   Never grant owner membership or the ability to SET ROLE to an owner.
   Do not reuse one login across these processes.
5. Supply that process's dedicated connection through server-side `DATABASE_URL`
   using secure deployment/operator configuration. The code does not create,
   request, print, or rotate credentials. The API's directory and scheduler use
   `phishing_api`; the review command's queue/review actions use
   `phishing_review`; the history command uses `phishing_history`.
   The notification CLI actions use the API identity, not the review identity.
   Seeding/schema commands require a separate administrative connection.

The pool sets its fixed role as a PostgreSQL connection option **before the first
query**. Missing membership/roles fails closed, without falling back to the
owner. Counter reservations, provider budgets, and expired-counter cleanup use
the same API-role pool, not the administrative pool.
The development owner connection can assume the roles for integration
checks; it must never be the production service/operator credential. Role
selection on an owner connection alone is NOT a defense against arbitrary SQL:
an owner can RESET ROLE. Dedicated login isolation is essential.

The script is transactional and may be reapplied. It refuses to repurpose roles
that are logins, own relations, have elevated flags, or inherit other roles.
Existing installations require a DBA audit of PUBLIC, direct and inherited
grants, column ACLs, schema CREATE privileges, and callable SECURITY DEFINER
functions/views. Revoke unneeded grants at their origin; a table REVOKE cannot
cancel a grant inherited from another role. Do not grant CREATE in the
application schema to runtime identities. The script removes PUBLIC audit
table/column access and default PUBLIC execution on the locking helper.
It does not broadly revoke unrelated application permissions.

The locking helper must remain owned by the trusted DBA. It has a fixed
`pg_catalog, pg_temp` search path, fully qualified relation names, no dynamic
SQL, and only locks the requested source and its provenance rows. It grants no
way to change those company/contact rows. Source update plus audit insertion
remain in the same transaction: an audit failure rolls back the source update.
Do not replace this with separate connections or commit the source first.

## Verify and maintain

After development access setup, run:

```sh
pnpm --filter @workspace/api-server exec tsx --test src/verification/review-permissions.test.ts
pnpm --filter @workspace/api-server test
```

The integration check opens distinct role-scoped PostgreSQL sessions, checks
denied reads/mutations, runs actual review/history code, forces an audit insert
failure after the source update, and verifies rollback, snapshots, and replay
protection. Only the trusted fixture connection creates/removes its own rows.
No test grants audit mutation access to an operator.

For each real login, the DBA should also check `current_user`, `session_user`,
`has_table_privilege`, `has_column_privilege`, `pg_auth_members`, object ownership,
and available SECURITY DEFINER functions. Confirm that RESET ROLE cannot reach
an owner or a different operator role. Recheck after restoring a database,
changing grants, or replacing tables/functions. New audit columns must not gain
PUBLIC access. Keep production authentication checks in the provider's secure
administration session, never by committing credentials into a test.

Anonymous HTTP routes do not import the history reader and have no history
endpoint. Even an accidental audit SELECT through the API database connection
is rejected by PostgreSQL. API error handling returns a generic service error,
not database diagnostics or notes.
