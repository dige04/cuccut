/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { SlideId } from "../deck-contracts";

/** What the active-slide protection tracks to decide whether remote edits to the open slide must wait. */
export interface ActiveSlideProtectionState {
  /** The slide on screen. */
  current: SlideId | undefined;
  /** A text caret is in the slide. */
  caret: boolean;
  /** A pointer gesture is in progress. */
  gesture: boolean;
  /** The last local input, and when it happened. */
  last: { id: SlideId | undefined; at: number } | null;
  now: number;
}

/** Clock and timer functions the protection uses; replaced in tests. */
export interface ActiveSlideProtectionTimers {
  now(): number;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number | undefined): void;
}

/** Holds incoming remote changes to the slide being edited, and releases them when editing pauses. */
export interface ActiveSlideProtection {
  /** The visible slide or the caret state changed. */
  stage(slideId: SlideId | undefined, caret: boolean): void;
  /** A local input happened; `gesture` starts (true) or ends (false) a pointer gesture. */
  input(slideId: SlideId | undefined, gesture?: boolean): void;
  /** Re-evaluate now. */
  poke(): void;
  dispose(): void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    MAX_ACTIVE_SLIDE_PROTECTION_MS: number;
    ACTIVE_SLIDE_IDLE_RELEASE_MS: number;
    activeSlideProtectionRemaining: (
      state: ActiveSlideProtectionState,
    ) => number;
    protectedSlideId: SlideId | null;
    protectedSlideDocumentPath: () => string | null;
    activeEditingSlideId: SlideId | null;
    recentlyEditingSlideId: SlideId | null;
    recentSlideBusyPredicate: (() => boolean) | undefined;
    setRecentSlideBusyPredicate: (
      predicate: (() => boolean) | undefined,
    ) => void;
    activeEditingDocumentPath: () => string | null;
    setProtectedSlideId: (slideId: SlideId | null) => string | null;
    activeSlideProtectionTimers: ActiveSlideProtectionTimers;
    createActiveSlideProtection: (
      release: (documentPath: string) => void,
      timers?: ActiveSlideProtectionTimers,
    ) => ActiveSlideProtection;
  }
}

