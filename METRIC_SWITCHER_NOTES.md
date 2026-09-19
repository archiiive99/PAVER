# The metric switcher

A pill bar that swaps which metric a chart shows — `Planning L2` → `Collision
rate` → `Motion ADE` — redrawing in place. This is the complete design: the
data shape, the control, the redraw, the URL state, and the details that make it
feel considered rather than assembled.

Written to be lifted into another project. Every value here is from a working
implementation; the ones that are arbitrary are marked, and the ones that break
things if changed are marked **load-bearing**.

---

## 0. The whole thing in one screen

```js
// ── data ──────────────────────────────────────────────────────────────
const ROWSETS = {
  pseudo: {
    metrics: [['l2',  'Planning L2 (m)', true],     // [key, axis label, lowerIsBetter]
              ['col', 'Collision (%)',   true],
              ['nds', 'Detection NDS',   false]],
    rows: [
      { label: 'No pretraining',            l2: 0.662, col: 0.513, nds: 0.338 },
      { label: 'Pseudo-LiDAR',              l2: 0.563, col: 0.560, nds: 0.386 },
      { label: 'LiDAR',        ours: true,  l2: 0.603, col: 0.187, nds: 0.397 }
    ]
  }
};

// ── wiring ────────────────────────────────────────────────────────────
const metrics = ROWSETS[set].metrics;
const draw = (k, push) => {
  chartRows(document.querySelector('#' + host), set, k);   // redraw
  markTabs(document.querySelector('#' + tabId), k);        // restate selection
  if (push) setParam(param, k);                            // remember, only on click
};
chipTabs(document.querySelector('#' + tabId), metrics.map(m => [m[0], m[1]]), draw);
draw(getParam(param, metrics[0][0]));                      // ← no push on init
```

Four lines of wiring. Everything below explains why each one is shaped the way
it is.

---

## 1. The data shape is the design

```js
metrics: [['l2', 'Planning L2 (m)', true], ['col', 'Collision (%)', true]]
//          │      │                  └─ lower is better
//          │      └─ the axis label, with its unit
//          └─ the property name on every row object
```

Three decisions live in that tuple, and getting them right removes most of the
work downstream.

**The key is the row property.** Rows are flat objects (`{label, l2, col, nds}`),
not nested per-metric structures. Switching metric is then `r[key]` — no
reshaping, no lookup table, no `switch`. Adding a metric means adding one tuple
and one field per row.

**The label carries the unit.** `Planning L2 (m)`, not `L2`. The axis title is
the only place the unit appears, so it must be there. A switcher that changes
the axis title *and* the unit *and* the scale in one click needs no legend.

**`lowerIsBetter` is load-bearing.** It is not a display hint. Four separate
behaviours read it, and if it is absent, all four break silently when you add a
metric that points the other way:

| Consumer | With `lower: true` | With `lower: false` |
|---|---|---|
| Best-row selection | `b[key] < a[key]` | `b[key] > a[key]` |
| Axis title suffix | `Planning L2 (m) ↓` | `Detection NDS ↑` |
| Delta colouring | negative delta = better | positive delta = better |
| Screen-reader label | "lower is better" | "higher is better" |

This is the single most common defect in hand-built metric switchers: the
chart happily marks the *worst* configuration as best the moment someone adds
an accuracy metric to a bar of error metrics. Encode direction in the data,
never in the drawing code.

---

## 2. The control

A track holding N buttons plus **one** moving element — the thumb — behind the
active button. The thumb is the only thing that animates; buttons never move,
resize, or change background.

```html
<div class="segbar" role="radiogroup">
  <span class="thumb" aria-hidden="true"></span>
  <button role="radio" aria-checked="true"  tabindex="0"  data-k="l2">Planning L2</button>
  <button role="radio" aria-checked="false" tabindex="-1" data-k="col">Collision rate</button>
</div>
```

### Why the thumb is a sibling

| Alternative | What breaks |
|---|---|
| Background on the active button | Nothing to animate *between* two elements — you get a hard cut, or you cross-fade two backgrounds and briefly see both. |
| Thumb nested in the active button | It must be destroyed and recreated on every switch, so it can never travel. |

A separate, persistent element can be **measured against any button and moved
there**. That is the whole trick.

### Geometry

