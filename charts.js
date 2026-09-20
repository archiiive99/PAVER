/* PAVER project page — dependency-free, theme-aware, animated SVG charts.
 *
 * Every series is transcribed from the manuscript tables and from
 * figures/analysis/teaser_layout_variants_20260729/teaser_layout_source.csv,
 * so the charts and the paper report the same numbers.
 */
'use strict';

const NS = 'http://www.w3.org/2000/svg';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* opaque tint: mixes a token colour toward the plot surface instead of using
 * opacity, so grid lines can never read through a bar or a swatch. */
const tint = (col, pct) => `color-mix(in srgb, ${col} ${pct}%, var(--plot-bg))`;

const el = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in (attrs || {})) {
    if (k === 'text') n.textContent = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(n);
  return n;
};
const fmt = (v, d) => Number(v).toFixed(d == null ? 2 : d);
const shortParams = p => p === 0 ? '0' : (p >= 1e6 ? fmt(p / 1e6, p >= 1e7 ? 1 : 2) + 'M' : Math.round(p / 1e3) + 'K');

/* ── data ─────────────────────────────────────────────────────────────── */
const D = {
  cost: [
    { label: 'VAD-Tiny',        h: 21.3, ours: false },
    { label: 'VAD-Tiny + PAVER', h: 13.6, ours: true, speedup: 1.57 },
    { label: 'VAD-Base',        h: 103.0, ours: false },
    { label: 'VAD-Base + PAVER', h: 66.1, ours: true, speedup: 1.56 }
  ],
  transfer: [
    { label: 'VAD-Tiny',         l2: 0.6621, col: 0.5133, fam: 'Tiny',  ours: false },
    { label: 'VAD-Tiny + PAVER', l2: 0.6027, col: 0.1867, fam: 'Tiny',  ours: true },
    { label: 'VAD-Base',         l2: 0.7419, col: 0.3067, fam: 'Base',  ours: false },
    { label: 'VAD-Base + PAVER', l2: 0.5619, col: 0.4010, fam: 'Base',  ours: true },
    { label: 'GenAD',            l2: 0.5911, col: 0.3700, fam: 'GenAD', ours: false },
    { label: 'GenAD + PAVER',    l2: 0.5366, col: 0.2100, fam: 'GenAD', ours: true },
    { label: 'VAD-Tiny + UniPAD', l2: 0.7700, col: 0.3200, fam: 'other', reported: true, params: 6411021 },
    { label: 'VAD-Tiny + MIM4D',  l2: 0.7133, col: 0.2900, fam: 'other', reported: true, params: 13430493 },
    { label: 'VAD-Base + MIM4D',  l2: 0.6667, col: 0.1933, fam: 'other', reported: true, params: 13430493 }
  ],
  capacity: {
    /* sections/07_target_and_qualitative_evidence.tex, VAD-Tiny aggregate table.
       The scratch endpoint is the reference every point is read against. */
    metrics: [
      ['l2',  'Planning L2 (m)',  true],
      ['col', 'Collision (%)',    true],
      ['ade', 'Motion ADE (m)',   true],
      ['nds', 'Detection NDS',    false],
      ['map', 'Map mAP',          false]
    ],
    ref: { l2: 0.662, col: 0.513, ade: 0.905, nds: 0.338, map: 0.419 },
    pts: [
      { label: 'PAVER (10K)',                 p: 10258,   kind: 'paver',
        l2: 0.603, col: 0.187, ade: 0.803, nds: 0.397, map: 0.439 },
      { label: 'PAVER (30K)',                 p: 28450,   kind: 'paver',
        l2: 0.514, col: 0.320, ade: 0.800, nds: 0.383, map: 0.447 },
      { label: 'PAVER (90K)',                 p: 93986,   kind: 'paver',
        l2: 0.596, col: 0.220, ade: 0.782, nds: 0.397, map: 0.433 },
      { label: 'Detection',                   p: 3013983, kind: 'task',
        l2: 0.515, col: 0.240, ade: 0.798, nds: 0.365, map: 0.406 },
      { label: 'Map',                         p: 2910001, kind: 'task',
        l2: 0.694, col: 0.333, ade: 0.857, nds: 0.331, map: 0.391 },
      { label: 'Occupancy',                   p: 3561600, kind: 'task',
        l2: 0.646, col: 0.320, ade: 0.905, nds: 0.336, map: 0.393 },
      { label: 'Detection + Map',             p: 5923984, kind: 'task',
        l2: 0.504, col: 0.190, ade: 0.805, nds: 0.361, map: 0.397 },
      { label: 'Detection + Map + Occupancy', p: 9485584, kind: 'task',
        l2: 0.577, col: 0.270, ade: 0.798, nds: 0.356, map: 0.420 }
    ]
  },
  horizon: {
    L2:  { unit: 'm', better: 'lower', rows: [
      { model: 'VAD-Tiny', base: [0.35, 0.63, 1.01], paver: [0.32, 0.58, 0.92] },
      { model: 'VAD-Base', base: [0.41, 0.71, 1.10], paver: [0.30, 0.54, 0.85] },
      { model: 'GenAD',    base: [0.33, 0.56, 0.88], paver: [0.28, 0.51, 0.82] }
    ]},
    Collision: { unit: '%', better: 'lower', rows: [
      { model: 'VAD-Tiny', base: [0.38, 0.45, 0.71], paver: [0.09, 0.15, 0.32] },
      { model: 'VAD-Base', base: [0.20, 0.29, 0.43], paver: [0.24, 0.41, 0.55] },
      { model: 'GenAD',    base: [0.21, 0.34, 0.56], paver: [0.09, 0.18, 0.35] }
    ]}
  },
  closed: [
    { model: 'UniAD-Tiny', ds: [48.45, 58.79], rc: [60.96, 79.06] },
    { model: 'GenAD',      ds: [34.53, 49.07], rc: [null, 58.95] }
  ],
  schedule: {
    Tiny: { scratch: { h: 21.3, l2: 0.662, col: 0.510 }, pts: [
      { ft: 10, h: 6.5,  l2: 0.637, col: 0.300 },
      { ft: 20, h: 10.1, l2: 0.647, col: 0.220 },
      { ft: 30, h: 13.6, l2: 0.603, col: 0.187 }
    ]},
    Base: { scratch: { h: 103, l2: 0.719, col: 0.217 }, pts: [
      { ft: 10, h: 31.8, l2: 0.646, col: 0.530 },
      { ft: 20, h: 49.0, l2: 0.757, col: 0.280 },
      { ft: 30, h: 66.1, l2: 0.561, col: 0.430 }
    ]}
  }
};

/* ── shared chrome ────────────────────────────────────────────────────── */
let tip = null;
function tooltip(){
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'status');
  document.body.appendChild(tip);
  return tip;
}
function showTip(html, ev){
  const t = tooltip();
  t.innerHTML = html;
  t.classList.add('on');
  const pad = 14, r = t.getBoundingClientRect();
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
  /* 36: flipping is not enough near a corner, where both sides overflow */
  x = Math.max(8, Math.min(x, innerWidth - r.width - 8));
  y = Math.max(8, Math.min(y, innerHeight - r.height - 8));
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
function hideTip(){ if (tip) tip.classList.remove('on'); }

let tipOwner = null;
addEventListener('pointerdown', e => {                 /* tap elsewhere dismisses */
  if (tipOwner && !tipOwner.contains(e.target)) { hideTip(); tipOwner = null; }
}, true);
/* 37: Escape closes the tip, which was otherwise only dismissible by pointing
   somewhere else — impossible from the keyboard. */
addEventListener('keydown', e => { if (e.key === 'Escape') { hideTip(); tipOwner = null; } });
function hoverable(node, html){
  node.addEventListener('pointerenter', e => { tipOwner = node; showTip(html, e); });
  node.addEventListener('pointermove', e => showTip(html, e));
  node.addEventListener('pointerleave', hideTip);
  node.setAttribute('tabindex', '0');
  node.addEventListener('focus', e => {
    const b = node.getBoundingClientRect();
    showTip(html, { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 });
  });
  node.addEventListener('blur', hideTip);
}

function frame(host, w, h, label){
  host.innerHTML = '';
  host.classList.add('chart-host');
  host.setAttribute('tabindex', '0');
  host.setAttribute('role', 'region');
  host.setAttribute('aria-label', label);
  const svg = el('svg', {
    viewBox: `0 0 ${w} ${h}`, width: '100%', role: 'img',
    'aria-label': label, class: 'chart', preserveAspectRatio: 'xMidYMid meet'
  }, host);
  return svg;
}

/* animate on first scroll into view */
const animObs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('run'); animObs.unobserve(e.target); }
}), { rootMargin: '-8% 0px -8% 0px' });
/* A metric switch rebuilds the SVG while the card is already on screen, so the
   observer never fires for it and the new chart appeared in its pre-animation
   state. If the host is in view, run immediately. */
/* Per host, not global: a single flag meant every chart below the fold stopped
   animating on scroll-in two and a half seconds after load. What should not
   replay is the same chart being rebuilt by its own switch. */
const animatedHosts = new WeakSet();
function animate(svg) {
  const host = svg.parentNode;
  const seen = host && animatedHosts.has(host);
  if (host) animatedHosts.add(host);
  if (REDUCED || seen) { svg.classList.add('run'); return; }
  /* observe regardless: skipping it left a chart that was visible but whose
     frame never landed with no path to ever animate */
  animObs.observe(svg);
  const box = svg.getBoundingClientRect();
  if (box.top < innerHeight && box.bottom > 0) {
    requestAnimationFrame(() => { svg.classList.add('run'); animObs.unobserve(svg); });
  }
}

/* Charts carry an aria-label, which tells a screen reader what a picture is
 * about but not what it says. This renders the same numbers as a table so the
 * figures are readable rather than merely announced. */
function dataTable(host, caption, head, rows){
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'scroller';
  const t = document.createElement('table');
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  head.forEach((h, i) => {
    const th = document.createElement('th');
    th.scope = 'col';
    if (i === 0) th.className = 'stick';
    th.textContent = h;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  const tb = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    if (r.ours) tr.className = 'ours';
    (r.cells || r).forEach((cell, i) => {
      const el2 = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) { el2.scope = 'row'; el2.className = 'stick'; }
      el2.textContent = cell;
      tr.appendChild(el2);
    });
    tb.appendChild(tr);
  });
  t.append(thead, tb);
  wrap.appendChild(t);
  host.appendChild(wrap);
  if (caption) {
    const p = document.createElement('p');
    p.className = 'tcap';
    p.textContent = caption;
    host.appendChild(p);
  }
}

/* ── 1. training cost ─────────────────────────────────────────────────── */
function chartCost(host){
  const W = 720, H = 300, L = 142, R = 96, T = 22, B = 56;
  const svg = frame(host, W, H, 'Total training time in hours for VAD-Tiny and VAD-Base, with and without PAVER pretraining');
  const max = 120, x = v => L + (W - L - R) * v / max;
  const bh = 30, gap = 16, y = i => T + i * (bh + gap);

  for (let t = 0; t <= max; t += 20) {
    el('line', { x1: x(t), x2: x(t), y1: T - 6, y2: H - B + 4, class: 'grid' }, svg);
    el('text', { x: x(t), y: H - B + 26, class: 'tick mid', text: String(t) }, svg);
  }
  el('text', { x: (L + W - R) / 2, y: H - 8, class: 'axis mid', text: 'Total training time (hours)' }, svg);

  D.cost.forEach((d, i) => {
    const g = el('g', { class: 'bar' + (d.ours ? ' ours' : '') }, svg);
    el('text', { x: L - 16, y: y(i) + bh / 2 + 4, class: 'tick end', text: d.label }, g);
    const rect = el('rect', { x: L, y: y(i), width: x(d.h) - L, height: bh, rx: 7, class: 'fill' }, g);
    rect.style.setProperty('--w', (x(d.h) - L) + 'px');
    /* the value sits beside its bar, never inside it: a short bar could not hold
       the text, and one chart printing both ways reads as two charts */
    el('text', { x: x(d.h) + 10, y: y(i) + bh / 2 + 4, class: 'val start',
      text: fmt(d.h, 1) + 'h' }, g);
    if (d.speedup) el('text', { x: x(d.h) + 62, y: y(i) + bh / 2 + 4, class: 'gain',
      text: `${fmt(d.speedup, 2)}× faster` }, g);
    hoverable(g, `<b>${d.label}</b><br>${fmt(d.h, 2)}h total on 4×RTX 5090${d.speedup ? `<br>${fmt(d.speedup, 2)}× faster than its baseline` : ''}`);
  });
  animate(svg);
}

