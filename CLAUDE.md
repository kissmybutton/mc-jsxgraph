# Project Rules: MotorCortex

- Always refer to https://motorcortexjs.com/ to understand how MotorCortex (mc) works
- Refer to this project to see an example of another plugin that creates a Browser clip: https://github.com/donkeyclip/motorcortex-threejs/tree/main/src

## Upstream dependency: addCustomEntity

The MotorCortex core at `donkeyclip/packages/motorcortex` (branch `feat/add-custom-entity-v1`) supports `addCustomEntity` for dynamic entity creation. Show/hide is handled at the tool level via CSSEffect/Attr incidents — MC only provides the `hidden` flag on creation (calls `hideEntity`).

When implementing in this plugin:

- Override `renderCustomEntity(definition)` in GeomClip to create JSXGraph elements from definitions
- Override `hideEntity(element)` to hide a newly created element (called when `hidden=true`)
- Use `addCustomEntity(definition, id, classes, birthtime, hidden=true)` from the descriptive clip layer to add elements dynamically
- Use Attr/CSSEffect incidents at the tool level to show/hide entities on the timeline
