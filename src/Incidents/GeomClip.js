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
  get html() {
    return `<div style="width:100%;height:100%;"></div>`;
  }

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
      keepaspectratio: true,
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
        // Always include "shape" class so !.shape selects all entities at once
        const allClasses = classes.includes("shape")
          ? classes
          : [...classes, "shape"];
        this.setCustomEntity(id, element, allClasses);
      }
    }

    // Signal that the clip context is ready so Effects can run
    this.contextLoaded();

    // Register this instance so ClipController can reach it for dynamic
    // addShape calls. MC wraps GeomClip in its own clip manager and doesn't
    // expose the inner instance, so we use a well-known global as a bridge.
    // eslint-disable-next-line no-undef
    if (typeof globalThis !== "undefined") {
      // eslint-disable-next-line no-undef
      globalThis.__activeGeomClip = this;
    }
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
      let fromPt = this._entityMap[shape.from];
      const vertexPt = this._entityMap[shape.vertex];
      let toPt = this._entityMap[shape.to];
      // Ensure we draw the minor (smaller) angle by default.
      // JSXGraph draws CCW from→vertex→to. If the CCW sweep is > 180°
      // (reflex), swap from and to to get the minor angle.
      if (fromPt && vertexPt && toPt) {
        const vx = vertexPt.X(),
          vy = vertexPt.Y();
        const a1 = Math.atan2(fromPt.Y() - vy, fromPt.X() - vx);
        const a2 = Math.atan2(toPt.Y() - vy, toPt.X() - vx);
        let ccw = a2 - a1;
        if (ccw < 0) ccw += 2 * Math.PI;
        if (ccw > Math.PI) {
          // Swap to get the minor angle
          [fromPt, toPt] = [toPt, fromPt];
        }
      }
      resolvedArgs = [fromPt, vertexPt, toPt];
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
      // Resolve string args from entityMap first, then fall back to board.objects
      // (covers cases where a point was created on the board but an error prevented
      // it from being stored in _entityMap).
      resolvedArgs = args.map((arg) => {
        if (typeof arg !== "string") return arg;
        const fromMap = this._entityMap[arg];
        const fromBoard = this.board?.objects?.[arg];
        if (!fromMap && !fromBoard) {
          console.warn(
            `[_createBoardElement] ref "${arg}" not in _entityMap (${Object.keys(this._entityMap).length} keys) nor board.objects`,
          );
        }
        return fromMap || fromBoard || arg;
      });
    }

    // Text elements rendered with useHTML:true become floating <div> overlays
    // that don't scale or position correctly inside MC's shadow DOM container.
    // Default to SVG text rendering; callers can override with useHTML:true
    // if they accept the layout limitations that come with it.
    if (elementType === "text" && elementAttrs.useHTML === undefined) {
      elementAttrs = { useHTML: false, ...elementAttrs };
    }

    // Validate that all point references resolved. Unresolved string args
    // would crash JSXGraph when it tries to read usrCoords on undefined.
    if (
      elementType === "segment" ||
      elementType === "line" ||
      elementType === "arrow"
    ) {
      for (let i = 0; i < resolvedArgs.length; i++) {
        if (typeof resolvedArgs[i] === "string") {
          console.warn(
            `mc-jsxgraph: ${elementType} "${id}" references unknown point "${resolvedArgs[i]}". ` +
              `Make sure points are added before shapes that reference them.`,
          );
          return null;
        }
      }
    }

    return this.board.create(elementType, resolvedArgs, {
      ...(id ? { id } : {}),
      ...elementAttrs,
    });
  }

  // ── addCustomEntity API (MC v1) ──────────────────────────────────────────
  // These three methods are called by MC's addCustomEntity / VisibilityChannel.

  /**
   * Called by MC's addCustomEntity to create a JSXGraph element from a definition.
   * @param {object} definition - shape descriptor (same format as attrs.shapes items)
   * @returns the JSXGraph element, or null on failure
   */
  renderCustomEntity(definition) {
    const element = this._createBoardElement(definition);
    if (!element) {
      console.warn(
        `[renderCustomEntity] _createBoardElement returned null for "${definition.id}" (type: ${definition.type})`,
      );
      return null;
    }
    if (definition.id) {
      this._entityMap[definition.id] = element;
    }
    // Polygon borders are auto-created by JSXGraph with default opacity (1).
    // If the polygon is preloaded (opacity 0), sync borders to match —
    // otherwise showElement at birthtime flashes the borders at full opacity
    // before the appear() animation kicks in.
    if (element.elType === "polygon" && element.borders) {
      const attrs = definition.attributes || {};
      if (attrs.strokeOpacity === 0) {
        for (const border of element.borders) {
          border.setAttribute({ strokeOpacity: 0 });
        }
      }
      if (attrs.fillOpacity === 0) {
        for (const border of element.borders) {
          border.setAttribute({ fillOpacity: 0 });
        }
      }
    }
    return element;
  }

  /**
   * Called by MC's VisibilityChannel to show a previously hidden element.
   * @param {object} jsgEl - JSXGraph element
   */
  showElement(jsgEl) {
    this._showElement(jsgEl);
  }

  /**
   * Called by MC's VisibilityChannel to hide an element.
   * @param {object} jsgEl - JSXGraph element
   */
  hideElement(jsgEl) {
    this._hideElement(jsgEl);
  }

  /**
   * Show a JSXGraph element. Handles polygons whose borders are separate elements.
   */
  _showElement(jsgEl) {
    // setAttribute updates visProp.visible so board.update() preserves state.
    // setDisplayRendNode directly sets the SVG node display as extra insurance.
    jsgEl.setAttribute({ visible: true });
    if (typeof jsgEl.setDisplayRendNode === "function") {
      jsgEl.setDisplayRendNode(true);
    }
    if (jsgEl.elType === "polygon" && jsgEl.borders) {
      for (const border of jsgEl.borders) {
        border.setAttribute({ visible: true });
        if (typeof border.setDisplayRendNode === "function") {
          border.setDisplayRendNode(true);
        }
      }
    }
    jsgEl.board.update();
  }

  /**
   * Hide a JSXGraph element. Handles polygons whose borders are separate elements.
   */
  _hideElement(jsgEl) {
    jsgEl.setAttribute({ visible: false });
    if (typeof jsgEl.setDisplayRendNode === "function") {
      jsgEl.setDisplayRendNode(false);
    }
    if (jsgEl.elType === "polygon" && jsgEl.borders) {
      for (const border of jsgEl.borders) {
        border.setAttribute({ visible: false });
        if (typeof border.setDisplayRendNode === "function") {
          border.setDisplayRendNode(false);
        }
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
    let isFirstCreation = false;

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
      isFirstCreation = true;
    }

    // On first creation, respect the definition's own attributes (e.g. visible:false,
    // strokeOpacity:0). Only force-show on re-add after backward seek or reuse,
    // where the element was previously hidden by deleteElement.
    if (!isFirstCreation) {
      this._showElement(jsgEl);
    }

    // Only register if not already present — pre-created shapes are registered
    // in onAfterRender; re-adds retain their registration from the first insertion.
    if (id && !this.context.getElementByMCID?.(id)) {
      this.context.setCustomEntity(id, jsgEl, classes);
    }
    return jsgEl;
  }

  /**
   * Dynamically add a shape to the canvas after the clip has been initialised.
   * Equivalent to what onAfterRender does for each entry in attrs.shapes, so
   * external callers can add shapes without recreating the whole clip.
   *
   * @param {object} descriptor - same format as items in attrs.shapes
   * @returns the JSXGraph element, or null on failure
   */
  addShape(descriptor) {
    const { id, classes = [] } = descriptor;
    const element = this._createBoardElement(descriptor);
    if (!element) return null;

    if (id) {
      this._entityMap[id] = element;
      const allClasses = classes.includes("shape")
        ? classes
        : [...classes, "shape"];
      this.setCustomEntity(id, element, allClasses);
    }
    return element;
  }

  /**
   * Called by the framework when a RemoveElement incident fires.
   *
   * Hides the JSXGraph element without destroying it. Returns the element so
   * the framework can store it and pass it back as definition on backward-seek re-add.
   *
   * @param {string} mcid
   */
  /**
   * Hide every entity currently on the board.
   * The clip timeline and registered entities are preserved — the LLM can
   * addShape() new elements on a visually clean canvas without destroying
   * the underlying MC clip structure.
   */
  clearAll() {
    for (const [, jsgEl] of Object.entries(this._entityMap)) {
      this._hideElement(jsgEl);
    }
  }

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