/* ── 2. planning transfer ─────────────────────────────────────────────── */
/* an advance-width estimate good enough to keep text inside its box */
const CHAR_W = 0.57;
function textWidth(str, size){ return String(str).length * size * CHAR_W; }
function fitText(str, maxPx, size){
  str = String(str);
  if (textWidth(str, size) <= maxPx) return str;
  const keep = Math.max(3, Math.floor(maxPx / (size * CHAR_W)) - 1);
  return str.slice(0, keep) + '\u2026';
}

function spines(svg, L, R, T, B, W, H){
  el('line', { x1: L, y1: T, x2: L, y2: H - B, class: 'spine' }, svg);
  el('line', { x1: L, y1: H - B, x2: W - R, y2: H - B, class: 'spine' }, svg);
}

function halo(g, cx, cy, r, colour){
  el('circle', { cx, cy, r: r * 2.9, fill: colour, opacity: 0.10 }, g);
  el('circle', { cx, cy, r: r * 1.9, fill: colour, opacity: 0.16 }, g);
}


/* ── label placement ────────────────────────────────────────────────────────
 * Scatter labels were pinned to one side of their marker, so a crowded region
 * printed one label on top of another. Each label now tries a few positions and
 * takes the first that clears everything already placed. Widths are estimated
 * from the character count, which is close enough at these sizes and avoids a
 * layout read per label. */
function labelPlacer(bounds) {
  const taken = [];
  const inside = b => !bounds ||
    (b.x1 >= bounds.x1 && b.x2 <= bounds.x2 && b.y1 >= bounds.y1 && b.y2 <= bounds.y2);
  const overlaps = (a, b) => !(a.x2 < b.x1 || b.x2 < a.x1 || a.y2 < b.y1 || b.y2 < a.y1);
  return {
    reserve(x1, y1, x2, y2) { taken.push({ x1, y1, x2, y2 }); },
    place(cx, cy, text, size = 13, gap = 15) {
      const w = text.length * size * 0.52, h = size * 1.15;
      const options = [
        { x: cx + gap, y: cy + 4, anchor: 'start' },
        { x: cx - gap, y: cy + 4, anchor: 'end' },
        { x: cx, y: cy - gap, anchor: 'middle' },
        { x: cx, y: cy + gap + size * 0.7, anchor: 'middle' },
        { x: cx + gap, y: cy - gap, anchor: 'start' },
        { x: cx - gap, y: cy - gap, anchor: 'end' },
        { x: cx + gap, y: cy + gap + size * 0.6, anchor: 'start' },
        { x: cx - gap, y: cy + gap + size * 0.6, anchor: 'end' }
      ];
      const leftOf = o => o.anchor === 'start' ? o.x : o.anchor === 'end' ? o.x - w : o.x - w / 2;
      for (const o of options) {
        const x1 = leftOf(o);
        const box = { x1, y1: o.y - h, x2: x1 + w, y2: o.y + 3 };
        if (inside(box) && !taken.some(t => overlaps(box, t))) { taken.push(box); return o; }
      }
      /* Nothing fit. Falling back to the first candidate unconditionally let a
         long label run off the canvas, which is worse than any overlap. Score
         the candidates, take the least bad, and pull it back inside. */
      let best = options[0], bestCost = Infinity;
      for (const o of options) {
        const x1 = leftOf(o);
        const box = { x1, y1: o.y - h, x2: x1 + w, y2: o.y + 3 };
        const spill = bounds
          ? Math.max(0, bounds.x1 - box.x1) + Math.max(0, box.x2 - bounds.x2) +
            Math.max(0, bounds.y1 - box.y1) + Math.max(0, box.y2 - bounds.y2)
          : 0;
        const hits = taken.filter(t => overlaps(box, t)).length;
        const cost = spill * 4 + hits;                 /* leaving the plot costs most */
        if (cost < bestCost) { bestCost = cost; best = o; }
      }
      const o = { ...best };
      if (bounds) {
        let x1 = Math.min(Math.max(leftOf(o), bounds.x1), Math.max(bounds.x1, bounds.x2 - w));
        o.x = o.anchor === 'start' ? x1 : o.anchor === 'end' ? x1 + w : x1 + w / 2;
        o.y = Math.min(Math.max(o.y, bounds.y1 + h), bounds.y2);
      }
      const x1 = leftOf(o);
      taken.push({ x1, y1: o.y - h, x2: x1 + w, y2: o.y + 3 });
      return o;
    }
  };
}

function chartTransfer(host){
  const W = 760, H = 500, L = 80, R = 34, T = 34, B = 74;
  const svg = frame(host, W, H, 'Planning L2 against collision rate; every arrow runs from a baseline to the same architecture pretrained with PAVER');
  const xd = [0.50, 0.80], yd = [0.10, 0.58];
  const x = v => L + (W - L - R) * (v - xd[0]) / (xd[1] - xd[0]);
  const y = v => (H - B) - (H - B - T) * (v - yd[0]) / (yd[1] - yd[0]);

  const defs = el('defs', {}, svg);
  /* the good corner is lit, so the reader knows which way is better without reading */
  const wash = el('radialGradient', { id: 'tw-good', cx: '0%', cy: '100%', r: '95%' }, defs);
  /* the corner reads as "better", so it carries most of the tint; the far side is
     left alone and the ramp keeps enough stops to avoid a visible disc edge */
  el('stop', { offset: '0%',  'stop-color': 'var(--paver)', 'stop-opacity': '0.34' }, wash);
  el('stop', { offset: '22%', 'stop-color': 'var(--paver)', 'stop-opacity': '0.22' }, wash);
  el('stop', { offset: '45%', 'stop-color': 'var(--paver)', 'stop-opacity': '0.10' }, wash);
  el('stop', { offset: '68%', 'stop-color': 'var(--paver)', 'stop-opacity': '0.035' }, wash);
  el('stop', { offset: '100%', 'stop-color': 'var(--paver)', 'stop-opacity': '0' }, wash);
  const mk = el('marker', { id: 'tw-head', viewBox: '0 0 12 12', refX: 9, refY: 6,
    markerWidth: 5.5, markerHeight: 5.5, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0,1 L11,6 L0,11 L3,6 z', fill: 'var(--paver)' }, mk);

  el('rect', { x: L, y: T, width: W - L - R, height: H - B - T, fill: 'url(#tw-good)' }, svg);

  for (let v = 0.50; v <= 0.801; v += 0.05) {
    el('line', { x1: x(v), x2: x(v), y1: T, y2: H - B, class: 'grid' }, svg);
    el('text', { x: x(v), y: H - B + 26, class: 'tick mid', text: fmt(v, 2) }, svg);
  }
  for (let v = 0.1; v <= 0.581; v += 0.1) {
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: y(v) + 4, class: 'tick end', text: fmt(v, 1) }, svg);
  }
  spines(svg, L, R, T, B, W, H);
  el('text', { x: (L + W - R) / 2, y: H - 12, class: 'axis mid', text: 'Planning L2 (m) ↓' }, svg);
  el('text', { x: 13, y: (T + H - B) / 2, class: 'axis mid', transform: `rotate(-90 13 ${(T + H - B) / 2})`,
    text: 'Collision rate (%) ↓' }, svg);
  /* the page uses hollow for anything that is not ours; saying so inside the
     chart keeps it from being read against another figure’s convention */
  el('circle', { cx: W - R - 150, cy: T - 12, r: 5, fill: 'none',
    stroke: 'var(--fg-3)', 'stroke-width': 2 }, svg);
  el('text', { x: W - R - 140, y: T - 8, class: 'hint start', text: 'baseline' }, svg);
  el('circle', { cx: W - R - 78, cy: T - 12, r: 5, fill: 'none',
    stroke: 'var(--accent-2)', 'stroke-width': 2 }, svg);
  el('text', { x: W - R - 68, y: T - 8, class: 'hint start', text: 'reported' }, svg);
  el('circle', { cx: W - R - 6, cy: T - 12, r: 5, fill: 'var(--paver)' }, svg);
  el('text', { x: W - R + 4, y: T - 8, class: 'hint start', text: 'ours' }, svg);

  const place = labelPlacer({ x1: L + 4, y1: T + 2, x2: W - R - 4, y2: H - B - 2 });

  /* the transfer arrows are the message, so they are heavy and coloured */
  const arrows = [];
  ['Tiny', 'Base', 'GenAD'].forEach(fam => {
    const a = D.transfer.find(p => p.fam === fam && !p.ours);
    const b = D.transfer.find(p => p.fam === fam && p.ours);
    if (!a || !b) return;
    const dx = x(b.l2) - x(a.l2), dy = y(b.col) - y(a.col), len = Math.hypot(dx, dy) || 1;
    const pad = 17;
    const x1 = x(a.l2) + dx / len * pad, y1 = y(a.col) + dy / len * pad;
    const x2 = x(b.l2) - dx / len * pad, y2 = y(b.col) - dy / len * pad;
    el('line', { x1, y1, x2, y2, class: 'twarrow-glow' }, svg);
    el('line', { x1, y1, x2, y2, class: 'twarrow', 'marker-end': 'url(#tw-head)' }, svg);
    /* the line itself is an obstacle: sampling it keeps labels off the stroke */
    for (let t = 0; t <= 1; t += 0.05) {
      const sx = x1 + (x2 - x1) * t, sy = y1 + (y2 - y1) * t;
      place.reserve(sx - 5, sy - 5, sx + 5, sy + 5);
    }
    const dcol = b.col - a.col, dl2 = b.l2 - a.l2;
    arrows.push({ x1, y1, x2, y2, dx, dy, len,
      txt: `${dl2 < 0 ? '−' : '+'}${fmt(Math.abs(dl2), 2)} m  ${dcol < 0 ? '−' : '+'}${fmt(Math.abs(dcol), 2)}%` });
  });

  /* labels go on only after every stroke is known, so none lands on a line */
  arrows.forEach(a => {
    const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
    const nx = -a.dy / a.len, ny = a.dx / a.len, off = 20;
    const p = place.place(mx + nx * off, my + ny * off, a.txt, 13, 6);
    el('text', { x: p.x, y: p.y, class: 'twdelta ' + p.anchor, text: a.txt }, svg);
  });

  /* every marker is reserved before any label is placed, so a label never
     lands on a point it does not belong to */
  D.transfer.forEach(p => {
    const r = p.ours ? 11 : 8;
    place.reserve(x(p.l2) - r, y(p.col) - r, x(p.l2) + r, y(p.col) + r);
  });

  D.transfer.forEach(p => {
    const g = el('g', { class: 'pt' + (p.ours ? ' ours' : '') + (p.reported ? ' rep' : '') }, svg);
    if (p.ours) halo(g, x(p.l2), y(p.col), 9, 'var(--paver)');
    const r = p.ours ? 9 : (p.reported ? 6 : 6.5);
    if (p.ours) {
      el('circle', { cx: x(p.l2), cy: y(p.col), r, fill: 'var(--paver)', stroke: '#fff', 'stroke-width': 2.4 }, g);
    } else if (p.reported) {
      el('circle', { cx: x(p.l2), cy: y(p.col), r, fill: 'none', stroke: 'var(--accent-2)', 'stroke-width': 2 }, g);
    } else {
      el('circle', { cx: x(p.l2), cy: y(p.col), r, fill: 'none', stroke: 'var(--fg-3)', 'stroke-width': 2 }, g);
    }
    hoverable(g, `<b>${p.label}</b><br>Planning L2 ${fmt(p.l2, 3)} m` +
      `<br>Collision ${fmt(p.col, 3)}%` +
      (p.params ? `<br>${p.params.toLocaleString()} auxiliary parameters` : '') +
      (p.reported ? '<br>as reported by its authors' : ''));
    const lp = place.place(x(p.l2), y(p.col), p.label, p.ours ? 14 : 13);
    el('text', { x: lp.x, y: lp.y,
      class: (p.ours ? 'plab strong ' : 'plab dim ') + lp.anchor, text: p.label }, g);
    hoverable(g, `<b>${p.label}</b><br>L2 ${fmt(p.l2, 3)} m · collision ${fmt(p.col, 3)}%` +
      (p.reported ? `<br><i>reported result, ${shortParams(p.params)} auxiliary parameters</i>` : ''));
  });
  animate(svg);
}

