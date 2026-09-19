# The glass segmented control

Everything learned building a pill-shaped tab bar with a sliding translucent
thumb — the geometry, the motion curve, the theming, the accessibility, and the
four bugs that only appeared once it was on screen.

The code is one working implementation, not a spec. Values marked *arbitrary*
are yours to choose; the ones marked *load-bearing* break the component if you
change them without understanding why.

---

## 1. What the component is

A track holding N buttons, plus **one** moving element — the thumb — that sits
behind the active button. The thumb is the only thing that animates. Buttons
never move, never resize, and never change background.

```
┌─────────────────────────────────────────┐   ← track  (recessed, translucent)
│  ╭───────────╮                          │
│  │  Overview │   Metrics    Ablations   │   ← thumb  (raised, moves)
│  ╰───────────╯                          │
└─────────────────────────────────────────┘
```

The whole design follows from one decision: **the thumb is a sibling of the
buttons, absolutely positioned, sitting behind them.**

Two structures people reach for instead, and why they are worse:

| Alternative | What goes wrong |
|---|---|
| Background on the active button | Nothing to animate between two elements. You get a hard cut, or you cross-fade two backgrounds and see both at once mid-transition. |
| Thumb inside the active button | It has to be destroyed and recreated on every switch, so it cannot travel. |

A separate, persistent thumb can be *measured* against any button and *moved*
there. That is the entire trick.

---

## 2. Structure

```html
<div class="segbar" role="tablist">
  <span class="thumb" aria-hidden="true"></span>
  <button role="tab" aria-selected="true"  tabindex="0">Overview</button>
  <button role="tab" aria-selected="false" tabindex="-1">Metrics</button>
  <button role="tab" aria-selected="false" tabindex="-1">Ablations</button>
</div>
```

The thumb is `aria-hidden` — it is pure decoration. Selection is communicated
entirely through `aria-selected`, which is also what CSS and the positioning
code read. **One source of truth**: no `.active` class running in parallel with
the ARIA state, because the two will disagree eventually.

---

## 3. Geometry

```css
.segbar {
  position: relative;              /* load-bearing: the thumb's containing block */
  display: inline-flex;
  flex-wrap: wrap;                 /* many items must wrap, not overflow */
  gap: 2px;
  padding: 4px;                    /* the track ring visible around the thumb */
  border-radius: var(--radius-pill);
  max-width: 100%;
  background: var(--seg-track);
}

.segbar .thumb {
  position: absolute;
  left: 0; top: 0;                 /* load-bearing: translate() is measured from here */
  z-index: -1;                     /* behind the labels */
  width: 0; height: 0;             /* until first measured */
  border-radius: var(--radius-pill);
  background: var(--seg-thumb);
  box-shadow: inset 0 0 0 1px var(--seg-line), var(--seg-cast);
}

.segbar button {
  position: relative;              /* above the thumb without needing a z-index */
  display: inline-flex;            /* load-bearing — see below */
  align-items: center; justify-content: center;
  height: 34px;                    /* arbitrary, but must be explicit */
  padding: 0 var(--s4);
  border: 0; background: none; cursor: pointer;
  white-space: nowrap;             /* a label wrapping mid-word breaks the geometry */
  border-radius: var(--radius-pill);
  color: var(--fg-2);
}
```

Four things here are less obvious than they look.

**`inline-flex` with an explicit height, not line-height centring.** The thumb
copies the button's box exactly. If the label is vertically centred by
`line-height`, the button's box includes the font's ascent and descent
asymmetrically, so a thumb that matches the box is *not* optically centred on
the text. A flex box with a fixed height gives a symmetric box, and the thumb
inherits that symmetry for free.

**`z-index: -1` rather than a stacking dance.** It puts the thumb behind the
buttons while keeping it inside the track's background. The buttons only need
`position: relative` to sit above it; no z-index on them at all.

