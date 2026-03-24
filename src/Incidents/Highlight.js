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
    // this.element is the MotorCortex wrapper; the JSXGraph element is at .entity
    const el = this.element.entity;
    // Capture original visual properties before we start mutating them
    this.origStrokeColor = el.visProp?.strokecolor ?? "#000000";
    this.origFillColor = el.visProp?.fillcolor ?? "#ffffff";
    this.origStrokeWidth = el.visProp?.strokewidth ?? 2;
    this.origSize = el.visProp?.size ?? 3;
    this.hasFill = (el.visProp?.fillopacity ?? 0) > 0;
    this.hasSize = el.visProp?.size !== undefined;
  }

  onProgress(millisecond) {
    const numBlinks = this.targetValue?.numBlinks ?? 3;
    const color = this.targetValue?.color ?? "#f39c12";

    // MotorCortex passes elapsed milliseconds as the first argument.
    // Convert to 0-1 fraction using getFraction (same pattern as motorcortex-threejs).
    const fraction = this.getFraction(millisecond);

    // Sine wave oscillates numBlinks times across the full duration,
    // intensity goes 0 → 1 → 0 for each blink cycle
    const intensity = Math.abs(Math.sin(fraction * Math.PI * numBlinks));
    const isLit = intensity > 0.5;

    const attrs = {
      strokeColor: isLit ? color : this.origStrokeColor,
      strokeWidth: this.origStrokeWidth + intensity * 3,
    };

    if (this.hasSize) {
      attrs.size = this.origSize + intensity * 4;
    }

    if (this.hasFill) {
      attrs.fillColor = isLit ? color : this.origFillColor;
    }

    const el = this.element.entity;
    el.setAttribute(attrs);
    el.board.update();
  }
}
