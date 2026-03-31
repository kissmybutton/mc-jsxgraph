import { Effect } from "@donkeyclip/motorcortex";

/**
 * Highlight is a custom Effect that makes a JSXGraph element blink to draw
 * attention to it. Works with any shape registered via setCustomEntity
 * (points, lines, circles, polygons, etc.).
 *
 * animatedAttrs:
 *   highlight {object}
 *     - numBlinks {number}  How many blink cycles over the duration (default: 3)
 *     - color     {string}  Highlight color (default: "#f39c12")
 *
 * Example usage:
 *   new McGeom.Highlight(
 *     { animatedAttrs: { highlight: { numBlinks: 3, color: "#e74c3c" } } },
 *     { selector: "!#A", duration: 1500 }
 *   )
 */
export default class Highlight extends Effect {
  getScratchValue() {
    return 0;
  }

  onGetContext() {
    // Capture initial state — used as fallback
    const el = this.element.entity;
    this._initStrokeColor = el.visProp?.strokecolor ?? "#000000";
    this._initFillColor = el.visProp?.fillcolor ?? "#ffffff";
    this._initStrokeWidth = el.visProp?.strokewidth ?? 2;
    this._initSize = el.visProp?.size ?? 3;
  }

  onProgress(millisecond) {
    const el = this.element.entity;
    if (!el) return;

    const numBlinks = this.targetValue?.numBlinks ?? 3;
    const color = this.targetValue?.color ?? "#f39c12";
    const fraction = this.getFraction(millisecond);

    // Read CURRENT visual properties (not snapshot) so highlight works
    // correctly after recolor/appear have already modified the element
    const curStrokeColor = el.visProp?.strokecolor ?? this._initStrokeColor;
    const curFillColor = el.visProp?.fillcolor ?? this._initFillColor;
    const curStrokeWidth = el.visProp?.strokewidth ?? this._initStrokeWidth;
    const curSize = el.visProp?.size ?? this._initSize;
    const hasFill = (el.visProp?.fillopacity ?? 0) > 0;
    const hasSize = el.visProp?.size !== undefined;

    // On the very first call, snapshot the "pre-blink" state so we can
    // restore it. Only snapshot once per highlight cycle.
    if (!this._blinkBaseSet) {
      this._blinkBaseStroke = curStrokeColor;
      this._blinkBaseFill = curFillColor;
      this._blinkBaseWidth = curStrokeWidth;
      this._blinkBaseSize = curSize;
      this._blinkBaseSet = true;
    }

    const mode = this.targetValue?.mode ?? "blink";

    if (mode === "appear") {
      // Appear mode: 2 blinks via visibility toggle.
      // 0-25% visible, 25-50% hidden, 50-75% visible, 75-100% hidden.
      // After the effect ends, the element stays at its final opacity
      // (set to 1 by a companion Attr incident from clipController).
      const quarter = Math.floor(fraction * 4); // 0,1,2,3
      const show = quarter === 0 || quarter === 2 || fraction >= 1;
      el.setAttribute({
        strokeOpacity: show ? 1 : 0,
        fillOpacity: show ? 1 : 0,
      });
      // Polygon borders
      if (el.elType === "polygon" && el.borders) {
        for (const border of el.borders) {
          border.setAttribute({ strokeOpacity: show ? 1 : 0 });
        }
      }
      // At end of animation: ensure fully visible
      if (fraction >= 1) {
        el.setAttribute({ strokeOpacity: 1, fillOpacity: 1 });
        if (el.elType === "polygon" && el.borders) {
          for (const border of el.borders) {
            border.setAttribute({ strokeOpacity: 1 });
          }
        }
      }
      el.board.update();
      return;
    }

    // Standard blink mode: crisp on/off toggle (same pattern as appear).
    // Each blink = 2 segments (on + off). Total segments = numBlinks * 2.
    const totalSegments = numBlinks * 2;
    const segment = Math.floor(fraction * totalSegments);
    const isLit = segment % 2 === 0 && fraction < 1; // even segments = lit

    const attrs = {
      strokeColor: isLit ? color : this._blinkBaseStroke,
      strokeWidth: isLit ? this._blinkBaseWidth + 3 : this._blinkBaseWidth,
      strokeOpacity: isLit ? 1 : 0,
      fillOpacity: isLit ? 1 : 0,
    };

    if (hasSize) {
      attrs.size = isLit ? this._blinkBaseSize + 4 : this._blinkBaseSize;
    }

    if (hasFill) {
      attrs.fillColor = isLit ? color : this._blinkBaseFill;
    }

    el.setAttribute(attrs);
    // Polygon borders
    if (el.elType === "polygon" && el.borders) {
      for (const border of el.borders) {
        border.setAttribute({ strokeOpacity: isLit ? 1 : 0 });
      }
    }

    // At end: restore base state and ensure opacity=1
    if (fraction >= 1) {
      el.setAttribute({
        strokeColor: this._blinkBaseStroke,
        strokeWidth: this._blinkBaseWidth,
        strokeOpacity: 1,
        fillOpacity: 1,
      });
      if (hasFill) el.setAttribute({ fillColor: this._blinkBaseFill });
      if (hasSize) el.setAttribute({ size: this._blinkBaseSize });
      if (el.elType === "polygon" && el.borders) {
        for (const border of el.borders) {
          border.setAttribute({ strokeOpacity: 1 });
        }
      }
      this._blinkBaseSet = false;
    }

    el.board.update();
  }
}