**`padding: 4px` on the track is the design.** Without it the thumb is flush
with the track edge and the component reads as a single button. The padding is
what makes it read as *a control containing a selection*.

**`flex-wrap: wrap`, and the thumb reads `offsetTop` too.** The moment a bar
wraps to two rows, a thumb that only tracks `offsetLeft` jumps to the wrong
row. Track both axes from the start — it costs one extra line.

---

## 4. Positioning the thumb

```js
function moveThumb(host) {
  const thumb  = host.querySelector('.thumb');
  const active = host.querySelector('[aria-selected="true"], [aria-checked="true"]');
  if (!thumb) return;
  if (!active) { thumb.classList.add('hidden'); return; }   // no selection → no thumb
  thumb.style.width  = active.offsetWidth  + 'px';
  thumb.style.height = active.offsetHeight + 'px';
  thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  thumb.classList.remove('hidden');
}
```

**Measure, do not compute.** It is tempting to derive the position from item
index × width. That breaks with variable-width labels, with the gap, with
wrapping, and with any padding change. `offsetLeft`/`offsetTop` are already
relative to the positioned ancestor, which is exactly the coordinate space the
thumb lives in. The browser has done the layout; read it.

**`transform`, not `left`/`top`.** Transform is composited; animating `left`
triggers layout on every frame. Both look identical when still and completely
different when moving.

**Handle "nothing selected."** An early version left a stale thumb parked under
a button that was no longer active. An explicit `.hidden` state that fades to
`opacity: 0` covers it.

### When to re-measure

Four moments, and the last two are the ones that get forgotten:

```js
markTabs(host, key);                                   // 1. on selection change
addEventListener('resize', () => segbars.forEach(moveThumb));  // 2. on resize
document.fonts.ready.then(() => segbars.forEach(moveThumb));   // 3. on webfont swap
requestAnimationFrame(() => moveThumb(host));          // 4. one frame later
```

(3) matters because measuring before the webfont loads records fallback-font
widths, and the thumb ends up narrower or wider than the label it lands on.

(4) is the ugly one. On the first paint — or when the bar is inside a panel
that was `display: none` a moment ago — every `offset*` reads 0. Calling once
synchronously and once inside a `requestAnimationFrame` costs nothing and makes
the component immune to being built while hidden. If you can, prefer a
`ResizeObserver` on the track; the rAF is the version that works everywhere.

---

## 5. The motion

```css
.segbar .thumb {
  transition: transform 0.46s cubic-bezier(0.34, 1.3, 0.38, 1),
              width     0.46s cubic-bezier(0.34, 1.3, 0.38, 1),
              height    0.3s  ease,
              opacity   0.2s  ease;
}
.segbar button   { transition: color 0.28s ease; }
.segbar .thumb.hidden { opacity: 0; }
```

**The curve overshoots on purpose.** `cubic-bezier(0.34, 1.3, 0.38, 1)` — the
`1.3` is the third control point past 1, so the thumb travels slightly beyond
the target and settles back. That single number is what makes the control feel
physical instead of mechanical. Somewhere around 1.2–1.4 is the useful range;
above about 1.6 it reads as a bounce and gets tiring by the tenth click.

**`transform` and `width` must share one duration and one curve.** They are two
properties describing one object moving. Give width a different duration and
the thumb visibly stretches and then catches up — a rubber-band artefact that
nobody can name but everybody notices.

**Height is deliberately different** — `0.3s ease`, no overshoot. Height only
changes when the bar wraps or the font swaps, which are layout corrections, not
user-initiated moves. Overshooting a correction looks like a glitch.

**The label colour transition is shorter than the thumb's** (0.28s vs 0.46s).
The colour has to arrive *before* the thumb finishes, or the destination label
still looks inactive under a thumb that has already parked on it.

**Opacity is shortest.** Appearing and disappearing should not be an event.

