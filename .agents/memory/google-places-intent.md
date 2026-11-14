---
name: Google Places integration intent
description: Requested travel-business coverage, approved request cap and connector limitation.
---

Use Google Places for travel-business discovery and listed contact details,
not as scam evidence or an automatic official-contact endorsement.

**Why:** The user requested Google Places after discussing the difference
between business listings, official-site evidence and spam reports.

**How to apply:** Keep Google-supplied results clearly attributed and separate
from curated official contacts. Do not turn a Google listing match into a
safety guarantee, or a missing listing into evidence of fraud.

The user approved **10 Google Places requests daily**, shared across all users.

**Why:** They selected "10 requests daily (recommended)" after being told that
Google usage charges may apply and that a request cap is not a dollar cap.

**How to apply:** Reserve the account-wide allowance before every outbound
attempt, including failures and retries; do not create new allowances per
replica, connection or API-key rotation. Use explicit user-triggered searches.
Independent counter databases are independent allowances: before enabling a
second live environment, establish a shared budget authority or disable live
Places in one environment. A database-local limit is not Google-account-wide.

Keep Google search text and listings ephemeral, including on the client.

**Why:** Discovery must not silently become a saved contact directory or check
history; Google also restricts caching and storage of its content.

**How to apply:** Use the generated abortable client rather than a cached query
for this explicit action. Clear text and results on blur/background, ignore
late responses and require another explicit tap to submit a listed phone to
Check. Retain Google and third-party attribution with all displayed results.

Verify runtime API access independently of integration connection status.

**Why:** During setup, the connected Google Maps Platform API integration was
discoverable but rejected its application proxy request with "Connector
google-maps does not support proxy requests". No Places results were returned.

**How to apply:** Do not promise that connecting this integration alone enables
in-app search. Use a working supported API route or a server-side Places API
credential provided through the secure Secrets flow; never ship credentials
to the mobile app or substitute fictional lookup results.
