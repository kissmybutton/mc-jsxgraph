# Project Rules: MotorCortex

- Always refer to https://motorcortexjs.com/ to understand how MotorCortex (mc) works
- Refer to this project to see an example of another plugin that creates a Browser clip: https://github.com/donkeyclip/motorcortex-threejs/tree/main/src

## Upstream dependency: addCustomEntity v1

The MotorCortex core at `donkeyclip/packages/motorcortex` (branch `feat/add-custom-entity-v1`) now supports `addCustomEntity` / `removeCustomEntity` with a `VisibilityChannel` for timeline-aware show/hide. This plugin (mc-jsxgraph) can use these APIs once the MC branch is merged. See the MC repo's `CLAUDE.md` for full details.

When implementing in this plugin:

- Override `renderCustomEntity(definition)` in GeomClip to create JSXGraph elements from definitions
- Override `showElement(element)` / `hideElement(element)` to control JSXGraph element visibility
- Use `addCustomEntity(definition, id, classes, birthtime, hidden=true)` from the descriptive clip layer to add elements dynamically
- Use `removeCustomEntity(id, ms)` for clearing canvas / removing elements at a specific timeline position
