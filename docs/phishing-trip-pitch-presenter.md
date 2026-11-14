# Phishing Trip — presenter notes and source ledger

Prepared from the repository on 14 November 2026. This is a short product/demo pitch, not a claim of production availability. No credentials were inspected and no live provider lookups were made for this presentation.

## Presenter script

### 1. Phishing Trip
Travelers in distress do not have the luxury of time to fact-check everything. Phishing Trip aims to reduce the effort of checking a travel phone number before calling. Meet Hook, the fish companion. The product brings available evidence into view; it does not promise a safe call.

### 2. A disrupted trip
Imagine a canceled flight, a hotel plan that needs changing, and an unfamiliar support number. This is an illustrative scenario, not a customer story or research finding. The problem is the work of checking while already under pressure. We have not measured time saved.

### 3. Evidence in one place
The user explicitly submits one number. The app displays the evidence result, source links, review and expiry information, provider status, limitations and any current sourced alternatives. Hook reacts to the result or pending state; Hook is not an AI fraud detector. Any simplified screen in the deck is a UI illustration, not a live result.

### 4. Three places to turn
Check accepts a number and an explicit dialing country or international format. Directory offers sourced company contacts and separately attributed Google Places discovery. My Trips saves curated company IDs on-device and fetches current contacts again. It does not store bookings, a check history, or an offline assurance.

The browser companion is separate: Chrome/Edge extension source and portable Safari resources exist. It can discover candidate numbers locally after a user action, then submit only an explicitly reviewed selection. The mobile app cannot inspect Safari. Safari still needs Apple packaging, signing and physical-device validation; neither this deck nor the code establishes App Store approval.

### 5. A deliberate journey
Enter a number or select a contact to prefill Check. Select the number's country where needed; do not infer it from the traveler's location. Tap to check. Read the explanation and source freshness. Then decide whether to use a current sourced contact, the company's own app, or a booking confirmation. Selection alone does not submit a check, and the deck does not promise automatic dialing.

For a live demo, use Check and the sourced Directory only after confirming the API and directory are available. Do not submit a Google Places search merely to demonstrate this deck. When a provider or directory is unavailable, show that state honestly rather than inventing a successful result.

### 6. APIs with distinct jobs
The mobile client and separate extension submit to the project's Express API. The API normalizes numbers and evaluates source-backed directory records in PostgreSQL. The extension needs a user-approved public HTTPS API origin; this pitch does not establish a production endpoint.

Google Places API (New), Text Search is implemented server-side for business discovery, including available addresses, listed phones, websites and attribution. It is separate from the curated directory and never supplies a safety verdict. Live access is not verified. API enablement, billing and compatible server-key restrictions are prerequisites. The configured limit is 10 outbound attempts per UTC day across instances sharing the same counter database; failures count. It is not a dollar cap or a shared allowance across independently stored environments.

Twilio Lookup v2 Basic is optional, server-only and disabled by default. It supplies numbering-plan validity and formatting metadata only. No premium Fields are requested. It does not prove ownership, identify scams, authenticate a caller or change the directory decision. Live provider success is not claimed.

No integrated scam-report feed or runtime LLM API is claimed. The fictional design canvas is not evidence of either capability.

### 7. Built together in Replit
Replit supported Agent-assisted development and task iteration in a shared workspace containing the Expo mobile app, Express API and separate design canvas. Managed Expo and API previews supported development. PostgreSQL supports the sourced directory and operational counters. Test, typecheck and build workflows support iteration.

These are development facts, not a claim of production deployment, a measured productivity gain, or runtime AI decisions. Existing scripts are evidence that checks are provided, not proof that every target device or release process passed.

### 8. Trust includes uncertainty
A current official-source match means that exact number was published for the relevant contact. It does not authenticate an incoming caller; caller ID can be spoofed. Missing, stale or conflicting evidence must remain visible. “Not verified” is not proof of fraud.

Submitted numbers and results are not persisted as check history. Mobile results are cleared when leaving Check or backgrounding; the draft is cleared on backgrounding. Do not say that nothing is processed or retained anywhere: enabled Twilio Basic has short-lived in-process metadata caching, operational counters exist, and external providers apply their own policies. My Trips persists only curated company IDs. Google search text/results are ephemeral and are cleared on exit/backgrounding.

Physical iPhone rendering, VoiceOver and signed Safari release readiness are not established by a browser preview or JavaScript export. Public terms/privacy and provider release requirements remain separate readiness work.