export function installDocumentsEditProtection(
  runtime: RuntimeBindings,
): () => void {
  var MAX_ACTIVE_SLIDE_PROTECTION_MS: number;
  var ACTIVE_SLIDE_IDLE_RELEASE_MS: number;
  var protectedSlideId: SlideId | null;
  var activeEditingSlideId: SlideId | null;
  var recentlyEditingSlideId: SlideId | null;
  var recentSlideBusyPredicate: (() => boolean) | undefined;
  var activeSlideProtectionTimers: ActiveSlideProtectionTimers;
  function activeSlideProtectionRemaining(
    state: ActiveSlideProtectionState,
  ): number {
    if (state.current === undefined || !(state.caret || state.gesture)) {
      return 0;
    }
    if (state.last === null || state.last.id !== state.current) {
      return 0;
    }
    return Math.max(
      0,
      MAX_ACTIVE_SLIDE_PROTECTION_MS - (state.now - state.last.at),
    );
  }
  function protectedSlideDocumentPath(): string | null {
    if (protectedSlideId === null) {
      return null;
    } else {
      return runtime.SLIDE_STORE_COLLECTION + "/" + protectedSlideId;
    }
  }
  function setRecentSlideBusyPredicate(
    input: (() => boolean) | undefined,
  ): void {
    recentSlideBusyPredicate = input;
  }
  function activeEditingDocumentPath(): string | null {
    let value =
      activeEditingSlideId !== null
        ? activeEditingSlideId
        : recentSlideBusyPredicate?.() === true
          ? recentlyEditingSlideId
          : null;
    if (value === null) {
      return null;
    } else {
      return runtime.SLIDE_STORE_COLLECTION + "/" + value;
    }
  }
  function setProtectedSlideId(input: SlideId | null): string | null {
    let value = protectedSlideDocumentPath();
    protectedSlideId = input;
    if (value !== protectedSlideDocumentPath()) {
      return value;
    } else {
      return null;
    }
  }
  function createActiveSlideProtection(
    input: (documentPath: string) => void,
    options: ActiveSlideProtectionTimers = activeSlideProtectionTimers,
  ): ActiveSlideProtection {
    let state: ActiveSlideProtectionState = {
      current: undefined,
      caret: false,
      gesture: false,
      last: null,
      now: 0,
    };
    activeEditingSlideId = null;
    recentlyEditingSlideId = null;
    let value: number | undefined,
      value2: number | undefined,
      callback = (): void => {
        options.clearTimeout(value);
        value = undefined;
        state.now = options.now();
        let value3 = activeSlideProtectionRemaining(state),
          value4 = activeEditingDocumentPath();
        recentlyEditingSlideId = state.current ?? null;
        activeEditingSlideId =
          state.current !== undefined &&
          (state.gesture || recentSlideBusyPredicate?.() === true)
            ? state.current
            : null;
        let value5 = setProtectedSlideId(
          value3 > 0 && state.current !== undefined ? state.current : null,
        );
        if (value5 !== null) {
          input(value5);
        }
        if (
          value4 !== null &&
          value4 !== activeEditingDocumentPath() &&
          value4 !== value5
        ) {
          input(value4);
        }
        if (value3 > 0) {
          value = options.setTimeout(callback, value3);
        }
      };
    return {
      stage(input2: SlideId | undefined, options2: boolean): void {
        if (input2 === state.current && options2 === state.caret) {
          return;
        }
        state.current = input2;
        state.caret = options2;
        callback();
      },
      input(input2: SlideId | undefined, options2?: boolean): void {
        state.last = {
          id: input2,
          at: options.now(),
        };
        if (options2 !== undefined) {
          state.gesture = options2;
          options.clearTimeout(value2);
          value2 = options2
            ? options.setTimeout((): void => {
                state.gesture = false;
                callback();
              }, ACTIVE_SLIDE_IDLE_RELEASE_MS)
            : undefined;
        }
        callback();
      },
      poke: callback,
      dispose(): void {
        options.clearTimeout(value);
        options.clearTimeout(value2);
        let value3 = activeEditingDocumentPath();
        activeEditingSlideId = null;
        recentlyEditingSlideId = null;
        let value4 = setProtectedSlideId(null);
        if (value4 !== null) {
          input(value4);
        }
        if (value3 !== null && value3 !== value4) {
          input(value3);
        }
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "MAX_ACTIVE_SLIDE_PROTECTION_MS",
    () => MAX_ACTIVE_SLIDE_PROTECTION_MS,
    (value) => {
      MAX_ACTIVE_SLIDE_PROTECTION_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ACTIVE_SLIDE_IDLE_RELEASE_MS",
    () => ACTIVE_SLIDE_IDLE_RELEASE_MS,
    (value) => {
      ACTIVE_SLIDE_IDLE_RELEASE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeSlideProtectionRemaining",
    () => activeSlideProtectionRemaining,
  );
  bindRuntimeValue(
    runtime,
    "protectedSlideId",
    () => protectedSlideId,
    (value) => {
      protectedSlideId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "protectedSlideDocumentPath",
    () => protectedSlideDocumentPath,
  );
  bindRuntimeValue(
    runtime,
    "activeEditingSlideId",
    () => activeEditingSlideId,
    (value) => {
      activeEditingSlideId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "recentlyEditingSlideId",
    () => recentlyEditingSlideId,
    (value) => {
      recentlyEditingSlideId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "recentSlideBusyPredicate",
    () => recentSlideBusyPredicate,
    (value) => {
      recentSlideBusyPredicate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setRecentSlideBusyPredicate",
    () => setRecentSlideBusyPredicate,
  );
  bindRuntimeValue(
    runtime,
    "activeEditingDocumentPath",
    () => activeEditingDocumentPath,
  );
  bindRuntimeValue(runtime, "setProtectedSlideId", () => setProtectedSlideId);
  bindRuntimeValue(
    runtime,
    "activeSlideProtectionTimers",
    () => activeSlideProtectionTimers,
    (value) => {
      activeSlideProtectionTimers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createActiveSlideProtection",
    () => createActiveSlideProtection,
  );
  return () => {
    (0, runtime.initializeUiAnnouncements)();
    MAX_ACTIVE_SLIDE_PROTECTION_MS = 30000;
    ACTIVE_SLIDE_IDLE_RELEASE_MS = 4000;
    protectedSlideId = null;
    activeEditingSlideId = null;
    recentlyEditingSlideId = null;
    activeSlideProtectionTimers = {
      now: (): number => Date.now(),
      setTimeout: (input: () => void, options: number): number =>
        window.setTimeout(input, options),
      clearTimeout: (input: number | undefined): void =>
        window.clearTimeout(input),
    };
  };
}
