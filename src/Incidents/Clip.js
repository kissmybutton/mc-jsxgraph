import { BrowserClip } from "@donkeyclip/motorcortex";

export default class MyClip extends BrowserClip {
  onAfterRender() {}

  // Called once when an AddElement incident fires.
  // `definition` follows the same format as clip init config.
  // The framework automatically calls context.setMCID(entity, mcid) on the returned value.
  // insertElement(definition, id, classes) — override in your subclass.
  // Called on first add and on backward-seek re-add (definition will be the
  // existing entity). Must call setCustomEntity(id, entity, classes) and return entity.

  // deleteElement(mcid) — override in your subclass.
  // Must hide/detach the entity without destroying it and return it so the
  // framework can pass it back as definition on backward-seek re-add.

  // Called when a RemoveElement incident fires.
  // Must DETACH but NOT DESTROY — the framework holds the reference for backward-seek reattachment.
  deleteElement(mcid) {
    const entity = this.context.getElementByMCID(mcid);
    if (!entity) return null;
    // TODO: detach entity from scene without destroying it
    return entity;
  }
}
