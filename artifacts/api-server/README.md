# Stillwater verification API

An anonymous, stateless phone-number checker. This is **not scam detection**.
The design sandbox is separate and is not connected to these endpoints.
The authoritative contract is [`../../lib/api-spec/openapi.yaml`](../../lib/api-spec/openapi.yaml).

## Whole-trip travel coverage

Directory categories are `airline`, `hotel`, `vacation_rental`, `car_rental`,
`booking_service`, `rail_transfer`, `cruise`, and `tour`. Filter with
`GET /api/companies?category=hotel`. A category is not a promise of comprehensive
regional coverage or a scam-report feed.

Additional official contact pages were inspected on **2026-11-14 at 20:46 UTC**:
Marriott central reservations and Homes & Villas (official Marriott help site),
Enterprise car reservations, Amtrak reservations/customer service, and Royal
Caribbean individual reservations. Each seeded contact records its source URL,
region, service and fixed review/expiry time. Marriott's central line is **not**
an individual hotel's front desk. Booking.com and Viator have official website
entries only, with empty contact lists; do not fabricate a phone number or match.
Rerun `seed:directory` to add these entries without refreshing old review dates.

### Individual hotel properties

Hotel listings distinguish `listingType=brand` (Marriott central reservations)
from `listingType=property`. Each property has its own stable listing ID,
`brandId`, official `propertyCode`, full `address`, `city`, `subdivision`, and
ISO `countryCode`. Brand membership never expands an exact number match.
Other travel organizations use `listingType=organization`; non-property
location fields are null.

The following official property overview pages were read on **2026-11-14 at
20:49 UTC**, including their local address and **Tel** link, not just a search
snippet:

| Property ID | Property / address | Published local main line | Official source |
| --- | --- | --- | --- |
| `marriott-nycmq` | New York Marriott Marquis, 1535 Broadway, New York, New York, USA, 10036 | +1 212 398 1900 | https://www.marriott.com/en-us/hotels/nycmq-new-york-marriott-marquis/overview/ |
| `marriott-sfodt` | San Francisco Marriott Marquis, 780 Mission Street, San Francisco, California, USA, 94103 | +1 415 896 1600 | https://www.marriott.com/en-us/hotels/sfodt-san-francisco-marriott-marquis/overview/ |

These contacts are `serviceType=property_main`, **not confirmed direct
front-desk lines**. Marriott's brand line is `central_reservations`; other
existing contacts use `general` alongside their detailed service labels.
Use optional `claimedService` (`general`, `central_reservations`,
`property_main`, or `front_desk`) to require an exact service type. A service
mismatch returns `not_verified` / `SERVICE_MISMATCH`, even if the number is
published for the selected listing. A different property or a brand central
number submitted for a property returns `COMPANY_MISMATCH`. Unknown property
IDs return 404; an unknown property search returns an empty page, never a
brand fallback. Direct front-desk checks currently have no matching seed
evidence and must not be reassured by the local main line.

```sh
curl -s 'localhost:80/api/companies?listingType=property&brandId=marriott&city=New%20York&countryCode=US'
curl -s localhost:80/api/checks -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"+12123981900","claimedCompanyId":"marriott-nycmq","claimedService":"property_main"}'
```

Directory `search` also checks address, city, subdivision and official property
code. `city` is an exact case-insensitive literal filter (maximum 80 characters);
`countryCode` is uppercase ISO alpha-2; `brandId` is a stable parent listing ID.
Filters combine with category/search/pagination. Service-scoped alternatives
only include current contacts for the selected listing and requested service;
they never substitute another hotel or brand central reservations.

`GET /api/travel-safety` returns short, category-specific educational warnings
and next steps, referencing FTC travel-scam advice. `POST /api/checks` also
includes optional `travelGuidance` when `claimedCompanyId` is supplied.
These illustrative situations (urgent room payments, off-platform rental
deposits, payment pressure, fake trip offers) **never become evidence about
the checked number** and never change its verdict. No live scam-report provider
has been added. Unknown or mismatched numbers remain `not_verified`, not fraud.
API title `Api` and `GET /api/healthz → {"status":"ok"}` are unchanged.

## Development setup

