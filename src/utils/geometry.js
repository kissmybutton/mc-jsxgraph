import JXG from "jsxgraph";

/**
 * Returns the defining free points of a JSXGraph element as plain [x, y] pairs.
 * Supported types: point, segment, line, arrow, polygon.
 */
export function getDefiningPoints(el) {
  const t = el.elType;
  if (t === "point") {
    return [[el.X(), el.Y()]];
  }
  if (t === "segment" || t === "line" || t === "arrow") {
    return [
      [el.point1.X(), el.point1.Y()],
      [el.point2.X(), el.point2.Y()],
    ];
  }
  if (t === "polygon") {
    // vertices has a closing duplicate — drop it
    return el.vertices.slice(0, -1).map((v) => [v.X(), v.Y()]);
  }
  throw new Error(`mc-jsxgraph: unsupported element type "${t}"`);
}

/**
 * Pushes an array of [x, y] pairs back into the JSXGraph element's defining points
 * and triggers a board update.
 */
export function setDefiningPoints(el, points) {
  const t = el.elType;
  if (t === "point") {
    el.setPosition(JXG.COORDS_BY_USER, points[0]);
  } else if (t === "segment" || t === "line" || t === "arrow") {
    el.point1.setPosition(JXG.COORDS_BY_USER, points[0]);
    el.point2.setPosition(JXG.COORDS_BY_USER, points[1]);
  } else if (t === "polygon") {
    el.vertices.slice(0, -1).forEach((v, i) => {
      v.setPosition(JXG.COORDS_BY_USER, points[i]);
    });
  }
  el.board.update();
}

/**
 * Resolves the pivot for Rotate into an absolute [x, y] coordinate.
 *
 * Accepted forms:
 *   "center" | "centroid"  — geometric centroid of the shape's defining points (default)
 *   "start"                — first defining point
 *   "end"                  — last defining point
 *   "<entityId>"           — any named entity registered on the board (e.g. "O", "A")
 *   [x, y]                 — absolute user coordinate
 */
export function resolvePivot(pivot, el, snapshotPoints) {
  // Default
  if (
    pivot === undefined ||
    pivot === null ||
    pivot === "center" ||
    pivot === "centroid"
  ) {
    return centroid(snapshotPoints);
  }

  if (pivot === "start") return snapshotPoints[0];
  if (pivot === "end") return snapshotPoints[snapshotPoints.length - 1];

  // Absolute coordinate
  if (Array.isArray(pivot)) return pivot;

  // Named entity id — look up on the board
  if (typeof pivot === "string") {
    const entity = el.board.objects[pivot];
    if (!entity || typeof entity.X !== "function") {
      throw new Error(
        `mc-jsxgraph Rotate: pivot entity "${pivot}" not found on board`,
      );
    }
    return [entity.X(), entity.Y()];
  }

  return centroid(snapshotPoints);
}

function centroid(points) {
  const n = points.length;
  return [
    points.reduce((s, p) => s + p[0], 0) / n,
    points.reduce((s, p) => s + p[1], 0) / n,
  ];
}

/**
 * Rotates a single [x, y] point around a pivot [px, py] by angleDeg degrees.
 * Positive angles rotate counter-clockwise (standard math orientation).
 */
export function rotatePoint([x, y], [px, py], angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - px;
  const dy = y - py;
  return [px + dx * cos - dy * sin, py + dx * sin + dy * cos];
}
