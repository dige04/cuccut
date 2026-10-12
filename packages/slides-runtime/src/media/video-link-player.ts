/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";
import type { VideoProvider, VideoLink } from "./video-links";

/** A snapshot store that components subscribe to with `use()` and that is poked with `changed()`. */
export interface ObservedStore<T> {
  /** Tells every subscribed component that the snapshot may have changed. */
  changed: () => void;
  /** Hook: returns the current snapshot and re-renders when it changes. */
  use: () => T;
}
/** Keeps a screenshot waiting while a player iframe still holds focus. */
export interface PlayerCaptureLease {
  /** True when no player holds focus, so the capture may proceed. */
  clear: boolean;
  /** Ends the capture; calling it again is harmless. */
  done: () => void;
}
export interface VideoLinkPlayerProps {
  link: VideoLink;
  /** Image shown until the player is loaded. */
  poster?: string;
  posterStyle?: React.CSSProperties;
  onPosterError?: () => void;
  label?: string;
  /** Whether the player should be loaded. */
  live?: boolean;
  /** Reports whether the player actually went live (false when it cannot). */
  onLive: (live: boolean) => void;
  /** Whether a click on the poster loads the player. */
  pressable?: boolean;
  /** Tells whether keyboard focus should be kept out of the player. */
  keepKeys?: () => boolean;
  /** Adds a focus trap in front of the player. */
  trapped?: boolean;
  onOpenLink?: () => void;
  /** CSS length expression of the slide scale, used to size overlays. */
  scale?: string;
  style?: React.CSSProperties;
  /** Extra attributes for the outer element (data attributes). */
  marks?: Record<string, string>;
  boxRef?: React.RefObject<HTMLDivElement | null>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    VideoLinkPlayerReact: ReactNamespace;
    VideoLinkPlayerJsx: JsxNamespace;
    createObservedStore: <T>(
      getSnapshot: () => T,
      subscribe?: () => () => void,
    ) => ObservedStore<T>;
    recordVideoCspViolation: (event: SecurityPolicyViolationEvent) => void;
    useVideoProviderBlocked: (provider: VideoProvider) => boolean;
    releasePlayerFocus: (attempts: number) => void;
    acquirePlayerFocus: () => () => void;
    usePlayerHasFocus: () => boolean;
    beginPlayerCapture: () => Promise<PlayerCaptureLease>;
    focusVideoPlayerElement: (element: HTMLElement) => void;
    VideoLinkPlayer: (props: VideoLinkPlayerProps) => React.ReactElement;
    playerPressTimeoutMs: number;
    playerFocusPollMs: number;
    playerFocusRetryMs: number;
    blockedVideoProviders: Set<VideoProvider>;
    blockedVideoProvidersSnapshot: string;
    blockedVideoProvidersStore: ObservedStore<string>;
    playerFocusLeases: Set<symbol>;
    playerHasFocus: boolean;
    playerFocusStore: ObservedStore<boolean>;
    playerFocusRetryCount: number;
    playerCaptureCount: number;
    playerCaptureStore: ObservedStore<boolean>;
    playerCaptureFocusTimeoutMs: number;
    playerBeforeAttribute: string;
    playerFocusedFrames: WeakSet<HTMLElement>;
    initializeVideoLinkPlayer: () => void;
  }
}

