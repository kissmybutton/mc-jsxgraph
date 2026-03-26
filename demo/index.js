import { loadPlugin, AddElement, RemoveElement } from "@donkeyclip/motorcortex";
import Player from "@donkeyclip/motorcortex-player";
import McGeomDefinition from "../dist/bundle.esm.js";
import "../node_modules/jsxgraph/distrib/jsxgraph.css";

const McGeom = loadPlugin(McGeomDefinition);

const ARM_LEN = 3;
const INITIAL_DEG = 30;
const INITIAL_RAD = (INITIAL_DEG * Math.PI) / 180;

/**
 * Demo: "What is a Right Angle?"
 *
 * This demo exercises AddElement and RemoveElement to build the scene
 * incrementally, proving that the framework correctly handles forward
 * play, backward seek, and flash (forceReset) at every stage.
 *
 * Initial shapes  — the permanent skeleton: base line, origin O,
 *                   and invisible structural points for arm + triangle.
 * Dynamic shapes (via AddElement / RemoveElement):
 *   arm       — the red rotating segment
 *   angleArc  — the blue 90° arc (removed once the square marker takes over)
 *   sqMark    — the canonical right-angle square marker at O
 *   rtTri     — a green right triangle (right side of board)
 *   triMark   — square marker on the triangle's right-angle corner
 */
const clip = new McGeom.Clip(
  {
    board: {
      boundingbox: [-2.5, 5.5, 9.5, -1.5],
      axis: false,
      showCopyright: false,
      showNavigation: false,
    },
    shapes: [
      // ── Permanent horizontal base line ───────────────────────────────
      {
        type: "segment",
        id: "baseLine",
        args: [
          [-1.5, 0],
          [5.2, 0],
        ],
        attributes: {
          strokeColor: "#95a5a6",
          strokeWidth: 2,
          withLabel: false,
        },
      },

      // ── Origin O ────────────────────────────────────────────────────
      {
        type: "point",
        id: "O",
        args: [0, 0],
        attributes: { name: "O", size: 4, color: "#2c3e50" },
      },

      // ── Structural points for the arm / angle (invisible) ────────────
      // baseR: reference point along the positive x-axis, for angle measurement
      {
        type: "point",
        id: "baseR",
        args: [ARM_LEN, 0],
        attributes: { visible: false },
      },
      // armEnd: tip of the rotating arm, starts at 30° from horizontal
      {
        type: "point",
        id: "armEnd",
        args: [
          ARM_LEN * Math.cos(INITIAL_RAD),
          ARM_LEN * Math.sin(INITIAL_RAD),
        ],
        attributes: { visible: false },
      },

      // ── Structural points for the right triangle (invisible) ─────────
      {
        type: "point",
        id: "rtA",
        args: [5.5, 0],
        attributes: { visible: false },
      },
      {
        type: "point",
        id: "rtB",
        args: [5.5, 3],
        attributes: { visible: false },
      },
      {
        type: "point",
        id: "rtC",
        args: [9, 0],
        attributes: { visible: false },
      },

      // ── Pre-created dynamic shapes (invisible until AddElement fires) ──
      // These must be registered in customEntities at clip-init time so
      // that effects (Rotate, Highlight, Morph) can be set up before the
      // elements are made visible via AddElement.
      {
        type: "segment",
        id: "arm",
        args: ["O", "armEnd"],
        attributes: {
          strokeColor: "#e74c3c",
          strokeWidth: 3,
          withLabel: false,
          visible: false,
        },
      },
      {
        type: "angle",
        id: "angleArc",
        vertex: "O",
        from: "baseR",
        to: "armEnd",
        attributes: {
          radius: 0.85,
          fillColor: "#3498db",
          fillOpacity: 0.25,
          strokeColor: "#2980b9",
          strokeWidth: 1.5,
          withLabel: false,
          visible: false,
        },
      },
      {
        type: "angleMarker",
        id: "sqMark",
        vertex: "O",
        from: "armEnd",
        to: "baseR",
        attributes: { visible: false },
      },
      {
        type: "polygon",
        id: "rtTri",
        args: ["rtA", "rtB", "rtC"],
        attributes: {
          fillColor: "#27ae60",
          fillOpacity: 0.2,
          withLabel: false,
          visible: false,
          vertices: { visible: false },
          borders: { strokeColor: "#27ae60", strokeWidth: 2.5, visible: false },
        },
      },
      {
        type: "angleMarker",
        id: "triMark",
        vertex: "rtA",
        from: "rtB",
        to: "rtC",
        attributes: { visible: false },
      },
    ],
  },
  {
    host: document.getElementById("clip"),
    containerParams: { width: "800px", height: "600px" },
  },
);