```css
.segbar {
  position: relative;              /* load-bearing: the thumb's containing block */
  display: inline-flex;
  flex-wrap: wrap;                 /* 5+ metrics must wrap, not overflow */
  gap: 2px;
  padding: 4px;                    /* the visible track ring around the thumb   */
  border-radius: var(--radius-pill);
  max-width: 100%;
  background: var(--seg-track);
}

.segbar .thumb {
  position: absolute;
  left: 0; top: 0;                 /* load-bearing: translate() measures from here */
  z-index: -1;                     /* behind the labels                            */
  width: 0; height: 0;             /* until first measured                         */
  border-radius: var(--radius-pill);
  background: var(--seg-thumb);
  box-shadow: inset 0 0 0 1px var(--seg-line), var(--seg-cast);
}

.segbar button {
  position: relative;              /* above the thumb without any z-index */
  display: inline-flex;            /* load-bearing — see below            */
  align-items: center; justify-content: center;
  height: 34px;                    /* arbitrary, but must be explicit     */
  padding: 0 var(--s4);
  border: 0; background: none; cursor: pointer;
  white-space: nowrap;             /* "Collision rate" must not wrap mid-label */
  border-radius: var(--radius-pill);
  font-size: var(--fs-meta); font-weight: 500;
  color: var(--fg-2);
}
.segbar button:hover { color: var(--fg); }
.segbar button[aria-checked="true"],
.segbar button[aria-selected="true"] { color: var(--fg); font-weight: 650; }
```

Four non-obvious points:

**`inline-flex` with an explicit height, not `line-height` centring.** The
thumb copies the button's box exactly. If the label is centred by line-height,
the box includes the font's ascent and descent asymmetrically, so a thumb
matching the box is *not* optically centred on the text. A flex box with a fixed
height is symmetric, and the thumb inherits that symmetry free.

**`z-index: -1` instead of a stacking dance.** It puts the thumb behind the
buttons while keeping it inside the track's background. Buttons need only
`position: relative`.

**`padding: 4px` on the track is the design.** Without it the thumb is flush
with the track edge and the whole thing reads as one button rather than as *a
control containing a selection*.

**`flex-wrap: wrap` means the thumb must track `offsetTop` too.** Metric bars
are the ones that wrap — seven metrics at any realistic width will go to two
rows. A thumb that only tracks `offsetLeft` jumps to the wrong row the first
time that happens.

---

## 3. Positioning the thumb

```js
function moveThumb(host) {
  const thumb  = host.querySelector('.thumb');
  const active = host.querySelector('[aria-checked="true"], [aria-selected="true"]');
  if (!thumb) return;
  if (!active) { thumb.classList.add('hidden'); return; }   // no selection → no thumb
  thumb.style.width     = active.offsetWidth  + 'px';
  thumb.style.height    = active.offsetHeight + 'px';
  thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  thumb.classList.remove('hidden');
}
```

**Measure, never compute.** Deriving position from `index × width` breaks with
variable-width labels — and metric labels are *always* variable width
(`Planning L2 (m)` vs `Motion MR`). It also breaks with the gap, with padding
changes, and with wrapping. `offsetLeft`/`offsetTop` are already relative to the
positioned ancestor, which is exactly the coordinate space the thumb lives in.
The browser has done the layout; read it.

**`transform`, not `left`/`top`.** Transform is composited; animating `left`
triggers layout every frame. Identical when still, completely different moving.

**Handle "nothing selected."** Otherwise a stale thumb parks under a button that
is no longer active. An explicit `.hidden` state fading to `opacity: 0` covers
it.

### Re-measure at four moments

```js
markTabs(host, key);                                            // 1. selection change
addEventListener('resize', () => segbars.forEach(moveThumb));   // 2. resize
document.fonts.ready.then(() => segbars.forEach(moveThumb));    // 3. webfont swap
requestAnimationFrame(() => moveThumb(host));                   // 4. one frame later
```

(3) matters because measuring before the webfont loads records fallback-font
widths — the thumb lands narrower or wider than the label it sits on.

(4) is the ugly but necessary one. On first paint, or when the bar lives in a
panel that was `display: none` a moment ago, every `offset*` reads **0**.
Calling once synchronously and once inside a `requestAnimationFrame` costs
nothing and makes the component immune to being built while hidden. A
`ResizeObserver` on the track is better where available; the rAF is the version
that works everywhere.

---

## 4. The motion