Use Node 24 and pnpm from the workspace root. The existing PostgreSQL
`DATABASE_URL` must be configured server-side; no Twilio credentials are needed.

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run seed:directory
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
pnpm --filter @workspace/api-server test
```

Start/restart the existing **API Server** workflow. It supplies `PORT`.
Requests below use the shared development proxy, not a service port.
The development post-merge script applies the schema and idempotent seed.
There is no startup-time schema mutation, crawling, lookup, or seed.
Tests use the seeded development database for read-only directory route tests;
all invented contact/report scenarios and provider responses stay in `*.test.ts`.
Tests never make real Twilio calls.

## Endpoints and examples

```sh
curl -s localhost:80/api/healthz
curl -s localhost:80/api/capabilities
curl -s 'localhost:80/api/companies?search=delta&category=airline&limit=10&offset=0'
curl -s localhost:80/api/companies/delta
curl -s localhost:80/api/checks \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"800-221-1212","defaultCountry":"US","claimedCompanyId":"delta"}'
```

`POST /api/checks` accepts only `phoneNumber` (3–64 characters),
optional uppercase supported ISO alpha-2 `defaultCountry`, and optional
`claimedCompanyId` and `claimedService`. Unknown request fields are rejected. Send a complete number,
not a URL, page content, vanity number, extension, or multiple candidates.
National input **requires** an explicit country; no IP, browser language, or
hidden locale guess is used. International input begins with `+`; an explicit
international country code takes precedence over the national default.

A representative response, abridged to show the envelope (full contact and
evidence objects are returned; timestamp values reflect request time):

```json
{
  "normalizedNumber": "+18002211212",
  "countryCode": "US",
  "claimedCompanyId": "delta",
  "outcome": "official_match",
  "label": "Official match",
  "reason": "EXACT_OFFICIAL_MATCH",
  "explanation": "This exact number is listed in a current official source for the matched company. This does not authenticate an incoming caller.",
  "checkedAt": "2026-11-14T21:00:00.000Z",
  "freshness": "current",
  "evidence": [{
    "id": "delta-reservations-2026-11-14",
    "kind": "official_contact",
    "companyId": "delta",
    "number": "+18002211212",
    "sourceUrl": "https://www.delta.com/us/en/need-help/overview",
    "sourceName": "Delta Air Lines official website",
    "reviewedAt": "2026-11-14T20:34:24.000Z",
    "expiresAt": "2027-02-12T20:34:24.000Z",
    "freshness": "current",
    "assertion": "listed"
  }],
  "alternatives": [],
  "limitations": ["Caller ID can be spoofed. A directory match does not authenticate a caller."],
  "providers": {"directory":"active","reputation":"unavailable","metadata":"disabled"},
  "metadata": null
}
```

The example omits alternatives and most limitations for brevity. A current
claimed company's sourced contacts are returned as alternatives, up to ten;
with no claim, matching directory contacts are relevant alternatives.
Stale, unknown, or disputed contacts are not recommended alternatives.
For a different claimed company the reason is `COMPANY_MISMATCH`, never an
official match or proof of fraud. A valid number with no evidence returns:

```json
{
  "outcome": "not_verified",
  "label": "Not verified",
  "reason": "NO_EVIDENCE",
  "explanation": "There is not enough current evidence to verify this number. This is not a safety or fraud verdict."
}
```

This second example shows only decision fields; the full envelope is identical.
No success response says “safe” or declares a number definitively fraudulent.

### Directory

`GET /api/companies` searches names and property locations/codes by case-insensitive literal substring
`search` (maximum 80 characters), optionally a supported travel `category` (for example `category=hotel`). `%` and `_`
are literal characters, not SQL wildcard searches. `limit` is an integer 1–50
(default 20); `offset` is 0–10000 (default 0). Repeated, object-shaped, and unknown
query parameters are rejected. Ordering is by unique company ID; pagination is
deterministic for an unchanged directory:

```json
{"items":[],"total":3,"limit":20,"offset":100,"nextOffset":null}
```

Each company includes `id`, `name`, `category`, `website`, `listingType`,
nullable property identity/location fields, and `contacts`.
Each contact includes E.164 `number`, `companyId`, `region`, `service`, `serviceType`,
computed `freshness`, and `sources`, whose `sourceUrl`, `reviewedAt`,
`expiresAt`, source name and assertion are explicit. Detail responses
include stale contacts so expiration is visible rather than silently hidden.
Invalid IDs are 400; well-formed unknown IDs are 404. No public directory writes.

### Status and errors

All dates are ISO 8601 UTC strings on the wire and in generated clients.
Nullable `countryCode`, `claimedCompanyId`, and `metadata` are explicit.
`freshness` is `current`, `stale`, or `unknown`, **not a confidence score**.
Top-level freshness describes available evidence; it can be `current` even
when that evidence conflicts or belongs to a different company. Use `outcome`,
`reason`, and each source together, not freshness alone.

| HTTP | Stable error codes |
| --- | --- |
| 400 | `INVALID_INPUT`, `INVALID_COUNTRY`, `COUNTRY_REQUIRED`, `INVALID_NUMBER` |
| 404 | `COMPANY_NOT_FOUND`, `NOT_FOUND` |
| 413 | `BODY_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 429 | `RATE_LIMITED` (with `Retry-After`) |
| 503 | `DIRECTORY_UNAVAILABLE` |

