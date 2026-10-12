/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** One entry of an object-valued presence list, as published to the room. */
export interface PresenceObject {
  id: string;
  kind?: string;
  label?: string;
}
/** An entry of a list-valued presence field before validation: an id, or a record when the list carries objects. */
export type PresenceListItem =
  | { id?: unknown; kind?: unknown; label?: unknown }
  | string
  | number
  | boolean
  | null
  | undefined;
/** A list item that passed the first check: it is a record with a valid id. */
interface IdentifiedPresenceItem {
  id: string;
  kind?: unknown;
  label?: unknown;
}
/** A presence field value as the app reports it, before validation. */
export type PresenceFieldInput =
  | boolean
  | number
  | string
  | null
  | undefined
  | PresenceListItem[]
  | { text?: unknown };
/** The fields an app reports about what the user is doing. */
export type PresenceFieldsInput = Record<string, PresenceFieldInput>;
/** A field value after validation and size limiting. */
export type PresenceValue = boolean | number | string | null | string[] | PresenceObject[];
/** Validated presence fields, by field name. */
export type PresenceContext = Record<string, PresenceValue>;
/** The validated fields in two sizes: `lean` omits object lists and text, for when `full` does not fit the size limit. */
export interface NormalizedPresenceFields {
  full: PresenceContext;
  lean: PresenceContext;
}
/** Handle for publishing this page's presence context to the room. */
export interface ArtifactPresence {
  /** Replaces the context; publishing is debounced and skipped when nothing changed. */
  report(fields: PresenceFieldsInput): void;
  /** Clears the published context and stops publishing. */
  dispose(): void;
}
/** What `choosePublishContext` picked: the largest context variant that fits, and its JSON. */
interface ChosenPresenceContext {
  /** Null when even the lean variant is over the limit. */
  view: PresenceContext | null;
  json: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** Largest JSON size, in bytes, of a published presence context. */
    MAX_PRESENCE_BYTES: number;
    /** Most ids kept in a list-valued field. */
    MAX_PRESENCE_FIELDS: number;
    /** Most records kept in an object-valued list field. */
    MAX_PRESENCE_OBJECTS: number;
    MAX_PRESENCE_LABEL_LENGTH: number;
    /** Debounce delay, in milliseconds, before a changed context is published. */
    MAX_PRESENCE_TEXT_LENGTH: number;
    MAX_PRESENCE_ID_LENGTH: number;
    PRESENCE_FIELD_PATTERN: RegExp;
    /** Field names the runtime sets itself and the app may not report. */
    RESERVED_PRESENCE_FIELDS: readonly string[];
    PRESENCE_ID_PATTERN: RegExp;
    UNSAFE_PRESENCE_ID_CHARACTERS: RegExp;
    isValidPresenceId: (id: unknown) => id is string;
    UNSAFE_PRESENCE_LABEL_CHARACTERS: RegExp;
    EMPTY_PRESENCE_LABEL_PATTERN: RegExp;
    EMOJI_PRESENCE_LABEL_PATTERN: RegExp;
    normalizePresenceGlyph: (glyph: string) => string;
    isEmojiTagCodepoint: (codepoint: number | undefined) => boolean;
    isDisallowedPresenceCodepoint: (codepoint: number) => boolean;
    /** Strips control and look-alike characters and collapses whitespace; truncates to `maxLength` characters with an ellipsis. */
    sanitizePresenceLabel: (text: string, maxLength?: number) => string;
    normalizePresenceObjects: (objects: PresenceListItem[]) => PresenceObject[];
    normalizePresenceFields: (
      fields: PresenceFieldsInput,
    ) => NormalizedPresenceFields;
    createArtifactPresence: () => ArtifactPresence;
  }
}

