# Phishing Trip — browser companion

A responsive browser application for the existing stateless travel-number API. The Expo app, original brand mockup, shared API and root preview are unchanged.

## Run and publish

Use the workspace's existing Website workflow. It supplies `PORT` and `BASE_PATH=/phishing-trip/` to Vite. The existing package commands are `dev`, `build`, `serve` and `typecheck`.

The browser routes are:

- `/phishing-trip/`: explicitly submitted private number check, evidence, provider states, alternative contacts and problem recovery.
- `/phishing-trip/directory`: searchable, paginated, category-filtered sourced travel directory. Separate opt-in Google Places discovery.
- `/phishing-trip/trips`: browser-local official contact references, refreshed from the live directory on entry.
- `/phishing-trip/help`: privacy, limitations, capabilities and server-provided travel safety guidance.

Hosting must serve the browser entry for nested browser routes and keep `/api` routed to the existing API service. Do not prepend the browser base to API URLs. All data calls use `@workspace/api-client-react`; no backend/schema changes or hardcoded API domains are needed. All navigation uses the existing Wouter base.

## Privacy and safety boundaries

- Private checks and Google discovery use imperative generated functions, AbortController, `cache: no-store`, credentials included, a 15-second timeout and version guards. No automatic retries, query/mutation cache, number URL parameters, app check logging or phone history.
- Private results/Google queries are discarded on route unmount or document hide. Unsubmitted phone/country/company fields stay only in memory while switching tabs or opening browser controls, and disappear when leaving Check or reloading. Recovery and Google forms clear on hide. Public company directory queries may cache in memory.
- Optional Google searches require an explicit search button. Google is never a verification provider. Listings are attributed, unverified, excluded from local saves and cleared on leave/hide. The existing shared 10-attempt daily server budget includes failures.
- Recovery problem text stays in memory and is classified locally. Only company/city are sent to `listCompanies`; optional Google query is built from company/city, never problem text. Current, non-disputed alternatives exclude the number just checked. Matching service contacts are separated from other published contacts.
- Only official `{companyId, contactId}` references are persisted under `phishing-trip-official-contacts-v1`. Storage is shape-validated and failures surfaced. No Google data, phone numbers, check history, account or sync. My Trips re-fetches current company/contact records, does not use phone snapshots and does not provide offline access.
- Phone use only prefills Check. It does not submit. Call options always require explicit confirmation before a `tel:` handoff. Charges may apply.
- An official listing is evidence, not a guarantee. Caller ID can be spoofed. Not verified is not a scam classification. No live reputation provider is claimed. Review/expiry dates and provider limitations remain visible.
- Client cleanup does not imply zero infrastructure request metadata. Google and linked external websites have their own privacy practices. Google Fonts are used for typography.

## Brand and accessibility

The **Ocean Field Guide** presentation pairs Space Grotesk with DM Sans, accepted deep teal / pale lime, restrained sea-light depth and slow floating motion. Hook uses the original four copied Figma SVG layers at their original relative positions. Colored lantern overlays follow the original bulb paths; the face stays awake. Idle/pending is neutral, official match green and unverified/reports-found red. Provenance is in `public/images/hook-figma-source.md`; Google Maps attribution is copied from the mobile asset.

Native labels, buttons, details, dialog, live statuses, visible keyboard focus, skip navigation and test IDs support accessibility. Animations honor reduced motion and pause while hidden.

## Verification

Type checks and production build passed. Live API checks returned official-match and not-verified results. Browser testing confirmed directory search, saving and refreshing a local contact after reload, prefill without automatic submission, an explicit official-match check, confirmed removal persisting after reload, and contained desktop/phone layouts. A company-selection timing issue found during testing was fixed with a controlled select and passed type/build checks. Physical phone handoff, Google discovery during this run, storage-failure simulation, and a full assistive-technology audit were not exercised.
