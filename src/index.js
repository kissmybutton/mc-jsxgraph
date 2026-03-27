import GeomClip from "./Incidents/GeomClip";
import Attr from "./Incidents/Attr";
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
  // pivot accepts "center"|"centroid"|"start"|"end"|"<entityId>" or [x,y]
  // — validated loosely as an optional string; [x,y] arrays also work at runtime
  pivot: { type: "string" },
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
  shapes: {
    type: "array",
    items: {
      type: "object",
      strict: false, // shape descriptors vary widely by type
      props: {
        type: { type: "string" },
        id: { type: "string" },
        args: { type: "array" },
        classes: {
          type: "array",
          items: { type: "string" },
        },
        attributes: { type: "object", strict: false },
        // angle / angleMarker only
        vertex: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
      },
    },
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
