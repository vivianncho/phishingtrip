# Install Stillwater

These are real extension files, not the design mockup. They are an initial
developer build, **not store-approved or tested on an iPhone yet**. The browser
extension does not need to be added inside the Expo app to work.

## Before you connect

The evidence API must be published at a public HTTPS address with `/api/checks`
and `/api/companies`. A private preview or login-gated address will not work:
the extension deliberately sends no session cookies, tokens, or authentication.
Keep the backend's evidence data and provider limitations accurate. Never put
an administrative key or provider credential in the extension.

No API service is preconfigured unless an operator passes `--api-origin` at
build time. Setup explicitly asks for browser permission to your chosen API
origin. Connecting to someone else's service shares your selected number with
that operator; use only a Stillwater service you trust.

## Chrome and Microsoft Edge

1. Download the generated `chromium` folder to your computer (or extract
   `chromium.zip`).
2. Open `chrome://extensions` or `edge://extensions`.
3. Turn on **Developer mode**, choose **Load unpacked**, and select that folder.
4. Pin Stillwater to the browser toolbar.
5. Open Stillwater → **Setup**. Enter your public backend origin (for example,
   `https://your-domain.example`, without `/api`), click **Save & allow this
   service**, and accept the origin-specific permission prompt.

Developer mode is for local testing. Chrome Web Store / Edge Add-ons release
needs a developer account, review, privacy disclosures, and a production API.
No store submission has been made.

## iPhone/iPad Safari

The `safari` folder / `safari.zip` contains portable Manifest V3 web-extension
resources intended for current Safari (16.4 or later). It is **not** an `.ipa`
and cannot be installed on an iPhone by loading the folder.

### Route A — Apple's browser-based packager

Apple's current documentation provides a packaging route without a Mac:

1. Enroll in the Apple Developer Program and create an iOS app record in
   App Store Connect.
2. In App Store Connect, open **Users and Access → Xcode Cloud → Safari Web
   Extension Packager**.
3. Upload `safari.zip`, which includes the manifest at the archive root.
4. Review compatibility warnings and test the generated build using TestFlight.
5. After installing the containing app, enable Stillwater in Safari's extension
   settings. Invoke it from Safari's page menu.
6. Configure the same public backend through **Setup** and grant only the site
   access you intend to use.

Apple account enrollment, packaging, signing, device tests, and store review
must be completed by the app owner. Those external steps were not performed
by this project.

Official guide:
https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect

### Route B — Xcode on a Mac

With current Xcode installed, run:

```sh
xcrun safari-web-extension-packager /absolute/path/to/safari \
  --app-name Stillwater --bundle-identifier YOUR.REVERSE.DOMAIN.Stillwater \
  --swift --ios-only --copy-resources
```

For older Xcode versions where the tool has its previous name, use
`xcrun safari-web-extension-converter --help` and review compatibility warnings.
Select your Apple team, sign both targets, and run the containing app and Safari
extension on your iPhone. Do not ignore warnings about permissions, iframe
resources, or scripting: confirm the selected-number flow on a real device.

Official guide:
https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari

## Check a number directly from search

1. On Google, Bing, or another HTTPS page (including an AI answer), open
   Stillwater.
2. Choose **Find numbers on this page**. Discovery is local and bounded; it
   returns at most 20 number candidates, not trusted contacts.
3. Select the number you meant to call, or paste a complete number yourself.
4. For a national number, explicitly enter its country code (US, GB, etc.).
   Do not guess the country from where you are traveling.
5. Optionally search the travel directory and choose the company you intended.
   This helps detect a number listed for a different company.
6. Read the destination service, tick the consent box, and choose **Check this
   number**. Only this explicit action sends the selected fields.
7. Read the evidence, review date, service, region, alternatives and limitations.
   **Not verified does not mean scam.** An official match does not authenticate
   an incoming caller.

### Inline option

Choose **Check directly on this page** from the extension. A small local
Stillwater control appears on that tab. Select a complete number in ordinary
text and use the control, or tap a `tel:` phone link. Instead of dialing, the
helper opens an isolated extension panel. You must still review the number
and consent before a request is sent. There is no automatic scan-on-load or
automatic upload. This lasts only on that document; remove it with × or reload
the page. It does not rewrite Google's AI answer or add a verified badge to it.

Browser internal pages, PDFs, cross-origin embedded frames, closed shadow
roots, and some sites' frame policies may block page helpers. Use the toolbar
popup and manual paste if inline display is blocked. Never interpret a missing
button or a blocked helper as a verification result.

## Privacy and device checklist

- Required permissions: `activeTab`, `scripting`, `storage`. No permanent
  search-site access, history, cookies, clipboard-reading, or background script.
- The broad **optional** HTTPS declaration permits a user-selected backend;
  only that exact origin is requested during setup.
- Stored locally: API origin only. No phone numbers, selections, results,
  directory searches, or call history persist in extension storage.
- Requests include no page URL, title, AI answer, surrounding text, or cookies.
  Candidate discovery stays on the device.
- The backend / network operator still receives a number you submit and may
  observe request timing/IP. Hosting log and privacy policies still apply.
- Extension resources are web-accessible to render the isolated inline panel,
  but there is no externally-connectable message channel or auto-check URL.
  A prefilled number is not a completed check.
- Test Safari permission denial, no network, popup dismissal, selected-text
  retention, VoiceOver, Dynamic Type / text zoom, reduced motion, and phone-link
  interception on an actual device before distributing.
- For Chrome/Edge, verify the same permission and offline flows in an unpacked
  installation. Automated Node checks do not certify browser compatibility.
