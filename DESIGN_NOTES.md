# Web UI design notes

Transferable notes on building a content-heavy web page: what to decide, what
to avoid, and how to check. Written after shipping a data-dense research site,
but the specifics of that site are only examples — none of the numbers below
are requirements.

**How to read this.** Each section states a principle, then shows one concrete
way to satisfy it. The principle transfers; the code is one implementation
among many. Where a value is arbitrary it says so.

The failure modes are the useful part. Nearly all of them looked correct in the
source and only appeared once rendered in a browser.

---

## 1. Decide the system before the components

Pick a small number of scales and refuse to leave them: space, type size, line
height, radius, motion duration, elevation. Express them as custom properties
so a component cannot invent a new value without it being obvious in review.

The counts matter more than the values. One project's spacing ladder might be
4/8/12/16/24/32/48/64; another's might be a 6px base. What matters is that
there **is** a ladder and that `margin: 13px` never appears.

Two symptoms that the system has already failed:

- **Motion has more than about three durations.** A press, a state change and a
  layout move are genuinely different; eight durations are not a design, they
  are eight authors. Name them (`--t-fast/base/slow`) so the intent is visible
  at the call site.
- **A one-off font size appears inside a component.** The moment a chart hard-codes
  `font-size: 11px`, the type scale stops describing the page.

Set the ladder to whatever the design needs. Just have one.

---

## 2. Translucency: use it where it earns its cost

Frosted-glass surfaces are a *look*, not a material, and a `backdrop-filter` is
a per-frame compositing pass over everything behind the element.

**Apply a real backdrop blur only where content moves behind the surface.** A
sticky header that slides over the page, and a modal scrim over an image, are
the two cases that usually qualify:

```css
.sticky-header { background: rgb(var(--surface) / 0.9);
                 backdrop-filter: blur(20px) saturate(170%); }
.modal-scrim   { background: rgb(4 6 10 / 0.88);
                 backdrop-filter: blur(12px); }
```

**Everywhere else, fake it.** A card that sits still over a static background
gains nothing from a blur pass. A vertical gradient — slightly lighter at the
top, settling a third of the way down — reads as a lit surface at no cost:

```css
.card { background: linear-gradient(180deg,
          rgb(var(--surface) / calc(var(--surface-a) + 0.05)),
          rgb(var(--surface) / var(--surface-a)) 42%);
        box-shadow: var(--shadow);
        contain: paint; }
```

The same logic applies to decorative background washes: a large blurred image
repaints on scroll, a few radial gradients do not.

### The dark-mode trap

The most expensive mistake in this project. A card was defined as **white at
5% opacity** on dark and **white at 62%** on light.

Measured contrast against the page was nearly identical in both themes, so the
numbers looked fine. What differed was **show-through**: on dark, 95% of the
background passed through every card; on light, 38% did. The dark theme's cards
read as barely-there films while the light theme's read as panels.

The fix is to stop composing dark surfaces out of white:

```
light   --surface: 255 255 255;  --surface-a: 0.62
dark    --surface:  24  28  35;  --surface-a: 0.70
```

Same apparent lightness, a quarter of the transparency.

> **Rule.** In a dark theme a translucent surface is a *dark* surface at high
> opacity. White at low opacity is not glass, it is a hole. Check
> *show-through*, not only contrast ratio.

### Gradient falloff

A radial gradient that reaches `transparent` at a single stop shows a visible
disc edge on dark backgrounds — the eye finds the boundary even though the ramp
is mathematically smooth. Use several stops shaped like an ease-out, and end at
100%:

```css
radial-gradient(circle at 40% 40%,
  color-mix(in srgb, var(--tint) 100%, transparent)  0%,
  color-mix(in srgb, var(--tint)  62%, transparent) 26%,
  color-mix(in srgb, var(--tint)  30%, transparent) 46%,
  color-mix(in srgb, var(--tint)  12%, transparent) 64%,
  color-mix(in srgb, var(--tint)   3%, transparent) 82%,
  transparent 100%)
```

### Honour the opt-outs

Translucency is decoration. Someone who turns it off should get a flat opaque
surface, not a slightly weaker blur:

```css
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .card { background: var(--solid) !important; backdrop-filter: none !important; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important;
                           transition-duration: .001ms !important; }
}
```

---

## 3. Theming: components own rules, themes own tokens

The single most useful structural rule in this document.

A component gets **one** rule set. Each theme sets **tokens**. The moment a
theme block sets a property directly — a gradient, a shadow, a text-shadow —
the two themes begin to diverge, and the one nobody is looking at accumulates
junk.

