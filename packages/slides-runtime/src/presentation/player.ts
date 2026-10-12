/** Restored application module; prepare first, initialize in original order. */
import type {
  FocusEvent as ReactFocusEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactPortal,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactDomNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  Slide,
  SlideNode,
  SlideTransition,
  StyleBag,
} from "../deck-contracts";
import type { SlideDocumentCodec } from "../documents/slide-codec";
import type { NodeStyleKind } from "../model/deck";
import type { SlideAnimationEngine } from "./animation-engine";
import type { BuildEffectTransition } from "./build-effects";
import type { FullscreenOutcome } from "./fullscreen";
import type { PopoutView } from "./popouts";
import type {
  SpeakerPortPayload,
  SpeakerSlideMessage,
} from "./speaker-protocol";

/** Where the show is: the slide index and how many of its build steps are revealed. */
export interface PresentationPosition {
  index: number;
  step: number;
}
/** A slide-to-slide transition in flight, between two positions. */
export interface PresentationTransition {
  from: PresentationPosition;
  to: PresentationPosition;
  kind: SlideTransition;
  back: boolean;
  /** Changes with every transition so React remounts the transition layer. */
  key: number;
}
/** Where the speaker notes are shown: not at all, docked under the slide, or in a separate window. */
export type SpeakerNotesMode = "off" | "panel" | "window";
/** What the host asks of the player at mount: `"next"` (enter fullscreen from a later gesture), a pending request, or nothing. */
export type PresentationFullscreenRequest =
  | "next"
  | Promise<FullscreenOutcome>
  | null;
/** Live editing of a slide's speaker notes from the speaker window. */
export interface NotesEditGesture {
  /** Receives the slide with the notes typed so far. */
  live(slide: Slide): void;
  /** Called with the slide as it was when the edit began, once the edit ends. */
  end(slide: Slide): void;
}
export interface PresentationViewProps {
  slides: Slide[];
  assets: Record<string, string>;
  startIndex: number;
  onExit: (index: number) => void;
  onIndexChange?: (index: number) => void;
  /** Dock the notes under the slide instead of opening a window. */
  dockNotes?: boolean;
  fontCss?: string;
  heldSlide?: SlideDocumentCodec["slideHtmlHold"];
  editNotes?: NotesEditGesture;
  fullscreenRequest?: PresentationFullscreenRequest;
}
export interface PresentationControlButtonProps {
  icon: string;
  label: string;
  pressed?: boolean;
  unavailable?: boolean;
  keys?: string;
  onClick: () => void;
}
export interface PresentationNotesDockProps {
  msg: SpeakerSlideMessage;
  onClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
}
export interface PresentationSlideTransitionProps {
  trans: PresentationTransition;
  slides: readonly Slide[];
  assets: Record<string, string>;
  scale: number;
  /** The layer showing the incoming slide. */
  mainRef: RefObject<HTMLDivElement | null>;
  onDone: () => void;
}
/** A box in slide coordinates (unscaled pixels). */
export interface PresentationRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** The style bag a click on a node replays, with the kind of node that owns it. */
export interface ClickedNodeAnimation {
  bag: StyleBag;
  kind: NodeStyleKind;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactPresentation: ReactNamespace;
    PresentationReactDom: ReactDomNamespace;
    PresentationJsx: JsxNamespace;
    PRESENTATION_CONTROLS_HIDE_DELAY_MS: number;
    PRESENTATION_FOCUSABLE_SELECTOR: string;
    PRESENTATION_NAVIGATION_KEYS: ReadonlySet<string>;
    PRESENTATION_LIVE_REGION_SELECTOR: string;
    presentationModeActive: boolean;
    pendingPresentationFullscreenRequest: Promise<FullscreenOutcome> | null;
    isPresentationNavigationKey: (key: string, slideCount: number) => boolean;
    ensurePresentationFullscreen: () => Promise<FullscreenOutcome>;
    requestPresentationFullscreen: () => Promise<FullscreenOutcome>;
    createSpeakerSlideMessage: (
      slides: readonly Slide[],
      index: number,
      step: number,
      since: number,
    ) => SpeakerSlideMessage;
    frameAttributeSelector: (frameId: string) => string;
    presentationPrefersReducedMotion: () => boolean;
    PresentationView: (props: PresentationViewProps) => ReactPortal | null;
    replayClickedNodeAnimation: (
      slide: Slide | undefined,
      element: Element,
    ) => ClickedNodeAnimation | undefined;
    resolveDottedNodePath: (
      node: SlideNode,
      path: string,
    ) => SlideNode | undefined;
    PresentationControlButton: (
      props: PresentationControlButtonProps,
    ) => ReactElement;
    PresentationNotesDock: (props: PresentationNotesDockProps) => ReactElement;
    presentationElementRect: (
      element: Element,
      originRect: DOMRect,
      scale: number,
    ) => PresentationRect;
    presentationRectInlineStyle: (rect: PresentationRect) => Keyframe;
    presentationRectsApproximatelyEqual: (
      left: PresentationRect,
      right: PresentationRect,
    ) => boolean;
    PresentationSlideTransition: (
      props: PresentationSlideTransitionProps,
    ) => ReactElement | null;
  }
}