/* ── 3. auxiliary capacity ────────────────────────────────────────────── */
function chartCapacity(host, metricKey){
  const C = D.capacity;
  const meta = C.metrics.find(m => m[0] === metricKey) || C.metrics[0];
  const [key, label, lower] = meta;                    /* direction drives everything */
  const ref = C.ref[key];
  const W = 760, H = 480, L = 80, R = 34, T = 44, B = 74;
  const svg = frame(host, W, H,
    `${label} against the number of auxiliary pretraining parameters on a logarithmic axis`);
  const lo = 4e3, hi = 2.6e7;
  const x = v => L + (W - L - R) * (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
  /* the axis is rebuilt per metric: NDS and planning L2 share no scale */
  const all = C.pts.map(p => p[key]).concat([ref]);
  const span = Math.max(...all) - Math.min(...all) || 1;
  const yd = [Math.min(...all) - span * 0.22, Math.max(...all) + span * 0.22];
  const y = v => (H - B) - (H - B - T) * (v - yd[0]) / (yd[1] - yd[0]);
  const dec = Math.max(...all) < 1 ? 3 : 2;

  const defs = el('defs', {}, svg);
  /* Fewer parameters is always to the left; which vertical end is better depends
     on the metric, so the wash is anchored at that corner rather than being a
     left-to-right band that ignores the y axis entirely. */
  const goodY = lower ? '100%' : '0%';
  const wash = el('radialGradient',
    { id: 'cap-good', cx: '0%', cy: goodY, r: '105%' }, defs);
  [['0%', '0.34'], ['22%', '0.22'], ['45%', '0.10'], ['68%', '0.035'], ['100%', '0']]
    .forEach(([offset, op]) =>
      el('stop', { offset, 'stop-color': 'var(--paver)', 'stop-opacity': op }, wash));
  el('rect', { x: L, y: T, width: W - L - R, height: H - B - T, fill: 'url(#cap-good)' }, svg);

  [1e4, 1e5, 1e6, 1e7].forEach(t => {
    /* 35: without the 2..9 ticks a decade looked like any other gap */
    for (let k = 2; k <= 9; k++) {
      const v = t * k;
      if (v > 4e3 && v < 2.6e7) {
        el('line', { x1: x(v), x2: x(v), y1: T, y2: H - B, class: 'grid minor' }, svg);
      }
    }
    el('line', { x1: x(t), x2: x(t), y1: T, y2: H - B, class: 'grid' }, svg);
    const g = el('text', { x: x(t), y: H - B + 26, class: 'tick mid' }, svg);
    el('tspan', { text: '10' }, g);
    el('tspan', { dy: -6, 'font-size': '10', text: String(Math.round(Math.log10(t))) }, g);
  });
  /* round ticks inside the range: stepping from the data minimum gave values
     like 0.687 and 0.612, which read as noise rather than as an axis */
  const raw = (yd[1] - yd[0]) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10;
  for (let v = Math.ceil(yd[0] / step) * step; v <= yd[1] + 1e-9; v += step) {
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: y(v) + 4, class: 'tick end',
      text: fmt(Number(v.toFixed(10)), dec) }, svg);
  }
  el('text', { x: (L + W - R) / 2, y: H - 12, class: 'axis mid',
    text: 'Auxiliary pretraining parameters ↓' }, svg);
  const ax = el('text', { x: 13, y: (T + H - B) / 2, class: 'axis mid',
    transform: `rotate(-90 13 ${(T + H - B) / 2})`, text: label + (lower ? ' ↓' : ' ↑') }, svg);
  el('title', { text: lower ? 'lower is better' : 'higher is better' }, ax);

  el('line', { x1: L, x2: W - R, y1: y(ref), y2: y(ref), class: 'ref' }, svg);
  el('text', { x: W - R - 6, y: y(ref) - 9, class: 'reflab end', text: 'no pretraining' }, svg);

  /* The parameter gap holds on every metric, so the bracket is always drawn; only
     the claim changes. Saying "better" where the task-supervised head actually
     wins would be a lie, so that case reports the shortfall instead. */
  const better = (a, b) => lower ? a < b : a > b;
  const head = C.pts.find(p => p.label === 'PAVER (10K)');
  const rival = C.pts.filter(p => p.kind === 'task')
    .reduce((a, b) => (a && better(a[key], b[key])) ? a : b, null);
  if (head && rival) {
    const yy = T + 16;
    const ratio = Math.round(rival.p / head.p);
    const name = label.replace(/ \(.*\)/, '');
    const wins = better(head[key], rival[key]);
    const delta = Math.abs(head[key] - rival[key]);
    el('path', { d: `M${x(head.p)},${yy} L${x(rival.p)},${yy}`, class: 'gapline' }, svg);
    el('path', { d: `M${x(head.p)},${yy - 5} L${x(head.p)},${yy + 5}`, class: 'gapline' }, svg);
    el('path', { d: `M${x(rival.p)},${yy - 5} L${x(rival.p)},${yy + 5}`, class: 'gapline' }, svg);
      const gl = el('text', { x: (x(head.p) + x(rival.p)) / 2, y: yy - 10,
      class: 'gaplab mid',
      text: wins
        ? `${ratio}\u00d7 fewer parameters, better ${name}`
        : `${ratio}\u00d7 fewer parameters, within ${fmt(delta, dec)} ${name}` }, svg);
    el('title', { text: `PAVER’s 10K head against ${rival.label}, the best ` +
      `task-supervised objective on ${name}` }, gl);
  }

  const place = labelPlacer({ x1: L + 4, y1: T + 2, x2: W - 4, y2: H - B - 2 });
  C.pts.forEach(p => place.reserve(x(p.p) - 10, y(p[key]) - 10, x(p.p) + 10, y(p[key]) + 10));

  C.pts.forEach(p => {
    const isPaver = p.kind === 'paver';
    const headline = p.label === 'PAVER (10K)';
    const g = el('g', { class: 'pt ' + p.kind + (headline ? ' ours' : '') }, svg);
    if (isPaver) halo(g, x(p.p), y(p[key]), headline ? 9.5 : 7, 'var(--paver)');
    if (isPaver) {
      el('circle', { cx: x(p.p), cy: y(p[key]), r: headline ? 9.5 : 7,
        fill: 'var(--paver)', stroke: '#fff', 'stroke-width': headline ? 2.4 : 1.8 }, g);
    } else {
      el('circle', { cx: x(p.p), cy: y(p[key]), r: 6, fill: 'none',
        stroke: 'var(--fg-3)', 'stroke-width': 2 }, g);
    }
    const lp = place.place(x(p.p), y(p[key]), p.label, 13, 16);
    el('text', { x: lp.x, y: lp.y,
      class: (isPaver ? 'plab strong ' : 'plab dim ') + lp.anchor, text: p.label }, g);
    const rel = (p[key] - ref) / ref * 100;
    hoverable(g, `<b>${p.label}</b><br>${label} ${fmt(p[key], dec)}<br>` +
      `${p.p.toLocaleString()} auxiliary parameters<br>` +
      `${fmt(rel, 1)}% against no pretraining`);
  });
  animate(svg);
}

/* ── 4. per-horizon grouped bars ──────────────────────────────────────── */

/* A max of 1.22 divided into four gives 0.30, 0.61, 0.91: three numbers nobody
 * reads. This picks a round step near the requested count and returns ticks a
 * reader recognises. */
function niceTicks(max, count = 4) {
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10;
  /* the top tick must reach past the data: rounding it down leaves the longest
     bar drawing outside the plot */
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let i = 0; i * step <= top + step * 1e-6; i++) ticks.push(Number((i * step).toFixed(10)));
  return { ticks, top: Number(top.toFixed(10)) };
}

function chartHorizon(host, metric){
  const spec = D.horizon[metric];
  const W = 700, H = 330, L = 68, R = 18, T = 30, B = 74;
  const svg = frame(host, W, H, `${metric} at the 1, 2 and 3 second horizons for each architecture, without and with PAVER`);
  const peak = Math.max(...spec.rows.flatMap(r => [...r.base, ...r.paver]));
  const scale = niceTicks(peak * 1.12, 4);
  const max = scale.top;
  const y = v => (H - B) - (H - B - T) * v / max;
  const groups = spec.rows.length, gw = (W - L - R) / groups;

  const decimals = max >= 10 ? 0 : max >= 1 ? 1 : 2;
  scale.ticks.forEach(v => {
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: y(v) + 4, class: 'tick end', text: fmt(v, decimals) }, svg);
  });
  el('text', { x: 13, y: (T + H - B) / 2, class: 'axis mid', transform: `rotate(-90 13 ${(T + H - B) / 2})`,
    text: `${metric} (${spec.unit}) ↓` }, svg);

  spec.rows.forEach((row, gi) => {
    const x0 = L + gi * gw;
    el('text', { x: x0 + gw / 2, y: H - B + 46, class: 'tick mid', text: row.model }, svg);
    [0, 1, 2].forEach(hz => {
      const slot = x0 + 14 + hz * ((gw - 28) / 3);
      const bw = (gw - 28) / 3 / 2 - 4;
      [['base', row.base[hz], false], ['paver', row.paver[hz], true]].forEach(([kind, v, ours], k) => {
        const g = el('g', { class: 'bar v' + (ours ? ' ours' : '') }, svg);
        const rect = el('rect', { x: slot + k * (bw + 3), y: y(v), width: bw, height: (H - B) - y(v), rx: 4, class: 'fill' }, g);
        rect.style.setProperty('--h', ((H - B) - y(v)) + 'px');
        rect.style.setProperty('--y0', (H - B) + 'px');
        hoverable(g, `<b>${row.model}${ours ? ' + PAVER' : ''}</b><br>${metric} at ${hz + 1}s: ${fmt(v, 2)} ${spec.unit}`);
      });
      el('text', { x: slot + (bw * 2 + 3) / 2, y: H - B + 22, class: 'hint mid', text: `${hz + 1}s` }, svg);
    });
    if (gi) el('line', { x1: x0, x2: x0, y1: T, y2: H - B + 6, class: 'sepline' }, svg);
  });
  el('g', { class: 'legend' }, svg);
  const lg = svg.querySelector('.legend');
  el('rect', { x: W - R - 150, y: 8, width: 10, height: 10, rx: 2, class: 'swatch base' }, lg);
  el('text', { x: W - R - 134, y: 17, class: 'hint start', text: 'Baseline' }, lg);
  el('rect', { x: W - R - 74, y: 8, width: 10, height: 10, rx: 2, class: 'swatch ours' }, lg);
  el('text', { x: W - R - 58, y: 17, class: 'hint start', text: '+ PAVER' }, lg);
  animate(svg);
}

