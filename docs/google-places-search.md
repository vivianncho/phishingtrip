# Google Places travel discovery

In the iPhone app, open **Directory → Google Places**. Submit a business name
and city, or a full international number. Searches run only after an explicit
tap. This uses Places API (New) Text Search, not Google People or personal contacts.

Listings include any available address, listed phone, website, Google Maps
link and third-party attributions. A listing is not an independently verified
official contact and is never imported into the sourced directory. Selecting
a phone fills Check without submitting a check or asserting a company identity.
No listing and no phone are normal empty states, not evidence of fraud.

## Server setup and access errors

Store `GOOGLE_PLACES_API_KEY` only as a server secret. Never use an
`EXPO_PUBLIC_` variable for it, put it in app configuration, or enter it in chat.

For the key's Google Cloud project:

1. Enable **Places API (New)**:
   https://console.cloud.google.com/apis/library/places.googleapis.com
2. Enable billing. Requesting phone and website fields uses the Text Search
   Enterprise SKU; check current Google pricing rather than assuming it is free.
3. Restrict the key to Places API and use restrictions compatible with
   server-side requests. Browser HTTP-referrer-only restrictions are not
   compatible with this server-to-server integration.

A rejected request produces a service-unavailable state, never invented results
or a number verdict. HTTP 403 means Google denied access; review API enablement,
billing and key restrictions. Raw Google diagnostics and credentials are not
returned to travelers or logged.

The connected Google Maps Platform connector rejected application proxy
requests during setup. This implementation therefore calls Google's documented
HTTPS endpoint directly from the server using the separately supplied secret.

## Request allowance

The approved ceiling is **10 outbound attempts per UTC day**, using the fixed
`google-places` namespace in the existing PostgreSQL usage counters. Every
attempt is reserved atomically before contacting Google. Failures and timeouts
count, no retry is automatic, key rotation does not reset it, and concurrent
replicas sharing the counter database share the same allowance.

This is a request-count limit, **not a guaranteed dollar cap** or a restriction
on other applications using the same Google project/key. Configure Google-side
quota and spending alerts as appropriate.

**Before running live searches in independently stored development and
production environments:** use one shared budget authority or disable live
search in one environment. Separate counter databases do not share an
allowance automatically. Do not describe two independent allowances as one
account-wide cap.

## Privacy and attribution

Queries and Google content are not persisted or added to React Query caches.
The app aborts pending searches and drops search text and results on
Directory exit or backgrounding. The generated client explicitly requests
`no-store`; the server also returns `Cache-Control: no-store`.

Only the submitted search text is sent to Google, not device contacts,
booking details or device location. Google's handling follows its policies.
Search results remain in Google's order. The unmodified Google Maps logo,
third-party attributions and source links are displayed alongside the results.

Help contains the in-app privacy explanation and Google terms and privacy
links. Review and publish the application's public terms and privacy policy
before release, as required by Google's policies.

References:

- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/policies
