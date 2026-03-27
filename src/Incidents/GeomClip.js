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
 *     Renders as a right-angle square marker.
 *
 * All attrs must be JSON-serializable (no class instances).
 *
 * Selectors:
 *   !#idX   — targets a specific entity by id
 *   !.classX — targets all entities with the given class
 *
 * AddElement / RemoveElement support:
 *   Shapes that need animation effects AND dynamic add/remove must be pre-created
 *   in attrs.shapes with { attributes: { visible: false } }. This ensures they are
 *   registered in customEntities at clip-init time, before addIncident is called for
 *   any effects targeting them (ElementSplitter resolves targets at addIncident time).
 *
 *   insertElement detects pre-created shapes and just shows them; it also handles
 *   re-add after backward seek (definition will be the JSXGraph element itself).
 *   deleteElement hides the element and returns it — the framework stores the
 *   reference and passes it back as definition on backward-seek re-add.
 */
export default class GeomClip extends BrowserClip {
  onAfterRender() {
    const container = this.context.rootElement;
    const { offsetWidth, offsetHeight } = container;

    // Set explicit pixel dimensions so JSXGraph reads the correct size
    container.style.width = `${offsetWidth}px`;
    container.style.height = `${offsetHeight}px`;

    const boardAttrs = this.attrs.board || {};
    this.board = JXG.JSXGraph.initBoard(container, {
      boundingbox: [-5, 5, 5, -5],
      axis: false,
      showCopyright: false,
      showNavigation: false,
      ...boardAttrs,
    });

    // id → JSXGraph element; grows as shapes are created (initial + dynamic)
    this._entityMap = {};

    // ── setMCID guard ────────────────────────────────────────────────────────
    // The framework calls context.setMCID(el, mcid) after insertElement returns.
    // For DOM elements that's fine (sets a data-mcid attribute), but JSXGraph
    // objects have their own setAttribute(attrObj) method which crashes when
    // called with two string arguments. JSXGraph entities are already registered
    // via setCustomEntity, so setMCID is a no-op here.
    const _origSetMCID = this.ownContext.setMCID;
    this.ownContext.setMCID = (el, mcid) => {
      // Only forward to the real setMCID for actual DOM nodes (nodeType is a DOM concept)
      if (el && typeof el.nodeType === "number") {
        _origSetMCID(el, mcid);
      }
    };

    // ── getElements patch ────────────────────────────────────────────────────
    // The framework's _getElements returns [undefined] for unknown custom entity
    // selectors (e.g. "!#arm" when 'arm' is pre-created with visible:false but
    // hasn't been shown yet via AddElement). Filtering nullish values makes effects
    // produce 0 targets for absent elements (safe no-op) instead of crashing.
    const _origGetElements = this.ownContext.getElements;
    this.ownContext.getElements = (selector) => {
      const result = _origGetElements(selector);
      return Array.isArray(result) ? result.filter((el) => el != null) : result;
    };

    // ── Initial shapes ───────────────────────────────────────────────────────
    const shapes = this.attrs.shapes || [];
    for (const shape of shapes) {
      const { id, classes = [] } = shape;
      const element = this._createBoardElement(shape);
      if (!element) continue;

      if (id) {
        this._entityMap[id] = element;
        this.setCustomEntity(id, element, classes);
      }
    }

    // Signal that the clip context is ready so Effects can run
    this.contextLoaded();
  }

