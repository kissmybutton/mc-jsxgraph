import { Effect } from "@donkeyclip/motorcortex";
import {
  getDefiningPoints,
  setDefiningPoints,
  resolvePivot,
  rotatePoint,
} from "../utils/geometry.js";

/**
 * Transform is a composite Effect that handles translate, rotation, and morph
 * on JSXGraph elements. By grouping them as compositeAttributes, MC ensures
 * they share a single lane and compose correctly.
 *
 * Animated attrs (via compositeAttributes "transform"):
 *   translate {{ x: number, y: number }}  — offset from original position
 *   rotation  {number}                    — degrees, positive = CCW
 *   morph     {Array<[number, number]>}   — absolute target coordinates
 *
 * Composition order:
 *   1. If morph is active, interpolate from base points to morph target
 *   2. Apply translate offset
 *   3. Apply rotation around translated pivot
 */
export default class Transform extends Effect {
  getScratchValue() {
    return {
      translate: { x: 0, y: 0 },
      rotation: 0,
      morph: null,
    };
  }

  onGetContext() {
    this.snapshotPoints = getDefiningPoints(this.element.entity);
    this.pivotPoint = resolvePivot(
      this.attrs.pivot,
      this.element.entity,
      this.snapshotPoints,
    );
  }

  onProgress(millisecond) {
    if (!this.snapshotPoints?.length) return;

    const fraction = this.getFraction(millisecond);

    // ── Translate + Rotate (always needed) ──────────────────────────
    const initT = this.initialValue.translate || { x: 0, y: 0 };
    const targT = this.targetValue.translate || initT;
    const tx = (targT.x - initT.x) * fraction + initT.x;
    const ty = (targT.y - initT.y) * fraction + initT.y;

    const initR = this.initialValue.rotation || 0;
    const targR = this.targetValue.rotation || initR;
    const angle = (targR - initR) * fraction + initR;

    const initM = this.initialValue.morph;
    const targM = this.targetValue.morph;
    const morphActive =
      (targM && Array.isArray(targM)) || (initM && Array.isArray(initM));

    if (morphActive) {
      // ── Morph path ──────────────────────────────────────────────────
      // Morph targets are absolute world-space coordinates. We need to
      // smoothly interpolate from the shape's CURRENT position (which
      // includes translate + rotation applied to snapshotPoints) to the
      // morph target. This avoids any "jump" at fraction=0.

      // 1. Compute the "current position" without morph: snapshot + translate + rotate
      let currentPos = this.snapshotPoints.map(([x, y]) => [x + tx, y + ty]);
      if (angle !== 0) {
        const pivot = [this.pivotPoint[0] + tx, this.pivotPoint[1] + ty];
        currentPos = currentPos.map((p) => rotatePoint(p, pivot, angle));
      }

      // 2. Determine from/to in world space
      const from = initM && Array.isArray(initM) ? initM : currentPos;
      const to = targM && Array.isArray(targM) ? targM : from;

      // 3. Interpolate directly in world space
      const points = from.map(([fx, fy], i) => {
        const [tox, toy] = to[i] || [fx, fy];
        return [fx + (tox - fx) * fraction, fy + (toy - fy) * fraction];
      });

      setDefiningPoints(this.element.entity, points);
    } else {
      // ── Standard translate + rotate path ────────────────────────────
      let points = this.snapshotPoints.map(([x, y]) => [x + tx, y + ty]);

      if (angle !== 0) {
        const pivot = [this.pivotPoint[0] + tx, this.pivotPoint[1] + ty];
        points = points.map((p) => rotatePoint(p, pivot, angle));
      }

      setDefiningPoints(this.element.entity, points);
    }
  }
}
