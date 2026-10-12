/** Restored application module; prepare first, initialize in original order. */
import type { ChangeEvent, KeyboardEvent, ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { Slide } from "../deck-contracts";

export interface SpeakerNotesEditorProps {
  slide: Slide;
  /** Tray height in px (before clamping). */
  height: number;
  onResize(height: number): void;
  onResizeStart?(): void;
  /** Maps a drag (start height, vertical delta, min, max) to the new tray height. */
  heightFor?: (
    startHeight: number,
    delta: number,
    min: number,
    max: number,
  ) => number;
  /** True when the tray sits at the screen bottom and must clear the safe-area inset. */
  atScreenBottom?: boolean;
  readOnly?: boolean;
  /** Receives the slide with the notes typed so far, on every keystroke. */
  onLiveChange(slide: Slide): void;
  /** Called with the slide as it was when the notes edit began, once the edit ends. */
  onGestureEnd(slide: Slide): void;
  /** Called when Escape hands focus back to the slide. */
  onRelease?(): void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactSpeakerNotesEditor: ReactNamespace;
    SpeakerNotesEditorJsx: JsxNamespace;
    MIN_SPEAKER_NOTES_EDITOR_HEIGHT: number;
    DEFAULT_SPEAKER_NOTES_EDITOR_HEIGHT: number;
    clampSpeakerNotesEditorHeight: (height: number) => number;
    setSlideSpeakerNotes: (slide: Slide, notes: string | undefined) => Slide;
    SpeakerNotesEditor: (props: SpeakerNotesEditorProps) => ReactElement;
  }
}

