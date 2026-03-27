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
    const el = this.element.entity;
    // JSXGraph stores all visual properties lowercased in visProp
    const key = this.attributeKey.toLowerCase();
    return el.visProp?.[key] ?? null;
  }

  onProgress(millisecond) {
    const fraction = this.getFraction(millisecond);
    const from = this.initialValue;
    const to = this.targetValue;

    let value;
    if (
      _isColorKey(this.attributeKey) &&
      typeof from === "string" &&
      typeof to === "string"
    ) {
      value = _lerpColor(from, to, fraction);
    } else {
      value = from + (to - from) * fraction;
    }

    const el = this.element.entity;
    el.setAttribute({ [this.attributeKey]: value });
    el.board.update();
  }
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function _isColorKey(key) {
  return key.toLowerCase().includes("color");
}

function _parseHex(hex) {
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