  /**
   * Creates a JSXGraph board element from a shape descriptor.
   * Resolves string args and special types (angle, angleMarker) against this._entityMap.
   */
  _createBoardElement(shape) {
    const { type, id, args = [], attributes = {} } = shape;

    let resolvedArgs;
    let elementType = type;
    let elementAttrs = attributes;

    if (type === "angle" && shape.vertex !== undefined) {
      resolvedArgs = [
        this._entityMap[shape.from],
        this._entityMap[shape.vertex],
        this._entityMap[shape.to],
      ];
    } else if (type === "angleMarker") {
      elementType = "angle";
      resolvedArgs = [
        this._entityMap[shape.from],
        this._entityMap[shape.vertex],
        this._entityMap[shape.to],
      ];
      elementAttrs = {
        type: "square",
        radius: 0.5,
        fillColor: "#3498db",
        fillOpacity: 0.25,
        strokeColor: "#2980b9",
        strokeWidth: 2,
        withLabel: false,
        ...attributes,
      };
    } else {
      resolvedArgs = args.map((arg) =>
        typeof arg === "string" && this._entityMap[arg]
          ? this._entityMap[arg]
          : arg,
      );
    }

    // Text elements rendered with useHTML:true become floating <div> overlays
    // that don't scale or position correctly inside MC's shadow DOM container.
    // Default to SVG text rendering; callers can override with useHTML:true
    // if they accept the layout limitations that come with it.
    if (elementType === "text" && elementAttrs.useHTML === undefined) {
      elementAttrs = { useHTML: false, ...elementAttrs };
    }

    return this.board.create(elementType, resolvedArgs, {
      ...(id ? { id } : {}),
      ...elementAttrs,
    });
  }

  /**
   * Show a JSXGraph element. Handles polygons whose borders are separate elements.
   */
  _showElement(jsgEl) {
    jsgEl.setAttribute({ visible: true });
    if (jsgEl.elType === "polygon" && jsgEl.borders) {
      for (const border of jsgEl.borders) {
        border.setAttribute({ visible: true });
      }
    }
    jsgEl.board.update();
  }

  /**
   * Hide a JSXGraph element. Handles polygons whose borders are separate elements.
   */
  _hideElement(jsgEl) {
    jsgEl.setAttribute({ visible: false });
    if (jsgEl.elType === "polygon" && jsgEl.borders) {
      for (const border of jsgEl.borders) {
        border.setAttribute({ visible: false });
      }
    }
    jsgEl.board.update();
  }

  /**
   * Called by the framework when an AddElement incident fires, and again on
   * backward-seek re-add.
   *
   * @param {object} definition - shape descriptor config OR the existing JSXGraph
   *                              element (passed back by the framework on re-add)
   * @param {string}   id       - mcid to assign
   * @param {string[]} classes  - class names from AddElement props
   */
  insertElement(definition, id, classes = []) {
    let jsgEl;

    // Re-add after backward seek: definition is the JSXGraph element itself
    // (the framework passes back what deleteElement returned).
    if (
      definition &&
      typeof definition === "object" &&
      definition.elType !== undefined
    ) {
      jsgEl = definition;
    } else if (id && this._entityMap[id]) {
      // Pre-created in attrs.shapes with visible:false — just reuse it.
      jsgEl = this._entityMap[id];
    } else {
      // Truly new element (not pre-created).
      jsgEl = this._createBoardElement(definition);
      if (!jsgEl) return null;
      if (id) this._entityMap[id] = jsgEl;
    }

    this._showElement(jsgEl);
    // Only register if not already present — pre-created shapes are registered
    // in onAfterRender; re-adds retain their registration from the first insertion.
    if (id && !this.context.getElementByMCID?.(id)) {
      this.context.setCustomEntity(id, jsgEl, classes);
    }
    return jsgEl;
  }

  /**
   * Called by the framework when a RemoveElement incident fires.
   *
   * Hides the JSXGraph element without destroying it. Returns the element so
   * the framework can store it and pass it back as definition on backward-seek re-add.
   *
   * @param {string} mcid
   */
  deleteElement(mcid) {
    const wrapper = this.context.getElementByMCID(mcid);
    if (!wrapper) return null;
    // getElementByMCID returns an MCElement wrapper { id, entity, classes, customEntity }
    // for custom entities; the actual JSXGraph element is in .entity.
    const jsgEl = wrapper.entity ?? wrapper;
    this._hideElement(jsgEl);
    return jsgEl;
  }
}
