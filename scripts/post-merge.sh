#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run audit:directory
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run seed:directory
# Check runtime permissions too: successful owner migrations do not prove the
# restricted API can serve lookups. Provisioning remains an explicit DBA action.
pnpm --filter @workspace/db run access:check