```css
.segbar .thumb {
  transition: transform 0.46s cubic-bezier(0.34, 1.3, 0.38, 1),
              width     0.46s cubic-bezier(0.34, 1.3, 0.38, 1),
              height    0.3s  ease,
              opacity   0.2s  ease;
}
.segbar button        { transition: color 0.28s ease; }
.segbar .thumb.hidden { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .segbar .thumb { transition: none; } }
```

**The curve overshoots on purpose.** In `cubic-bezier(0.34, 1.3, 0.38, 1)` the
`1.3` is the third control point past 1, so the thumb travels slightly beyond
the target and settles back. That one number is what makes the control feel
physical rather than mechanical. Useful range is roughly 1.2–1.4; past ~1.6 it
reads as a bounce and gets tiring by the tenth click.

**`transform` and `width` must share one duration and one curve.** They are two
properties describing one object moving. Different durations produce a visible
stretch-then-catch-up — a rubber-band artefact nobody can name but everybody
notices.

**Height is deliberately different** — `0.3s ease`, no overshoot. Height only
changes when the bar wraps or the font swaps, which are layout *corrections*,
not user-initiated moves. Overshooting a correction looks like a glitch.

**Label colour is shorter than the thumb** (0.28s vs 0.46s), so the destination
label has already brightened before the thumb parks on it. Reverse them and the
active label looks inactive under a thumb that has finished travelling.

**~0.4–0.5s is slower than a typical UI transition, and right here.** The thumb
is the only moving thing and the travel is the point. At 0.2s the overshoot is
invisible and you have paid for a spring nobody sees.

Under reduced motion the thumb still **moves**, it just arrives instantly. Do
not hide it — that removes the selection indicator from users who asked for less
motion, not less information.

---

## 5. Theming: one rule set, four tokens

Write the component **once**. Each theme supplies tokens. Never give a theme its
own copy of the component.

```css
:root[data-theme="dark"] {
  --seg-track: rgb(255 255 255 / 0.05);   /* recessed: lighter than the surface */
  --seg-thumb: rgb(255 255 255 / 0.13);   /* raised:   lighter still            */
  --seg-line:  rgb(255 255 255 / 0.17);   /* inset hairline = the lit top edge  */
  --seg-cast:  0 1px 2px rgb(0 0 0 / 0.28);
}
:root[data-theme="light"] {
  --seg-track: rgb(14 20 30 / 0.045);     /* recessed: darker than the surface  */
  --seg-thumb: #ffffff;                   /* raised:   fully opaque             */
  --seg-line:  rgb(14 20 30 / 0.10);
  --seg-cast:  0 1px 2px rgb(16 26 46 / 0.12);
}
```

Note the inversion: on light the track is *darker* than its surroundings and the
thumb *lighter*; on dark both are lighter and the separation is carried by the
hairline plus the cast shadow. Recessed-versus-raised is a relative
relationship, not a fixed colour.

Note also the light thumb is **fully opaque**. A translucent thumb on a light
background picks up whatever is behind it and stops reading as a raised chip. On
dark, 13% white still reads as raised because the surface underneath is dark
enough to hold it.

### The bug this rule prevents

This component originally had a base rule (dark) plus a `[data-theme="light"]`
override. Over months the dark path accumulated a specular gradient, a second
drop shadow and a text-shadow the light path never got. It looked embossed and
dated, and the labels sat at low contrast because the extra shadow forced the
text colour down.

No individual value was wrong. **The component existed twice.** Collapsing it to
one rule set driven by four tokens fixed the appearance and removed about half
the code.

Cheap audit, works in any project:

```bash
grep -c 'data-theme="light"' styles.css
grep -c 'data-theme="dark"'  styles.css
```

More than a handful, or lopsided, means components are being written twice.

### Two shadows, two jobs

```css
box-shadow: inset 0 0 0 1px var(--seg-line),   /* defines the edge     */
            var(--seg-cast);                    /* lifts off the track  */
```

The inset hairline does the separating; the cast shadow only needs `0 1px 2px`.
A large soft shadow under a chip that size makes it look like it is floating an
inch off the page. Depth here is one pixel of offset plus a hairline, not blur
radius.

### No backdrop blur on the thumb

`backdrop-filter` is a per-frame compositing pass over everything behind the
element. Worth it only when **content moves behind the surface** — a sticky
header the page scrolls under, a modal scrim over an image.

