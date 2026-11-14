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