### 9. A clearer next call
Close on the intended value: less effort spent checking, more attention available for the disrupted trip. Invite a demo: choose a number, inspect the evidence, decide the next step. Do not imply a measured impact, guarantee of safety, automatic fraud detection, partnership or launch approval.

## Fact and source ledger

The following repository paths are audit references, not public download links.

| Claim | Status and boundary | Primary implementation/documentation |
| --- | --- | --- |
| Check, evidence and alternatives | Implemented; explicit submission, current source evidence, no safety verdict | `artifacts/stillwater-mobile/app/(tabs)/index.tsx`; `artifacts/api-server/README.md`, sections Endpoints, Evidence and review procedure |
| Sourced Directory | Implemented; limited coverage, provenance and freshness visible | `artifacts/stillwater-mobile/app/(tabs)/directory.tsx`; `artifacts/api-server/README.md`, Directory |
| My Trips | Implemented; curated company IDs saved locally, current details fetched again | `artifacts/stillwater-mobile/app/(tabs)/trips.tsx`; `artifacts/stillwater-mobile/README.md`, Privacy and evidence |
| Hook | Existing approved artwork and check-state reactions; not AI inference | `artifacts/stillwater-mobile/components/Hook.tsx`; `artifacts/stillwater-mobile/components/hookArt.ts`; `artifacts/mockup-sandbox/public/images/hook-figma-*.svg` |
| Brand | Phishing Trip, deep teal/lime/light text, DM Sans and Space Grotesk | `artifacts/stillwater-mobile/constants/colors.ts`; `artifacts/stillwater-mobile/README.md`; project brief |
| Google Places | Text Search implementation exists; live access unverified; discovery only | `artifacts/api-server/src/verification/places.ts`; `docs/google-places-search.md`; `artifacts/stillwater-mobile/components/PlacesSearch.tsx` |
| Twilio | Lookup v2 Basic optional and disabled by default; validity/format only | `artifacts/api-server/src/verification/twilio.ts`; `artifacts/api-server/README.md`, Optional Twilio Basic metadata |
| Express and PostgreSQL | Own API and curated records; not an AI verdict service | `replit.md`; `artifacts/api-server/README.md`; `lib/api-spec/openapi.yaml` |
| Extensions | Separate Chrome/Edge source and Safari resources; not proof of signed/device-tested release | `extensions/stillwater/README.md`; `extensions/stillwater/INSTALL.md` |
| Replit development | Agent task iteration, shared artifacts, managed previews, test/build scripts | `replit.md`; `.replit`; mobile/API package scripts; current project task assignment |
| Privacy | No persisted submitted-check history; IDs-only local saves; processing/caching caveats above | `artifacts/stillwater-mobile/README.md`; `artifacts/api-server/README.md`; `docs/google-places-search.md` |
| Reputation/runtime AI | Not integrated; canvas fiction must not be treated as a real capability | `replit.md`, Architecture decisions; `artifacts/api-server/README.md` |

## Official technical references

These references explain the provider/platform interfaces; they are not evidence that a live request or release succeeded. The repository's provider documentation was used for this presentation; no live API request was made.

- Google Places API (New) Text Search: https://developers.google.com/maps/documentation/places/web-service/text-search
- Google Places policies: https://developers.google.com/maps/documentation/places/web-service/policies
- Twilio Lookup v2 formatting/validation: https://www.twilio.com/docs/lookup/v2-api/formatting-validation
- Apple Safari Web Extension packaging: https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect

## Delivery and viewing

The slide artifact is the editable presentation source. The downloadable PowerPoint is a separate export. Titles and body text should remain editable where supported; Hook is embedded artwork. PowerPoint may substitute locally installed fonts when DM Sans or Space Grotesk are unavailable. Use these companion notes if a viewer does not display speaker notes. Later deck edits require a fresh export before the PowerPoint matches again.

### Export validation

The delivered PPTX contains nine 16:9 slides. Its ZIP structure passed integrity checking; every slide contains editable text runs. The exporter created empty note pages rather than carrying over the authored speaker notes: use the slide preview or this companion document for the actual presenter script. All nine slides were rendered in LibreOffice with DM Sans and Space Grotesk installed and compared with browser captures. No missing slide content, unreadable contrast or clipping was observed. Minor line wrapping differs, and the closing slide's CSS-mirrored Hook appears unmirrored in the rendered PowerPoint. The artwork and message remain intact. Desktop Microsoft PowerPoint itself was not available for testing.
