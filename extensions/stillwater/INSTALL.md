# Install Phishing Trip

## For travelers, after store publication

Visit the website's **Get extension** page and follow the official store link
for your browser. Your browser must confirm installation; a website cannot
silently install it. On iPhone, install the Safari-containing app and enable
Phishing Trip in Safari's **Manage Extensions**.

The consumer release has its checking service built in. No Google API key or
backend address is needed. To use Hook, open the extension on a webpage and
choose **Turn on for this page**, select one number, tap Hook and review your
country/company before confirming the check.

The store listings and public checking service are not published by these
instructions. Until they are available, the website shows **Not published yet**.
The ZIP packages described below are development/testing packages, not the
one-click customer install.

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
that operator; use only a Phishing Trip service you trust.

## Chrome and Microsoft Edge

1. Download the generated `chromium` folder to your computer (or extract
   `chromium.zip`).
2. Open `chrome://extensions` or `edge://extensions`.
3. Turn on **Developer mode**, choose **Load unpacked**, and select that folder.
4. Pin Phishing Trip to the browser toolbar.
5. Open Phishing Trip → **Setup**. Enter your public backend origin (for example,
   `https://your-domain.example`, without `/api`), click **Save & allow this
   service**, and accept the origin-specific permission prompt.

### Show the panel beside your search results

1. Search normally in your browser. Open the pinned Phishing Trip extension.
2. Choose **Turn on for this page**. A right-hand Phishing Trip panel opens
   on this page only. It does not search the web for you or automatically
   verify numbers in results or AI answers.
3. Highlight one complete phone number in a result. Choose **Check [number]**
   above the panel, or tap a phone link on the page.
4. Review the selected number, choose United States, Mexico or Canada, and
   optionally choose the company from the sourced directory.
5. Give consent and choose **Check this number**. Only that action sends
   the selected check to your connected evidence service.
6. Read the sources. Green is an official listing match, not a safety
   guarantee. Red means pause; an unverified number is not proven fraud.
   A failed request has no evidence result and keeps Hook neutral.
7. Close the panel with **×** to remove the helper. Reloading or navigating
   away also removes it; turn it on again for each new search page.

The panel floats above the right side of the page; it does not change the
search engine's layout or replace its results. Some browser pages or site
security rules block injected panels. Use the extension toolbar popup instead
and paste the number when this happens.

Hook uses the same approved four-layer lantern-fish artwork as the app, stays
awake, and changes lantern color only after a completed check.

### Private-service limitation

The extension sends no login cookies or private access tokens. A private or
password-gated deployment will not work as its evidence service. Do not put
an administrative credential or a deployment bypass token in an extension
package distributed to other people. A public extension needs an explicitly
approved publicly reachable evidence API with the existing abuse controls;
do not change deployment visibility merely to install this package.

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
5. After installing the containing app, enable Phishing Trip in Safari's extension
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
# First build the portable resources from the project root:
node extensions/stillwater/scripts/build.mjs
# On your Mac, use your own registered reverse-DNS identifier:
node extensions/stillwater/scripts/package-safari.mjs com.company.Stillwater
```

This invokes Apple's `safari-web-extension-packager` with Swift, iOS-only,
copied resources and a separate native output directory at
`generated-artifacts/stillwater-safari-native`. The generated Xcode project has
a containing iOS app and Safari Web Extension target. Existing native output
is never overwritten. The script fails explicitly on Linux; this environment
cannot run Xcode or produce a signed `.ipa`. You can instead take `safari.zip`
to Route A. No Expo configuration or mobile code is changed.

For older Xcode versions where the tool has its previous name, use
`xcrun safari-web-extension-converter --help` and review compatibility warnings.
Select your Apple team, sign both targets, and run the containing app and Safari
extension on your iPhone. Do not ignore warnings about permissions, iframe
resources, or scripting: confirm the selected-number flow on a real device.

Official guide:
https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari

## Check a number directly from search

1. On Google, Bing, or another HTTPS page (including an AI answer), open
   Phishing Trip.
2. Select a complete phone number in Safari, then choose **Use selected number**
   in Phishing Trip; no clipboard is needed. If Safari loses the selection when
   opening its page menu, enable **Check directly on this page** first, then
   select the number there. Alternatively choose **Find numbers on this page**. Discovery is local and bounded; it
   returns at most 20 number candidates, not trusted contacts.
3. Select the number you meant to call, or paste a complete number yourself.
4. Explicitly enter the intended country (US, GB, etc.), including for + numbers.
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
Phishing Trip control appears on that tab. Select a complete number in ordinary
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

### Revoke and clear

**Clear number & result** removes the current form selection, candidates and
evidence; a late response cannot bring them back. This cannot undo an already
sent request. **Disconnect & remove saved settings** revokes the API origin
permission and removes the only saved setting. Page access is separate: in
Safari's page menu use Manage Extensions, or in Settings → Apps → Safari →
Extensions → Phishing Trip deny the website or disable the extension (older iOS
versions place Safari directly in Settings). Reload documents where the inline
helper was enabled to remove its page listeners. Uninstall the containing app
to remove its extension. None of these actions deletes upstream operator logs;
review the service's retention policy before connecting.

### Native release gate

Not performed here: Apple packaging, code signing, installation, or device
validation. Before distribution, use an actual iPhone/TestFlight build with
the operator-approved HTTPS service and verify:

- Select text and tap a `tel:` link after opt-in on ordinary and AI-answer pages.
  Capture produces candidates only and never a request or dial action.
- Select number/country/company, confirm the summary, tick consent, then check.
  Inspect traffic: only `/api/checks` with the three allowlisted fields; no page
  URL, text, referrer, cookies or history. Directory and availability requests
  happen only when their own buttons are pressed.
- Deny API/site permission; revoke during a delayed check; clear while waiting;
  close/reopen Safari; go offline; test 400, 429 and 503 responses. No old match,
  false all-clear or automatic retry should appear.
- Check source dates, expired/conflicting evidence, metadata unavailability,
  and a company with website-only support. Unknown is not a scam verdict.
- VoiceOver reads controls, consent summary, loading/error text and sources;
  verify large text and reduced motion. Record iOS/Safari version, build and
  results, using synthetic numbers rather than travelers' private data.
