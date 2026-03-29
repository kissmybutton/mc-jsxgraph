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

    // ── Morph: interpolate base points toward target coordinates ──────
    const initM = this.initialValue.morph;
    const targM = this.targetValue.morph;
    let basePoints;

    if (targM && Array.isArray(targM)) {
      // Morph from initial morph state (or snapshot) to target morph state
      const from = initM && Array.isArray(initM) ? initM : this.snapshotPoints;
      basePoints = from.map(([fx, fy], i) => {
        const [tx, ty] = targM[i] || [fx, fy];
        return [fx + (tx - fx) * fraction, fy + (ty - fy) * fraction];
      });
    } else if (initM && Array.isArray(initM)) {
      // Previous morph target is the new base (no new morph target)
      basePoints = initM;
    } else {
      basePoints = this.snapshotPoints;
    }

    // ── Translate ─────────────────────────────────────────────────────
    const initT = this.initialValue.translate || { x: 0, y: 0 };
    const targT = this.targetValue.translate || initT;
    const tx = (targT.x - initT.x) * fraction + initT.x;
    const ty = (targT.y - initT.y) * fraction + initT.y;

    let points = basePoints.map(([x, y]) => [x + tx, y + ty]);

    // ── Rotate ────────────────────────────────────────────────────────
    const initR = this.initialValue.rotation || 0;
    const targR = this.targetValue.rotation || initR;
    const angle = (targR - initR) * fraction + initR;

    if (angle !== 0) {
      // Pivot translates with the shape
      const pivot = [this.pivotPoint[0] + tx, this.pivotPoint[1] + ty];
      points = points.map((p) => rotatePoint(p, pivot, angle));
    }

    setDefiningPoints(this.element.entity, points);
  }
}
