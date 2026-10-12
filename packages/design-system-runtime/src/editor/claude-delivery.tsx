import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorClaudeDelivery(
  runtime: RuntimeBindings,
): () => void {
  var reactDesignSystemEditors: typeof import("react");
  var reactColorEditors: typeof import("react");
  // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
  var roomApiOwner: Editor.ClaudeEnvironment["designSystemHost"];
  var roomApiPromise: Promise<Editor.RoomCapability | null> | undefined;
  var EMPTY_ROOM_PEERS: readonly Editor.RoomPeer[];
  var roomPeers: readonly Editor.RoomPeer[];
  var roomPeerSubscribers: Set<() => void>;
  var roomPeerListenerStarted: boolean;
  var roomPeerUnsubscribe: (() => void) | null;
  var roomPeerStore: Editor.RoomPeerStore;
  var SEND_TO_CLAUDE_METHOD: "sendToClaudeSession";
  var CAN_SEND_TO_CLAUDE_METHOD: "canSendToClaudeSession";
  var CLAUDE_SELECTION_TEXT_MAX: number;
  var CLAUDE_SELECTION_LABEL_MAX: number;
  var CLAUDE_REQUEST_MAX: number;
  var CLAUDE_PAYLOAD_MAX: number;
  var CLAUDE_SEND_TIMEOUT_MS: number;
  var ClaudeRequestTimeoutError: new (message?: string) => Error;
  var UNSAFE_CLAUDE_REQUEST_CHARACTERS: RegExp;
  var sanitizeClaudeRequest: (text: string, limit: number) => string;
  var selectionTruncationNote: (length: number) => string;
  var SELECTION_TRUNCATION_NOTE_PATTERN: RegExp;
  var SELECTION_TRUNCATION_NOTE_RESERVE: number;
  var claudePayloadLength: (payload: unknown) => number;
  var UNSAFE_ARTIFACT_LABEL_PATTERN: RegExp;
  var EMPTY_CLAUDE_DELIVERY_CONTEXT: Application.ClaudeDeliveryContext;
  async function resolveClaudeRoom(): Promise<Editor.RoomCapability | null> {
    // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
    let claude = (globalThis as Editor.ClaudeEnvironment).designSystemHost;
    try {
      if (typeof claude?.use === "function") {
        let value = await (0, runtime.loadClaudeCapability)("room");
        if (typeof value === "object" && value !== null) {
          return value as Editor.RoomCapability;
        } else {
          return null;
        }
      }
    } catch {
      return null;
    }
    if (typeof claude?.room?.presence === "function") {
      return claude.room;
    } else {
      return null;
    }
  }
  function cachedClaudeRoom(): Promise<Editor.RoomCapability | null> {
    // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
    let claude = (globalThis as Editor.ClaudeEnvironment).designSystemHost;
    if (roomApiPromise === undefined || roomApiOwner !== claude) {
      roomApiOwner = claude;
      roomApiPromise = resolveClaudeRoom();
    }
    return roomApiPromise;
  }
  function normalizeRoomPeers(value: unknown): readonly Editor.RoomPeer[] {
    if (!Array.isArray(value)) {
      return EMPTY_ROOM_PEERS;
    }
    let items: Editor.RoomPeer[] = [];
    for (let value2 of value as unknown[]) {
      if (typeof value2 !== "object" || value2 === null) {
        continue;
      }
      let value3 = value2 as Record<string, unknown>;
      if (typeof value3.peer !== "string") {
        continue;
      }
      items.push({
        peer: value3.peer,
        by:
          typeof value3.by === "string" && value3.by !== "" ? value3.by : null,
        isMe: value3.isMe === true,
        sameTab: value3.sameTab === true,
        presence:
          typeof value3.presence === "object" && value3.presence !== null
            ? value3.presence
            : {},
        updatedAt: typeof value3.updatedAt === "number" ? value3.updatedAt : 0,
      });
    }
    return items;
  }
  function startRoomPeerListener(): void {
    if (roomPeerListenerStarted) {
      return;
    }
    roomPeerListenerStarted = true;
    cachedClaudeRoom().then((input): void => {
      if (typeof input?.onPeers !== "function" || !roomPeerListenerStarted) {
        return;
      }
      try {
        let value = input.onPeers.call(
          input,
          (input2): void => {
            roomPeers = normalizeRoomPeers(input2.peers);
            for (let value2 of [...roomPeerSubscribers]) {
              value2();
            }
          },
          (): void => {
            roomPeers = EMPTY_ROOM_PEERS;
            for (let value2 of [...roomPeerSubscribers]) {
              value2();
            }
          },
        );
        if (typeof value === "function") {
          roomPeerUnsubscribe = value as () => void;
        }
      } catch {}
    });
  }
  function getObjectProperty(object: unknown, key: string): unknown {
    if (typeof object === "object" && object !== null) {
      return (object as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  function resolvePromptSuggestion(
    environment: unknown = globalThis,
  ): ((prompt: string) => Promise<void>) | undefined {
    // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
    let value = getObjectProperty(
        getObjectProperty(environment, "designSystemHost"),
        "chat",
      ),
      value2 = getObjectProperty(value, "suggestPrompt");
    if (typeof value2 !== "function") {
      return;
    }
    return async (input: string): Promise<void> => {
      await (value2 as (prompt: string) => Promise<unknown>).call(value, input);
    };
  }
  function withClaudeRequestTimeout<T>(
    promise: Promise<T>,
    timeout: number,
  ): Promise<T> {
    return new Promise<T>((input, options): void => {
      let value = setTimeout(
        () => options(new ClaudeRequestTimeoutError("timeout")),
        timeout,
      );
      promise.then(
        (input2) => {
          clearTimeout(value);
          return input(input2);
        },
        (input2: unknown) => {
          clearTimeout(value);
          return options(input2);
        },
      );
    });
  }
  function fitClaudePayload(
    payload: Editor.SessionPayload,
  ): Editor.SessionPayload {
    let value = payload;
    for (
      let index: number = 0;
      index < 8 && value.selectedText !== undefined;
      index++
    ) {
      let value2: number = claudePayloadLength(value) - CLAUDE_PAYLOAD_MAX;
      if (value2 <= 0) {
        break;
      }
      let { selectedText: value3, ...value4 } = value,
        value5 = value3.replace(SELECTION_TRUNCATION_NOTE_PATTERN, ""),
        value6: number =
          claudePayloadLength(value5) / Math.max(1, value5.length),
        value7: number =
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
  function roomWithSendCapability(
    namespace: unknown,
  ): Editor.SessionSender | null {
    if (
      typeof getObjectProperty(namespace, SEND_TO_CLAUDE_METHOD) === "function"
    ) {
      return namespace as Editor.SessionSender;
    } else {
      return null;
    }
  }
  function resolveSessionRoute(
    options: Editor.SessionRouteOptions = {},
  ): Promise<Editor.SessionRoute | null> {
    return resolveClaudeSessionCapability(
      options,
      (input: Editor.SessionSender, options2: unknown) =>
        chooseSessionRoute(input, options2, options.confirm === true),
    );
  }
  function chooseSessionRoute(
    namespace: Editor.SessionSender,
    availability: unknown,
    confirmed: boolean,
  ): Editor.SessionRoute | null {
    if (availability === "available") {
      return {
        ns: namespace,
        road: "pane",
      };
    }
    if (availability === "available_if_summoned") {
      return {
        ns: namespace,
        road: "summon",
      };
    }
    if (availability === "available_if_opened") {
      return {
        ns: namespace,
        road: "open",
      };
    }
    if (availability === "available_if_confirmed" && confirmed) {
      return {
        ns: namespace,
        road: "confirm",
      };
    }
    return null;
  }
  async function resolveClaudeSessionCapability<T>(
    options: Editor.SessionRouteOptions,
    choose: (namespace: Editor.SessionSender, availability: unknown) => T,
  ): Promise<T | null> {
    try {
      let value = options.resolveRoom ?? resolveClaudeRoom,
        value2 = roomWithSendCapability(await value());
      if (!value2) {
        return null;
      }
      let value3 = value2[CAN_SEND_TO_CLAUDE_METHOD];
      if (typeof value3 !== "function") {
        return null;
      }
      return choose(value2, await value3.call(value2));
    } catch {
      return null;
    }
  }
  async function sendOrSuggestToClaude(
    request: Editor.SessionRequest,
    available: object | null,
    environment: unknown = globalThis,
    copy: (text: string) => Promise<boolean> = runtime.copyTextToClipboard,
  ): Promise<"staged" | "unanswered" | "sent" | "copied" | "failed"> {
    let value = await trySendToClaudeSession(
      request,
      available,
      (input: unknown): boolean =>
        !(request.deliver === "send" && input === "rate_limited"),
    );
    if (value !== null) {
      if (value === "started") {
        return "staged";
      } else {
        return value;
      }
    }
    return suggestPromptOrCopy(request.fallbackPrompt, environment, copy);
  }
  function callSendToClaude(
    namespace: object,
    payload: Editor.SessionPayload,
    request: Editor.SessionRequest,
  ): Promise<unknown> {
    if (request.deliver !== "send") {
      return (namespace as Editor.SessionSender)[SEND_TO_CLAUDE_METHOD](
        payload,
      );
    }
    if (!request.onStatus) {
      return (namespace as Editor.SessionSender)[SEND_TO_CLAUDE_METHOD](
        payload,
        {
          deliver: "send",
        },
      );
    }
    return (namespace as Editor.SessionSender)[SEND_TO_CLAUDE_METHOD](payload, {
      deliver: "send",
      onStatus: request.onStatus,
    });
  }
  function isClaudeSessionDestination(value: unknown): boolean {
    let value2 = getObjectProperty(value, "to");
    return value2 === "session" || value2 === "new";
  }
  async function trySendToClaudeSession(
    request: Editor.SessionRequest,
    available: object | null,
    send: (code: unknown) => boolean,
  ): Promise<"started" | "staged" | "unanswered" | null> {
    let value = sanitizeClaudeRequest(request.request, Number.MAX_SAFE_INTEGER);
    if (available && value.length <= CLAUDE_REQUEST_MAX) {
      let value2: Promise<unknown> | null = null;
      try {
        let value3 = request.selection?.label?.trim(),
          value4 = request.selection
            ? sanitizeClaudeRequest(
                request.selection.text,
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
          value6 = fitClaudePayload({
            ...(value3
              ? {
                  label: sanitizeClaudeRequest(
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
            ? callSendToClaude(available, value6, request)
            : null;
      } catch {
        value2 = null;
      }
      if (value2) {
        try {
          let value3 = await withClaudeRequestTimeout(
            value2,
            CLAUDE_SEND_TIMEOUT_MS,
          );
          if (
            request.deliver === "send" &&
            isClaudeSessionDestination(value3)
          ) {
            return "started";
          } else {
            return "staged";
          }
        } catch (value3) {
          if (
            value3 instanceof ClaudeRequestTimeoutError ||
            !send(getObjectProperty(value3, "code"))
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
    copy: (text: string) => Promise<boolean> = runtime.copyTextToClipboard,
  ): Promise<"sent" | "copied" | "failed"> {
    let value = resolvePromptSuggestion(environment);
    if (value) {
      try {
        await value(prompt);
        return "sent";
      } catch {}
    }
    if (await copy(prompt)) {
      return "copied";
    } else {
      return "failed";
    }
  }
  function safeArtifactLabel(value: unknown): string {
    let value2 = String(value ?? "").replace(
      UNSAFE_ARTIFACT_LABEL_PATTERN,
      "?",
    );
    if (value2.length <= 120) {
      return value2;
    }
    let count = 120,
      value3 = value2.charCodeAt(count - 1);
    if (value3 >= 55296 && value3 <= 56319) {
      count -= 1;
    }
    return value2.slice(0, count) + "…";
  }
  async function resolveClaudeDeliveryContext(
    resolveSession: () => Promise<Editor.SessionRoute | null> = resolveSessionRoute,
    resolveOwnerChat: () =>
      | Promise<boolean | undefined>
      | boolean
      | undefined = runtime.isArtifactOwner,
  ): Promise<Application.ClaudeDeliveryContext> {
    try {
      let value = await resolveSession();
      if (value?.road === "pane") {
        return {
          sender: value.ns,
          ownerChat: null,
        };
      }
      return {
        sender: null,
        ownerChat:
          value?.road === "open" && (await resolveOwnerChat())
            ? value.ns
            : null,
      };
    } catch {
      return EMPTY_CLAUDE_DELIVERY_CONTEXT;
    }
  }
  function createClaudeDeliveryContextStore(
    resolveContext: () => Promise<Application.ClaudeDeliveryContext> = resolveClaudeDeliveryContext,
  ): Application.ClaudeDeliveryContextStore {
    let value = EMPTY_CLAUDE_DELIVERY_CONTEXT,
      index: number = 0,
      index2 = 0;
    return {
      current: () => value,
      refresh: (): void => {
        let value2 = ++index;
        resolveContext().then((input): void => {
          if (value2 < index2) {
            return;
          }
          index2 = value2;
          value = input;
        });
      },
    };
  }
  async function resolveOwnerChatCapability(
    environment: Editor.ClaudeEnvironment = globalThis as Editor.ClaudeEnvironment,
  ): Promise<Editor.OwnerChatCapability | null> {
    // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
    let claude = environment.designSystemHost;
    try {
      if (typeof claude?.use === "function") {
        let value = await claude.use.call(claude, "comments");
        if (
          typeof value === "object" &&
          value !== null &&
          (value as Editor.OwnerChatCapability).available !== false
        ) {
          return value as Editor.OwnerChatCapability;
        } else {
          return null;
        }
      }
    } catch {
      return null;
    }
    if (typeof claude?.comments === "object" && claude.comments !== null) {
      return claude.comments;
    } else {
      return null;
    }
  }
  function chooseClaudeDeliveryRoad(
    request: Application.ClaudeRequest,
    context: Application.ClaudeDeliveryContext,
    holdOwnerChat: boolean,
  ): Application.ClaudeDeliveryRoad {
    if (
      request.ownerChat !== true ||
      context.sender !== null ||
      context.ownerChat === null
    ) {
      return "sender";
    }
    if (holdOwnerChat) {
      return "held";
    } else {
      return "ownerChat";
    }
  }
  function deliverClaudeRequest(
    request: Application.ClaudeRequest,
    anchor: Element | null | undefined,
    context: Application.ClaudeDeliveryContext,
    holdOwnerChat: boolean = false,
    environment?: Editor.ClaudeEnvironment,
    copy?: (text: string) => Promise<boolean>,
  ): Promise<Application.ClaudeDeliveryResult> {
    let value = chooseClaudeDeliveryRoad(request, context, holdOwnerChat);
    if (value === "sender") {
      return deliverClaudePrompt(
        request,
        anchor,
        context.sender,
        environment,
        copy,
      );
    }
    if (value === "held") {
      return deliverClaudePrompt(request, anchor, null, environment, copy).then(
        (source) =>
          source.kind === "suggested" ||
          source.kind === "copied" ||
          source.kind === "failed"
            ? {
                ...source,
                held: true,
              }
            : source,
      );
    }
    let { deliver: value2, ...value3 } = request;
    return deliverClaudePrompt(
      value3,
      anchor,
      context.ownerChat,
      environment,
      copy,
    );
  }
  async function deliverClaudePrompt(
    request: Application.ClaudeRequest,
    anchor: Element | null | undefined,
    sender: object | null = null,
    environment: Editor.ClaudeEnvironment = globalThis as Editor.ClaudeEnvironment,
    copy: (text: string) => Promise<boolean> = runtime.copyTextToClipboard,
  ): Promise<Application.ClaudeDeliveryResult> {
    let prompt = request.prompt;
    if (sender !== null) {
      let value = await sendOrSuggestToClaude(
        {
          selection:
            request.label === undefined
              ? null
              : {
                  text: "",
                  label: request.label,
                },
          request: request.request ?? prompt,
          fallbackPrompt: prompt,
          deliver: request.deliver,
        },
        sender,
        environment,
        copy,
      );
      return {
        kind: value === "sent" ? "suggested" : value,
      };
    }
    let ownerChat = await resolveOwnerChatCapability(environment);
    if (ownerChat !== null && typeof ownerChat.sendToClaude === "function") {
      try {
        if (
          (typeof ownerChat.canSendToClaude === "function"
            ? await ownerChat.canSendToClaude.call(ownerChat)
            : "available") === "available"
        ) {
          let value = anchor ?? environment.document?.body ?? null,
            value2 =
              typeof ownerChat.anchorFor === "function" && value !== null
                ? await ownerChat.anchorFor.call(ownerChat, value)
                : {
                    path: "body:nth-of-type(1)",
                    x: 0.5,
                    y: 0.5,
                  },
            value3 = await ownerChat.sendToClaude.call(ownerChat, {
              anchor: value2,
              text: prompt,
            });
          return {
            kind: "sent",
            ...(typeof value3?.threadId === "string"
              ? {
                  threadId: value3.threadId,
                }
              : {}),
          };
        }
      } catch {}
    }
    let fallbackOutcome = await suggestPromptOrCopy(prompt, environment, copy);
    return {
      kind: fallbackOutcome === "sent" ? "suggested" : fallbackOutcome,
    };
  }
  bindRuntimeValue(
    runtime,
    "reactDesignSystemEditors",
    () => reactDesignSystemEditors,
    (value) => {
      reactDesignSystemEditors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactColorEditors",
    () => reactColorEditors,
    (value) => {
      reactColorEditors = value;
    },
  );
  bindRuntimeValue(runtime, "resolveClaudeRoom", () => resolveClaudeRoom);
  bindRuntimeValue(
    runtime,
    "roomApiOwner",
    () => roomApiOwner,
    (value) => {
      roomApiOwner = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roomApiPromise",
    () => roomApiPromise,
    (value) => {
      roomApiPromise = value;
    },
  );
  bindRuntimeValue(runtime, "cachedClaudeRoom", () => cachedClaudeRoom);
  bindRuntimeValue(
    runtime,
    "EMPTY_ROOM_PEERS",
    () => EMPTY_ROOM_PEERS,
    (value) => {
      EMPTY_ROOM_PEERS = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeRoomPeers", () => normalizeRoomPeers);
  bindRuntimeValue(
    runtime,
    "roomPeers",
    () => roomPeers,
    (value) => {
      roomPeers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roomPeerSubscribers",
    () => roomPeerSubscribers,
    (value) => {
      roomPeerSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roomPeerListenerStarted",
    () => roomPeerListenerStarted,
    (value) => {
      roomPeerListenerStarted = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roomPeerUnsubscribe",
    () => roomPeerUnsubscribe,
    (value) => {
      roomPeerUnsubscribe = value as () => void;
    },
  );
  bindRuntimeValue(
    runtime,
    "startRoomPeerListener",
    () => startRoomPeerListener,
  );
  bindRuntimeValue(
    runtime,
    "roomPeerStore",
    () => roomPeerStore,
    (value) => {
      roomPeerStore = value;
    },
  );
  bindRuntimeValue(runtime, "getObjectProperty", () => getObjectProperty);
  bindRuntimeValue(
    runtime,
    "resolvePromptSuggestion",
    () => resolvePromptSuggestion,
  );
  bindRuntimeValue(
    runtime,
    "SEND_TO_CLAUDE_METHOD",
    () => SEND_TO_CLAUDE_METHOD,
    (value) => {
      SEND_TO_CLAUDE_METHOD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CAN_SEND_TO_CLAUDE_METHOD",
    () => CAN_SEND_TO_CLAUDE_METHOD,
    (value) => {
      CAN_SEND_TO_CLAUDE_METHOD = value;
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
    "ClaudeRequestTimeoutError",
    () => ClaudeRequestTimeoutError,
    (value) => {
      ClaudeRequestTimeoutError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "withClaudeRequestTimeout",
    () => withClaudeRequestTimeout,
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
    "sanitizeClaudeRequest",
    () => sanitizeClaudeRequest,
    (value) => {
      sanitizeClaudeRequest = value;
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
    "claudePayloadLength",
    () => claudePayloadLength,
    (value) => {
      claudePayloadLength = value;
    },
  );
  bindRuntimeValue(runtime, "fitClaudePayload", () => fitClaudePayload);
  bindRuntimeValue(
    runtime,
    "roomWithSendCapability",
    () => roomWithSendCapability,
  );
  bindRuntimeValue(runtime, "resolveSessionRoute", () => resolveSessionRoute);
  bindRuntimeValue(runtime, "chooseSessionRoute", () => chooseSessionRoute);
  bindRuntimeValue(
    runtime,
    "resolveClaudeSessionCapability",
    () => resolveClaudeSessionCapability,
  );
  bindRuntimeValue(
    runtime,
    "sendOrSuggestToClaude",
    () => sendOrSuggestToClaude,
  );
  bindRuntimeValue(runtime, "callSendToClaude", () => callSendToClaude);
  bindRuntimeValue(
    runtime,
    "isClaudeSessionDestination",
    () => isClaudeSessionDestination,
  );
  bindRuntimeValue(
    runtime,
    "trySendToClaudeSession",
    () => trySendToClaudeSession,
  );
  bindRuntimeValue(runtime, "suggestPromptOrCopy", () => suggestPromptOrCopy);
  bindRuntimeValue(
    runtime,
    "UNSAFE_ARTIFACT_LABEL_PATTERN",
    () => UNSAFE_ARTIFACT_LABEL_PATTERN,
    (value) => {
      UNSAFE_ARTIFACT_LABEL_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "safeArtifactLabel", () => safeArtifactLabel);
  bindRuntimeValue(
    runtime,
    "EMPTY_CLAUDE_DELIVERY_CONTEXT",
    () => EMPTY_CLAUDE_DELIVERY_CONTEXT,
    (value) => {
      EMPTY_CLAUDE_DELIVERY_CONTEXT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveClaudeDeliveryContext",
    () => resolveClaudeDeliveryContext,
  );
  bindRuntimeValue(
    runtime,
    "createClaudeDeliveryContextStore",
    () => createClaudeDeliveryContextStore,
  );
  bindRuntimeValue(
    runtime,
    "resolveOwnerChatCapability",
    () => resolveOwnerChatCapability,
  );
  bindRuntimeValue(
    runtime,
    "chooseClaudeDeliveryRoad",
    () => chooseClaudeDeliveryRoad,
  );
  bindRuntimeValue(runtime, "deliverClaudeRequest", () => deliverClaudeRequest);
  bindRuntimeValue(runtime, "deliverClaudePrompt", () => deliverClaudePrompt);
  return () => {
    reactDesignSystemEditors = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactColorEditors = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    EMPTY_ROOM_PEERS = Object.freeze([]);
    roomPeers = EMPTY_ROOM_PEERS;
    roomPeerSubscribers = new Set();
    roomPeerListenerStarted = false;
    roomPeerUnsubscribe = null;
    roomPeerStore = {
      getSnapshot: () => roomPeers,
      subscribe(input: () => void) {
        roomPeerSubscribers.add(input);
        startRoomPeerListener();
        return () => roomPeerSubscribers.delete(input);
      },
    };
    SEND_TO_CLAUDE_METHOD = "sendToClaudeSession";
    CAN_SEND_TO_CLAUDE_METHOD = "canSendToClaudeSession";
    CLAUDE_SELECTION_TEXT_MAX = 1800;
    CLAUDE_SELECTION_LABEL_MAX = 120;
    CLAUDE_REQUEST_MAX = 2000;
    CLAUDE_PAYLOAD_MAX = 4000;
    CLAUDE_SEND_TIMEOUT_MS = 4000;
    ClaudeRequestTimeoutError = class ClaudeRequestTimeoutError extends (
      Error
    ) {};
    UNSAFE_CLAUDE_REQUEST_CHARACTERS =
      /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u2028\u2029\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uFEFF\uFFA0\uFFF0-\uFFF8\uFFFD\u{16FE4}\u{1BCA0}-\u{1BCA3}\u{1D173}-\u{1D17A}\u{E0000}-\u{E00FF}\u{E01F0}-\u{E0FFF}]|(?![\u200C\u200D])\p{Cf}|\p{Co}|\p{Noncharacter_Code_Point}|[\uD800-\uDFFF]/gu;
    sanitizeClaudeRequest = (text: string, limit: number) =>
      (0, runtime.truncateUtf16Safely)(
        text.replace(UNSAFE_CLAUDE_REQUEST_CHARACTERS, ""),
        limit,
      );
    selectionTruncationNote = (length: number): string =>
      `
[selection truncated here at ` +
      String(length) +
      " characters]";
    SELECTION_TRUNCATION_NOTE_PATTERN =
      /\n\[selection truncated here at \d+ characters\]$/;
    SELECTION_TRUNCATION_NOTE_RESERVE = selectionTruncationNote(99999).length;
    claudePayloadLength = (payload: unknown) =>
      new TextEncoder().encode(JSON.stringify(payload)).length;
    UNSAFE_ARTIFACT_LABEL_PATTERN = new RegExp(
      `[<>"\r
\u2028\u2029]`,
      "g",
    );
    EMPTY_CLAUDE_DELIVERY_CONTEXT = {
      sender: null,
      ownerChat: null,
    };
  };
}
