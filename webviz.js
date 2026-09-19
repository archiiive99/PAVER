/* PAVER project page — dependency-free 3D scene viewer.
 *
 * Renders the exported `paver.webviz.v1` frames: predicted 3D boxes, the
 * predicted vector map, object motion, the planned ego trajectory and the
 * ground truth, in the nuScenes LiDAR frame.
 *
 * Conventions are taken from the lab's three.js viewer so a box sits where the
 * reference renderer puts it:
 *   world = (-y, z, -x) from LiDAR (x forward, y left, z up);
 *   box width is perpendicular to the heading, length runs along it;
 *   the camera presets and the class palette are the viewer's.
 * The projection, clipping and hit testing are written out here rather than
 * pulled from a library, so the page keeps its no-dependency contract.
 */
'use strict';

const WV = (() => {
  const NEAR = 0.35;
  const VFOV = 60 * Math.PI / 180;
  const MAX_HFOV = 74 * Math.PI / 180;

  /* the lab viewer's class palette, so the same object reads the same colour */
  const CLS = {
    car: '#3b82f6', truck: '#8b5cf6', bus: '#a855f7', pedestrian: '#ef4444',
    bicycle: '#22c55e', motorcycle: '#f59e0b', barrier: '#6b7280',
    traffic_cone: '#f97316', trailer: '#06b6d4', construction_vehicle: '#ec4899'
  };
  const MAP_CLS = {
    divider: '#209EFF', ped_crossing: '#f0a92b', boundary: '#22c55e'
  };
  const MAP_NAME = {
    divider: 'Lane divider', ped_crossing: 'Pedestrian crossing', boundary: 'Road boundary'
  };
  const EGO = '#10b981';

  const PRESETS = {
    /* Behind the ego and above it, looking down at the ego itself: raising the
     * camera also raises its elevation, so the aim point stays on the vehicle
     * rather than drifting up the road. */
    behind: { az: 0, el: 0.46, dist: 46, tx: 0, ty: 0, tz: 0 },
    top:    { az: 0, el: 1.4487, dist: 74, tx: 0, ty: 0, tz: -4 },
    front:  { az: Math.PI, el: 0.22, dist: 66, tx: 0, ty: 0, tz: -6 },
    free:   { az: -0.72, el: 0.36, dist: 66, tx: 0, ty: 0, tz: -6 }
  };

  /* LiDAR -> render world (x right, y up, z back).
   *
   * nuScenes LIDAR_TOP is mounted yawed, so in this frame **y is forward and x
   * is to the vehicle's right**, not the textbook x-forward. The repository's
   * own renderers confirm it: bev.py draws the ego as x in +-w/2 by y in +-l/2
   * with its heading line to (0, +l/2), visualization.py rejects boxes with
   * |x| > 15 or |y| > 30, and the configured range is [-15,-30,15,30] -- 15 m
   * laterally, 30 m along the road. Mapping index 0 to forward instead turns
   * the ground plane, the range rectangle and the ego 90 degrees away from the
   * boxes and the road.
   *
   * The LiDAR origin is the sensor, roughly 1.84 m above the road, so a car's
   * box centre sits near z = -1.1 and its underside near z = -1.9. The renderer
   * therefore lifts the whole scene by the sensor height (`ZOFF`), which puts
   * the road surface at world y = 0: object boxes keep their measured height
   * and the ego, the map and the trajectories all rest on the same plane. */
  let ZOFF = 0;
  const w3 = (x, y, z) => [x, (z || 0) + ZOFF, -y];
  /* a height in metres above the road surface */
  const gz = h => -ZOFF + h;

  function mix(hex, t) {                     /* darken toward black by t */
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * (1 - t)));
    return `rgb(${c.join(',')})`;
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ── camera ─────────────────────────────────────────────────────────── */
  function makeCam(state, w, h) {
    const { az, el, dist, tx, ty, tz } = state;
    const target = [tx || 0, ty || 0, tz];
    const ce = Math.cos(el), se = Math.sin(el);
    const pos = [target[0] + dist * ce * Math.sin(az),
                 target[1] + dist * se,
                 target[2] + dist * ce * Math.cos(az)];
    let f = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]];
    const fl = Math.hypot(...f) || 1;
    f = f.map(v => v / fl);
    /* right = normalize(f x worldUp) keeps the horizon level; with worldUp
     * (0,1,0) that reduces to (-f_z, 0, f_x). Getting this sign wrong mirrors
     * the whole scene left to right. */
    let r = [-f[2], 0, f[0]];
    const rl = Math.hypot(r[0], r[2]) || 1;
    r = [r[0] / rl, 0, r[2] / rl];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const aspect = w / h;
    let tv = Math.tan(VFOV / 2);
    if (Math.atan(tv * aspect) * 2 > MAX_HFOV) tv = Math.tan(MAX_HFOV / 2) / aspect;
    const sx = (w / 2) / (tv * aspect), sy = (h / 2) / tv;
    return {
      pos, f, r, u, w, h, sx, sy, target,
      /* metres per screen pixel at the target plane, for panning */
      scale: 2 * tv * dist / h,
      /* returns [px, py, depth]; depth <= NEAR means behind the near plane */
      p(P) {
        const d = [P[0] - pos[0], P[1] - pos[1], P[2] - pos[2]];
        const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
        const x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2];
        const y = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
        return [w / 2 + x / z * sx, h / 2 - y / z * sy, z];
      },
      depth(P) {
        return (P[0] - pos[0]) * f[0] + (P[1] - pos[1]) * f[1] + (P[2] - pos[2]) * f[2];
      }
    };
  }

  /* a segment crossing the near plane is clipped, never dropped whole */
  function seg(cam, A, B) {
    let a = cam.p(A), b = cam.p(B);
    if (a[2] <= NEAR && b[2] <= NEAR) return null;
    if (a[2] <= NEAR || b[2] <= NEAR) {
      const [P, Q] = a[2] <= NEAR ? [A, B] : [B, A];
      const dp = cam.depth(P), dq = cam.depth(Q);
      const t = (NEAR - dp) / (dq - dp || 1);
      const M = [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2] + (Q[2] - P[2]) * t];
      if (a[2] <= NEAR) a = cam.p(M); else b = cam.p(M);
    }
    return [a, b];
  }

  function polyline(ctx, cam, pts3, style) {
    ctx.save();
    Object.assign(ctx, style.ctx || {});
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.width || 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (style.dash) ctx.setLineDash(style.dash);
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < pts3.length - 1; i++) {
      const s = seg(cam, pts3[i], pts3[i + 1]);
      if (!s) { open = false; continue; }
      if (!open) { ctx.moveTo(s[0][0], s[0][1]); open = true; }
      else ctx.lineTo(s[0][0], s[0][1]);
      ctx.lineTo(s[1][0], s[1][1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ── geometry ───────────────────────────────────────────────────────── */
  /* 8 corners from a BEV footprint and a height, in render world space */
  function boxCorners(bev, zBottom, h) {
    const lo = bev.map(p => w3(p[0], p[1], zBottom));
    const hi = bev.map(p => w3(p[0], p[1], zBottom + h));
    return lo.concat(hi);
  }
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0],
                 [4, 5], [5, 6], [6, 7], [7, 4],
                 [0, 4], [1, 5], [2, 6], [3, 7]];
  /* the six faces, wound so the cross product points out of the box */
  const FACES = [[4, 5, 6, 7], [3, 2, 1, 0],          /* top, bottom */
                 [0, 1, 5, 4], [2, 3, 7, 6],          /* front, back */
                 [1, 2, 6, 5], [3, 0, 4, 7]];         /* right, left */
  const LIGHT = (() => { const l = [0.35, 0.86, 0.38];
    const n = Math.hypot(...l); return l.map(v => v / n); })();

  function drawBox(ctx, cam, C, colour, o) {
    /* every face the camera can see is filled and lit, so the box reads as a
     * solid from any orbit angle rather than as a lid on a wireframe */
    if (o.fill > 0) {
      const faces = [];
      for (const q of FACES) {
        const A = C[q[0]], B = C[q[1]], D = C[q[3]];
        const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
        const e2 = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
        let n = [e1[1] * e2[2] - e1[2] * e2[1],
                 e1[2] * e2[0] - e1[0] * e2[2],
                 e1[0] * e2[1] - e1[1] * e2[0]];
        const nl = Math.hypot(...n) || 1;
        n = n.map(v => v / nl);
        /* back-face cull: keep the faces whose normal turns toward the camera */
        const mid = q.reduce((s, i) => [s[0] + C[i][0] / 4, s[1] + C[i][1] / 4, s[2] + C[i][2] / 4], [0, 0, 0]);
        const toCam = [cam.pos[0] - mid[0], cam.pos[1] - mid[1], cam.pos[2] - mid[2]];
        if (n[0] * toCam[0] + n[1] * toCam[1] + n[2] * toCam[2] <= 0) continue;
        const proj = q.map(i => cam.p(C[i]));
        if (!proj.every(p => p[2] > NEAR)) continue;
        const lam = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
        faces.push({ proj, a: o.fill * (0.55 + 0.65 * lam),
                     d: -cam.depth(mid) });
      }
      faces.sort((p, q2) => p.d - q2.d);
      ctx.save();
      faces.forEach(fc => {
        ctx.fillStyle = rgba(colour, Math.min(0.92, fc.a));
        ctx.beginPath();
        fc.proj.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = o.edge || colour;
    ctx.lineWidth = o.width;
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath();
    for (const [i, j] of EDGES) {
      const s = seg(cam, C[i], C[j]);
      if (!s) continue;
      ctx.moveTo(s[0][0], s[0][1]);
      ctx.lineTo(s[1][0], s[1][1]);
    }
    ctx.stroke();
    ctx.restore();
    /* a heading tick from the top-face centre to the middle of the FRONT edge.
     * The footprint is wound (+l/2,+w/2), (+l/2,-w/2), (-l/2,-w/2), (-l/2,+w/2),
     * so corners 0 and 1 share the front; corners 0 and 3 share the left side,
     * and using that pair instead rotates every heading by 90 degrees. */
    if (o.heading) {
      const front = [(C[4][0] + C[5][0]) / 2, C[4][1], (C[4][2] + C[5][2]) / 2];
      const mid = [(C[4][0] + C[6][0]) / 2, C[4][1], (C[4][2] + C[6][2]) / 2];
      polyline(ctx, cam, [mid, front], { stroke: o.edge || colour, width: o.width + 0.6 });
    }
  }


  /* ── planned trajectory ribbon ───────────────────────────────────────────
   * The lab viewer draws the ego path as a flat 1.2 m ribbon on the ground at
   * height 0.06, built from a centripetal Catmull-Rom curve through the
   * waypoints (tension 0.5, at least 32 segments) and shaded with vertex
   * colours that run #10b981 -> #3b82f6, MeshBasicMaterial at opacity 0.8.
   * The same numbers are reproduced here. */
  const RIBBON = { w: 1.2, z: 0.06, alpha: 0.8, from: [16, 185, 129], to: [59, 130, 246] };
  /* matplotlib's autumn, the ramp bev.py uses for object futures: red at the
   * box, yellow at the far end of the prediction. */
  const AUTUMN_RGB = t => [255, Math.round(255 * Math.min(1, Math.max(0, t))), 0];


  /* centripetal Catmull-Rom, the "centripetal" 0.5 knot parameterization */
  function catmullRom(pts, segments) {
    if (pts.length < 2) return pts.slice();
    const P = [pts[0].map((v, i) => 2 * pts[0][i] - pts[1][i])]
      .concat(pts, [pts[pts.length - 1].map((v, i) => 2 * pts[pts.length - 1][i] - pts[pts.length - 2][i])]);
    const knot = [0];
    for (let i = 1; i < P.length; i++) {
      const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      knot.push(knot[i - 1] + Math.max(1e-4, Math.sqrt(d)));
    }
    const t0 = knot[1], t1 = knot[P.length - 2];
    const at = t => {
      let i = 1;
      while (i < P.length - 3 && knot[i + 1] < t) i++;
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      const [k0, k1, k2, k3] = [knot[i - 1], knot[i], knot[i + 1], knot[i + 2]];
      const L = (a, b, ka, kb) => {
        const f = (t - ka) / (kb - ka || 1);
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      };
      const A1 = L(p0, p1, k0, k1), A2 = L(p1, p2, k1, k2), A3 = L(p2, p3, k2, k3);
      const B1 = L(A1, A2, k0, k2), B2 = L(A2, A3, k1, k3);
      return L(B1, B2, k1, k2);
    };
    const out = [];
    for (let s = 0; s <= segments; s++) out.push(at(t0 + (t1 - t0) * s / segments));
    return out;
  }

  /* Trajectory geometry, built once in metric ground-plane coordinates and
   * projected either by the scene camera or by a vehicle camera, so the ego
   * path, an object future and the same path drawn over an image are one shape
   * with one construction. `width` is in metres, `ramp(t) -> [r,g,b]`. */
  function ribbonQuads(pts2, opts) {
    const o = opts || {};
    if (pts2.length < 2) return [];
    const width = o.width == null ? RIBBON.w : o.width;
    const ramp = o.ramp || (t => RIBBON.from.map((v, k) => Math.round(v + (RIBBON.to[k] - v) * t)));
    /* a 0.3 m ribbon needs far fewer segments than the 1.2 m ego path, and an
     * 80-agent frame would otherwise fill several thousand quads per view */
    const segments = o.segments == null ? Math.max(32, pts2.length * 10) : o.segments;
    const c = catmullRom(pts2, segments);
    const half = width / 2;
    const out = [];
    for (let i = 0; i < c.length - 1; i++) {
      const tx = c[i + 1][0] - c[i][0], ty = c[i + 1][1] - c[i][1];
      const tl = Math.hypot(tx, ty) || 1;
      /* perpendicular in the ground plane, so the ribbon lies flat */
      const px = -ty / tl * half, py = tx / tl * half;
      out.push({
        q: [[c[i][0] + px, c[i][1] + py], [c[i][0] - px, c[i][1] - py],
            [c[i + 1][0] - px, c[i + 1][1] - py], [c[i + 1][0] + px, c[i + 1][1] + py]],
        col: ramp(i / Math.max(1, c.length - 2))
      });
    }
    return out;
  }

  /* Fill the quads back to front. `project` maps a ground-plane point to
   * [px, py, depth]; a quad with any corner behind the near plane is skipped
   * rather than folded across the image. */
  function paintRibbon(ctx, quads, project, near, alpha) {
    const drawn = [];
    quads.forEach(qd => {
      const proj = qd.q.map(project);
      if (!proj.every(p => p[2] > near)) return;
      drawn.push({ proj, col: qd.col, d: -proj.reduce((s, p) => s + p[2], 0) / 4 });
    });
    drawn.sort((a, b) => a.d - b.d);
    ctx.save();
    ctx.globalAlpha = alpha == null ? RIBBON.alpha : alpha;
    ctx.lineWidth = 1;
    drawn.forEach(fc => {
      ctx.fillStyle = `rgb(${fc.col.join(',')})`;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      fc.proj.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      /* a hairline along the same quad closes the seams between segments */
      ctx.stroke();
    });
    ctx.restore();
  }

  /* `zAbs` pins the ribbon to a height in the LiDAR frame; `z` is a height
   * above the road. An object's future belongs at that object's own footing:
   * the predicted box height drifts by up to a metre at 30 m, so drawing the
   * path on the shared road plane detached it from its own box. */
  const ribbonZ = o => (o.zAbs != null ? o.zAbs : gz(o.z == null ? RIBBON.z : o.z));
  function drawRibbon(ctx, cam, pts2, opts) {
    const o = opts || {};
    paintRibbon(ctx, ribbonQuads(pts2, o),
      p => cam.p(w3(p[0], p[1], ribbonZ(o))), NEAR, o.alpha);
  }

  /* ── ground ─────────────────────────────────────────────────────────── */
  function drawGround(ctx, cam, view, pc, ink) {
    const R = view, g = gz(0);
    for (let v = -R; v <= R + 0.01; v += 10) {
      const major = Math.abs(v) < 0.01;
      polyline(ctx, cam, [w3(v, -R, g), w3(v, R, g)],
        { stroke: rgba(ink, major ? 0.30 : 0.13), width: major ? 1.4 : 1 });
      polyline(ctx, cam, [w3(-R, v, g), w3(R, v, g)],
        { stroke: rgba(ink, major ? 0.30 : 0.13), width: major ? 1.4 : 1 });
    }
    /* the configured point-cloud support, which is smaller than the viewport */
    const b = [w3(pc.xMin, pc.yMin, g), w3(pc.xMax, pc.yMin, g),
               w3(pc.xMax, pc.yMax, g), w3(pc.xMin, pc.yMax, g)];
    polyline(ctx, cam, b.concat([b[0]]),
      { stroke: rgba(ink, 0.34), width: 1.2, dash: [6, 5] });
  }

  function drawEgo(ctx, cam) {
    /* bev.py's STYLE_CONFIG ego: 1.8 m wide across x, 4.0 m long along y.
     * Corners 0 and 1 must be the front edge, the same winding the detection
     * footprints use, so the shared heading tick points forward. */
    const w = 1.8, l = 4.0, h = 1.55;
    const bev = [[w / 2, l / 2], [-w / 2, l / 2], [-w / 2, -l / 2], [w / 2, -l / 2]];
    drawBox(ctx, cam, boxCorners(bev, gz(0), h), EGO,
      { fill: 0.30, width: 1.8, heading: true, edge: EGO });
  }


  /* ── camera overlay ──────────────────────────────────────────────────────
   * Each camera record gives sensor2lidar rotation R and translation t with
   * p_l = R p_c + t, so p_c = R^T (p_l - t), and the intrinsics K project it:
   * u = (K p_c)_x / z, v = (K p_c)_y / z. K belongs to the original image, so
   * it is rescaled by the served width. A point is only in front of the camera
   * when z > eps; an edge that crosses the near plane is clipped rather than
   * dropped, so a box the ego is driving past still draws. */
  function camera(cm, drawW, drawH) {
    const s = drawW / ((cm.size && cm.size[0]) || 1600);
    const K = cm.K, R = cm.R, t = cm.t;
    const toCam = P => {
      const d = [P[0] - t[0], P[1] - t[1], P[2] - t[2]];
      return [R[0][0] * d[0] + R[1][0] * d[1] + R[2][0] * d[2],
              R[0][1] * d[0] + R[1][1] * d[1] + R[2][1] * d[2],
              R[0][2] * d[0] + R[1][2] * d[1] + R[2][2] * d[2]];
    };
    const proj = c => {
      const x = K[0][0] * c[0] + K[0][1] * c[1] + K[0][2] * c[2];
      const y = K[1][0] * c[0] + K[1][1] * c[1] + K[1][2] * c[2];
      return [x / c[2] * s, y / c[2] * s, c[2]];
    };
    return { toCam, proj, w: drawW, h: drawH };
  }

  const CNEAR = 0.6;
  function camSeg(K, A, B) {
    let a = K.toCam(A), b = K.toCam(B);
    if (a[2] <= CNEAR && b[2] <= CNEAR) return null;
    if (a[2] <= CNEAR || b[2] <= CNEAR) {
      const [P, Q] = a[2] <= CNEAR ? [a, b] : [b, a];
      const f = (CNEAR - P[2]) / (Q[2] - P[2] || 1);
      const M = [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f, CNEAR];
      if (a[2] <= CNEAR) a = M; else b = M;
    }
    return [K.proj(a), K.proj(b)];
  }

  /* boxes, object futures, the plan and the recorded future, over one image */
  function renderCam(cv, img, frame, cm, model, opts) {
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth;
    if (!w || !cm) return [];
    /* Scrubbing jumps to frames whose photograph has not decoded yet. Clearing
     * the canvas first would leave a blank cell with only the boxes on it, so
     * the previous composite is kept until the new image can be drawn with its
     * own boxes in one pass. The caller repaints on the image's load event. */
    if (img && !(img.complete && img.naturalWidth)) return null;
    const ar = (cm.size && cm.size[1] / cm.size[0]) || 0.5625;
    const h = Math.round(w * ar);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.height = h + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, w, h);
    const K = camera(cm, w, h);
    const M = frame.models[model];
    if (!M) return [];
    const zg = frame.groundZ == null ? -1.84 : frame.groundZ;
    const hits = [];

    /* the same ribbon geometry as the 3D panes, projected through this camera,
     * so a trajectory looks identical wherever it is drawn */
    const ribbon = (pts2, o) => {
      const z = o.zAbs != null ? o.zAbs : zg + (o.z == null ? RIBBON.z : o.z);
      paintRibbon(ctx, ribbonQuads(pts2, o),
        p => { const c = K.toCam([p[0], p[1], z]);
               return c[2] <= CNEAR ? [0, 0, c[2]] : K.proj(c); },
        CNEAR, o.alpha);
    };

    const items = (opts.layers.det ? M.det.filter(d => d.score >= opts.score) : [])
      .map(d => ({ g: d, gt: false }))
      .concat(opts.layers.gt ? frame.gt.map(g => ({ g, gt: true })) : []);
    /* far boxes first, so a near box overdraws it */
    items.forEach(it => {
      const c = K.toCam([it.g.c[0], it.g.c[1], it.g.c[2]]);
      it.d = -c[2];
    });
    items.sort((a, b) => a.d - b.d);

    items.forEach(it => {
      const g = it.g, colour = CLS[g.cls] || '#9ca3af';
      const on = opts.hover === g.id;
      const zb = g.c[2] - g.wlh[2] / 2, top = zb + g.wlh[2];
      const C = g.bev.map(p => [p[0], p[1], zb]).concat(g.bev.map(p => [p[0], p[1], top]));
      /* fully behind the camera: nothing to draw */
      if (C.every(p => K.toCam(p)[2] <= CNEAR)) return;
      /* trajectories stay in the bird's-eye panes; projecting them onto the
       * camera image reads as clutter over the scene it is meant to explain */
      /* the hovered box deepens: its faces fill and its edge brightens, the
       * same cue the 3D panes use, so the two views read as one selection */
      if (on && !it.gt) {
        const front = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]];
        ctx.save();
        ctx.fillStyle = rgba(colour, 0.34);
        front.forEach(q => {
          const pr = q.map(i => K.toCam(C[i]));
          if (!pr.every(p => p[2] > CNEAR)) return;
          const pp = pr.map(p => K.proj(p));
          ctx.beginPath();
          pp.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();
      }
      ctx.save();
      ctx.strokeStyle = on ? mix(colour, 0.34) : colour;
      ctx.lineWidth = on ? 3 : 1.5;
      if (it.gt) { ctx.setLineDash([4, 4]); ctx.globalAlpha = 0.8; }
      ctx.beginPath();
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
      for (const [i, j] of EDGES) {
        const s = camSeg(K, C[i], C[j]);
        if (!s) continue;
        ctx.moveTo(s[0][0], s[0][1]);
        ctx.lineTo(s[1][0], s[1][1]);
        s.forEach(p => {
          any = true;
          x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
          x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
        });
      }
      ctx.stroke();
      ctx.restore();
      /* only count a box that actually lands inside the frame */
      if (any && !it.gt && x1 > 0 && x0 < w && y1 > 0 && y0 < h) {
        hits.push({ id: g.id, g, x0, y0, x1, y1, d: it.d });
      }
    });
    return hits;
  }

  /* ── one rendered view ──────────────────────────────────────────────── */
  function render(cv, frame, model, opts) {
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return [];
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ZOFF = -(frame.groundZ == null ? 0 : frame.groundZ);
    const cam = makeCam(opts.cam, w, h);
    const ink = opts.ink;
    const M = frame.models[model];
    if (!M) return [];

    drawGround(ctx, cam, opts.view, opts.pc, ink);

    if (opts.layers.map) {
      M.map.forEach(v => {
        const col = MAP_CLS[v.cls] || '#8899aa';
        polyline(ctx, cam, v.pts.map(p => w3(p[0], p[1], gz(0.03))),
          { stroke: col, width: v.cls === 'boundary' ? 2.6 : 2.2,
            dash: v.cls === 'divider' ? [7, 5] : null });
      });
    }

    /* boxes are painted far to near, so a near box occludes a far one */
    const hits = [];
    const items = [];
    if (opts.layers.gt) {
      frame.gt.forEach(g => items.push({ g, gt: true }));
    }
    if (opts.layers.det) {
      M.det.forEach(d => { if (d.score >= opts.score) items.push({ g: d, gt: false }); });
    }
    items.forEach(it => {
      const g = it.g;
      it.zb = g.c[2] - g.wlh[2] / 2;
      it.C = boxCorners(g.bev, it.zb, g.wlh[2]);
      it.d = -cam.depth(w3(g.c[0], g.c[1], g.c[2]));
    });
    items.sort((a, b) => a.d - b.d);

    items.forEach(it => {
      const g = it.g, colour = CLS[g.cls] || '#9ca3af';
      const on = opts.hover && opts.hover === g.id;
      if (it.gt) {
        drawBox(ctx, cam, it.C, colour,
          { fill: 0, width: on ? 2.2 : 1.3, alpha: 0.75, dash: [4, 4],
            edge: rgba(colour, 0.9) });
      } else {
        drawBox(ctx, cam, it.C, colour, {
          fill: on ? 0.34 : 0.13 + 0.12 * Math.min(1, g.score),
          width: on ? 2.6 : 1.6, heading: true,
          edge: mix(colour, on ? 0.42 : 0.18)
        });
        if (opts.layers.motion && g.fut) {
          /* the same construction as the ego path, one quarter of its width,
           * starting at this box's own underside */
          g.fut.forEach(m => drawRibbon(ctx, cam, [[g.c[0], g.c[1]]].concat(m), {
            width: RIBBON.w / 4, ramp: AUTUMN_RGB, zAbs: it.zb + 0.05, segments: 18,
            alpha: on ? 1 : RIBBON.alpha
          }));
        }
      }
      /* screen-space footprint for hit testing, same polygon that was drawn */
      const pr = it.C.map(p => cam.p(p)).filter(p => p[2] > NEAR);
      if (pr.length && !it.gt) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        pr.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
                          x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
        hits.push({ id: g.id, g, x0, y0, x1, y1, d: it.d });
      }
    });

    if (opts.layers.plan) {
      drawRibbon(ctx, cam, [[0, 0]].concat(M.plan));
    }
    drawEgo(ctx, cam);
    return hits;
  }

  return { render, renderCam, CLS, MAP_CLS, MAP_NAME, PRESETS, EGO, RIBBON,
           AUTUMN_RGB, rgba, catmullRom };
})();

window.PAVER_WEBVIZ = WV;