**~0.4–0.5s is slower than a normal UI transition, and correct here.** The
thumb is the only moving thing on screen and the travel is the whole point of
the component. At 0.2s the overshoot is invisible and you have paid for a
spring nobody sees.

Always provide the opt-out:

```css
@media (prefers-reduced-motion: reduce) { .segbar .thumb { transition: none; } }
```

The thumb still *moves* — it just arrives instantly. Do not hide it; that
removes the selection indicator from users who asked for less motion, not less
information.

---

## 6. Theming: one rule set, four tokens

**The most important structural rule.** Write the component once. Let each
theme supply tokens. Never give a theme its own copy of the component.

```css
:root[data-theme="dark"] {
  --seg-track: rgb(255 255 255 / 0.05);   /* recessed: lighter than the surface */
  --seg-thumb: rgb(255 255 255 / 0.13);   /* raised:   lighter still            */
  --seg-line:  rgb(255 255 255 / 0.17);   /* inset hairline = the lit top edge   */
  --seg-cast:  0 1px 2px rgb(0 0 0 / 0.28);
}
:root[data-theme="light"] {
  --seg-track: rgb(14 20 30 / 0.045);     /* recessed: darker than the surface   */
  --seg-thumb: #ffffff;                   /* raised:   fully opaque              */
  --seg-line:  rgb(14 20 30 / 0.10);
  --seg-cast:  0 1px 2px rgb(16 26 46 / 0.12);
}
```

Note the inversion: on light the track is *darker* than its surroundings and
the thumb is *lighter*; on dark, both are lighter, and the separation is
carried by the hairline and the cast shadow. Recessed-vs-raised is a relative
relationship, not a fixed colour.

Note also that the light thumb is **fully opaque**. A translucent thumb on a
light background picks up whatever is behind it and stops reading as a raised
chip. On dark, 13% white over a dark surface still reads as raised, because the
surface underneath is dark enough to hold it.

### The bug this rule prevents

This component originally had a base rule (dark) plus a `[data-theme="light"]`
override. Over months the dark path accumulated a specular gradient, a second
drop shadow and a text-shadow that the light path never received. The result
looked embossed and dated — the user's description was that it had a "cheap 3D
look" — and the labels sat at low contrast because the extra shadow forced the
text colour down.

No individual value was wrong. The bug was that **the component existed twice**.
Collapsing it to one rule set driven by four tokens fixed the appearance and
removed about half the code.

A cheap way to catch this anywhere:

```bash
grep -c 'data-theme="light"' styles.css
grep -c 'data-theme="dark"'  styles.css
```

If either count is more than a handful, or the two are lopsided, components are
being written twice somewhere.

### Two shadows, two jobs

```css
box-shadow: inset 0 0 0 1px var(--seg-line),   /* defines the edge  */
            var(--seg-cast);                    /* lifts off the track */
```

The inset hairline is what actually separates the thumb from the track; the
cast shadow only needs to be `0 1px 2px`. A large soft shadow under a chip that
size makes it look like it is floating an inch above the page. Depth here is
one pixel of offset and a hairline, not blur radius.

---

## 7. Where translucency is real and where it is faked

`backdrop-filter` is a per-frame compositing pass over everything behind the
element. It is worth it in exactly one situation: **content moves behind the
surface.**

```css
/* real — the page scrolls underneath this */
.bar { position: sticky; top: 0;
       background: rgb(var(--surface) / calc(var(--surface-a) * 0.9));
       backdrop-filter: blur(20px) saturate(170%); }

/* real — a modal scrim over an image */
.viewer { background: rgb(4 6 10 / 0.88); backdrop-filter: blur(12px); }
```

The segmented thumb is **not** one of these. Nothing moves behind it: it slides
over a flat track that is 4–5% opacity. A blur there costs a compositing pass
per frame *during the animation* and produces no visible difference. Alpha
alone is enough.

Same for cards sitting still on a static background — a vertical gradient,
slightly lighter at the top and settling around 40%, reads as a lit surface at
zero cost:

