/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type { SlideId } from "../deck-contracts";
import type { ArtifactChange } from "../documents/artifact-document";
import type {
  SlideDocumentCodec,
  SlideOutlineEntry,
} from "../documents/slide-codec";
import type { AgentActivityState } from "../host/agent-activity";

/** How far the creation sequence has got; "quiet" means there is nothing to show. */
export type CreationPhase =
  | "quiet"
  | "grace"
  | "skeleton"
  | "outline"
  | "arriving"
  | "done";
/** One cell of the slide rail while slides stream in: a placeholder box, or the slide itself. */
export interface CreationCell {
  /** A slide id, or `@first` for the placeholder shown before the outline is known. */
  id: string;
  as: "box" | "slide";
}
/** Where the agent's cursor points. */
export type CreationPlacement =
  | { on: "slide" | "title"; id?: undefined }
  | { on: "cell"; id: string };
/** How the first slide lands on the stage. */
export type CreationSheet = "none" | "grey" | "ground" | "lifting";
/** What the creation sequence decides to show, before the animation state is layered on. */
export interface SlideCreationState {
  phase: CreationPhase;
  cells: CreationCell[] | null;
  /** Slides the outline lists that have not arrived yet. */
  awaited: SlideId[];
  /** Slides that arrived with a placeholder and are still to be revealed. */
  toReveal: SlideId[];
  listed: number;
  cursor: boolean;
  greySlide: boolean;
  addSlideOnStage: boolean;
}
/** What `deriveSlideCreationState` looks at. */
export interface CreationInput {
  on: boolean;
  creating: boolean;
  over: boolean;
  outline: SlideOutlineEntry[];
  working: boolean;
  writing: boolean;
  mayPoint: boolean;
  inGrace: boolean;
  revealed: Set<SlideId>;
  hadBox: Set<SlideId>;
  stripOpen: boolean;
  current: SlideId | null;
}
/** What the overlay and the editor draw for the creation sequence. */
export interface CreationPresentationState {
  phase: CreationPhase;
  cells: CreationCell[] | null;
  listed: number;
  cursor: boolean;
  greySlide: boolean;
  addSlideOnStage: boolean;
  place: CreationPlacement | null;
  glideMs: number;
  /** Whether the cursor label shows rotating tips or the agent's name. */
  tag: "tips" | "name";
  /** The rail cell the cursor is working in. */
  active: string | null;
  growing: boolean;
  title: string;
  titleOn: boolean;
  sheet: CreationSheet;
  landing: SlideId | null;
  fresh: SlideId | null;
  leftover: boolean;
  cursorHidden: boolean;
  toEmptyDeck: boolean;
  fromEmptyDeck: boolean;
  sheetIn: boolean;
  holdsEmptyDeck: boolean;
}
/** Handle of a timer made by `CreationTimers.set`. */
export type CreationTimerHandle = ReturnType<typeof setTimeout>;
/** The clock and timers the creation controller runs on, replaceable in tests. */
export interface CreationTimers {
  now(): number;
  set(callback: () => void, delayMs: number): CreationTimerHandle;
  clear(handle: CreationTimerHandle): void;
  /** Runs the callback after the next paint. */
  painted?(callback: () => void): void;
}
/** The surroundings the sequence adapts to. */
export interface CreationSurroundings {
  readOnly: boolean;
  stripOpen: boolean;
  /** The person prefers reduced motion. */
  calm: boolean;
  current: SlideId | null;
}
/** What the person does that ends the sequence early. */
export type CreationPersonActivity = "structure" | "edit";
/** Drives the creation sequence from the document and the agent's activity. */
export interface SlideCreationController {
  get(): CreationPresentationState;
  subscribe(listener: () => void): () => void;
  loaded(enabled: boolean, outline: SlideOutlineEntry[], readOnly: boolean): void;
  /** The outline changed; `remote` says the change came from another writer. */
  composed(outline: SlideOutlineEntry[], remote: boolean, title: string): void;
  activity(state: AgentActivityState): void;
  surroundings(input: CreationSurroundings): void;
  person(kind: CreationPersonActivity): void;
  counting(): boolean;
  stageTouched(): void;
  dispose(): void;
}
/** The slice of the document the sequence listens to. */
export interface CreationDocument {
  loadState?: () => string;
  subscribeLoad?: (listener: () => void) => () => void;
  readOnly?: () => boolean;
  subscribe(listener: (change?: ArtifactChange) => void): () => void;
}
/** The slice of the slide codec the sequence reads the outline and title from. */
export type CreationOutlineSource = Pick<
  SlideDocumentCodec,
  "metaFields" | "slideOutline"
>;
export interface UseSlideCreationOptions {
  doc: CreationDocument;
  codec: CreationOutlineSource;
  readOnly: boolean;
  stripOpen: boolean;
  current: SlideId | null;
}
/** What `useSlideCreation` hands the editor. */
export interface SlideCreation {
  view: CreationPresentationState;
  person: SlideCreationController["person"];
  stageTouched: SlideCreationController["stageTouched"];
  /** The sequence may draw (placeholders, cursor) for this document. */
  mayDraw: boolean;
  /** The start announcement is still to be spoken. */
  willCount: () => boolean;
  startSaid: () => void;
}
/** Spoken start-of-creation announcement, once per sequence. */
export interface CreationStartAnnouncement {
  spoken: () => boolean;
  markSaid: () => void;
}
export interface CreationStartAnnouncementStep {
  said: boolean;
  /** The number of slides to announce, when an announcement is due. */
  say?: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactCreationController: ReactNamespace;
    QUIET_SLIDE_CREATION_STATE: SlideCreationState;
    deriveSlideCreationState: (input: CreationInput) => SlideCreationState;
    slideCreationTimers: CreationTimers;
    INITIAL_CREATION_PRESENTATION_STATE: CreationPresentationState;
    creationPlacementsEqual: (
      left: CreationPlacement | null,
      right: CreationPlacement | null,
    ) => boolean;
    creationCellsEqual: (
      left: CreationCell[] | null,
      right: CreationCell[] | null,
    ) => boolean;
    creationViewsEqual: (
      left: CreationPresentationState,
      right: CreationPresentationState,
    ) => boolean;
    createSlideCreationController: (
      timers?: CreationTimers,
    ) => SlideCreationController;
    connectSlideCreationController: (
      doc: CreationDocument,
      outlineSource: CreationOutlineSource,
      controller: SlideCreationController,
      turnBusy: () => boolean,
      onChange: () => AgentActivityState,
    ) => () => void;
    useSlideCreation: (options: UseSlideCreationOptions) => SlideCreation;
    useCreationStartAnnouncement: (
      phase: CreationPhase,
      count: number,
    ) => CreationStartAnnouncement;
    reduceCreationStartAnnouncement: (
      said: boolean,
      phase: CreationPhase,
      count: number,
    ) => CreationStartAnnouncementStep;
    formatCreationStartAnnouncement: (count: number) => string;
    creationReducedMotionMediaQuery: MediaQueryList | null | undefined;
    getCreationReducedMotionMediaQuery: () => MediaQueryList | null;
    subscribeCreationReducedMotion: (listener: () => void) => () => void;
    creationPrefersReducedMotion: () => boolean;
  }
}

