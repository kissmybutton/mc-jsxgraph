import { BrowserClip } from "@donkeyclip/motorcortex";
import JXG from "jsxgraph";

/**
 * GeomClip is a custom BrowserClip that renders a JSXGraph board
 * and populates it with geometric shapes defined declaratively via attrs.
 *
 * Attrs:
 *   board   {object}  JSXGraph board options (e.g. boundingbox, axis)
 *   shapes  {Array}   List of shape descriptors to draw, each with:
 *     - type       {string}   JSXGraph element type ('point', 'line', 'circle', etc.)
 *     - id         {string}   Unique identifier; used for setCustomEntity and cross-references
 *     - classes    {string[]} Optional class names for MotorCortex selector targeting (!.class)
 *     - args       {Array}    Positional args passed to board.create(type, args, attributes).
 *                             String values are resolved to previously created entities by id.
 *     - attributes {object}   JSXGraph element attributes (color, size, label, etc.)
 *
 *
 *   Two high-level shape types are provided so no JSXGraph internals are needed:
 *
 *   type: "angle"
 *     - vertex  {string}  Id of the point at the angle vertex
 *     - from    {string}  Id of a point on the first ray
 *     - to      {string}  Id of a point on the second ray
 *     Renders as a sector arc showing the opening angle.
 *
 *   type: "angleMarker"
 *     Same vertex/from/to API as "angle".
 *     Renders as a right-angle square marker — no JSXGraph attributes needed.
 *
 * All attrs must be JSON-serializable (no class instances).
 *
 * Selectors:
 *   !#idX   — targets a specific entity by id
 *   !.classX — targets all entities with the given class
 */
export default class GeomClip extends BrowserClip {
  onAfterRender() {
    const container = this.context.rootElement;
    const { offsetWidth, offsetHeight } = container;

    // Set explicit pixel dimensions so JSXGraph reads the correct size
    container.style.width = `${offsetWidth}px`;
    container.style.height = `${offsetHeight}px`;

    const boardAttrs = this.attrs.board || {};
    // Pass the DOM element directly — avoids document.getElementById which
    // fails when the clip renders inside an iframe or shadow DOM
    this.board = JXG.JSXGraph.initBoard(container, {
      boundingbox: [-5, 5, 5, -5],
      axis: false,
      showCopyright: false,
      showNavigation: false,
      ...boardAttrs,
    });

    // Resolve previously created entities by id so shapes can reference each other
    const entityMap = {};

    const shapes = this.attrs.shapes || [];
    for (const shape of shapes) {
      const { type, id, classes = [], args = [], attributes = {} } = shape;

      // Resolve element type and args
      let resolvedArgs;
      let elementType = type;
      let elementAttrs = attributes;

      if (type === "angle" && shape.vertex !== undefined) {
        // Named API: angle arc
        resolvedArgs = [
          entityMap[shape.from],
          entityMap[shape.vertex],
          entityMap[shape.to],
        ];
      } else if (type === "angleMarker") {
        // Named API: right-angle square marker — no JSXGraph knowledge needed
        elementType = "angle";
        resolvedArgs = [
          entityMap[shape.from],
          entityMap[shape.vertex],
          entityMap[shape.to],
        ];
        elementAttrs = {
          type: "square",
          radius: 0.3,
          fillColor: "#e74c3c",
          fillOpacity: 0.15,
          strokeColor: "#e74c3c",
          strokeWidth: 2,
          withLabel: false,
          ...attributes, // caller can still override any default
        };
      } else {
        resolvedArgs = args.map((arg) =>
          typeof arg === "string" && entityMap[arg] ? entityMap[arg] : arg,
        );
      }

      const element = this.board.create(elementType, resolvedArgs, {
        ...(id ? { id } : {}),
        ...elementAttrs,
      });

      if (id) {
        entityMap[id] = element;
        this.setCustomEntity(id, element, classes);
      }
    }

    // Signal that the clip context is ready so Effects can run
    this.contextLoaded();
  }
}
