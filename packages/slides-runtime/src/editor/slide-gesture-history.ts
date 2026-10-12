/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Slide, SlideId } from "../deck-contracts";
import type { NodeSelection } from "../layout/selection-groups";
import type { HistoryCommand } from "./command-history";

/** What the history needs to know about the editor to restore selections around a slide edit. */
export interface SlideGestureOptions {
  /** The current selection. */
  latest(): NodeSelection[];
  /** True when the slide is the one on screen. */
  onScreen(slideId: SlideId): boolean;
  /** The slide, when the selection may be restored on it right now. */
  selectable(slideId: SlideId): Slide | undefined;
  select(selection: NodeSelection[]): void;
}
/** Selection captured when a gesture begins, keyed by the slide it began on. */
interface GestureStart {
  units: NodeSelection[];
  /** The slide as JSON, to tell whether a step belongs to this gesture. */
  slide: string;
  stored: Slide | undefined;
}
/** Records the selection around slide edits so undo and redo bring it back. */
export interface SlideGestureHistory {
  /** Marks the slide a live gesture is about to change. */
  gestureFrame(slide: Slide | undefined): void;
  gestureEnd(): void;
  /**
   * Wraps one slide edit as a history command. `run` applies the do or undo step and reports whether
   * the slide changed; `before` is the slide as it was before the edit, when known.
   */
  command(
    slideId: SlideId,
    label: string | undefined,
    run: (kind: "do" | "undo") => boolean,
    before: Slide | undefined,
  ): HistoryCommand;
}

declare module "../bindings" {
  interface RuntimeBindings {
    createSlideGestureHistory: (
      options: SlideGestureOptions,
    ) => SlideGestureHistory;
  }
}

export function installEditorSlideGestureHistory(
  runtime: RuntimeBindings,
): () => void {
  function createSlideGestureHistory(
    options: SlideGestureOptions,
  ): SlideGestureHistory {
    let value: GestureStart | null = null,
      index = 0;
    return {
      gestureFrame(input: Slide | undefined): void {
        if (value === null || value.stored === input) {
          value = {
            units: options.latest(),
            slide: JSON.stringify(input),
            stored: input,
          };
        }
      },
      gestureEnd: (): void => void (value = null),
      command(
        input: SlideId,
        options2: string | undefined,
        context: (kind: "do" | "undo") => boolean,
        value2: Slide | undefined,
      ): HistoryCommand {
        let value3 = options.onScreen(input),
          value4 = value;
        value = null;
        let value5: NodeSelection[] | null =
            value2 === undefined
              ? options.latest()
              : value4 !== null && value4.slide === JSON.stringify(value2)
                ? value4.units
                : null,
          value6: NodeSelection[] | undefined =
            value2 === undefined ? undefined : options.latest(),
          value7 = (index += 1);
        if (value2 === undefined) {
          queueMicrotask(
            (): void =>
              void (value7 === index && (value6 = options.latest())),
          );
        }
        let flag = false,
          callback =
            (input2: "do" | "undo"): (() => void) =>
            (): void => {
              let value8 = flag;
              flag = true;
              let value9 = input2 === "undo" ? value5 : (value6 ?? value5);
              if (!context(input2) || !value8 || !value3 || value9 === null) {
                return;
              }
              let value10 = options.selectable(input);
              if (value10 !== undefined) {
                options.select(
                  (0, runtime.filterValidSelections)(value10, value9),
                );
              }
            };
        return {
          label: options2,
          do: callback("do"),
          undo: callback("undo"),
        };
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "createSlideGestureHistory",
    () => createSlideGestureHistory,
  );
  return () => {
    (0, runtime.initializeModelSelection)();
  };
}
