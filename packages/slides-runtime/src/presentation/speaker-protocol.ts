/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Presenter to speaker window: where the presentation is and what the notes say. */
export interface SpeakerSlideMessage {
  type: "slide";
  index: number;
  count: number;
  notes: string;
  /** Title of the next slide, when it has one. */
  next?: string;
  /** Epoch milliseconds the presentation clock started at. */
  since?: number;
  /** Build step shown on the current slide. */
  step?: number;
  canPrev?: boolean;
  canNext?: boolean;
}
/** Speaker window to presenter: leave the presentation. */
export interface SpeakerExitMessage {
  type: "exit";
}
/** Speaker window to presenter: go to a slide by index. */
export interface SpeakerJumpMessage {
  type: "jump";
  index: number;
}
/** Speaker window to presenter: the notes of a slide were edited. */
export interface SpeakerNotesMessage {
  type: "notes";
  id: string;
  text: string;
}
/** Speaker window to presenter: notes editing finished. */
export interface SpeakerNotesEndMessage {
  type: "notes-end";
}
/** Speaker window to presenter: step to the previous or next slide. */
export interface SpeakerNavigateMessage {
  type: "nav";
  delta: 1 | -1;
}
/**
 * A message received over the speaker port before validation: any structured-clone value; objects are read as
 * records of unknown fields.
 */
export type SpeakerPortPayload =
  | Record<string, unknown>
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

declare module "../bindings" {
  interface RuntimeBindings {
    SPEAKER_NOTES_POPOUT_KEY: string;
    SPEAKER_MESSAGE_TITLE_MAX_CHARS: number;
    SPEAKER_NOTES_ID_PATTERN: RegExp;
    parseBoundedInteger: (
      value: unknown,
      min: number,
      max: number,
    ) => number | null;
    parseSpeakerSlideMessage: (
      value: SpeakerPortPayload,
    ) => SpeakerSlideMessage | null;
    parseSpeakerExitMessage: (
      value: SpeakerPortPayload,
    ) => SpeakerExitMessage | null;
    parseSpeakerJumpMessage: (
      value: SpeakerPortPayload,
    ) => SpeakerJumpMessage | null;
    parseSpeakerNotesMessage: (
      value: SpeakerPortPayload,
    ) => SpeakerNotesMessage | null;
    parseSpeakerNotesEndMessage: (
      value: SpeakerPortPayload,
    ) => SpeakerNotesEndMessage | null;
    parseSpeakerNavigateMessage: (
      value: SpeakerPortPayload,
    ) => SpeakerNavigateMessage | null;
  }
}

