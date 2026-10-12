/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type { ObjectContextSelection } from "../model/selection";
import type { PeerSelectionRing } from "./selection-rings";

/** Bounds of a selected object in slide coordinates (rotation in degrees). */
export interface PeerSelectionBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
}
export interface SlidePeerSelectionsProps {
  /** Hosted decks key peers' selections by `deckMode`, standalone ones by `mode`. */
  hosted: boolean;
  deck: string | null;
  slideId: string;
  /** Measures a selected object on the stage; null when it is not rendered. */
  measure: (
    frameId: string,
    path: ObjectContextSelection["path"],
  ) => PeerSelectionBox | null | undefined;
  scale: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    SlidePeerSelectionJsx: JsxNamespace;
    SlidePeerSelections: (
      props: SlidePeerSelectionsProps,
    ) => ReactElement | null;
  }
}

export function installCollaborationSlideSelection(
  runtime: RuntimeBindings,
): () => void {
  var SlidePeerSelectionJsx: JsxNamespace;
  function SlidePeerSelections({
    hosted: hosted,
    deck: deck,
    slideId: slideId,
    measure: measure,
    scale: scale,
  }: SlidePeerSelectionsProps): ReactElement | null {
    let value = (0, runtime.usePeerSelections)({
        [hosted ? "deckMode" : "mode"]: "edit",
        deck: deck,
        slideId: slideId,
      }),
      value2 = JSON.stringify(
        value.map(
          (input) => [
            input.peer,
            input.collaborator,
            input.selected,
          ],
        ),
      ),
      [value3, value4] =
        runtime.ReactPeerSelectionMeasurement.useState<PeerSelectionRing[]>(
          [],
        );
    runtime.ReactPeerSelectionMeasurement.useLayoutEffect(() => {
      let items: PeerSelectionRing[] = [];
      for (let value5 of value)
        for (let value6 of value5.selected) {
          let value7 = (0, runtime.parseObjectContextId)(value6),
            value8 = value7
              ? measure(value7.frameId, value7.path)
              : null;
          if (value8) {
            items.push({
              key: value5.peer + "|" + value6,
              x: value8.x,
              y: value8.y,
              w: value8.w,
              h: value8.h,
              rotation: value8.rotation,
              collaborator: value5.collaborator,
            });
          }
        }
      value4(
        (input) =>
          JSON.stringify(input) === JSON.stringify(items) ? input : items,
      );
    }, [value2, measure]);
    if (value3.length === 0) {
      return null;
    }
    return SlidePeerSelectionJsx.jsx(runtime.PeerSelectionRings, {
      rings: value3,
      scale: scale,
    });
  }
  bindRuntimeValue(
    runtime,
    "SlidePeerSelectionJsx",
    () => SlidePeerSelectionJsx,
    (value) => {
      SlidePeerSelectionJsx = value;
    },
  );
  bindRuntimeValue(runtime, "SlidePeerSelections", () => SlidePeerSelections);
  return () => {
    (0, runtime.initializeModelSelection)();
    SlidePeerSelectionJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