The thumb is not that. It slides over a flat track at 4–5% opacity; nothing
moves behind it. A blur there costs a compositing pass *per frame during the
animation* and produces no visible difference. Alpha alone is enough.

Rule of thumb: if you could screenshot what is behind the element once and it
would never change, you do not need a backdrop filter.

Still honour the opt-outs:

```css
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .segbar { background: rgb(var(--line) / 0.14) !important; }
  .segbar .thumb { backdrop-filter: none !important;
                   background: var(--solid) !important;
                   box-shadow: inset 0 0 0 1px rgb(var(--line) / 0.4) !important; }
}
```

The thumb keeps its hairline — under `prefers-contrast: more` the border is the
only thing distinguishing it from the track, so it gets *stronger*, not removed.

---

## 6. Accessibility: `radio`, not `tab`

**This is where metric switchers differ from tab bars, and it is the most
commonly botched part.**

| The buttons... | Role | Selected state | Container |
|---|---|---|---|
| swap visible panels | `tab` | `aria-selected` | `tablist` |
| **change one setting, redraw in place** | **`radio`** | **`aria-checked`** | **`radiogroup`** |

A metric switcher is the second row. Announcing it as a tablist tells a
screen-reader user to expect a panel change that never comes — there is one
chart, and it is being redrawn.

Decide per instance, at build time, from whether a matching panel exists:

```js
const panel = document.getElementById(`${card.id}-${key}`);
if (panel) {
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-selected', 'false');
  b.setAttribute('aria-controls', panel.id);
} else {
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', 'false');
  /* point at the element that actually redraws, and give it an id if it lacks one */
  const live = card.querySelector('[data-live], .chart-host, .plot') || card;
  if (!live.id) live.id = `${card.id}-view`;
  b.setAttribute('aria-controls', live.id);
}
```

Then set the container role from what the buttons turned out to be:

```js
host.setAttribute('role', radios.length ? 'radiogroup' : 'tablist');
```

### Roving tabindex

Both patterns need it: **one** stop in the tab order, arrows move within.

```js
b.tabIndex = isActive ? 0 : -1;
```

Without it a seven-metric bar eats seven tab presses.

```js
host.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const tabs = [...host.querySelectorAll('[role="tab"], [role="radio"]')];
  let i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();                                    // stop the page scrolling
  if (e.key === 'ArrowLeft')  i = (i - 1 + tabs.length) % tabs.length;
  if (e.key === 'ArrowRight') i = (i + 1) % tabs.length;
  if (e.key === 'Home') i = 0;
  if (e.key === 'End')  i = tabs.length - 1;
  tabs[i].focus();
  tabs[i].click();                                       // focus THEN activate
});
```

`focus()` before `click()` — activating without moving focus leaves the ring on
the old item. Wrapping at both ends is expected behaviour.

### The rest

- **The thumb is `aria-hidden`.** Selection is communicated entirely through
  ARIA. This is *why* `moveThumb` reads `aria-checked` to find the active
  button: one source of truth, visual follows semantics. Never run an `.active`
  class in parallel — the two will disagree.
- **`:focus-visible`, not `:focus`.** A mouse click should not leave a ring;
  keyboard navigation must.
- **Style `:disabled`.** If JS can disable a metric (no data for this set), CSS
  must show it, or an unavailable metric looks merely unselected:
  ```css
  .segbar button:disabled { color: var(--fg-3); cursor: not-allowed; opacity: .55; }
  .segbar button:disabled:hover { color: var(--fg-3); }   /* kill the hover lift */
  ```
- **Give the press a moment:** `transform: scale(0.97)` on `:active:not(:disabled)`.
- **≥44px targets on coarse pointers:**
  ```css
  .segbar button { min-height: 34px; }
  @media (pointer: coarse) { .segbar button { min-height: 44px; } }
  ```
- **Hide the bar in print.** A selection control on paper is noise; print the
  current state instead.

### The weight-shift trap

```css
.segbar button[aria-checked="true"] { font-weight: 650; }
```

Bolding the active label makes it wider, which changes `offsetWidth`, which
changes the thumb the *next* time it is measured — so the thumb can land at the
previous label's width and correct a frame later.

Three ways out, best first: keep the weight constant and shift colour only;
reserve the bold width up front with a hidden `::after { content: attr(data-label);
font-weight: 650; height: 0; visibility: hidden }`; or accept it and let the rAF
re-measure catch up. This implementation takes the third because at this size
the widths differ by about a pixel — but at display sizes it is very visible, so
measure before assuming.

