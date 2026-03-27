# mc-jsxgraph

**Table of Contents**

- [mc-jsxgraph](#mc-jsxgraph)
  - [Demo](#demo)
- [Intro / Features](#intro--features)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Importing and Loading](#importing-and-loading)
- [Clip](#clip)
  - [GeomClip](#geomclip)
    - [Shape types](#shape-types)
    - [Selectors](#selectors)
    - [Dynamic shapes (AddElement / RemoveElement)](#dynamic-shapes-addelement--removeelement)
- [Incidents](#incidents)
  - [Attr](#attr)
  - [DrawOn](#drawon)
  - [Morph](#morph)
  - [Highlight](#highlight)
  - [Rotate](#rotate)
  - [Translate](#translate)
- [Adding Incidents in your clip](#adding-incidents-in-your-clip)
- [Contributing](#contributing)
- [License](#license)
- [Sponsored by](#sponsored-by)

## Demo

[Check it out here](https://kissmybutton.github.io/mc-jsxgraph/demo/)

# Intro / Features

[JSXGraph](https://jsxgraph.uni-bayreuth.de/) geometry visualisation as a MotorCortex clip.

mc-jsxgraph lets you declare a JSXGraph board full of geometric shapes and animate them on a timeline — morphing vertices, tweening visual attributes, highlighting elements, and dynamically adding or removing shapes mid-clip. Every incident supports MC's full feature set: easing, delay, repeats, hiatus, and accurate seeking in both directions.

The plugin exposes six Incidents and one custom Clip:

- `Attr` — tween any JSXGraph visual property (opacity, color, stroke width, …)
- `DrawOn` — progressively reveal a path element as if it is being drawn stroke-by-stroke
- `Morph` — interpolate the defining vertices of any shape to a new position
- `Highlight` — blink an element to draw attention
- `Rotate` — rotate a shape around a pivot point
- `Translate` — move a shape by a vector

## Browser compatibility

| Chrome | Safari | IE / Edge | Firefox | Opera |
| ------ | ------ | --------- | ------- | ----- |
| 88+    | 14+    | Edge 88+  | 85+     | 74+   |

# Getting Started

## Installation

```bash
$ npm install mc-jsxgraph
# OR
$ yarn add mc-jsxgraph
```

## Importing and Loading

```javascript
import { loadPlugin } from "@donkeyclip/motorcortex";
import McGeomDefinition from "mc-jsxgraph";

const McGeom = loadPlugin(McGeomDefinition);
```

# Clip

## GeomClip

`McGeom.Clip` creates a JSXGraph board inside a MotorCortex BrowserClip. Pass `board` options and an array of `shapes` to populate the board at init time.

```javascript
const clip = new McGeom.Clip(
  {
    board: {
      boundingbox: [-1, 7, 10, -1],
      axis: false,
      showCopyright: false,
      showNavigation: false,
    },
    shapes: [
      {
        type: "point",
        id: "A",
        args: [2, 0],
        attributes: { visible: false },
      },
      {
        type: "polygon",
        id: "tri",
        args: ["A", "B", "C"],
        attributes: {
          fillColor: "#3498db",
          fillOpacity: 0.2,
          borders: { strokeColor: "#2980b9", strokeWidth: 3 },
          withLabel: false,
          vertices: { visible: false },
        },
      },
    ],
  },
  {
    host: document.getElementById("clip"),
    containerParams: { width: "600px", height: "600px" },
  },
);
```

### Shape types

Each entry in `shapes` is a descriptor with the following fields:

| Field        | Type       | Description                                                                                                                       |
| ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `type`       | `string`   | JSXGraph element type (`"point"`, `"segment"`, `"circle"`, `"polygon"`, `"text"`, …) plus the two high-level types below          |
| `id`         | `string`   | Unique identifier used for selectors and cross-references between shapes                                                          |
| `classes`    | `string[]` | Optional class names for `!.class` selector targeting                                                                             |
| `args`       | `Array`    | Positional args passed to `board.create(type, args, attributes)`. String values are resolved to previously created shapes by `id` |
| `attributes` | `object`   | JSXGraph element attributes (`fillColor`, `strokeWidth`, `visible`, …)                                                            |

Two convenience types are provided so you don't need to know JSXGraph internals:

#### `type: "angle"`

Renders a sector arc showing the interior angle at a vertex.

```javascript
{
  type: "angle",
  id: "arcA",
  vertex: "A",   // id of the vertex point
  from: "B",     // id of a point on the first ray
  to: "C",       // id of a point on the second ray
  attributes: { radius: 0.6, fillColor: "#e74c3c", withLabel: false },
}
```

#### `type: "angleMarker"`

Renders a right-angle square marker at a vertex. Uses the same `vertex` / `from` / `to` API as `"angle"`. Defaults to a blue square matching the typical triangle style; override via `attributes`.

```javascript
{
  type: "angleMarker",
  id: "sqA",
  vertex: "A",
  from: "B",
  to: "C",
  attributes: { visible: false },
}
```

#### Text

JSXGraph text elements default to `useHTML: false` so they render as SVG `<text>` nodes. This is required for correct scaling inside MC's shadow DOM container. Use `strokeColor` to set the text color.

```javascript
{
  type: "text",
  id: "lbl",
  args: [1, 6, "Hello geometry"],
  attributes: { fontSize: 20, strokeColor: "#ffffff" },
}
```

### Selectors

Target shapes in Incident `props` using the `!` prefix:

```javascript
"!#tri"; // element with id "tri"
"!.acute"; // all elements with class "acute"
```

### Dynamic shapes (AddElement / RemoveElement)

Shapes that need to appear or disappear during the clip must be pre-created in `shapes` with `{ attributes: { visible: false } }`. This registers them in the clip's entity map before any Incident targets them.

```javascript
// 1. Pre-create as invisible in shapes
{ type: "angle", id: "arcA", vertex: "A", from: "B", to: "C",
  attributes: { radius: 0.6, visible: false } }

// 2. Show at a given time
clip.addIncident(
  new AddElement({ definition: { id: "arcA" } }, { mcid: "arcA" }),
  900,
);

// 3. Hide again
clip.addIncident(new RemoveElement({ mcid: "arcA" }), 5000);
```

`AddElement` and `RemoveElement` are imported directly from `@donkeyclip/motorcortex`.

# Incidents

All Incidents accept `easing`, `delay`, `repeats`, and `hiatus` in their `props` just like any other MotorCortex Effect.

## Attr

Tweens any numeric or color visual property of a JSXGraph element.

**Supported attribute types:**

- **Numeric** — `fillOpacity`, `strokeOpacity`, `strokeWidth`, `size`, `radius`, `fontSize`
- **Color** — `fillColor`, `strokeColor`, `highlightFillColor`, `highlightStrokeColor`

```javascript
new McGeom.Attr(
  {
    animatedAttrs: {
      fillOpacity: 0.6,
      strokeWidth: 4,
      fillColor: "#e74c3c",
    },
  },
  {
    selector: "!#tri",
    duration: 1000,
    easing: "easeInOutQuad",
  },
);
```

Multiple attributes animate in parallel. MC chains `initialValue` automatically, so back-to-back `Attr` incidents on the same element and attribute always continue from where the previous one left off.

## DrawOn

Progressively reveals a JSXGraph path element as if it is being drawn stroke-by-stroke from its first defining point. Works with segments, polygons, and any multi-point path. Arc-length weighting ensures constant visual pen speed regardless of varying edge lengths.

```javascript
new McGeom.DrawOn(
  { animatedAttrs: { drawOn: 1 } },
  { selector: "!#myLine", duration: 1200, easing: "easeInOutQuad" },
);
```

| `drawOn` value | Effect           |
| -------------- | ---------------- |
| `0 → 1`        | Draw the path in |
| `1 → 0`        | Erase the path   |

The element should initially have all its defining points set (so JSXGraph can render it fully when needed). Set `visible: false` if the element should be hidden before the DrawOn incident starts, then reveal it with `AddElement` just before the incident runs.

## Morph

Interpolates the defining vertices of any shape to a new position. The target must list the same number of points as the shape has defining points.

```javascript
new McGeom.Morph(
  {
    animatedAttrs: {
      morph: [
        [2, 0],
        [8, 0],
        [2, 4],
      ], // new positions for each vertex
    },
  },
  {
    selector: "!#tri",
    duration: 2000,
    easing: "easeInOutCubic",
  },
);
```

Chained `Morph` incidents always start from the final position of the previous one — no need to track current positions manually.

## Highlight

Makes an element blink to draw attention. Works on any shape registered in the clip.

```javascript
new McGeom.Highlight(
  {
    animatedAttrs: {
      highlight: {
        numBlinks: 3, // blink cycles over the duration (default: 3)
        color: "#f39c12", // highlight color (default: "#f39c12")
      },
    },
  },
  {
    selector: "!#tri",
    duration: 1500,
  },
);
```

## Rotate

Rotates a shape around a pivot point by an angle in degrees.

```javascript
new McGeom.Rotate(
  {
    animatedAttrs: {
      rotate: {
        angle: 90, // target angle in degrees
        pivot: [5, 2], // [x, y] in board coordinates (default: shape centroid)
      },
    },
  },
  {
    selector: "!#tri",
    duration: 1000,
  },
);
```

## Translate

Moves a shape by a vector `[dx, dy]` in board coordinates.

```javascript
new McGeom.Translate(
  {
    animatedAttrs: {
      translate: [2, -1], // [dx, dy]
    },
  },
  {
    selector: "!#tri",
    duration: 800,
  },
);
```

# Adding Incidents in your clip

```javascript
clip.addIncident(incidentName, startTime);
```

# Contributing

In general, we follow the "fork-and-pull" Git workflow, so if you want to submit patches and additions you should follow the next steps:

1. **Fork** the repo on GitHub
2. **Clone** the project to your own machine
3. **Commit** changes to your own branch
4. **Push** your work back up to your fork
5. Submit a **Pull request** so that we can review your changes

# License

[MIT License](https://opensource.org/licenses/MIT)

# Sponsored by

[<img src="https://presskit.donkeyclip.com/logos/donkey%20clip%20logo.svg" width=250></img>](https://donkeyclip.com)
