import { loadPlugin, TimeCapsule } from "@donkeyclip/motorcortex";
import Player from "@donkeyclip/motorcortex-player";
import McGeomDefinition from "../dist/bundle.esm.js";
import "../node_modules/jsxgraph/distrib/jsxgraph.css";

const McGeom = loadPlugin(McGeomDefinition);

/*
 * Demo: Types of Triangles by Angles
 *
 * A single triangle morphs through the three angle-based classifications:
 *
 *   1. Oxygon   — all three angles < 90°  (acute)
 *   2. Orthogon — exactly one angle = 90° (right)
 *   3. Amblygon — exactly one angle > 90° (obtuse)
 *
 * The same polygon (pA, pB, pC) is morphed between three vertex
 * configurations. Angle arcs at each vertex update automatically because
 * JSXGraph links the arc elements to the same point objects.
 *
 * Vertex positions and resulting angles:
 *   Acute  : pA=[2,0]  pB=[8,0]  pC=[5, 4.5]  → ≈56°, ≈56°, ≈68°
 *   Right  : pA=[2,0]  pB=[8,0]  pC=[2, 4]    →  90°, ≈34°, ≈56°
 *   Obtuse : pA=[2,0]  pB=[8,0]  pC=[0.5, 1]  → ≈146°, ≈8°, ≈26°
 */

const clip = new McGeom.Clip(
  {
    board: {
      boundingbox: [-1, 7, 10, -1],
      axis: false,
      showCopyright: false,
      showNavigation: false,
    },
    shapes: [
      // ── Triangle vertices (permanent, invisible) ──────────────────────────
      {
        type: "point",
        id: "pA",
        args: [2, 0],
        attributes: { visible: false },
      },
      {
        type: "point",
        id: "pB",
        args: [8, 0],
        attributes: { visible: false },
      },
      {
        type: "point",
        id: "pC",
        args: [5, 4.5], // acute starting position
        attributes: { visible: false },
      },

      // ── Main triangle (visible from the start) ────────────────────────────
      {
        type: "polygon",
        id: "tri",
        args: ["pA", "pB", "pC"],
        attributes: {
          fillColor: "#3498db",
          fillOpacity: 0,
          withLabel: false,
          vertices: { visible: false },
          borders: { strokeColor: "#2980b9", strokeWidth: 3 },
        },
      },

      // ── Angle arcs — pre-created with opacity 0; shown/hidden via Attr ────
      //
      // Arc orientation: JSXGraph draws angles CCW from (vertex→from) to (vertex→to).
      // Using this convention the interior angle is always captured for all three
      // triangle configurations the polygon passes through.
      //
      // arcA : CCW from pB-direction to pC-direction around pA  (0°→146°→90°)
      {
        type: "angle",
        id: "arcA",
        vertex: "pA",
        from: "pB",
        to: "pC",
        attributes: {
          radius: 0.65,
          fillColor: "#e74c3c",
          fillOpacity: 0,
          strokeColor: "#c0392b",
          strokeOpacity: 0,
          strokeWidth: 2,
          withLabel: false,
        },
      },
      // arcB : CCW from pC-direction to pA-direction around pB
      {
        type: "angle",
        id: "arcB",
        vertex: "pB",
        from: "pC",
        to: "pA",
        attributes: {
          radius: 0.65,
          fillColor: "#e74c3c",
          fillOpacity: 0,
          strokeColor: "#c0392b",
          strokeOpacity: 0,
          strokeWidth: 2,
          withLabel: false,
        },
      },
      // arcC : CCW from pA-direction to pB-direction around pC
      {
        type: "angle",
        id: "arcC",
        vertex: "pC",
        from: "pA",
        to: "pB",
        attributes: {
          radius: 0.65,
          fillColor: "#e74c3c",
          fillOpacity: 0,
          strokeColor: "#c0392b",
          strokeOpacity: 0,
          strokeWidth: 2,
          withLabel: false,
        },
      },

      // ── Right-angle square marker at pA (hidden until Phase 2) ───────────
      {
        type: "angleMarker",
        id: "markerA",
        vertex: "pA",
        from: "pB",
        to: "pC",
        attributes: { strokeOpacity: 0, fillOpacity: 0 },
      },

      // ── Median from pC to midpoint of AB — drawn on during Phase 1 ──────────
      {
        type: "segment",
        id: "median",
        args: [
          [5, 0],
          [5, 4.5],
        ],
        attributes: {
          strokeColor: "#5dade2",
          strokeWidth: 1.5,
          dash: 2,
          withLabel: false,
          strokeOpacity: 0,
        },
      },

      // ── Title labels — SVG text (useHTML:false, start invisible via opacity) ─
      {
        type: "text",
        id: "lblAcute",
        args: [1, 6.3, "Oxygon \u2014 all angles < 90\u00b0"],
        attributes: {
          fontSize: 22,
          strokeColor: "#5dade2",
          useHTML: false,
          strokeOpacity: 0,
        },
      },
      {
        type: "text",
        id: "lblRight",
        args: [1, 6.3, "Orthogon \u2014 one angle = 90\u00b0"],
        attributes: {
          fontSize: 22,
          strokeColor: "#2ecc71",
          useHTML: false,
          strokeOpacity: 0,
        },
      },
      {
        type: "text",
        id: "lblObtuse",
        args: [1, 6.3, "Amblygon \u2014 one angle > 90\u00b0"],
        attributes: {
          fontSize: 22,
          strokeColor: "#e67e22",
          useHTML: false,
          strokeOpacity: 0,
        },
      },
    ],
  },
  {
    host: document.getElementById("clip"),
    containerParams: (() => {
      const s = Math.min(
        Math.floor(window.innerWidth / 2) - 48,
        window.innerHeight - 130,
      );
      return { width: `${s}px`, height: `${s}px` };
    })(),
  },
);