---

## 7. The redraw

**Tear down and rebuild. Do not diff.**

```js
function frame(host, w, h, label) {
  host.innerHTML = '';                          // ← the entire teardown
  return el('svg', {
    viewBox: `0 0 ${w} ${h}`, width: '100%',
    role: 'img', 'aria-label': label,           // ← regenerated per metric
    preserveAspectRatio: 'xMidYMid meet'
  }, host);
}
```

A metric switch changes the axis scale, the tick values, the bar widths, the
best-row marker, every delta, the axis title, and the number of decimals.
Diffing that is more code than rebuilding it and gets subtly wrong in the cases
you did not think about. These charts are tens of nodes; a full rebuild is
sub-millisecond.

Two things must be regenerated with the SVG, and both are easy to forget:

**The `aria-label`.** It is the chart's accessible name. If it is written once
in the HTML it describes the metric that happened to load first, forever:

```js
const svg = frame(host, W, H, `${label} for each configuration, read against the baseline`);
```

**The height.** `H = T + rows.length * rh + B`. If the row count varies per
metric, a fixed height clips or leaves a gap.

### Everything the metric drives

```js
const meta = set.metrics.find(m => m[0] === metricKey) || set.metrics[0];  // ← fallback
const [key, label, lower] = meta;

/* 20% headroom so the value can sit BESIDE its bar and still fit */
const scale = niceTicks(Math.max(...rows.map(r => r[key])) * 1.2 || 1, 4);
const max   = scale.top;
const x     = v => L + (W - L - R) * (v / max);

/* direction-aware best row */
const best = rows.reduce((a, b) => (lower ? b[key] < a[key] : b[key] > a[key]) ? b : a);

/* decimals are a property of the SCALE, not of the value */
const decimals = max < 1 ? 3 : 2;

/* the axis says which way is better, in the chart, not in the caption */
el('text', { text: label + (lower ? ' ↓' : ' ↑') }, svg);
```

Four things to steal here.

**Always rescale.** Collision at 0.5% and L2 at 0.66 m share no axis. A switcher
that keeps the axis fixed across metrics is showing one metric correctly and the
rest as slivers.

**The `|| set.metrics[0]` fallback is load-bearing.** The initial key comes from
the URL, which is user-editable. `?pm=garbage` must fall back, not throw.

**Decimals from the scale, not the value.** `max < 1 ? 3 : 2` gives every value
in a column the same number of decimals — mixed precision in one chart reads as
carelessness. Deriving per-value gives `0.5` next to `0.187`.

**Round axis ticks, rounding *up*.**

```js
function niceTicks(max, count = 4) {
  const raw  = max / count;
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10;
  const top  = Math.ceil(max / step - 1e-9) * step;   // ← MUST round up
  const ticks = [];
  for (let i = 0; i * step <= top + step * 1e-6; i++) ticks.push(i * step);
  return { ticks, top };
}
```

The `Math.ceil` is not cosmetic. An earlier version rounded the top tick *down*,
so a series whose largest value exceeded the last tick **drew outside the plot**
— bars ran off the right edge of the SVG. A rounding helper that can shrink the
axis below the data is worse than no helper. This is metric-switcher-specific
danger: you only see it on the one metric whose maximum happens to land just
above a step boundary, so it survives casual testing.

### Values beside bars, never inside

```js
const w = Math.max(2, x(r[key]) - L);            // ← minimum width, see below
el('rect', { x: L, y: y + 6, width: w, height: rh - 14, rx: 6, class: 'fill' }, g);
el('text', { x: L + w + 10, y: y + rh / 2 + 4, class: 'val start',
             text: fmt(r[key], decimals) }, g);
```

Pick one placement and hold it. Inside-the-bar labels *look* better on the
metric you designed against and then fall apart on the next one: switch to a
metric where one configuration is near zero and its label has nowhere to go, so
the code drops it outside — and now the chart has light text inside some bars
and dark text beside others. The 1.2 axis headroom exists precisely so outside
always fits.

`Math.max(2, ...)` guarantees a visible stub for a near-zero value. A bar of
width 0 reads as missing data rather than as a very good score — a real
distinction on collision rate.

### Deltas: absolute and relative

