---
name: Mobile test module identity
description: Avoid false missing-provider failures when combining generated API hooks with native test bundles.
---

Native component tests that bundle the generated client must share the same
React Query module entry with their provider.

**Why:** This workspace's React Query package exposes separate CommonJS and ESM
contexts. Mixing a normally imported ESM provider with hooks resolved through
the CommonJS entry caused “No QueryClient set” even with a provider mounted.

**How to apply:** When changing the mobile test loader or module format, preserve
provider/hook module identity. Treat an unexpected missing-provider error as a
possible dual-module-context issue before changing application providers.
