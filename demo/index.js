import { loadPlugin } from "@donkeyclip/motorcortex";
import Player from "@donkeyclip/motorcortex-player";
import McGeomDefinition from "../dist/bundle.esm.js";
import "../node_modules/jsxgraph/distrib/jsxgraph.css";

const McGeom = loadPlugin(McGeomDefinition);

// The arm starts at 30° from horizontal.
// Rotating it 60° brings it to exactly 90° — a right angle with the base line.
const ARM_LEN = 3;
const INITIAL_DEG = 30;
const INITIAL_RAD = (INITIAL_DEG * Math.PI) / 180;

const clip = new McGeom.Clip(
  {
    board: {
      boundingbox: [-2.5, 5.5, 9.5, -1.5],
      axis: false,
      showCopyright: false,
      showNavigation: false,
    },
    shapes: [
      // ── Horizontal reference line ────────────────────────────────────
      {
        type: "segment",
        id: "baseLine",
        args: [
          [-1.5, 0],
          [5, 0],
        ],
        attributes: {
          strokeColor: "#95a5a6",
          strokeWidth: 2,
          withLabel: false,
        },
      },

      // ── Origin vertex ────────────────────────────────────────────────
      {
        type: "point",
        id: "O",
        args: [0, 0],
        attributes: { name: "O", size: 4, color: "#2c3e50" },
      },

      // ── Invisible reference point along positive x-axis (angle measurement)
      {
        type: "point",
        id: "baseR",
        args: [ARM_LEN, 0],
        attributes: { visible: false },
      },

      // ── Arm endpoint, initially at INITIAL_DEG from horizontal ───────
      {
        type: "point",
        id: "armEnd",
        args: [
          ARM_LEN * Math.cos(INITIAL_RAD),
          ARM_LEN * Math.sin(INITIAL_RAD),
        ],
        attributes: { visible: false },
      },

      // ── The rotating arm ─────────────────────────────────────────────
      {
        type: "segment",
        id: "arm",
        args: ["O", "armEnd"],
        attributes: {
          strokeColor: "#e74c3c",
          strokeWidth: 3,
          withLabel: false,
        },
      },

      // ── Angle arc between base ray and arm ───────────────────────────
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
        },
      },

      // ── Right triangle ───────────────────────────────────────────────
      {
        type: "point",
        id: "rtA",
        args: [5, 0],
        attributes: { visible: false },
      },
      {
        type: "point",
        id: "rtB",
        args: [5, 3],
        attributes: { visible: false },
      },
      {
        type: "point",
        id: "rtC",
        args: [8.5, 0],
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
          vertices: { visible: false },
          borders: { strokeColor: "#27ae60", strokeWidth: 2.5 },
        },
      },

      // ── Right angle square marker at rtA ─────────────────────────────
      // JSXGraph's dependency system keeps this marker correct even as
      // the triangle morphs, because rtA/rtB/rtC are shared point entities.
      {
        type: "angleMarker",
        id: "rtMark",
        vertex: "rtA",
        from: "rtB",
        to: "rtC",
      },
    ],
  },
  {
    host: document.getElementById("clip"),
    containerParams: { width: "800px", height: "600px" },
  },
);

// ── Act 1: Rotate the arm from 30° to 90° ───────────────────────────────────
// pivot { x: 0, y: 0 } = bottom-left of bounding box = O = [0, 0]
// rotating by 60° takes the arm from 30° to exactly 90° (vertical).
clip.addIncident(
  new McGeom.Rotate(
    { animatedAttrs: { rotation: 60 }, pivot: "O" },
    { selector: "!#arm", duration: 3000 },
  ),
  500,
);

// ── Act 2: Draw attention to the angle arc (now at 90°) ─────────────────────
clip.addIncident(
  new McGeom.Highlight(
    { animatedAttrs: { highlight: { numBlinks: 4, color: "#2980b9" } } },
    { selector: "!#angleArc", duration: 2000 },
  ),
  3800,
);

// ── Act 3: Highlight the vertical arm (the perpendicular ray) ───────────────
clip.addIncident(
  new McGeom.Highlight(
    { animatedAttrs: { highlight: { numBlinks: 3, color: "#e74c3c" } } },
    { selector: "!#arm", duration: 1500 },
  ),
  6100,
);

// ── Act 4: Introduce the right triangle ─────────────────────────────────────
clip.addIncident(
  new McGeom.Highlight(
    { animatedAttrs: { highlight: { numBlinks: 3, color: "#27ae60" } } },
    { selector: "!#rtTri", duration: 1800 },
  ),
  8500,
);

// ── Act 5: Highlight the right angle square marker ──────────────────────────
clip.addIncident(
  new McGeom.Highlight(
    { animatedAttrs: { highlight: { numBlinks: 4, color: "#e74c3c" } } },
    { selector: "!#rtMark", duration: 2000 },
  ),
  10500,
);

// ── Act 6: Morph the triangle — the right angle is preserved ────────────────
// rtA stays fixed; rtB goes higher, rtC moves further right.
// Because rtA/rtB/rtC are shared entities, the square marker updates
// automatically and stays a perfect right angle throughout the morph.
clip.addIncident(
  new McGeom.Morph(
    {
      animatedAttrs: {
        morph: [
          [5, 0],
          [5, 4.5],
          [9, 0],
        ],
      },
    },
    { selector: "!#rtTri", duration: 2000 },
  ),
  13500,
);

// ── Act 7: Highlight the marker again — still 90° after the morph ───────────
clip.addIncident(
  new McGeom.Highlight(
    { animatedAttrs: { highlight: { numBlinks: 3, color: "#e74c3c" } } },
    { selector: "!#rtMark", duration: 1500 },
  ),
  15700,
);

new Player({ clip });
