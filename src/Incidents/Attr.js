import { Effect } from "@donkeyclip/motorcortex";

/**
 * Attr tweens any numeric or color visual property of a JSXGraph element.
 *
 * Works with any attribute that JSXGraph accepts via element.setAttribute():
 *   - Numeric: fillOpacity, strokeOpacity, strokeWidth, size, radius, fontSize
 *   - Color:   fillColor, strokeColor, highlightFillColor, highlightStrokeColor
 *
 * MC automatically dissolves the incident into one mono-incident per
 * (element × animatedAttr) pair. Each mono-incident handles one attribute
 * on one element, so this class only needs to implement the per-tick logic.
 *
 * animatedAttrs keys are JSXGraph attribute names (camelCase or lowercase —
 * JSXGraph normalises internally).
 *
 * Example:
 *   new McGeom.Attr(
 *     { animatedAttrs: { fillOpacity: 0.6, strokeWidth: 4, fillColor: "#e74c3c" } },
 *     { selector: "!#tri", duration: 1000 }
 *   )
 */
export default class Attr extends Effect {
  getScratchValue() {
    // If an explicit fromValues map was provided at construction time, use it.
    // This is necessary for blink incidents where getScratchValue may be called
    // lazily (at seek time), after the visProp has been restored to its original
    // hidden state — making the live visProp read unreliable as a FROM source.
    const fromValues = this.attrs?.fromValues;
    if (
      fromValues &&
      Object.prototype.hasOwnProperty.call(fromValues, this.attributeKey)
    ) {
      return fromValues[this.attributeKey];
    }

    const el = this.element.entity;
    // JSXGraph stores all visual properties lowercased in visProp
    const key = this.attributeKey.toLowerCase();

    // glow is a reserved internal attribute (not a JSXGraph visProp).
    // Initialise it to 0 on first read so the MC chain starts clean.
    if (key === "glow") {
      if (el.visProp && !("glow" in el.visProp)) el.visProp.glow = 0;
      return el.visProp?.glow ?? 0;
    }

    const val = el.visProp?.[key];
    // For color keys, always return a valid hex string — "none"/"transparent"/undefined
    // would crash the color interpolation or cause MC to reject the scratch value.
    if (_isColorKey(this.attributeKey)) {
      return typeof val === "string" && val.startsWith("#") ? val : "#000000";
    }
    return val ?? 0;
  }

  onProgress(millisecond) {
    const fraction = this.getFraction(millisecond);
    const from = this.initialValue;
    const to = this.targetValue;

    let value;
    if (_isColorKey(this.attributeKey)) {
      const fromStr = typeof from === "string" ? from : "#000000";
      const toStr = typeof to === "string" ? to : "#000000";
      value = _lerpColor(fromStr, toStr, fraction);
    } else if (typeof from === "number" && typeof to === "number") {
      value = from + (to - from) * fraction;
    } else {
      // Can't interpolate non-numeric, non-color — just set target
      value = fraction >= 0.5 ? to : from;
    }

    const el = this.element.entity;
    const cacheKey = this.attributeKey.toLowerCase();

    // Keep JSXGraph's internal state in sync so seeks and board.update() calls
    // from outside (e.g. user interaction) render the correct value.
    if (el.visProp) el.visProp[cacheKey] = value;
    if (el.visPropOld) el.visPropOld[cacheKey] = undefined;

    // Directly apply to the SVG node — bypasses JSXGraph's setAttribute +
    // board.update() pipeline which defers rendering and was causing no-op frames.
    _applyToRendNode(el.rendNode, this.attributeKey, value);

    // Labels: sync visibility with element opacity so labeled points
    // appear/disappear correctly when animated via strokeOpacity/fillOpacity.
    if (el.label) {
      const k = this.attributeKey;
      if (k === "strokeOpacity" || k === "fillOpacity") {
        const lrn = el.label.rendNode;
        if (lrn) lrn.style.display = value > 0 ? "" : "none";
      }
    }

    // Polygons: propagate strokeOpacity/strokeWidth to border segments so that
    // fade-in and disappear affect the visible cell borders.
    // fillColor and strokeColor are NOT propagated — polygon borders keep their
    // original color regardless of fill changes (recolor, highlight).
    if (el.elType === "polygon" && el.borders) {
      const k = this.attributeKey;
      if (k === "strokeOpacity" || k === "strokeWidth") {
        for (const border of el.borders) {
          if (border.visProp) border.visProp[cacheKey] = value;
          if (border.visPropOld) border.visPropOld[cacheKey] = undefined;
          _applyToRendNode(border.rendNode, k, value);
        }
      }
    }
  }
}

// ─── Direct SVG rendering ─────────────────────────────────────────────────────

/**
 * Apply a JSXGraph attribute value directly to an SVG rendNode,
 * bypassing JSXGraph's board.update() pipeline.
 */
function _applyToRendNode(rn, key, value) {
  if (!rn) return;

  // glow: CSS drop-shadow highlight — reserved for internal use, never exposed to LLM.
  // Works on both SVG and HTML rendNodes via style.filter.
  if (key === "glow") {
    rn.style.filter =
      value > 0.001
        ? `drop-shadow(0px 0px ${value * 8}px rgba(210, 40, 130, 1)) drop-shadow(0px 0px ${value * 30}px rgba(210, 40, 130, ${Math.min(value * 1.4, 1)}))`
        : "";
    return;
  }

  // JSXGraph text elements render as positioned HTML <div> overlays even in
  // SVG mode. SVG attribute-setting has no effect on HTML elements, so we
  // must use CSS styles instead.
  if (rn.namespaceURI !== "http://www.w3.org/2000/svg") {
    switch (key) {
      case "strokeOpacity":
      case "fillOpacity":
        rn.style.opacity = String(value);
        break;
      case "strokeColor":
        rn.style.color = value;
        break;
      case "fillColor":
        rn.style.backgroundColor = value;
        break;
    }
    return;
  }

  switch (key) {
    case "fillOpacity":
      rn.setAttribute("fill-opacity", String(value));
      break;
    case "strokeOpacity":
      rn.setAttribute("stroke-opacity", String(value));
      break;
    case "strokeWidth":
      rn.setAttribute("stroke-width", String(value));
      break;
    case "fillColor":
      rn.setAttribute("fill", value);
      break;
    case "strokeColor":
      rn.setAttribute("stroke", value);
      break;
    case "size":
      // JSXGraph point (face:'o') renders as <ellipse> with rx/ry = visProp.size
      rn.setAttribute("rx", String(value));
      rn.setAttribute("ry", String(value));
      break;
    default:
      // For any other attr, fall back to setAttribute + board.update()
      // (rare path: fontSize, size, radius, etc. need JSXGraph's geometry pipeline)
      break;
  }
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function _isColorKey(key) {
  return key.toLowerCase().includes("color");
}

function _parseHex(hex) {
  if (!hex || typeof hex !== "string" || !hex.match(/^#?[0-9a-fA-F]{3,6}$/)) {
    return [0, 0, 0]; // fallback for "none", "transparent", or invalid values
  }
  const h = hex.replace("#", "");
  return h.length === 3
    ? [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
      ]
    : [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
}

function _lerpColor(from, to, t) {
  const [fr, fg, fb] = _parseHex(from);
  const [tr, tg, tb] = _parseHex(to);
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}