export function installMediaVideoLinkPlayer(
  runtime: RuntimeBindings,
): () => void {
  var VideoLinkPlayerReact: ReactNamespace;
  var VideoLinkPlayerJsx: JsxNamespace;
  var playerPressTimeoutMs: RuntimeBindings["playerPressTimeoutMs"];
  var playerFocusPollMs: RuntimeBindings["playerFocusPollMs"];
  var playerFocusRetryMs: RuntimeBindings["playerFocusRetryMs"];
  var blockedVideoProviders: RuntimeBindings["blockedVideoProviders"];
  var blockedVideoProvidersSnapshot: RuntimeBindings["blockedVideoProvidersSnapshot"];
  var blockedVideoProvidersStore: RuntimeBindings["blockedVideoProvidersStore"];
  var playerFocusLeases: RuntimeBindings["playerFocusLeases"];
  var playerHasFocus: RuntimeBindings["playerHasFocus"];
  var playerFocusStore: RuntimeBindings["playerFocusStore"];
  var playerFocusRetryCount: RuntimeBindings["playerFocusRetryCount"];
  var playerCaptureCount: RuntimeBindings["playerCaptureCount"];
  var playerCaptureStore: RuntimeBindings["playerCaptureStore"];
  var playerCaptureFocusTimeoutMs: RuntimeBindings["playerCaptureFocusTimeoutMs"];
  var playerBeforeAttribute: RuntimeBindings["playerBeforeAttribute"];
  var playerFocusedFrames: RuntimeBindings["playerFocusedFrames"];
  var initializeVideoLinkPlayer: RuntimeBindings["initializeVideoLinkPlayer"];
  function createObservedStore<T>(
    getSnapshot: () => T,
    subscribe?: () => () => void,
  ): ObservedStore<T> {
    let listeners = new Set<() => void>(),
      cleanup: (() => void) | undefined,
      subscribe2 = (input: () => void): (() => void) => {
        if (listeners.size === 0) {
          cleanup = subscribe?.();
        }
        listeners.add(input);
        return (): void => {
          listeners.delete(input);
          if (listeners.size === 0) {
            cleanup?.();
          }
        };
      };
    return {
      changed: (): void => {
        for (let value of [...listeners]) value();
      },
      use: (): T =>
        VideoLinkPlayerReact.useSyncExternalStore(
          subscribe2,
          getSnapshot,
          getSnapshot,
        ),
    };
  }
  function recordVideoCspViolation(event: SecurityPolicyViolationEvent): void {
    if (
      event.disposition === "report" ||
      event.effectiveDirective !== "frame-src"
    ) {
      return;
    }
    let text = "";
    try {
      text = new URL(event.blockedURI).origin;
    } catch {
      return;
    }
    for (let value of runtime.videoProviders)
      if (text === (0, runtime.videoProviderOrigin)(value)) {
        blockedVideoProviders.add(value);
      }
    blockedVideoProvidersSnapshot = [...blockedVideoProviders].join(" ");
    blockedVideoProvidersStore.changed();
  }
  function useVideoProviderBlocked(provider: VideoProvider): boolean {
    return blockedVideoProvidersStore.use().split(" ").includes(provider);
  }
  function releasePlayerFocus(attempts: number): void {
    if (playerFocusLeases.size > 0 || !playerHasFocus) {
      return;
    }
    let activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement.tagName === "IFRAME"
    ) {
      activeElement.blur();
      if (attempts > 0) {
        setTimeout((): void => releasePlayerFocus(attempts - 1), 50);
      } else {
        window.addEventListener(
          "focus",
          (): void => releasePlayerFocus(playerFocusRetryCount),
          {
            once: true,
          },
        );
      }
      return;
    }
    playerHasFocus = false;
    playerFocusStore.changed();
  }
  function acquirePlayerFocus(): () => void {
    let value = Symbol("player");
    playerFocusLeases.add(value);
    if (!playerHasFocus) {
      playerHasFocus = true;
      playerFocusStore.changed();
    }
    return (): void => {
      playerFocusLeases.delete(value);
      setTimeout((): void => releasePlayerFocus(playerFocusRetryCount), 0);
    };
  }
  function usePlayerHasFocus(): boolean {
    return playerFocusStore.use();
  }
  async function beginPlayerCapture(): Promise<PlayerCaptureLease> {
    playerCaptureCount += 1;
    playerCaptureStore.changed();
    let flag = false,
      callback = (): void => {
        if (flag) {
          return;
        }
        flag = true;
        playerCaptureCount -= 1;
        playerCaptureStore.changed();
      },
      value = Date.now() + playerCaptureFocusTimeoutMs;
    while (playerHasFocus && Date.now() < value)
      await new Promise<void>((input) => setTimeout(input, 25));
    return {
      clear: !playerHasFocus,
      done: callback,
    };
  }
  function focusVideoPlayerElement(element: HTMLElement): void {
    if (element.tagName === "IFRAME") {
      playerFocusedFrames.add(element);
    }
    element.focus();
  }
  function VideoLinkPlayer({
    link: link,
    poster: poster,
    posterStyle: posterStyle,
    onPosterError: onPosterError,
    label: label,
    live: live,
    onLive: onLive,
    pressable: pressable,
    keepKeys: keepKeys,
    trapped = false,
    onOpenLink: onOpenLink,
    scale = "1",
    style: style,
    marks: marks,
    boxRef: boxRef,
  }: VideoLinkPlayerProps): React.ReactElement {
    let value = (0, runtime.videoEmbedUrl)(link),
      value2 = (0, runtime.videoWatchUrl)(link),
      value3 = value !== null && !useVideoProviderBlocked(link.provider),
      value4 = playerCaptureStore.use(),
      ref = VideoLinkPlayerReact.useRef<HTMLDivElement | null>(null),
      ref2 = VideoLinkPlayerReact.useRef<HTMLIFrameElement | null>(null),
      [value5, value6] = VideoLinkPlayerReact.useState(false),
      [value7, value8] = VideoLinkPlayerReact.useState(false),
      ref3 = VideoLinkPlayerReact.useRef(onLive);
    ref3.current = onLive;
    let callback = (): boolean => {
      let value14 = ref.current?.getBoundingClientRect();
      return (
        value14 !== undefined &&
        value14.width >= playerPressTimeoutMs &&
        value14.height >= playerPressTimeoutMs
      );
    };
    VideoLinkPlayerReact.useLayoutEffect((): (() => void) | undefined => {
      if (!live) {
        return;
      }
      if (!value3 || value4 || !callback()) {
        if (value3 && !value4) {
          value6(true);
        }
        ref3.current(false);
        return;
      }
      value6(false);
      let value14 = acquirePlayerFocus();
      value8(true);
      return (): void => {
        value8(false);
        value14();
      };
    }, [live, value3, value4]);
    VideoLinkPlayerReact.useEffect((): (() => void) | undefined => {
      if (!value5) {
        return;
      }
      let callback4 = (): void => value6(false);
      window.addEventListener("resize", callback4);
      return (): void => window.removeEventListener("resize", callback4);
    }, [value5]);
    let value9 = live && value3 && !value4 && value7,
      ref4 = VideoLinkPlayerReact.useRef(keepKeys);
    ref4.current = keepKeys;
    VideoLinkPlayerReact.useEffect((): (() => void) | undefined => {
      if (!value9) {
        return;
      }
      let value14 = -1 / 0,
        value15: ReturnType<typeof setTimeout> | undefined,
        callback4 = (): void => {
          let current = ref2.current;
          if (
            current === null ||
            document.activeElement !== current ||
            playerFocusedFrames.has(current) ||
            document.fullscreenElement === current ||
            ref4.current?.() !== true
          ) {
            return;
          }
          let value16 = current.parentElement?.closest<HTMLElement>("[tabindex]");
          if (value16 != null) {
            value16.focus({
              preventScroll: true,
            });
          } else {
            current.blur();
          }
        },
        callback5 = (input: KeyboardEvent): void => {
          if (input.key === "Tab") {
            value14 = performance.now();
          }
        },
        callback6 = (): void => {
          if (performance.now() - value14 < playerFocusPollMs) {
            return;
          }
          clearTimeout(value15);
          value15 = setTimeout(callback4, playerFocusRetryMs);
        },
        callback7 = (): void =>
          document.fullscreenElement === ref2.current
            ? ref2.current?.focus()
            : callback4(),
        callback8 = (): void => {
          value14 = -1 / 0;
          if (ref2.current !== null) {
            playerFocusedFrames.delete(ref2.current);
          }
        };
      window.addEventListener("keydown", callback5, true);
      window.addEventListener("blur", callback6);
      window.addEventListener("focus", callback8);
      document.addEventListener("fullscreenchange", callback7);
      return (): void => {
        clearTimeout(value15);
        window.removeEventListener("keydown", callback5, true);
        window.removeEventListener("blur", callback6);
        window.removeEventListener("focus", callback8);
        document.removeEventListener("fullscreenchange", callback7);
      };
    }, [value9]);
    VideoLinkPlayerReact.useLayoutEffect((): (() => void) | undefined => {
      let current = ref2.current;
      if (!value9 || current === null) {
        return;
      }
      return (): void => {
        if (document.activeElement !== current) {
          return;
        }
        let value14 = current.parentElement?.closest<HTMLElement>("[tabindex]");
        if (value14 != null) {
          value14.focus({
            preventScroll: true,
          });
        } else {
          current.blur();
        }
      };
    }, [value9]);
    let callback2 = (input: React.FocusEvent<HTMLSpanElement>): void => {
        let value14 =
          input.currentTarget.parentElement?.closest<HTMLElement>("[tabindex]");
        if (value14 != null) {
          value14.focus({
            preventScroll: true,
          });
        } else {
          input.currentTarget.blur();
        }
      },
      value10 = runtime.videoProviderLabels[link.provider],
      value11 = value2 !== null && !value9 && (!value3 || value5),
      callback3 = (): void =>
        callback() ? ref3.current(true) : value6(true),
      value12 =
        pressable && value3 && !value9 && !value5
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label":
                runtime.playbackActionLabels.play + " " + (label || "video"),
              onClick: (input: React.MouseEvent): void => {
                input.stopPropagation();
                callback3();
              },
              onKeyDown: (event: React.KeyboardEvent): void => {
                if (event.key !== "Enter" || event.repeat) {
                  return;
                }
                event.preventDefault();
                callback3();
              },
            }
          : poster === undefined && !value9
            ? {
                role: value11 ? "group" : "img",
                "aria-label": label || "Video",
              }
            : null,
      value13 = "calc(1 / " + scale + ")";
    return VideoLinkPlayerJsx.jsxs("div", {
      ref: (input: HTMLDivElement | null): void => {
        ref.current = input;
        if (boxRef !== undefined) {
          boxRef.current = input;
        }
      },
      ...marks,
      ...value12,
      style: {
        ...style,
        position: "relative",
        overflow: "hidden",
        ...(value12?.role === "button"
          ? {
              cursor: "pointer",
              outlineOffset: -4,
            }
          : null),
        ...(poster === undefined
          ? {
              minWidth: 120,
              minHeight: 80,
              backgroundColor: "#141413",
            }
          : null),
      },
      children: [
        poster !== undefined
          ? VideoLinkPlayerJsx.jsx("img", {
              src: poster,
              alt: value12?.role === "button" ? "" : label,
              "aria-hidden": value9 || undefined,
              draggable: false,
              onError: onPosterError,
              style: posterStyle ?? {
                display: "block",
                width: "100%",
                height: "100%",
                minHeight: "inherit",
                maxHeight: "inherit",
                objectFit: "cover",
              },
            })
          : null,
        value9 && value !== null
          ? VideoLinkPlayerJsx.jsxs(VideoLinkPlayerJsx.Fragment, {
              children: [
                trapped
                  ? VideoLinkPlayerJsx.jsx("span", {
                      tabIndex: 0,
                      ...{
                        [playerBeforeAttribute]: "",
                      },
                      onFocus: callback2,
                      style: {
                        position: "absolute",
                        width: 1,
                        height: 1,
                        opacity: 0,
                        pointerEvents: "none",
                      },
                    })
                  : null,
                VideoLinkPlayerJsx.jsx("iframe", {
                  ref: ref2,
                  src: value,
                  title: (label || "Video") + " (" + value10 + " player)",
                  allow: "fullscreen",
                  referrerPolicy: "strict-origin-when-cross-origin",
                  style: {
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    border: 0,
                  },
                }),
              ],
            })
          : value11
            ? VideoLinkPlayerJsx.jsx("a", {
                href: value2,
                target: "_blank",
                rel: "noopener noreferrer",
                "data-player-link": "",
                title: value3
                  ? "Too small to play here. Make it larger, or open it on " +
                    value10 +
                    "."
                  : "Can’t play on this page.",
                onPointerDown: (input: React.PointerEvent): void =>
                  input.stopPropagation(),
                onClick: (input: React.MouseEvent): void => {
                  input.stopPropagation();
                  onOpenLink?.();
                },
                style: {
                  position: "absolute",
                  left: "calc(12px * " + value13 + ")",
                  bottom: "calc(12px * " + value13 + ")",
                  transform: "scale(" + value13 + ")",
                  transformOrigin: "0 100%",
                  padding: "6px 12px",
                  borderRadius: 16,
                  background: "rgba(20,20,19,0.6)",
                  color: "#fff",
                  font: "500 13px/20px system-ui, sans-serif",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                },
                children: "Open on " + value10,
              })
            : VideoLinkPlayerJsx.jsx(runtime.ClipBadge, {
                scale: scale,
              }),
      ],
    });
  }
  bindRuntimeValue(runtime, "createObservedStore", () => createObservedStore);
  bindRuntimeValue(
    runtime,
    "recordVideoCspViolation",
    () => recordVideoCspViolation,
  );
  bindRuntimeValue(
    runtime,
    "useVideoProviderBlocked",
    () => useVideoProviderBlocked,
  );
  bindRuntimeValue(runtime, "releasePlayerFocus", () => releasePlayerFocus);
  bindRuntimeValue(runtime, "acquirePlayerFocus", () => acquirePlayerFocus);
  bindRuntimeValue(runtime, "usePlayerHasFocus", () => usePlayerHasFocus);
  bindRuntimeValue(runtime, "beginPlayerCapture", () => beginPlayerCapture);
  bindRuntimeValue(
    runtime,
    "focusVideoPlayerElement",
    () => focusVideoPlayerElement,
  );
  bindRuntimeValue(runtime, "VideoLinkPlayer", () => VideoLinkPlayer);
  bindRuntimeValue(
    runtime,
    "VideoLinkPlayerReact",
    () => VideoLinkPlayerReact,
    (value) => {
      VideoLinkPlayerReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VideoLinkPlayerJsx",
    () => VideoLinkPlayerJsx,
    (value) => {
      VideoLinkPlayerJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerPressTimeoutMs",
    () => playerPressTimeoutMs,
    (value) => {
      playerPressTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerFocusPollMs",
    () => playerFocusPollMs,
    (value) => {
      playerFocusPollMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerFocusRetryMs",
    () => playerFocusRetryMs,
    (value) => {
      playerFocusRetryMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blockedVideoProviders",
    () => blockedVideoProviders,
    (value) => {
      blockedVideoProviders = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blockedVideoProvidersSnapshot",
    () => blockedVideoProvidersSnapshot,
    (value) => {
      blockedVideoProvidersSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blockedVideoProvidersStore",
    () => blockedVideoProvidersStore,
    (value) => {
      blockedVideoProvidersStore = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerFocusLeases",
    () => playerFocusLeases,
    (value) => {
      playerFocusLeases = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerHasFocus",
    () => playerHasFocus,
    (value) => {
      playerHasFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerFocusStore",
    () => playerFocusStore,
    (value) => {
      playerFocusStore = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerFocusRetryCount",
    () => playerFocusRetryCount,
    (value) => {
      playerFocusRetryCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerCaptureCount",
    () => playerCaptureCount,
    (value) => {
      playerCaptureCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerCaptureStore",
    () => playerCaptureStore,
    (value) => {
      playerCaptureStore = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerCaptureFocusTimeoutMs",
    () => playerCaptureFocusTimeoutMs,
    (value) => {
      playerCaptureFocusTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerBeforeAttribute",
    () => playerBeforeAttribute,
    (value) => {
      playerBeforeAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playerFocusedFrames",
    () => playerFocusedFrames,
    (value) => {
      playerFocusedFrames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeVideoLinkPlayer",
    () => initializeVideoLinkPlayer,
    (value) => {
      initializeVideoLinkPlayer = value;
    },
  );
  return () => {
    playerPressTimeoutMs = 200;
    playerFocusPollMs = 100;
    playerFocusRetryMs = 50;
    blockedVideoProvidersSnapshot = "";
    playerHasFocus = false;
    playerFocusRetryCount = 20;
    playerCaptureCount = 0;
    playerCaptureFocusTimeoutMs = 2000;
    playerBeforeAttribute = "data-player-before";
    initializeVideoLinkPlayer = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeVideoController)();
      (0, runtime.initializeVideoLinks)();
      (0, runtime.initializeClipBadge)();
      VideoLinkPlayerReact = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      VideoLinkPlayerJsx = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      blockedVideoProviders = new Set();
      blockedVideoProvidersStore = createObservedStore(
        (): string => blockedVideoProvidersSnapshot,
        (): (() => void) => {
          document.addEventListener(
            "securitypolicyviolation",
            recordVideoCspViolation,
          );
          return (): void =>
            document.removeEventListener(
              "securitypolicyviolation",
              recordVideoCspViolation,
            );
        },
      );
      playerFocusLeases = new Set();
      playerFocusStore = createObservedStore((): boolean => playerHasFocus);
      playerCaptureStore = createObservedStore(
        (): boolean => playerCaptureCount > 0,
      );
      playerFocusedFrames = new WeakSet();
    });
  };
}
