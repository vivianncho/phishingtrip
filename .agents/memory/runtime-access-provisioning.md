---
name: Runtime database access provisioning
description: Why successful schema setup does not prove the restricted API can serve requests.
---

Provision database access roles explicitly as the trusted development owner;
never restore service by falling back to an owner connection or automatically
granting privileges during application startup, deployment, or merge setup.
Merge setup should verify runtime access without changing it.

**Why:** A merged security update switched API queries and shared abuse counters
to a restricted role that did not exist in the development database. Every
request failed before reaching the lookup routes, so both company choices and
provider availability stopped loading despite successful schema/seed setup.
Explicit access provisioning restored service without exposing private history.

**How to apply:** After provisioning or restoring a database, verify requests
using the actual restricted API identity, not only the schema owner. Cluster
roles and grants are not implied by table migrations. Keep missing or unsafe
access fail-closed and surface an actionable setup failure.