// ── Timeline tracking ────────────────────────────────────────────────────────

const timelineData = [];

function track(incident, startTime, element, type, duration = 0) {
  clip.addIncident(incident, startTime);
  timelineData.push({ startTime, element, type, duration });
}

// ── Helpers: show/hide via Attr (replaces AddElement/RemoveElement) ──────

function showArc(id, startTime) {
  track(
    new McGeom.Attr(
      { animatedAttrs: { strokeOpacity: 1, fillOpacity: 0.35 } },
      { selector: `!#${id}`, duration: 1 },
    ),
    startTime,
    id,
    "attr",
    1,
  );
}

function showText(id, startTime) {
  track(
    new McGeom.Attr(
      { animatedAttrs: { strokeOpacity: 1 } },
      { selector: `!#${id}`, duration: 1 },
    ),
    startTime,
    id,
    "attr",
    1,
  );
}

function hideEl(id, startTime) {
  track(
    new McGeom.Attr(
      { animatedAttrs: { strokeOpacity: 0, fillOpacity: 0 } },
      { selector: `!#${id}`, duration: 1 },
    ),
    startTime,
    id,
    "attr",
    1,
  );
}

function blink(id, startTime, numBlinks, duration, color, origColor) {
  const cycleTime = duration / numBlinks;
  const halfCycle = cycleTime / 2;
  for (let i = 0; i < numBlinks; i++) {
    const t = startTime + i * cycleTime;
    // Flash ON
    track(
      new McGeom.Attr(
        { animatedAttrs: { strokeColor: color } },
        { selector: `!#${id}`, duration: 1 },
      ),
      t,
      id,
      "attr",
      1,
    );
    // Flash OFF
    track(
      new McGeom.Attr(
        { animatedAttrs: { strokeColor: origColor } },
        { selector: `!#${id}`, duration: 1 },
      ),
      t + halfCycle,
      id,
      "attr",
      1,
    );
  }
}

// ── Phase intro: fade the triangle in from transparent ───────────────────
track(
  new McGeom.Attr(
    { animatedAttrs: { fillOpacity: 0.2 } },
    { selector: "!#tri", duration: 600 },
  ),
  0,
  "tri",
  "attr",
  600,
);

// ════════════════════════════════════════════════════════════════════════════
// Phase 1 — Oxygon
// pC = [5, 4.5]  →  all interior angles are acute (< 90°)
// ════════════════════════════════════════════════════════════════════════════

showText("lblAcute", 300);

// Draw in the median line (midpoint of AB → pC)
showText("median", 600);
track(
  new McGeom.DrawOn(
    { animatedAttrs: { drawOn: 1 } },
    { selector: "!#median", duration: 800, easing: "easeInOutQuad" },
  ),
  600,
  "median",
  "drawOn",
  800,
);
hideEl("median", 5000);

