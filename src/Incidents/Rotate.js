import { Effect } from "@donkeyclip/motorcortex";
import {
  getDefiningPoints,
  resolvePivot,
  rotatePoint,
  setDefiningPoints,
} from "../utils/geometry.js";

/**
 * Rotate animates the rotation of a JSXGraph shape (segment or polygon) around
 * a configurable anchor point.
 *
 * animatedAttrs:
 *   rotation {number}  Target rotation in degrees from the shape's drawn state (0°).
 *                      Positive = counter-clockwise (JSXGraph math convention).
 *
 * Static attrs:
 *   pivot  Anchor point for rotation. Accepted forms:
 *           "center" | "centroid"  — geometric centroid (default)
 *           "start"                — first defining point of the shape
 *           "end"                  — last defining point of the shape
 *           "<entityId>"           — any named entity on the board, e.g. "O" or "A"
 *           [x, y]                 — absolute user coordinate
 *
 * Example:
 *   new McGeom.Rotate(
 *     { animatedAttrs: { rotation: 90 } },
 *     { selector: "!#myLine", duration: 1500 }
 *   )
 *
 *   // Rotate around the entity named "O"
 *   new McGeom.Rotate(
 *     { animatedAttrs: { rotation: 90 }, pivot: "O" },
 *     { selector: "!#arm", duration: 2000 }
 *   )
 *
 *   // Rotate around the segment's start point
 *   new McGeom.Rotate(
 *     { animatedAttrs: { rotation: 45 }, pivot: "start" },
 *     { selector: "!#myRect", duration: 2000 }
 *   )
 */
export default class Rotate extends Effect {
  /**
   * Rotation starts at 0° for every shape when it first enters the stage.
   */
  getScratchValue() {
    return 0;
  }

  /**
   * Snapshot the original point positions at build time and resolve the pivot.
   */
  onGetContext() {
    const el = this.element.entity;
    this.snapshotPoints = getDefiningPoints(el);
    this.pivotPoint = resolvePivot(this.attrs.pivot, el, this.snapshotPoints);
  }

  onProgress(millisecond) {
    if (!this.snapshotPoints?.length) return; // entity not yet available or unsupported type
    const fraction = this.getFraction(millisecond);
    const deltaAngle =
      (this.targetValue - this.initialValue) * fraction + this.initialValue;
    const el = this.element.entity;
    const newPoints = this.snapshotPoints.map((p) =>
      rotatePoint(p, this.pivotPoint, deltaAngle),
    );
    setDefiningPoints(el, newPoints);
  }
}
