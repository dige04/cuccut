/** Restored application module; prepare first, initialize in original order. */
import type { ChangeEvent, ReactElement, ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type { Slide } from "../deck-contracts";
import type { PopoutWindow } from "./popouts";
import type { SpeakerSlideMessage } from "./speaker-protocol";

/** The fields of a keydown event the notes panel looks at; native and React keyboard events both fit. */
export type SpeakerNavigationKeyEvent = Pick<KeyboardEvent, "key" | "target">;
/** Stopwatch of the speaker window: `accum` is the time counted before `start`, `start` the last resume. */
export interface SpeakerClockState {
  running: boolean;
  start: number;
  accum: number;
}
export interface SpeakerClockProps {
  clock: SpeakerClockState;
}
/** The notes text being edited in the speaker window. */
interface SpeakerNotesDraft {
  id: string;
  text: string;
}
export interface SpeakerNotesPanelProps {
  /** The slide message the panel starts from, until the presenter sends the next one. */
  first: SpeakerSlideMessage;
  /** The popout's end of the channel to the presenter window. */
  port: MessagePort;
  win: PopoutWindow;
  slides: readonly Slide[];
  assets: Record<string, string>;
  fontCss?: string;
  canEdit?: boolean;
  /** Tells why a slide cannot be edited (its saved content is invalid); undefined when it can. */
  heldSlide?: (slideId: string) => string | undefined;
}
export interface SpeakerSlidePreviewProps {
  slide: Slide;
  /** Build step to show; every frame is visible when omitted. */
  step?: number;
  assets: Record<string, string>;
  width: number;
}
export interface ResponsiveSpeakerSlidePreviewProps {
  win: PopoutWindow;
  className: string;
  /** Renders the slide for the measured width in pixels. */
  children: (width: number) => ReactNode;
}
export interface SpeakerAdjacentSlideProps {
  win: PopoutWindow;
  /** "Previous" or "Next". */
  heading: string;
  /** The neighbouring slide, undefined at either end of the deck. */
  slide?: Slide;
  assets: Record<string, string>;
  onClick: () => void;
}
export interface SpeakerNotesControlProps {
  label: string;
  /** Why the control is disabled; enabled when undefined. */
  disabledReason?: string;
  onClick: () => void;
  children: ReactNode;
}

declare module "../bindings" {
  interface RuntimeBindings {
    SpeakerNotesPanelJsx: JsxNamespace;
    SPEAKER_NOTES_WIDE_BREAKPOINT: number;
    SPEAKER_NOTES_POPOUT_CSS: string;
    SPEAKER_NOTES_SCROLL_KEYS: Set<string>;
    SPEAKER_NOTES_WIDE_MEDIA_QUERY: string;
    preventSpeakerControlMouseDown: (event: { preventDefault(): void }) => void;
    formatSpeakerElapsedTime: (elapsedMs: number) => string;
    speakerNotesOwnNavigationKey: (event: SpeakerNavigationKeyEvent) => boolean;
    elapsedSpeakerClock: (clock: SpeakerClockState, now: number) => number;
    SpeakerClock: (props: SpeakerClockProps) => ReactElement;
    isSpeakerNotesWindowWide: (window: Window) => boolean;
    useSpeakerNotesWindowWide: (window: Window) => boolean;
    SpeakerNotesPanel: (props: SpeakerNotesPanelProps) => ReactElement;
    SpeakerSlidePreview: (props: SpeakerSlidePreviewProps) => ReactElement;
    ResponsiveSpeakerSlidePreview: (
      props: ResponsiveSpeakerSlidePreviewProps,
    ) => ReactElement;
    SpeakerAdjacentSlide: (props: SpeakerAdjacentSlideProps) => ReactElement;
    SpeakerNotesControl: (props: SpeakerNotesControlProps) => ReactElement;
  }
}

export function installPresentationSpeakerPanel(
  runtime: RuntimeBindings,
): () => void {
  var SpeakerNotesPanelJsx: JsxNamespace;
  var SPEAKER_NOTES_WIDE_BREAKPOINT: RuntimeBindings["SPEAKER_NOTES_WIDE_BREAKPOINT"];
  var SPEAKER_NOTES_POPOUT_CSS: RuntimeBindings["SPEAKER_NOTES_POPOUT_CSS"];
  var SPEAKER_NOTES_SCROLL_KEYS: RuntimeBindings["SPEAKER_NOTES_SCROLL_KEYS"];
  var preventSpeakerControlMouseDown: RuntimeBindings["preventSpeakerControlMouseDown"];
  var SPEAKER_NOTES_WIDE_MEDIA_QUERY: RuntimeBindings["SPEAKER_NOTES_WIDE_MEDIA_QUERY"];
  function formatSpeakerElapsedTime(elapsedMs: number): string {
    let seconds = Math.max(0, Math.floor(elapsedMs / 1000)),
      minutes = Math.floor(seconds / 60);
    return String(minutes) + ":" + String(seconds % 60).padStart(2, "0");
  }
  function speakerNotesOwnNavigationKey(
    event: SpeakerNavigationKeyEvent,
  ): boolean {
    if (!SPEAKER_NOTES_SCROLL_KEYS.has(event.key)) {
      return false;
    }
    let scroller = (event.target as Element | null)?.closest?.(
      "[data-notes-scroll]",
    );
    return (
      scroller != null && scroller.scrollHeight > scroller.clientHeight + 1
    );
  }
  function elapsedSpeakerClock(clock: SpeakerClockState, now: number): number {
    return clock.accum + (clock.running ? now - clock.start : 0);
  }
  function SpeakerClock({ clock: clock }: SpeakerClockProps): ReactElement {
    let [value, value2] = runtime.ReactSpeakerNotesPanel.useState(() =>
      Date.now(),
    );
    runtime.ReactSpeakerNotesPanel.useLayoutEffect(() => {
      value2(Date.now());
      if (!clock.running) {
        return;
      }
      let value3 = setInterval(() => value2(Date.now()), 500);
      return () => clearInterval(value3);
    }, [clock]);
    return SpeakerNotesPanelJsx.jsx("span", {
      className: "sn-clock" + (clock.running ? "" : " sn-paused"),
      title: clock.running ? "Elapsed" : "Elapsed (paused)",
      children: formatSpeakerElapsedTime(elapsedSpeakerClock(clock, value)),
    });
  }
  function isSpeakerNotesWindowWide(window2: Window): boolean {
    if (typeof window2.matchMedia === "function") {
      return window2.matchMedia(SPEAKER_NOTES_WIDE_MEDIA_QUERY).matches;
    } else {
      return window2.innerWidth >= SPEAKER_NOTES_WIDE_BREAKPOINT;
    }
  }
  function useSpeakerNotesWindowWide(window2: Window): boolean {
    let [wide, setWide] = runtime.ReactSpeakerNotesPanel.useState(() =>
      isSpeakerNotesWindowWide(window2),
    );
    runtime.ReactSpeakerNotesPanel.useEffect(() => {
      let callback = () => setWide(isSpeakerNotesWindowWide(window2));
      callback();
      let value =
        typeof window2.matchMedia === "function"
          ? window2.matchMedia(SPEAKER_NOTES_WIDE_MEDIA_QUERY)
          : null;
      value?.addEventListener("change", callback);
      window2.addEventListener("resize", callback);
      return () => {
        value?.removeEventListener("change", callback);
        window2.removeEventListener("resize", callback);
      };
    }, [window2]);
    return wide;
  }
  function SpeakerNotesPanel({
    first: first,
    port: port,
    win: win,
    slides: slides,
    assets: assets,
    fontCss = "",
    canEdit = false,
    heldSlide = runtime.slideHtmlHold,
  }: SpeakerNotesPanelProps): ReactElement {
    let [value, value2] = runtime.ReactSpeakerNotesPanel.useState(first),
      [value3, value4] = runtime.ReactSpeakerNotesPanel.useState(false),
      [value5, value6] =
        runtime.ReactSpeakerNotesPanel.useState<SpeakerNotesDraft | null>(null),
      ref = runtime.ReactSpeakerNotesPanel.useRef(value5);
    ref.current = value5;
    let ref2 = runtime.ReactSpeakerNotesPanel.useRef(slides);
    ref2.current = slides;
    let ref3 = runtime.ReactSpeakerNotesPanel.useRef(value3);
    ref3.current = value3;
    let ref4 = runtime.ReactSpeakerNotesPanel.useRef<string[]>([]),
      ref5 = runtime.ReactSpeakerNotesPanel.useRef<string | undefined>(
        undefined,
      ),
      callback = (input?: Slide): void => {
        ref4.current = [];
        ref5.current = input?.notes ?? "";
        value6(
          input === undefined
            ? null
            : {
                id: input.id,
                text: input.notes ?? "",
              },
        );
      };
    runtime.ReactSpeakerNotesPanel.useLayoutEffect(() => {
      let value21 = slides[value.index],
        current = ref.current;
      if (value21?.id !== current?.id) {
        return callback(value21);
      }
      if (value21 === undefined || current === null) {
        return;
      }
      let value22 = value21.notes ?? "";
      if (value22 === ref5.current) {
        return;
      }
      ref5.current = value22;
      let value23 = ref4.current.findIndex(
        (input) => (input.trim() === "" ? "" : input) === value22,
      );
      if (value23 >= 0) {
        return void ref4.current.splice(0, value23 + 1);
      }
      if (value22 === current.text) {
        return;
      }
      callback(value21);
    }, [slides, value.index]);
    let [value7, value8] =
        runtime.ReactSpeakerNotesPanel.useState<SpeakerClockState>(() => ({
          running: true,
          start: first.since ?? Date.now(),
          accum: 0,
        })),
      ref6 = runtime.ReactSpeakerNotesPanel.useRef(port),
      value9 = useSpeakerNotesWindowWide(win);
    runtime.ReactSpeakerNotesPanel.useEffect(() => {
      let current = ref6.current;
      current.onmessage = (input) => {
        let value21 = (0, runtime.parseSpeakerSlideMessage)(input.data);
        if (value21 === null) {
          return;
        }
        value2(value21);
      };
      return () => {
        current.onmessage = null;
      };
    }, []);
    let callback2 = (): void => {
        let value21 = Date.now();
        value8((input) =>
            input.running
              ? {
                  running: false,
                  start: input.start,
                  accum: input.accum + (value21 - input.start),
                }
              : {
                  running: true,
                  start: value21,
                  accum: input.accum,
                },
        );
      },
      callback3 = (): void => {
        value8((input) => ({
          ...input,
          start: Date.now(),
          accum: 0,
        }));
      },
      callback4 = (input: 1 | -1): void => {
        ref6.current.postMessage({
          type: "nav",
          delta: input,
        });
      },
      callback5 = (input: number): void => {
        ref6.current.postMessage({
          type: "jump",
          index: input,
        });
      },
      callback6 = (): void => {
        ref6.current.postMessage({
          type: "exit",
        });
      },
      ref7 = runtime.ReactSpeakerNotesPanel.useRef<HTMLTextAreaElement | null>(
        null,
      ),
      callback7 = (): void => {
        callback(ref2.current[value.index]);
        value4(true);
      },
      callback8 = (): void => {
        value4(false);
        ref6.current.postMessage({
          type: "notes-end",
        });
      },
      ref8 = runtime.ReactSpeakerNotesPanel.useRef(callback8);
    ref8.current = callback8;
    runtime.ReactSpeakerNotesPanel.useEffect(() => {
      let current = ref7.current;
      if (!value3 || current === null) {
        return;
      }
      current.focus();
      current.setSelectionRange(current.value.length, current.value.length);
    }, [value3]);
    runtime.ReactSpeakerNotesPanel.useEffect(() => {
      if (canEdit || !ref3.current) {
        return;
      }
      value4(false);
      ref6.current.postMessage({
        type: "notes-end",
      });
    }, [canEdit]);
    let ref9 = runtime.ReactSpeakerNotesPanel.useRef(value.count);
    ref9.current = value.count;
    let value10 = value.index >= value.count - 1,
      value11 = value.canPrev === false,
      value12 = value.canNext === false,
      ref10 = runtime.ReactSpeakerNotesPanel.useRef<HTMLDivElement | null>(null);
    runtime.ReactSpeakerNotesPanel.useLayoutEffect(() => {
      if (ref10.current !== null) {
        ref10.current.scrollTop = 0;
      }
    }, [value.index]);
    runtime.ReactSpeakerNotesPanel.useEffect(() => {
      win.document.title =
        "Speaker notes · " +
        String(value.index + 1) +
        " / " +
        String(value.count);
    }, [win, value.index, value.count]);
    runtime.ReactSpeakerNotesPanel.useEffect(() => {
      let callback9 = (event: KeyboardEvent): void => {
        if (ref3.current) {
          if (event.key === "Escape" && !event.isComposing) {
            event.preventDefault();
            ref8.current();
          }
          return;
        }
        let value21 = (event.target as Element | null)?.closest?.(
          "button:not(:disabled)",
        );
        if (
          (event.key === " " && value21) ||
          speakerNotesOwnNavigationKey(event)
        ) {
          return;
        }
        switch (event.key) {
          case "ArrowRight":
          case "ArrowDown":
          case "PageDown":
          case " ":
            event.preventDefault();
            callback4(1);
            break;
          case "ArrowLeft":
          case "ArrowUp":
          case "PageUp":
            event.preventDefault();
            callback4(-1);
            break;
          case "Home":
            event.preventDefault();
            callback5(0);
            break;
          case "End":
            event.preventDefault();
            callback5(ref9.current - 1);
            break;
          case "Escape":
            event.preventDefault();
            callback6();
            break;
          default: {
            let value22 = Number(event.key);
            if (
              Number.isInteger(value22) &&
              value22 >= 1 &&
              value22 <= ref9.current
            ) {
              callback5(value22 - 1);
            }
          }
        }
      };
      win.addEventListener("keydown", callback9);
      return () => win.removeEventListener("keydown", callback9);
    }, [win]);
    let value13 = SpeakerNotesPanelJsx.jsx(SpeakerClock, {
        clock: value7,
      }),
      value14 = SpeakerNotesPanelJsx.jsxs("span", {
        className: "sn-group",
        children: [
          SpeakerNotesPanelJsx.jsx("button", {
            type: "button",
            className: "sn-pill",
            onMouseDown: preventSpeakerControlMouseDown,
            onClick: callback2,
            children: value7.running ? "Pause" : "Resume",
          }),
          SpeakerNotesPanelJsx.jsx("button", {
            type: "button",
            className: "sn-pill",
            onMouseDown: preventSpeakerControlMouseDown,
            onClick: callback3,
            children: "Reset",
          }),
        ],
      }),
      value15 =
        "Slide " + String(value.index + 1) + " / " + String(value.count),
      value16 = SpeakerNotesPanelJsx.jsxs("span", {
        className: "sn-group",
        children: [
          SpeakerNotesPanelJsx.jsx(SpeakerNotesControl, {
            label: "Previous slide",
            disabledReason: value11 ? "First slide" : undefined,
            onClick: (): void => callback4(-1),
            children: SpeakerNotesPanelJsx.jsx(runtime.KitIcon, {
              name: "CaretLeft",
              size: 16,
            }),
          }),
          SpeakerNotesPanelJsx.jsx(SpeakerNotesControl, {
            label: "Next slide",
            disabledReason: value12 ? "Last slide" : undefined,
            onClick: (): void => callback4(1),
            children: SpeakerNotesPanelJsx.jsx(runtime.KitIcon, {
              name: "CaretRight",
              size: 16,
            }),
          }),
        ],
      }),
      memo = runtime.ReactSpeakerNotesPanel.useMemo(
        () =>
          SpeakerNotesPanelJsx.jsxs(SpeakerNotesPanelJsx.Fragment, {
            children: [
              SpeakerNotesPanelJsx.jsx("style", {
                children: fontCss,
              }),
              SpeakerNotesPanelJsx.jsx("style", {
                children: runtime.shapeStylesCss,
              }),
            ],
          }),
        [fontCss],
      ),
      value17 = slides[value.index],
      value18 =
        value5 === null
          ? "No slide here."
          : heldSlide(value5.id) !== undefined
            ? "This slide can’t be edited until its saved content is fixed."
            : undefined,
      value19 = value.index > 0 ? slides[value.index - 1] : undefined,
      value20 = value10 ? undefined : slides[value.index + 1];
    return SpeakerNotesPanelJsx.jsxs("div", {
      className: "sn " + (value9 ? "sn-wide" : "sn-compact"),
      children: [
        memo,
        SpeakerNotesPanelJsx.jsxs("div", {
          className: "sn-left",
          children: [
            SpeakerNotesPanelJsx.jsxs("div", {
              className: "sn-bar",
              children: [
                value13,
                value14,
                SpeakerNotesPanelJsx.jsxs("span", {
                  className: "sn-group sn-pos",
                  children: [value15, value16],
                }),
              ],
            }),
            value9
              ? SpeakerNotesPanelJsx.jsxs(SpeakerNotesPanelJsx.Fragment, {
                  children: [
                    SpeakerNotesPanelJsx.jsx(ResponsiveSpeakerSlidePreview, {
                      win: win,
                      className: "sn-slot sn-cur",
                      children: (input: number) =>
                        value17 !== undefined
                          ? SpeakerNotesPanelJsx.jsx(SpeakerSlidePreview, {
                              slide: value17,
                              step: value.step,
                              assets: assets,
                              width: input,
                            })
                          : null,
                    }),
                    SpeakerNotesPanelJsx.jsxs("div", {
                      className: "sn-navrow",
                      children: [
                        SpeakerNotesPanelJsx.jsx(SpeakerAdjacentSlide, {
                          win: win,
                          heading: "Previous",
                          slide: value19,
                          assets: assets,
                          onClick: (): void => callback5(value.index - 1),
                        }),
                        SpeakerNotesPanelJsx.jsx(SpeakerAdjacentSlide, {
                          win: win,
                          heading: "Next",
                          slide: value20,
                          assets: assets,
                          onClick: (): void => callback5(value.index + 1),
                        }),
                      ],
                    }),
                  ],
                })
              : null,
          ],
        }),
        SpeakerNotesPanelJsx.jsxs("div", {
          className: "sn-right",
          children: [
            SpeakerNotesPanelJsx.jsxs("div", {
              className: "sn-head",
              children: [
                SpeakerNotesPanelJsx.jsx("span", {
                  children: "Speaker notes",
                }),
                SpeakerNotesPanelJsx.jsxs("button", {
                  type: "button",
                  role: "switch",
                  "aria-checked": value3,
                  "aria-label": "Edit notes",
                  title: canEdit
                    ? "Edit the notes from here"
                    : runtime.READ_ONLY_PRESENTATION_MESSAGE,
                  disabled: !canEdit,
                  className: "sn-switch",
                  onMouseDown: preventSpeakerControlMouseDown,
                  onClick: (): void => (value3 ? callback8() : callback7()),
                  children: [
                    "Edit",
                    SpeakerNotesPanelJsx.jsx("i", {
                      "aria-hidden": "true",
                    }),
                  ],
                }),
              ],
            }),
            value3
              ? SpeakerNotesPanelJsx.jsx("textarea", {
                  ref: ref7,
                  "data-notes-scroll": "",
                  "aria-label": "Notes",
                  className: "sn-notes",
                  value: value5?.text ?? "",
                  readOnly: value18 !== undefined,
                  title: value18,
                  maxLength: runtime.maxSlideNotesLength,
                  placeholder:
                    value18 ?? "Speaker notes. Never shown on the slide.",
                  onChange: (event: ChangeEvent<HTMLTextAreaElement>): void => {
                    if (value5 === null || value18 !== undefined) {
                      return;
                    }
                    let value21 = event.target.value;
                    value6({
                      id: value5.id,
                      text: value21,
                    });
                    ref4.current.push(value21);
                    ref6.current.postMessage({
                      type: "notes",
                      id: value5.id,
                      text: value21,
                    });
                  },
                })
              : SpeakerNotesPanelJsx.jsx("div", {
                  ref: ref10,
                  tabIndex: 0,
                  role: "region",
                  "aria-label": "Notes",
                  "data-notes-scroll": "",
                  className: "sn-notes",
                  children: SpeakerNotesPanelJsx.jsx("div", {
                    children:
                      value.notes === ""
                        ? SpeakerNotesPanelJsx.jsx("span", {
                            className: "sn-dim",
                            children: "No notes for this slide.",
                          })
                        : value.notes,
                  }),
                }),
            !value9 && (value.next !== undefined || value10)
              ? SpeakerNotesPanelJsx.jsx("div", {
                  className: "sn-next",
                  children: value10
                    ? SpeakerNotesPanelJsx.jsx("span", {
                        className: "sn-dim",
                        children: "Last slide",
                      })
                    : SpeakerNotesPanelJsx.jsxs(SpeakerNotesPanelJsx.Fragment, {
                        children: [
                          SpeakerNotesPanelJsx.jsx("span", {
                            className: "sn-dim",
                            children: "Next: ",
                          }),
                          value.next,
                        ],
                      }),
                })
              : null,
          ],
        }),
      ],
    });
  }
  function SpeakerSlidePreview({
    slide: slide,
    step: step,
    assets: assets,
    width: width,
  }: SpeakerSlidePreviewProps): ReactElement {
    let ref = runtime.ReactSpeakerNotesPanel.useRef<HTMLDivElement | null>(
      null,
    );
    runtime.ReactSpeakerNotesPanel.useLayoutEffect(() => {
      let current = ref.current;
      if (current === null) {
        return;
      }
      let value =
        step === undefined
          ? new Set<string>()
          : (0, runtime.hiddenBuildFrameIds)(slide, step);
      for (let value2 of slide.frames) {
        let element = current.querySelector<HTMLElement>(
          '[data-frame-id="' + value2.id.replace(/["\\]/g, "") + '"]',
        );
        if (element !== null) {
          element.style.visibility = value.has(value2.id) ? "hidden" : "";
        }
      }
    }, [slide, step, width]);
    return SpeakerNotesPanelJsx.jsx("div", {
      ref: ref,
      children: SpeakerNotesPanelJsx.jsx(runtime.SlideCanvas, {
        slide: slide,
        assets: assets,
        width: width,
        animate: false,
      }),
    });
  }
  function ResponsiveSpeakerSlidePreview({
    win: win,
    className: className,
    children: children,
  }: ResponsiveSpeakerSlidePreviewProps): ReactElement {
    let ref = runtime.ReactSpeakerNotesPanel.useRef<HTMLDivElement | null>(
        null,
      ),
      [value, value2] = runtime.ReactSpeakerNotesPanel.useState(0);
    runtime.ReactSpeakerNotesPanel.useLayoutEffect(() => {
      let current = ref.current;
      if (current === null) {
        return;
      }
      let callback = () => value2(current.clientWidth);
      callback();
      let ResizeObserver2 = win.ResizeObserver;
      if (typeof ResizeObserver2 === "function") {
        let value3 = new ResizeObserver2(callback);
        value3.observe(current);
        return () => value3.disconnect();
      }
      win.addEventListener("resize", callback);
      return () => win.removeEventListener("resize", callback);
    }, [win]);
    return SpeakerNotesPanelJsx.jsx("div", {
      ref: ref,
      className: className,
      "data-appifact-content": "",
      children:
        value > 0
          ? SpeakerNotesPanelJsx.jsx("div", {
              children: children(value),
            })
          : null,
    });
  }
  function SpeakerAdjacentSlide({
    win: win,
    heading: heading,
    slide: slide,
    assets: assets,
    onClick: onClick,
  }: SpeakerAdjacentSlideProps): ReactElement {
    let value = (0, runtime.slideTitleSnippet)(slide, 60);
    return SpeakerNotesPanelJsx.jsxs("div", {
      className: "sn-navcol" + (slide === undefined ? " sn-empty" : ""),
      children: [
        SpeakerNotesPanelJsx.jsxs("span", {
          className: "sn-lbl",
          children: [
            heading,
            value !== ""
              ? SpeakerNotesPanelJsx.jsx("span", {
                  className: "sn-dim",
                  children: " · " + value,
                })
              : null,
          ],
        }),
        SpeakerNotesPanelJsx.jsx("button", {
          type: "button",
          className: "sn-thumb",
          "aria-label": "Go to " + heading.toLowerCase() + " slide",
          title: value !== "" ? value : undefined,
          disabled: slide === undefined,
          onMouseDown: preventSpeakerControlMouseDown,
          onClick: onClick,
          children: SpeakerNotesPanelJsx.jsx(ResponsiveSpeakerSlidePreview, {
            win: win,
            className: "sn-slot",
            children: (input: number) =>
              slide !== undefined
                ? SpeakerNotesPanelJsx.jsx(runtime.SlideCanvas, {
                    slide: slide,
                    assets: assets,
                    width: input,
                    animate: false,
                    structure: false,
                  })
                : null,
          }),
        }),
      ],
    });
  }
  function SpeakerNotesControl({
    label: label,
    disabledReason: disabledReason,
    onClick: onClick,
    children: children,
  }: SpeakerNotesControlProps): ReactElement {
    return SpeakerNotesPanelJsx.jsx("button", {
      type: "button",
      "aria-label": label,
      title: disabledReason ?? label,
      disabled: disabledReason !== undefined,
      onMouseDown: preventSpeakerControlMouseDown,
      onClick: onClick,
      className: "sn-btn",
      children: children,
    });
  }
  bindRuntimeValue(
    runtime,
    "SpeakerNotesPanelJsx",
    () => SpeakerNotesPanelJsx,
    (value) => {
      SpeakerNotesPanelJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPEAKER_NOTES_WIDE_BREAKPOINT",
    () => SPEAKER_NOTES_WIDE_BREAKPOINT,
    (value) => {
      SPEAKER_NOTES_WIDE_BREAKPOINT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPEAKER_NOTES_POPOUT_CSS",
    () => SPEAKER_NOTES_POPOUT_CSS,
    (value) => {
      SPEAKER_NOTES_POPOUT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatSpeakerElapsedTime",
    () => formatSpeakerElapsedTime,
  );
  bindRuntimeValue(
    runtime,
    "SPEAKER_NOTES_SCROLL_KEYS",
    () => SPEAKER_NOTES_SCROLL_KEYS,
    (value) => {
      SPEAKER_NOTES_SCROLL_KEYS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "speakerNotesOwnNavigationKey",
    () => speakerNotesOwnNavigationKey,
  );
  bindRuntimeValue(runtime, "elapsedSpeakerClock", () => elapsedSpeakerClock);
  bindRuntimeValue(
    runtime,
    "preventSpeakerControlMouseDown",
    () => preventSpeakerControlMouseDown,
    (value) => {
      preventSpeakerControlMouseDown = value;
    },
  );
  bindRuntimeValue(runtime, "SpeakerClock", () => SpeakerClock);
  bindRuntimeValue(
    runtime,
    "SPEAKER_NOTES_WIDE_MEDIA_QUERY",
    () => SPEAKER_NOTES_WIDE_MEDIA_QUERY,
    (value) => {
      SPEAKER_NOTES_WIDE_MEDIA_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSpeakerNotesWindowWide",
    () => isSpeakerNotesWindowWide,
  );
  bindRuntimeValue(
    runtime,
    "useSpeakerNotesWindowWide",
    () => useSpeakerNotesWindowWide,
  );
  bindRuntimeValue(runtime, "SpeakerNotesPanel", () => SpeakerNotesPanel);
  bindRuntimeValue(runtime, "SpeakerSlidePreview", () => SpeakerSlidePreview);
  bindRuntimeValue(
    runtime,
    "ResponsiveSpeakerSlidePreview",
    () => ResponsiveSpeakerSlidePreview,
  );
  bindRuntimeValue(runtime, "SpeakerAdjacentSlide", () => SpeakerAdjacentSlide);
  bindRuntimeValue(runtime, "SpeakerNotesControl", () => SpeakerNotesControl);
  return () => {
    (0, runtime.initializeBuildEffects)();
    (0, runtime.initializeSlideRenderer)();
    SpeakerNotesPanelJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    SPEAKER_NOTES_WIDE_BREAKPOINT = 640;
    SPEAKER_NOTES_POPOUT_CSS = [
      ".sn{position:fixed;inset:0;display:flex;flex-direction:column;color-scheme:dark;background:#141413;color:rgba(250,249,245,.9);font-family:system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}",
      ".sn-bar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 16px 8px;font-size:clamp(11px,1.6vw,16px);letter-spacing:.025em;color:#a5a29b;font-variant-numeric:tabular-nums}",
      ".sn-clock{font-weight:600;color:rgba(250,249,245,.9)}",
      ".sn-paused{color:rgba(250,249,245,.38)}",
      ".sn-clock,.sn-head>span:first-child{font-variation-settings:normal}",
      ".sn-btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;flex:none;border:0;border-radius:999px;padding:0;background:transparent;color:rgba(250,249,245,.75);font:inherit;cursor:pointer}",
      ".sn-btn:hover{background:rgba(255,255,255,.1);color:#faf9f5}",
      ".sn-btn:focus-visible,.sn-pill:focus-visible,.sn-thumb:focus-visible,.sn-switch:focus-visible{outline:2px solid #3987e5;outline-offset:-2px}",
      ".sn-thumb:focus-visible{outline-offset:2px}",
      ".sn-btn:disabled,.sn-btn:disabled:hover{background:transparent;color:rgba(250,249,245,.25);cursor:default}",
      ".sn-btn>span{display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;line-height:1}",
      ".sn-pill{flex:none;height:32px;padding:0 12px;border-radius:8px;border:1px solid rgba(250,249,245,.2);background:rgba(255,255,255,.04);color:rgba(250,249,245,.85);font:inherit;font-size:13px;letter-spacing:0;cursor:pointer}",
      ".sn-pill:hover{background:rgba(255,255,255,.1);color:#faf9f5}",
      "@media (pointer:coarse){.sn-pill{height:40px}}",
      ".sn-notes{flex:1 1 0;min-height:0;overflow-y:auto;padding:0 16px 12px;font-size:clamp(15px,2.4vw,26px);line-height:1.625;white-space:pre-wrap;outline:none}",
      ".sn-notes:focus-visible{box-shadow:inset 0 0 0 1px rgba(250,249,245,.3)}",
      "@media (forced-colors:active){.sn-notes:focus-visible{outline:2px solid transparent;outline-offset:-2px}}",
      ".sn-notes>div{max-width:70ch;margin:0 auto}",
      ".sn-next{flex:none;border-top:1px solid rgba(250,249,245,.14);padding:8px 16px;font-size:clamp(12px,1.5vw,16px);color:#a5a29b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".sn-dim{color:rgba(250,249,245,.38)}",
      ".sn-left{flex:none;min-width:0;min-height:0;display:flex;flex-direction:column;box-sizing:border-box}",
      ".sn-right{flex:1 1 0;min-width:0;min-height:0;display:flex;flex-direction:column}",
      ".sn-group{display:inline-flex;align-items:center;gap:12px}",
      ".sn-pos{margin-left:auto;-webkit-user-select:none;user-select:none}",
      ".sn-wide{flex-direction:row}",
      ".sn-wide .sn-left{flex:0 0 58%;gap:12px;padding:12px 16px 16px;overflow-y:auto;border-right:1px solid rgba(250,249,245,.14)}",
      ".sn-wide .sn-bar{padding:0;font-size:14px}",
      ".sn-wide .sn-clock{margin:0 4px 0 0;font-size:28px;letter-spacing:0}",
      ".sn-wide .sn-clock.sn-paused{color:rgba(250,249,245,.38)}",
      ".sn-wide .sn-notes{padding:12px 16px;font-size:clamp(15px,1.6vw,22px)}",
      ".sn-wide .sn-notes>div{margin:0}",
      ".sn-head{flex:none;padding:0 8px 0 16px;height:56px;display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:600;letter-spacing:.02em;color:#a5a29b;border-bottom:1px solid rgba(250,249,245,.14)}",
      ".sn-compact .sn-head{height:40px;font-size:12px;border-bottom:0}",
      ".sn-switch{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:#a5a29b;font:inherit;font-weight:400;letter-spacing:0;cursor:pointer}",
      ".sn-switch:hover{color:#faf9f5}",
      ".sn-switch:disabled,.sn-switch:disabled:hover{color:rgba(250,249,245,.3);cursor:default}",
      ".sn-switch>i{position:relative;width:30px;height:17px;border-radius:999px;background:rgba(250,249,245,.22);transition:background .12s}",
      ".sn-switch>i::after{content:'';position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:#faf9f5;transition:transform .12s}",
      ".sn-switch[aria-checked=true]>i{background:#d97757}",
      ".sn-switch[aria-checked=true]>i::after{transform:translateX(13px)}",
      ".sn-switch:disabled>i{opacity:.4}",
      "textarea.sn-notes{display:block;width:100%;box-sizing:border-box;margin:0;border:0;resize:none;background:transparent;color:inherit;font-family:inherit;caret-color:#d97757}",
      "textarea.sn-notes::placeholder{color:rgba(250,249,245,.38)}",
      ".sn-slot{position:relative;overflow:hidden;aspect-ratio:16/9;border:1px solid rgba(250,249,245,.14);border-radius:6px;background:#000;text-align:initial}",
      ".sn-slot>div{position:absolute;top:0;left:0;pointer-events:none}",
      ".sn-cur{flex:none;max-width:calc((100vh - 120px)*16/9)}",
      ".sn-navrow{flex:none;display:flex;gap:12px}",
      ".sn-navcol{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:4px}",
      ".sn-navcol.sn-empty{visibility:hidden}",
      ".sn-lbl{font-size:11px;letter-spacing:.02em;color:#a5a29b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".sn-thumb{display:block;width:100%;padding:0;border:0;background:transparent;font:inherit;color:inherit;cursor:pointer;border-radius:6px}",
      ".sn-thumb:disabled{cursor:default}",
      ".sn-thumb:hover>.sn-slot{border-color:rgba(250,249,245,.45)}",
    ].join(`
`);
    SPEAKER_NOTES_SCROLL_KEYS = new Set([
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ]);
    preventSpeakerControlMouseDown = (event) => event.preventDefault();
    SPEAKER_NOTES_WIDE_MEDIA_QUERY =
      "(min-width: " + String(SPEAKER_NOTES_WIDE_BREAKPOINT) + "px)";
  };
}