```json
{"code":"COUNTRY_REQUIRED","message":"Select a default country or use a number beginning with + and its country code."}
```

Errors never echo input, upstream messages, validation dumps, or stack traces.
`GET /api/capabilities` probes directory availability, reports current metadata
configuration/budget status, and always reports reputation unavailable.
`available` metadata means configured and within local caps, not that a live
request has succeeded. Per-check statuses additionally include `success`,
`partial`, `timeout`, `invalid_response`, `unavailable`, `rate_limited`,
`not_configured`, `disabled`, and `budget_exhausted`.

## Evidence and review procedure

Initial contacts were reviewed on the airlines' own websites on
**2026-11-14 at 20:34 UTC**. These are real directory entries, not prototype data:

| Company | Number | Region/service | Official source |
| --- | --- | --- | --- |
| Delta Air Lines | +1 800 221 1212 | US; general sales/reservations | https://www.delta.com/us/en/need-help/overview |
| United Airlines | +1 800 864 8331 | US/Canada; reservations, English | https://www.united.com/en/us/fly/help/contact-reservations.html |
| American Airlines | +1 800 433 7300 | US/Canada; reservations/ticket changes, English | https://www.aa.com/i18n/customer-service/contact-american/reservations-and-ticket-changes.jsp |

Freshness expires at the **earlier** of explicit `expiresAt` and 90 days after
`reviewedAt`. Future, invalid, reversed, missing, or off-domain provenance
cannot support an official match. At exactly expiry a source is stale.
The directory verifies the source's HTTPS origin against the company website
and rejects URLs with embedded credentials.
Only exact E.164 equality to a currently listed, source-backed contact can
produce `official_match`; an optional company claim scopes the match.

Unresolved `disputed` assertions block an unqualified match even after that
dispute's review ages. Current assignments to multiple companies also produce
`SOURCE_CONFLICT`. Report evidence conflicting with an official listing does
the same. Source conflicts remain visible in evidence. Operators must resolve
disputes explicitly, not allow their timestamps to make them disappear.
Missing, unrelated, or stale evidence cannot reassure. Unknown validity or
provider failure does not establish either safety or fraud. Metadata is never
ownership evidence and never changes the directory decision.

To refresh/add a contact:

1. Manually visit the company's own HTTPS website. Confirm the exact number,
   dialing region and service/language, not just a search-result snippet.
   If unverifiable, omit it; do not invent or infer a source.
2. Normalize locally, record the actual review instant and expiry (at most
   90 days), source URL, company and assertion in a reviewed import change.
3. Use a transaction to insert/update the company and contact and insert a
   uniquely identified provenance record. Do not overwrite a number in place
   while leaving old provenance attached; use a new contact ID for a changed
   number and explicitly withdraw/dispute obsolete contacts. Do not remove an
   unresolved dispute merely to obtain an official result.
4. Follow the pattern in `src/verification/seed.ts`. Its import is transactional,
   idempotent, does not fetch sites, refuses conflicting existing contact
   definitions, and **never changes review dates just because it is rerun**.
    A fresh review requires an explicit human review (use the command below for
    an existing contact). Resolve
   superseded source assertions in the same transaction.
5. Run the seed/import, directory and decision tests, and inspect the API.

### Operator maintenance command

Apply the schema with `pnpm --filter @workspace/db run push` in development.
The existing post-merge setup does this automatically. No public write endpoint
is exposed: these commands require trusted shell access and database access.
Do not run the write command as an unattended scheduled job.

```sh
# Read-only; default warning window is 14 days.
pnpm --filter @workspace/api-server run review:directory queue
pnpm --filter @workspace/api-server run review:directory queue --days 30
# Explicit human action, after visiting and checking the official page:
pnpm --filter @workspace/api-server run review:directory review /absolute/path/review.json
```

The queue prints JSON for expiring, stale, disputed, invalid-date and
invalid-provenance sources, including the company, exact contact/scope, recorded
dates, effective expiry, reasons and `expectedFingerprint`. `--days` accepts
0–90. Neither listing the queue, fetching a website, nor rerunning the seed
changes review dates. Scheduling the **queue** command is safe; it does not
perform reviews or send notifications.

