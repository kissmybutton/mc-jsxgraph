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
 *     - args       {Array}    Second argument passed verbatim to board.create(type, args, attributes).
 *                             Must match what JSXGraph expects, e.g. [-3, 0] for a point, ["A","B","C"] for a polygon.
 *                             String values are resolved to previously created entities by id.
 *     - attributes {object}   JSXGraph element attributes (color, size, label, etc.)
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

      const resolvedArgs = args.map((arg) =>
        typeof arg === "string" && entityMap[arg] ? entityMap[arg] : arg,
      );

      const element = this.board.create(type, resolvedArgs, {
        ...(id ? { id } : {}),
        ...attributes,
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
