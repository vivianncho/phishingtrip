---
name: Scheduled queue fairness
description: Why capped reminder batches need durable fair ordering rather than expiry order alone
---

Capped scheduled queues must make progress across runs, including when deliveries fail or repeat intervals have elapsed.

**Why:** Retrying an expiry-sorted queue from the beginning can let the same first batch consume every run's limit indefinitely. Deduplication alone does not prevent starvation when those attempts fail or become due again before the next run.

**How to apply:** Persist enough attempt history or a cursor to give never-attempted and long-deferred events priority. Test multiple capped runs with more events than the cap, repeated failures, recurring successes and lost process-local state. Assert eventual attempts, not merely per-run counts.
