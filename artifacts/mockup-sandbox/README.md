# Stillwater local regression checks

Run from the repository root:

```sh
pnpm --filter @workspace/mockup-sandbox test
pnpm --filter @workspace/mockup-sandbox run typecheck
```

Use `pnpm --filter @workspace/mockup-sandbox test:watch` during development.
The test command is non-interactive and exits unsuccessfully on a regression.

The Vitest/jsdom suite renders the actual companion and parent components.
It covers all three number/outcome mappings, stale results after rapid target
changes, timer cleanup during either pending phase, mode/input/reset/navigation
changes, manual company and number matching, unknown company neutrality, and
round-trip directory routing for every fictional contact.

Tests use fake timers and independent expected fixtures. No server, API key,
database, real lookup, phone call, or browser session is required. The harness
rejects fetch, XHR, WebSocket, EventSource, beacon, window opening, and link
activation. Dialog and scrolling methods are minimal jsdom shims; this suite
does not claim to verify native Safari dialog behavior, layout, or VoiceOver.
