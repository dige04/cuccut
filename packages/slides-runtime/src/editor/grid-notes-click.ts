/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { SlideId } from "../deck-contracts";

/** What a click in the slide grid landed on: a slide surface, the editor, or outside both. */
export type GridNotesClickTarget = "ground" | "editor" | "off";
/** A slide under the pointer in the grid plus the pointer's position within it. */
export interface GridSlideHit {
  id: SlideId;
  fx: number;
  fy: number;
}
export interface GridNotesOutsideClick {
  /** Slide whose notes are being edited, if any. */
  editing: SlideId | null;
  /** Slide under the click, if any. */
  hit: GridSlideHit | null;
  target: GridNotesClickTarget;
  /** True when the pointer moved between press and release (a drag, not a click). */
  moved: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reduceGridNotesOutsideClick: (
      context: GridNotesOutsideClick,
    ) => "clear" | "ignore" | GridSlideHit;
    classifyGridNotesClickTarget: (
      target: EventTarget | null,
    ) => GridNotesClickTarget;
  }
}

export function installEditorGridNotesClick(
  runtime: RuntimeBindings,
): () => void {
  function reduceGridNotesOutsideClick(
    context: GridNotesOutsideClick,
  ): "clear" | "ignore" | GridSlideHit {
    if (context.editing !== null && context.hit?.id === context.editing) {
      if (context.target === "off") {
        return "clear";
      } else {
        if (context.moved) {
          return "ignore";
        } else {
          return context.hit;
        }
      }
    }
    if (context.target === "ground" && context.hit !== null) {
      return context.hit;
    } else {
      return "clear";
    }
  }
  function classifyGridNotesClickTarget(
    target: EventTarget | null,
  ): GridNotesClickTarget {
    let element = target as Element | null;
    if (element === null || typeof element.closest !== "function") {
      return "off";
    }
    if (element.hasAttribute("data-slides-ground")) {
      return "ground";
    }
    if (element.closest("[data-slides-editor]") !== null) {
      return "editor";
    }
    if (
      element.closest("[data-slides-grid]") !== null &&
      element.closest("[data-mc-menu]") === null
    ) {
      return "ground";
    } else {
      return "off";
    }
  }
  bindRuntimeValue(
    runtime,
    "reduceGridNotesOutsideClick",
    () => reduceGridNotesOutsideClick,
  );
  bindRuntimeValue(
    runtime,
    "classifyGridNotesClickTarget",
    () => classifyGridNotesClickTarget,
  );
  return () => {};
}