```css
.card { background: linear-gradient(180deg,
          rgb(var(--surface) / calc(var(--surface-a) + 0.05)),
          rgb(var(--surface) / var(--surface-a)) 42%); }
```

**Rule of thumb:** if you could screenshot the background behind the element
once and it would never change, you do not need a backdrop filter.

### The dark-mode translucency trap

Worth stating because it applies to every glass surface, not just this one.

Cards here were once defined as **white at 5% opacity** on dark and **white at
62%** on light. Measured contrast against the page was nearly identical, so the
numbers looked fine. What differed was *show-through*: on dark, 95% of the
background passed through every surface; on light, 38% did. Dark surfaces read
as barely-there films while light ones read as solid panels.

The fix is to stop composing dark surfaces out of white:

```
light   --surface: 255 255 255;  --surface-a: 0.62
dark    --surface:  24  28  35;  --surface-a: 0.70
```

> In a dark theme a translucent surface is a **dark surface at high opacity**.
> White at low opacity is not glass, it is a hole. Check show-through, not only
> contrast ratio.

### Honour the opt-outs

Translucency is decoration; someone who turns it off should get flat opaque
surfaces, not a weaker blur:

```css
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .segbar { background: rgb(var(--line) / 0.14) !important; }
  .segbar .thumb { backdrop-filter: none !important;
                   background: var(--solid) !important;
                   box-shadow: inset 0 0 0 1px rgb(var(--line) / 0.4) !important; }
}
```

Note the thumb keeps its hairline. Under `prefers-contrast: more` the border is
the only thing distinguishing it from the track, so it gets *stronger*, not
removed.

---

## 8. Accessibility

The pattern depends on what the buttons do. Getting this wrong is the most
common defect in hand-built segmented controls.

| The buttons... | Role | Selected state | Container |
|---|---|---|---|
| swap visible panels | `tab` | `aria-selected` | `tablist` |
| change one setting, redraw in place | `radio` | `aria-checked` | `radiogroup` |

Announcing a metric switcher as a tablist tells a screen-reader user to expect
a panel change that never comes. Pick per instance, at build time:

```js
const panel = document.getElementById(`${card.id}-${key}`);
if (panel) {
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-selected', 'false');
  b.setAttribute('aria-controls', panel.id);
} else {
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', 'false');
  b.setAttribute('aria-controls', liveRegionId);   // what actually redraws
}
```

### Roving tabindex

Both patterns require it: **one** stop in the tab order, arrows move within.

```js
b.tabIndex = isActive ? 0 : -1;
```

Without it a five-item bar eats five tab presses. With it, Tab enters the group
once and arrows do the rest.

```js
host.addEventListener('keydown', e => {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const tabs = [...host.querySelectorAll('[role="tab"], [role="radio"]')];
  let i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  if (e.key === 'ArrowLeft')  i = (i - 1 + tabs.length) % tabs.length;
  if (e.key === 'ArrowRight') i = (i + 1) % tabs.length;
  if (e.key === 'Home') i = 0;
  if (e.key === 'End')  i = tabs.length - 1;
  tabs[i].focus();
  tabs[i].click();
});
```

`focus()` **then** `click()` — activating without moving focus leaves the ring
on the old item. Wrapping at both ends is the expected behaviour. `preventDefault`
stops the arrow keys from scrolling the page.

### The rest

- **`:focus-visible` on the buttons, not just `:focus`.** A mouse click should
  not leave a ring; keyboard navigation must.
- **The thumb is not the state.** It is `aria-hidden`; assistive tech reads the
  ARIA attributes. This is why the thumb can be positioned entirely from
  `aria-selected` — the visual follows the semantics rather than the reverse.
- **Touch target ≥ 44px on coarse pointers.** A 34px pill is comfortable with a
  mouse and small under a thumb:

  ```css
  .segbar button { min-height: 34px; }
  @media (pointer: coarse) { .segbar button { min-height: 44px; } }
  ```
