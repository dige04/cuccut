/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { VideoProvider } from "./video-links";

declare module "../bindings" {
  interface RuntimeBindings {
    /** Per-provider memo of whether the page may embed that provider's player frame. */
    embeddedPlayerSupportCache: Map<VideoProvider, boolean>;
    canEmbedVideoProvider: (provider: VideoProvider) => boolean;
    /** The server's `frame-players` Server-Timing verdict, or undefined when it did not say. */
    serverAllowsVideoProvider: (provider: VideoProvider) => boolean | undefined;
    pageCspAllowsFrame: (frameUrl: string) => boolean;
    cspAllowsFrameUrl: (policy: string, frameUrl: string) => boolean;
  }
}

export function installMediaEmbeddedPlayerSupport(
  runtime: RuntimeBindings,
): () => void {
  var embeddedPlayerSupportCache: RuntimeBindings["embeddedPlayerSupportCache"];
  function canEmbedVideoProvider(provider: VideoProvider): boolean {
    let entry: boolean | undefined = embeddedPlayerSupportCache.get(provider);
    if (entry !== undefined) {
      return entry;
    }
    let value: boolean | undefined = serverAllowsVideoProvider(provider),
      value2: boolean =
        value === true ||
        pageCspAllowsFrame(
          (0, runtime.videoProviderOrigin)(provider) + "/embed/",
        );
    if (
      value2 ||
      value !== undefined ||
      (typeof document !== "undefined" &&
        document.readyState === "complete")
    ) {
      embeddedPlayerSupportCache.set(provider, value2);
    }
    return value2;
  }
  function serverAllowsVideoProvider(
    provider: VideoProvider,
  ): boolean | undefined {
    try {
      let value = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (value === undefined) {
        return;
      }
      return (value.serverTiming ?? []).some(
        (input: PerformanceServerTiming): boolean =>
          input.name === "frame-players" &&
          input.description.split(/\s+/).includes(provider),
      );
    } catch {
      return;
    }
  }
  function pageCspAllowsFrame(frameUrl: string): boolean {
    try {
      let value: string[] = Array.from(
        document.head.querySelectorAll("meta[http-equiv]"),
      )
        .filter(
          (element: Element): boolean =>
            (element.getAttribute("http-equiv") ?? "").toLowerCase() ===
            "content-security-policy",
        )
        .map(
          (element: Element): string => element.getAttribute("content") ?? "",
        );
      return (
        value.length > 0 &&
        value.every(
          (input: string): boolean =>
            !input.includes(",") && cspAllowsFrameUrl(input, frameUrl),
        )
      );
    } catch {
      return false;
    }
  }
  function cspAllowsFrameUrl(policy: string, frameUrl: string): boolean {
    let entries: Map<string, string[]> = new Map();
    for (let value3 of policy.split(";")) {
      let [value4, ...value5]: string[] = value3
        .split(/[\t\n\f\r ]+/)
        .filter((input: string): boolean => input !== "");
      if (
        value4 !== undefined &&
        value4 !== "" &&
        !entries.has(value4.toLowerCase())
      ) {
        entries.set(value4.toLowerCase(), value5);
      }
    }
    let value: string[] | undefined =
      entries.get("frame-src") ??
      entries.get("child-src") ??
      entries.get("default-src");
    if (value === undefined) {
      return false;
    }
    let value2: URL = new URL(frameUrl);
    return value.some((input: string): boolean => {
      if (input === "*" || input.toLowerCase() === "https:") {
        return true;
      }
      let value3: RegExpExecArray | null = /^https:\/\/(\*\.)?([a-z0-9.-]+)(\/[^?#]*)?$/i.exec(
        input,
      );
      if (value3 === null) {
        return false;
      }
      let value4: string = (value3[2] ?? "").toLowerCase();
      if (
        value3[1] === undefined
          ? value2.hostname !== value4
          : !value2.hostname.endsWith("." + value4)
      ) {
        return false;
      }
      let value5: string | undefined = value3[3];
      return (
        value5 === undefined ||
        (value5.endsWith("/")
          ? value2.pathname.startsWith(value5)
          : value2.pathname === value5)
      );
    });
  }
  bindRuntimeValue(
    runtime,
    "embeddedPlayerSupportCache",
    () => embeddedPlayerSupportCache,
    (value) => {
      embeddedPlayerSupportCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canEmbedVideoProvider",
    () => canEmbedVideoProvider,
  );
  bindRuntimeValue(
    runtime,
    "serverAllowsVideoProvider",
    () => serverAllowsVideoProvider,
  );
  bindRuntimeValue(runtime, "pageCspAllowsFrame", () => pageCspAllowsFrame);
  bindRuntimeValue(runtime, "cspAllowsFrameUrl", () => cspAllowsFrameUrl);
  return () => {
    (0, runtime.initializeVideoLinks)();
    embeddedPlayerSupportCache = new Map();
  };
}
