import GeomClip from "./Incidents/GeomClip";
import Attr from "./Incidents/Attr";
import DrawOn from "./Incidents/DrawOn";
import Highlight from "./Incidents/Highlight";
import Morph from "./Incidents/Morph";
import Rotate from "./Incidents/Rotate";
import Translate from "./Incidents/Translate";
import { name, version } from "../package.json";

// ─── Reusable sub-schemas ─────────────────────────────────────────────────────

const coordPair = {
  type: "array",
  length: 2,
  items: { type: "number", integer: false },
};

// ─── attributesValidationRules ────────────────────────────────────────────────

const attrRules = {
  animatedAttrs: {
    type: "object",
    strict: false, // any JSXGraph attribute name is valid
  },
};

const drawOnRules = {
  animatedAttrs: {
    type: "object",
    props: {
      drawOn: { type: "number", min: 0, max: 1, integer: false },
    },
  },
};

const morphRules = {
  animatedAttrs: {
    type: "object",
    props: {
      morph: {
        type: "array",
        min: 2,
        items: coordPair,
      },
    },
  },
};

const highlightRules = {
  animatedAttrs: {
    type: "object",
    props: {
      highlight: {
        type: "object",
        props: {
          numBlinks: { type: "number", min: 1, integer: true },
          color: { type: "color" },
        },
      },
    },
  },
};

const rotateRules = {
  animatedAttrs: {
    type: "object",
    props: {
      rotation: { type: "number", integer: false },
    },
  },
  // pivot is optional — resolvePivot() defaults to centroid when undefined.
  // Not listed here because MC validation would mark it required.
};

const translateRules = {
  animatedAttrs: {
    type: "object",
    props: {
      translate: {
        type: "object",
        props: {
          x: { type: "number", integer: false },
          y: { type: "number", integer: false },
        },
      },
    },
  },
};

const geomClipRules = {
  board: {
    type: "object",
    strict: false, // all JSXGraph board options are valid
  },
  // Each shape descriptor can have wildly different fields depending on type
  // (point, polygon, angle, angleMarker, text, …). Validating only the array
  // container; per-field validation would require marking every optional field
  // (classes, vertex, from, to, attributes, …) as required.
  shapes: {
    type: "array",
    items: { type: "object", strict: false },
  },
};

// ─── Plugin definition ────────────────────────────────────────────────────────

export default {
  npm_name: name, // don't touch this
  version: version, // don't touch this
  incidents: [
    {
      exportable: Attr,
      name: "Attr",
      attributesValidationRules: attrRules,
    },
    {
      exportable: DrawOn,
      name: "DrawOn",
      attributesValidationRules: drawOnRules,
    },
    {
      exportable: Highlight,
      name: "Highlight",
      attributesValidationRules: highlightRules,
    },
    {
      exportable: Rotate,
      name: "Rotate",
      attributesValidationRules: rotateRules,
    },
    {
      exportable: Translate,
      name: "Translate",
      attributesValidationRules: translateRules,
    },
    {
      exportable: Morph,
      name: "Morph",
      attributesValidationRules: morphRules,
    },
  ],
  Clip: {
    exportable: GeomClip,
    attributesValidationRules: geomClipRules,
  },
};
