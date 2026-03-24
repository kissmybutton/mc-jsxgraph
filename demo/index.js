import { loadPlugin } from "@donkeyclip/motorcortex";
import Player from "@donkeyclip/motorcortex-player";
import McGeomDefinition from "../dist/bundle.esm.js";
import "../node_modules/jsxgraph/distrib/jsxgraph.css";

const McGeom = loadPlugin(McGeomDefinition);

// Equilateral triangle ABΓ with side = 4, centred at origin
// A = (0, 2√3), B = (-2, 0), Γ = (2, 0)
// Extensions BK = ΓΛ = AM = 2 (half the side length)
//   K on extension of AB beyond B
//   Λ on extension of BΓ beyond Γ
//   M on extension of ΓA beyond A
const S = 1.7320508; // √3

const clip = new McGeom.Clip(
  {
    board: {
      boundingbox: [-5, 7, 6, -3],
      axis: false,
      showCopyright: false,
      showNavigation: false,
    },
    shapes: [
      // ── Inner triangle vertices ──────────────────────────────────────
      {
        type: "point",
        id: "A",
        classes: ["inner"],
        args: [0, 2 * S],
        attributes: { name: "A", size: 3, color: "#2c3e50" },
      },
      {
        type: "point",
        id: "B",
        classes: ["inner"],
        args: [-2, 0],
        attributes: { name: "B", size: 3, color: "#2c3e50" },
      },
      {
        type: "point",
        id: "G",
        classes: ["inner"],
        args: [2, 0],
        attributes: { name: "Γ", size: 3, color: "#2c3e50" },
      },

      // ── Outer triangle vertices (equal extensions) ───────────────────
      // K: extend AB beyond B by 2  →  K = B + 2 * unit(B-A)
      {
        type: "point",
        id: "K",
        classes: ["outer"],
        args: [-3, -S],
        attributes: { name: "K", size: 3, color: "#e74c3c" },
      },
      // Λ: extend BΓ beyond Γ by 2  →  Λ = Γ + 2 * (1,0)
      {
        type: "point",
        id: "L",
        classes: ["outer"],
        args: [4, 0],
        attributes: { name: "Λ", size: 3, color: "#e74c3c" },
      },
      // M: extend ΓA beyond A by 2  →  M = A + 2 * unit(A-Γ)
      {
        type: "point",
        id: "M",
        classes: ["outer"],
        args: [-1, 3 * S],
        attributes: { name: "M", size: 3, color: "#e74c3c" },
      },

      // ── Inner equilateral triangle ABΓ ──────────────────────────────
      {
        type: "polygon",
        id: "triABG",
        classes: ["triangles"],
        args: ["A", "B", "G"],
        attributes: {
          fillColor: "#3498db",
          fillOpacity: 0.25,
          withLabel: true,
          name: "ABΓ",
          label: { fontSize: 13, color: "#2980b9" },
          vertices: { visible: false },
          borders: { strokeWidth: 2, strokeColor: "#2980b9" },
        },
      },

      // ── Extension segments (dashed): B→K, Γ→Λ, A→M ─────────────────
      {
        type: "segment",
        id: "segBK",
        classes: ["extensions"],
        args: ["B", "K"],
        attributes: {
          strokeColor: "#7f8c8d",
          strokeWidth: 1.5,
          dash: 2,
          withLabel: true,
          name: "BK",
          label: { position: "lft", offset: [-8, 0], fontSize: 13 },
        },
      },
      {
        type: "segment",
        id: "segGL",
        classes: ["extensions"],
        args: ["G", "L"],
        attributes: {
          strokeColor: "#7f8c8d",
          strokeWidth: 1.5,
          dash: 2,
          withLabel: true,
          name: "ΓΛ",
          label: { position: "bot", offset: [0, -10], fontSize: 13 },
        },
      },
      {
        type: "segment",
        id: "segAM",
        classes: ["extensions"],
        args: ["A", "M"],
        attributes: {
          strokeColor: "#7f8c8d",
          strokeWidth: 1.5,
          dash: 2,
          withLabel: true,
          name: "AM",
          label: { position: "rt", offset: [8, 0], fontSize: 13 },
        },
      },

      // ── Outer equilateral triangle KΛM ──────────────────────────────
      {
        type: "polygon",
        id: "triKLM",
        classes: ["triangles"],
        args: ["K", "L", "M"],
        attributes: {
          fillColor: "#e74c3c",
          fillOpacity: 0.1,
          withLabel: true,
          name: "KΛM",
          label: { fontSize: 13, color: "#c0392b" },
          vertices: { visible: false },
          borders: { strokeWidth: 2, strokeColor: "#c0392b" },
        },
      },
    ],
  },
  {
    host: document.getElementById("clip"),
    containerParams: { width: "800px", height: "600px" },
  },
);

// Highlight the construction step by step:
//   1. Inner triangle ABΓ
//   2. Equal extension segments BK, ΓΛ, AM
//   3. Outer vertices K, Λ, M
//   4. Outer triangle KΛM
const DURATION = 1500;
const GAP = 400;

const steps = [
  { selector: "!#triABG", color: "#3498db" },
  { selector: "!#segBK", color: "#f1c40f" },
  { selector: "!#segGL", color: "#f1c40f" },
  { selector: "!#segAM", color: "#f1c40f" },
  { selector: "!#K", color: "#e74c3c" },
  { selector: "!#L", color: "#e74c3c" },
  { selector: "!#M", color: "#e74c3c" },
  { selector: "!#triKLM", color: "#f1c40f" },
];

steps.forEach(({ selector, color }, i) => {
  clip.addIncident(
    new McGeom.Highlight(
      { animatedAttrs: { highlight: { numBlinks: 3, color } } },
      { selector, duration: DURATION },
    ),
    i * (DURATION + GAP),
  );
});

new Player({ clip });
