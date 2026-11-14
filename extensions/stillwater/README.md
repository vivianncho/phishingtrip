# Phishing Trip browser extensions

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
  extension-origin iframe for review/consent. No message proxy or remote fetch.
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
