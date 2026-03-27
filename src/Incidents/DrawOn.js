import { Effect } from "@donkeyclip/motorcortex";
import { getDefiningPoints, setDefiningPoints } from "../utils/geometry.js";

/**
 * DrawOn progressively reveals a JSXGraph path element as if it is being
 * drawn stroke-by-stroke from its first defining point.
 *
 * Works with any shape whose geometry is expressed as an ordered list of
 * defining points (segments, polygons, lines). Arc-length weighting is used
 * for polygons so the pen travels at a visually constant speed regardless of
 * varying edge lengths.
 *
 * animatedAttrs:
 *   drawOn {number}  Progress from 0 (nothing drawn) to 1 (fully drawn).
 *                    Use 0 → 1 to draw in, 1 → 0 to erase.
 *
 * Example:
 *   new McGeom.DrawOn(
 *     { animatedAttrs: { drawOn: 1 } },
 *     { selector: "!#myLine", duration: 1200, easing: "easeInOutQuad" }
 *   )
 *
 *   // Erase
 *   new McGeom.DrawOn(
 *     { animatedAttrs: { drawOn: 0 } },
 *     { selector: "!#myLine", duration: 800 }
 *   )
 */
export default class DrawOn extends Effect {
  getScratchValue() {
    return 0; // not drawn
  }

  onGetContext() {
    // Snapshot the full geometry. For polygons, also compute cumulative
    // arc-length fractions so progress maps to constant visual speed.
    this.points = getDefiningPoints(this.element.entity);
    this.isClosed =
      this.element.entity.elType === "polygon" ||
      this.element.entity.elType === "curve";

    if (this.points.length > 2) {
      this._cumulativeFractions = _buildCumulativeFractions(
        this.points,
        this.isClosed,
      );
    }
  }

  onProgress(millisecond) {
    const fraction = this.getFraction(millisecond);
    const t =
      this.initialValue + (this.targetValue - this.initialValue) * fraction;

    const pts = this.points;
    const n = pts.length;

    if (n === 2) {
      // ── Segment ─────────────────────────────────────────────────────────
      const [p0, p1] = pts;
      const cx = p0[0] + t * (p1[0] - p0[0]);
      const cy = p0[1] + t * (p1[1] - p0[1]);
      setDefiningPoints(this.element.entity, [p0, [cx, cy]]);
    } else {
      // ── Polygon / multi-point path ───────────────────────────────────────
      // Determine how many whole edges have been drawn and the fractional
      // progress into the next edge, using arc-length fractions.
      const cf = this._cumulativeFractions;
      const totalEdges = this.isClosed ? n : n - 1;

      // Find which edge the pen tip is currently on
      let edgeIdx = 0;
      let edgeFrac = 0;

      if (t <= 0) {
        edgeIdx = 0;
        edgeFrac = 0;
      } else if (t >= 1) {
        edgeIdx = totalEdges - 1;
        edgeFrac = 1;
      } else {
        for (let i = 0; i < totalEdges; i++) {
          const lo = cf[i];
          const hi = cf[i + 1];
          if (t <= hi) {
            edgeIdx = i;
            edgeFrac = hi > lo ? (t - lo) / (hi - lo) : 0;
            break;
          }
        }
      }

      // Build the new point array: all complete vertices up to edgeIdx,
      // plus the interpolated tip on the current edge.
      const newPoints = pts.slice(0, edgeIdx + 1);
      const from = pts[edgeIdx];
      const to = pts[(edgeIdx + 1) % n];
      newPoints.push([
        from[0] + edgeFrac * (to[0] - from[0]),
        from[1] + edgeFrac * (to[1] - from[1]),
      ]);

      setDefiningPoints(this.element.entity, newPoints);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build an array of cumulative arc-length fractions [0, …, 1].
 * Length = numEdges + 1 (first entry is always 0, last is always 1).
 */
function _buildCumulativeFractions(pts, closed) {
  const n = pts.length;
  const totalEdges = closed ? n : n - 1;
  const lengths = [];

  for (let i = 0; i < totalEdges; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    lengths.push(Math.sqrt(dx * dx + dy * dy));
  }

  const total = lengths.reduce((s, l) => s + l, 0);
  const cf = [0];
  let acc = 0;
  for (const l of lengths) {
    acc += l / (total || 1);
    cf.push(acc);
  }
  cf[cf.length - 1] = 1; // clamp floating-point drift
  return cf;
}
