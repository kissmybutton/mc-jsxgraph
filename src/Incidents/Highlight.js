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

    const intensity = Math.abs(Math.sin(fraction * Math.PI * numBlinks));
    const isLit = intensity > 0.5;

    const attrs = {
      strokeColor: isLit ? color : this._blinkBaseStroke,
      strokeWidth: this._blinkBaseWidth + intensity * 3,
    };

    if (hasSize) {
      attrs.size = this._blinkBaseSize + intensity * 4;
    }

    if (hasFill) {
      attrs.fillColor = isLit ? color : this._blinkBaseFill;
    }

    el.setAttribute(attrs);
    el.board.update();

    // Reset snapshot flag at end of highlight so next highlight re-reads
    if (fraction >= 1) {
      this._blinkBaseSet = false;
    }
  }
}