```js
const raw    = r[key] - ref[key];
const rel    = ref[key] === 0 ? null : raw / ref[key] * 100;   // ← guard the divide
const better = lower ? raw < 0 : raw > 0;                      // ← direction again
const sign   = v => (v > 0 ? '+' : v < 0 ? '−' : '');     // ← U+2212, not hyphen
```

`0.51% → 0.19%` is hard to size; `−63%` is not. Show the value and the delta.

Three traps: a **zero baseline** makes the relative delta infinite — fall back to
the absolute; `better` must consult `lower`, or the colours invert on the first
higher-is-better metric; and the **real minus sign** (U+2212) matters because a
hyphen is visibly shorter and does not align with `+` in a column.

### Per-block baselines

```js
const famOf = r => r.fam || 'all';
const refOf = new Map();
rows.forEach(r => { if (!refOf.has(famOf(r))) refOf.set(famOf(r), r); });
```

When a chart mixes architectures, each row must be measured against **its own**
family's baseline — a VAD-Base configuration compared against a VAD-Tiny number
is meaningless. The first row of each family is its reference, and the reference
rule spans only the rows it governs, so several baselines coexist without
ambiguity.

The `|| 'all'` default means row sets without families need no extra field.

### State the encoding inside the chart

Anything the reader has to infer, say — in the plot, not in the paragraph above
it, because the reader carries a convention forward to the next figure where it
may mean something else:

```js
el('text', { text: 'Baseline' }, svg);                    // labels the dashed rule
el('text', { text: 'best' }, svg);                        // labels the wedge
el('title', { text: 'Best value in this chart' }, mark);  // and on hover
```

Also note the label-side flip: when the baseline rule sits past the midpoint,
its label must render to its **left** or it collides with the right gutter.

```js
const refRight = x(ref0[key]) > (L + W - R) / 2;
el('text', { x: x(ref0[key]) + (refRight ? -8 : 8),
             class: 'reflab ' + (refRight ? 'end' : 'start'), text: 'Baseline' }, svg);
```

This is a metric-switcher problem specifically: the baseline's position moves
when the metric changes, so a label that is safely left-aligned on `L2` overflows
on `Collision`. Any annotation anchored to a data value needs this flip.

---

## 8. URL state

```js
const params   = new URLSearchParams(location.search);
const getParam = (k, d) => params.get(k) || d;
function setParam(k, v) {
  const u = new URL(location.href);
  u.searchParams.set(k, v);
  history.replaceState(null, '', u);        // ← replace, NOT push
}
```

**`replaceState`, not `pushState`.** This is the detail people get wrong. A
metric switch is not navigation. With `pushState`, clicking through six metrics
puts six entries in history and the back button walks the user backwards through
their own clicking instead of leaving the page. Nobody expects Back to undo a
toggle.

**Every switcher needs a short, distinct parameter.** `pm`, `mm`, `hz`, `sched`
— a page with ten switchers all writing `?metric=` would have them stomping each
other. Keep a registry so they stay unique.

### The `push` flag

```js
const draw = (k, push) => {
  chartRows(host, set, k);
  markTabs(tabs, k);
  if (push) setParam(param, k);     // ← only when the user actually clicked
};
chipTabs(tabs, metrics.map(m => [m[0], m[1]]), draw);   // click handler passes push = true
draw(getParam(param, metrics[0][0]));                   // init passes undefined
```

The second argument is what separates a **user action** from an **initial
render**. Without it, first paint writes every default into the URL, so a clean
link instantly becomes `?pm=l2&mm=divider&hz=L2&sched=Tiny` before the user has
touched anything. Shared links get noisy, and the URL stops meaning "the state
someone chose."

The click path is the only one that sets it:

```js
b.addEventListener('click', () => onPick(key, true));
```

**Initialise from the URL with the first metric as the default** —
`getParam(param, metrics[0][0])`. This gives deep-linking for free: a link to a
specific metric opens on it, and everything else opens on a sensible default.

---

## 9. Copy

- **Labels are the metric, not the field name.** `Planning L2`, not `l2`; the
  key and the label are separate tuple slots precisely so the internal name
  never leaks.
- **Unit in the axis title, once.** Not on every value, not in the bar labels.
- **Direction in the axis, as an arrow.** `Planning L2 (m) ↓`. It is one glyph
  and it removes a sentence from the caption.
- **Sentence case, no trailing periods on labels.** Chip labels are not
  sentences.
