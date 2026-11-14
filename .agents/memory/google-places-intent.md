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

Verify runtime API access independently of integration connection status.

**Why:** During setup, the connected Google Maps Platform API integration was
discoverable but rejected its application proxy request with "Connector
google-maps does not support proxy requests". No Places results were returned.

**How to apply:** Do not promise that connecting this integration alone enables
in-app search. Use a working supported API route or a server-side Places API
credential provided through the secure Secrets flow; never ship credentials
to the mobile app or substitute fictional lookup results.
