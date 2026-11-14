# Mobile regression tests

Run `pnpm --filter @workspace/stillwater-mobile test` from the workspace root.

- `checks.test.mjs` covers pure input and fixed-message helpers.
- `lifecycle.test.mjs` mounts the production Check screen, Companion provider,
  country and company screens, and Hook fish with React's test renderer.
- `support/` substitutes native rendering, navigation events, accessibility,
  haptics and AsyncStorage. The generated API client, fetch serialization,
  React Query hooks and QueryClient are real. Deferred fetch responses
  deliberately ignore cancellation so the stale-response guard is exercised,
  in both response orders and on late errors.

The suite checks cancellation, country/company/number replacement, directory
and alternative prefills, navigation blur/unmount, inactive/background/resume,
explicit-only POSTs, request-field allowlisting, duplicate taps, accessibility
announcements and uncertain fish states. It inspects populated query caches,
mutation caches, route arguments and all storage writes. Public directory
contacts may be cached; submitted-number check keys, responses and mutation
variables may not. Only saved curated company IDs are written to storage.

These tests use synthetic evidence fixtures and do not test backend evidence
decisions or the independent design prototype. They do not prove native iPhone
rendering, VoiceOver, Safari behavior or the OS's delivery of lifecycle events.
React's test-renderer deprecation notice is expected; its version is pinned to
the app's React version. Temporary bundled test modules are removed after import,
and native export outputs belong in the ignored root `generated-artifacts/`.