In this project a segmented control had a base rule (dark) plus a light
override. Over time the dark path collected a specular gradient, two drop
shadows and a text-shadow the light path never had. It looked embossed and
dated, and no single value was wrong — the bug was that the component existed
twice. Rewriting it as one rule set driven by four tokens fixed the appearance
and halved the code.

A cheap audit: count theme-scoped selectors.

```bash
grep -c 'data-theme="light"' styles.css
grep -c 'data-theme="dark"'  styles.css
```

If either number is more than a handful, or the two are lopsided, components
are being written twice. In this project the count found a second instance of
the same bug in a different component.

---

## 4. States are part of the component

Design every state at the same time as the default, or the missing ones ship.

A control that JavaScript can disable but CSS never styles will look enabled.
That happened here: `button.disabled` was being set while `:disabled` had zero
rules, so an unavailable option was indistinguishable from an unselected one.

The minimum set for an interactive element:

```css
:hover            /* invitation */
:active           /* the press registers */
:disabled         /* plus why, if the reason is not obvious */
:focus-visible    /* on everything focusable, not just links */
[aria-busy]       /* loading is a state, not an empty box */
```

And the content states around it: an empty result that says what to do next, a
failed image that says it failed instead of showing a broken glyph, an error
that appears where the content would have been rather than only in the console.

A reason that lives only in a `title` attribute is a reason nobody reads. If a
control is unavailable and the reason is useful, put it on screen.

---

## 5. Icons

Do not draw UI icons with Unicode characters. `☾ ☀ ☰ ↑ ✕` render from whatever
font the system substitutes, so a theme toggle can arrive as a stray chevron on
one machine and a dingbat on another. Nothing in your CSS will warn you.

Use inline SVG with `stroke="currentColor"`, and size it from CSS rather than
letting it inherit the text size:

```css
.icon svg { width: 18px; height: 18px; display: block; }
```

Then every round button is the same optical weight, and icons follow colour
automatically in both themes.

---

## 6. Data tables

Ask what the reader actually does with the table. For a comparison table it is
usually two moves: scan **one column** for the best value, and scan **one row**
for one subject. Design for those and ignore the rest.

```css
.scroller  { overflow: auto; max-height: 32rem;      /* the scroll container   */
             background: var(--table-bg);            /* its own surface        */
             border: 1px solid var(--table-line); }
thead tr:last-child th { position: sticky; top: 0; } /* column names stay      */
th.sticky-col          { position: sticky; left: 0; }/* subject stays          */
tbody tr:hover td      { background: rgb(var(--line) / .05); }
```

Lessons that generalise:

- **Give the table its own surface.** Sharing the card background makes a table
  read as part of the card rather than as a table. Whatever background the
  sticky cells use must be that same surface — using the *page* background
  introduces a third colour that only appears while scrolling.
- **Pin one header row.** Pinning a second row requires a hardcoded offset,
  which breaks the first time a header wraps.
- **Headers carry the unit and the direction**, on a second line inside the
  same cell (`L2` / `m, lower is better`). A column should explain itself
  without a trip to the caption.
- **Sentence case beats tracked-out capitals** for scanning.
- **The caption goes outside the table.** As a `<caption>` it competes with the
  card title, scrolls sideways with the columns, and prints at body weight. A
  note below the table at label size and a quieter tone does the job.
- **A footnote is not a table row.** A spanning cell wider than the table
  stretches the whole table, and neither browsers nor typesetters warn you. Put
  it in a block after the table, constrained to the table's width.
- **Decimal places are a property of the column, not of the value.**
- **Emphasis: rule over tint.** A strong row tint fights the text on top of it.
  A light tint plus a 3px left rule reads more strongly and keeps contrast.

---

## 7. Charts

### Axis ticks

Dividing the maximum by four gives ticks like `0.30 0.61 0.91 1.22`. Choose a
round step instead — 1, 2, 2.5 or 5 times a power of ten:

```js
function niceTicks(max, count = 4) {
  const raw  = max / count;
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10;
  const top  = Math.ceil(max / step - 1e-9) * step;   // must round UP
  const ticks = [];
  for (let i = 0; i * step <= top + step * 1e-6; i++) ticks.push(i * step);
  return { ticks, top };
}
```

The `Math.ceil` is not cosmetic. An early version rounded the top tick *down*,
so a series whose largest value exceeded the last tick drew **outside the plot**.
A rounding helper that can shrink the axis below the data is worse than none.

### Labels that collide

Pinning every label to one side of its mark guarantees collisions in dense
regions. Try candidate positions and take the first that is clear:

```js
const place = labelPlacer(plotRect);
marks.forEach(m => place.reserve(m.box));        // 1. marks
strokes.forEach(s => sample(s).forEach(p => place.reserve(p)));  // 2. lines
labels.forEach(l => place.place(l.x, l.y, l.text));              // 3. labels
```