export function installHostArtifactPresence(
  runtime: RuntimeBindings,
): () => void {
  var MAX_PRESENCE_BYTES: number;
  var MAX_PRESENCE_FIELDS: number;
  var MAX_PRESENCE_OBJECTS: number;
  var MAX_PRESENCE_LABEL_LENGTH: number;
  var MAX_PRESENCE_TEXT_LENGTH: number;
  var MAX_PRESENCE_ID_LENGTH: number;
  var PRESENCE_FIELD_PATTERN: RegExp;
  var RESERVED_PRESENCE_FIELDS: readonly string[];
  var PRESENCE_ID_PATTERN: RegExp;
  var UNSAFE_PRESENCE_ID_CHARACTERS: RegExp;
  var UNSAFE_PRESENCE_LABEL_CHARACTERS: RegExp;
  var EMPTY_PRESENCE_LABEL_PATTERN: RegExp;
  var EMOJI_PRESENCE_LABEL_PATTERN: RegExp;
  function isValidPresenceId(id: unknown): id is string {
    if (
      typeof id !== "string" ||
      id.length > MAX_PRESENCE_ID_LENGTH ||
      !PRESENCE_ID_PATTERN.test(id)
    ) {
      return false;
    }
    try {
      return !UNSAFE_PRESENCE_ID_CHARACTERS.test(
        decodeURIComponent(id).normalize("NFKD"),
      );
    } catch {
      return false;
    }
  }
  function normalizePresenceGlyph(glyph: string): string {
    let value = glyph.normalize("NFKD");
    if ([...value].length === 1) {
      return value;
    } else {
      return glyph;
    }
  }
  function isEmojiTagCodepoint(codepoint: number | undefined): boolean {
    return (
      codepoint !== undefined && codepoint >= 917536 && codepoint <= 917631
    );
  }
  function isDisallowedPresenceCodepoint(codepoint: number): boolean {
    return (
      (codepoint >= 55296 && codepoint <= 57343) ||
      (codepoint & 65534) === 65534 ||
      (codepoint >= 64976 && codepoint <= 65007) ||
      (codepoint >= 65520 && codepoint <= 65528) ||
      (codepoint >= 917504 && codepoint <= 921599)
    );
  }
  function sanitizePresenceLabel(
    text: string,
    maxLength: number = MAX_PRESENCE_LABEL_LENGTH,
  ): string {
    let text2 = "",
      index = 0,
      flag = false,
      callback = (input: string, options: string): boolean => {
        let value = input.codePointAt(0) ?? 0;
        if (
          value <= 32 ||
          (value >= 127 && value <= 160) ||
          /\s/u.test(input)
        ) {
          flag = text2 !== "";
          return false;
        }
        if (
          isDisallowedPresenceCodepoint(value) ||
          UNSAFE_PRESENCE_LABEL_CHARACTERS.test(input)
        ) {
          return false;
        }
        if (
          UNSAFE_PRESENCE_LABEL_CHARACTERS.test(
            normalizePresenceGlyph(input),
          ) ||
          (isEmojiTagCodepoint(options.codePointAt(0)) &&
            EMOJI_PRESENCE_LABEL_PATTERN.test(input))
        ) {
          flag = text2 !== "";
          return false;
        }
        if (flag) {
          text2 += " ";
          index += 1;
          flag = false;
        }
        text2 += input;
        index += 1;
        return index > maxLength;
      },
      text3 = "";
    for (let value of text.normalize("NFC")) {
      if (text3 !== "" && callback(text3, value)) {
        text3 = "";
        break;
      }
      text3 = value;
    }
    if (text3 !== "") {
      callback(text3, "");
    }
    if (EMPTY_PRESENCE_LABEL_PATTERN.test(text2)) {
      return "";
    }
    if (index <= maxLength) {
      return text2;
    }
    return (
      [...text2]
        .slice(0, maxLength - 1)
        .join("")
        .trimEnd() + "…"
    );
  }
  function normalizePresenceObjects(
    objects: PresenceListItem[],
  ): PresenceObject[] {
    return objects
      .filter(
        (input: PresenceListItem): input is IdentifiedPresenceItem =>
          typeof input === "object" &&
          input !== null &&
          isValidPresenceId(input.id),
      )
      .slice(-MAX_PRESENCE_OBJECTS)
      .map(({ id: id, kind: kind, label: label }): PresenceObject => {
        let state: PresenceObject = {
          id: id,
        };
        if (isValidPresenceId(kind)) {
          state.kind = kind;
        }
        let value =
          typeof label === "string" ? sanitizePresenceLabel(label) : "";
        if (value !== "") {
          state.label = value;
        }
        return state;
      });
  }
  function normalizePresenceFields(
    fields: PresenceFieldsInput,
  ): NormalizedPresenceFields {
    let state: PresenceContext = {},
      state2: PresenceContext = {};
    for (let value of Object.keys(fields)) {
      if (
        !PRESENCE_FIELD_PATTERN.test(value) ||
        value === "prototype" ||
        value in Object.prototype ||
        RESERVED_PRESENCE_FIELDS.includes(value)
      ) {
        continue;
      }
      let value2 = fields[value];
      if (typeof value2 === "boolean" || value2 === null) {
        state[value] = state2[value] = value2;
      } else if (typeof value2 === "number") {
        state[value] = state2[value] = Number.isSafeInteger(value2)
          ? value2
          : null;
      } else if (Array.isArray(value2)) {
        let value3 = value2;
        if (
          value3.some(
            (input: PresenceListItem): boolean =>
              typeof input === "object" && input !== null,
          )
        ) {
          state[value] = normalizePresenceObjects(value3);
        } else {
          state[value] = state2[value] = value3
            .filter(isValidPresenceId)
            .slice(-MAX_PRESENCE_FIELDS);
        }
      } else if (typeof value2 === "object") {
        let value3 =
          typeof value2.text === "string"
            ? sanitizePresenceLabel(value2.text)
            : "";
        if (value3 !== "") {
          state[value] = value3;
        }
      } else {
        state[value] = state2[value] = isValidPresenceId(value2)
          ? value2
          : null;
      }
    }
    return {
      full: state,
      lean: state2,
    };
  }
  function createArtifactPresence(): ArtifactPresence {
    let disabled = !(0, runtime.hasHostRoomApi)(),
      pendingContext: NormalizedPresenceFields | null = null,
      fullContextJson = "",
      leanContextJson = "",
      publishedJson = "",
      publishing = false,
      sizeWarningLogged = false,
      disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      retryPending = false,
      unsubscribeEdits: () => void = (): void => {};
    if (!disabled) {
      unsubscribeEdits = (0, runtime.subscribeArtifactEdits)(
        (): void => void publish(),
      );
    }
    function withEditCount(input: PresenceContext): PresenceContext {
      let value = (0, runtime.getArtifactEditCount)();
      if (value > 0) {
        return {
          ...input,
          edits: value,
        };
      } else {
        return input;
      }
    }
    let fitsContextLimit = (input: string): boolean =>
      new TextEncoder().encode(input).length <= MAX_PRESENCE_BYTES;
    function choosePublishContext(
      input: NormalizedPresenceFields,
    ): ChosenPresenceContext {
      for (let value of [
        withEditCount(input.full),
        withEditCount(input.lean),
        input.lean,
      ]) {
        let value2 = JSON.stringify(value);
        if (fitsContextLimit(value2)) {
          return {
            view: value,
            json: value2,
          };
        }
      }
      return {
        view: null,
        json: "",
      };
    }
    function schedulePublish(): void {
      clearTimeout(timer);
      timer = setTimeout(
        (): void => void publish(),
        MAX_PRESENCE_TEXT_LENGTH,
      );
    }
    async function publish(): Promise<void> {
      clearTimeout(timer);
      timer = undefined;
      if (disabled || publishing || pendingContext === null) {
        return;
      }
      publishing = true;
      let { view: value, json: value2 } =
        choosePublishContext(pendingContext);
      if (value === null && !sizeWarningLogged) {
        sizeWarningLogged = true;
        console.warn(
          "appifact presence: context over 3 KiB — cleared, not published",
        );
      }
      let value3 = JSON.stringify(withEditCount(pendingContext.full)),
        value4 = leanContextJson,
        value5 = (0, runtime.getArtifactEditCount)();
      try {
        if (value2 === publishedJson) {
          return;
        }
        let value6 = await (0, runtime.reportRoomPresence)({
          context: value,
        });
        if (value6 === "off") {
          disabled = true;
          unsubscribeEdits();
          if (!disposed && publishedJson !== "") {
            (0, runtime.reportRoomPresence)({
              context: null,
            });
          }
        }
        if (value6 === "ok") {
          publishedJson = value2;
        }
        retryPending = value6 === "retry";
      } finally {
        publishing = false;
        if (
          pendingContext !== null &&
          JSON.stringify(withEditCount(pendingContext.full)) !== value3
        ) {
          if (
            leanContextJson === value4 &&
            (0, runtime.getArtifactEditCount)() === value5
          ) {
            if (timer === undefined) {
              schedulePublish();
            }
          } else {
            publish();
          }
        }
      }
    }
    return {
      report(input: PresenceFieldsInput): void {
        if (disabled) {
          return;
        }
        let value = normalizePresenceFields(input),
          value2 = JSON.stringify(value.full);
        if (value2 === fullContextJson) {
          if (retryPending && timer === undefined) {
            publish();
          }
          return;
        }
        let value3 = JSON.stringify(value.lean),
          value4 =
            !retryPending &&
            pendingContext !== null &&
            value3 === leanContextJson;
        pendingContext = value;
        fullContextJson = value2;
        leanContextJson = value3;
        if (value4) {
          schedulePublish();
        } else {
          publish();
        }
      },
      dispose(): void {
        clearTimeout(timer);
        unsubscribeEdits();
        if (!disabled && (publishedJson !== "" || publishing)) {
          (0, runtime.reportRoomPresence)({
            context: null,
          });
        }
        pendingContext = null;
        disabled = disposed = true;
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "MAX_PRESENCE_BYTES",
    () => MAX_PRESENCE_BYTES,
    (value) => {
      MAX_PRESENCE_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PRESENCE_FIELDS",
    () => MAX_PRESENCE_FIELDS,
    (value) => {
      MAX_PRESENCE_FIELDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PRESENCE_OBJECTS",
    () => MAX_PRESENCE_OBJECTS,
    (value) => {
      MAX_PRESENCE_OBJECTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PRESENCE_LABEL_LENGTH",
    () => MAX_PRESENCE_LABEL_LENGTH,
    (value) => {
      MAX_PRESENCE_LABEL_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PRESENCE_TEXT_LENGTH",
    () => MAX_PRESENCE_TEXT_LENGTH,
    (value) => {
      MAX_PRESENCE_TEXT_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PRESENCE_ID_LENGTH",
    () => MAX_PRESENCE_ID_LENGTH,
    (value) => {
      MAX_PRESENCE_ID_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PRESENCE_FIELD_PATTERN",
    () => PRESENCE_FIELD_PATTERN,
    (value) => {
      PRESENCE_FIELD_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESERVED_PRESENCE_FIELDS",
    () => RESERVED_PRESENCE_FIELDS,
    (value) => {
      RESERVED_PRESENCE_FIELDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PRESENCE_ID_PATTERN",
    () => PRESENCE_ID_PATTERN,
    (value) => {
      PRESENCE_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNSAFE_PRESENCE_ID_CHARACTERS",
    () => UNSAFE_PRESENCE_ID_CHARACTERS,
    (value) => {
      UNSAFE_PRESENCE_ID_CHARACTERS = value;
    },
  );
  bindRuntimeValue(runtime, "isValidPresenceId", () => isValidPresenceId);
  bindRuntimeValue(
    runtime,
    "UNSAFE_PRESENCE_LABEL_CHARACTERS",
    () => UNSAFE_PRESENCE_LABEL_CHARACTERS,
    (value) => {
      UNSAFE_PRESENCE_LABEL_CHARACTERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_PRESENCE_LABEL_PATTERN",
    () => EMPTY_PRESENCE_LABEL_PATTERN,
    (value) => {
      EMPTY_PRESENCE_LABEL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMOJI_PRESENCE_LABEL_PATTERN",
    () => EMOJI_PRESENCE_LABEL_PATTERN,
    (value) => {
      EMOJI_PRESENCE_LABEL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizePresenceGlyph",
    () => normalizePresenceGlyph,
  );
  bindRuntimeValue(runtime, "isEmojiTagCodepoint", () => isEmojiTagCodepoint);
  bindRuntimeValue(
    runtime,
    "isDisallowedPresenceCodepoint",
    () => isDisallowedPresenceCodepoint,
  );
  bindRuntimeValue(
    runtime,
    "sanitizePresenceLabel",
    () => sanitizePresenceLabel,
  );
  bindRuntimeValue(
    runtime,
    "normalizePresenceObjects",
    () => normalizePresenceObjects,
  );
  bindRuntimeValue(
    runtime,
    "normalizePresenceFields",
    () => normalizePresenceFields,
  );
  bindRuntimeValue(
    runtime,
    "createArtifactPresence",
    () => createArtifactPresence,
  );
  return () => {
    MAX_PRESENCE_BYTES = 3072;
    MAX_PRESENCE_FIELDS = 20;
    MAX_PRESENCE_OBJECTS = 5;
    MAX_PRESENCE_LABEL_LENGTH = 60;
    MAX_PRESENCE_TEXT_LENGTH = 400;
    MAX_PRESENCE_ID_LENGTH = 256;
    PRESENCE_FIELD_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
    RESERVED_PRESENCE_FIELDS = ["edits"];
    PRESENCE_ID_PATTERN = /^(?:[A-Za-z0-9_./#:@+!~*'()-]|%[0-9A-Fa-f]{2})*$/;
    UNSAFE_PRESENCE_ID_CHARACTERS =
      /[\p{Cc}\p{Co}\p{Cs}]|[^\P{Cf}\u200C\u200D]|["`<>\\\p{Zl}\p{Zp}]/u;
    UNSAFE_PRESENCE_LABEL_CHARACTERS =
      /[<>"`\\]|[^\P{Cf}\u200C\u200D]|[\p{Co}\u034F\u115F\u1160\u17B4\u17B5\u2065\u2800\u3164\uFFA0\uFFFC\uFFFD\u{16FE4}\u{1D159}]/u;
    EMPTY_PRESENCE_LABEL_PATTERN = /^[ \u200C\u200D\p{Variation_Selector}]*$/u;
    EMOJI_PRESENCE_LABEL_PATTERN = /\p{Extended_Pictographic}/u;
  };
}