/* ── 5. closed-loop ───────────────────────────────────────────────────── */
function chartClosed(host){
  const W = 700, H = 300, L = 68, R = 18, T = 30, B = 70;
  const svg = frame(host, W, H, 'Driving Score and Route Completion on Bench2Drive Town05 Long, baseline against PAVER');
  const max = 100, y = v => (H - B) - (H - B - T) * v / max;
  const blocks = [['Driving Score', 'ds'], ['Route Completion', 'rc']];
  const bw = (W - L - R) / 2;

  for (let v = 0; v <= 100; v += 25) {
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: y(v) + 4, class: 'tick end', text: String(v) }, svg);
  }
  blocks.forEach(([title, key], bi) => {
    const x0 = L + bi * bw;
    el('text', { x: x0 + bw / 2, y: T - 12, class: 'axis mid', text: title + ' ↑' }, svg);
    D.closed.forEach((m, mi) => {
      const slot = x0 + 26 + mi * ((bw - 52) / 2);
      const w = ((bw - 52) / 2) / 2 - 6;
      m[key].forEach((v, k) => {
        if (v == null) {
          el('text', { x: slot + k * (w + 4) + w / 2, y: y(0) - 8, class: 'hint mid', text: 'n/r' }, svg);
          return;
        }
        const g = el('g', { class: 'bar v' + (k ? ' ours' : '') }, svg);
        const rect = el('rect', { x: slot + k * (w + 4), y: y(v), width: w, height: (H - B) - y(v), rx: 4, class: 'fill' }, g);
        rect.style.setProperty('--h', ((H - B) - y(v)) + 'px');
        rect.style.setProperty('--y0', (H - B) + 'px');
        el('text', { x: slot + k * (w + 4) + w / 2, y: y(v) - 7, class: 'val mid', text: fmt(v, 2) }, g);
        hoverable(g, `<b>${m.model}${k ? ' + PAVER' : ''}</b><br>${title}: ${fmt(v, 2)}`);
      });
      el('text', { x: slot + (w * 2 + 4) / 2, y: H - B + 26, class: 'tick mid', text: m.model }, svg);
    });
    if (bi) el('line', { x1: x0, x2: x0, y1: T - 20, y2: H - B + 6, class: 'sepline' }, svg);
  });
  el('text', { x: W - R, y: H - 12, class: 'hint end', text: 'n/r: not reported by the source' }, svg);
  animate(svg);
}

