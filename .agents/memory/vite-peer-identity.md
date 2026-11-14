---
name: Vite peer dependency identity
description: New artifact scaffolds can split Vite type identities through optional peers.
---

Align a new artifact's optional Vite peer versions with the existing workspace before changing working Vite configuration to suppress type errors.

**Why:** A slides scaffold pinned a different YAML version, causing pnpm to resolve two copies of the same Vite version under different peer contexts. Existing canvas plugins then failed typechecking despite having unchanged code.

**How to apply:** When plugin types report incompatible Vite imports, compare the complete pnpm paths, including peer suffixes. Align the new artifact's dependency and regenerate the lockfile; do not cast away errors in unrelated artifact configuration.
