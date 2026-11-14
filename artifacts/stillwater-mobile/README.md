# Phishing Trip mobile

Expo SDK 58 iPhone-first implementation of Phishing Trip’s accepted visual
identity: deep teal ocean, pale lime accents, DM Sans / Space Grotesk, Hook, and
Check / Directory / My Trips. The separate mockup is not modified or connected.
Its invented companies and reports are not copied into the real app.

## Run

Use the managed `artifacts/stillwater-mobile: expo` workflow and the existing
API Server workflow. The mobile workflow injects `EXPO_PUBLIC_DOMAIN`, so the
generated API client can reach `/api` with an absolute HTTPS origin on device.
Browser preview uses the same routed API; no credentials are bundled.

The service implements `POST /api/checks`, directory search and company
details, and capabilities via `@workspace/api-client-react`. See
`../api-server/README.md` for server setup and privacy requirements.
No API contract, backend schema, provider configuration or mockup was changed.

## Privacy and evidence

- No Safari access, webview, page extraction, browsing stream or extension.
  A native Safari Web Extension is separate work.
- No number/country inference: select a country or international format
  explicitly, then tap Check. Directory selection only prefills a form.
- Only the three allowed check fields are transmitted, in the POST body.
  Numbers/results never enter routes, logs, analytics, storage or query keys.
- Checks use the generated imperative helper instead of a cached mutation,
  with abort/cancel, no retries and a 15-second timeout. A superseded response
  cannot replace the current check. Leaving Check or backgrounding clears
  results; backgrounding also clears the draft.
- My Trips persists only curated company IDs on-device. Sources and numbers
  are fetched fresh, not saved as an offline assurance or check history.
- Provider availability, reviewed/expiry dates, disputes, stale sources,
  limitations and current alternatives remain visible. Metadata never becomes
  ownership or reputation evidence. Uncertainty never produces a resting fish.
- Optional server-enabled Twilio Basic disclosure is visible before checking.
  Reputation remains unavailable unless the authoritative backend changes.

## Checks

```sh
pnpm --filter @workspace/stillwater-mobile run typecheck
node --experimental-strip-types --test artifacts/stillwater-mobile/tests/*.test.mjs
cd artifacts/stillwater-mobile
CI=1 pnpm exec expo install --check
pnpm dlx expo-doctor@latest
```

Use Expo Go for native device checks. JavaScript exports and a browser preview
are not proof of physical iPhone, VoiceOver or Safari-extension support.

Verified with Node 24.22.1 / pnpm 10.26.1, Expo 58.0.25, React Native 0.88.1:
clean isolated frozen-lockfile install, focused form/privacy tests, full workspace
typecheck, online Expo dependency alignment and Doctor, and iOS/Android/web
JavaScript exports. Physical Expo Go / VoiceOver testing has not been performed.

## Underwater scroll
`components/Depths.tsx` renders a decorative backdrop behind every `Page`: scrolling sinks from a lit waterline with sun shafts into deep water, with parallax bubbles and a small depth marker. It is scroll-linked and reversible, non-interactive, hidden from accessibility, and colours come from `depth` in `constants/colors.ts`. With Reduce Motion on (checked live), ambient bubble drift and large parallax are disabled; only the colour descent remains.

## Approved Hook artwork

Hook uses the approved canvas fish layers and teal/lime lighting. The four SVG
layers are bundled as local XML in `components/hookArt.ts` and rendered by the
installed Expo-supported `react-native-svg` 15.16.0. They do not fetch web URLs,
depend on the canvas server, or require an SVG transformer. The lantern's
browser filter is replaced with translucent native SVG glow circles.
Existing captions, explicit checks and evidence meanings are unchanged.

After approving canvas artwork or its placement, regenerate and commit the mobile bundle:

```bash
pnpm --filter @workspace/stillwater-mobile run generate:hook-art
pnpm --filter @workspace/stillwater-mobile run check:hook-art
```

The generator reads the four `hook-figma-*.svg` files and the literal image
placements and enclosing viewBox in the canvas's `Stillwater.tsx`. It preserves
path geometry, fills, strokes and source viewBoxes, using canvas image dimensions
rather than rounded source dimensions. Figma's root display style, overflow and
preserveAspectRatio are omitted as in the original native bundle. Only the
lantern filter definition and references are removed; its native glow circles in
`Hook.tsx` remain a deliberate approximation, not a converted blur. Filter changes
still change the source fingerprint and require review of that approximation.
Other browser-only content fails explicitly rather than being silently dropped.
Re-running the command does not rewrite an unchanged bundle. `check:hook-art` is
read-only and exits nonzero on drift, including a missing bundle. The normal
mobile test suite also checks freshness, placement, paint and conversion fixtures.
This command does not regenerate browser-extension toolbar icons.

Artwork verification (2026-11-14): Expo SDK 58 / React Native 0.88.1,
Node 24.22.1 / pnpm 10.26.1; Expo dependency alignment and Doctor passed;
mobile tests and typecheck passed; iOS and Android JavaScript exports passed.
The running Expo browser screen was visually checked at 390 × 844.
Tests compare every bundled fish path to the approved source and exercise
result reactions and live Reduce Motion changes. Physical iPhone / Expo Go
rendering remains unverified; JavaScript exports are not device-test evidence.
