/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Hosts a slide can embed a video link from. */
export type VideoProvider = "youtube";
/** A normalized link to a hosted video. */
export interface VideoLink {
  provider: VideoProvider;
  id: string;
  /** Start offset in whole seconds; absent when it starts at the beginning. */
  start?: number;
}
/** Untrusted candidate for a video link, fields not yet validated. */
interface VideoLinkCandidate {
  provider?: unknown;
  id?: unknown;
  start?: unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    isSupportedVideoProvider: (provider: unknown) => provider is VideoProvider;
    isValidVideoProviderId: (
      provider: VideoProvider,
      id: unknown,
    ) => id is string;
    normalizeVideoStartSeconds: (seconds: unknown) => number | undefined;
    normalizeVideoLink: (link: unknown) => VideoLink | undefined;
    rawQueryParameter: (query: string, name: string) => string | undefined;
    parseYouTubeTimestamp: (timestamp: string | undefined) => number | undefined;
    parseVideoLinkUrl: (url: string) => VideoLink | null;
    videoProviderOrigin: (provider: VideoProvider) => string;
    videoEmbedUrl: (link: unknown) => string | null;
    videoWatchUrl: (link: unknown) => string | null;
    videoProviders: VideoProvider[];
    videoProviderLabels: Record<VideoProvider, string>;
    maxVideoLinkStartSeconds: number;
    videoProviderIdPatterns: Record<VideoProvider, RegExp>;
    forbiddenVideoProviderIds: Set<string>;
    videoProviderOrigins: Record<VideoProvider, string>;
    youtubeHostnames: Set<string>;
    youtubeShortHostnames: Set<string>;
    initializeVideoLinks: () => void;
  }
}