export function installCreationController(
  runtime: RuntimeBindings,
): () => void {
  var ReactCreationController: ReactNamespace;
  var QUIET_SLIDE_CREATION_STATE: RuntimeBindings["QUIET_SLIDE_CREATION_STATE"];
  var slideCreationTimers: RuntimeBindings["slideCreationTimers"];
  var INITIAL_CREATION_PRESENTATION_STATE: RuntimeBindings["INITIAL_CREATION_PRESENTATION_STATE"];
  var creationPlacementsEqual: RuntimeBindings["creationPlacementsEqual"];
  var creationCellsEqual: RuntimeBindings["creationCellsEqual"];
  var formatCreationStartAnnouncement: RuntimeBindings["formatCreationStartAnnouncement"];
  var creationReducedMotionMediaQuery: RuntimeBindings["creationReducedMotionMediaQuery"];
  var getCreationReducedMotionMediaQuery: RuntimeBindings["getCreationReducedMotionMediaQuery"];
  var creationPrefersReducedMotion: RuntimeBindings["creationPrefersReducedMotion"];
  function deriveSlideCreationState(input: CreationInput): SlideCreationState {
    if (!input.on || !input.creating || input.over) {
      return QUIET_SLIDE_CREATION_STATE;
    }
    let awaitedIds: SlideId[] = input.outline
        .filter(
          (input2: SlideOutlineEntry): boolean =>
            !input2.here && !input2.seenBefore,
        )
        .map((input2: SlideOutlineEntry): SlideId => input2.id),
      presentSlides: SlideOutlineEntry[] = input.outline.filter(
        (input2: SlideOutlineEntry): boolean => input2.here,
      );
    if (input.outline.length === 0) {
      let state = {
        awaited: awaitedIds,
        toReveal: [],
        listed: 0,
        greySlide: true,
        addSlideOnStage: !input.stripOpen,
      };
      if (input.working) {
        return {
          phase: "skeleton",
          ...state,
          cells: input.stripOpen
            ? [
                {
                  id: "@first",
                  as: "box",
                },
              ]
            : null,
          cursor: true,
        };
      }
      if (input.inGrace) {
        return {
          phase: "grace",
          ...state,
          cells: null,
          cursor: false,
        };
      }
      return QUIET_SLIDE_CREATION_STATE;
    }
    let value: SlideId[] = presentSlides
        .filter(
          (input2: SlideOutlineEntry): boolean =>
            input.hadBox.has(input2.id) && !input.revealed.has(input2.id),
        )
        .map((input2: SlideOutlineEntry): SlideId => input2.id),
      value2: boolean =
        (input.writing && awaitedIds.length > 0) || value.length > 0,
      value3: boolean = input.working && input.mayPoint;
    if (!value2) {
      let value8: CreationCell[] | null = input.stripOpen
        ? presentSlides.map(
            (input2: SlideOutlineEntry): CreationCell => ({
              id: input2.id,
              as: "slide",
            }),
          )
        : null;
      if (value3 && input.hadBox.size > 0) {
        return {
          phase: "done",
          cells: value8,
          awaited: awaitedIds,
          toReveal: value,
          listed: 0,
          cursor: true,
          greySlide: false,
          addSlideOnStage: false,
        };
      } else {
        return QUIET_SLIDE_CREATION_STATE;
      }
    }
    let value4: CreationCell[] = input.outline
        .filter(
          (input2: SlideOutlineEntry): boolean =>
            input2.here || (input.writing && !input2.seenBefore),
        )
        .map(
          (input2: SlideOutlineEntry): CreationCell => ({
            id: input2.id,
            as: input2.here && !value.includes(input2.id) ? "slide" : "box",
          }),
        ),
      value5: SlideOutlineEntry | undefined = input.outline[0],
      value6: boolean =
        value5 !== undefined &&
        value.includes(value5.id) &&
        (input.current === null || input.current === value5.id),
      value7: boolean = presentSlides.length === 0 || value6;
    return {
      phase: presentSlides.length === 0 ? "outline" : "arriving",
      cells: input.stripOpen ? value4 : null,
      awaited: awaitedIds,
      toReveal: value,
      listed:
        input.mayPoint && awaitedIds.length > 0
          ? (input.writing ? awaitedIds.length : 0) + value.length
          : 0,
      cursor: value3,
      greySlide: value7,
      addSlideOnStage: value7 && !input.stripOpen,
    };
  }
  function creationViewsEqual(
    left: CreationPresentationState,
    right: CreationPresentationState,
  ): boolean {
    if (left === right) {
      return true;
    }
    for (let value of Object.keys(left) as (keyof CreationPresentationState)[])
      if (
        value === "place"
          ? !creationPlacementsEqual(left.place, right.place)
          : value === "cells"
            ? !creationCellsEqual(left.cells, right.cells)
            : left[value] !== right[value]
      ) {
        return false;
      }
    return true;
  }
  function createSlideCreationController(
    timers: CreationTimers = slideCreationTimers,
  ): SlideCreationController {
    let subscribers: Set<() => void> = new Set(),
      pendingTimers: Set<CreationTimerHandle> = new Set(),
      sequenceTimers: Set<CreationTimerHandle> = new Set(),
      enabled: boolean = false,
      creating: boolean = false,
      finished: boolean = false,
      initialDeckEmpty: boolean = false,
      externalChangesObserved: boolean = false,
      outline: SlideOutlineEntry[] = [],
      title: string = "",
      readOnly: boolean = false,
      stripOpen: boolean = true,
      reducedMotion: boolean = false,
      currentSlideId: SlideId | null = null,
      hostWorking: boolean = false,
      hostWorkingObserved: boolean = false,
      hostWorkingUntil: number = -1,
      outlineWaitUntil: number = -1,
      lastExternalComposeAt: number = -1 / 0,
      lastNewSlideAt: number = -1 / 0,
      externalComposeNoticeShown: boolean = false,
      initialGraceUntil: number = -1,
      revealedSlideIds: Set<SlideId> = new Set(),
      placeholderSlideIds: Set<SlideId> = new Set(),
      emptyStageShown: boolean = false,
      hasListedSlides: boolean = false,
      sequenceBusy: boolean = false,
      cursorPlacement: CreationPlacement | null = null,
      cursorGlideMs: number = 0,
      activeCellId: string | null = null,
      growing: boolean = false,
      titleVisible: boolean = false,
      sheetPhase: CreationSheet = "none",
      landingSlideId: SlideId | null = null,
      freshSlideId: SlideId | null = null,
      ending: boolean = false,
      showLeftover: boolean = false,
      cursorHiddenForInactivity: boolean = false,
      frozenEndingState: SlideCreationState | null = null,
      returningToEmptyDeck: boolean = false,
      emptyDeckSequence: number = 0,
      arrivingFromEmptyDeck: boolean = false,
      emptyDeckTransitionPhase: number = 0,
      ordinaryEmptyDeckShown: boolean = false,
      batchedReveal: { step: number; until: number } | null = null,
      creationState: SlideCreationState = QUIET_SLIDE_CREATION_STATE,
      view: CreationPresentationState = INITIAL_CREATION_PRESENTATION_STATE;
    function resetSequenceState(): void {
      sequenceBusy = false;
      cursorPlacement = null;
      activeCellId = null;
      landingSlideId = null;
      freshSlideId = null;
      sheetPhase = "none";
      ending = false;
      showLeftover = false;
      cursorHiddenForInactivity = false;
      frozenEndingState = null;
      growing = false;
      titleVisible = false;
      batchedReveal = null;
      returningToEmptyDeck = false;
      emptyDeckSequence++;
      arrivingFromEmptyDeck = false;
      emptyDeckTransitionPhase = 0;
    }
    let guardSequenceError = <Args extends unknown[]>(
        input: (...args: Args) => void,
      ): ((...args: Args) => void) =>
        (...input2: Args): void => {
          try {
            input(...input2);
          } catch (value: unknown) {
            console.error(
              "slides: the creation sequence ended on an error",
              value,
            );
            cancelAllTimers();
            resetSequenceState();
            finished = true;
            creationState = QUIET_SLIDE_CREATION_STATE;
            let value2: CreationPresentationState = view;
            view = INITIAL_CREATION_PRESENTATION_STATE;
            if (value2 === INITIAL_CREATION_PRESENTATION_STATE) {
              return;
            }
            for (let value3 of [...subscribers])
              try {
                value3();
              } catch {}
          }
        },
      scheduleSequenceTimer = (
        input: number,
        options: () => void,
        context: Set<CreationTimerHandle> = pendingTimers,
      ): void => {
        let value: CreationTimerHandle = timers.set(
          guardSequenceError((): void => {
            pendingTimers.delete(value);
            sequenceTimers.delete(value);
            options();
          }),
          input,
        );
        context.add(value);
        if (context !== pendingTimers) {
          pendingTimers.add(value);
        }
      },
      timerGeneration: number = 0,
      cancelSequenceTimers = (): void => {
        timerGeneration++;
        for (let value of sequenceTimers) {
          timers.clear(value);
          pendingTimers.delete(value);
        }
        sequenceTimers.clear();
      },
      cancelAllTimers = (): void => {
        timerGeneration++;
        for (let value of pendingTimers) timers.clear(value);
        pendingTimers.clear();
        sequenceTimers.clear();
      },
      hasUnrevealedPlaceholderSlides = (): boolean =>
        hostWorkingObserved &&
        outline.some(
          (input: SlideOutlineEntry): boolean =>
            input.here &&
            placeholderSlideIds.has(input.id) &&
            !revealedSlideIds.has(input.id),
        ),
      hasNewSlidesToReveal = (): boolean =>
        freshSlideId !== null ||
        outline.some(
          (input: SlideOutlineEntry): boolean =>
            input.here
              ? placeholderSlideIds.has(input.id) &&
                !revealedSlideIds.has(input.id)
              : !input.seenBefore,
        ),
      recentExternalCreationActive = (): boolean =>
        !hostWorkingObserved &&
        timers.now() - lastNewSlideAt < runtime.CREATION_STALE_TIMEOUT_MS &&
        hasNewSlidesToReveal(),
      creationWorking = (): boolean =>
        hostWorking ||
        timers.now() < hostWorkingUntil ||
        hasUnrevealedPlaceholderSlides() ||
        recentExternalCreationActive(),
      creationWriting = (): boolean =>
        creationWorking() ||
        (hostWorkingObserved
          ? timers.now() < outlineWaitUntil
          : timers.now() - lastExternalComposeAt <
            runtime.CREATION_SESSION_MAX_AGE_MS),
      isOutlineEmpty = (): boolean =>
        !outline.some((input: SlideOutlineEntry): boolean => input.here),
      currentCreationInput = (): CreationInput => ({
        on: enabled && !readOnly,
        creating: creating,
        over: finished,
        outline: outline,
        working: creationWorking(),
        writing: creationWriting(),
        mayPoint: initialDeckEmpty || externalChangesObserved,
        inGrace: timers.now() < initialGraceUntil,
        revealed: revealedSlideIds,
        hadBox: placeholderSlideIds,
        stripOpen: stripOpen,
        current: currentSlideId,
      }),
      logCreationState = (input: string): void =>
        console.debug(
          "slides: the creation sequence is on for this load; " + input,
        );
    function advanceEmptyDeckTransition(input: number): void {
      if (emptyDeckTransitionPhase === 0 || emptyDeckTransitionPhase >= input) {
        return;
      }
      emptyDeckTransitionPhase = input;
      growing = input === 2 && stripOpen;
      scheduleSequenceTimer(
        input === 2
          ? stripOpen
            ? runtime.CREATION_OUTLINE_HOLD_MS
            : 0
          : runtime.CREATION_EMPTY_DECK_FADE_MS,
        input === 2
          ? (): void => advanceEmptyDeckTransition(3)
          : completeEmptyDeckTransition,
      );
      refreshView();
      if (input === 3) {
        advanceRevealSequence();
      }
    }
    function completeEmptyDeckTransition(): void {
      if (emptyDeckTransitionPhase !== 3) {
        return;
      }
      emptyDeckTransitionPhase = 0;
      arrivingFromEmptyDeck = false;
      refreshView();
    }
    function refreshView(): void {
      let value: SlideCreationState =
        ending && frozenEndingState !== null
          ? frozenEndingState
          : deriveSlideCreationState(currentCreationInput());
      if (
        (emptyDeckTransitionPhase === 1 || emptyDeckTransitionPhase === 2) &&
        !isOutlineEmpty()
      ) {
        emptyDeckTransitionPhase = 3;
        growing = false;
        scheduleSequenceTimer(
          runtime.CREATION_EMPTY_DECK_FADE_MS,
          completeEmptyDeckTransition,
        );
      }
      if (
        (emptyDeckTransitionPhase === 1 || emptyDeckTransitionPhase === 2) &&
        (ending || !value.greySlide)
      ) {
        emptyDeckTransitionPhase = 0;
        growing = false;
        arrivingFromEmptyDeck = false;
      }
      let value2: boolean =
        enabled && !readOnly && creating && isOutlineEmpty();
      if (
        returningToEmptyDeck &&
        (value.phase !== "quiet" || !isOutlineEmpty())
      ) {
        returningToEmptyDeck = false;
        emptyDeckSequence++;
      }
      if (
        !hostWorkingObserved &&
        !readOnly &&
        !finished &&
        value.phase === "quiet" &&
        view.cursor
      ) {
        return beginEndingSequence();
      }
      if (value.phase === "skeleton" || value.phase === "grace") {
        emptyStageShown = true;
      }
      if (value.phase === "quiet" && value2 && !returningToEmptyDeck) {
        ordinaryEmptyDeckShown = true;
        emptyStageShown = false;
      }
      if (!value.greySlide && !isOutlineEmpty()) {
        ordinaryEmptyDeckShown = false;
      }
      if (value.greySlide && ordinaryEmptyDeckShown) {
        ordinaryEmptyDeckShown = false;
        arrivingFromEmptyDeck = !reducedMotion;
        logCreationState(
          value.phase === "skeleton"
            ? "the host said working after the ordinary empty deck was shown"
            : "the slide list arrived after the ordinary empty deck was shown",
        );
        if (arrivingFromEmptyDeck) {
          emptyDeckTransitionPhase = isOutlineEmpty() ? 1 : 3;
          scheduleSequenceTimer(
            runtime.CREATION_EMPTY_DECK_FADE_MS,
            emptyDeckTransitionPhase === 1
              ? (): void => advanceEmptyDeckTransition(2)
              : completeEmptyDeckTransition,
          );
        }
      }
      creationState = value;
      let value3: boolean =
          emptyDeckTransitionPhase === 1 || emptyDeckTransitionPhase === 2,
        value4: boolean = value.phase === "quiet",
        value5: boolean =
          value.cursor ||
          ((cursorHiddenForInactivity || ending || returningToEmptyDeck) &&
            cursorPlacement !== null),
        value6: CreationPresentationState =
          value4 && !returningToEmptyDeck && !arrivingFromEmptyDeck && !value2
            ? INITIAL_CREATION_PRESENTATION_STATE
            : {
                phase: value.phase,
                cells: emptyDeckTransitionPhase === 1 ? null : value.cells,
                listed: value3 ? 0 : value.listed,
                cursor: value.cursor && !cursorHiddenForInactivity && !value3,
                greySlide: value.greySlide && !value3,
                addSlideOnStage: value.addSlideOnStage && !value3,
                place:
                  (!value4 || returningToEmptyDeck) && value5 && !value3
                    ? cursorPlacement
                    : null,
                glideMs: reducedMotion ? 0 : cursorGlideMs,
                tag: value.phase === "skeleton" && !value3 ? "tips" : "name",
                active:
                  value.cursor &&
                  !cursorHiddenForInactivity &&
                  !ending &&
                  !value3 &&
                  cursorPlacement?.on === "cell" &&
                  cursorPlacement.id === activeCellId
                    ? activeCellId
                    : null,
                growing: growing && !reducedMotion,
                title: title,
                titleOn: titleVisible && value.phase === "outline",
                sheet: value3
                  ? "none"
                  : value4
                    ? returningToEmptyDeck
                      ? "grey"
                      : "none"
                    : sheetPhase !== "none"
                      ? sheetPhase
                      : value.greySlide
                        ? "grey"
                        : "none",
                landing: landingSlideId,
                fresh: freshSlideId,
                leftover: showLeftover,
                cursorHidden:
                  cursorHiddenForInactivity || ending || returningToEmptyDeck,
                toEmptyDeck: returningToEmptyDeck,
                fromEmptyDeck: arrivingFromEmptyDeck,
                sheetIn: emptyDeckTransitionPhase === 3,
                holdsEmptyDeck: value2,
              };
      if (creationViewsEqual(view, value6)) {
        return;
      }
      view = value6;
      for (let value7 of [...subscribers]) value7();
    }
    function finishCreation(): void {
      cancelAllTimers();
      let value: boolean =
        view.sheet === "grey" && isOutlineEmpty() && !reducedMotion;
      resetSequenceState();
      finished = true;
      returningToEmptyDeck = value;
      refreshView();
      let value2: number = ++emptyDeckSequence;
      if (returningToEmptyDeck) {
        scheduleSequenceTimer(
          runtime.CREATION_EMPTY_DECK_FADE_MS,
          (): void => {
            if (value2 !== emptyDeckSequence) {
              return;
            }
            returningToEmptyDeck = false;
            refreshView();
          },
        );
      }
    }
    function beginEndingSequence(): void {
      if (ending || finished) {
        return;
      }
      if (creationState.phase === "quiet") {
        return finishCreation();
      }
      cancelAllTimers();
      for (let value3 of outline)
        if (value3.here) {
          revealedSlideIds.add(value3.id);
        }
      let value: boolean = isOutlineEmpty();
      frozenEndingState = {
        ...creationState,
        cells:
          creationState.cells?.map(
            (input: CreationCell): CreationCell =>
              outline.some(
                (input2: SlideOutlineEntry): boolean =>
                  input2.id === input.id && input2.here,
              )
                ? {
                    id: input.id,
                    as: "slide",
                  }
                : input,
          ) ?? null,
        toReveal: [],
        cursor: false,
        greySlide: creationState.greySlide && value,
        addSlideOnStage: creationState.addSlideOnStage && value,
      };
      sequenceBusy = false;
      batchedReveal = null;
      growing = false;
      titleVisible = false;
      activeCellId = null;
      freshSlideId = null;
      sheetPhase = "none";
      landingSlideId = null;
      ending = true;
      refreshView();
      let value2: boolean = frozenEndingState.awaited.length > 0;
      scheduleSequenceTimer(
        value2
          ? runtime.CREATION_COMPLETION_SETTLE_MS
          : runtime.CREATION_CURSOR_FADE_MS + 50,
        (): void => {
          if (!value2) {
            return finishCreation();
          }
          showLeftover = true;
          refreshView();
          scheduleSequenceTimer(
            runtime.CREATION_CURSOR_GLIDE_MS,
            finishCreation,
          );
        },
      );
    }
    function extendHostWorkingGrace(): void {
      if (hostWorking || !hostWorkingObserved) {
        return;
      }
      hostWorkingUntil = Math.max(
        hostWorkingUntil,
        timers.now() + runtime.REMOTE_CHANGE_HOLD_MS,
      );
      outlineWaitUntil = Math.max(
        outlineWaitUntil,
        timers.now() + runtime.CREATION_OUTLINE_WAIT_MS,
      );
      scheduleActivityExpiry();
    }
    function markSlideRevealed(input: SlideId): void {
      let value: boolean = hasUnrevealedPlaceholderSlides();
      revealedSlideIds.add(input);
      freshSlideId = input;
      if (value && !hasUnrevealedPlaceholderSlides()) {
        extendHostWorkingGrace();
      }
    }
    let scheduleNextReveal = (input: number): void =>
      scheduleSequenceTimer(
        input,
        (): void => {
          sequenceBusy = false;
          freshSlideId = null;
          advanceRevealSequence();
        },
        sequenceTimers,
      );
    function advanceRevealSequence(): void {
      if (
        finished ||
        ending ||
        sequenceBusy ||
        emptyDeckTransitionPhase === 1 ||
        emptyDeckTransitionPhase === 2 ||
        !enabled ||
        !creating
      ) {
        return;
      }
      let value: SlideCreationState = deriveSlideCreationState(
        currentCreationInput(),
      );
      if (
        value.phase === "quiet" ||
        value.phase === "grace" ||
        value.phase === "skeleton"
      ) {
        let value9: boolean =
          hasListedSlides &&
          outline.every(
            (input: SlideOutlineEntry): boolean => input.here || input.seenBefore,
          );
        if (value.phase === "quiet" && value9 && !creationWorking()) {
          if (creationState.phase === "quiet") {
            finishCreation();
          } else {
            beginEndingSequence();
          }
        }
        if (value.phase === "skeleton" && cursorPlacement === null) {
          cursorPlacement = {
            on: "slide",
          };
          refreshView();
        }
        return;
      }
      let value2: SlideOutlineEntry | undefined = outline.find(
          (input: SlideOutlineEntry): boolean =>
            input.here &&
            placeholderSlideIds.has(input.id) &&
            !revealedSlideIds.has(input.id),
        ),
        value3: SlideOutlineEntry | undefined =
          value.awaited.length > 0 && creationWriting()
            ? outline.find(
                (input: SlideOutlineEntry): boolean =>
                  !input.here && !input.seenBefore,
              )
            : undefined,
        value4: SlideOutlineEntry | undefined = value2 ?? value3;
      if (value4 === undefined) {
        return refreshView();
      }
      let value5: boolean = outline[0]?.id === value4.id,
        callback = (input: SlideOutlineEntry): CreationPlacement =>
          !input.here &&
          outline[0]?.id === input.id &&
          value.greySlide &&
          title !== ""
            ? {
                on: "title",
              }
            : stripOpen
              ? {
                  on: "cell",
                  id: input.id,
                }
              : {
                  on: "slide",
                };
      if (reducedMotion) {
        for (let value10 of value.toReveal) revealedSlideIds.add(value10);
        let value9: SlideOutlineEntry | undefined = [...outline]
          .reverse()
          .find((input: SlideOutlineEntry): boolean => input.here);
        cursorPlacement = !value.cursor
          ? null
          : value3 !== undefined
            ? callback(value3)
            : stripOpen && value9 !== undefined
              ? {
                  on: "cell",
                  id: value9.id,
                }
              : {
                  on: "slide",
                };
        titleVisible = cursorPlacement?.on === "title";
        activeCellId =
          value.cursor && cursorPlacement?.on === "cell"
            ? cursorPlacement.id
            : null;
        cursorGlideMs = 0;
        freshSlideId = null;
        refreshView();
        if (value3 === undefined && !creationWorking()) {
          beginEndingSequence();
        }
        return;
      }
      let value6: boolean = value4.here && value5 && value.greySlide;
      if (
        value4.here &&
        !value6 &&
        value.toReveal.length > 1 &&
        batchedReveal === null
      ) {
        batchedReveal = {
          step: Math.min(
            runtime.CREATION_SLIDE_ARRIVAL_MS,
            runtime.CREATION_IDLE_PAUSE_MS / value.toReveal.length,
          ),
          until: timers.now() + runtime.CREATION_IDLE_PAUSE_MS,
        };
      }
      if (value.toReveal.length === 0) {
        batchedReveal = null;
      }
      if (value4.here && !value6 && batchedReveal !== null) {
        sequenceBusy = true;
        if (timers.now() >= batchedReveal.until) {
          for (let value9 of value.toReveal) revealedSlideIds.add(value9);
          extendHostWorkingGrace();
          batchedReveal = null;
          freshSlideId = null;
          sequenceBusy = false;
          refreshView();
          return advanceRevealSequence();
        }
        if (value.cursor) {
          cursorPlacement = stripOpen
            ? {
                on: "cell",
                id: value4.id,
              }
            : {
                on: "slide",
              };
          cursorGlideMs = 0;
          activeCellId = null;
        }
        markSlideRevealed(value4.id);
        refreshView();
        return scheduleNextReveal(batchedReveal.step);
      }
      let value7: CreationPlacement = callback(value4),
        value8: boolean = creationPlacementsEqual(cursorPlacement, value7);
      if (
        value.cursor &&
        !value8 &&
        !(value6 && cursorPlacement?.on !== "cell")
      ) {
        sequenceBusy = true;
        cursorGlideMs =
          cursorPlacement === null
            ? 0
            : value7.on === "cell" && cursorPlacement.on === "cell"
              ? runtime.CREATION_INITIAL_GLIDE_MS
              : runtime.CREATION_CURSOR_CORNER_GLIDE_MS;
        cursorPlacement = value7;
        activeCellId = null;
        refreshView();
        scheduleSequenceTimer(
          cursorGlideMs,
          (): void => {
            sequenceBusy = false;
            if (value7.on === "cell") {
              activeCellId = value7.id;
            }
            if (value7.on === "title") {
              titleVisible = true;
            }
            refreshView();
            advanceRevealSequence();
          },
          sequenceTimers,
        );
        return;
      }
      if (!value4.here) {
        return refreshView();
      }
      sequenceBusy = true;
      if (value6) {
        return beginFirstSlideLanding(value4.id);
      }
      markSlideRevealed(value4.id);
      refreshView();
      scheduleNextReveal(
        runtime.CREATION_CURSOR_GLIDE_MS + runtime.CREATION_EMPTY_DECK_HOLD_MS,
      );
    }
    function beginFirstSlideLanding(input: SlideId): void {
      landingSlideId = input;
      let value: number = titleVisible
        ? runtime.CREATION_TITLE_FADE_OUT_MS +
          runtime.CREATION_POST_PAINT_DELAY_MS
        : 0;
      titleVisible = false;
      refreshView();
      let value2: number = timerGeneration,
        flag: boolean = false,
        value3 = guardSequenceError((): void => {
          if (flag || value2 !== timerGeneration || landingSlideId !== input) {
            return;
          }
          flag = true;
          animateFirstSlideLanding(input, value);
        });
      if (!timers.painted) {
        return value3();
      }
      timers.painted(value3);
      scheduleSequenceTimer(
        runtime.CREATION_FIRST_SLIDE_HOLD_MS,
        value3,
        sequenceTimers,
      );
    }
    function animateFirstSlideLanding(input: SlideId, options: number): void {
      scheduleSequenceTimer(
        options,
        (): void => {
          sheetPhase = "ground";
          refreshView();
          scheduleSequenceTimer(
            runtime.CREATION_SHEET_GROUND_MS,
            (): void => {
              let value: boolean =
                stripOpen && creationWorking() && !cursorHiddenForInactivity;
              if (value) {
                cursorPlacement = {
                  on: "cell",
                  id: input,
                };
                cursorGlideMs = runtime.CREATION_CURSOR_CORNER_GLIDE_MS;
                activeCellId = null;
                refreshView();
              } else if (cursorPlacement?.on === "title") {
                cursorPlacement = {
                  on: "slide",
                };
                cursorGlideMs = 0;
                refreshView();
              }
              scheduleSequenceTimer(
                value
                  ? runtime.CREATION_CURSOR_CORNER_GLIDE_MS +
                      runtime.CREATION_POST_PAINT_DELAY_MS
                  : 0,
                (): void => {
                  sheetPhase = "lifting";
                  refreshView();
                  scheduleSequenceTimer(
                    runtime.CREATION_SHEET_LIFT_MS +
                      runtime.CREATION_CURSOR_SHOW_DELAY_MS,
                    (): void => finishSlideLanding(input),
                    sequenceTimers,
                  );
                },
                sequenceTimers,
              );
            },
            sequenceTimers,
          );
        },
        sequenceTimers,
      );
    }
    function finishSlideLanding(input: SlideId): void {
      sheetPhase = "none";
      landingSlideId = null;
      markSlideRevealed(input);
      refreshView();
      scheduleNextReveal(
        runtime.CREATION_CURSOR_GLIDE_MS + runtime.CREATION_EMPTY_DECK_HOLD_MS,
      );
    }
    let activityExpiryTimer: CreationTimerHandle | undefined;
    function scheduleActivityExpiry(): void {
      if (activityExpiryTimer !== undefined) {
        timers.clear(activityExpiryTimer);
        pendingTimers.delete(activityExpiryTimer);
        activityExpiryTimer = undefined;
      }
      if (finished || ending || !enabled || !creating) {
        return;
      }
      let value: number = timers.now(),
        value2: number[] = [
          hostWorkingUntil,
          hostWorkingObserved
            ? outlineWaitUntil
            : lastExternalComposeAt + runtime.CREATION_SESSION_MAX_AGE_MS,
          hostWorkingObserved
            ? -1
            : lastNewSlideAt + runtime.CREATION_STALE_TIMEOUT_MS,
          initialGraceUntil,
        ].filter((input: number): boolean => input > value);
      if (value2.length === 0 || hostWorking) {
        return;
      }
      let value3: CreationTimerHandle = timers.set(
        guardSequenceError((): void => {
          pendingTimers.delete(value3);
          activityExpiryTimer = undefined;
          reconcileActivity();
        }),
        Math.min(...value2) - value + 1,
      );
      activityExpiryTimer = value3;
      pendingTimers.add(value3);
    }
    function reconcileActivity(): void {
      if (finished || ending || !enabled || !creating) {
        return refreshView();
      }
      let value: SlideCreationState = deriveSlideCreationState(
        currentCreationInput(),
      );
      if (
        (creationState.phase === "skeleton" ||
          creationState.phase === "grace") &&
        value.phase === "quiet"
      ) {
        if (creationState.phase === "grace") {
          logCreationState(
            "no word from the host within the short wait: the ordinary empty deck",
          );
        }
        returningToEmptyDeck = !reducedMotion;
        let value2: number = ++emptyDeckSequence;
        if (!returningToEmptyDeck) {
          cursorPlacement = null;
        }
        refreshView();
        if (returningToEmptyDeck) {
          scheduleSequenceTimer(
            runtime.CREATION_EMPTY_DECK_FADE_MS,
            (): void => {
              if (value2 !== emptyDeckSequence) {
                return;
              }
              returningToEmptyDeck = false;
              cursorPlacement = null;
              refreshView();
            },
          );
        }
        return scheduleActivityExpiry();
      }
      if (
        creationState.phase !== "quiet" &&
        (!creationWriting() ||
          (creationState.phase === "done" && !creationWorking()))
      ) {
        return beginEndingSequence();
      }
      if (
        creationState.cursor &&
        !creationWorking() &&
        creationWriting() &&
        creationState.phase !== "done"
      ) {
        cursorHiddenForInactivity = true;
      }
      if (creationWorking()) {
        cursorHiddenForInactivity = false;
      }
      if (creationState.phase === "grace" && value.phase === "skeleton") {
        logCreationState("the host said working within the short wait");
      }
      if (value.phase === "skeleton" && cursorPlacement === null) {
        cursorPlacement = {
          on: "slide",
        };
      }
      refreshView();
      advanceRevealSequence();
      scheduleActivityExpiry();
    }
    let controller: SlideCreationController = {
      get: (): CreationPresentationState => view,
      subscribe(input: () => void): () => void {
        subscribers.add(input);
        return (): void => void subscribers.delete(input);
      },
      loaded(
        input: boolean,
        items: SlideOutlineEntry[],
        context: boolean,
      ): void {
        cancelAllTimers();
        activityExpiryTimer = undefined;
        enabled = input;
        readOnly = context;
        outline = items;
        finished = false;
        initialDeckEmpty = items.every(
          (input2: SlideOutlineEntry): boolean => !input2.here,
        );
        externalChangesObserved = false;
        revealedSlideIds = new Set(
          items
            .filter((input2: SlideOutlineEntry): boolean => input2.here)
            .map((input2: SlideOutlineEntry): SlideId => input2.id),
        );
        placeholderSlideIds = new Set(
          items
            .filter(
              (input2: SlideOutlineEntry): boolean =>
                !input2.here && !input2.seenBefore,
            )
            .map((input2: SlideOutlineEntry): SlideId => input2.id),
        );
        creating = initialDeckEmpty || placeholderSlideIds.size > 0;
        emptyStageShown = false;
        hasListedSlides = items.length > 0;
        resetSequenceState();
        ordinaryEmptyDeckShown = false;
        hostWorkingObserved = hostWorking;
        hostWorkingUntil = -1;
        outlineWaitUntil = -1;
        lastExternalComposeAt = -1 / 0;
        lastNewSlideAt = -1 / 0;
        externalComposeNoticeShown = false;
        initialGraceUntil =
          items.length === 0
            ? timers.now() + runtime.CREATION_OUTLINE_RETRY_MS
            : -1;
        let value: CreationPresentationState = view;
        creationState = QUIET_SLIDE_CREATION_STATE;
        view = INITIAL_CREATION_PRESENTATION_STATE;
        if (value !== INITIAL_CREATION_PRESENTATION_STATE) {
          for (let value2 of [...subscribers]) value2();
        }
        if (enabled && creating && !readOnly) {
          logCreationState(
            (items.length === 0
              ? "an empty deck"
              : "listed slides still to come") +
              (hostWorking
                ? ", and the host already says the agent is working"
                : ", and the host has not said the agent is working"),
          );
        }
        reconcileActivity();
      },
      composed(
        items: SlideOutlineEntry[],
        options: boolean,
        context: string,
      ): void {
        let value: SlideOutlineEntry[] = outline;
        outline = items;
        title = context;
        if (finished || !enabled || !creating) {
          return refreshView();
        }
        let values: Set<SlideId> = new Set(
            value
              .filter((input: SlideOutlineEntry): boolean => input.here)
              .map((input: SlideOutlineEntry): SlideId => input.id),
          ),
          value2: boolean =
            items.some(
              (input: SlideOutlineEntry): boolean =>
                input.here && !values.has(input.id),
            ) ||
            items.length !== value.length ||
            items.some(
              (input: SlideOutlineEntry, options2: number): boolean =>
                value[options2]?.id !== input.id,
            );
        if (ending) {
          for (let value4 of items)
            if (value4.here) {
              revealedSlideIds.add(value4.id);
            }
          let value3: boolean = isOutlineEmpty();
          if (frozenEndingState !== null) {
            frozenEndingState = {
              ...frozenEndingState,
              greySlide: frozenEndingState.greySlide && value3,
              addSlideOnStage: frozenEndingState.addSlideOnStage && value3,
              cells:
                frozenEndingState.cells?.map(
                  (input: CreationCell): CreationCell =>
                    items.some(
                      (input2: SlideOutlineEntry): boolean =>
                        input2.id === input.id && input2.here,
                    )
                      ? {
                          id: input.id,
                          as: "slide",
                        }
                      : input,
                ) ?? null,
            };
          }
          return refreshView();
        }
        if (!hasListedSlides && items.length > 0 && !options) {
          return finishCreation();
        }
        if (options && value2) {
          lastExternalComposeAt = timers.now();
          externalChangesObserved = true;
          let values2: Set<SlideId> = new Set(
            value.map((input: SlideOutlineEntry): SlideId => input.id),
          );
          if (
            items.some(
              (input: SlideOutlineEntry): boolean =>
                !input.seenBefore &&
                (input.here
                  ? placeholderSlideIds.has(input.id) && !values.has(input.id)
                  : !values2.has(input.id)),
            )
          ) {
            lastNewSlideAt = timers.now();
            if (!hostWorkingObserved) {
              cursorHiddenForInactivity = false;
            }
            if (
              !hostWorkingObserved &&
              !readOnly &&
              !externalComposeNoticeShown
            ) {
              logCreationState(
                "the host has not said working: the agent’s cursor follows saves from outside this tab",
              );
            }
            externalComposeNoticeShown = true;
          }
        }
        for (let value3 of items)
          if (!value3.here && !value3.seenBefore) {
            placeholderSlideIds.add(value3.id);
          }
        if (!hasListedSlides && items.length > 0) {
          hasListedSlides = true;
          initialGraceUntil = -1;
          if (emptyStageShown && items[0] !== undefined) {
            placeholderSlideIds.add(items[0].id);
          }
          let value3: boolean =
            emptyDeckTransitionPhase !== 1 &&
            emptyDeckTransitionPhase !== 2 &&
            emptyStageShown &&
            stripOpen &&
            !reducedMotion &&
            items.length > 1;
          if (
            emptyDeckTransitionPhase !== 1 &&
            emptyDeckTransitionPhase !== 2
          ) {
            growing = value3;
          }
          let value4: boolean = items[0]?.here === true;
          sequenceBusy = value3 && !value4;
          refreshView();
          if (value3) {
            scheduleSequenceTimer(
              runtime.CREATION_OUTLINE_HOLD_MS,
              (): void => {
                growing = false;
                if (!value4) {
                  sequenceBusy = false;
                }
                refreshView();
                advanceRevealSequence();
              },
              sequenceTimers,
            );
          }
          if (!sequenceBusy) {
            advanceRevealSequence();
          }
        } else {
          if (
            cursorPlacement?.on === "cell" &&
            !items.some(
              (input: SlideOutlineEntry): boolean =>
                input.id === cursorPlacement!.id,
            ) &&
            (hostWorkingObserved || hasNewSlidesToReveal())
          ) {
            cursorPlacement = null;
            activeCellId = null;
          }
          refreshView();
          advanceRevealSequence();
        }
        scheduleActivityExpiry();
      },
      activity(input: AgentActivityState): void {
        let value: boolean = input === "working";
        if (value === hostWorking) {
          return;
        }
        if (!value) {
          hostWorkingUntil = timers.now() + runtime.REMOTE_CHANGE_HOLD_MS;
          outlineWaitUntil = timers.now() + runtime.CREATION_OUTLINE_WAIT_MS;
        }
        hostWorking = value;
        if (value) {
          hostWorkingObserved = true;
        }
        reconcileActivity();
      },
      surroundings(input: CreationSurroundings): void {
        if (
          input.readOnly === readOnly &&
          input.stripOpen === stripOpen &&
          input.calm === reducedMotion &&
          input.current === currentSlideId
        ) {
          return;
        }
        let value: boolean = input.stripOpen && !stripOpen;
        readOnly = input.readOnly;
        stripOpen = input.stripOpen;
        reducedMotion = input.calm;
        if (input.current !== currentSlideId) {
          if (landingSlideId !== null && input.current !== landingSlideId) {
            cancelSequenceTimers();
            growing = false;
            revealedSlideIds.add(landingSlideId);
            landingSlideId = null;
            sheetPhase = "none";
            sequenceBusy = false;
            freshSlideId = null;
          }
          let value2: boolean =
            currentSlideId === null && outline[0]?.id === input.current;
          if (
            input.current !== null &&
            !value2 &&
            placeholderSlideIds.has(input.current) &&
            outline.some(
              (input2: SlideOutlineEntry): boolean =>
                input2.id === input.current && input2.here,
            )
          ) {
            revealedSlideIds.add(input.current);
          }
        }
        currentSlideId = input.current;
        if (
          value &&
          cursorPlacement?.on === "slide" &&
          creationState.phase !== "skeleton" &&
          (hostWorkingObserved || hasNewSlidesToReveal())
        ) {
          cursorPlacement = null;
        }
        refreshView();
        advanceRevealSequence();
      },
      person(input: CreationPersonActivity): void {
        if (finished || !enabled || !creating) {
          return;
        }
        if (input === "structure" || !hasListedSlides) {
          finishCreation();
        }
      },
      counting: (): boolean => creationState.listed > 0,
      stageTouched(): void {
        if (finished || ending) {
          return;
        }
        if (landingSlideId !== null) {
          let value2: SlideId = landingSlideId;
          cancelSequenceTimers();
          growing = false;
          if (stripOpen && creationWorking() && !cursorHiddenForInactivity) {
            cursorPlacement = {
              on: "cell",
              id: value2,
            };
          }
          cursorGlideMs = 0;
          return finishSlideLanding(value2);
        }
        let value: SlideOutlineEntry | undefined = outline[0];
        if (
          value?.here !== true ||
          !creationState.greySlide ||
          revealedSlideIds.has(value.id)
        ) {
          return;
        }
        cancelSequenceTimers();
        growing = false;
        titleVisible = false;
        sequenceBusy = true;
        cursorPlacement =
          stripOpen && creationWorking() && !cursorHiddenForInactivity
            ? {
                on: "cell",
                id: value.id,
              }
            : null;
        cursorGlideMs = 0;
        finishSlideLanding(value.id);
      },
      dispose(): void {
        cancelAllTimers();
        subscribers.clear();
      },
    };
    return {
      ...controller,
      loaded: guardSequenceError(controller.loaded),
      composed: guardSequenceError(controller.composed),
      activity: guardSequenceError(controller.activity),
      surroundings: guardSequenceError(controller.surroundings),
      person: guardSequenceError(controller.person),
      stageTouched: guardSequenceError(controller.stageTouched),
    };
  }
  // The first parameter is the document, the second the codec reading the outline and title from it, and the
  // third the creation controller they feed (the restored names do not say so).
  function connectSlideCreationController(
    controller: CreationDocument,
    document2: CreationOutlineSource,
    codec: SlideCreationController,
    turnBusy: () => boolean,
    onChange: () => AgentActivityState,
  ): () => void {
    let callback = (): string => {
        let value3: unknown = document2.metaFields()?.title;
        if (typeof value3 === "string") {
          return value3;
        } else {
          return "";
        }
      },
      flag: boolean = true,
      callback2 = (input: boolean): void => {
        try {
          callback3(input);
        } catch (value3: unknown) {
          console.error(
            "slides: the creation sequence could not read the document and has ended",
            value3,
          );
          try {
            codec.loaded(false, [], true);
          } catch {}
        }
      },
      callback3 = (input: boolean): void => {
        let value3: string | undefined = controller.loadState?.();
        if (value3 === "loading" || value3 === "failed") {
          flag = true;
          return;
        }
        if (flag) {
          flag = false;
          let value4: boolean = turnBusy(),
            value5: boolean = controller.readOnly?.() === true;
          if (value4 && !value5) {
            codec.activity(onChange());
          }
          codec.loaded(value4, document2.slideOutline(), value5);
          codec.composed(document2.slideOutline(), false, callback());
        } else {
          codec.composed(document2.slideOutline(), input, callback());
        }
      };
    callback2(false);
    let value: () => void = controller.subscribe(
        (input?: ArtifactChange): void => callback2(input?.remote === true),
      ),
      value2: (() => void) | undefined = controller.subscribeLoad
        ? controller.subscribeLoad((): void => callback2(false))
        : undefined;
    return (): void => {
      value();
      value2?.();
    };
  }
  function useSlideCreation(options: UseSlideCreationOptions): SlideCreation {
    let { doc: document2, codec: codec } = options,
      memo: SlideCreationController = ReactCreationController.useMemo(
        (): SlideCreationController => createSlideCreationController(),
        [document2],
      );
    ReactCreationController.useEffect(
      (): (() => void) => (): void => memo.dispose(),
      [memo],
    );
    let value: boolean = (0, runtime.wasCreationSequenceFlagRequested)(),
      callback = ReactCreationController.useCallback(
        (input: () => void): (() => void) =>
          document2.subscribeLoad
            ? document2.subscribeLoad((): void => input())
            : document2.subscribe((): void => input()),
        [document2],
      ),
      value2: boolean = ReactCreationController.useSyncExternalStore(
        callback,
        (): boolean =>
          document2.loadState?.() !== "loading" &&
          document2.loadState?.() !== "failed",
        (): boolean => false,
      ),
      value3: boolean =
        value &&
        !options.readOnly &&
        value2 &&
        (0, runtime.creationSequenceEnabled)();
    ReactCreationController.useEffect((): (() => void) | void => {
      if (!value3) {
        return memo.activity("unknown");
      }
      let callback2 = (): void =>
        memo.activity(runtime.agentActivityStore.get());
      callback2();
      return runtime.agentActivityStore.subscribe(callback2);
    }, [memo, value3]);
    ReactCreationController.useEffect(
      (): (() => void) =>
        connectSlideCreationController(
          document2,
          codec,
          memo,
          (): boolean => value && (0, runtime.creationSequenceEnabled)(),
          (): AgentActivityState => runtime.agentActivityStore.get(),
        ),
      [document2, codec, memo, value],
    );
    let value4: boolean = ReactCreationController.useSyncExternalStore(
      subscribeCreationReducedMotion,
      creationPrefersReducedMotion,
      (): boolean => false,
    );
    ReactCreationController.useEffect(
      (): void =>
        memo.surroundings({
          readOnly: options.readOnly,
          stripOpen: options.stripOpen,
          calm: value4,
          current: options.current,
        }),
      [memo, options.readOnly, options.stripOpen, value4, options.current],
    );
    let value5: CreationPresentationState =
        ReactCreationController.useSyncExternalStore(
          memo.subscribe,
          memo.get,
          memo.get,
        ),
      { spoken: spoken, markSaid: markSaid }: CreationStartAnnouncement =
        useCreationStartAnnouncement(value5.phase, value5.listed);
    return ReactCreationController.useMemo(
      (): SlideCreation => ({
        view: value5,
        person: memo.person,
        stageTouched: memo.stageTouched,
        mayDraw: value3,
        willCount: (): boolean => memo.counting() && !spoken(),
        startSaid: markSaid,
      }),
      [value5, memo, value3, spoken, markSaid],
    );
  }
  function useCreationStartAnnouncement(
    phase: CreationPhase,
    count: number,
  ): CreationStartAnnouncement {
    let ref = ReactCreationController.useRef(false),
      callback = ReactCreationController.useCallback(
        (): boolean => ref.current,
        [],
      ),
      callback2 = ReactCreationController.useCallback(
        (): void => void (ref.current = true),
        [],
      );
    ReactCreationController.useEffect((): (() => void) | void => {
      let value: CreationStartAnnouncementStep = reduceCreationStartAnnouncement(
        ref.current,
        phase,
        count,
      );
      if (value.say === undefined) {
        ref.current = value.said;
        return;
      }
      let say: number = value.say,
        flag: boolean = true,
        value2: CreationTimerHandle | undefined,
        callback3 = (): void => {
          if (ref.current) {
            return;
          }
          (0, runtime.announceLiveMessage)(
            (): string | null =>
              flag
                ? ((ref.current = true), formatCreationStartAnnouncement(say))
                : null,
            {
              ifIdle: true,
            },
          );
          value2 = setTimeout(callback3, runtime.CREATION_CURSOR_DEPART_MS);
        };
      callback3();
      return (): void => {
        flag = false;
        clearTimeout(value2);
      };
    }, [count, phase]);
    return ReactCreationController.useMemo(
      (): CreationStartAnnouncement => ({
        spoken: callback,
        markSaid: callback2,
      }),
      [callback, callback2],
    );
  }
  function reduceCreationStartAnnouncement(
    said: boolean,
    phase: CreationPhase,
    count: number,
  ): CreationStartAnnouncementStep {
    if (phase === "quiet") {
      return {
        said: false,
      };
    }
    if (count === 0 || said) {
      return {
        said: said,
      };
    }
    return {
      said: true,
      say: count,
    };
  }
  function subscribeCreationReducedMotion(input: () => void): () => void {
    getCreationReducedMotionMediaQuery()?.addEventListener?.("change", input);
    return (): void | undefined =>
      getCreationReducedMotionMediaQuery()?.removeEventListener?.(
        "change",
        input,
      );
  }
  bindRuntimeValue(
    runtime,
    "ReactCreationController",
    () => ReactCreationController,
    (value) => {
      ReactCreationController = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "QUIET_SLIDE_CREATION_STATE",
    () => QUIET_SLIDE_CREATION_STATE,
    (value) => {
      QUIET_SLIDE_CREATION_STATE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "deriveSlideCreationState",
    () => deriveSlideCreationState,
  );
  bindRuntimeValue(
    runtime,
    "slideCreationTimers",
    () => slideCreationTimers,
    (value) => {
      slideCreationTimers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INITIAL_CREATION_PRESENTATION_STATE",
    () => INITIAL_CREATION_PRESENTATION_STATE,
    (value) => {
      INITIAL_CREATION_PRESENTATION_STATE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationPlacementsEqual",
    () => creationPlacementsEqual,
    (value) => {
      creationPlacementsEqual = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationCellsEqual",
    () => creationCellsEqual,
    (value) => {
      creationCellsEqual = value;
    },
  );
  bindRuntimeValue(runtime, "creationViewsEqual", () => creationViewsEqual);
  bindRuntimeValue(
    runtime,
    "createSlideCreationController",
    () => createSlideCreationController,
  );
  bindRuntimeValue(
    runtime,
    "connectSlideCreationController",
    () => connectSlideCreationController,
  );
  bindRuntimeValue(runtime, "useSlideCreation", () => useSlideCreation);
  bindRuntimeValue(
    runtime,
    "useCreationStartAnnouncement",
    () => useCreationStartAnnouncement,
  );
  bindRuntimeValue(
    runtime,
    "reduceCreationStartAnnouncement",
    () => reduceCreationStartAnnouncement,
  );
  bindRuntimeValue(
    runtime,
    "formatCreationStartAnnouncement",
    () => formatCreationStartAnnouncement,
    (value) => {
      formatCreationStartAnnouncement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationReducedMotionMediaQuery",
    () => creationReducedMotionMediaQuery,
    (value) => {
      creationReducedMotionMediaQuery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getCreationReducedMotionMediaQuery",
    () => getCreationReducedMotionMediaQuery,
    (value) => {
      getCreationReducedMotionMediaQuery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeCreationReducedMotion",
    () => subscribeCreationReducedMotion,
  );
  bindRuntimeValue(
    runtime,
    "creationPrefersReducedMotion",
    () => creationPrefersReducedMotion,
    (value) => {
      creationPrefersReducedMotion = value;
    },
  );
  return () => {
    ReactCreationController = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeUiAnnouncements)();
    QUIET_SLIDE_CREATION_STATE = Object.freeze({
      phase: "quiet",
      cells: null,
      awaited: [],
      toReveal: [],
      listed: 0,
      cursor: false,
      greySlide: false,
      addSlideOnStage: false,
    });
    slideCreationTimers = {
      now: (): number => Date.now(),
      set: (input: () => void, options: number): CreationTimerHandle =>
        setTimeout(input, options),
      clear: (input: CreationTimerHandle): void => clearTimeout(input),
      painted: (input: () => void): void =>
        typeof requestAnimationFrame === "function"
          ? void requestAnimationFrame(
              (): number => requestAnimationFrame(input),
            )
          : void setTimeout(input, 0),
    };
    INITIAL_CREATION_PRESENTATION_STATE = Object.freeze({
      phase: "quiet",
      cells: null,
      listed: 0,
      cursor: false,
      greySlide: false,
      addSlideOnStage: false,
      place: null,
      glideMs: 0,
      tag: "name",
      active: null,
      growing: false,
      title: "",
      titleOn: false,
      sheet: "none",
      landing: null,
      fresh: null,
      leftover: false,
      cursorHidden: false,
      toEmptyDeck: false,
      fromEmptyDeck: false,
      sheetIn: false,
      holdsEmptyDeck: false,
    });
    creationPlacementsEqual = (
      input: CreationPlacement | null,
      options: CreationPlacement | null,
    ): boolean =>
      input === options ||
      (input !== null &&
        options !== null &&
        input.on === options.on &&
        (input.on !== "cell" || input.id === options.id));
    creationCellsEqual = (
      items: CreationCell[] | null,
      items2: CreationCell[] | null,
    ): boolean =>
      items === items2 ||
      (items !== null &&
        items2 !== null &&
        items.length === items2.length &&
        items.every(
          (input: CreationCell, options: number): boolean =>
            input.id === items2[options]!.id && input.as === items2[options]!.as,
        ));
    formatCreationStartAnnouncement = (count: number): string =>
      "The agent is adding " +
      String(count) +
      (count === 1 ? " slide" : " slides");
    getCreationReducedMotionMediaQuery = (): MediaQueryList | null =>
      (creationReducedMotionMediaQuery ??=
        typeof matchMedia === "function"
          ? matchMedia("(prefers-reduced-motion: reduce)")
          : null);
    creationPrefersReducedMotion = (): boolean =>
      getCreationReducedMotionMediaQuery()?.matches === true;
  };
}
