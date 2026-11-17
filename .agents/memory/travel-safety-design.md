---
name: Travel safety design intent
description: User's product audience, brand, and requested interactive fish direction.
---

The product helps stressed travelers check customer service numbers before calling. The intended eventual app is iPhone-first with Expo. The user requested starting with an interactive design frontend, not live verification.

For product pitches, center the user's problem: travelers in distress do not have the luxury of time to fact-check everything. Promise reduced checking effort, not measured time savings or guaranteed safety.

**Why:** The user explicitly made this the central problem and benefit for the product presentation.

**How to apply:** Keep marketing and demos grounded in that distinction; never turn an intended benefit into a measured outcome.

The fish companion is named **Hook**, not Pip or an unnamed fish.

**Why:** The user explicitly requested "Name the fish hook", superseding the earlier unnamed-fish direction.

**How to apply:** Use Hook in companion copy and accessible labels; keep the app brand separate.

The user explicitly broadened the scope beyond flights: hotels and all kinds of travel services should be represented, with anxious travelers as the primary audience.

**Why:** They asked whether hotel and other travel numbers could be checked for spam and said, "Make it target people anxious about travel."

**How to apply:** Include accommodation, ground transport, booking services, and activities as well as flights. Favor calm, actionable result wording over alarmist warnings, and never equate an unknown number with proven fraud.
The current design direction is a Safari-only, tap-to-check companion beside phone numbers while browsing, with manual entry secondary. It is not a cross-app overlay, functioning extension, or live verification service.

**Why:** The user explicitly scoped this stage to a local Safari browsing demonstration with fictional evidence, no calls, and no transmission of searches, page content, or numbers.

**How to apply:** Keep simulated permissions and evidence visibly labeled as previews. Treat missing data as uncertainty, disclose source conflicts, and never equate a directory match with a guarantee of safety.

**Why:** The user described someone panicking at an airport gate and asked for a fish-themed experience where the fish swims or reacts when a scam is detected.

**How to apply:** Keep copy short, plain, reassuring, and immediately understandable. Preserve the slogan "Sleep with the phishes", dark deep-ocean mood, and compact Check / Directory / My Trips navigation. Make fish motion respond meaningfully to check results without distracting from the explanation.

The user chose **Phishing Trip** as the product name, replacing the earlier working name Stillwater.

**Why:** The user explicitly said "Use the name Phishing Trip."

**How to apply:** Use Phishing Trip in visible branding, app display names, extension manifests and guidance. Preserve existing storage keys, package names, routing slugs and URL schemes unless a separate migration is requested, so a branding change does not lose data or break installed links.

Hook should turn red for scam-related results and green for positive results.

**Why:** The user explicitly requested the lantern fish turn red for a scam number and green when it is not.

**How to apply:** Use report evidence for red and an official contact match for green; leave unknown and pending checks neutral. Preserve the distinction between a listed contact and a safety guarantee.

Figma references supply the fish artwork, lighting and visual styling, not replacement product copy.

**Why:** The user requested "Use the same fish design and light and designs, but keep the words of original made here."

**How to apply:** Preserve Phishing Trip's original wording, Hook's name and existing interactions when applying reference visuals. Do not import the reference product's name, training content or navigation.

Limit the phone country-code picker to the United States, Mexico and Canada.

**Why:** The user explicitly requested narrowing country area-code selections to those three countries.

**How to apply:** Keep this restriction on country choices; do not infer a request to delete overseas directory records or block explicit international-format numbers.

Hook stays awake for an official-number match; the lantern glows green instead
of showing closed eyes and sleeping letters.

**Why:** After seeing the sleeping result on an iPhone, the user requested a
green light instead. This supersedes the original sleeping-fish match concept.

**How to apply:** Use green for an evidence-backed official match only, never
for missing scam reports or an unknown number. Retain the caller-authentication
and safety caveats.

Show a red lantern after a **Not verified** result, while keeping the fish's
body and uncertain expression unchanged.

**Why:** The user explicitly requested red for unverified numbers after the
absence of live scam data was explained. This overrides the previous neutral
lantern for that state; it does not change the evidence classification.

**How to apply:** Explain red as “pause—not proof of a scam.” Keep pending,
empty and reset states neutral, official matches green, and never relabel
missing evidence as scam reports.
The user also requested bold red words for unverified results so the caution
is apparent without relying on the lantern alone; preserve that emphasis.

Help travelers recover from an unverified number by describing their travel
problem and finding other contact options.

**Why:** The user specifically gave changing a flight time as an example and
requested viable alternative phone contacts using the API connection.

**How to apply:** Prefer current sourced contacts for the named company and
property. Keep Google listings separate and explicitly unverified. Exclude
the number just checked from replacement suggestions, do not infer that a
main line is a specialist department, and require an explicit confirmation
before handing a number to the phone app. Keep free-form problem text local
unless a future feature gets explicit consent to send it to another service.

Keep a separate browser website alongside the native iPhone app.

**Why:** The user explicitly approved adding a separate Phishing Trip website,
not replacing or converting the Expo app.

**How to apply:** Preserve the mobile app and all its previews. Keep the website
on the same evidence service and Google request allowance, with consistent
Hook responses and source limitations. Browser-saved trip contacts are local
to that browser, not automatically synchronized with the iPhone app.

In the website, preserve unfinished Check fields in memory across document
visibility changes, but still discard pending requests and evidence results.

**Why:** Clearing the whole form when the document hides loses travelers'
unfinished entries while they switch browser tabs or apps. This is different
from persisting a phone-check history.

**How to apply:** Keep drafts out of storage and URLs; discard on route leave
or reload. Do not use a background-privacy cleanup to reset a form mid-entry.
