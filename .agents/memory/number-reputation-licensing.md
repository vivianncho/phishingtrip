---
name: Number reputation licensing
description: Why enterprise spam-label monitoring is not assumed to satisfy the traveler report use case.
---

Do not treat an enterprise outgoing-number reputation/label-monitoring product as a licensed source of public scam reports for arbitrary traveler-submitted numbers.

**Why:** Official Hiya documentation reviewed on 2026-11-14 scopes reputation access to verified registered business numbers and describes dynamic call labels, not attributable report records. A superficially similar API can have the wrong permission model and evidence meaning.

**How to apply:** Before adding reputation, establish consumer-query and redistribution rights, regional coverage, attributable evidence, review/expiry and correction rights. An aggregate label or absent result cannot justify “Reports found” or safety claims.

IPQualityScore's standard API access is not sufficient evidence of permission
to expose risk results in a public traveler lookup app.

**Why:** Its terms reviewed on 2026-11-14 restrict republishing API data and
offering substantially similar API clients to third parties without written
approval. The user authorized live risk checks, not bypassing provider terms.

**How to apply:** Check for an applicable written agreement before exposing
IPQS-derived results to travelers. Its fraud score and abuse flags are risk
signals, not individual attributable scam reports. See
https://www.ipqualityscore.com/terms-of-service, especially API & Data Usage.
Tellows advertises a Live API for lookup services and apps through its
partnership program; verify the actual partner license and US/CA/MX coverage
rather than assuming that a consumer subscription or blacklist key suffices.