Three details make it work: reserve **marks and strokes before any label**,
offset a label attached to a line **perpendicular** to it, and clamp candidates
to the plot rectangle so nothing escapes into the axis gutter. Estimating text
width as `chars × fontSize × 0.52` is accurate enough and avoids a layout read
per label.

### One place for a value

Pick a single treatment per chart type and hold it. Values *beside* bars is the
safer default: a short bar cannot hold a label, and a chart that switches to
inside-the-bar past some width prints light text on some rows and dark text on
others. Give the axis ~20% headroom and every label fits outside.

The same applies to conditional labels: hiding the value on segments narrower
than N pixels means some segments carry a number and some do not.

### State the encoding inside the chart

Anything a reader must infer, say. Which mark is the baseline, which is the
reference line, what a highlight means. Explaining it in the paragraph above is
not enough — the reader carries the convention to the next figure, where a
hollow marker may mean something else entirely.

---

## 8. Presenting numbers

- **Use a real minus sign** (`−`, U+2212), not a hyphen, and use it everywhere.
- **Rounding can erase the difference you are illustrating.** Two rows that
  differ can round to the same integer percent. Keep a decimal in the range
  where that happens.
- **Pair absolute with relative.** `0.51% → 0.19%` is hard to size; `−63%`
  is not. Show both.
- **Say what emphasis means.** One sentence: bold is the better value in its
  comparison.
- **Distinguish "not measured" from "measured as zero".** They are different
  facts and they deserve different marks (`n/a` versus `none`, say). One dash
  for both is a lie.
- **Units belong in the header**, once, with the direction of improvement.
- **Do not quote a number in prose and again in a table** unless you enjoy
  keeping them in sync. They will drift.

---

## 9. Copy

- End every sentence with a full stop, or none of them. Mixed is what people
  notice without knowing why.
- A title says what the thing *is*. "At a glance" says nothing.
- Do not recite the method in a title. "Attribution across the front cameras
  and every head" → "Attribution per camera".
- Never leak an internal identifier into the UI: `CAM_FRONT_LEFT` → "Front
  left"; a boolean printed as `False` → "No collision".
- Avoid absolute claims that a later edit will falsify. A section called
  "Every table from the appendix" becomes false the day one table is removed.
- Labels and tooltips describe what the control *does*, not what it is called
  internally.

---

## 10. Verify by rendering, not by reading

Nearly every defect worth fixing in this project was invisible in the source.
Render the page and measure it.

```bash
python -m http.server 8899 &
CHROME=<path to chrome or chromium>

# an image, for defects you have to see
$CHROME --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
        --window-size=1440,20000 --screenshot=page.png \
        --virtual-time-budget=14000 http://127.0.0.1:8899/

# the rendered DOM, for defects you can compute
$CHROME --headless=new --disable-gpu --no-sandbox \
        --virtual-time-budget=12000 --dump-dom http://127.0.0.1:8899/ > dom.html
```

Checks worth automating, all against the rendered DOM:

1. **Nothing overflows its container.** For SVG, every `rect` must satisfy
   `x + width ≤ viewBox width`. This catches the entire tick-rounding class of
   bug.
2. **Placement is uniform.** For each bar group, is the value's `x` inside the
   bar's span? A chart with both is a chart with a bug.
3. **No text collisions.** Bucket `<text>` by `y`, estimate widths, look for
   overlapping x-ranges. Skip anything with a `rotate` transform or every
   rotated axis title reports as a false positive.
4. **Structure.** Duplicate `id`s; links and buttons with no accessible name;
   cards nested inside cards; every `querySelector('#id')` in the JS resolving
   to something that exists.

Render at a narrow width and in both themes. Several defects here appeared in
exactly one of the four combinations — a title breaking inside a hyphenated
compound only at mobile width, icons falling back to the wrong glyph only in
dark mode.

---

## 11. Things that cost more than they looked

- **A large static site can take ten minutes to deploy, and pushing again
  cancels the run in flight.** Three consecutive deploys were cancelled and the
  site quietly kept serving old files, including media everyone believed had
  been replaced. Verify the deployed artefact, not the commit.
- **Pre-rendered media does not respond to a code fix.** An overlay burned into
  a video stays there until the renderer changes and the media is produced
  again. Know which of your assets are generated and which are baked.
- **Deleting a feature leaves its assets behind.** Tens of megabytes of images
  outlived the tab that displayed them, on a site that was near a hard size
  limit.
- **`will-change`, `backdrop-filter` and `contain` are instructions to the
  compositor.** Use them where they pay and nowhere else; sprinkled broadly
  they cost memory and win nothing.