- **The caption lives outside the chart**, below it, at label size in a quieter
  tone — so it does not compete with the card title and does not scroll away.
- **Do not repeat a number in prose and in the chart.** They will drift.

---

## 10. Checklist

Data

- [ ] Metric tuple is `[key, label, lowerIsBetter]`; rows are flat objects
- [ ] `lowerIsBetter` consumed by best-row, axis arrow, delta colour, aria-label
- [ ] Unknown metric key falls back to `metrics[0]` rather than throwing

Control

- [ ] Thumb is a sibling, absolutely positioned, `z-index: -1`, `aria-hidden`
- [ ] Track `position: relative` + padding; buttons `position: relative`
- [ ] Buttons flex-centred with an explicit height, not `line-height`
- [ ] `white-space: nowrap` on labels; `flex-wrap: wrap` on the track
- [ ] Thumb tracks `offsetTop` as well as `offsetLeft`
- [ ] Position measured from the DOM, never computed from an index
- [ ] Re-measured on select, resize, `fonts.ready`, and one rAF later
- [ ] Explicit hidden state when nothing is selected

Motion

- [ ] `transform` + `width` share one duration and one curve
- [ ] Curve overshoots (third control point ≈ 1.3)
- [ ] Label colour transition shorter than the thumb's
- [ ] `prefers-reduced-motion` disables the transition, not the thumb

Theming

- [ ] One rule set; every theme difference is a token
- [ ] Light thumb opaque; dark thumb a light film over a dark surface
- [ ] Depth = 1px inset hairline + tight cast shadow, not a big blur
- [ ] No `backdrop-filter` on the thumb
- [ ] Reduced-transparency / high-contrast opt-outs keep the hairline

Accessibility

- [ ] `role="radio"` + `aria-checked` + `radiogroup` (redraws in place)
- [ ] `aria-controls` points at the element that actually redraws, which has an id
- [ ] Roving tabindex; arrows + Home/End wrap; `focus()` before `click()`
- [ ] `:focus-visible`, `:disabled`, `:active` all styled
- [ ] ≥44px targets on coarse pointers

Redraw

- [ ] Full teardown (`host.innerHTML = ''`), no diffing
- [ ] `aria-label` regenerated per metric
- [ ] Axis rescaled per metric, with ~20% headroom
- [ ] `niceTicks` rounds the top tick **up**
- [ ] Decimals derived from the scale, uniform within a chart
- [ ] Values beside bars on every metric; `Math.max(2, w)` for near-zero
- [ ] Deltas guard a zero baseline; U+2212 for minus
- [ ] Annotations anchored to data values flip side near the plot edge

State

- [ ] `replaceState`, never `pushState`
- [ ] Unique short param per switcher
- [ ] `push` flag distinguishes click from init; init writes nothing
- [ ] Initial value read from the URL with `metrics[0]` as default

---

## 11. Verify by rendering

None of these defects are visible in the source.

```bash
python -m http.server 8899 &
CHROME=<path to chrome or chromium>

$CHROME --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
        --window-size=1440,20000 --screenshot=page.png \
        --virtual-time-budget=14000 http://127.0.0.1:8899/

$CHROME --headless=new --disable-gpu --no-sandbox \
        --virtual-time-budget=12000 --dump-dom http://127.0.0.1:8899/ > dom.html
```

**Render every metric, not just the default.** The URL parameters make this
scriptable — load `?pm=l2`, `?pm=col`, `?pm=nds` in turn and screenshot each.
This is the only way to catch the whole class of bugs that appear on exactly one
metric: the axis that rounds down, the label that collides at one scale, the
delta that inverts on the one higher-is-better metric.

Then check the four combinations of {light, dark} × {wide, narrow}. Defects here
showed up in exactly one of the four more than once.

Assertions worth automating against the dumped DOM:

1. Every `rect` satisfies `x + width ≤ viewBox width` — catches the entire
   tick-rounding class of bug.
2. Every value label's `x` is **outside** its bar's span — catches mixed
   placement.
3. Each `.segbar` has exactly one `aria-checked="true"` and exactly one
   `tabindex="0"`.
4. The thumb's measured box matches the active button's box within a pixel —
   catches measurement while hidden, before the webfont, or against a stale
   selection.
5. No two `<text>` nodes at the same `y` have overlapping x-ranges (skip
   anything with a `rotate` transform, or rotated axis titles false-positive).