showArc("arcA", 900);
showArc("arcB", 900);
showArc("arcC", 900);

blink("tri", 1500, 3, 2000, "#2471a3", "#2980b9");

hideEl("lblAcute", 5000);

// ════════════════════════════════════════════════════════════════════════════
// Phase 2 — Orthogon
// Morph pC to [2, 4] so that the angle at pA becomes exactly 90°.
// ════════════════════════════════════════════════════════════════════════════

track(
  new McGeom.Morph(
    {
      animatedAttrs: {
        morph: [
          [2, 0],
          [8, 0],
          [2, 4],
        ],
      },
    },
    { selector: "!#tri", duration: 2000 },
  ),
  5500,
  "tri",
  "morph",
  2000,
);

hideEl("arcA", 7700);
showArc("markerA", 7700);

showText("lblRight", 7900);

blink("tri", 8500, 3, 2000, "#1e8449", "#2980b9");

blink("markerA", 8500, 3, 2000, "#1e8449", "#2980b9");

hideEl("lblRight", 11500);
hideEl("markerA", 11500);

// ════════════════════════════════════════════════════════════════════════════
// Phase 3 — Amblygon
// Morph pC to [0.5, 1] so that the angle at pA becomes ≈ 146° (obtuse).
// ════════════════════════════════════════════════════════════════════════════

track(
  new McGeom.Morph(
    {
      animatedAttrs: {
        morph: [
          [2, 0],
          [8, 0],
          [1, 3.5],
        ],
      },
    },
    { selector: "!#tri", duration: 2000 },
  ),
  12000,
  "tri",
  "morph",
  2000,
);

showArc("arcA", 14200);

showText("lblObtuse", 14400);

blink("tri", 15000, 3, 2000, "#ba4a00", "#2980b9");

blink("arcA", 15000, 3, 2000, "#ba4a00", "#c0392b");

hideEl("lblObtuse", 18000);

// ── Player ───────────────────────────────────────────────────────────────────

const player = new Player({ clip });

// ── Preview helpers (used by scripts/preview.js via Playwright) ──────────────
window.__clip = clip;
window.__player = player;
window.__seekTo = (ms) => {
  const tc = new TimeCapsule();
  tc.startJourney(clip).destination(ms);
};

// ── Sequencer timeline ───────────────────────────────────────────────────────

