---
name: Expo compatibility checks
description: Version-specific validation lessons for Stillwater mobile.
---

Expo SDK 58's configuration schema rejects the legacy top-level `splash` field;
use the `expo-splash-screen` config plugin in static `app.json` instead.

**Why:** The scaffold installed successfully, but online Expo Doctor rejected
the legacy field even though JavaScript type checking accepted the app.

**How to apply:** Keep static configuration and run the installed SDK's online
dependency/configuration checks when changing splash or native app settings.

Keep browser API requests on the browser's origin, even when the native API
domain is injected into the same Expo bundle.

**Why:** Expo's browser preview uses a different hostname from the ordinary
development preview. Sending browser requests to the native API hostname
caused CORS failures; API paths are also routed correctly on the Expo hostname.

**How to apply:** Preserve absolute API URLs for native clients, but use
same-origin API paths for browser previews rather than loosening the API's
origin allowlist.
