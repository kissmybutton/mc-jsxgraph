import { Effect } from "@donkeyclip/motorcortex";
import { getDefiningPoints, setDefiningPoints } from "../utils/geometry.js";

/**
 * Morph animates a JSXGraph shape by interpolating each defining point from
 * its current position to an explicitly specified target position.
 *
 * This is the most general transformation incident — rotate, translate, scale,
 * skew or any combination can be expressed by simply describing where each
 * point should end up. MC tracks the value between chained incidents so the
 * shape always continues from where the previous animation left it.
 *
 * Constraint: target must have the same number of points as the shape.
 *
 * animatedAttrs:
 *   morph {Array<[number, number]>}
 *         Target positions of all defining points in JSXGraph user coordinates.
 *         Segment → 2 points. Polygon with N vertices → N points.
 *
 * Example:
 *   // Stretch and tilt a segment
 *   new McGeom.Morph(
 *     { animatedAttrs: { morph: [[-3, 0], [3, 2]] } },
 *     { selector: "!#myLine", duration: 1500 }
 *   )
 *
 *   // Skew a rectangle into a parallelogram
 *   new McGeom.Morph(
 *     { animatedAttrs: { morph: [[1,0],[4,0],[5,3],[2,3]] } },
 *     { selector: "!#myRect", duration: 2000 }
 *   )
 */
export default class Morph extends Effect {
  /**
   * null signals "use the drawn positions" — resolved in onProgress via
   * snapshotPoints so MC can still track the value chain from the first
   * animation onward.
   */
  getScratchValue() {
    return null;
  }

  /**
   * Snapshot the original drawn positions at build time.
   * Also validate point-count parity with the target value.
   */
  onGetContext() {
    this.snapshotPoints = getDefiningPoints(this.element.entity);
    if (
      this.targetValue !== null &&
      this.targetValue.length !== this.snapshotPoints.length
    ) {
      throw new Error(
        `mc-jsxgraph Morph: target has ${this.targetValue.length} points ` +
          `but "${this.element.entity.elType}" has ${this.snapshotPoints.length}. ` +
          `Morph requires matching point counts.`,
      );
    }
  }

  onProgress(millisecond) {
    const fraction = this.getFraction(millisecond);
    // initialValue is null only for the very first incident (scratch).
    // From the second incident onward MC provides the previous targetValue.
    const from = this.initialValue ?? this.snapshotPoints;
    const to = this.targetValue;
    const newPoints = from.map(([fx, fy], i) => {
      const [tx, ty] = to[i];
      return [fx + (tx - fx) * fraction, fy + (ty - fy) * fraction];
    });
    setDefiningPoints(this.element.entity, newPoints);
  }
}
