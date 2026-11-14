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
