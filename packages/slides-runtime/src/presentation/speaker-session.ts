/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement, ReactNode } from "react";
import type { Root } from "react-dom/client";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type { Slide } from "../deck-contracts";
import type { PopoutView, PopoutWindow } from "./popouts";

/** The speaker-notes popout and the React root that renders into it. */
export interface SpeakerNotesSession {
  view: PopoutView;
  render: (node: ReactNode) => void;
  close: () => void;
}
/** Outcome of `openSpeakerNotes`; `win` is the session (not the browser window). */
export type SpeakerNotesOpenResult =
  | { kind: "opened"; win: SpeakerNotesSession; reused?: true }
  | { kind: "unavailable" | "blocked" };
/** Props of the compact notes view shown in a popout while the editor is not presenting. */
export interface CompactSpeakerNotesProps {
  win: PopoutWindow;
  slide?: Slide;
  /** Zero-based position of `slide` in the deck. */
  index: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    CompactSpeakerNotesJsx: JsxNamespace;
    SPEAKER_NOTES_POPOUT_SIZE: { width: number; height: number };
    activeSpeakerNotesSession: SpeakerNotesSession | null;
    speakerNotesSessionSubscribers: Set<() => void>;
    speakerNotesSessionByPopout: WeakMap<PopoutView, Root>;
    setSpeakerNotesSession: (session: SpeakerNotesSession | null) => void;
    subscribeSpeakerNotesSession: (listener: () => void) => () => void;
    getSpeakerNotesSession: () => SpeakerNotesSession | null;
    slidesHaveSpeakerNotes: (slides: readonly Pick<Slide, "notes">[]) => boolean;
    useSpeakerNotesSession: () => SpeakerNotesSession | null;
    openSpeakerNotes: () => SpeakerNotesOpenResult;
    CompactSpeakerNotes: (props: CompactSpeakerNotesProps) => ReactElement;
  }
}