export function installPresentationSpeakerProtocol(
  runtime: RuntimeBindings,
): () => void {
  var SPEAKER_NOTES_POPOUT_KEY: RuntimeBindings["SPEAKER_NOTES_POPOUT_KEY"];
  var SPEAKER_MESSAGE_TITLE_MAX_CHARS: RuntimeBindings["SPEAKER_MESSAGE_TITLE_MAX_CHARS"];
  var SPEAKER_NOTES_ID_PATTERN: RuntimeBindings["SPEAKER_NOTES_ID_PATTERN"];
  function parseBoundedInteger(
    value: unknown,
    min: number,
    max: number,
  ): number | null {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max
    ) {
      return value;
    } else {
      return null;
    }
  }
  function parseSpeakerSlideMessage(
    value: SpeakerPortPayload,
  ): SpeakerSlideMessage | null {
    let message: Record<string, unknown> | null =
      typeof value === "object" && value !== null ? value : null;
    if (message === null || message.type !== "slide") {
      return null;
    }
    let count: number | null = parseBoundedInteger(message.count, 1, 1e4);
    if (count === null) {
      return null;
    }
    let index: number | null = parseBoundedInteger(message.index, 0, count - 1);
    if (index === null) {
      return null;
    }
    if (typeof message.notes !== "string") {
      return null;
    }
    let state: SpeakerSlideMessage = {
      type: "slide",
      index: index,
      count: count,
      notes: (0, runtime.truncateUtf16Safely)(
        message.notes,
        runtime.maxSlideNotesLength,
      ),
    };
    if (typeof message.next === "string" && message.next.trim() !== "") {
      state.next = (0, runtime.truncateUtf16Safely)(
        message.next,
        SPEAKER_MESSAGE_TITLE_MAX_CHARS,
      );
    }
    let value2: number | null = parseBoundedInteger(
      message.since,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    if (value2 !== null) {
      state.since = value2;
    }
    let value3: number | null = parseBoundedInteger(
      message.step,
      0,
      runtime.maxBuildOrder,
    );
    if (value3 !== null) {
      state.step = value3;
    }
    if (typeof message.canPrev === "boolean") {
      state.canPrev = message.canPrev;
    }
    if (typeof message.canNext === "boolean") {
      state.canNext = message.canNext;
    }
    return state;
  }
  function parseSpeakerExitMessage(
    value: SpeakerPortPayload,
  ): SpeakerExitMessage | null {
    let message: Record<string, unknown> | null =
      typeof value === "object" && value !== null ? value : null;
    if (message !== null && message.type === "exit") {
      return {
        type: "exit",
      };
    } else {
      return null;
    }
  }
  function parseSpeakerJumpMessage(
    value: SpeakerPortPayload,
  ): SpeakerJumpMessage | null {
    let message: Record<string, unknown> | null =
      typeof value === "object" && value !== null ? value : null;
    if (message === null || message.type !== "jump") {
      return null;
    }
    let index: number | null = parseBoundedInteger(message.index, 0, 9999);
    if (index === null) {
      return null;
    } else {
      return {
        type: "jump",
        index: index,
      };
    }
  }
  function parseSpeakerNotesMessage(
    value: SpeakerPortPayload,
  ): SpeakerNotesMessage | null {
    let message: Record<string, unknown> | null =
      typeof value === "object" && value !== null ? value : null;
    if (
      message === null ||
      message.type !== "notes" ||
      typeof message.text !== "string"
    ) {
      return null;
    }
    if (
      typeof message.id !== "string" ||
      !SPEAKER_NOTES_ID_PATTERN.test(message.id)
    ) {
      return null;
    }
    return {
      type: "notes",
      id: message.id,
      text: (0, runtime.truncateUtf16Safely)(
        message.text,
        runtime.maxSlideNotesLength,
      ),
    };
  }
  function parseSpeakerNotesEndMessage(
    value: SpeakerPortPayload,
  ): SpeakerNotesEndMessage | null {
    let message: Record<string, unknown> | null =
      typeof value === "object" && value !== null ? value : null;
    if (message !== null && message.type === "notes-end") {
      return {
        type: "notes-end",
      };
    } else {
      return null;
    }
  }
  function parseSpeakerNavigateMessage(
    value: SpeakerPortPayload,
  ): SpeakerNavigateMessage | null {
    let message: Record<string, unknown> | null =
      typeof value === "object" && value !== null ? value : null;
    if (message === null || message.type !== "nav") {
      return null;
    }
    if (message.delta === 1 || message.delta === -1) {
      return {
        type: "nav",
        delta: message.delta,
      };
    } else {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "SPEAKER_NOTES_POPOUT_KEY",
    () => SPEAKER_NOTES_POPOUT_KEY,
    (value) => {
      SPEAKER_NOTES_POPOUT_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPEAKER_MESSAGE_TITLE_MAX_CHARS",
    () => SPEAKER_MESSAGE_TITLE_MAX_CHARS,
    (value) => {
      SPEAKER_MESSAGE_TITLE_MAX_CHARS = value;
    },
  );
  bindRuntimeValue(runtime, "parseBoundedInteger", () => parseBoundedInteger);
  bindRuntimeValue(
    runtime,
    "parseSpeakerSlideMessage",
    () => parseSpeakerSlideMessage,
  );
  bindRuntimeValue(
    runtime,
    "parseSpeakerExitMessage",
    () => parseSpeakerExitMessage,
  );
  bindRuntimeValue(
    runtime,
    "parseSpeakerJumpMessage",
    () => parseSpeakerJumpMessage,
  );
  bindRuntimeValue(
    runtime,
    "SPEAKER_NOTES_ID_PATTERN",
    () => SPEAKER_NOTES_ID_PATTERN,
    (value) => {
      SPEAKER_NOTES_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseSpeakerNotesMessage",
    () => parseSpeakerNotesMessage,
  );
  bindRuntimeValue(
    runtime,
    "parseSpeakerNotesEndMessage",
    () => parseSpeakerNotesEndMessage,
  );
  bindRuntimeValue(
    runtime,
    "parseSpeakerNavigateMessage",
    () => parseSpeakerNavigateMessage,
  );
  return () => {
    (0, runtime.initializeBuildEffects)();
    (0, runtime.initializeRenderingTheme)();
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeSlideModel)();
    SPEAKER_NOTES_POPOUT_KEY = "speaker-notes";
    SPEAKER_MESSAGE_TITLE_MAX_CHARS = 120;
    SPEAKER_NOTES_ID_PATTERN = /^[\w-]{1,64}$/;
  };
}