export function installMediaVideoLinks(runtime: RuntimeBindings): () => void {
  var videoProviders: RuntimeBindings["videoProviders"];
  var videoProviderLabels: RuntimeBindings["videoProviderLabels"];
  var maxVideoLinkStartSeconds: RuntimeBindings["maxVideoLinkStartSeconds"];
  var videoProviderIdPatterns: RuntimeBindings["videoProviderIdPatterns"];
  var forbiddenVideoProviderIds: RuntimeBindings["forbiddenVideoProviderIds"];
  var videoProviderOrigins: RuntimeBindings["videoProviderOrigins"];
  var youtubeHostnames: RuntimeBindings["youtubeHostnames"];
  var youtubeShortHostnames: RuntimeBindings["youtubeShortHostnames"];
  var initializeVideoLinks: RuntimeBindings["initializeVideoLinks"];
  function isSupportedVideoProvider(
    provider: unknown,
  ): provider is VideoProvider {
    return (
      typeof provider === "string" &&
      (videoProviders as readonly string[]).includes(provider)
    );
  }
  function isValidVideoProviderId(
    provider: VideoProvider,
    id: unknown,
  ): id is string {
    return (
      typeof id === "string" &&
      videoProviderIdPatterns[provider].test(id) &&
      !forbiddenVideoProviderIds.has(id)
    );
  }
  function normalizeVideoStartSeconds(seconds: unknown): number | undefined {
    let value =
      typeof seconds === "number"
        ? seconds
        : typeof seconds === "string" &&
            /^\d{1,7}(?:\.\d+)?$/.test(seconds.trim())
          ? Number(seconds.trim())
          : NaN;
    if (!Number.isFinite(value)) {
      return;
    }
    let value2 = Math.min(Math.floor(value), 86400);
    if (value2 > 0) {
      return value2;
    } else {
      return undefined;
    }
  }
  function normalizeVideoLink(link: unknown): VideoLink | undefined {
    if (typeof link !== "object" || link === null) {
      return;
    }
    let { provider: value, id: value2, start: value3 }: VideoLinkCandidate =
      link;
    if (
      !isSupportedVideoProvider(value) ||
      !isValidVideoProviderId(value, value2)
    ) {
      return;
    }
    let value4 = normalizeVideoStartSeconds(value3);
    return {
      provider: value,
      id: value2,
      ...(value4 !== undefined
        ? {
            start: value4,
          }
        : {}),
    };
  }
  function rawQueryParameter(query: string, name: string): string | undefined {
    for (let value of query.split("&")) {
      let value2 = value.indexOf("=");
      if (value2 > 0 && value.substring(0, value2) === name) {
        return value.substring(value2 + 1);
      }
    }
    return;
  }
  function parseYouTubeTimestamp(
    timestamp: string | undefined,
  ): number | undefined {
    if (timestamp === undefined || timestamp === "") {
      return;
    }
    let value =
      /^(?:(\d{1,3})h)?(?:(\d{1,5})m)?(?:(\d{1,7})s?)?$/.exec(timestamp);
    if (value === null) {
      return;
    }
    return normalizeVideoStartSeconds(
      Number(value[1] ?? 0) * 3600 +
        Number(value[2] ?? 0) * 60 +
        Number(value[3] ?? 0),
    );
  }
  function parseVideoLinkUrl(url: string): VideoLink | null {
    let value = url.trim();
    if (value.length === 0 || value.length > 2048 || /\s/.test(value)) {
      return null;
    }
    let value2 =
      /^(?:(?:https?:)?\/\/)?([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i.exec(
        value,
      );
    if (value2 === null) {
      return null;
    }
    let value3 = (value2[1] ?? "").toLowerCase(),
      value4 = value2[2] ?? "",
      value5 = value2[3] ?? "",
      value6: string | undefined;
    if (value3 === "youtu.be") {
      value6 = /^\/([^/]+)\/?$/.exec(value4)?.[1];
    } else if (youtubeHostnames.has(value3)) {
      value6 = /^\/watch\/?$/.test(value4)
        ? rawQueryParameter(value5, "v")
        : /^\/(?:embed|shorts|live|v)\/([^/]+)\/?$/.exec(value4)?.[1];
    } else if (youtubeShortHostnames.has(value3)) {
      value6 = /^\/embed\/([^/]+)\/?$/.exec(value4)?.[1];
    }
    if (!isValidVideoProviderId("youtube", value6)) {
      return null;
    }
    let value7 =
      parseYouTubeTimestamp(rawQueryParameter(value5, "t")) ??
      parseYouTubeTimestamp(rawQueryParameter(value5, "start")) ??
      parseYouTubeTimestamp(rawQueryParameter(value2[4] ?? "", "t"));
    return {
      provider: "youtube",
      id: value6,
      ...(value7 !== undefined
        ? {
            start: value7,
          }
        : {}),
    };
  }
  function videoProviderOrigin(provider: VideoProvider): string {
    return videoProviderOrigins[provider];
  }
  function videoEmbedUrl(link: unknown): string | null {
    let value = normalizeVideoLink(link);
    if (value === undefined) {
      return null;
    }
    return (
      videoProviderOrigins[value.provider] +
      "/embed/" +
      value.id +
      "?playsinline=1" +
      (value.start !== undefined ? "&start=" + String(value.start) : "")
    );
  }
  function videoWatchUrl(link: unknown): string | null {
    let value = normalizeVideoLink(link);
    if (value === undefined) {
      return null;
    }
    return (
      "https://www.youtube.com/watch?v=" +
      value.id +
      (value.start !== undefined ? "&t=" + String(value.start) + "s" : "")
    );
  }
  bindRuntimeValue(
    runtime,
    "isSupportedVideoProvider",
    () => isSupportedVideoProvider,
  );
  bindRuntimeValue(
    runtime,
    "isValidVideoProviderId",
    () => isValidVideoProviderId,
  );
  bindRuntimeValue(
    runtime,
    "normalizeVideoStartSeconds",
    () => normalizeVideoStartSeconds,
  );
  bindRuntimeValue(runtime, "normalizeVideoLink", () => normalizeVideoLink);
  bindRuntimeValue(runtime, "rawQueryParameter", () => rawQueryParameter);
  bindRuntimeValue(
    runtime,
    "parseYouTubeTimestamp",
    () => parseYouTubeTimestamp,
  );
  bindRuntimeValue(runtime, "parseVideoLinkUrl", () => parseVideoLinkUrl);
  bindRuntimeValue(runtime, "videoProviderOrigin", () => videoProviderOrigin);
  bindRuntimeValue(runtime, "videoEmbedUrl", () => videoEmbedUrl);
  bindRuntimeValue(runtime, "videoWatchUrl", () => videoWatchUrl);
  bindRuntimeValue(
    runtime,
    "videoProviders",
    () => videoProviders,
    (value) => {
      videoProviders = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoProviderLabels",
    () => videoProviderLabels,
    (value) => {
      videoProviderLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxVideoLinkStartSeconds",
    () => maxVideoLinkStartSeconds,
    (value) => {
      maxVideoLinkStartSeconds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoProviderIdPatterns",
    () => videoProviderIdPatterns,
    (value) => {
      videoProviderIdPatterns = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "forbiddenVideoProviderIds",
    () => forbiddenVideoProviderIds,
    (value) => {
      forbiddenVideoProviderIds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoProviderOrigins",
    () => videoProviderOrigins,
    (value) => {
      videoProviderOrigins = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "youtubeHostnames",
    () => youtubeHostnames,
    (value) => {
      youtubeHostnames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "youtubeShortHostnames",
    () => youtubeShortHostnames,
    (value) => {
      youtubeShortHostnames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeVideoLinks",
    () => initializeVideoLinks,
    (value) => {
      initializeVideoLinks = value;
    },
  );
  return () => {
    maxVideoLinkStartSeconds = 86400;
    initializeVideoLinks = (0, runtime.initializeOnce)((): void => {
      videoProviders = ["youtube"];
      videoProviderLabels = {
        youtube: "YouTube",
      };
      videoProviderIdPatterns = {
        youtube: /^[A-Za-z0-9_-]{11}$/,
      };
      forbiddenVideoProviderIds = new Set(["videoseries", "live_stream"]);
      videoProviderOrigins = {
        youtube: "https://www.youtube-nocookie.com",
      };
      youtubeHostnames = new Set([
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
      ]);
      youtubeShortHostnames = new Set([
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
      ]);
    });
  };
}