export function installPresentationSpeakerSession(
  runtime: RuntimeBindings,
): () => void {
  var CompactSpeakerNotesJsx: JsxNamespace;
  var SPEAKER_NOTES_POPOUT_SIZE: RuntimeBindings["SPEAKER_NOTES_POPOUT_SIZE"];
  var activeSpeakerNotesSession: RuntimeBindings["activeSpeakerNotesSession"];
  var speakerNotesSessionSubscribers: RuntimeBindings["speakerNotesSessionSubscribers"];
  var speakerNotesSessionByPopout: RuntimeBindings["speakerNotesSessionByPopout"];
  function setSpeakerNotesSession(session: SpeakerNotesSession | null): void {
    activeSpeakerNotesSession = session;
    for (let value of Array.from(speakerNotesSessionSubscribers)) value();
  }
  function subscribeSpeakerNotesSession(listener: () => void): () => void {
    speakerNotesSessionSubscribers.add(listener);
    return () => {
      speakerNotesSessionSubscribers.delete(listener);
    };
  }
  function getSpeakerNotesSession(): SpeakerNotesSession | null {
    return activeSpeakerNotesSession;
  }
  function slidesHaveSpeakerNotes(
    slides: readonly Pick<Slide, "notes">[],
  ): boolean {
    return slides.some((input) => (input.notes ?? "").trim() !== "");
  }
  function useSpeakerNotesSession(): SpeakerNotesSession | null {
    return runtime.ReactSpeakerNotes.useSyncExternalStore(
      subscribeSpeakerNotesSession,
      getSpeakerNotesSession,
      () => null,
    );
  }
  function openSpeakerNotes(): SpeakerNotesOpenResult {
    let value = (0, runtime.openPopoutView)(runtime.SPEAKER_NOTES_POPOUT_KEY, {
        ...SPEAKER_NOTES_POPOUT_SIZE,
        title: "Speaker notes",
        css: runtime.SPEAKER_NOTES_POPOUT_CSS,
      });
    if (value.kind !== "opened") {
      return {
        kind: value.kind,
      };
    }
    if (
      activeSpeakerNotesSession !== null &&
      activeSpeakerNotesSession.view === value.view
    ) {
      return {
        kind: "opened",
        win: activeSpeakerNotesSession,
        reused: true,
      };
    }
    let view = value.view,
      entry = speakerNotesSessionByPopout.get(view);
    if (entry === undefined) {
      entry = runtime.SpeakerNotesReactRoot.createRoot(view.root);
      speakerNotesSessionByPopout.set(view, entry);
    }
    let value3 = entry,
      state: SpeakerNotesSession = {
        view: view,
        render: (input) => value3.render(input),
        close: () => view.close(),
      };
    setSpeakerNotesSession(state);
    view.closed.then(() => {
      if (activeSpeakerNotesSession === state) {
        setSpeakerNotesSession(null);
      }
      setTimeout(() => value3.unmount(), 0);
    });
    if (value.reused === true) {
      return {
        kind: "opened",
        win: state,
        reused: true,
      };
    } else {
      return {
        kind: "opened",
        win: state,
      };
    }
  }
  function CompactSpeakerNotes({
    win: win,
    slide: slide,
    index: index,
  }: CompactSpeakerNotesProps): ReactElement {
    runtime.ReactSpeakerNotes.useEffect(() => {
      win.document.title = "Speaker notes";
    }, [win]);
    let value = (0, runtime.slideTitleSnippet)(slide, 80),
      value2 = (0, runtime.truncateUtf16Safely)(
        (slide?.notes ?? "").trim(),
        runtime.maxSlideNotesLength,
      );
    return CompactSpeakerNotesJsx.jsx("div", {
      className: "sn sn-compact",
      children: CompactSpeakerNotesJsx.jsxs("div", {
        className: "sn-right",
        children: [
          CompactSpeakerNotesJsx.jsxs("div", {
            className: "sn-head",
            children: [
              CompactSpeakerNotesJsx.jsx("span", {
                children: "Speaker notes",
              }),
              CompactSpeakerNotesJsx.jsx("span", {
                className: "sn-dim",
                style: {
                  fontWeight: 400,
                },
                children:
                  slide === undefined
                    ? "No slides"
                    : value !== ""
                      ? value
                      : "Slide " + String(index + 1),
              }),
            ],
          }),
          CompactSpeakerNotesJsx.jsx("div", {
            tabIndex: 0,
            role: "region",
            "aria-label": "Notes",
            "data-notes-scroll": "",
            className: "sn-notes",
            children: CompactSpeakerNotesJsx.jsxs("div", {
              children: [
                CompactSpeakerNotesJsx.jsx("p", {
                  className: "sn-dim",
                  style: {
                    margin: "0 0 1em",
                    fontSize: "0.75em",
                  },
                  children:
                    "Waiting for the presentation. Press Present in the main window: the presentation plays there (full screen where it can) and this window follows along with the clock, the slide on screen, what comes next and its notes.",
                }),
                value2 === ""
                  ? CompactSpeakerNotesJsx.jsx("span", {
                      className: "sn-dim",
                      children: "No notes for this slide.",
                    })
                  : value2,
              ],
            }),
          }),
        ],
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "CompactSpeakerNotesJsx",
    () => CompactSpeakerNotesJsx,
    (value) => {
      CompactSpeakerNotesJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPEAKER_NOTES_POPOUT_SIZE",
    () => SPEAKER_NOTES_POPOUT_SIZE,
    (value) => {
      SPEAKER_NOTES_POPOUT_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeSpeakerNotesSession",
    () => activeSpeakerNotesSession,
    (value) => {
      activeSpeakerNotesSession = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "speakerNotesSessionSubscribers",
    () => speakerNotesSessionSubscribers,
    (value) => {
      speakerNotesSessionSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "speakerNotesSessionByPopout",
    () => speakerNotesSessionByPopout,
    (value) => {
      speakerNotesSessionByPopout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setSpeakerNotesSession",
    () => setSpeakerNotesSession,
  );
  bindRuntimeValue(
    runtime,
    "subscribeSpeakerNotesSession",
    () => subscribeSpeakerNotesSession,
  );
  bindRuntimeValue(
    runtime,
    "getSpeakerNotesSession",
    () => getSpeakerNotesSession,
  );
  bindRuntimeValue(
    runtime,
    "slidesHaveSpeakerNotes",
    () => slidesHaveSpeakerNotes,
  );
  bindRuntimeValue(
    runtime,
    "useSpeakerNotesSession",
    () => useSpeakerNotesSession,
  );
  bindRuntimeValue(runtime, "openSpeakerNotes", () => openSpeakerNotes);
  bindRuntimeValue(runtime, "CompactSpeakerNotes", () => CompactSpeakerNotes);
  return () => {
    CompactSpeakerNotesJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    SPEAKER_NOTES_POPOUT_SIZE = {
      width: 1000,
      height: 640,
    };
    activeSpeakerNotesSession = null;
    speakerNotesSessionSubscribers = new Set();
    speakerNotesSessionByPopout = new WeakMap();
  };
}
