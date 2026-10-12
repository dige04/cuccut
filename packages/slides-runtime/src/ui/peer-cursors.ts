/** Restored application module; prepare first, initialize in original order. */
import type {
  AnimationEvent as ReactAnimationEvent,
  NamedExoticComponent,
  ReactElement,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type {
  PeerWhoPresence,
  RoomPeer,
  RoomPresencePatch,
} from "../host/room-presence";

/** Where the local pointer is, on which surface (slide or grid tile key). */
interface PeerCursorPosition {
  s: string;
  x: number;
  y: number;
}
/** A published pointer position and the time it was sent. */
interface PublishedPeerCursor extends PeerCursorPosition {
  at: number;
}
/** Options of `createCursorPresence`. */
export interface CursorPresenceOptions {
  /** Clock; replaced in tests. */
  now?: () => number;
  /** Smallest pointer movement (as a fraction of the surface) worth publishing. */
  minDelta?: number;
  /** How long the pointer may rest before it is withdrawn. */
  idleNullMs?: number;
}
/** Publishes the local pointer and chat line to the other peers. */
export interface CursorPresence {
  /** Publishes a position; `x` and `y` are fractions of the surface. */
  move(surface: string, x: number, y: number): void;
  /** Sets the chat line shown next to the pointer; returns whether it changed. */
  say(message: string): boolean;
  /** Whether a pointer is currently published. */
  live(): boolean;
  /** Withdraws the pointer. */
  clear(): void;
  /** Publishes the display name and color of the local user. */
  setWho(name: string, color: string): void;
  dispose(): void;
}
/** A remote pointer ready to draw. */
export interface VisiblePeerCursor {
  peer: string;
  /** Fraction of the surface width. */
  x: number;
  /** Fraction of the surface height. */
  y: number;
  name: string;
  /** Index into the collaborator colors. */
  collaborator: number;
  idleMs: number;
  message: string;
}
/** Custom properties that time the chat line animation. */
export interface PeerChatCssTimings {
  "--mc-chat-hold": string;
  "--mc-chat-fade": string;
  "--mc-chat-exit": string;
}
export interface PeerCursorsProps {
  /** Surface key whose pointers are drawn. */
  surface: string;
  /** Maps fractions of the surface to pixels; null hides the pointer. */
  toLocal: (x: number, y: number) => { left: number; top: number } | null;
  glyphScale?: number;
  className?: string;
  now?: () => number;
  /** Peers whose agent is working. */
  working?: ReadonlySet<string>;
}
export interface PeerCursorTagProps {
  name: string;
  color: string;
  message: string;
  dim: boolean;
  working: boolean;
}
/** Size of the tag when its content was last compared. */
interface PeerTagSnapshot {
  w: number;
  h: number;
  shape: string;
}
/** A running animation; CSS animations carry a name. */
type ElementAnimation = Animation & { animationName?: string };

declare module "../bindings" {
  interface RuntimeBindings {
    jsxGY: JsxNamespace;
    PEER_CURSOR_IDLE_TIMEOUT_MS: number;
    PEER_CURSOR_STALE_MS: number;
    PEER_CURSOR_GLIDE_MS: number;
    PEER_CURSOR_COLORS: string[];
    peerColorFromId: (id: string) => string;
    PEER_COLOR_PATTERN: RegExp;
    PEER_COLOR_INDEXES: Map<string, number>;
    peerColorIndex: (color: unknown, peerId: string) => number;
    peerColorCssVariable: (index: number) => string;
    MAX_PEER_CHAT_LENGTH: number;
    MAX_PEER_CHAT_DISPLAY_LENGTH: number;
    PEER_CHAT_HOLD_MS: number;
    PEER_CHAT_FADE_MS: number;
    PEER_CHAT_EXIT_MS: number;
    PEER_CHAT_CSS_TIMINGS: PeerChatCssTimings;
    prefersReducedCursorMotion: () => boolean;
    usePeerMessageFade: (message: string) => RefObject<HTMLSpanElement | null>;
    PeerCursorTag: NamedExoticComponent<PeerCursorTagProps>;
    sanitizePeerChatMessage: (message: string) => string;
    createCursorPresence: (options?: CursorPresenceOptions) => CursorPresence;
    peerProfileCache: Map<string, string>;
    visiblePeerCursors: (
      peers: readonly RoomPeer[],
      surface: string,
      now: number,
      profiles?: Map<string, string>,
    ) => VisiblePeerCursor[];
    usePeerProfiles: (peers: readonly RoomPeer[]) => Map<string, string>;
    usePeerCursors: (surface: string, now?: () => number) => VisiblePeerCursor[];
    PeerCursors: (props: PeerCursorsProps) => ReactElement;
  }
}

export function installUiPeerCursors(runtime: RuntimeBindings): () => void {
  var jsxGY: JsxNamespace;
  var PEER_CURSOR_IDLE_TIMEOUT_MS: number;
  var PEER_CURSOR_STALE_MS: number;
  var PEER_CURSOR_GLIDE_MS: number;
  var PEER_CURSOR_COLORS: string[];
  var PEER_COLOR_PATTERN: RegExp;
  var PEER_COLOR_INDEXES: Map<string, number>;
  var MAX_PEER_CHAT_LENGTH: number;
  var MAX_PEER_CHAT_DISPLAY_LENGTH: number;
  var PEER_CHAT_HOLD_MS: number;
  var PEER_CHAT_FADE_MS: number;
  var PEER_CHAT_EXIT_MS: number;
  var PEER_CHAT_CSS_TIMINGS: PeerChatCssTimings;
  var PeerCursorTag: NamedExoticComponent<PeerCursorTagProps>;
  var peerProfileCache: Map<string, string>;
  function peerColorFromId(id: string): string {
    let index = 0;
    for (let index2 = 0; index2 < id.length; index2++)
      index = (index * 31 + id.charCodeAt(index2)) >>> 0;
    return PEER_CURSOR_COLORS[index % PEER_CURSOR_COLORS.length] ?? "#788c5d";
  }
  function peerColorIndex(color: unknown, peerId: string): number {
    return (
      (typeof color === "string" && PEER_COLOR_PATTERN.test(color)
        ? PEER_COLOR_INDEXES.get(color.toLowerCase())
        : undefined) ??
      PEER_COLOR_INDEXES.get(peerColorFromId(peerId)) ??
      1
    );
  }
  function peerColorCssVariable(index: number): string {
    return (
      runtime.designTokens.editor.collaborator[index]?.cssVar ??
      runtime.designTokens.editor.collaborator[1].cssVar
    );
  }
  function prefersReducedCursorMotion(): boolean {
    return (
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }
  function usePeerMessageFade(
    message: string,
  ): RefObject<HTMLSpanElement | null> {
    let ref = runtime.reactx4.useRef<HTMLSpanElement>(null),
      ref2 = runtime.reactx4.useRef<PeerTagSnapshot | null>(null),
      current = ref.current,
      value =
        current != null &&
        typeof getComputedStyle === "function" &&
        parseFloat(getComputedStyle(current).opacity) < 0.2;
    runtime.reactx4.useLayoutEffect(() => {
      let current2 = ref.current;
      if (!current2) {
        return;
      }
      let state = {
          w: current2.offsetWidth,
          h: current2.offsetHeight,
          shape: message,
        },
        current3 = ref2.current;
      ref2.current = state;
      if (
        !current3 ||
        current3.shape === message ||
        !state.w ||
        !state.h ||
        typeof current2.animate !== "function"
      ) {
        return;
      }
      for (let value4 of (current2.getAnimations?.() ??
        []) as ElementAnimation[])
        if (!value4.animationName) {
          value4.cancel();
        }
      if (value || prefersReducedCursorMotion()) {
        current2.animate(
          [
            {
              opacity: 0,
            },
            {
              opacity: 1,
            },
          ],
          {
            duration: 160,
            easing: "ease-out",
          },
        );
        return;
      }
      let value2 = Math.min(
          2,
          Math.max(
            0.5,
            Math.sqrt((current3.w / state.w) * (current3.h / state.h)),
          ),
        ),
        value3 = message === "line";
      current2.animate(
        [
          {
            transform: "scale(" + value2 + ")",
            transformOrigin: "0 0",
          },
          {
            transform: "scale(1)",
            transformOrigin: "0 0",
          },
        ],
        {
          duration: value3 ? 200 : 160,
          easing: value3 ? "cubic-bezier(.2,.9,.3,1.15)" : "ease-in",
        },
      );
    });
    return ref;
  }
  function sanitizePeerChatMessage(message: string): string {
    let value = Array.from(
      message
        .replace(/[\p{Cc}\p{Zl}\p{Zp}\s]+/gu, " ")
        .replace(/[^\P{Cf}\u200C\u200D]+/gu, ""),
    )
      .slice(0, MAX_PEER_CHAT_DISPLAY_LENGTH)
      .join("");
    if (/^[\s\u200C\u200D\p{Variation_Selector}]*$/u.test(value)) {
      return "";
    } else {
      return value;
    }
  }
  function createCursorPresence(
    options: CursorPresenceOptions = {},
  ): CursorPresence {
    let value = options.now ?? (() => Date.now()),
      value2 = options.minDelta ?? 0.002,
      value3 = options.idleNullMs ?? PEER_CURSOR_IDLE_TIMEOUT_MS,
      value4 = !(0, runtime.hasHostRoomApi)(),
      value5: PublishedPeerCursor | undefined,
      value6: PeerCursorPosition | undefined,
      value7: ReturnType<typeof setTimeout> | undefined,
      value8: PeerCursorPosition | undefined,
      value9: ReturnType<typeof setTimeout> | undefined,
      flag = false,
      text = "";
    async function value10(input: RoomPresencePatch): Promise<void> {
      if (value4) {
        return;
      }
      let value13 = await (0, runtime.cachedHostRoom)();
      if (typeof value13?.presence !== "function") {
        value4 = true;
        return;
      }
      try {
        await value13.presence.call(value13, input);
      } catch (value14: unknown) {
        let value15 =
          typeof value14 === "object" && value14 !== null
            ? (value14 as { code?: unknown }).code
            : "";
        if (value15 !== "upstream_error" && value15 !== "invalid_argument") {
          value4 = true;
        }
      }
    }
    function value11() {
      if (value9 !== undefined) {
        clearTimeout(value9);
      }
      value9 = undefined;
      value8 = undefined;
      value5 = undefined;
      if (!flag) {
        return;
      }
      flag = false;
      value10({
        cursor: null,
      });
    }
    function value12(input: string, options2: number, context: number) {
      let value13 = value();
      value5 = {
        s: input,
        x: options2,
        y: context,
        at: value13,
      };
      value6 = {
        s: input,
        x: options2,
        y: context,
      };
      flag = true;
      let callback2 = (input2: number) => Math.round(input2 * 1e4) / 1e4;
      value10({
        cursor: {
          s: input.slice(0, MAX_PEER_CHAT_LENGTH),
          x: callback2(options2),
          y: callback2(context),
          t: value13,
          ...(text === ""
            ? {}
            : {
                m: text,
              }),
        },
      });
      if (value9 !== undefined) {
        clearTimeout(value9);
      }
      value9 = setTimeout(value11, value3);
    }
    let callback = () => state.clear();
    if (typeof addEventListener === "function") {
      addEventListener("pagehide", callback);
    }
    let state = {
      move(input: string, options2: number, context: number) {
        if (value4 || !Number.isFinite(options2) || !Number.isFinite(context)) {
          return;
        }
        if (
          value5 &&
          value5.s === input &&
          Math.abs(value5.x - options2) < value2 &&
          Math.abs(value5.y - context) < value2
        ) {
          return;
        }
        let value13 = value();
        if (
          value5 &&
          value5.s === input &&
          value13 - value5.at < PEER_CURSOR_GLIDE_MS
        ) {
          value8 = {
            s: input,
            x: options2,
            y: context,
          };
          value7 ??= setTimeout(() => {
            value7 = undefined;
            let value14 = value8;
            value8 = undefined;
            if (value14) {
              value12(value14.s, value14.x, value14.y);
            }
          }, PEER_CURSOR_GLIDE_MS);
          return;
        }
        value8 = undefined;
        value12(input, options2, context);
      },
      say(input: string): boolean {
        let value13 = sanitizePeerChatMessage(input);
        if (value4 || value13 === text || !value6) {
          return false;
        }
        text = value13;
        let value14 = value8 ?? value6;
        value8 = undefined;
        value12(value14.s, value14.x, value14.y);
        return true;
      },
      live: () => !value4 && value6 !== undefined,
      clear() {
        value11();
      },
      setWho(input: string, options2: string) {
        let value13 = Array.from(input).slice(0, 40).join(""),
          value14 = PEER_COLOR_PATTERN.test(options2) ? options2 : "";
        if (value13 === "" && value14 === "") {
          return;
        }
        value10({
          who: {
            n: value13,
            c: value14,
          },
        });
      },
      dispose() {
        value11();
        value4 = true;
        if (value7 !== undefined) {
          clearTimeout(value7);
        }
        if (typeof removeEventListener === "function") {
          removeEventListener("pagehide", callback);
        }
      },
    };
    return state;
  }
  function visiblePeerCursors(
    peers: readonly RoomPeer[],
    surface: string,
    now: number,
    profiles: Map<string, string> = peerProfileCache,
  ): VisiblePeerCursor[] {
    let items: VisiblePeerCursor[] = [];
    for (let value of peers) {
      if (value.sameTab) {
        continue;
      }
      let cursor = value.presence.cursor;
      if (typeof cursor !== "object" || cursor === null) {
        continue;
      }
      let value2 = cursor;
      if (value2.s !== surface) {
        continue;
      }
      let t = value2.t,
        value3 =
          typeof t === "number" && Number.isFinite(t)
            ? Math.min(t, now)
            : value.updatedAt,
        value4 = now - value3;
      if (value4 >= PEER_CURSOR_IDLE_TIMEOUT_MS) {
        continue;
      }
      let { x: value5, y: value6 } = value2;
      if (
        typeof value5 !== "number" ||
        typeof value6 !== "number" ||
        !Number.isFinite(value5) ||
        !Number.isFinite(value6)
      ) {
        continue;
      }
      let who = value.presence.who,
        value7: PeerWhoPresence =
          typeof who === "object" && who !== null ? who : {},
        value8 = (
          (value.by !== null && profiles.get(value.by)) ||
          (typeof value7.n === "string" ? value7.n : "")
        ).slice(0, 40),
        value9 = peerColorIndex(value7.c, value.peer),
        value10 = value.updatedAt > 0 ? now - value.updatedAt : value4,
        value11 =
          typeof value2.m === "string" &&
          value10 < PEER_CHAT_HOLD_MS + PEER_CHAT_FADE_MS
            ? sanitizePeerChatMessage(value2.m).trim()
            : "";
      items.push({
        peer: value.peer,
        x: value5,
        y: value6,
        name: value8,
        collaborator: value9,
        idleMs: Math.max(0, value4),
        message: value11,
      });
    }
    return items;
  }
  function usePeerProfiles(peers: readonly RoomPeer[]): Map<string, string> {
    let value = [
        ...new Set(
          peers.flatMap(
            (input: RoomPeer) =>
              input.by !== null && !input.sameTab ? [input.by] : [],
          ),
        ),
      ].sort().join(`
`),
      [value2, value3] = runtime.reactx4.useState(peerProfileCache);
    runtime.reactx4.useEffect(() => {
      if (value === "") {
        return;
      }
      let flag = true;
      (0, runtime.userProfiles)(
        value.split(`
`),
      ).then((input: Map<string, string>) => {
        if (flag) {
          value3(input);
        }
      });
      return () => {
        flag = false;
      };
    }, [value]);
    return value2;
  }
  function usePeerCursors(
    surface: string,
    now: () => number = Date.now,
  ): VisiblePeerCursor[] {
    let value = runtime.reactx4.useSyncExternalStore(
        runtime.roomPeerStore.subscribe,
        runtime.roomPeerStore.getSnapshot,
        runtime.roomPeerStore.getSnapshot,
      ),
      value2 = usePeerProfiles(value),
      [, value3] = runtime.reactx4.useState(0);
    runtime.reactx4.useEffect(() => {
      let value4 = setInterval(
        () => value3((input) => input + 1),
        5000,
      );
      return () => clearInterval(value4);
    }, []);
    return visiblePeerCursors(value, surface, now(), value2);
  }
  function PeerCursors({
    surface: surface,
    toLocal: toLocal,
    glyphScale: glyphScale,
    className: className,
    now: now,
    working: working,
  }: PeerCursorsProps): ReactElement {
    let value = usePeerCursors(surface, now),
      value2 =
        glyphScale !== undefined &&
        Number.isFinite(glyphScale) &&
        glyphScale > 0
          ? glyphScale
          : 1;
    return jsxGY.jsx("div", {
      "aria-hidden": "true",
      className: "mc-peer-cursors " + (className ?? ""),
      children: value.map((input) => {
        let value3 = toLocal(input.x, input.y);
        if (value3 === null) {
          return null;
        }
        let value4 = input.idleMs >= PEER_CURSOR_STALE_MS,
          value5 = peerColorCssVariable(input.collaborator);
        return jsxGY.jsxs(
          "div",
          {
            className: "mc-peer-cursor",
            "data-idle": value4 ? "true" : undefined,
            style: {
              transform:
                "translate(" +
                value3.left +
                "px," +
                value3.top +
                "px)" +
                (value2 === 1 ? "" : " scale(" + value2 + ")"),
              transformOrigin: "0 0",
            },
            children: [
              jsxGY.jsx(runtime.PeerCursorArrow, {
                color: value5,
              }),
              jsxGY.jsx(PeerCursorTag, {
                name: input.name,
                color: value5,
                message: input.message,
                dim: value4,
                working: working?.has(input.peer) === true,
              }),
            ],
          },
          input.peer,
        );
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "jsxGY",
    () => jsxGY,
    (value) => {
      jsxGY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PEER_CURSOR_IDLE_TIMEOUT_MS",
    () => PEER_CURSOR_IDLE_TIMEOUT_MS,
    (value) => {
      PEER_CURSOR_IDLE_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PEER_CURSOR_STALE_MS",
    () => PEER_CURSOR_STALE_MS,
    (value) => {
      PEER_CURSOR_STALE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PEER_CURSOR_GLIDE_MS",
    () => PEER_CURSOR_GLIDE_MS,
    (value) => {
      PEER_CURSOR_GLIDE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PEER_CURSOR_COLORS",
    () => PEER_CURSOR_COLORS,
    (value) => {
      PEER_CURSOR_COLORS = value;
    },
  );
  bindRuntimeValue(runtime, "peerColorFromId", () => peerColorFromId);
  bindRuntimeValue(
    runtime,
    "PEER_COLOR_PATTERN",
    () => PEER_COLOR_PATTERN,
    (value) => {
      PEER_COLOR_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PEER_COLOR_INDEXES",
    () => PEER_COLOR_INDEXES,
    (value) => {
      PEER_COLOR_INDEXES = value;
    },
  );
  bindRuntimeValue(runtime, "peerColorIndex", () => peerColorIndex);
  bindRuntimeValue(runtime, "peerColorCssVariable", () => peerColorCssVariable);
  bindRuntimeValue(
    runtime,
    "MAX_PEER_CHAT_LENGTH",
    () => MAX_PEER_CHAT_LENGTH,
    (value) => {
      MAX_PEER_CHAT_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PEER_CHAT_DISPLAY_LENGTH",
    () => MAX_PEER_CHAT_DISPLAY_LENGTH,
    (value) => {
      MAX_PEER_CHAT_DISPLAY_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PEER_CHAT_HOLD_MS",
    () => PEER_CHAT_HOLD_MS,
    (value) => {
      PEER_CHAT_HOLD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PEER_CHAT_FADE_MS",
    () => PEER_CHAT_FADE_MS,
    (value) => {
      PEER_CHAT_FADE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PEER_CHAT_EXIT_MS",
    () => PEER_CHAT_EXIT_MS,
    (value) => {
      PEER_CHAT_EXIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PEER_CHAT_CSS_TIMINGS",
    () => PEER_CHAT_CSS_TIMINGS,
    (value) => {
      PEER_CHAT_CSS_TIMINGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "prefersReducedCursorMotion",
    () => prefersReducedCursorMotion,
  );
  bindRuntimeValue(runtime, "usePeerMessageFade", () => usePeerMessageFade);
  bindRuntimeValue(
    runtime,
    "PeerCursorTag",
    () => PeerCursorTag,
    (value) => {
      PeerCursorTag = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizePeerChatMessage",
    () => sanitizePeerChatMessage,
  );
  bindRuntimeValue(runtime, "createCursorPresence", () => createCursorPresence);
  bindRuntimeValue(
    runtime,
    "peerProfileCache",
    () => peerProfileCache,
    (value) => {
      peerProfileCache = value;
    },
  );
  bindRuntimeValue(runtime, "visiblePeerCursors", () => visiblePeerCursors);
  bindRuntimeValue(runtime, "usePeerProfiles", () => usePeerProfiles);
  bindRuntimeValue(runtime, "usePeerCursors", () => usePeerCursors);
  bindRuntimeValue(runtime, "PeerCursors", () => PeerCursors);
  return () => {
    (0, runtime.initializeUiPropertyFocus)();
    jsxGY = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    PEER_CURSOR_IDLE_TIMEOUT_MS = 900000;
    PEER_CURSOR_STALE_MS = 60000;
    PEER_CURSOR_GLIDE_MS = 33;
    PEER_CURSOR_COLORS = [
      "#62744c",
      "#b04e72",
      "#5b7596",
      "#a3651f",
      "#7a6ba8",
      "#3f7a75",
    ];
    PEER_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
    PEER_COLOR_INDEXES = new Map([
      ["#7a6ba8", 1],
      ["#b04e72", 2],
      ["#3f7a75", 3],
      ["#62744c", 4],
      ["#a3651f", 5],
      ["#5b7596", 6],
      ["#c7c9d1", 6],
    ]);
    MAX_PEER_CHAT_LENGTH = 128;
    MAX_PEER_CHAT_DISPLAY_LENGTH = 50;
    PEER_CHAT_HOLD_MS = 5000;
    PEER_CHAT_FADE_MS = 600;
    PEER_CHAT_EXIT_MS = 150;
    PEER_CHAT_CSS_TIMINGS = {
      "--mc-chat-hold": PEER_CHAT_HOLD_MS + "ms",
      "--mc-chat-fade": PEER_CHAT_FADE_MS + "ms",
      "--mc-chat-exit": PEER_CHAT_EXIT_MS + "ms",
    };
    PeerCursorTag = runtime.reactx4.memo(function ({
      name: name,
      color: color,
      message: message,
      dim: dim,
      working: working,
    }: PeerCursorTagProps): ReactElement | null {
      let ref = runtime.reactx4.useRef({
        m: "",
        n: 0,
      });
      if (message !== ref.current.m) {
        ref.current = {
          m: message,
          n: message === "" ? ref.current.n : ref.current.n + 1,
        };
      }
      let [value, value2] = runtime.reactx4.useState(0),
        value3 =
          message !== "" && value !== ref.current.n ? "line" : "name",
        value4 = usePeerMessageFade(value3);
      if (dim && value3 === "name" && !working) {
        return null;
      }
      return jsxGY.jsxs("span", {
        ref: value4,
        className:
          "mc-peer-tag " +
          (value3 === "name" ? "mc-peer-cursor-label" : "mc-cursor-chat"),
        "data-mode": value3,
        "data-working": working && value3 === "name" ? "true" : undefined,
        "data-beat": value3 === "line" ? ref.current.n % 2 : undefined,
        style: {
          background: color,
          ...PEER_CHAT_CSS_TIMINGS,
        },
        onAnimationEnd: (event: ReactAnimationEvent<HTMLSpanElement>) => {
          if (
            event.target === event.currentTarget &&
            event.animationName === "mc-cursor-chat-fade-" + (ref.current.n % 2)
          ) {
            value2(ref.current.n);
          }
        },
        children: [
          value3 === "name"
            ? jsxGY.jsx(
                "span",
                {
                  className: "mc-peer-tag-name",
                  children: (name || "Someone").slice(0, 16),
                },
                "name",
              )
            : jsxGY.jsx(
                "span",
                {
                  className: "mc-peer-tag-line",
                  children: message,
                },
                "line",
              ),
          working && value3 === "name"
            ? jsxGY.jsxs("span", {
                className: "mc-peer-tag-dots",
                children: [
                  jsxGY.jsx("i", {}),
                  jsxGY.jsx("i", {}),
                  jsxGY.jsx("i", {}),
                ],
              })
            : null,
        ],
      });
    });
    peerProfileCache = new Map();
  };
}
