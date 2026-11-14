---
name: Property country policy
description: Why property countries share the phone checker's supported territory set instead of all ISO regions.
---

Property countries must use the phone checker's supported country-code set, not
an independent full ISO list. Reject noncanonical imports rather than silently
uppercasing, trimming, or substituting aliases.

**Why:** A stored location must be usable by the directory's country filter and
consistent with phone validation. A syntactically valid two-letter value alone
does not establish support. This intentionally includes supported territories
and excludes ISO regions without numbering-plan support.

**How to apply:** Keep database constraints, pre-import audits, and directory
filter validation aligned when country metadata changes. Invalid existing
values require an explicit operator correction; do not infer locations from
phone numbers or refresh contact evidence to repair identity metadata.

Metadata upgrades require a coordinated maintenance window for database rules
and all runtime/import workers, not just an atomic database constraint update.

**Why:** PostgreSQL can commit the new allowlist atomically, but old processes
can still validate against old metadata until they are drained and replaced.

**How to apply:** Audit with the candidate metadata before rollout, resolve
removed-country records explicitly, stop writers, update the constraint, then
verify the candidate runtime before restoring traffic. Apply the same discipline
when rolling back to metadata with fewer supported countries.
