---
name: Browser extension intent
description: User-requested browser platforms, privacy expectations, and Apple's current Safari packaging route.
---

Build both Chrome/Edge and iPhone Safari versions, not only a simulated browser UI. The user wants to check numbers directly in search results, including AI-generated answers, before calling.

**Why:** The user explicitly selected "Both browser versions" after being told that existing browser and Safari companions were mockups, not installable packages.

**How to apply:** Keep number extraction local, require a deliberate check, and upload only the selected number, explicit country, and optional claimed company. Search placement and AI prose are not ownership or scam evidence. Never report untested Safari resources as installed or signed.

Apple now documents a browser-based Safari Web Extension Packager in App Store Connect, alongside the Mac/Xcode tool.

**Why:** Current official Apple documentation checked on 2026-11-14 expressly supports packaging without a Mac. Older guidance that a Mac is always required is too strong.

**How to apply:** Offer the App Store Connect packager for portable extension resources, requiring Apple Developer enrollment and TestFlight/device validation. Keep the Xcode route as an alternative. Official reference: https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect
