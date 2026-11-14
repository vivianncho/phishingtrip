# Stillwater companion: iPhone accessibility validation

Audit date: 2026-11-14

## Decision

**Not validated as iOS-ready. Real iPhone Safari and VoiceOver testing is deferred at the user's request.**

The user chose to do these checks later rather than block prototype work. The preliminary browser findings below remain valid within their stated limits; this deferral is not an accessibility sign-off. Resume the real-device checklist before claiming iPhone accessibility readiness.

This report records preliminary browser checks, not an iPhone accessibility sign-off. No real extension was installed, no real permissions were granted, no calls were placed, and no live verification was added. No application code was changed: the requested scope permits fixes only for confirmed browser-specific problems, and no Safari-specific failure could be established in the available environment.

Preview route: `/__mockup/preview/stillwater/Stillwater`

Primary files:
- `artifacts/mockup-sandbox/src/components/mockups/stillwater/SafariCompanion.tsx`
- `artifacts/mockup-sandbox/src/components/mockups/stillwater/Stillwater.tsx`
- `artifacts/mockup-sandbox/src/components/mockups/stillwater/_group.css`

## Evidence limits

The automated browser was **Chromium 157.0.8103.38 on Linux**, using mobile/touch emulation and device-pixel ratio 2. Measured viewports were 320×568, 375×812, 390×844, and 844×390 CSS pixels. A separate initial screenshot used 320×740.

Playwright WebKit was not installed. No physical iPhone, iOS Safari, VoiceOver, spoken output, real software keyboard, Safari toolbar transitions, or nonzero iPhone safe-area insets were tested. Mobile Chromium emulation does not reproduce these.

## Preliminary results

| Area | Observed result | Qualification |
| --- | --- | --- |
| Help dialog | Native modal with accessible name “Hook, beside the page.” Initial DOM focus on close button; Tab/Shift+Tab stayed inside. | Chromium keyboard focus, not VoiceOver focus. |
| Help dismissal | Close button, “Back to Hook”, backdrop click, and Escape closed the dialog and returned focus to the help trigger. Body overflow restored. | Touch dismissal and VoiceOver escape gesture untested. |
| Simulated setup | Toggle changed local state and `aria-pressed`; copy explicitly said no real permission was granted. | Only simulated control used. |
| Evidence dialogs | Checks for fictional numbers ending 0142, 0187, and 0116 produced Official match, Reports found, and Not verified, respectively. Each sheet showed its selected number, focused close first, and restored trigger focus after close. | No live evidence queried. |
| Evidence keyboard containment | Tab/Shift+Tab remained in the tested evidence sheet; last control reachable by scrolling. | Separate “Return to browsing” evidence button was not exercised; remains on device checklist. |
| Official-contact navigation | Evidence action opened the Aster Air Directory detail, removed dialog, restored body overflow, and focused the connected Directory navigation button. | Destination-heading focus is not implemented; no focus remained in removed dialog. |
| Sheet scrolling | Help sheet’s final action reachable at 375×812, 320×568, and 844×390. | Actual Safari dynamic viewport and home indicator untested. |
| Reduced motion | Zero running CSS animations at idle, during swim (~350ms), and after result (~2.6s), including fish. Normal motion showed active fish animations. | Emulated media preference, not iOS Settings or subjective motion assessment. |
| Status updates | Status region has `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`. Fish captions also have polite live regions. | Spoken announcements, timing, and possible duplicate speech unverified. |
| Small-width placement | No horizontal page overflow or number/fish bounding-box intersection at the four measured sizes. | Does not establish enlarged-text or zoom behavior. |

## Concrete observations needing disposition

### Mode buttons miss the 44px touch-target goal

The Safari/manual mode buttons measured **42px high**. At 375px width, widths were approximately 105.6px and 110.2px; at 320px, 97.6px and 102.2px. Reproduce by measuring `button-mode-safari` and `button-mode-manual` on the Check screen.

Other measured controls met the 44px height goal: sheet close 44×44, fish 83×74 (72×74 at 320px), help return 54px high, and evidence buttons 54–63px high.

This is a confirmed Chromium/layout finding, not a confirmed Safari-specific defect. It was documented rather than changed under this task’s narrow fix scope.

### Fixed navigation can cover content while scrolling

At 375×812, the fixed navigation occupied y=733–812 (79px). One observed scroll position placed the second fish at approximately y=788–862, partly behind navigation. All relevant bottom-of-page controls could be scrolled clear of navigation. Landscape also showed intermediate overlap.

This is not evidence of an unreachable control: fixed navigation commonly overlays content during scrolling. On real hardware, verify each number, fish, and focused control can be fully exposed, including with Safari’s toolbar expanded, the software keyboard open, and VoiceOver moving focus.

### Focus and reading order require assistive-technology validation

After the evidence-to-Directory action, focus landed on the Directory navigation button, not the destination heading. Mobile CSS also visually reorders the introduction/status relative to the browsing scene. Neither observation establishes VoiceOver usability. Check spoken destination context and swipe/rotor order before deciding whether changes are necessary.

The help sheet appeared slightly inset in Chromium. No Safari layout conclusion or corrective change is justified from that alone.

## Required real-device run

Record device model, iOS version, Safari version if separately available, portrait/landscape dimensions, text-size/zoom settings, VoiceOver state, Reduce Motion state, date, and observed/expected behavior. Capture a recording with spoken output where practical, without personal browsing data.

1. Open only the fictional preview in iPhone Safari. Do not install an extension, open real travel listings, grant website permissions, or call numbers.
2. Enable VoiceOver. Swipe through the initial screen and use rotor headings/buttons. Confirm number, claimed company, fish action, scenario, and navigation labels are understandable in reading order.
3. Open Help using VoiceOver double-tap. Confirm modal name is announced; focus is inside; background content is not reachable by swipe or touch exploration; long content and final action are reachable.
4. Test help close button and “Back to Hook”; test the VoiceOver escape gesture. Confirm focus returns to the help trigger and the page remains scrollable. Separately test backdrop touch with VoiceOver off, without confusing it with sheet content.
5. Toggle the simulated setup state and back. Confirm announcement communicates simulated status only and no system permission appears.
6. For each fictional number (0142, 0187, 0116), activate its fish. Confirm status speech communicates checking and final result without misleading silence or confusing duplicate fish-caption speech. Open evidence and confirm the exact selected number and result.
7. For each evidence sheet, verify modal isolation, scrolling, close-button focus return, and “Return to browsing” focus return. From the official result, open the demo official-contact detail; confirm focus is connected and destination context is understandable.
8. With Reduce Motion enabled in iOS Accessibility settings before page load, repeat idle, checking, and all result states. Confirm fish, progress, and sheet effects do not animate unexpectedly and text still communicates progress. Repeat after toggling the setting while the page is open.
9. At the smallest supported iPhone width and landscape, check number/fish separation, touch accuracy, and every sheet action. Expand/collapse Safari browser chrome and rotate with a sheet open. Confirm home-indicator/notch areas do not hide actions or navigation.
10. In manual mode, open the real software keyboard. Check input focus scroll, error announcement for empty submit, result announcement, and visibility/reachability of submit, sheet actions, and navigation. Repeat with larger text and page zoom; record clipping rather than assuming emulation covered it.

## Release gate

Leave the real-device result **NOT RUN** until the above evidence is available. Record each case as pass/fail with actual device details. Reproduce any failure before making a targeted browser-specific fix, then verify that fix on the same device. A passing desktop or emulated browser run must not replace this gate.
