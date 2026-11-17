---
name: Browser extension intent
description: User-requested browser platforms, privacy expectations, and Apple's current Safari packaging route.
---

Build both Chrome/Edge and iPhone Safari versions, not only a simulated browser UI. The user wants to check numbers directly in search results, including AI-generated answers, before calling.

**Why:** The user explicitly selected "Both browser versions" after being told that existing browser and Safari companions were mockups, not installable packages.

**How to apply:** Keep number extraction local, require a deliberate check, and upload only the selected number, explicit country, and optional claimed company. Search placement and AI prose are not ownership or scam evidence. Never report untested Safari resources as installed or signed.

Use a right-hand companion panel beside search results, with the same approved
lantern-fish Hook as the app rather than the round cartoon in the reference.

**Why:** The user provided a search-results/sidebar reference and explicitly
asked to retain their chosen fish design.

**How to apply:** Make per-page activation explicit; preserve selected-number
consent before transmission. Do not imply a website can install the extension
or that the illustrated search engine is the real verification service.

The consumer extension must not ask travelers for API keys or a checking-service
address. The website should route installation through actual official store
listings; incomplete releases must show their availability honestly.

**Why:** The user approved the no-setup approach: a preconfigured protected
service connection, store-based installation, and Hook moving beside the
explicitly selected number.

**How to apply:** Keep provider credentials on the server. Preparing the
extension is not permission to publish it, expose the private app, increase
Google spending, or label Google business listings as official evidence.

Result messaging for a web-accessible extension panel must authenticate the
browser-native extension sender, not only a fragment token or parent window.

**Why:** A hostile website can embed the public popup resource and choose its
own fragment. A token supplied by that page does not make the page trusted and
must not give it access to numbers typed into the extension.

**How to apply:** Keep the result channel inside WebExtension runtime messaging
and bind it to the intended panel and selected number. Never expose a
page-callable verdict setter or credential-bearing request proxy.

Apple now documents a browser-based Safari Web Extension Packager in App Store Connect, alongside the Mac/Xcode tool.

**Why:** Current official Apple documentation checked on 2026-11-14 expressly supports packaging without a Mac. Older guidance that a Mac is always required is too strong.

**How to apply:** Offer the App Store Connect packager for portable extension resources, requiring Apple Developer enrollment and TestFlight/device validation. Keep the Xcode route as an alternative. Official reference: https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect
