/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";

/** Extra context a request can carry: where in the document the user was looking. */
export interface AgentSelection {
  /** Short description of the selection, shown by the agent. */
  label?: string;
  text: string;
}
/** How the room is found; defaults to the host's room. */
export interface AgentRoomLookup {
  resolveRoom?: () => Promise<unknown>;
}
/** A request to put to the agent, with the prompt to fall back to when the agent cannot take it. */
export interface AgentSendOptions extends AgentRoomLookup {
  request: string;
  selection?: AgentSelection;
  /** Prompt suggested to the user, or copied, when the agent cannot take the request. */
  fallbackPrompt: string;
  /** "send" asks the agent to act on the request now; otherwise it only lands in the session's composer. */
  deliver?: "send";
  /** Status updates while a "send" is pending (for example "rate_limited"). */
  onStatus?: (status: unknown) => void;
}
/** What the room receives. */
interface AgentPayloadBase {
  request: string;
  label?: string;
}
export interface AgentPayloadWithSelection extends AgentPayloadBase {
  selectedText: string;
}
export interface AgentPayloadWithoutSelection extends AgentPayloadBase {
  selectedText?: undefined;
}
export type AgentPayload = AgentPayloadWithSelection | AgentPayloadWithoutSelection;
/** Second argument of the room's send method. */
export interface AgentSendRoomOptions {
  deliver: "send";
  onStatus?: (status: unknown) => void;
}
/** The members of the host room that reach the agent session. */
export interface AgentSessionRoom {
  sendToAgentSession(
    payload: AgentPayload,
    options?: AgentSendRoomOptions,
  ): Promise<unknown>;
  /** Resolves to a status such as "available" or "rate_limited". */
  canSendToAgentSession(): Promise<unknown>;
}
/** Result of trying the agent session: handed over to a running turn, put in the composer, or no answer in time. */
export type AgentSessionAttempt = "started" | "staged" | "unanswered";
/** Result of handing a prompt to the user instead of the agent. */
export type PromptHandoffResult = "staged" | "copied" | "failed";
/** Where a prompt ended up after `sendOrSuggestToAgent`. */
export type AgentSendOutcome = "unanswered" | PromptHandoffResult;
/** Every outcome `agentSendResultMessage` has wording for. */
export type AgentMessageStatus =
  | AgentSessionAttempt
  | PromptHandoffResult
  | "waiting"
  | "sent";
/** Copies text to the system clipboard; resolves to whether it worked. */
type CopyText = (text: string) => Promise<boolean>;

declare module "../bindings" {
  interface RuntimeBindings {
    jsxKd: JsxNamespace;
    /** Reads a property of an untrusted value; undefined for non-objects. */
    objectProperty: (value: unknown, key: string) => unknown;
    /** The host chat's "put this prompt in the session's input box" action, or undefined when the host has none. */
    resolvePromptSuggestion: (
      environment?: unknown,
    ) => ((prompt: string) => Promise<void>) | undefined;
    SEND_TO_AGENT_METHOD: "sendToAgentSession";
    CAN_SEND_TO_AGENT_METHOD: "canSendToAgentSession";
    CLAUDE_SELECTION_TEXT_MAX: number;
    CLAUDE_SELECTION_LABEL_MAX: number;
    CLAUDE_REQUEST_MAX: number;
    CLAUDE_PAYLOAD_MAX: number;
    CLAUDE_SEND_TIMEOUT_MS: number;
    AgentRequestTimeoutError: new (message?: string) => Error;
    UNSAFE_CLAUDE_REQUEST_CHARACTERS: RegExp;
    /** Removes invisible and control characters, then truncates to `maxLength` UTF-16 units without splitting a pair. */
    sanitizeAgentRequest: (text: string, maxLength: number) => string;
    selectionTruncationNote: (length: number) => string;
    SELECTION_TRUNCATION_NOTE_PATTERN: RegExp;
    SELECTION_TRUNCATION_NOTE_RESERVE: number;
    /** UTF-8 size of the value's JSON. */
    agentPayloadLength: (value: unknown) => number;
    withAgentRequestTimeout: <T>(
      promise: Promise<T>,
      timeoutMs: number,
    ) => Promise<T>;
    /** Shortens the selected text (up to 8 passes) until the payload fits `CLAUDE_PAYLOAD_MAX`. */
    fitAgentPayload: (payload: AgentPayload) => AgentPayload;
    roomWithSendCapability: (room: unknown) => AgentSessionRoom | null;
    /** The room, when the agent session is available to receive a request; null otherwise. */
    availableAgentSessionRoom: (
      options?: AgentRoomLookup,
    ) => Promise<AgentSessionRoom | null>;
    resolveAgentSessionCapability: <T>(
      options: AgentRoomLookup,
      resolveResult: (room: AgentSessionRoom, status: unknown) => T | null,
    ) => Promise<T | null>;
    /** Sends the request through the room, or else suggests the fallback prompt to the user or copies it. */
    sendOrSuggestToAgent: (
      options: AgentSendOptions,
      room?: unknown,
      environment?: unknown,
      copyText?: CopyText,
    ) => Promise<AgentSendOutcome>;
    callSendToAgent: (
      room: AgentSessionRoom,
      payload: AgentPayload,
      options: AgentSendOptions,
    ) => Promise<unknown>;
    isAgentSessionDestination: (result: unknown) => boolean;
    /** Null when the request could not be put to the session; the caller then falls back to a prompt. */
    trySendToAgentSession: (
      options: AgentSendOptions,
      room: unknown,
      acceptStatus: (status: unknown) => boolean,
    ) => Promise<AgentSessionAttempt | null>;
    suggestPromptOrCopy: (
      prompt: string,
      environment?: unknown,
      copyText?: CopyText,
    ) => Promise<PromptHandoffResult>;
    /** Toast wording for an outcome; `suffix` is appended to the sentences that end a normal send. */
    agentSendResultMessage: (
      result: AgentMessageStatus,
      suffix?: string,
    ) => string;
  }
}

export function installHostAgentSession(runtime: RuntimeBindings): () => void {
  var SEND_TO_AGENT_METHOD: "sendToAgentSession";
  var CAN_SEND_TO_AGENT_METHOD: "canSendToAgentSession";
  var CLAUDE_SELECTION_TEXT_MAX: number;
  var CLAUDE_SELECTION_LABEL_MAX: number;
  var CLAUDE_REQUEST_MAX: number;
  var CLAUDE_PAYLOAD_MAX: number;
  var CLAUDE_SEND_TIMEOUT_MS: number;
  var AgentRequestTimeoutError: new (message?: string) => Error;
  var UNSAFE_CLAUDE_REQUEST_CHARACTERS: RegExp;
  var sanitizeAgentRequest: (text: string, maxLength: number) => string;
  var selectionTruncationNote: (length: number) => string;
  var SELECTION_TRUNCATION_NOTE_PATTERN: RegExp;
  var SELECTION_TRUNCATION_NOTE_RESERVE: number;
  var agentPayloadLength: (value: unknown) => number;
  var jsxKd: JsxNamespace;
  function objectProperty(value: unknown, key: string): unknown {
    if (typeof value === "object" && value !== null) {
      return (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  function resolvePromptSuggestion(
    environment: unknown = globalThis,
  ): ((prompt: string) => Promise<void>) | undefined {
    let value = objectProperty(
        objectProperty(environment, "slidesHost"),
        "chat",
      ),
      value2 = objectProperty(value, "suggestPrompt");
    if (typeof value2 !== "function") {
      return;
    }
    return async (input: string): Promise<void> => {
      await value2.call(value, input);
    };
  }
  function withAgentRequestTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((input, options): void => {
      let value = setTimeout(
        (): void => options(new AgentRequestTimeoutError("timeout")),
        timeoutMs,
      );
      promise.then(
        (input2: T): void => {
          clearTimeout(value);
          return input(input2);
        },
        (input2: unknown): void => {
          clearTimeout(value);
          return options(input2);
        },
      );
    });
  }
  function fitAgentPayload(payload: AgentPayload): AgentPayload {
    let value: AgentPayload = payload;
    for (
      let index = 0;
      index < 8 && value.selectedText !== undefined;
      index++
    ) {
      let value2 = agentPayloadLength(value) - CLAUDE_PAYLOAD_MAX;
      if (value2 <= 0) {
        break;
      }
      let { selectedText: value3, ...value4 } = value,
        value5 = value3.replace(SELECTION_TRUNCATION_NOTE_PATTERN, ""),
        value6 = agentPayloadLength(value5) / Math.max(1, value5.length),
        value7 =
          value5.length -
          Math.ceil(
            (value2 + SELECTION_TRUNCATION_NOTE_RESERVE) / Math.max(1, value6),
          ),
        value8 =
          value7 > 0 ? (0, runtime.truncateUtf16Safely)(value5, value7) : "";
      value =
        value8.length > 0
          ? {
              ...value4,
              selectedText: value8 + selectionTruncationNote(value8.length),
            }
          : value4;
    }
    return value;
  }
  function roomWithSendCapability(room: unknown): AgentSessionRoom | null {
    if (typeof objectProperty(room, SEND_TO_AGENT_METHOD) === "function") {
      return room as AgentSessionRoom;
    } else {
      return null;
    }
  }
  function availableAgentSessionRoom(
    options: AgentRoomLookup = {},
  ): Promise<AgentSessionRoom | null> {
    return resolveAgentSessionCapability(
      options,
      (input: AgentSessionRoom, options2: unknown): AgentSessionRoom | null =>
        options2 === "available" ? input : null,
    );
  }
  async function resolveAgentSessionCapability<T>(
    options: AgentRoomLookup,
    resolveResult: (room: AgentSessionRoom, status: unknown) => T | null,
  ): Promise<T | null> {
    try {
      let value = options.resolveRoom ?? runtime.resolveHostRoom,
        value2 = roomWithSendCapability(await value());
      if (!value2) {
        return null;
      }
      let value3 = value2[CAN_SEND_TO_AGENT_METHOD];
      if (typeof value3 !== "function") {
        return null;
      }
      return resolveResult(value2, await value3.call(value2));
    } catch {
      return null;
    }
  }
  async function sendOrSuggestToAgent(
    options: AgentSendOptions,
    room?: unknown,
    environment: unknown = globalThis,
    copyText: CopyText = runtime.copyTextToClipboard,
  ): Promise<AgentSendOutcome> {
    let value = await trySendToAgentSession(
      options,
      room,
      (input: unknown): boolean =>
        !(options.deliver === "send" && input === "rate_limited"),
    );
    if (value !== null) {
      if (value === "started") {
        return "staged";
      } else {
        return value;
      }
    }
    return suggestPromptOrCopy(options.fallbackPrompt, environment, copyText);
  }
  function callSendToAgent(
    room: AgentSessionRoom,
    payload: AgentPayload,
    options: AgentSendOptions,
  ): Promise<unknown> {
    if (options.deliver !== "send") {
      return room[SEND_TO_AGENT_METHOD](payload);
    }
    if (!options.onStatus) {
      return room[SEND_TO_AGENT_METHOD](payload, {
        deliver: "send",
      });
    }
    return room[SEND_TO_AGENT_METHOD](payload, {
      deliver: "send",
      onStatus: options.onStatus,
    });
  }
  function isAgentSessionDestination(result: unknown): boolean {
    let value = objectProperty(result, "to");
    return value === "session" || value === "new";
  }
  async function trySendToAgentSession(
    options: AgentSendOptions,
    room: unknown,
    acceptStatus: (status: unknown) => boolean,
  ): Promise<AgentSessionAttempt | null> {
    let value = sanitizeAgentRequest(
      options.request,
      Number.MAX_SAFE_INTEGER,
    );
    if (room && value.length <= CLAUDE_REQUEST_MAX) {
      let value2: Promise<unknown> | null = null;
      try {
        let value3 = options.selection?.label?.trim(),
          value4 = options.selection
            ? sanitizeAgentRequest(
                options.selection.text,
                Number.MAX_SAFE_INTEGER,
              )
            : "",
          value5 =
            value4.length <= CLAUDE_SELECTION_TEXT_MAX
              ? value4
              : (0, runtime.truncateUtf16Safely)(
                  value4,
                  CLAUDE_SELECTION_TEXT_MAX,
                ) +
                selectionTruncationNote(
                  (0, runtime.truncateUtf16Safely)(
                    value4,
                    CLAUDE_SELECTION_TEXT_MAX,
                  ).length,
                ),
          value6 = fitAgentPayload({
            ...(value3
              ? {
                  label: sanitizeAgentRequest(
                    value3,
                    CLAUDE_SELECTION_LABEL_MAX,
                  ),
                }
              : {}),
            ...(value4.trim() !== ""
              ? {
                  selectedText: value5,
                }
              : {}),
            request: value,
          });
        value2 =
          value4.trim() === "" || value6.selectedText !== undefined
            ? callSendToAgent(room as AgentSessionRoom, value6, options)
            : null;
      } catch {
        value2 = null;
      }
      if (value2) {
        try {
          let value3 = await withAgentRequestTimeout(
            value2,
            CLAUDE_SEND_TIMEOUT_MS,
          );
          if (
            options.deliver === "send" &&
            isAgentSessionDestination(value3)
          ) {
            return "started";
          } else {
            return "staged";
          }
        } catch (value3: unknown) {
          if (
            value3 instanceof AgentRequestTimeoutError ||
            !acceptStatus(objectProperty(value3, "code"))
          ) {
            return "unanswered";
          }
        }
      }
    }
    return null;
  }
  async function suggestPromptOrCopy(
    prompt: string,
    environment: unknown = globalThis,
    copyText: CopyText = runtime.copyTextToClipboard,
  ): Promise<PromptHandoffResult> {
    let value = resolvePromptSuggestion(environment);
    if (value) {
      try {
        await value(prompt);
        // CucCut: the host puts the prompt into the session's composer and the user sends it, so report it as staged.
        return "staged";
      } catch {}
    }
    if (await copyText(prompt)) {
      return "copied";
    } else {
      return "failed";
    }
  }
  function agentSendResultMessage(
    result: AgentMessageStatus,
    suffix: string = "",
  ): string {
    switch (result) {
      case "staged":
      case "waiting":
        return (
          "Added to your message to the agent. Send it when you're ready." + suffix
        );
      case "unanswered":
        return "Couldn't reach the agent just now. Try again in a moment.";
      case "sent":
        return "Sent to the agent." + suffix;
      case "started":
        return "Sending to the agent…" + suffix;
      case "copied":
        return "Prompt copied. Paste it to the agent." + suffix;
      case "failed":
        return "Couldn't copy the prompt. Try again, or copy the text yourself.";
    }
  }
  bindRuntimeValue(runtime, "objectProperty", () => objectProperty);
  bindRuntimeValue(
    runtime,
    "resolvePromptSuggestion",
    () => resolvePromptSuggestion,
  );
  bindRuntimeValue(
    runtime,
    "SEND_TO_AGENT_METHOD",
    () => SEND_TO_AGENT_METHOD,
    (value) => {
      SEND_TO_AGENT_METHOD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CAN_SEND_TO_AGENT_METHOD",
    () => CAN_SEND_TO_AGENT_METHOD,
    (value) => {
      CAN_SEND_TO_AGENT_METHOD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_SELECTION_TEXT_MAX",
    () => CLAUDE_SELECTION_TEXT_MAX,
    (value) => {
      CLAUDE_SELECTION_TEXT_MAX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_SELECTION_LABEL_MAX",
    () => CLAUDE_SELECTION_LABEL_MAX,
    (value) => {
      CLAUDE_SELECTION_LABEL_MAX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_REQUEST_MAX",
    () => CLAUDE_REQUEST_MAX,
    (value) => {
      CLAUDE_REQUEST_MAX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_PAYLOAD_MAX",
    () => CLAUDE_PAYLOAD_MAX,
    (value) => {
      CLAUDE_PAYLOAD_MAX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_SEND_TIMEOUT_MS",
    () => CLAUDE_SEND_TIMEOUT_MS,
    (value) => {
      CLAUDE_SEND_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AgentRequestTimeoutError",
    () => AgentRequestTimeoutError,
    (value) => {
      AgentRequestTimeoutError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "withAgentRequestTimeout",
    () => withAgentRequestTimeout,
  );
  bindRuntimeValue(
    runtime,
    "UNSAFE_CLAUDE_REQUEST_CHARACTERS",
    () => UNSAFE_CLAUDE_REQUEST_CHARACTERS,
    (value) => {
      UNSAFE_CLAUDE_REQUEST_CHARACTERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizeAgentRequest",
    () => sanitizeAgentRequest,
    (value) => {
      sanitizeAgentRequest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectionTruncationNote",
    () => selectionTruncationNote,
    (value) => {
      selectionTruncationNote = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SELECTION_TRUNCATION_NOTE_PATTERN",
    () => SELECTION_TRUNCATION_NOTE_PATTERN,
    (value) => {
      SELECTION_TRUNCATION_NOTE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SELECTION_TRUNCATION_NOTE_RESERVE",
    () => SELECTION_TRUNCATION_NOTE_RESERVE,
    (value) => {
      SELECTION_TRUNCATION_NOTE_RESERVE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "agentPayloadLength",
    () => agentPayloadLength,
    (value) => {
      agentPayloadLength = value;
    },
  );
  bindRuntimeValue(runtime, "fitAgentPayload", () => fitAgentPayload);
  bindRuntimeValue(
    runtime,
    "roomWithSendCapability",
    () => roomWithSendCapability,
  );
  bindRuntimeValue(
    runtime,
    "availableAgentSessionRoom",
    () => availableAgentSessionRoom,
  );
  bindRuntimeValue(
    runtime,
    "resolveAgentSessionCapability",
    () => resolveAgentSessionCapability,
  );
  bindRuntimeValue(
    runtime,
    "sendOrSuggestToAgent",
    () => sendOrSuggestToAgent,
  );
  bindRuntimeValue(runtime, "callSendToAgent", () => callSendToAgent);
  bindRuntimeValue(
    runtime,
    "isAgentSessionDestination",
    () => isAgentSessionDestination,
  );
  bindRuntimeValue(
    runtime,
    "trySendToAgentSession",
    () => trySendToAgentSession,
  );
  bindRuntimeValue(runtime, "suggestPromptOrCopy", () => suggestPromptOrCopy);
  bindRuntimeValue(
    runtime,
    "jsxKd",
    () => jsxKd,
    (value) => {
      jsxKd = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "agentSendResultMessage",
    () => agentSendResultMessage,
  );
  return () => {
    SEND_TO_AGENT_METHOD = "sendToAgentSession";
    CAN_SEND_TO_AGENT_METHOD = "canSendToAgentSession";
    CLAUDE_SELECTION_TEXT_MAX = 1800;
    CLAUDE_SELECTION_LABEL_MAX = 120;
    CLAUDE_REQUEST_MAX = 2000;
    CLAUDE_PAYLOAD_MAX = 4000;
    CLAUDE_SEND_TIMEOUT_MS = 4000;
    AgentRequestTimeoutError = class AgentRequestTimeoutError extends (
      Error
    ) {};
    UNSAFE_CLAUDE_REQUEST_CHARACTERS =
      /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u2028\u2029\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uFEFF\uFFA0\uFFF0-\uFFF8\uFFFD\u{16FE4}\u{1BCA0}-\u{1BCA3}\u{1D173}-\u{1D17A}\u{E0000}-\u{E00FF}\u{E01F0}-\u{E0FFF}]|(?![\u200C\u200D])\p{Cf}|\p{Co}|\p{Noncharacter_Code_Point}|[\uD800-\uDFFF]/gu;
    sanitizeAgentRequest = (text: string, maxLength: number): string =>
      (0, runtime.truncateUtf16Safely)(
        text.replace(UNSAFE_CLAUDE_REQUEST_CHARACTERS, ""),
        maxLength,
      );
    selectionTruncationNote = (length: number): string =>
      `
[selection truncated here at ` +
      String(length) +
      " characters]";
    SELECTION_TRUNCATION_NOTE_PATTERN =
      /\n\[selection truncated here at \d+ characters\]$/;
    SELECTION_TRUNCATION_NOTE_RESERVE = selectionTruncationNote(99999).length;
    agentPayloadLength = (value: unknown): number =>
      new TextEncoder().encode(JSON.stringify(value)).length;
    jsxKd = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
