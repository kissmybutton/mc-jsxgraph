import { Effect } from "@donkeyclip/motorcortex";
import { getDefiningPoints, setDefiningPoints } from "../utils/geometry.js";

/**
 * Translate animates the movement of a JSXGraph shape (segment or polygon).
 *
 * animatedAttrs:
 *   translate {{ x: number, y: number }}
 *             Offset from the shape's drawn position in user (JSXGraph) coordinates.
 *             { x: 0, y: 0 } = drawn position (default / scratch).
 *             Positive x → right, positive y → up (JSXGraph math convention).
 *
 * Example:
 *   new McGeom.Translate(
 *     { animatedAttrs: { translate: { x: 3, y: 1 } } },
 *     { selector: "!#myLine", duration: 1500 }
 *   )
 *
 *   // Chain: move further to { x: 5, y: 1 } from drawn position
 *   new McGeom.Translate(
 *     { animatedAttrs: { translate: { x: 5, y: 1 } } },
 *     { selector: "!#myLine", duration: 1000 }
 *   )
 */
export default class Translate extends Effect {
  /**
   * No translation applied when the shape first enters the stage.
   */
  getScratchValue() {
    return { x: 0, y: 0 };
  }

  /**
   * Snapshot the original point positions at build time.
   */
  onGetContext() {
    this.snapshotPoints = getDefiningPoints(this.element.entity);
  }

  onProgress(millisecond) {
    if (!this.snapshotPoints?.length) return; // entity not yet available or unsupported type
    const fraction = this.getFraction(millisecond);
    const tx =
      (this.targetValue.x - this.initialValue.x) * fraction +
      this.initialValue.x;
    const ty =
      (this.targetValue.y - this.initialValue.y) * fraction +
      this.initialValue.y;
    const newPoints = this.snapshotPoints.map(([x, y]) => [x + tx, y + ty]);
    setDefiningPoints(this.element.entity, newPoints);
  }
}
