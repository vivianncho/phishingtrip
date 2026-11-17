# Phishing Trip browser extensions

## Consumer release: no traveler setup

The website's `/extension` page reads official store URLs from `release.json`.
Blank URLs deliberately show **Not published yet**. Do not use fake store IDs,
link a ZIP as a one-click install, or expose a private deployment for this.

Once an approved public checking service is available, set its HTTPS origin in
`release.json` and run:

```sh
node extensions/stillwater/scripts/build.mjs --release
```

This first probes public capabilities without a phone number, cookies, login
redirects, Google requests or access tokens. A gated, malformed, preview or
absent service blocks the release. It does not publish anything or change
deployment visibility.

Consumer packages go in `generated-artifacts/stillwater-extension/release/`.
They declare only the fixed checking-service host permission at install time,
ignore developer connection overrides, and show **Privacy** instead of asking
travelers for an API address or key. Browser-level permission revocation remains
available. The normal build command still creates developer packages, not a
consumer release.

After store review, put the actual official Chrome, Edge and/or App Store URLs
in `release.json`, rebuild the website and publish through the approved release
process. No credentials belong in this file.

## On-page Hook and business discovery

Per-page opt-in opens the right-hand panel. Selecting a complete number moves
the approved awake Hook beside it on sufficiently wide pages. The selection
stays local; tapping Hook only opens the review form. Final consent is still
required before a check is submitted.

A browser-native extension port carries validated checking states to the
isolated helper. It requires this extension's sender ID, top-frame sender tab,
and a per-iframe random channel name. Web pages cannot establish that connection
even by embedding the public popup resource with a chosen fragment. No page-wide
messages can set a verdict. Other-number and old-iframe results are ignored.
Editing, new selection, revocation and transport failure clear the old glow.
Scrolling keeps Hook near its anchor; offscreen anchors hide the on-page fish.
On phones, Hide panel reveals Hook beside or below the number; tapping the same
Hook restores the existing evidence panel rather than discarding its result.
Reduced motion removes swimming and
hidden tabs pause it. Closing or navigating removes the helper and listeners.

After an unverified result, **Search Google Maps** sends only the explicitly
typed business/city search through the existing server-side Places integration.
It never includes page text, booking details or the API key. Results retain
Google/provider attribution and remain separate from official evidence; they
cannot turn Hook green. The shared ten-request daily provider limit is unchanged.

Shared, dependency-free Manifest V3 implementation for Chrome/Edge and a Safari
Web Extension resource package. This is independent of the fictional React
design sandbox.

## Build and tests

From the project root:

```sh
node --test extensions/stillwater/tests/*.test.mjs
node extensions/stillwater/scripts/build.mjs
# On a Mac with Xcode, generate a separate native iOS app + Safari extension:
node extensions/stillwater/scripts/package-safari.mjs com.company.Stillwater
# After publishing the API, optionally prefill a verified production origin:
node extensions/stillwater/scripts/build.mjs --api-origin https://your-domain.example
```

Node.js and Python 3's standard ZIP module are used; no new packages are needed.
Build outputs go to the ignored `generated-artifacts/stillwater-extension/`:
unpacked `chromium/` and `safari/` folders, plus corresponding ZIP archives.
The archives have `manifest.json` at the root.

See [INSTALL.md](INSTALL.md) for installation, both Apple packaging routes,
permissions, privacy and device-test prerequisites. No API credentials or
secret are included in any extension resource. Never configure production
with a workspace preview domain.

## Structure and trust boundaries

- `src/core.js`: bounded API transport, strict selected-number request contract,
  runtime validation, evidence-based result gates.
- `src/scan.js`: manually injected local-only candidate extraction, never page
  text uploads. Candidates can include false positives; selection is required.
- `src/selection.js`: selection-only capture; no DOM scan, URLs or network.
- `src/inline.js`: per-document opt-in number helper and `tel:` interception,
  right-hand extension-origin panel for review/consent. Activation opens the
  local panel without a request; highlighting a number does not submit it.
  No message proxy or remote fetch.
- `src/popup.js`: consent-first controller; only API-origin settings persist.
- `src/view.js`: source/evidence/alternative rendering using `textContent`.
- `src/images/`: local reference Hook SVG layers; assembled at the canvas coordinates in the popup, with no remote artwork requests.
- `src/icons/`: PNG toolbar/store icons rendered from those same layers.
- `scripts/build.mjs`: two manifest packages, including the local SVG layers and PNG icons.
- `scripts/package-safari.mjs`: Apple-tool native iOS project generation,
  independent of Expo, with no signing/upload or destructive overwrite.

The popup requires a country choice even for international input, although the
API itself permits omission for `+` numbers. The + prefix still takes precedence.
The consent summary states the exact number, country and optional company;
changing these clears consent. **Use selected number** captures only an existing
selection, whereas **Find numbers** performs a separately requested local scan.
Provider availability is a deliberate number-free request. Clear removes local
selection/results, including pending results; disconnect also removes the saved
API origin and its host permission. Neither operation recalls a request already
sent to the service. Browser-level permission removal invalidates visible and
pending results. No new permission is requested automatically.

There is intentionally no background service worker, remote code, blanket
content script, externally-connectable messaging, analytics, call button,
automatic link verification, or Google DOM-specific parsing. The extension
does not trust search ranking, AI prose, the selected company's name guessed
from a page, or Basic number metadata as ownership proof.

The popup uses promise-based WebExtension APIs (`browser` or `chrome`),
supported by current target browsers. Safari resource packaging and Node tests
are not the same as an Apple-signed, device-tested build.