export function installEditorSpeakerNotes(
  runtime: RuntimeBindings,
): () => void {
  var ReactSpeakerNotesEditor: ReactNamespace;
  var SpeakerNotesEditorJsx: JsxNamespace;
  var MIN_SPEAKER_NOTES_EDITOR_HEIGHT: RuntimeBindings["MIN_SPEAKER_NOTES_EDITOR_HEIGHT"];
  var DEFAULT_SPEAKER_NOTES_EDITOR_HEIGHT: RuntimeBindings["DEFAULT_SPEAKER_NOTES_EDITOR_HEIGHT"];
  function clampSpeakerNotesEditorHeight(height: number): number {
    return Math.max(
      MIN_SPEAKER_NOTES_EDITOR_HEIGHT,
      Math.min(
        Math.round(window.innerHeight * 0.5),
        Math.round(height),
      ),
    );
  }
  function setSlideSpeakerNotes(
    slide: Slide,
    notes: string | undefined,
  ): Slide {
    let updatedSlide: Slide = {
      ...slide,
    };
    if (notes === undefined) {
      delete updatedSlide.notes;
    } else {
      updatedSlide.notes = notes;
    }
    return updatedSlide;
  }
  function SpeakerNotesEditor({
    slide: slide,
    height: height,
    onResize: onResize,
    onResizeStart: onResizeStart,
    heightFor: heightFor,
    atScreenBottom = false,
    readOnly = false,
    onLiveChange: onLiveChange,
    onGestureEnd: onGestureEnd,
    onRelease: onRelease,
  }: SpeakerNotesEditorProps): ReactElement {
    let ref = ReactSpeakerNotesEditor.useRef<Slide | null>(null),
      value = (0, runtime.useImeGuard)(),
      callback = (): void => {
        let current = ref.current;
        ref.current = null;
        if (current !== null) {
          onGestureEnd(current);
        }
      },
      ref2 = ReactSpeakerNotesEditor.useRef(callback);
    ref2.current = callback;
    ReactSpeakerNotesEditor.useEffect(
      (): (() => void) => (): void => ref2.current(),
      [],
    );
    ReactSpeakerNotesEditor.useEffect((): void => {
      if (ref.current !== null && ref.current.id !== slide.id) {
        ref2.current();
      }
    }, [slide.id]);
    ReactSpeakerNotesEditor.useEffect((): void => {
      if (!readOnly) {
        return;
      }
      let current = ref.current;
      ref.current = null;
      if (
        current !== null &&
        current.id === slide.id &&
        slide.notes !== current.notes
      ) {
        onLiveChange(setSlideSpeakerNotes(slide, current.notes));
        onGestureEnd(current);
      }
    }, [readOnly, slide, onLiveChange, onGestureEnd]);
    let ref3 = ReactSpeakerNotesEditor.useRef(height),
      state = {
        onResizeStart: (): void => {
          ref3.current = clampSpeakerNotesEditorHeight(height);
          onResizeStart?.();
        },
        onResize: (input: number): void =>
          onResize(
            clampSpeakerNotesEditorHeight(
              heightFor
                ? heightFor(
                    ref3.current,
                    -input,
                    MIN_SPEAKER_NOTES_EDITOR_HEIGHT,
                    clampSpeakerNotesEditorHeight(1 / 0),
                  )
                : ref3.current - input,
            ),
          ),
        onResizeEnd: (): void => {},
      },
      value2 = atScreenBottom ? "var(--sl-safe-b, 0px)" : "0px";
    return SpeakerNotesEditorJsx.jsxs("div", {
      "data-notes-tray": "",
      className:
        "relative flex shrink-0 flex-col border-t border-border-line bg-panel",
      style: {
        height:
          "calc(" +
          String(clampSpeakerNotesEditorHeight(height)) +
          "px + " +
          value2 +
          ")",
        paddingBottom: value2,
      },
      children: [
        SpeakerNotesEditorJsx.jsx(runtime.PanelResizeHandle, {
          name: "notes",
          label: "Resize speaker notes",
          now: clampSpeakerNotesEditorHeight(height),
          min: MIN_SPEAKER_NOTES_EDITOR_HEIGHT,
          max: clampSpeakerNotesEditorHeight(1 / 0),
          valueText:
            String(clampSpeakerNotesEditorHeight(height)) + " pixels tall",
          gesture: state,
          onHome: (): void => onResize(MIN_SPEAKER_NOTES_EDITOR_HEIGHT),
          onEnd: (): void => onResize(clampSpeakerNotesEditorHeight(1 / 0)),
          onReset: (): void => onResize(DEFAULT_SPEAKER_NOTES_EDITOR_HEIGHT),
        }),
        SpeakerNotesEditorJsx.jsx("textarea", {
          value: slide.notes ?? "",
          readOnly: readOnly,
          maxLength: runtime.maxSlideNotesLength,
          placeholder: readOnly
            ? "No speaker notes on this slide."
            : "Speaker notes. Never shown on the slide.",
          "aria-label": "Speaker notes",
          className:
            "min-h-0 flex-1 resize-none bg-transparent px-3 pb-2 pt-2.5 text-sm outline-none placeholder:text-fg-muted/60",
          onFocus: (): void => {
            ref.current = slide;
          },
          onChange: (event: ChangeEvent<HTMLTextAreaElement>): void => {
            if (ref.current === null || ref.current.id !== slide.id) {
              ref.current = slide;
            }
            let value3 = event.target.value,
              state2: Slide = {
                ...slide,
              };
            if (value3.trim() === "") {
              delete state2.notes;
            } else {
              state2.notes = value3;
            }
            onLiveChange(state2);
          },
          onBlur: callback,
          onCompositionEnd: value.onCompositionEnd,
          onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>): void => {
            if (event.key !== "Escape") {
              return;
            }
            if (value.fromIme(event)) {
              event.stopPropagation();
              return;
            }
            event.preventDefault();
            callback();
            onRelease?.();
            if (
              event.currentTarget.ownerDocument.activeElement ===
              event.currentTarget
            ) {
              event.currentTarget.blur();
            }
          },
        }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactSpeakerNotesEditor",
    () => ReactSpeakerNotesEditor,
    (value) => {
      ReactSpeakerNotesEditor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SpeakerNotesEditorJsx",
    () => SpeakerNotesEditorJsx,
    (value) => {
      SpeakerNotesEditorJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_SPEAKER_NOTES_EDITOR_HEIGHT",
    () => MIN_SPEAKER_NOTES_EDITOR_HEIGHT,
    (value) => {
      MIN_SPEAKER_NOTES_EDITOR_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampSpeakerNotesEditorHeight",
    () => clampSpeakerNotesEditorHeight,
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_SPEAKER_NOTES_EDITOR_HEIGHT",
    () => DEFAULT_SPEAKER_NOTES_EDITOR_HEIGHT,
    (value) => {
      DEFAULT_SPEAKER_NOTES_EDITOR_HEIGHT = value;
    },
  );
  bindRuntimeValue(runtime, "setSlideSpeakerNotes", () => setSlideSpeakerNotes);
  bindRuntimeValue(runtime, "SpeakerNotesEditor", () => SpeakerNotesEditor);
  return () => {
    ReactSpeakerNotesEditor = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeSlideRenderer)();
    SpeakerNotesEditorJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    MIN_SPEAKER_NOTES_EDITOR_HEIGHT = 72;
    DEFAULT_SPEAKER_NOTES_EDITOR_HEIGHT = 104;
  };
}