// ── Act 1: The arm appears and rotates to 90° ────────────────────────────────
// AddElement creates the arm segment dynamically — this exercises insertElement.
clip.addIncident(
  new AddElement(
    {
      definition: {
        type: "segment",
        id: "arm",
        args: ["O", "armEnd"],
        attributes: {
          strokeColor: "#e74c3c",
          strokeWidth: 3,
          withLabel: false,
        },
      },
    },
    { mcid: "arm" },
  ),
  500,
);

// Rotate the arm 60° around O: 30° + 60° = 90° (a right angle with the base line)
clip.addIncident(
  new McGeom.Rotate(
    { animatedAttrs: { rotation: 60 }, pivot: "O" },
    { selector: "!#arm", duration: 2500 },
  ),
  1200,
);

// ── Act 2: The 90° arc appears, labelling the angle ─────────────────────────
// Another AddElement — armEnd is now at (0, 3) after rotation.
// JSXGraph's dependency system means the arc is instantly correct.
clip.addIncident(
  new AddElement(
    {
      definition: {
        type: "angle",
        id: "angleArc",
        vertex: "O",
        from: "baseR",
        to: "armEnd",
        attributes: {
          radius: 0.85,
          fillColor: "#3498db",
          fillOpacity: 0.25,
          strokeColor: "#2980b9",
          strokeWidth: 1.5,
          withLabel: false,
        },
      },
    },
    { mcid: "angleArc" },
  ),
  4000,
);

clip.addIncident(
  new McGeom.Highlight(
    { animatedAttrs: { highlight: { numBlinks: 3, color: "#2980b9" } } },
    { selector: "!#angleArc", duration: 1500 },
  ),
  4500,
);

// ── Act 3: The canonical square marker replaces the arc ──────────────────────
clip.addIncident(
  new AddElement(
    {
      definition: {
        type: "angleMarker",
        id: "sqMark",
        vertex: "O",
        from: "armEnd",
        to: "baseR",
      },
    },
    { mcid: "sqMark" },
  ),
  6500,
);

clip.addIncident(
  new McGeom.Highlight(
    { animatedAttrs: { highlight: { numBlinks: 3, color: "#e74c3c" } } },
    { selector: "!#sqMark", duration: 1000 },
  ),
  7000,
);

// RemoveElement removes the arc — the square marker is the universal symbol.
// This exercises deleteElement and the sentinel detach / reattach cycle.
clip.addIncident(new RemoveElement({ mcid: "angleArc" }), 8500);

// ── Act 4: A right triangle appears on the right ─────────────────────────────
// Both the triangle polygon and its corner marker are added simultaneously.
clip.addIncident(
  new AddElement(
    {
      definition: {
        type: "polygon",
        id: "rtTri",
        args: ["rtA", "rtB", "rtC"],
        attributes: {
          fillColor: "#27ae60",
          fillOpacity: 0.2,
          withLabel: false,
          vertices: { visible: false },
          borders: { strokeColor: "#27ae60", strokeWidth: 2.5 },
        },
      },
    },
    { mcid: "rtTri" },
  ),
  9500,
);

clip.addIncident(
  new AddElement(
    {
      definition: {
        type: "angleMarker",
        id: "triMark",
        vertex: "rtA",
        from: "rtB",
        to: "rtC",
      },
    },
    { mcid: "triMark" },
  ),
  9500,
);

clip.addIncident(
  new McGeom.Highlight(
    { animatedAttrs: { highlight: { numBlinks: 3, color: "#27ae60" } } },
    { selector: "!#rtTri", duration: 1500 },
  ),
  10200,
);

// ── Act 5: The triangle morphs — the right angle is preserved ────────────────
// rtB goes higher; rtA and rtC keep the same x / y respectively, so the
// 90° angle at rtA is preserved by geometry.
// JSXGraph automatically keeps the triMark square correct.
clip.addIncident(
  new McGeom.Morph(
    {
      animatedAttrs: {
        morph: [
          [5.5, 0],
          [5.5, 4.5],
          [9, 0],
        ],
      },
    },
    { selector: "!#rtTri", duration: 2000 },
  ),
  12200,
);

clip.addIncident(
  new McGeom.Highlight(
    { animatedAttrs: { highlight: { numBlinks: 3, color: "#e74c3c" } } },
    { selector: "!#triMark", duration: 1500 },
  ),
  14700,
);

// ── Act 6: The arm disappears — the right angle at O lives on ────────────────
// Removing the arm segment (a visual line) leaves armEnd (the invisible point)
// still on the board at (0, 3). sqMark references armEnd and O, so it
// continues to display the 90° corner — the right angle is a property of
// position, not of the line.
clip.addIncident(new RemoveElement({ mcid: "arm" }), 16800);

clip.addIncident(
  new McGeom.Highlight(
    { animatedAttrs: { highlight: { numBlinks: 3, color: "#e74c3c" } } },
    { selector: "!#sqMark", duration: 1200 },
  ),
  17600,
);

new Player({ clip });
