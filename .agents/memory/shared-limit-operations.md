---
name: Shared limit operations
description: Why replica and provider-key identity must not define independent budget scopes.
---

Keep anonymous abuse and provider-spend budgets shared across replicas and provider-key rotations. A new key is not a new account budget.

**Why:** The checker must remain anonymous and stateless without letting restarts, parallel replicas or credential rotation multiply upstream spending. Basic is currently documented as free, but that does not authorize paid packages or justify relying on unchanged pricing.

**How to apply:** Use the same counter database and consistent limits for every caller using the provider account. Preserve fail-closed behavior and require explicit spending approval before enabling upstream calls. Changes to provider pricing need a new reservation-cost review and provider-side spending protection, not just different credentials.