Create a JSON file with these fields (replace every illustrative value with
the current queue values and the actual human review):

```json
{
  "sourceId": "delta-reservations-2026-11-14",
  "expectedFingerprint": "<copy the 64-character fingerprint from the queue>",
  "reviewer": "operator-handle",
  "note": "Manually confirmed the number, region and reservations service on the official page.",
  "confirmedHumanReview": true,
  "number": "+18002211212",
  "region": "United States",
  "service": "General sales and reservations",
  "sourceUrl": "https://www.delta.com/us/en/need-help/overview",
  "assertion": "listed",
  "reviewedAt": "2026-12-01T12:00:00Z",
  "expiresAt": "2027-03-01T12:00:00Z"
}
```

Use a stable internal operator handle, not personal contact details. Do not put
traveler numbers, browsing history or secrets in notes. Timestamps must include
a timezone; the human review instant must be newer than the stored review and
not in the future. Expiry must be strictly after review and no more than 90 days
later; shorter periods are supported. The command does not silently substitute
the execution time for the review time. An already expired review stays stale.

The review confirms the exact stored E.164 number, region and service. It can
update the official source URL on the same approved origin and explicitly set
`listed` or `disputed`. Use `disputed` to withdraw an unsupported listing; it
blocks an official match even after expiry. Resolving one source does not clear
other disputes or conflicting company assignments. A changed number, company,
region or service needs a separately reviewed import, not this renewal command.

A transaction locks the source, contact and company, validates the queue
fingerprint, updates the evidence, and appends a before/after audit record with
the operator handle, note and separate server-recorded time. Validation failure
writes nothing. A changed source or replay is rejected; reload the queue and
review the new state. Audit records are separate from consumer evidence and do
not themselves establish an official match. Directory evidence is read from the
database on each check; verdicts recheck expiry on every response.

No reputation source or public report-submission path exists. The pure
decision function accepts report evidence only for isolated fixture tests.
Production calls never supply it, and clients cannot inject it in a request.
Future report evidence must have a licensed attributable provider, stable
record ID, HTTPS provenance, matching normalized number, actual review and
expiry, and distinguish reports from aggregate risk scores. A score alone
must not be described as “Reports found”.

## Optional Twilio Basic metadata