/* ── 6. schedule frontier ─────────────────────────────────────────────── */
function chartSchedule(host, family){
  const s = D.schedule[family];
  const W = 660, H = 360, L = 76, R = 62, T = 26, B = 70;
  const svg = frame(host, W, H, `Total training time against planning L2 and collision rate for ${family} fine-tuning budgets`);
  const hmax = family === 'Tiny' ? 24 : 112;
  const x = v => L + (W - L - R) * v / hmax;
  const l2d = family === 'Tiny' ? [0.58, 0.68] : [0.54, 0.78];
  const cod = family === 'Tiny' ? [0.15, 0.55] : [0.18, 0.56];
  const yl = v => (H - B) - (H - B - T) * (v - l2d[0]) / (l2d[1] - l2d[0]);
  const yc = v => (H - B) - (H - B - T) * (v - cod[0]) / (cod[1] - cod[0]);

  for (let t = 0; t <= hmax; t += hmax / 4) {
    el('line', { x1: x(t), x2: x(t), y1: T, y2: H - B, class: 'grid' }, svg);
    el('text', { x: x(t), y: H - B + 26, class: 'tick mid', text: fmt(t, 0) }, svg);
  }
  el('text', { x: (L + W - R) / 2, y: H - 18, class: 'axis mid', text: 'Total training time (hours) ↓' }, svg);
  el('text', { x: 13, y: (T + H - B) / 2, class: 'axis mid l2', transform: `rotate(-90 13 ${(T + H - B) / 2})`, text: 'Planning L2 (m) ↓' }, svg);
  el('text', { x: W - 12, y: (T + H - B) / 2, class: 'axis mid col', transform: `rotate(90 ${W - 12} ${(T + H - B) / 2})`, text: 'Collision (%) ↓' }, svg);

  el('line', { x1: x(s.scratch.h), x2: x(s.scratch.h), y1: T, y2: H - B, class: 'ref' }, svg);
  el('text', { x: x(s.scratch.h) - 8, y: T + 12, class: 'reflab end', text: `scratch, ${fmt(s.scratch.h, 1)} h` }, svg);

  ['l2', 'col'].forEach(key => {
    const yf = key === 'l2' ? yl : yc;
    const path = s.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.h)},${yf(p[key])}`).join(' ');
    const line = el('path', { d: path, class: 'series ' + key }, svg);
    const len = line.getTotalLength ? line.getTotalLength() : 400;
    line.style.setProperty('--len', len);
    s.pts.forEach(p => {
      const g = el('g', { class: 'pt ' + key }, svg);
      el('circle', { cx: x(p.h), cy: yf(p[key]), r: 6, class: 'dot' }, g);
      hoverable(g, `<b>${family}, 20 + ${p.ft} epochs</b><br>${fmt(p.h, 1)} h · L2 ${fmt(p.l2, 3)} m · collision ${fmt(p.col, 3)}%`);
    });
    const sc = el('g', { class: 'pt scratch ' + key }, svg);
    el('circle', { cx: x(s.scratch.h), cy: yf(s.scratch[key]), r: 6, class: 'dot' }, sc);
    hoverable(sc, `<b>${family} from scratch</b><br>${fmt(s.scratch.h, 1)} h · L2 ${fmt(s.scratch.l2, 3)} m · collision ${fmt(s.scratch.col, 3)}%`);
  });
  s.pts.forEach(p => el('text', { x: x(p.h), y: H - B - 6, class: 'hint mid', text: `+${p.ft}` }, svg));
  animate(svg);
}

window.PAVER_CHARTS = { dataTable, chartCost, chartTransfer, chartCapacity, chartHorizon, chartClosed, chartSchedule, D, CAPACITY_METRICS: D.capacity.metrics };

/* ══ analysis charts driven by data.js ════════════════════════════════════
 * Values follow the checkpoint provenance recorded for the paper.
 */
const DATA = () => window.PAVER_DATA || null;
const SERIES_COLOR = [
  '--accent', '--accent-3', '--accent-2', '--muted', '--ours'
];
const PAVER_RUN = /PAVER/i;
function seriesStroke(i, ours){
  if (ours) return 'var(--paver)';
  /* muted greys and desaturated hues so the PAVER runs stay dominant */
  /* muted greys so the PAVER runs stay dominant */
  return ['#8d95a3', '#7d8898', '#9aa3b1', '#6f7a89', '#848d9c', '#98a2b0', '#727c8b', '#8a93a1'][i % 8];
}
const PAVER_TONE = ['#209EFF', '#0d7fd6', '#5cb8ff', '#1b6fb5'];

/* ── 7. learning trajectories ─────────────────────────────────────────── */
function chartTrajectories(host, metric, hidden){
  const d = DATA(); if (!d) return;
  const S = d.traj.series[metric] || {};
  const names = Object.keys(S).sort((a, b) => (a.includes('PAVER') ? -1 : 1) - (b.includes('PAVER') ? -1 : 1) || a.localeCompare(b));
  const vis = names.filter(n => !hidden.has(n));
  const W = 720, H = 400, L = 76, R = 150, T = 20, B = 62;
  const svg = frame(host, W, H, `${metric} against downstream epoch for every VAD-Tiny experiment`);
  const pts = vis.flatMap(n => S[n]);
  if (!pts.length) return;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.12 || 0.02; y0 -= pad; y1 += pad;
  const X = v => L + (W - L - R) * (v - x0) / ((x1 - x0) || 1);
  const Y = v => (H - B) - (H - B - T) * (v - y0) / ((y1 - y0) || 1);

  for (let i = 0; i <= 4; i++) {
    const v = y0 + (y1 - y0) * i / 4;
    el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: Y(v) + 4, class: 'tick end', text: fmt(v, 3) }, svg);
  }
  const step = x1 > 30 ? 10 : 5;
  for (let e = Math.ceil(x0 / step) * step; e <= x1; e += step) {
    el('line', { x1: X(e), x2: X(e), y1: T, y2: H - B, class: 'grid' }, svg);
    el('text', { x: X(e), y: H - B + 26, class: 'tick mid', text: String(e) }, svg);
  }
  el('text', { x: (L + W - R) / 2, y: H - 12, class: 'axis mid', text: 'Downstream epoch' }, svg);
  el('text', { x: 13, y: (T + H - B) / 2, class: 'axis mid', transform: `rotate(-90 13 ${(T + H - B) / 2})`, text: metric }, svg);

  /* baselines first, PAVER runs last so they paint on top */
  const order = names.map((n, i) => [n, i]).sort((a, b) =>
    (PAVER_RUN.test(a[0]) ? 1 : 0) - (PAVER_RUN.test(b[0]) ? 1 : 0));
  let paverSeen = 0;
  order.forEach(([n, i]) => {
    if (hidden.has(n)) return;
    const isPaver = PAVER_RUN.test(n);
    const colour = isPaver ? PAVER_TONE[paverSeen++ % PAVER_TONE.length] : seriesStroke(i, false);
    const path = S[n].map((p, k) => `${k ? 'L' : 'M'}${X(p[0])},${Y(p[1])}`).join(' ');
    const line = el('path', { d: path, class: 'series', fill: 'none' }, svg);
    line.setAttribute('stroke', colour);
    line.setAttribute('stroke-width', isPaver ? 3.4 : 1.5);
    line.setAttribute('opacity', isPaver ? 1 : 0.5);
    const len = line.getTotalLength ? line.getTotalLength() : 600;
    line.style.setProperty('--len', len);
    /* no markers: a transparent wide copy of the path carries the hover instead */
    const best = S[n].reduce((a, b) => (/L2|Collision|ADE|FDE|MR/.test(metric) ? (b[1] < a[1] ? b : a) : (b[1] > a[1] ? b : a)));
    const last = S[n][S[n].length - 1];
    const hit = el('path', { d: path, fill: 'none', stroke: 'transparent', 'stroke-width': 12 }, svg);
    hoverable(hit, `<b>${n}</b><br>${metric}<br>best ${fmt(best[1], 4)} at epoch ${best[0]}` +
      `<br>final ${fmt(last[1], 4)} at epoch ${last[0]}`);
  });

  const lg = el('g', { class: 'legend' }, svg);
  let legendPaver = 0;
  names.forEach((n, i) => {
    const isPaver = PAVER_RUN.test(n);
    const colour = isPaver ? PAVER_TONE[legendPaver++ % PAVER_TONE.length] : seriesStroke(i, false);
    const yy = T + 6 + i * 15;
    const row = el('g', { class: 'lgrow', style: 'cursor:pointer' }, lg);
    el('rect', { x: W - R + 8, y: yy - 7, width: 18, height: isPaver ? 5 : 3, rx: 2,
      fill: hidden.has(n) ? 'rgba(140,150,165,.35)' : colour }, row);
    el('text', { x: W - R + 31, y: yy - 1, class: 'hint start',
      text: fitText(n, R - 39, 12.5),
      'font-weight': isPaver ? 700 : 400,
      opacity: hidden.has(n) ? .4 : (isPaver ? 1 : .72) }, row);
    row.addEventListener('click', () => {
      hidden.has(n) ? hidden.delete(n) : hidden.add(n);
      chartTrajectories(host, metric, hidden);
    });
    hoverable(row, `<b>${n}</b><br>${hidden.has(n) ? 'hidden, select to show' : 'select to hide'}`);
  });
  animate(svg);
}

/* ── 8. paired tail safety ────────────────────────────────────────────── */
/* ── 9. harder-against-easier scene gains with bootstrap intervals ────── */
/* ── 10. route command × horizon ──────────────────────────────────────── */
function chartRoute(host){
  const d = DATA(); if (!d) return;
  const rows = d.route;
  const cmds = ['straight', 'left', 'right'].filter(c => rows.some(r => r.cmd === c));
  const W = 700, H = 340, L = 72, R = 20, T = 34, B = 72;
  const svg = frame(host, W, H, 'Planning L2 by route command and horizon, baseline against PAVER, with bootstrap intervals on the gain');
  const max = Math.max(...rows.flatMap(r => [r.base, r.paver, r.hi])) * 1.12;
  const Y = v => (H - B) - (H - B - T) * v / max;
  const gw = (W - L - R) / cmds.length;

  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4;
    el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: Y(v) + 4, class: 'tick end', text: fmt(v, 2) }, svg);
  }
  el('text', { x: 13, y: (T + H - B) / 2, class: 'axis mid', transform: `rotate(-90 13 ${(T + H - B) / 2})`, text: 'Planning L2 (m) ↓' }, svg);

  cmds.forEach((cmd, ci) => {
    const x0 = L + ci * gw;
    el('text', { x: x0 + gw / 2, y: H - B + 26, class: 'tick mid', text: cmd }, svg);
    [1, 2, 3].forEach((hz, hi) => {
      const r = rows.find(x => x.cmd === cmd && x.h === hz); if (!r) return;
      const slot = x0 + 14 + hi * ((gw - 28) / 3);
      const bw = ((gw - 28) / 3) / 2 - 4;
      [['base', r.base, false], ['paver', r.paver, true]].forEach(([k, v, ours], j) => {
        const g = el('g', { class: 'bar v' + (ours ? ' ours' : '') }, svg);
        const rect = el('rect', { x: slot + j * (bw + 3), y: Y(v), width: bw, height: (H - B) - Y(v), rx: 4, class: 'fill' }, g);
        rect.style.setProperty('--h', ((H - B) - Y(v)) + 'px');
        hoverable(g, `<b>${cmd}, ${hz}s ${ours ? '· PAVER' : '· baseline'}</b><br>L2 ${fmt(v, 3)} m<br>` +
          `gain ${fmt(r.gain, 3)} m, 95% CI [${fmt(r.lo, 3)}, ${fmt(r.hi, 3)}]<br><i>${r.n} samples</i>`);
      });
      el('text', { x: slot + bw + 1.5, y: H - B + 44, class: 'hint mid', text: `${hz}s` }, svg);
    });
    if (ci) el('line', { x1: x0, x2: x0, y1: T, y2: H - B + 6, class: 'sepline' }, svg);
  });
  const lg = el('g', {}, svg);
  el('rect', { x: W - R - 150, y: 10, width: 10, height: 10, rx: 2, class: 'swatch base' }, lg);
  el('text', { x: W - R - 134, y: 19, class: 'hint start', text: 'Baseline' }, lg);
  el('rect', { x: W - R - 74, y: 10, width: 10, height: 10, rx: 2, class: 'swatch ours' }, lg);
  el('text', { x: W - R - 58, y: 19, class: 'hint start', text: '+ PAVER' }, lg);
  animate(svg);
}

Object.assign(window.PAVER_CHARTS, { chartTrajectories, chartRoute });

/* ── 11. layerwise CKA ────────────────────────────────────────────────── */

function chartProbe(host){
  const d = DATA(); if (!d || !d.probe) return;
  const rows = d.probe;
  const models = Array.from(new Set(rows.map(r => r.model)));
  const regions = Array.from(new Set(rows.map(r => r.region)));
  const W = 700, H = 320, L = 72, R = 20, T = 34, B = 72;
  const svg = frame(host, W, H, 'Balanced accuracy of a linear probe on the BEV features, by region and model');
  const Y = v => (H - B) - (H - B - T) * (v - 0.45) / (1.0 - 0.45);
  for (let v = 0.5; v <= 1.001; v += 0.1) {
    el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: Y(v) + 4, class: 'tick end', text: fmt(v, 2) }, svg);
  }
  el('text', { x: 13, y: (T + H - B) / 2, class: 'axis mid', transform: `rotate(-90 13 ${(T + H - B) / 2})`, text: 'Balanced accuracy ↑' }, svg);
  const gw = (W - L - R) / regions.length;
  regions.forEach((reg, ri) => {
    const x0 = L + ri * gw;
    el('text', { x: x0 + gw / 2, y: H - B + 26, class: 'tick mid', text: reg }, svg);
    models.forEach((m, mi) => {
      const r = rows.find(x => x.model === m && x.region === reg); if (!r) return;
      const bw = (gw - 30) / models.length - 5;
      const x = x0 + 15 + mi * (bw + 5);
      const ours = /paver/i.test(m);
      const g = el('g', { class: 'bar v' + (ours ? ' ours' : '') }, svg);
      const rect = el('rect', { x, y: Y(r.ba), width: bw, height: (H - B) - Y(r.ba), rx: 4, class: 'fill' }, g);
      rect.style.setProperty('--h', ((H - B) - Y(r.ba)) + 'px');
      el('line', { x1: x + bw / 2, x2: x + bw / 2, y1: Y(r.lo), y2: Y(r.hi), stroke: 'var(--fg)', 'stroke-width': 1.4, opacity: .55 }, g);
      hoverable(g, `<b>${m}</b> · ${reg}<br>balanced accuracy ${fmt(r.ba, 4)}<br>95% CI [${fmt(r.lo, 3)}, ${fmt(r.hi, 3)}]<br>macro ROC AUC ${fmt(r.auc, 3)}`);
    });
    if (ri) el('line', { x1: x0, x2: x0, y1: T, y2: H - B + 6, class: 'sepline' }, svg);
  });
  const swatchW = Math.min(150, (W - L - R) / models.length);
  models.forEach((m, mi) => {
    const sx = L + mi * swatchW;
    el('rect', { x: sx, y: 10, width: 10, height: 10, rx: 2,
      class: 'swatch ' + (/paver/i.test(m) ? 'ours' : 'base') }, svg);
    el('text', { x: sx + 16, y: 19, class: 'hint start',
      text: fitText(m.replace(/_epoch(\d+)/, ' e$1'), swatchW - 22, 12.5) }, svg);
  });
  animate(svg);
}

/* ── 13. intervention deltas on the PAVER head ────────────────────────── */



function chartCorr(host, scope){
  const d = DATA(); if (!d || !d.corr) return;
  const mets = d.corr.metrics;
  const cells = d.corr.cells.filter(c => c.s === scope);
  const n = mets.length;
  const L = 190, T = 176, cell = 42, R = 24, B = 36;
  const W = L + n * cell + R, H = T + n * cell + B;
  const svg = frame(host, W, H, `Correlation between downstream metrics, ${scope}`);
  mets.forEach((m, i) => {
    el('text', { x: L - 14, y: T + i * cell + cell / 2 + 4, class: 'tick end', text: m }, svg);
    const cx = L + i * cell + cell / 2;
    el('text', { x: cx, y: T - 10, class: 'tick start', transform: `rotate(-45 ${cx} ${T - 10})`, text: m }, svg);
  });
  cells.forEach(c => {
    const i = mets.indexOf(c.b), j = mets.indexOf(c.a);
    if (i < 0 || j < 0) return;
    const g = el('g', { class: 'pt' }, svg);
    const pos = c.v >= 0;
    el('rect', {
      x: L + i * cell + 2, y: T + j * cell + 2, width: cell - 4, height: cell - 4, rx: 5,
      fill: pos ? 'var(--paver)' : 'var(--accent-2)', opacity: 0.1 + 0.8 * Math.abs(c.v)
    }, g);
    el('text', { x: L + i * cell + cell / 2, y: T + j * cell + cell / 2 + 4,
      class: 'val mid', text: fmt(c.v, 2).replace('0.', '.') , 'font-size': 11 }, g);
    hoverable(g, `<b>${c.a}</b> vs <b>${c.b}</b><br>correlation ${fmt(c.v, 4)}<br><i>${scope}</i>`);
  });
  animate(svg);
}

Object.assign(window.PAVER_CHARTS, { chartProbe, chartCorr });

/* ── 21. multi-task radar ─────────────────────────────────────────────── */
const RADAR = {
  axes: [
    { key: 'l2',  label: 'Planning L2',  unit: ' m', lower: true },
    { key: 'col', label: 'Collision',    unit: '%',  lower: true },
    { key: 'ade', label: 'Motion ADE',   unit: ' m', lower: true },
    { key: 'mr',  label: 'Motion MR',    unit: '',   lower: true },
    { key: 'nds', label: 'Detection NDS', unit: '',  lower: false },
    { key: 'map', label: 'Map mAP',      unit: '',   lower: false }
  ],
  models: {
    'VAD-Tiny': {
      base: { l2: 0.66, col: 0.51, ade: 0.91, mr: 0.13, nds: 0.34, map: 0.42 },
      ours: { l2: 0.60, col: 0.19, ade: 0.80, mr: 0.12, nds: 0.40, map: 0.44 }
    },
    'VAD-Base': {
      base: { l2: 0.74, col: 0.31, ade: 0.76, mr: 0.11, nds: 0.42, map: 0.50 },
      ours: { l2: 0.56, col: 0.40, ade: 0.69, mr: 0.09, nds: 0.45, map: 0.50 }
    },
    'GenAD': {
      base: { l2: 0.59, col: 0.37, ade: 0.87, mr: 0.14, nds: 0.26, map: 0.46 },
      ours: { l2: 0.54, col: 0.21, ade: 0.80, mr: 0.11, nds: 0.28, map: 0.44 }
    }
  }
};

function chartRadar(host, model) {
  const spec = RADAR.models[model] || RADAR.models['VAD-Tiny'];
  const axes = RADAR.axes;
  const W = 620, H = 480, cx = W / 2, cy = H / 2 + 4, R = 156;
  const svg = frame(host, W, H,
    `Multi-task profile of ${model} without and with PAVER, six normalized axes where outward is better`);

  /* normalize each axis across every model so the shape is comparable */
  const range = {};
  axes.forEach(a => {
    const vals = Object.values(RADAR.models).flatMap(m => [m.base[a.key], m.ours[a.key]]);
    range[a.key] = { lo: Math.min(...vals), hi: Math.max(...vals) };
  });
  const norm = (a, v) => {
    const { lo, hi } = range[a.key];
    const t = hi === lo ? 1 : (v - lo) / (hi - lo);
    return 0.18 + 0.82 * (a.lower ? 1 - t : t);
  };
  const angle = i => -Math.PI / 2 + i * 2 * Math.PI / axes.length;
  const px = (i, r) => cx + R * r * Math.cos(angle(i));
  const py = (i, r) => cy + R * r * Math.sin(angle(i));

  [0.25, 0.5, 0.75, 1].forEach(ring => {
    el('polygon', {
      points: axes.map((_, i) => `${px(i, ring)},${py(i, ring)}`).join(' '), class: 'web'
    }, svg);
  });
  axes.forEach((a, i) => {
    el('line', { x1: cx, y1: cy, x2: px(i, 1), y2: py(i, 1), class: 'spoke' }, svg);
    const lx = cx + (R + 34) * Math.cos(angle(i));
    const ly = cy + (R + 34) * Math.sin(angle(i));
    const anchor = Math.abs(Math.cos(angle(i))) < 0.2 ? 'mid'
                 : (Math.cos(angle(i)) > 0 ? 'start' : 'end');
    el('text', { x: lx, y: ly, class: 'rlab ' + anchor, text: a.label }, svg);
    el('text', {
      x: lx, y: ly + 17, class: 'rsub ' + anchor,
      text: `${fmt(spec.base[a.key], 2)} → ${fmt(spec.ours[a.key], 2)}` +
            (a.unit ? (a.unit === '%' ? a.unit : ' ' + a.unit) : '')
    }, svg);
  });

  [['base', spec.base, model], ['ours', spec.ours, model + ' + PAVER']].forEach(([cls, row, name]) => {
    const pts = axes.map((a, i) => [px(i, norm(a, row[a.key])), py(i, norm(a, row[a.key]))]);
    const poly = el('polygon', { points: pts.map(p => p.join(',')).join(' '), class: 'poly ' + cls }, svg);
    poly.style.transformOrigin = `${cx}px ${cy}px`;
    pts.forEach((p, i) => {
      const a = axes[i];
      const g = el('g', { class: 'pt' + (cls === 'ours' ? ' ours' : '') }, svg);
      el('circle', { cx: p[0], cy: p[1], r: cls === 'ours' ? 5 : 4, class: 'dot' }, g);
      const better = a.lower ? row[a.key] < spec.base[a.key] : row[a.key] > spec.base[a.key];
      hoverable(g, `<b>${name}</b><br>${a.label}: ${fmt(row[a.key], 3)}${a.unit}` +
        (cls === 'ours'
          ? `<br>baseline ${fmt(spec.base[a.key], 3)}${a.unit}<br><i>${better ? 'improved' : 'not improved'}</i>`
          : ''));
    });
  });

  /* the legend is right-aligned so the longer of the two names cannot run past
     the drawing, whatever architecture is selected */
  el('rect', { x: W - 20, y: 12, width: 12, height: 4, rx: 2, class: 'swatch base' }, svg);
  el('text', { x: W - 28, y: 18, class: 'hint end', text: model }, svg);
  el('rect', { x: W - 20, y: 32, width: 12, height: 4, rx: 2, class: 'swatch ours' }, svg);
  el('text', { x: W - 28, y: 38, class: 'hint end', text: model + ' + PAVER' }, svg);
  animate(svg);
}

Object.assign(window.PAVER_CHARTS, { chartRadar, RADAR, hoverable, showTip, hideTip });

/* ── 22. generic metric-row bars, one metric at a time ────────────────── */
const ROWSETS = {
  pseudo: {
    metrics: [['l2', 'Planning L2 (m)', true], ['col', 'Collision (%)', true],
              ['ade', 'Motion ADE (m)', true], ['fde', 'Motion FDE (m)', true],
              ['mr', 'Motion MR', true], ['nds', 'Detection NDS', false], ['map', 'Map mAP', false]],
    rows: [
      { label: 'No pretraining', l2: 0.662, col: 0.513, ade: 0.905, fde: 1.250, mr: 0.135, nds: 0.338, map: 0.419 },
      { label: 'Pseudo-LiDAR', l2: 0.563, col: 0.560, ade: 0.831, fde: 1.101, mr: 0.121, nds: 0.386, map: 0.439 },
      { label: 'LiDAR', ours: true, l2: 0.603, col: 0.187, ade: 0.803, fde: 1.086, mr: 0.121, nds: 0.397, map: 0.439 }
    ]
  },
  map: {
    metrics: [['divider', 'Divider AP', false], ['ped', 'Ped. crossing AP', false],
              ['boundary', 'Boundary AP', false], ['map', 'Map mAP', false]],
    rows: [
      { label: 'VAD-Tiny', fam: 'VAD-Tiny', divider: 0.48, ped: 0.32, boundary: 0.46, map: 0.42 },
      { label: 'VAD-Tiny + PAVER', fam: 'VAD-Tiny', ours: true, divider: 0.48, ped: 0.34, boundary: 0.49, map: 0.44 },
      { label: 'VAD-Base', fam: 'VAD-Base', divider: 0.53, ped: 0.44, boundary: 0.53, map: 0.50 },
      { label: 'VAD-Base + PAVER', fam: 'VAD-Base', ours: true, divider: 0.53, ped: 0.44, boundary: 0.52, map: 0.50 },
      { label: 'GenAD', fam: 'GenAD', divider: 0.50, ped: 0.38, boundary: 0.49, map: 0.46 },
      { label: 'GenAD + PAVER', fam: 'GenAD', ours: true, divider: 0.47, ped: 0.35, boundary: 0.48, map: 0.44 }
    ]
  },
  methods: {
    metrics: [['l2a', 'Planning L2, 3 s (m)', true], ['cola', 'Collision, 3 s (%)', true],
              ['params', 'Auxiliary parameters (M)', true]],
    rows: [
      { label: 'VAD-Tiny', fam: 'VAD-Tiny', l2a: 1.12, cola: 0.58, params: 0.00 },
      { label: 'VAD-Tiny + UniPAD', fam: 'VAD-Tiny', l2a: 1.11, cola: 0.46, params: 6.41 },
      { label: 'VAD-Tiny + MIM4D', fam: 'VAD-Tiny', l2a: 1.06, cola: 0.38, params: 13.43 },
      { label: 'VAD-Tiny + PAVER', fam: 'VAD-Tiny', ours: true, l2a: 0.92, cola: 0.32, params: 0.01 },
      { label: 'VAD-Base', fam: 'VAD-Base', l2a: 1.10, cola: 0.43, params: 0.00 },
      { label: 'VAD-Base + MIM4D', fam: 'VAD-Base', l2a: 1.00, cola: 0.36, params: 13.43 },
      { label: 'VAD-Base + PAVER', fam: 'VAD-Base', ours: true, l2a: 0.85, cola: 0.61, params: 0.01 }
    ]
  },
  strategy: {
    metrics: [['col', 'Collision (%)', true], ['l2', 'Planning L2 (m)', true],
              ['nds', 'Detection NDS', false], ['ade', 'Motion ADE (m)', true],
              ['map', 'Map mAP', false], ['params', 'Auxiliary parameters (M)', true]],
    rows: [
      { label: 'No pretraining', l2: 0.662, col: 0.513, ade: 0.905, nds: 0.338, map: 0.419, params: 0.00 },
      { label: 'Detection', l2: 0.515, col: 0.240, ade: 0.798, nds: 0.365, map: 0.406, params: 3.01 },
      { label: 'Map', l2: 0.694, col: 0.333, ade: 0.857, nds: 0.331, map: 0.391, params: 2.91 },
      { label: 'Occupancy', l2: 0.646, col: 0.320, ade: 0.905, nds: 0.336, map: 0.393, params: 3.56 },
      { label: 'Detection + Map', l2: 0.504, col: 0.190, ade: 0.805, nds: 0.361, map: 0.397, params: 5.92 },
      { label: 'Det. + Map + Occ.', l2: 0.577, col: 0.270, ade: 0.798, nds: 0.356, map: 0.420, params: 9.49 },
      { label: 'Sparse actions, 10K', ours: true, l2: 0.603, col: 0.187, ade: 0.803, nds: 0.397, map: 0.439, params: 0.01 },
      { label: 'Sparse actions, 30K', l2: 0.514, col: 0.320, ade: 0.800, nds: 0.383, map: 0.447, params: 0.03 },
      { label: 'Sparse actions, 90K', l2: 0.596, col: 0.220, ade: 0.782, nds: 0.397, map: 0.433, params: 0.09 }
    ]
  },
  components: {
    metrics: [['col', 'Collision (%)', true], ['l2', 'Planning L2 (m)', true],
              ['ade', 'Motion ADE (m)', true], ['fde', 'Motion FDE (m)', true],
              ['mr', 'Motion MR', true], ['nds', 'Detection NDS', false], ['map', 'Map mAP', false]],
    rows: [
      { label: 'Neither', l2: 0.662, col: 0.513, ade: 0.905, fde: 1.250, mr: 0.135, nds: 0.338, map: 0.419 },
      { label: 'Mask only', l2: 0.655, col: 0.523, ade: 0.808, fde: 1.084, mr: 0.115, nds: 0.396, map: 0.443 },
      { label: 'Action state only', l2: 0.705, col: 0.550, ade: 0.797, fde: 1.080, mr: 0.123, nds: 0.388, map: 0.445 },
      { label: 'Both, PAVER', ours: true, l2: 0.603, col: 0.187, ade: 0.803, fde: 1.086, mr: 0.121, nds: 0.397, map: 0.439 }
    ]
  }
};

function chartRows(host, setKey, metricKey) {
  const set = ROWSETS[setKey];
  const meta = set.metrics.find(m => m[0] === metricKey) || set.metrics[0];
  const [key, label, lower] = meta;
  const rows = set.rows;
  const W = 760, L = 210, R = 132, T = 30, B = 58;
  const rh = 32, H = T + rows.length * rh + B;
  const svg = frame(host, W, H, `${label} for each configuration, read against the baseline`);
  /* the axis leaves room for the value to sit beside its bar, so no chart mixes
     a light label inside one bar with a dark label beside the next */
  const scale = niceTicks(Math.max(...rows.map(r => r[key])) * 1.2 || 1, 4);
  const max = scale.top;
  const x = v => L + (W - L - R) * (v / max);
  const plot = W - L - R;

  /* every row is measured against the baseline of its own architecture, so a
   * VAD-Base configuration is never compared against a VAD-Tiny number */
  const famOf = r => r.fam || 'all';
  const refOf = new Map();
  rows.forEach(r => { if (!refOf.has(famOf(r))) refOf.set(famOf(r), r); });
  const refFor = r => refOf.get(famOf(r));
  const fams = [...refOf.keys()];
  const best = rows.reduce((a, b) => (lower ? b[key] < a[key] : b[key] > a[key]) ? b : a);
  const decimals = max < 1 ? 3 : 2;

  scale.ticks.forEach(v => {
    el('line', { x1: x(v), x2: x(v), y1: T - 8, y2: H - B + 4, class: 'grid' }, svg);
    el('text', { x: x(v), y: H - B + 26, class: 'tick mid',
      text: fmt(v, max < 1 ? 2 : (max < 20 ? 1 : 0)) }, svg);
  });
  el('text', { x: (L + W - R) / 2, y: H - 10, class: 'axis mid',
    text: label + (lower ? ' ↓' : ' ↑') }, svg);
  el('text', { x: W - R + 12, y: T - 10, class: 'hint start', text: 'vs baseline' }, svg);
  /* the dashed rule is the reference each block is measured against, which the
     chart never said out loud */
  el('line', { x1: L, x2: L + 16, y1: T - 14, y2: T - 14, class: 'ref' }, svg);
  el('text', { x: L + 22, y: T - 10, class: 'hint start', text: 'baseline' }, svg);
  el('path', { d: `M${L - 202},${T - 18} l4,4 l-4,4`, class: 'bestmark' }, svg);
  el('text', { x: L - 192, y: T - 10, class: 'hint start', text: 'best' }, svg);

  /* each reference is a line spanning only the rows it governs, so a chart with
   * several architectures shows several baselines without ambiguity */
  fams.forEach((f, fi) => {
    const idx = rows.map((r, i) => [r, i]).filter(([r]) => famOf(r) === f).map(([, i]) => i);
    const top = T + idx[0] * rh, bot = T + (idx[idx.length - 1] + 1) * rh;
    const rx = x(refOf.get(f)[key]);
    el('line', { x1: rx, x2: rx, y1: fi === 0 ? T - 8 : top + 2,
      y2: fi === fams.length - 1 ? H - B + 4 : bot - 2, class: 'ref' }, svg);
    /* a divider makes the block boundary explicit */
    if (fi > 0) el('line', { x1: L - 200, x2: W - R + 84, y1: top, y2: top, class: 'blockrule' }, svg);
  });
  /* The dashed rule used to carry a floating "Baseline" label as well as the
     legend entry above, so the same word appeared twice on one line and the two
     collided whenever the baseline value fell near the left edge. The legend
     already names the rule, so the floating copy is gone. */

  rows.forEach((r, i) => {
    const y = T + i * rh;
    const ref = refFor(r);
    const isRef = r === ref;
    const isBest = r === best && !isRef;
    const g = el('g', { class: 'bar' + (r.ours ? ' ours' : '') + (isBest ? ' best' : '') }, svg);

    /* the winner is marked by weight and a leading tick, not by a floating word */
    if (isBest) {
      const mk = el('path', { d: `M${L - 202},${y + rh / 2 - 4} l4,4 l-4,4`, class: 'bestmark' }, g);
      /* the wedge marked the best row but never said so */
      el('title', { text: 'Best value in this chart' }, mk);
    }
    el('text', { x: L - 16, y: y + rh / 2 + 4,
      class: 'tick end' + (isBest ? ' beststrong' : ''), text: r.label }, g);

    const w = Math.max(2, x(r[key]) - L);
    const rect = el('rect', { x: L, y: y + 6, width: w, height: rh - 14, rx: 6, class: 'fill' }, g);
    rect.style.setProperty('--w', w + 'px');
    el('text', { x: L + w + 10, y: y + rh / 2 + 4, class: 'val start',
      text: fmt(r[key], decimals) }, g);
    hoverable(g, `<b>${r.label}</b><br>${label} ${fmt(r[key], decimals)}` +
      (isRef ? '<br>reference for this block'
             : `<br>${fmt((r[key] - ref[key]) / ref[key] * 100, 1)}% against the baseline`));

    /* delta against the reference, informative on every row rather than only the winner */
    if (!isRef) {
      const raw = r[key] - ref[key];
      const rel = ref[key] === 0 ? null : raw / ref[key] * 100;
      const better = lower ? raw < 0 : raw > 0;
      const sign = v => (v > 0 ? '+' : v < 0 ? '\u2212' : '');
      const mag = Math.abs(rel === null ? raw : rel);
      const txt = rel === null
        ? sign(raw) + fmt(Math.abs(raw), decimals)
        /* two rows that differ can round to the same integer percent, so a
           small difference keeps a decimal rather than reading as identical */
        : sign(rel) + fmt(mag, mag < 10 ? 1 : 0) + '%';
      el('text', { x: W - R + 12, y: y + rh / 2 + 4,
        class: 'delta start ' + (better ? 'up' : 'down'), text: txt }, g);
    } else {
      el('text', { x: W - R + 12, y: y + rh / 2 + 4, class: 'delta start flat',
        text: 'reference' }, g);
    }

    const others = set.metrics.filter(m => m[0] !== key)
      .map(m => `${m[1]}: ${fmt(r[m[0]], 3)}`).join('<br>');
    hoverable(g, `<b>${r.label}</b><br>${label}: ${fmt(r[key], 3)}` +
      (isRef ? `<br><i>the ${famOf(r) === 'all' ? '' : famOf(r) + ' '}baseline</i>`
             : `<br>${fmt(r[key] - ref[key], 3)} against ${famOf(r) === 'all' ? 'the baseline' : famOf(r)}`) +
      `<br><i>${others}</i>`);
  });
  animate(svg);
}

Object.assign(window.PAVER_CHARTS, { chartRows, ROWSETS });

/* ── 24. parameter drift during downstream training ───────────────────── */
function chartDrift(host){
  const d = DATA(); if (!d || !d.drift) return;
  const comps = Array.from(new Set(d.drift.map(r => r.comp)));
  const W = 720, H = 380, L = 76, R = 176, T = 22, B = 62;
  const svg = frame(host, W, H, 'Relative parameter change of each component across downstream epochs');
  const epochs = Array.from(new Set(d.drift.map(r => r.epoch))).sort((a, b) => a - b);
  const vmax = Math.max(...d.drift.map(r => r.rel)) * 1.08;
  const X = e => L + (W - L - R) * (e - epochs[0]) / ((epochs[epochs.length - 1] - epochs[0]) || 1);
  const Y = v => (H - B) - (H - B - T) * v / vmax;
  for (let i = 0; i <= 4; i++) {
    const v = vmax * i / 4;
    el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: Y(v) + 4, class: 'tick end', text: fmt(v, 2) }, svg);
  }
  for (let e = epochs[0]; e <= epochs[epochs.length - 1]; e += 5) {
    el('line', { x1: X(e), x2: X(e), y1: T, y2: H - B, class: 'grid' }, svg);
    el('text', { x: X(e), y: H - B + 26, class: 'tick mid', text: String(e) }, svg);
  }
  el('text', { x: (L + W - R) / 2, y: H - 10, class: 'axis mid', text: 'Downstream epoch' }, svg);
  el('text', { x: 13, y: (T + H - B) / 2, class: 'axis mid',
    transform: `rotate(-90 13 ${(T + H - B) / 2})`, text: 'Relative L2 parameter change' }, svg);
  comps.forEach((c, i) => {
    const series = d.drift.filter(r => r.comp === c).sort((a, b) => a.epoch - b.epoch);
    const transferred = /bev|encoder|ego/i.test(c);
    const colour = transferred ? 'var(--paver)' : seriesStroke(i, false);
    const line = el('path', {
      d: series.map((r, k) => `${k ? 'L' : 'M'}${X(r.epoch)},${Y(r.rel)}`).join(' '),
      fill: 'none', class: 'series'
    }, svg);
    line.setAttribute('stroke', colour);
    line.setAttribute('stroke-width', transferred ? 3 : 1.6);
    line.setAttribute('opacity', transferred ? 1 : 0.6);
    line.style.setProperty('--len', line.getTotalLength ? line.getTotalLength() : 600);
    const last = series[series.length - 1];
    const g = el('g', { class: 'pt' + (transferred ? ' ours' : '') }, svg);
    const dot = el('circle', { cx: X(last.epoch), cy: Y(last.rel), r: transferred ? 6 : 4, class: 'dot' }, g);
    dot.setAttribute('fill', colour);
    hoverable(g, `<b>${c.replace(/_/g, ' ')}</b><br>epoch ${last.epoch}<br>` +
      `relative change ${fmt(last.rel, 4)}<br>cosine to the pretrained weights ${fmt(last.cos, 5)}`);
    el('rect', { x: W - R + 8, y: T + 6 + i * 18 - 7, width: 18, height: transferred ? 5 : 3, rx: 2, fill: colour }, svg);
    el('text', { x: W - R + 31, y: T + 6 + i * 18 - 1, class: 'hint start',
      text: fitText(c.replace(/_/g, ' '), R - 39, 12.5), 'font-weight': transferred ? 700 : 400 }, svg);
  });
  animate(svg);
}

/* ── 25. mask-token trajectory during pretraining ─────────────────────── */
function chartMask(host){
  const d = DATA(); if (!d || !d.mask) return;
  const rows = d.mask;
  const W = 720, H = 360, L = 76, R = 168, T = 22, B = 62;
  const svg = frame(host, W, H, 'Mask-token norm, direction and readout probabilities across pretraining epochs');
  const emax = rows[rows.length - 1].epoch;
  const X = e => L + (W - L - R) * e / (emax || 1);
  const series = [
    ['norm', 'mask-token norm', 'var(--paver)', r => r.norm],
    ['risk', 'mask-only risk probability', 'var(--accent-3)', r => r.risk],
    ['unk', 'mask-only unknown probability', 'var(--accent-2)', r => r.unk]
  ];
  const vmax = Math.max(...rows.flatMap(r => series.map(s => s[3](r)))) * 1.1 || 1;
  const Y = v => (H - B) - (H - B - T) * v / vmax;
  for (let i = 0; i <= 4; i++) {
    const v = vmax * i / 4;
    el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: Y(v) + 4, class: 'tick end', text: fmt(v, 2) }, svg);
  }
  for (let e = 0; e <= emax; e += 5) {
    el('line', { x1: X(e), x2: X(e), y1: T, y2: H - B, class: 'grid' }, svg);
    el('text', { x: X(e), y: H - B + 26, class: 'tick mid', text: String(e) }, svg);
  }
  el('text', { x: (L + W - R) / 2, y: H - 10, class: 'axis mid', text: 'Pretraining epoch' }, svg);
  series.forEach(([key, label, colour, get], i) => {
    const line = el('path', {
      d: rows.map((r, k) => `${k ? 'L' : 'M'}${X(r.epoch)},${Y(get(r))}`).join(' '), fill: 'none', class: 'series'
    }, svg);
    line.setAttribute('stroke', colour);
    line.setAttribute('stroke-width', i ? 1.8 : 3);
    line.style.setProperty('--len', line.getTotalLength ? line.getTotalLength() : 500);
    rows.forEach(r => {
      const g = el('g', { class: 'pt' + (i ? '' : ' ours') }, svg);
      const c = el('circle', { cx: X(r.epoch), cy: Y(get(r)), r: i ? 3 : 4.5, class: 'dot' }, g);
      c.setAttribute('fill', colour);
      hoverable(g, `<b>${label}</b><br>epoch ${r.epoch}: ${fmt(get(r), 4)}<br>` +
        `<i>cosine to the initial token ${fmt(r.cos, 3)} · projector effective rank ${fmt(r.rank, 1)}</i>`);
    });
    el('rect', { x: W - R + 8, y: T + 6 + i * 18 - 7, width: 18, height: i ? 3 : 5, rx: 2, fill: colour }, svg);
    el('text', { x: W - R + 31, y: T + 6 + i * 18 - 1, class: 'hint start',
      text: fitText(label, R - 39, 12.5) }, svg);
  });
  animate(svg);
}

/* ── 26. checkpoint selection rules ───────────────────────────────────── */

/* ── 27. pretraining-proxy shortcut audit ─────────────────────────────── */

Object.assign(window.PAVER_CHARTS, { chartDrift, chartMask });

/* ── 28. per-task loss and encoder gradient ───────────────────────────── */
function chartTaskGrad(host, channel){
  const d = DATA(); if (!d || !d.taskgrad) return;
  const key = channel === 'grad' ? 'grad' : 'loss';
  const tasks = Array.from(new Set(d.taskgrad.map(r => r.task)));
  const W = 760, H = 380, L = 76, R = 168, T = 26, B = 70;
  const svg = frame(host, W, H, `Per-task ${key === 'grad' ? 'encoder gradient' : 'loss'} across downstream epochs`);
  const epochs = d.taskgrad.map(r => r.epoch);
  const e0 = Math.min(...epochs), e1 = Math.max(...epochs);
  const vmax = Math.max(...d.taskgrad.map(r => r[key])) * 1.08;
  const X = e => L + (W - L - R) * (e - e0) / ((e1 - e0) || 1);
  const Y = v => (H - B) - (H - B - T) * v / vmax;
  for (let i = 0; i <= 4; i++) {
    const v = vmax * i / 4;
    el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: Y(v) + 4, class: 'tick end', text: fmt(v, vmax < 5 ? 2 : 0) }, svg);
  }
  for (let e = e0; e <= e1; e += 5) {
    el('line', { x1: X(e), x2: X(e), y1: T, y2: H - B, class: 'grid' }, svg);
    el('text', { x: X(e), y: H - B + 26, class: 'tick mid', text: String(e) }, svg);
  }
  el('text', { x: (L + W - R) / 2, y: H - 10, class: 'axis mid', text: 'Downstream epoch' }, svg);
  el('text', { x: 13, y: (T + H - B) / 2, class: 'axis mid', transform: `rotate(-90 13 ${(T + H - B) / 2})`,
    text: key === 'grad' ? 'RMS gradient on the transferred encoder' : 'Mean task loss' }, svg);
  tasks.forEach((t, i) => {
    const series = d.taskgrad.filter(r => r.task === t).sort((a, b) => a.epoch - b.epoch);
    const colour = t === 'planning' ? 'var(--paver)' : seriesStroke(i, false);
    const line = el('path', { d: series.map((r, k) => `${k ? 'L' : 'M'}${X(r.epoch)},${Y(r[key])}`).join(' '),
      fill: 'none', class: 'series' }, svg);
    line.setAttribute('stroke', colour);
    line.setAttribute('stroke-width', t === 'planning' ? 3 : 1.8);
    line.setAttribute('opacity', t === 'planning' ? 1 : 0.65);
    line.style.setProperty('--len', line.getTotalLength ? line.getTotalLength() : 600);
    const hit = el('path', { d: line.getAttribute('d'), fill: 'none', stroke: 'transparent', 'stroke-width': 12 }, svg);
    const dec = (d.decay || []).find(x => x.task === t);
    hoverable(hit, `<b>${t}</b><br>loss ${fmt(series[0].loss, 2)} → ${fmt(series[series.length - 1].loss, 2)}` +
      (dec ? `<br>${fmt(dec.per10, 3)} per 10 epochs, 95% CI [${fmt(dec.lo, 3)}, ${fmt(dec.hi, 3)}]` : ''));
    el('rect', { x: W - R + 8, y: T + 6 + i * 20 - 7, width: 18, height: t === 'planning' ? 5 : 3, rx: 2, fill: colour }, svg);
    el('text', { x: W - R + 31, y: T + 6 + i * 20 - 1, class: 'hint start', text: t,
      'font-weight': t === 'planning' ? 700 : 400 }, svg);
  });
  animate(svg);
}

/* ── 29. gradient energy by component ─────────────────────────────────── */
function chartGradEnergy(host){
  const d = DATA(); if (!d || !d.gradenergy) return;
  const tasks = Array.from(new Set(d.gradenergy.map(r => r.task)));
  const comps = Array.from(new Set(d.gradenergy.map(r => r.comp)));
  const W = 760, L = 132, R = 30, T = 44, B = 52;
  const rh = 38, H = T + tasks.length * rh + B;
  const svg = frame(host, W, H, 'Share of each task gradient energy landing in each parameter group');
  const X = v => L + (W - L - R) * v;
  for (let v = 0; v <= 1.001; v += 0.25) {
    el('line', { x1: X(v), x2: X(v), y1: T - 10, y2: H - B + 4, class: 'grid' }, svg);
    el('text', { x: X(v), y: H - B + 26, class: 'tick mid', text: Math.round(v * 100) + '%' }, svg);
  }
  el('text', { x: (L + W - R) / 2, y: H - 10, class: 'axis mid', text: 'Share of the task gradient energy' }, svg);
  const tone = c => /bev|ego|query|position/i.test(c) ? 'var(--paver)'
    : (/image|neck|backbone/i.test(c) ? 'var(--fg-3)' : 'var(--accent-2)');
  tasks.forEach((t, i) => {
    const y = T + i * rh;
    el('text', { x: L - 14, y: y + rh / 2 + 4, class: 'tick end', text: t }, svg);
    let acc = 0;
    comps.forEach(cmp => {
      const r = d.gradenergy.find(z => z.task === t && z.comp === cmp);
      if (!r || r.share <= 0) return;
      const g = el('g', { class: 'bar' }, svg);
      const w = X(acc + r.share) - X(acc);
      const rect = el('rect', { x: X(acc), y: y + 6, width: w, height: rh - 16, rx: 4,
        fill: tint(tone(cmp), /bev|ego|query|position/i.test(cmp) ? 95 : 50) }, g);
      rect.style.setProperty('--w', w + 'px');
      hoverable(g, `<b>${t}</b><br>${cmp.replace(/_/g, ' ')}: ${fmt(r.share * 100, 1)}% of the gradient energy`);
      if (w > 26) el('text', { x: X(acc) + w / 2, y: y + rh / 2 + 4, class: 'val mid',
        text: fmt(r.share * 100, 0) + '%' }, g);
      acc += r.share;
    });
  });
  [['BEV encoder and queries', 'var(--paver)', 95], ['image backbone and neck', 'var(--fg-3)', 50],
   ['other transferred', 'var(--accent-2)', 60]].forEach(([lab, col, op], i) => {
    el('rect', { x: L + i * 220, y: 14, width: 11, height: 11, rx: 2, fill: tint(col, op) }, svg);
    el('text', { x: L + i * 220 + 18, y: 24, class: 'hint start', text: lab }, svg);
  });
  animate(svg);
}

/* ── 30. corridor coverage of the sampled action set ──────────────────── */
function chartCoverage(host){
  const d = DATA(); if (!d || !d.coverage) return;
  /* the calibration groups are replicates, so they are averaged rather than
     overplotted, which previously produced thousands of colliding tick labels */
  const byDraw = new Map();
  d.coverage.forEach(r => {
    const e = byDraw.get(r.draws) || { draws: r.draws, corridor: 0, endpoint: 0, n: 0 };
    e.corridor += r.corridor; e.endpoint += r.endpoint; e.n += 1;
    byDraw.set(r.draws, e);
  });
  const series = Array.from(byDraw.values())
    .map(e => ({ draws: e.draws, corridor: e.corridor / e.n, endpoint: e.endpoint / e.n }))
    .sort((a, b) => a.draws - b.draws);
  const W = 720, H = 350, L = 76, R = 156, T = 26, B = 66;
  const svg = frame(host, W, H, 'Fraction of the BEV plane covered as more candidate actions are drawn');
  const dmax = Math.max(...series.map(r => r.draws));
  const vmax = Math.max(...series.map(r => r.corridor)) * 1.1;
  const X = n => L + (W - L - R) * (n - 1) / ((dmax - 1) || 1);
  const Y = v => (H - B) - (H - B - T) * v / vmax;
  for (let i = 0; i <= 4; i++) {
    const v = vmax * i / 4;
    el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
    el('text', { x: L - 14, y: Y(v) + 4, class: 'tick end', text: fmt(v * 100, 1) + '%' }, svg);
  }
  const tickStep = Math.max(1, Math.ceil(dmax / 8));
  for (let n = 1; n <= dmax; n += tickStep) {
    el('line', { x1: X(n), x2: X(n), y1: T, y2: H - B, class: 'grid' }, svg);
    el('text', { x: X(n), y: H - B + 26, class: 'tick mid', text: String(n) }, svg);
  }
  el('text', { x: (L + W - R) / 2, y: H - 10, class: 'axis mid', text: 'Candidate draws' }, svg);
  el('text', { x: 13, y: (T + H - B) / 2, class: 'axis mid', transform: `rotate(-90 13 ${(T + H - B) / 2})`,
    text: 'Fraction of the BEV plane' }, svg);
  [['corridor', 'corridor cells', 'var(--paver)', 3],
   ['endpoint', 'measured endpoints', 'var(--accent-3)', 2]].forEach(([key, lab, col, wdt], i) => {
    const line = el('path', { d: series.map((r, k) => `${k ? 'L' : 'M'}${X(r.draws)},${Y(r[key])}`).join(' '),
      fill: 'none', class: 'series' }, svg);
    line.setAttribute('stroke', col);
    line.setAttribute('stroke-width', wdt);
    line.style.setProperty('--len', line.getTotalLength ? line.getTotalLength() : 500);
    series.forEach(r => {
      const g = el('g', { class: 'pt' }, svg);
      const c = el('circle', { cx: X(r.draws), cy: Y(r[key]), r: 3.5, class: 'dot' }, g);
      c.setAttribute('fill', col);
      hoverable(g, `<b>${lab}</b><br>${r.draws} draw${r.draws > 1 ? 's' : ''}: ` +
        `${fmt(r[key] * 100, 2)}% of the plane, averaged over the calibration groups`);
    });
    el('rect', { x: W - R + 8, y: T + 6 + i * 20 - 7, width: 18, height: 3, rx: 2, fill: col }, svg);
    el('text', { x: W - R + 31, y: T + 6 + i * 20 - 1, class: 'hint start',
      text: fitText(lab, R - 39, 12.5) }, svg);
  });
  animate(svg);
}

/* ── 31. do the task gains move together ──────────────────────────────── */
function chartCoupling(host){
  const d = DATA(); if (!d || !d.coupling) return;
  const rows = d.coupling;
  const W = 720, L = 268, R = 60, T = 30, B = 56;
  const rh = 40, H = T + rows.length * rh + B;
  const svg = frame(host, W, H, 'Correlation between per-epoch task improvements');
  const lim = 1;
  const X = v => L + (W - L - R) * (v + lim) / (2 * lim);
  for (let i = 0; i <= 4; i++) {
    const v = -lim + 2 * lim * i / 4;
    el('line', { x1: X(v), x2: X(v), y1: T - 10, y2: H - B + 4, class: 'grid' }, svg);
    el('text', { x: X(v), y: H - B + 26, class: 'tick mid', text: fmt(v, 1) }, svg);
  }
  el('line', { x1: X(0), x2: X(0), y1: T - 10, y2: H - B + 4, class: 'ref' }, svg);
  el('text', { x: (L + W - R) / 2, y: H - 10, class: 'axis mid',
    text: 'Correlation of per-epoch changes' }, svg);
  rows.forEach((r, i) => {
    const y = T + i * rh + rh / 2;
    el('text', { x: L - 14, y: y + 4, class: 'tick end',
      text: r.pair.replace(/_delta_vs_/g, ' vs ').replace(/_delta/g, '').replace(/_/g, ' ') }, svg);
    [['pearson', 'var(--paver)', 5.5], ['spearman', 'var(--accent-2)', 4]].forEach(([k, col, rad]) => {
      const g = el('g', { class: 'pt' }, svg);
      const c = el('circle', { cx: X(r[k]), cy: y, r: rad, class: 'dot' }, g);
      c.setAttribute('fill', col);
      hoverable(g, `<b>${r.pair.replace(/_/g, ' ')}</b><br>${k} ${fmt(r[k], 3)}` +
        `<br><i>near zero means the two tasks improve independently rather than trading off</i>`);
    });
  });
  [['Pearson', 'var(--paver)'], ['Spearman', 'var(--accent-2)']].forEach(([lab, col], i) => {
    el('circle', { cx: L + i * 110 + 6, cy: 18, r: 5, fill: col }, svg);
    el('text', { x: L + i * 110 + 18, y: 22, class: 'hint start', text: lab }, svg);
  });
  animate(svg);
}

Object.assign(window.PAVER_CHARTS, { chartTaskGrad, chartGradEnergy, chartCoverage, chartCoupling });
