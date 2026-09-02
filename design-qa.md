# Design QA — v1.0.59

- source visual truth: `C:\Users\kdy78\.codex\generated_images\01a06271-33a6-7810-8f31-d091ab117f14\exec-dd9c2a90-93ce-454d-9765-de47cc6f69d5.png`
- implementation screenshot: `C:\Users\kdy78\eojeboda\implementation-mobile-v2.png`
- comparison image: `C:\Users\kdy78\eojeboda\design-comparison-v2.png`
- desktop evidence: `C:\Users\kdy78\eojeboda\implementation-desktop-full.png`
- viewport: mobile 390 × 844 CSS px; desktop 1280 × 900 CSS px
- pixels and normalization: source 853 × 1844 px normalized to 390 × 844; implementation 390 × 844 px at browser capture density; both placed at equal 390 × 844 dimensions in the comparison image
- state: Seoul fallback location, clear weather, first screen, region search collapsed

## Full-view comparison

The source and implementation are shown together in `design-comparison-v2.png`. The implementation preserves the selected target's midnight navy surface, coral temperature emphasis, consistent outlined icons, four-column metric row, six-point hourly weather/temperature/precipitation graph, and clean preparation section. The implementation intentionally uses larger minimum text sizes than the generated reference, so fewer preparation rows fit inside the first 844 CSS pixels.

## Focused comparison

The first viewport contains all fidelity-critical surfaces at readable size, so a separate crop was not needed. Header, hero, metrics, hourly graph, and the start of the preparation section are visible in the normalized comparison.

## Required fidelity surfaces

- Fonts and typography: existing Pretendard-first stack retained; display temperature, section headings, labels, and body text use distinct weights and readable mobile sizes. Generated-reference microcopy was not copied at unreadably small scale.
- Spacing and layout rhythm: header controls are compact, search is collapsed by default, hero sections use separators instead of nested cards, and desktop uses a two-column grid.
- Colors and tokens: deep navy base, off-white text, coral temperature, cyan precipitation, violet rain, and yellow condition icons match the selected target.
- Image and icon quality: Phosphor icons replace the mixed emoji/pixel-art system. No placeholder imagery or custom-drawn UI icons were introduced. The data chart remains vector-rendered for sharpness.
- Copy and content: live Korean weather copy and existing practical recommendations are preserved. Hourly labels use live local weather data.

## Comparison history

### Iteration 1 — blocked

- P1: location search consumed too much of the first viewport compared with the target.
- P2: hourly graph lacked the target's per-time weather icon, temperature, and precipitation row.
- Fixes: collapsed region search behind a labeled control; added six live hourly points with consistent weather icons, temperatures, and precipitation amounts; reduced particles over content.
- Evidence: `implementation-mobile-v1.png` and `design-comparison-v1.png`.

### Iteration 2 — passed

- Search controls no longer displace the weather hero.
- Hourly information hierarchy now matches the chosen hybrid concept.
- The remaining density difference is intentional for legibility and classified as P3 polish only.
- Desktop 1280px layout was separately captured and shows the intended two-column reflow.
- Primary interactions tested: region-search expand/collapse and settings-panel open/close.
- Browser console on a fresh verification tab: no warnings or errors.

## Follow-up polish

- P3: a future pass could reduce the hourly chart's vertical height by about 12px on very short screens.
- P3: secondary cards still contain legacy emoji headings below the first-screen redesign and can be migrated to the icon system incrementally.

final result: passed