function renderTimeline(data, totalDuration, container, getMs) {
  const NS = "http://www.w3.org/2000/svg";
  const W = container.clientWidth || 640;

  const LABEL_W = 106;
  const PAD_R = 20;
  const HEADER_H = 50;
  const LANE_H = 28;
  const LANE_GAP = 6;
  const FOOTER_H = 36;

  const TIMELINE_W = W - LABEL_W - PAD_R;

  // Group by element in a fixed display order
  const ORDER = [
    "tri",
    "median",
    "arcA",
    "arcB",
    "arcC",
    "markerA",
    "lblAcute",
    "lblRight",
    "lblObtuse",
  ];
  const groups = {};
  for (const d of data) {
    (groups[d.element] ??= []).push(d);
  }
  const elements = ORDER.filter((e) => groups[e]);

  const SVG_H =
    HEADER_H + elements.length * (LANE_H + LANE_GAP) - LANE_GAP + FOOTER_H + 12;

  const toX = (t) => LABEL_W + (t / totalDuration) * TIMELINE_W;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", SVG_H);
  svg.style.display = "block";

  const el = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  };

  const tx = (content, attrs, parent = svg) => {
    const e = document.createElementNS(NS, "text");
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.textContent = content;
    parent.appendChild(e);
    return e;
  };

  // ── Global background ──────────────────────────────────────────────────────
  el("rect", { x: 0, y: 0, width: W, height: SVG_H, fill: "#0d1117" });

  // ── Phase bands ────────────────────────────────────────────────────────────
  const PHASES = [
    { label: "Phase 1 — Oxygon", start: 0, end: 5500, fill: "#172038" },
    { label: "Phase 2 — Orthogon", start: 5500, end: 12000, fill: "#152418" },
    {
      label: "Phase 3 — Amblygon",
      start: 12000,
      end: totalDuration,
      fill: "#271414",
    },
  ];

  for (const ph of PHASES) {
    const x1 = toX(ph.start);
    const x2 = toX(ph.end);
    el("rect", {
      x: x1,
      y: HEADER_H,
      width: x2 - x1,
      height: SVG_H - HEADER_H - FOOTER_H,
      fill: ph.fill,
    });
    tx(ph.label, {
      x: (x1 + x2) / 2,
      y: 14,
      "text-anchor": "middle",
      fill: "#4b5563",
      "font-size": 10,
      "font-family": "system-ui, sans-serif",
      "font-style": "italic",
    });
  }

  // Phase dividers
  for (const ph of PHASES.slice(1)) {
    const x = toX(ph.start);
    el("line", {
      x1: x,
      y1: HEADER_H - 24,
      x2: x,
      y2: SVG_H - FOOTER_H,
      stroke: "#374151",
      "stroke-width": 1,
      "stroke-dasharray": "4,3",
    });
  }

  // ── Time grid + axis labels ────────────────────────────────────────────────
  const TICK = 2000;
  for (let t = 0; t <= totalDuration; t += TICK) {
    const x = toX(t);
    el("line", {
      x1: x,
      y1: HEADER_H,
      x2: x,
      y2: SVG_H - FOOTER_H,
      stroke: "#161b25",
      "stroke-width": 1,
    });
    el("line", {
      x1: x,
      y1: HEADER_H - 4,
      x2: x,
      y2: HEADER_H + 3,
      stroke: "#374151",
      "stroke-width": 1,
    });
    tx(`${t / 1000}s`, {
      x,
      y: HEADER_H - 8,
      "text-anchor": "middle",
      fill: "#6b7280",
      "font-size": 10,
      "font-family": "monospace",
    });
  }

  // Axis rule
  el("line", {
    x1: LABEL_W,
    y1: HEADER_H,
    x2: W - PAD_R,
    y2: HEADER_H,
    stroke: "#374151",
    "stroke-width": 1,
  });

  // ── Element lanes ──────────────────────────────────────────────────────────

  // Per-element display config
  const META = {
    tri: { name: "tri", color: "#e2e8f0" },
    median: { name: "median", color: "#5dade2" },
    arcA: { name: "arcA", color: "#a78bfa" },
    arcB: { name: "arcB", color: "#c4b5fd" },
    arcC: { name: "arcC", color: "#ddd6fe" },
    markerA: { name: "markerA", color: "#67e8f9" },
    lblAcute: { name: "lblAcute", color: "#93c5fd" },
    lblRight: { name: "lblRight", color: "#6ee7b7" },
    lblObtuse: { name: "lblObtuse", color: "#fca5a5" },
  };

  // Per-type incident config
  const ITYPE = {
    morph: { bar: "#3b82f6", text: "#fff", label: "Morph" },
    highlight: { bar: "#f59e0b", text: "#111", label: "Highlight" },
    attr: { bar: "#a78bfa", text: "#fff", label: "Attr" },
    drawOn: { bar: "#5dade2", text: "#fff", label: "DrawOn" },
    add: { dot: "#34d399" },
    remove: { dot: "#f87171" },
  };

  elements.forEach((elem, i) => {
    const laneY = HEADER_H + i * (LANE_H + LANE_GAP);
    const cy = laneY + LANE_H / 2;
    const meta = META[elem] ?? { name: elem, color: "#9ca3af" };

    // Lane background
    el("rect", {
      x: 0,
      y: laneY,
      width: W,
      height: LANE_H,
      fill: i % 2 === 0 ? "#0f141c" : "#0d1117",
    });

    // Label column background
    el("rect", {
      x: 0,
      y: laneY,
      width: LABEL_W - 8,
      height: LANE_H,
      fill: "#131922",
    });

    // Colour accent strip
    el("rect", {
      x: 0,
      y: laneY + 3,
      width: 3,
      height: LANE_H - 6,
      fill: meta.color,
      rx: 1,
    });

    // Element name
    tx(meta.name, {
      x: LABEL_W - 12,
      y: cy + 4,
      "text-anchor": "end",
      fill: meta.color,
      "font-size": 11,
      "font-family": "monospace",
    });

    // Label / timeline divider
    el("line", {
      x1: LABEL_W - 8,
      y1: laneY,
      x2: LABEL_W - 8,
      y2: laneY + LANE_H,
      stroke: "#1f2937",
      "stroke-width": 1,
    });

    // Center guide
    el("line", {
      x1: LABEL_W,
      y1: cy,
      x2: W - PAD_R,
      y2: cy,
      stroke: "#161b25",
      "stroke-width": 1,
    });

    // Lane bottom divider
    el("line", {
      x1: 0,
      y1: laneY + LANE_H,
      x2: W,
      y2: laneY + LANE_H,
      stroke: "#161b25",
      "stroke-width": 1,
    });

    // ── Incidents ────────────────────────────────────────────────────────────
    for (const inc of groups[elem]) {
      const cfg = ITYPE[inc.type] ?? {};

      if (inc.duration > 0) {
        // Duration incident → bar
        const bx = toX(inc.startTime);
        const bw = Math.max(toX(inc.startTime + inc.duration) - bx, 4);
        const bh = LANE_H * 0.54;
        const by = cy - bh / 2;

        el("rect", {
          x: bx,
          y: by,
          width: bw,
          height: bh,
          fill: cfg.bar ?? "#6b7280",
          rx: 3,
        });

        if (bw > 28) {
          tx(cfg.label ?? inc.type, {
            x: bx + bw / 2,
            y: cy + 4,
            "text-anchor": "middle",
            fill: cfg.text ?? "#fff",
            "font-size": 9,
            "font-weight": 700,
            "font-family": "system-ui, sans-serif",
          });
        }
      } else {
        // Instant incident → dot
        const dx = toX(inc.startTime);
        const dotColor = cfg.dot ?? "#9ca3af";

        el("circle", { cx: dx, cy, r: 5, fill: dotColor });
        tx(inc.type === "add" ? "+" : "−", {
          x: dx,
          y: cy + 3.5,
          "text-anchor": "middle",
          fill: "#000",
          "font-size": 8,
          "font-weight": 700,
          "font-family": "system-ui",
        });
      }
    }
  });

  // ── Legend ─────────────────────────────────────────────────────────────────
  const legendY = SVG_H - FOOTER_H / 2 + 2;
  const legend = [
    { kind: "bar", color: "#3b82f6", label: "Morph" },
    { kind: "bar", color: "#f59e0b", label: "Highlight" },
    { kind: "dot", color: "#34d399", label: "Add element" },
    { kind: "dot", color: "#f87171", label: "Remove element" },
  ];

  let lx = LABEL_W;
  for (const item of legend) {
    if (item.kind === "bar") {
      el("rect", {
        x: lx,
        y: legendY - 5,
        width: 16,
        height: 9,
        fill: item.color,
        rx: 2,
      });
      lx += 20;
    } else {
      el("circle", { cx: lx + 5, cy: legendY, r: 5, fill: item.color });
      lx += 14;
    }
    tx(item.label, {
      x: lx,
      y: legendY + 4,
      fill: "#6b7280",
      "font-size": 10,
      "font-family": "system-ui",
    });
    lx += item.label.length * 6.2 + 16;
  }

  // ── Playhead ───────────────────────────────────────────────────────────────
  // Rendered last so it sits on top of all lane content.
  const phX = LABEL_W;

  // Vertical rule
  const phLine = el("line", {
    x1: phX,
    y1: HEADER_H - 4,
    x2: phX,
    y2: SVG_H - FOOTER_H,
    stroke: "#ffffff",
    "stroke-width": 1.5,
    opacity: 0.7,
    "pointer-events": "none",
  });

  // Triangle cursor at top
  const phHead = el("polygon", {
    points: `${phX - 5},${HEADER_H - 4} ${phX + 5},${HEADER_H - 4} ${phX},${HEADER_H + 6}`,
    fill: "#ffffff",
    opacity: 0.85,
    "pointer-events": "none",
  });

  function updatePlayhead() {
    const ms = getMs();
    const clamped = Math.min(ms, totalDuration);
    const x = toX(clamped);
    phLine.setAttribute("x1", x);
    phLine.setAttribute("x2", x);
    phHead.setAttribute(
      "points",
      `${x - 5},${HEADER_H - 4} ${x + 5},${HEADER_H - 4} ${x},${HEADER_H + 6}`,
    );
    requestAnimationFrame(updatePlayhead);
  }

  requestAnimationFrame(updatePlayhead);

  container.appendChild(svg);
}

requestAnimationFrame(() => {
  renderTimeline(
    timelineData,
    18500,
    document.getElementById("timeline"),
    () => clip.runTimeInfo?.currentMillisecond ?? 0,
  );
});