Reviewed the current [Lookup v2 formatting/validation documentation](https://www.twilio.com/docs/lookup/v2-api/formatting-validation)
on 2026-11-14. It describes the Basic request as free when **no `Fields`** are
included. Pricing and terms can change; confirm the account's current terms
before opting in. This implementation makes **no requests by default** and
does not purchase anything or enable provider products.

To opt in, configure server-only `TWILIO_API_KEY` and `TWILIO_API_SECRET` securely
and explicitly set `TWILIO_LOOKUP_ENABLED=true`. Use a valid API key (`SK…`).
Never put these credentials in an Expo bundle, extension, browser or committed
file. No credentials are needed for local normalization or directory matching.

| Non-secret setting | Default | Bound/meaning |
| --- | --- | --- |
| `TWILIO_LOOKUP_ENABLED` | false | Only literal `true` enables |
| `TWILIO_TIMEOUT_MS` | 2000 | 0–5000; minimum effective timeout 1 ms |
| `TWILIO_MAX_REQUESTS` | 100 | 0–10000 per process lifetime; 0 prevents requests |
| `TWILIO_REQUESTS_PER_MINUTE` | 10 | 0–100 per process; 0 prevents requests |
| `API_RATE_LIMIT` | 60 | 0–300 requests/minute per client address |
| `CORS_ORIGINS` | empty | Comma-separated exact HTTP(S) origins; no wildcard |
| `TRUSTED_PROXY_CIDRS` | empty | Explicit trusted proxy IPs/CIDRs only |

One fixed upstream GET:
`https://lookups.twilio.com/v2/PhoneNumbers/{encoded E.164}`.
No `Fields`, add-ons, line-type intelligence, caller-name, SMS-risk, identity,
or premium packages are requested; redirect following is forbidden.
Only allowlisted Basic fields are retained. Response type, number, field
types and 16 KiB size limit are validated. A request/body timeout bounds work.
Malformed responses, missing configuration, network failures, 429s and partial
country/format coverage are visible and never erase official evidence.
VoIP metadata, even if returned unsolicited, is discarded and is not fraud.

Successful metadata is in **process memory only**, maximum **200 entries**
for **300 seconds**, without sliding expiration. Expired entries are purged
on access and within the next one-second cleanup tick. Failure cooldowns last
30 seconds with the same bound. Cache keys use a process-random HMAC rather
than raw phone strings. Concurrent requests for the same number coalesce.
No automatic retries. Attempted requests (including failures) count against
the local caps. Cache hits do not. Caps reset at process restart; multiple
replicas multiply these limits. They are request-count budgets, not a durable
account-wide monetary guarantee. Before any multi-instance rollout or paid
provider use, add an external account-wide limit and provider-side spend guard.

Basic validity is numbering-plan metadata, not evidence of ownership,
reachability, a business relationship, reputation, or caller authentication.
Twilio receives the number only after explicit server opt-in. Its own retention
and account logs are governed by its policies, not this app's in-memory TTL.

## Privacy, origins and operating limits

Checks do not write the submitted number or any check result to PostgreSQL.
Only curated companies, contacts and provenance persist. No accounts,
check-history endpoint, browsing URLs, search history, page contents or public
report storage. All API responses use `Cache-Control: no-store`.
JSON bodies are limited to 2 KiB. App logs include method, request ID, response
status and timing—not paths, queries, request/response bodies, headers,
credentials, exception text, provider payloads or IP addresses.

Native clients and same-origin browsers need no CORS configuration. Cross-origin
browsers must use the exact `CORS_ORIGINS` allowlist; disallowed origins receive
no CORS permission. CORS is not authentication and does not stop native callers.
The API intentionally requires no account.

Reverse-proxy headers are ignored by default. Do not use `trust proxy=true`,
hop counts, or trust-all subnets. Configure only proxy addresses verified for
the actual hosting topology. Until then, clients behind the shared proxy
share its address-based rate bucket—conservative but potentially restrictive.
IPv6 clients use the rate limiter's normalized subnet keys. Address buckets
live only in memory for up to the current/previous minute and never enter logs.
The API also has a 600-request/minute global process cap before per-address
limiting to bound bucket growth. Health checks are exempt. All limits are per
process; multiple replicas need a shared abuse-control layer before scale.
Database pool size and query/connect timeouts are bounded.

This application cannot control hosting/proxy/provider log retention. Ensure
those systems also disable request-body and sensitive URL logging before a
public release. Do not add phone numbers or browsing data to analytics.

## Future reputation-provider evaluation

Public documentation reviewed on 2026-11-14:

| Candidate | Documented capability | Suitability decision |
| --- | --- | --- |
| [Hiya Number Reputation](https://developer.hiya.com/docs/guides/voice-protection/number-reputation/get-number-reputation-data) | Label status and engagement grades for verified registered business numbers; [endpoint docs](https://developer.hiya.com/docs/protect/business-partner-api/endpoints/get-reputation-for-phones) note per-number service fees | Not a drop-in consumer arbitrary-number report feed. Obtain explicit redistribution rights, scope, country coverage, attribution and retention terms before considering an adapter. Labels are dynamic and are not report records. |
| [Telnyx Number Reputation](https://developers.telnyx.com/docs/number-reputation/overview) | US-only outbound-number monitoring requiring business registration, signed authorization and approval; activation, number association and fresh queries are billable | Not a drop-in arbitrary-number consumer report feed. Its ownership/authorization requirements do not fit traveler-submitted numbers. No account, subscription or paid refresh enabled. |
| Twilio Lookup v2 Basic | Formatting and numbering-plan validation | Metadata only. Never map it to “Reports found”. |

Recommendation: leave reputation unavailable until a vendor contracts for
consumer checking and attributable report display. Require evidence IDs,
source timestamps, licensing/display permission, regional coverage and
unknown/unavailable semantics, deletion/correction process, cost/spend caps,
and a privacy review. Do not scrape Google or crowd sites as a substitute.

## Future Expo and Safari integration

Use the generated `checkNumber`, `listCompanies`, `getCompany`, and
`getCapabilities` helpers in `@workspace/api-client-react`; the custom fetch
module supports `setBaseUrl()` for a remote API origin in Expo. Web clients
on this host use `/api`, not `localhost` or hardcoded development domains.
No authentication token is required. Render explicit loading/error states,
provider availability, evidence dates, alternatives and spoofing limitations;
do not show an all-clear fish reaction for `not_verified`.

An Expo app **cannot inspect Safari pages**. A Safari companion requires
separate native Safari Web Extension work and explicit site permissions.
Any future client should extract candidate numbers locally, require an explicit
tap to check a selected number and country/company, and upload only those
three request fields. Never upload the page URL, page text, background browsing
stream or automatic check history. This backend does not implement that app
or extension and does not connect the fictional design scenarios.
