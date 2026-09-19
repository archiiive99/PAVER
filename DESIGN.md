# PAVER Project Page Design System

## 1. Atmosphere & Identity

PAVER is a technical evidence surface: precise, calm, and dense without feeling
crowded. Its signature is a translucent research workbench over a restrained
blue, violet, and teal field. The brand mark combines a sparse BEV grid with one
planned path and a distinct endpoint.

## 2. Color

| Role | Token | Light | Dark | Usage |
| --- | --- | --- | --- | --- |
| Page | `--bg` | `#e9edf3` | `#070809` | Document background |
| Text | `--fg` | `#0e1116` | `#f4f5f7` | Primary copy |
| Secondary text | `--fg-2` | `#303844` | `#c9cfd9` | Leads and secondary values |
| Muted text | `--fg-3` | `#5d6675` | `#98a0ac` | Captions and metadata |
| Surface | `--surface` | `255 255 255` | `24 28 35` | Cards and controls |
| Accent | `--accent` | `#0b6fbf` | `#209eff` | Links, focus, active controls |
| PAVER | `--paver` | `#209eff` | `#209eff` | PAVER-specific results and route mark |
| Secondary accent | `--accent-2` | `#5a37c6` | `#b79cff` | Supporting visualizations |
| Success | `--accent-3` | `#0b7f66` | `#6ee7c7` | Improvements and route endpoint |
| Warning | `--warn` | `#9a6512` | `#e8b04b` | Cautions |
| Error | `--bad` | `#b6373a` | `#f28b8b` | Regressions and failures |

The favicon uses the dark primary text color as its stable background, PAVER
blue for the route, teal for the endpoint, and a subdued blue-grey for BEV
cells. It must remain recognizable without relying on text.

## 3. Typography

| Level | CSS token | Weight | Line height | Usage |
| --- | --- | ---: | ---: | --- |
| Display | `--fs-display` | 600 | `--lh-tight` | Paper title |
| Section | `--fs-h2` | 600 | `--lh-tight` | Section headings |
| Component | `--fs-h3` | 600 | 1.28 | Card headings |
| Lead | `--fs-lead` | 400 | 1.62 | Section introductions |
| Body | `--fs-body` | 400 | `--lh-body` | Main content |
| Metadata | `--fs-meta` | 400 or 500 | 1.6 | Controls and captions |
| Label | `--fs-label` | 600 | 1 | Uppercase labels |

Primary text uses the local Lato files with system fallbacks. Numeric and code
content uses the local Source Code Pro file with system monospace fallbacks.

## 4. Spacing & Layout

The base unit is 4px. The scale is `--s1` through `--s10`, ranging from 4px to
128px. Content is constrained by `--page: 1200px` and receives 24px horizontal
padding. Repeated content uses one, two, or three-column grids and collapses to
one column at 900px. The sticky navigation height is `--bar-h: 60px`.

## 5. Components

### Button and Link Button

- **Structure:** semantic `button` or `a.btn` with optional SVG icon.
- **Variants:** default, solid, icon-only.
- **States:** default, hover, focus-visible, disabled.
- **Accessibility:** icon-only controls require an accessible name. External
  paper and code links open in a new tab with `rel="noopener"`.
- **Layout:** inline cluster using `--s2` through `--s4`.

### Card

- **Structure:** `.card` with an optional `.chead` and content body.
- **Variants:** standard, tight, near.
- **States:** static or hover only when the complete card is interactive.
- **Accessibility:** headings preserve document order and media has text labels.
- **Layout:** stack with tokenized gaps.
- **Content containment:** long tables and code stay inside an internal scroller;
  they never define the minimum width of a responsive grid track.

### Segmented Control

- **Structure:** `.segbar` or `.chips` with semantic buttons or tabs.
- **States:** default, selected, hover, focus, disabled.
- **Accessibility:** exactly one selected option and one keyboard tab stop.
- **Layout:** wrapping horizontal cluster that becomes compact on mobile.

### Interactive Visualizer

- **Structure:** six camera panes, paired BEV canvases, transport controls, and
  layer switches.
- **States:** detection, Grad-CAM, architecture, scene, playback, opacity, and
  layer visibility states.
- **Accessibility:** controls are labelled, state is exposed through native
  inputs or ARIA, and the mobile surface must not overflow horizontally.
- **Layout:** responsive camera grid above paired canvases.

### Sticky Navigation

- **Structure:** brand name, section links, menu control, and theme control.
- **States:** current section, expanded mobile menu, light and dark themes.
- **Accessibility:** visible focus, labelled controls, and reduced-motion support.

## 6. Motion & Interaction

Only transform, opacity, and filter may animate. The background drift uses a
40-second cycle and stops under `prefers-reduced-motion`. Controls use immediate
state feedback. Playback motion reflects recorded data and is never decorative.

## 7. Depth & Surface

PAVER uses a mixed depth strategy. Cards and elevated controls combine a mild
tonal shift with restrained shadows. Borders are reserved for controls,
separators, and focused data surfaces. Translucency must preserve readable text
contrast in both themes.

## 8. Accessibility Constraints & Accepted Debt

The target is WCAG 2.2 AA. Body text must meet 4.5:1 contrast, large text and
non-text controls 3:1, all interactive elements must be keyboard reachable, and
focus must remain visible. The page supports light and dark schemes and honors
reduced motion.

There is no accepted accessibility or visual debt for the favicon and paper-link
change.
