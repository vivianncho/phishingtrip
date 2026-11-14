---
name: Slide export fidelity
description: Browser artwork transforms may not survive editable PowerPoint export.
---

Do not rely on CSS horizontal mirroring for artwork that must have the same orientation in a PowerPoint export. Prefer an already-mirrored image asset when orientation matters.

**Why:** The presentation preview mirrored Hook correctly, but the exported PowerPoint rendered the original image orientation in LibreOffice. Text remained editable and artwork remained embedded; successful export alone did not prove visual equivalence.

**How to apply:** Render exported slides as well as checking the browser preview. Distinguish visual differences from missing content, disclose viewer limits, and bake essential image transforms into assets before exporting.

Verify note text, not merely the presence of note parts in the exported ZIP.

**Why:** This exporter emitted nine structurally valid but empty note pages even though the artifact manifest had populated speaker notes.

**How to apply:** Supply a presenter/source companion document when notes do not survive export, and state clearly where the actual notes are available.