- **Style `:disabled`.** If JS can disable an option, CSS must show it, or an
  unavailable option looks merely unselected. It happened here.

  ```css
  .segbar button:disabled { color: var(--fg-3); cursor: not-allowed; opacity: .55; }
  .segbar button:disabled:hover { color: var(--fg-3); }   /* kill the hover lift */
  ```
- **Give the press a moment.** `transform: scale(0.97)` on `:active:not(:disabled)`
  — small enough to feel rather than see.
- **Hide it in print.** A selection control on paper is noise.

### The weight-shift trap

```css
.segbar button[aria-selected="true"] { font-weight: 650; }
```

Bolding the active label makes it wider, which changes `offsetWidth`, which
changes the thumb the *next* time it is measured — so the thumb can land at the
previous label's width and settle at the wrong size a frame later.

Three ways out, in order of preference: keep the weight constant and shift
colour only; reserve the bold width up front with
`::after { content: attr(data-label); font-weight: 650; height: 0; visibility: hidden }`;
or accept it and let the rAF re-measure catch up. This project takes the third
because the widths differ by about a pixel at this size — but on a display face
or at larger sizes it is very visible, so measure before assuming.

---

## 9. Checklist

Structure and geometry

- [ ] Thumb is a sibling of the buttons, absolutely positioned, `z-index: -1`
- [ ] Track is `position: relative` with padding; buttons are `position: relative`
- [ ] Buttons use flex centring with an explicit height, not `line-height`
- [ ] `white-space: nowrap` on labels; `flex-wrap: wrap` on the track
- [ ] Thumb tracks `offsetTop` as well as `offsetLeft`

Motion

- [ ] `transform` + `width` share one duration and one curve
- [ ] The curve overshoots (third control point ≈ 1.3)
- [ ] Label colour transition is shorter than the thumb's
- [ ] `prefers-reduced-motion` disables the transition, not the thumb

Correctness

- [ ] Re-measured on select, resize, `document.fonts.ready`, and one rAF later
- [ ] Explicit hidden state when nothing is selected
- [ ] Positions are measured from the DOM, never computed from an index

Theming

- [ ] One rule set; every theme difference is a token
- [ ] Light thumb opaque; dark thumb is a light film over a dark surface
- [ ] Depth is a 1px inset hairline plus a tight cast shadow, not a big blur
- [ ] `prefers-reduced-transparency` / `prefers-contrast` opt-outs, hairline kept

Accessibility

- [ ] Role matches behaviour (`tab`+`aria-selected` vs `radio`+`aria-checked`)
- [ ] `aria-controls` points at the thing that actually changes
- [ ] Roving tabindex; arrows + Home/End wrap; `focus()` before `click()`
- [ ] `:focus-visible`, `:disabled`, `:active` all styled
- [ ] ≥44px targets on coarse pointers
- [ ] Thumb is `aria-hidden`

---

## 10. Verify by rendering

None of these bugs are visible in the source. Render and measure.

```bash
python -m http.server 8899 &
CHROME=<path to chrome or chromium>

$CHROME --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
        --window-size=1440,20000 --screenshot=page.png \
        --virtual-time-budget=14000 http://127.0.0.1:8899/
```

Check the four combinations of {light, dark} × {wide, narrow}. Defects here
appeared in exactly one of the four more than once — a bar wrapping only at
mobile width, thumb contrast collapsing only in dark mode.

Two assertions worth automating against the rendered DOM:

1. Every `.segbar` has exactly one element with `aria-selected="true"` or
   `aria-checked="true"`, and exactly one button with `tabindex="0"`.
2. The thumb's measured box matches the active button's box, within a pixel.

The second catches the whole class of bugs where the thumb was measured while
the bar was hidden, before the webfont loaded, or against a stale selection.