export function installPresentationPlayer(
  runtime: RuntimeBindings,
): () => void {
  var ReactPresentation: ReactNamespace;
  var PresentationReactDom: ReactDomNamespace;
  var PresentationJsx: JsxNamespace;
  var PRESENTATION_CONTROLS_HIDE_DELAY_MS: number;
  var PRESENTATION_FOCUSABLE_SELECTOR: string;
  var PRESENTATION_NAVIGATION_KEYS: ReadonlySet<string>;
  var PRESENTATION_LIVE_REGION_SELECTOR: string;
  var presentationModeActive: boolean;
  var pendingPresentationFullscreenRequest: Promise<FullscreenOutcome> | null;
  function isPresentationNavigationKey(
    key: string,
    slideCount: number,
  ): boolean {
    if (PRESENTATION_NAVIGATION_KEYS.has(key)) {
      return true;
    }
    let number = Number(key);
    return Number.isInteger(number) && number >= 1 && number <= slideCount;
  }
  function ensurePresentationFullscreen(): Promise<FullscreenOutcome> {
    if (pendingPresentationFullscreenRequest !== null) {
      return pendingPresentationFullscreenRequest;
    }
    let value: Promise<FullscreenOutcome> = (0, runtime.requestFullscreen)(
      document.documentElement,
    ).then((source: FullscreenOutcome) => {
      if (pendingPresentationFullscreenRequest === value) {
        pendingPresentationFullscreenRequest = null;
      }
      if (source.kind === "entered" && !presentationModeActive) {
        (0, runtime.exitFullscreen)();
      }
      return source;
    });
    pendingPresentationFullscreenRequest = value;
    return value;
  }
  function requestPresentationFullscreen(): Promise<FullscreenOutcome> {
    return ensurePresentationFullscreen();
  }
  function createSpeakerSlideMessage(
    slides: readonly Slide[],
    index: number,
    step: number,
    since: number,
  ): SpeakerSlideMessage {
    let value = Math.max(0, Math.min(slides.length - 1, index)),
      value2 = slides[value],
      value3 = (0, runtime.slideTitleSnippet)(slides[value + 1], 80),
      value4 =
        value2 === undefined ? 0 : (0, runtime.slideBuildCount)(value2);
    return {
      type: "slide",
      index: value,
      count: slides.length,
      since: since,
      step: step,
      notes: (0, runtime.truncateUtf16Safely)(
        (value2?.notes ?? "").trim(),
        runtime.maxSlideNotesLength,
      ),
      ...(value3 === ""
        ? {}
        : {
            next: value3,
          }),
      canPrev: step > 0 || value > 0,
      canNext: step < value4 || value < slides.length - 1,
    };
  }
  function frameAttributeSelector(frameId: string): string {
    return '[data-frame-id="' + frameId.replace(/["\\]/g, "") + '"]';
  }
  function presentationPrefersReducedMotion(): boolean {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }
  function PresentationView({
    slides: slides,
    assets: assets,
    startIndex: startIndex,
    onExit: onExit,
    onIndexChange: onIndexChange,
    dockNotes = false,
    fontCss: fontCss,
    heldSlide: heldSlide,
    editNotes: editNotes,
    fullscreenRequest: fullscreenRequest,
  }: PresentationViewProps): ReactPortal | null {
    let [value, value2] = ReactPresentation.useState<PresentationPosition>(
        () => ({
          index: Math.max(0, Math.min(slides.length - 1, startIndex)),
          step: 0,
        }),
      ),
      value3 = slides.map((input) => input.id),
      ref = ReactPresentation.useRef({
        ids: value3,
        stageId: value3[value.index],
      }),
      value4 = value;
    if (!(0, runtime.presentationOrdersEqual)(value3, ref.current.ids)) {
      let current = ref.current,
        value27 = (0, runtime.preservePresentationSlideIndex)(
          current.ids,
          value3,
          current.stageId,
          value.index,
        );
      if (value27 !== value.index || value3[value27] !== current.stageId) {
        value4 = {
          index: value27,
          step: value3[value27] === current.stageId ? value.step : 0,
        };
      }
    }
    ReactPresentation.useLayoutEffect(() => {
      if (value4.index !== value.index || value4.step !== value.step) {
        value2(value4);
      }
      ref.current = {
        ids: value3,
        stageId: value3[value4.index],
      };
    });
    let index = value4.index,
      [value5, value6] =
        ReactPresentation.useState<PresentationTransition | null>(null),
      [value7, value8] = ReactPresentation.useState(0.5),
      [value9, value10] = ReactPresentation.useState(true),
      [value11, value12] = ReactPresentation.useState(true),
      ref2 = ReactPresentation.useRef<
        ReturnType<typeof setTimeout> | undefined
      >(undefined),
      ref3 = ReactPresentation.useRef(false),
      ref4 = ReactPresentation.useRef<HTMLDivElement | null>(null),
      ref5 = ReactPresentation.useRef<string | null>(null),
      ref6 = ReactPresentation.useRef<string | null>(null),
      ref7 = ReactPresentation.useRef<[number, number] | null>(null),
      ref8 = ReactPresentation.useRef<HTMLDivElement | null>(null),
      ref9 = ReactPresentation.useRef<HTMLDivElement | null>(null),
      value13 = (0, runtime.useSpeakerNotesSession)(),
      [value14, value15] = ReactPresentation.useState<SpeakerNotesMode>(
        () => (value13 !== null ? "window" : dockNotes ? "panel" : "off"),
      ),
      value16 = (0, runtime.useCoarsePointer)(),
      [value17, value18] = ReactPresentation.useState(false),
      ref10 = ReactPresentation.useRef(Date.now()),
      [value19] = ReactPresentation.useState(() =>
        (0, runtime.fullscreenAvailable)(),
      ),
      [value20, value21] = ReactPresentation.useState(
        () => (0, runtime.getFullscreenElement)() !== null,
      ),
      [value22, value23] = ReactPresentation.useState(false),
      ref11 = ReactPresentation.useRef(value20),
      ref12 = ReactPresentation.useRef(false);
    ref12.current = value22;
    let ref13 = ReactPresentation.useRef(0),
      ref14 = ReactPresentation.useRef(false),
      ref15 = ReactPresentation.useRef(false),
      ref16 = ReactPresentation.useRef(
        fullscreenRequest === "next" && (0, runtime.fullscreenAvailable)(),
      ),
      callback = ReactPresentation.useCallback(() => {
        ref14.current = true;
        (0, runtime.exitFullscreen)();
      }, []),
      callback2 = ReactPresentation.useCallback(
        (source: FullscreenOutcome, options: boolean) => {
          if (source.kind === "entered") {
            ref11.current = true;
            ref13.current = Date.now();
          }
          if (source.kind === "denied" && options) {
            value23(true);
          }
        },
        [],
      ),
      callback3 = ReactPresentation.useCallback(() => {
          if (ref2.current !== undefined) {
            clearTimeout(ref2.current);
          }
          ref2.current = setTimeout(() => {
            let current = ref4.current;
            if (
              !(
                ref3.current &&
                current !== null &&
                current.contains(current.ownerDocument.activeElement)
              )
            ) {
              value10(false);
            }
          }, 1800);
        }, []),
      callback4 = ReactPresentation.useCallback(() => {
          value10(true);
          value12(true);
          callback3();
        }, [callback3]),
      ref17 = ReactPresentation.useRef(value4);
    ref17.current = value4;
    let ref18 = ReactPresentation.useRef(value5);
    ref18.current = value5;
    let ref19 = ReactPresentation.useRef(slides);
    ref19.current = slides;
    let ref20 = ReactPresentation.useRef(0),
      callback5 = ReactPresentation.useCallback(
        (input: number) => {
          let value27 = input >= 0 ? 1 : -1,
            current = ref19.current;
          if (current.length === 0) {
            return;
          }
          let current2 = ref17.current;
          if (ref18.current !== null) {
            value6(null);
          }
          let value28 = Math.max(
            0,
            Math.min(current.length - 1, current2.index),
          );
          if (value28 !== current2.index) {
            value2({
              index: value28,
              step: 0,
            });
            return;
          }
          let state: PresentationPosition = {
            index: value28,
            step: Math.min(
              current2.step,
              (0, runtime.slideBuildCount)(current[value28]!),
            ),
          };
          if (state.step !== current2.step) {
            value2(state);
          }
          let value29 = current[state.index];
          if (value29 === undefined) {
            return;
          }
          if (value27 === 1) {
            if (state.step < (0, runtime.slideBuildCount)(value29)) {
              value2({
                index: state.index,
                step: state.step + 1,
              });
              return;
            }
            if (state.index >= current.length - 1) {
              return;
            }
            let state2: PresentationPosition = {
              index: state.index + 1,
              step: 0,
            };
            if (
              value29.transition !== undefined &&
              !presentationPrefersReducedMotion()
            ) {
              value6({
                from: state,
                to: state2,
                kind: value29.transition,
                back: false,
                key: ++ref20.current,
              });
            }
            value2(state2);
          } else {
            if (state.step > 0) {
              value2({
                index: state.index,
                step: state.step - 1,
              });
              return;
            }
            if (state.index <= 0) {
              return;
            }
            let value30 = current[state.index - 1]!,
              state2: PresentationPosition = {
                index: state.index - 1,
                step: (0, runtime.slideBuildCount)(value30),
              };
            if (
              value30.transition !== undefined &&
              !presentationPrefersReducedMotion()
            ) {
              value6({
                from: state,
                to: state2,
                kind: value30.transition,
                back: true,
                key: ++ref20.current,
              });
            }
            value2(state2);
          }
        },
        [],
      ),
      callback6 = ReactPresentation.useCallback(
        (input: number) => {
          value6(null);
          value2({
            index: Math.max(0, Math.min(ref19.current.length - 1, input)),
            step: 0,
          });
        },
        [],
      );
    ReactPresentation.useLayoutEffect(() => {
      let current = ref9.current;
      if (!current) {
        return;
      }
      let callback15 = () =>
        value8(
          Math.min(
            current.clientWidth / runtime.SLIDE_WIDTH,
            current.clientHeight / runtime.SLIDE_HEIGHT,
          ),
        );
      callback15();
      let observer = new ResizeObserver(callback15);
      observer.observe(current);
      return () => observer.disconnect();
    }, []);
    ReactPresentation.useEffect(() => {
      ref9.current?.focus({
        preventScroll: true,
      });
    }, []);
    let value24 = slides[index] !== undefined;
    ReactPresentation.useLayoutEffect(() => {
      let current = ref8.current;
      if (!value24 || !current) {
        return;
      }
      let items: Element[] = [];
      for (let value27 of Array.from(current.ownerDocument.body.children)) {
        if (
          value27 === current ||
          value27.tagName === "SCRIPT" ||
          value27.hasAttribute("inert")
        ) {
          continue;
        }
        if (
          value27.hasAttribute("data-base-ui-portal") &&
          value27.querySelector(PRESENTATION_LIVE_REGION_SELECTOR) !== null
        ) {
          continue;
        }
        value27.setAttribute("inert", "");
        items.push(value27);
      }
      return () => {
        for (let value27 of items) value27.removeAttribute("inert");
      };
    }, [value24]);
    let ref21 = ReactPresentation.useRef(index);
    ref21.current = index;
    let ref22 = ReactPresentation.useRef(callback5);
    ref22.current = callback5;
    let ref23 = ReactPresentation.useRef(callback6);
    ref23.current = callback6;
    let ref24 = ReactPresentation.useRef(onExit);
    ref24.current = onExit;
    ReactPresentation.useEffect(() => {
      onIndexChange?.(index);
    }, [index, onIndexChange]);
    ReactPresentation.useLayoutEffect(() => {
      presentationModeActive = true;
      let callback15 = (input: Element | null) => {
          ref11.current = input !== null;
          value21(input !== null);
        },
        value27 = (0, runtime.subscribeFullscreenChange)(
          (input: Element | null) => {
            callback4();
            callback15(input);
            if (input !== null) {
              ref14.current = false;
              ref15.current = false;
              ref16.current = false;
              value23(false);
              return;
            }
            let value28 =
              ref13.current !== 0 &&
              Date.now() - ref13.current >=
                PRESENTATION_CONTROLS_HIDE_DELAY_MS &&
              !ref14.current &&
              !ref15.current &&
              document.hasFocus();
            ref16.current = ref15.current;
            ref14.current = false;
            ref15.current = false;
            ref13.current = 0;
            if (value28) {
              ref24.current(ref21.current);
            }
          },
        );
      callback15((0, runtime.getFullscreenElement)());
      return () => {
        presentationModeActive = false;
        pendingPresentationFullscreenRequest = null;
        value27();
        (0, runtime.exitFullscreen)();
      };
    }, [callback4]);
    let ref25 = ReactPresentation.useRef(true);
    ReactPresentation.useEffect(() => {
      ref25.current = true;
      return () => {
        ref25.current = false;
      };
    }, []);
    let callback7 = ReactPresentation.useCallback(
        (input: Promise<FullscreenOutcome>, options: boolean) => {
          input.then((input2) => {
            if (ref25.current) {
              callback2(input2, options);
            }
          });
        },
        [callback2],
      ),
      ref26 = ReactPresentation.useRef(
        typeof fullscreenRequest === "object" ? fullscreenRequest : null,
      );
    ReactPresentation.useEffect(() => {
      if (ref26.current !== null) {
        callback7(ref26.current, true);
      }
    }, [callback7]);
    let callback8 = ReactPresentation.useCallback(() => {
          callback4();
          ref16.current = false;
          ref15.current = false;
          if ((0, runtime.getFullscreenElement)() !== null) {
            callback();
            return;
          }
          if (ref12.current) {
            return;
          }
          callback7(ensurePresentationFullscreen(), true);
        }, [callback4, callback7, callback]),
      ref27 = ReactPresentation.useRef(callback8);
    ref27.current = callback8;
    let callback9 = ReactPresentation.useCallback(() => {
          if ((0, runtime.getFullscreenElement)() !== null) {
            ref15.current = false;
          }
          if (!ref16.current) {
            return false;
          }
          ref16.current = false;
          if ((0, runtime.getFullscreenElement)() !== null || ref12.current) {
            return false;
          }
          callback4();
          callback7(ensurePresentationFullscreen(), false);
          return true;
        }, [callback4, callback7]),
      ref28 = ReactPresentation.useRef(callback9);
    ref28.current = callback9;
    let callback10 = ReactPresentation.useCallback(() => {
          ref15.current =
            (0, runtime.getFullscreenElement)() !== null || ref11.current;
        }, []),
      ref29 = ReactPresentation.useRef(slides.length);
    ref29.current = slides.length;
    ReactPresentation.useEffect(() => {
      callback4();
      let callback15 = (event: KeyboardEvent) => {
        if (
          event.key === "Tab" &&
          !event.ctrlKey &&
          !event.metaKey &&
          ref8.current
        ) {
          let current = ref8.current,
            ownerDocument = current.ownerDocument,
            activeElement = ownerDocument.activeElement as HTMLElement | null;
          if (
            activeElement !== null &&
            activeElement !== ownerDocument.body &&
            activeElement !== ownerDocument.documentElement &&
            !current.contains(activeElement)
          ) {
            return;
          }
          let value27: (HTMLElement | null)[] = Array.from(
            current.querySelectorAll<HTMLElement>(
              PRESENTATION_FOCUSABLE_SELECTOR,
            ),
          ).filter(
            (input) =>
              input.tabIndex >= 0 &&
              !input.hasAttribute("disabled") &&
              !input.hasAttribute(runtime.playerBeforeAttribute) &&
              input.closest('[hidden], [inert], [aria-hidden="true"]') ===
                null &&
              ownerDocument.defaultView?.getComputedStyle(input).display !==
                "none",
          );
          event.preventDefault();
          if (value27.length === 0) {
            return;
          }
          let value28 = value27.indexOf(activeElement),
            value29 = event.shiftKey ? value27.length - 1 : 1,
            value30 = event.shiftKey
              ? value28 <= 0
                ? value27.length - 1
                : value28 - 1
              : value28 < 0 || value28 === value27.length - 1
                ? 0
                : value28 + 1;
          for (
            let index2 = 0;
            index2 < value27.length;
            index2++, value30 = (value30 + value29) % value27.length
          )
            if (
              ((0, runtime.focusVideoPlayerElement)(value27[value30]!),
              ownerDocument.activeElement === value27[value30])
            ) {
              break;
            }
          return;
        }
        if (
          event.target instanceof Element &&
          ref8.current?.contains(event.target) &&
          (0, runtime.speakerNotesOwnNavigationKey)(event)
        ) {
          event.stopPropagation();
          return;
        }
        if (
          !event.repeat &&
          !(event.metaKey || event.ctrlKey || event.altKey) &&
          isPresentationNavigationKey(event.key, ref29.current) &&
          ref28.current()
        ) {
          event.preventDefault();
          return;
        }
        switch (event.key) {
          case "ArrowRight":
          case "ArrowDown":
          case "PageDown":
          case " ":
            event.preventDefault();
            ref22.current(1);
            break;
          case "ArrowLeft":
          case "ArrowUp":
          case "PageUp":
            event.preventDefault();
            ref22.current(-1);
            break;
          case "Home":
            event.preventDefault();
            ref23.current(0);
            break;
          case "End":
            event.preventDefault();
            ref23.current(ref29.current - 1);
            break;
          case "Escape":
            event.preventDefault();
            ref24.current(ref21.current);
            break;
          case "f":
          case "F":
            if (
              event.repeat ||
              event.metaKey ||
              event.ctrlKey ||
              event.altKey
            ) {
              break;
            }
            event.preventDefault();
            ref27.current();
            break;
          default: {
            let value27: number = Number(event.key);
            if (
              Number.isInteger(value27) &&
              value27 >= 1 &&
              value27 <= ref29.current
            ) {
              ref23.current(value27 - 1);
            }
          }
        }
      };
      window.addEventListener("keydown", callback15, true);
      return () => {
        window.removeEventListener("keydown", callback15, true);
        if (ref2.current !== undefined) {
          clearTimeout(ref2.current);
        }
      };
    }, [callback4]);
    let callback11 = ReactPresentation.useCallback(
        (input: number) =>
          createSpeakerSlideMessage(
            ref19.current,
            input,
            ref17.current.step,
            ref10.current,
          ),
        [],
      ),
      ref30 = ReactPresentation.useRef(assets);
    ref30.current = assets;
    let ref31 = ReactPresentation.useRef(fontCss);
    ref31.current = fontCss;
    let ref32 = ReactPresentation.useRef(editNotes);
    ref32.current = editNotes;
    let ref33 = ReactPresentation.useRef<Slide | null>(null),
      callback12 =
        ReactPresentation.useCallback(() => {
          let current: Slide | null = ref33.current;
          ref33.current = null;
          if (current !== null) {
            ref32.current?.end(current);
          }
        }, []),
      ref34 = ReactPresentation.useRef(editNotes);
    ReactPresentation.useEffect(() => {
      let current: NotesEditGesture | undefined = ref34.current;
      ref34.current = editNotes;
      if (
        editNotes !== undefined ||
        current === undefined ||
        ref33.current === null
      ) {
        return;
      }
      let current2: Slide = ref33.current;
      ref33.current = null;
      current.end(current2);
    }, [editNotes]);
    let callback13 = ReactPresentation.useCallback(
      (input: PopoutView) =>
        PresentationJsx.jsx(
          runtime.SpeakerNotesPanel,
          {
            first: callback11(ref21.current),
            port: input.peer,
            win: input.win,
            slides: ref19.current,
            assets: ref30.current,
            fontCss: ref31.current,
            canEdit: ref32.current !== undefined,
            ...(heldSlide !== undefined
              ? {
                  heldSlide: heldSlide,
                }
              : {}),
          },
          ref10.current,
        ),
      [callback11, heldSlide],
    );
    ReactPresentation.useLayoutEffect(() => {
      if (value13 === null) {
        return;
      }
      let view = value13.view;
      value13.render(callback13(view));
      view.port.onmessage = (input: MessageEvent<SpeakerPortPayload>) => {
        let value27 = (0, runtime.parseSpeakerNavigateMessage)(input.data),
          value28 = (0, runtime.parseSpeakerJumpMessage)(input.data),
          value29 = (0, runtime.parseSpeakerNotesMessage)(input.data);
        if (value27 !== null) {
          ref22.current(value27.delta);
        } else if (value28 !== null) {
          ref23.current(value28.index);
        } else if ((0, runtime.parseSpeakerExitMessage)(input.data) !== null) {
          ref24.current(ref21.current);
        } else if (
          (0, runtime.parseSpeakerNotesEndMessage)(input.data) !== null
        ) {
          callback12();
        } else if (value29 !== null) {
          let value30: Slide | undefined = ref19.current.find(
              (input2) => input2.id === value29.id,
            ),
            current: NotesEditGesture | undefined = ref32.current;
          if (value30 === undefined || current === undefined) {
            return;
          }
          if (ref33.current?.id !== value30.id) {
            callback12();
            ref33.current = value30;
          }
          current.live(
            (0, runtime.setSlideSpeakerNotes)(
              value30,
              value29.text.trim() === "" ? undefined : value29.text,
            ),
          );
        }
      };
      value15("window");
      return () => {
        view.port.onmessage = null;
        value13.render(null);
        callback12();
        value15((input) => (input === "window" ? "off" : input));
      };
    }, [value13, callback13, callback12]);
    let callback14 =
      ReactPresentation.useCallback(() => {
        callback4();
        if (value13 !== null) {
          value13.close();
          return;
        }
        if (value14 === "panel") {
          value15("off");
          return;
        }
        let value27: boolean =
          (0, runtime.getFullscreenElement)() !== null || ref11.current;
        if (value16 || (!value27 && (0, runtime.isFullscreenOrEntering)())) {
          value15("panel");
          return;
        }
        ref15.current = value27;
        if ((0, runtime.openSpeakerNotes)().kind !== "opened") {
          ref15.current = false;
          value18(true);
          value15("panel");
        }
      }, [callback4, value13, value14, value16]);
    ReactPresentation.useEffect(() => {
      value13?.view.port.postMessage(callback11(index));
    }, [value13, index, value4.step, slides, callback11]);
    ReactPresentation.useEffect(() => {
      if (value13 !== null) {
        value13.render(callback13(value13.view));
      }
    }, [value13, slides, assets, fontCss, editNotes, callback13]);
    let ref35 = ReactPresentation.useRef<HTMLDivElement>(null),
      ref36 = ReactPresentation.useRef(slides[index]);
    ref36.current = slides[index];
    let ref37 = ReactPresentation.useRef<SlideAnimationEngine | null>(
        null,
      ),
      value25 = slides[index] !== undefined;
    ReactPresentation.useEffect(() => {
      let current: HTMLDivElement | null = ref35.current;
      if (!current) {
        return;
      }
      let value27: SlideAnimationEngine = (0, runtime.createSlideAnimationEngine)({
        root: current,
        resolveBag: (input: Element) =>
          replayClickedNodeAnimation(ref36.current, input),
      });
      ref37.current = value27;
      return () => {
        value27.dispose();
        ref37.current = null;
      };
    }, [value25]);
    ReactPresentation.useEffect(() => {
      ref37.current?.refresh();
    }, [value4, slides]);
    let ref38 = ReactPresentation.useRef<PresentationPosition | null>(
        null,
      ),
      ref39 = ReactPresentation.useRef<Animation[]>([]),
      ref40 = ReactPresentation.useRef<
        ReturnType<typeof setTimeout> | undefined
      >(undefined);
    ReactPresentation.useLayoutEffect(() => {
      let current: HTMLDivElement | null = ref35.current,
        value27: Slide | undefined = ref19.current[value4.index];
      if (current === null || value27 === undefined) {
        return;
      }
      let callback15 = (input: string): HTMLElement | null =>
          current.querySelector<HTMLElement>(frameAttributeSelector(input)),
        value28: Set<string> = (0, runtime.hiddenBuildFrameIds)(
          value27,
          value4.step,
        ),
        current2: PresentationPosition | null = ref38.current;
      if (
        current2 !== null &&
        current2.index === value4.index &&
        current2.step === value4.step
      ) {
        let values = new Set(
          ref39.current
            .filter((input) => input.playState === "running")
            .map((input) => (input.effect as KeyframeEffect | null)?.target),
        );
        for (let value31 of value27.frames) {
          let value32: HTMLElement | null = callback15(value31.id);
          if (value32 !== null && !values.has(value32)) {
            value32.style.visibility = value28.has(value31.id) ? "hidden" : "";
          }
        }
        return;
      }
      ref38.current = value4;
      for (let value31 of ref39.current) value31.cancel();
      ref39.current = [];
      for (let value31 of value27.frames) {
        let value32: HTMLElement | null = callback15(value31.id);
        if (value32 !== null) {
          value32.style.visibility = value28.has(value31.id) ? "hidden" : "";
        }
      }
      if (
        current2 !== null &&
        current2.index === value4.index &&
        value4.step === current2.step + 1 &&
        !presentationPrefersReducedMotion()
      ) {
        for (let value31 of (0, runtime.slideBuildStepEffects)(
          value27,
          value4.step,
        )) {
          let value32: HTMLElement | null = callback15(value31.frame.id);
          if (value32 === null) {
            continue;
          }
          let value33: BuildEffectTransition = (0, runtime.buildEffectTransition)(
              value31.effect,
            ),
            value34: string =
              value32.style.transform !== "" &&
              value32.style.transform !== "none"
                ? value32.style.transform
                : "",
            state: Keyframe = {
              transform: (value34 + " " + value33.transform).trim() || "none",
              opacity: 0,
            },
            state2: Keyframe = {
              transform: value34 === "" ? "none" : value34,
              opacity: 1,
            };
          value32.style.visibility = "";
          if (value31.dir === "in") {
            ref39.current.push(
              value32.animate([state, state2], {
                duration: runtime.buildEffectDurationMs,
                easing: value33.easing,
                fill: "none",
              }),
            );
          } else {
            let value35: Animation = value32.animate([state2, state], {
              duration: runtime.buildEffectDurationMs,
              easing: runtime.buildExitEasing,
              fill: "none",
            });
            value35.finished.then(
              () => {
                value32.style.visibility = "hidden";
              },
              () => {
                return;
              },
            );
            ref39.current.push(value35);
          }
        }
      }
      if (ref40.current !== undefined) {
        clearTimeout(ref40.current);
      }
      let value29: boolean =
          current2 !== null &&
          current2.index === value4.index &&
          value4.step < current2.step,
        value30: number = value4.step + 1;
      if (
        !value29 &&
        value30 <= (0, runtime.slideBuildCount)(value27) &&
        (0, runtime.slideBuildStepIsAutomatic)(value27, value30)
      ) {
        let value31: number =
          current2 !== null && current2.index === value4.index
            ? runtime.buildEffectDurationMs + 140
            : 600;
        ref40.current = setTimeout((): void => {
          let current3: PresentationPosition = ref17.current;
          if (
            current3.index === value4.index &&
            current3.step === value4.step
          ) {
            value2({
              index: value4.index,
              step: value30,
            });
          }
        }, value31);
      }
    }, [value4, slides]);
    ReactPresentation.useEffect(
      () => () => {
        if (ref40.current !== undefined) {
          clearTimeout(ref40.current);
        }
      },
      [],
    );
    let value26 = slides[index];
    if (!value26) {
      return null;
    }
    return PresentationReactDom.createPortal(
      PresentationJsx.jsxs("div", {
        ref: ref8,
        tabIndex: -1,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Slide presentation",
        "data-appifact-content": "",
        className: "fixed inset-0 z-50 flex flex-col bg-black outline-none",
        onPointerMove: (input: ReactPointerEvent<HTMLDivElement>): void => {
          let current: [number, number] | null = ref7.current;
          ref7.current = [input.clientX, input.clientY];
          if (input.buttons !== 0) {
            return;
          }
          if (
            current === null ||
            current[0] !== input.clientX ||
            current[1] !== input.clientY
          ) {
            callback4();
          }
        },
        onPointerDownCapture: (input: ReactPointerEvent<HTMLDivElement>): void => {
          ref5.current = input.pointerType;
        },
        onPointerCancelCapture: (input: ReactPointerEvent<HTMLDivElement>): void => {
          ref5.current = null;
          if (input.pointerType === "touch" || input.pointerType === "pen") {
            callback4();
          }
        },
        onClickCapture: (): void => {
          ref6.current = ref5.current;
          ref5.current = null;
        },
        onClick: (input: ReactMouseEvent<HTMLDivElement>): void => {
          let current: string | null = ref6.current;
          if (callback9()) {
            return;
          }
          let value27: DOMRect | undefined = ref4.current?.getBoundingClientRect(),
            value28: boolean =
              value27 !== undefined &&
              input.clientX >= value27.left &&
              input.clientX <= value27.right &&
              input.clientY >= value27.top &&
              input.clientY <= value27.bottom;
          if (current === "touch" || current === "pen" || value28) {
            callback4();
          }
          let bounds: DOMRect = input.currentTarget.getBoundingClientRect();
          callback5(input.clientX < bounds.left + bounds.width / 2 ? -1 : 1);
        },
        children: [
          PresentationJsx.jsxs("div", {
            ref: ref9,
            tabIndex: -1,
            role: "application",
            "aria-label": "Slide show",
            className: "relative min-h-0 flex-1 outline-none",
            children: [
              PresentationJsx.jsxs("div", {
                style: {
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  ["--slide-scale"]: value7,
                  width: runtime.SLIDE_WIDTH,
                  height: runtime.SLIDE_HEIGHT,
                  transform:
                    "translate(-50%, -50%) scale(" + String(value7) + ")",
                  overflow: "hidden",
                },
                children: [
                  PresentationJsx.jsx("div", {
                    ref: ref35,
                    style: {
                      position: "absolute",
                      inset: 0,
                      isolation: "isolate",
                    },
                    children: PresentationJsx.jsx(runtime.SlideSurface, {
                      slide: value26,
                      assets: assets,
                      clips: "all",
                      links: "open",
                      onLinkOpen: callback10,
                      underlay:
                        value5 !== null &&
                        value5.kind === "magic" &&
                        slides[value5.from.index] !== undefined &&
                        slides[value5.from.index]!.bg !== value26.bg
                          ? PresentationJsx.jsx(
                              "div",
                              {
                                "data-bg-veil": "",
                                style: {
                                  position: "absolute",
                                  inset: 0,
                                  background: (0, runtime.slideBackgroundColor)(
                                    slides[value5.from.index]!.bg,
                                  ),
                                },
                              },
                              value5.key,
                            )
                          : undefined,
                    }),
                  }),
                  value5 !== null
                    ? PresentationJsx.jsx(
                        PresentationSlideTransition,
                        {
                          trans: value5,
                          slides: slides,
                          assets: assets,
                          scale: value7,
                          mainRef: ref35,
                          onDone: (): void => value6(null),
                        },
                        value5.key,
                      )
                    : null,
                ],
              }),
              PresentationJsx.jsx(runtime.SlideNavigationAnnouncement, {
                slideKey: value26.id,
                announceMount: true,
                message: (): string =>
                  (0, runtime.formatPresentationSlideAnnouncement)(
                    index,
                    slides.length,
                    (0, runtime.slideTitleSnippet)(value26),
                  ),
              }),
              PresentationJsx.jsxs("div", {
                ref: ref4,
                "data-present-pager": "",
                className:
                  "absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/85 p-2 text-xs text-white shadow-lg transition-opacity duration-300 select-none pointer-coarse:gap-0.5 pointer-coarse:text-body " +
                  (value14 === "panel"
                    ? "bottom-5"
                    : "bottom-[calc(1.25rem+var(--sl-safe-b,0px))]"),
                style: {
                  opacity: value9 ? 1 : 0,
                  pointerEvents: value11 ? "auto" : "none",
                },
                onTransitionEnd: (): void => {
                  if (!value9) {
                    value12(false);
                  }
                },
                onFocus: (event: ReactFocusEvent<HTMLDivElement>): void => {
                  ref3.current = event.target.matches(":focus-visible");
                  callback4();
                },
                onBlur: (): void => {
                  ref3.current = false;
                  callback3();
                },
                onClick: (input: ReactMouseEvent<HTMLDivElement>): void => {
                  input.stopPropagation();
                  callback4();
                },
                children: [
                  PresentationJsx.jsx(PresentationControlButton, {
                    icon: "CaretLeft",
                    label: "Previous",
                    onClick: (): void => callback5(-1),
                  }),
                  PresentationJsx.jsxs("span", {
                    className:
                      "min-w-12 px-1 text-center tabular-nums whitespace-nowrap pointer-coarse:min-w-15",
                    children: [
                      index + 1,
                      PresentationJsx.jsxs("span", {
                        className: "text-white/50",
                        children: [" / ", slides.length],
                      }),
                    ],
                  }),
                  PresentationJsx.jsx(PresentationControlButton, {
                    icon: "CaretRight",
                    label: "Next",
                    onClick: (): void => callback5(1),
                  }),
                  PresentationJsx.jsx("span", {
                    className: "mx-1 h-3.5 w-px bg-white/20",
                  }),
                  (0, runtime.slidesHaveSpeakerNotes)(slides) ||
                  value14 !== "off"
                    ? PresentationJsx.jsx(PresentationControlButton, {
                        icon: "BookText",
                        label:
                          value14 === "off"
                            ? value20 && !value16 && !value17
                              ? "Show speaker notes (leaves full screen—click the slide to return)"
                              : "Show speaker notes"
                            : value14 === "window"
                              ? "Close speaker notes window"
                              : "Hide speaker notes",
                        pressed: value14 !== "off",
                        onClick: callback14,
                      })
                    : null,
                  value19
                    ? PresentationJsx.jsx(PresentationControlButton, {
                        icon: value20 ? "Collapse" : "Expand",
                        label: value20
                          ? "Exit full screen (F)"
                          : value22
                            ? "Full screen isn't available here"
                            : "Full screen (F)",
                        unavailable: value22 && !value20,
                        keys: "F",
                        onClick: callback8,
                      })
                    : null,
                  PresentationJsx.jsx(PresentationControlButton, {
                    icon: "X",
                    label: "Exit (Esc)",
                    onClick: (): void => onExit(index),
                  }),
                ],
              }),
            ],
          }),
          value14 === "panel"
            ? PresentationJsx.jsx(PresentationNotesDock, {
                msg: callback11(index),
                onClick: (input: ReactMouseEvent<HTMLDivElement>): void =>
                  input.stopPropagation(),
              })
            : null,
        ],
      }),
      document.body,
    );
  }
  function replayClickedNodeAnimation(
    slide: Slide | undefined,
    element: Element,
  ): ClickedNodeAnimation | undefined {
    if (!slide) {
      return;
    }
    let value = element
        .closest("[data-frame-id]")
        ?.getAttribute("data-frame-id"),
      attribute = element.getAttribute("data-node-path");
    if (value === undefined || value === null || attribute === null) {
      return;
    }
    let value2 = slide.frames.find((input) => input.id === value);
    if (!value2) {
      return;
    }
    let value3 = resolveDottedNodePath(value2.node, attribute);
    if (!value3 || value3.style === undefined) {
      return;
    }
    let value4 = (0, runtime.nodeStyleKind)(value3);
    if (value4 === undefined) {
      return;
    }
    return {
      bag: value3.style,
      kind: value4,
    };
  }
  function resolveDottedNodePath(
    node: SlideNode,
    path: string,
  ): SlideNode | undefined {
    if (path === "") {
      return node;
    }
    let current: SlideNode | undefined = node;
    for (let value of path.split(".")) {
      if (!current) {
        return;
      }
      let value2 = Number(value),
        value3 = (0, runtime.nodeChildren)(current);
      if (!Number.isInteger(value2) || value2 < 0 || value3 === undefined) {
        return;
      }
      current = value3[value2];
    }
    return current;
  }
  function PresentationControlButton({
    icon: icon,
    label: label,
    pressed: pressed,
    unavailable: unavailable,
    keys: keys,
    onClick: onClick,
  }: PresentationControlButtonProps): ReactElement {
    let value = (0, runtime.useCoarsePointer)();
    return PresentationJsx.jsx(runtime.CdsRoot, {
      mode: "dark",
      className: "contents",
      children: PresentationJsx.jsx(runtime.Button, {
        iconOnly: true,
        variant: "ghost",
        size: value ? undefined : "xs",
        icon: icon,
        "aria-label": label,
        pressed: pressed,
        "aria-disabled": unavailable === true ? true : undefined,
        "aria-keyshortcuts": keys,
        className:
          "aria-disabled:opacity-disabled aria-disabled:[&_[data-cds-part=paint]]:bg-transparent!",
        onClick: onClick,
      }),
    });
  }
  function PresentationNotesDock({
    msg: msg,
    onClick: onClick,
  }: PresentationNotesDockProps): ReactElement {
    let [value, value2] = ReactPresentation.useState(() => Date.now());
    ReactPresentation.useEffect(() => {
      let value5 = setInterval(() => value2(Date.now()), 1000);
      return () => clearInterval(value5);
    }, []);
    let ref = ReactPresentation.useRef<HTMLDivElement | null>(null);
    ReactPresentation.useLayoutEffect(() => {
      if (ref.current !== null) {
        ref.current.scrollTop = 0;
      }
    }, [msg.index]);
    let value3 = msg.index >= msg.count - 1,
      value4 = [
        "Slide " + String(msg.index + 1) + " / " + String(msg.count),
        (0, runtime.formatSpeakerElapsedTime)(value - (msg.since ?? value)),
        value3
          ? "Last slide"
          : msg.next !== undefined
            ? "Next: " + msg.next
            : "",
      ].filter((input) => input !== "");
    return PresentationJsx.jsxs(runtime.CdsRoot, {
      mode: "dark",
      render: PresentationJsx.jsx("div", {
        className:
          "flex h-[30vh] flex-none flex-col border-t bg-surface-panel text-primary",
        onClick: onClick,
      }),
      children: [
        PresentationJsx.jsx("div", {
          className:
            "flex-none px-6 pt-2 pb-1 text-xs tracking-wide text-muted tabular-nums",
          children: PresentationJsx.jsx("div", {
            className: "mx-auto max-w-[720px] truncate",
            children: value4.join(" · "),
          }),
        }),
        PresentationJsx.jsx("div", {
          ref: ref,
          tabIndex: 0,
          role: "region",
          "aria-label": "Notes",
          "data-notes-scroll": "",
          className:
            "min-h-0 flex-1 overflow-y-auto px-6 pb-[calc(1rem+var(--sl-safe-b,0px))] text-sm leading-relaxed whitespace-pre-wrap outline-none focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:ring-inset forced-colors:focus-visible:-outline-offset-2",
          children: PresentationJsx.jsx("div", {
            className: "mx-auto max-w-[720px]",
            children:
              msg.notes === ""
                ? PresentationJsx.jsx("span", {
                    className: "text-muted",
                    children: "No notes for this slide.",
                  })
                : msg.notes,
          }),
        }),
      ],
    });
  }
  function presentationElementRect(
    element: Element,
    originRect: DOMRect,
    scale: number,
  ): PresentationRect {
    let rect = element.getBoundingClientRect();
    return {
      x: (rect.left - originRect.left) / scale,
      y: (rect.top - originRect.top) / scale,
      w: rect.width / scale,
      h: rect.height / scale,
    };
  }
  function presentationRectInlineStyle(rect: PresentationRect): Keyframe {
    return {
      left: String(rect.x) + "px",
      top: String(rect.y) + "px",
      right: "auto",
      bottom: "auto",
      width: String(rect.w) + "px",
      height: String(rect.h) + "px",
      transform: "none",
    };
  }
  function presentationRectsApproximatelyEqual(
    left: PresentationRect,
    right: PresentationRect,
  ): boolean {
    return (
      Math.abs(left.x - right.x) < 0.5 &&
      Math.abs(left.y - right.y) < 0.5 &&
      Math.abs(left.w - right.w) < 0.5 &&
      Math.abs(left.h - right.h) < 0.5
    );
  }
  function PresentationSlideTransition({
    trans: trans,
    slides: slides,
    assets: assets,
    scale: scale,
    mainRef: mainRef,
    onDone: onDone,
  }: PresentationSlideTransitionProps): ReactElement | null {
    let ref = ReactPresentation.useRef<HTMLDivElement>(null),
      ref2 = ReactPresentation.useRef(onDone);
    ref2.current = onDone;
    let value = slides[trans.from.index],
      value2 = slides[trans.to.index];
    ReactPresentation.useLayoutEffect(() => {
      let current: HTMLDivElement | null = ref.current,
        current2: HTMLDivElement | null = mainRef.current;
      if (
        current === null ||
        current2 === null ||
        value === undefined ||
        value2 === undefined
      ) {
        ref2.current();
        return;
      }
      let value3: number = runtime.slideTransitionDurations[trans.kind],
        state: KeyframeAnimationOptions = {
          duration: value3,
          easing: runtime.slideTransitionEasing,
          fill: "forwards",
        },
        items: Animation[] = [],
        callback = (element: Element, options: string): HTMLElement | null =>
          element.querySelector<HTMLElement>(frameAttributeSelector(options)),
        value4: Set<string> = (0, runtime.hiddenBuildFrameIds)(
          value,
          trans.from.step,
        ),
        value5: Set<string> = (0, runtime.hiddenBuildFrameIds)(
          value2,
          trans.to.step,
        );
      for (let value7 of value.frames) {
        let value8: HTMLElement | null = callback(current, value7.id);
        if (value8 === null) {
          continue;
        }
        if (
          value4.has(value7.id) ||
          (0, runtime.countNodeEmbeds)(value7.node) > 0
        ) {
          value8.style.visibility = "hidden";
        }
      }
      if (trans.kind === "fade") {
        items.push(
          current.animate(
            [
              {
                opacity: 1,
              },
              {
                opacity: 0,
              },
            ],
            state,
          ),
        );
      } else if (trans.kind === "push") {
        let value7: number = trans.back
          ? -runtime.SLIDE_WIDTH
          : runtime.SLIDE_WIDTH;
        items.push(
          current.animate(
            [
              {
                transform: "translateX(0px)",
              },
              {
                transform: "translateX(" + String(-value7) + "px)",
              },
            ],
            state,
          ),
        );
        items.push(
          current2.animate(
            [
              {
                transform: "translateX(" + String(value7) + "px)",
              },
              {
                transform: "translateX(0px)",
              },
            ],
            state,
          ),
        );
      } else {
        let element = current2.querySelector("[data-bg-veil]");
        if (element !== null) {
          items.push(
            element.animate(
              [
                {
                  opacity: 1,
                },
                {
                  opacity: 0,
                },
              ],
              state,
            ),
          );
        }
        let bounds: DOMRect = current.getBoundingClientRect(),
          bounds2: DOMRect = current2.getBoundingClientRect(),
          values: Set<string> = new Set(
            value2.frames.map((input): string => input.id),
          ),
          values2: Set<string> = new Set();
        for (let value7 of value.frames) {
          if (value4.has(value7.id)) {
            continue;
          }
          let value8: HTMLElement | null = callback(current, value7.id);
          if (value8 === null) {
            continue;
          }
          let value9: HTMLElement | null =
            values.has(value7.id) && !value5.has(value7.id)
              ? callback(current2, value7.id)
              : null;
          if (value9 === null) {
            if ((0, runtime.countNodeEmbeds)(value7.node) === 0) {
              items.push(
                value8.animate(
                  [
                    {
                      opacity: 1,
                    },
                    {
                      opacity: 0,
                    },
                  ],
                  state,
                ),
              );
            }
            continue;
          }
          values2.add(value7.id);
          value8.style.visibility = "hidden";
          let value10: PresentationRect = presentationElementRect(
              value8,
              bounds,
              scale,
            ),
            value11: PresentationRect = presentationElementRect(
              value9,
              bounds2,
              scale,
            );
          if (presentationRectsApproximatelyEqual(value10, value11)) {
            continue;
          }
          items.push(
            value9.animate(
              [
                presentationRectInlineStyle(value10),
                presentationRectInlineStyle(value11),
              ],
              state,
            ),
          );
        }
        for (let value7 of value2.frames) {
          if (values2.has(value7.id) || value5.has(value7.id)) {
            continue;
          }
          let value8: HTMLElement | null = callback(current2, value7.id);
          if (value8 !== null) {
            items.push(
              value8.animate(
                [
                  {
                    opacity: 0,
                  },
                  {
                    opacity: 1,
                  },
                ],
                state,
              ),
            );
          }
        }
      }
      let flag = false,
        callback2 = (): void => {
          if (!flag) {
            flag = true;
            ref2.current();
          }
        };
      Promise.allSettled(
        items.map((input) => input.finished),
      ).then(callback2);
      let value6: ReturnType<typeof setTimeout> = setTimeout(
        callback2,
        value3 + 250,
      );
      return () => {
        flag = true;
        clearTimeout(value6);
        for (let value7 of items) value7.cancel();
      };
    }, [trans]);
    if (value === undefined || value2 === undefined) {
      return null;
    }
    return PresentationJsx.jsx("div", {
      ref: ref,
      style: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      },
      children: PresentationJsx.jsx(runtime.SlideSurface, {
        slide: value,
        assets: assets,
        animate: false,
        structure: false,
        bgOverride: trans.kind === "magic" ? "transparent" : undefined,
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactPresentation",
    () => ReactPresentation,
    (value) => {
      ReactPresentation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PresentationReactDom",
    () => PresentationReactDom,
    (value) => {
      PresentationReactDom = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PresentationJsx",
    () => PresentationJsx,
    (value) => {
      PresentationJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PRESENTATION_CONTROLS_HIDE_DELAY_MS",
    () => PRESENTATION_CONTROLS_HIDE_DELAY_MS,
    (value) => {
      PRESENTATION_CONTROLS_HIDE_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PRESENTATION_FOCUSABLE_SELECTOR",
    () => PRESENTATION_FOCUSABLE_SELECTOR,
    (value) => {
      PRESENTATION_FOCUSABLE_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PRESENTATION_NAVIGATION_KEYS",
    () => PRESENTATION_NAVIGATION_KEYS,
    (value) => {
      PRESENTATION_NAVIGATION_KEYS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPresentationNavigationKey",
    () => isPresentationNavigationKey,
  );
  bindRuntimeValue(
    runtime,
    "PRESENTATION_LIVE_REGION_SELECTOR",
    () => PRESENTATION_LIVE_REGION_SELECTOR,
    (value) => {
      PRESENTATION_LIVE_REGION_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "presentationModeActive",
    () => presentationModeActive,
    (value) => {
      presentationModeActive = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pendingPresentationFullscreenRequest",
    () => pendingPresentationFullscreenRequest,
    (value) => {
      pendingPresentationFullscreenRequest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ensurePresentationFullscreen",
    () => ensurePresentationFullscreen,
  );
  bindRuntimeValue(
    runtime,
    "requestPresentationFullscreen",
    () => requestPresentationFullscreen,
  );
  bindRuntimeValue(
    runtime,
    "createSpeakerSlideMessage",
    () => createSpeakerSlideMessage,
  );
  bindRuntimeValue(
    runtime,
    "frameAttributeSelector",
    () => frameAttributeSelector,
  );
  bindRuntimeValue(
    runtime,
    "presentationPrefersReducedMotion",
    () => presentationPrefersReducedMotion,
  );
  bindRuntimeValue(runtime, "PresentationView", () => PresentationView);
  bindRuntimeValue(
    runtime,
    "replayClickedNodeAnimation",
    () => replayClickedNodeAnimation,
  );
  bindRuntimeValue(
    runtime,
    "resolveDottedNodePath",
    () => resolveDottedNodePath,
  );
  bindRuntimeValue(
    runtime,
    "PresentationControlButton",
    () => PresentationControlButton,
  );
  bindRuntimeValue(
    runtime,
    "PresentationNotesDock",
    () => PresentationNotesDock,
  );
  bindRuntimeValue(
    runtime,
    "presentationElementRect",
    () => presentationElementRect,
  );
  bindRuntimeValue(
    runtime,
    "presentationRectInlineStyle",
    () => presentationRectInlineStyle,
  );
  bindRuntimeValue(
    runtime,
    "presentationRectsApproximatelyEqual",
    () => presentationRectsApproximatelyEqual,
  );
  bindRuntimeValue(
    runtime,
    "PresentationSlideTransition",
    () => PresentationSlideTransition,
  );
  return () => {
    (0, runtime.initializeSlideRenderer)();
    ReactPresentation = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    PresentationReactDom = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    PresentationJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    PRESENTATION_CONTROLS_HIDE_DELAY_MS = 3000;
    PRESENTATION_FOCUSABLE_SELECTOR =
      "button, [href], input, select, textarea, summary, iframe, [contenteditable], [tabindex]";
    PRESENTATION_NAVIGATION_KEYS = new Set([
      "ArrowRight",
      "ArrowDown",
      "PageDown",
      " ",
      "ArrowLeft",
      "ArrowUp",
      "PageUp",
      "Home",
      "End",
    ]);
    PRESENTATION_LIVE_REGION_SELECTOR =
      '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"], [data-cds="Toast"]';
    presentationModeActive = false;
    pendingPresentationFullscreenRequest = null;
  };
}
