---
name: Native Hook coordinate handling
description: Preserve artwork alignment across SVG browser and React Native renderers.
---

Use one root SVG coordinate system with translated groups for Hook's native
art layers rather than nested positioned SVG viewports.

**Why:** The user's Expo Go screenshot showed clipped/displaced body, face and
fins although the browser artwork looked correct. Flattening the layer
viewports preserves the source paths and explicit placements without relying
on native nested-viewport behavior. Exported SVG strings may include trailing
whitespace, so trim before parsing their outer wrapper.

**How to apply:** Keep generated artwork intact and perform native placement
normalization at the rendering boundary. Preserve layer viewBox transforms and
the reaction overlays' shared coordinate system. Browser screenshots and
JavaScript exports do not establish physical iPhone rendering.
