/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Pixel size and length of a decoded video. */
export type VideoMetadata = {
  width: number;
  height: number;
  /** Seconds; 0 when the browser reports an unknown length. */
  duration: number;
};
/** Why a video element could not be inspected. */
export type VideoProbeFailure = "unplayable" | "probe_timeout" | "old_quicktime";
/** Container sniffing outcome: the MIME type to upload with, or why it was refused. */
export type VideoContainerResult =
  | { type: string }
  | "probe_timeout"
  | "old_quicktime";
/** Why a file is rejected before it is probed. */
export type VideoFileRefusalReason = "unsupported_type" | "too_large";
/** Reads something off a loaded `<video>` (the first frame is ready when it runs). */
export type VideoInspector<T> = (video: HTMLVideoElement) => T | Promise<T>;
/** Picks the time to seek to before inspecting; a non-positive result skips the seek. */
export type VideoSeekTime = (video: HTMLVideoElement) => number;
/** A JPEG frame of the video plus its metadata. */
export type VideoPoster = VideoMetadata & { blob: Blob };
export interface CaptureVideoPosterOptions {
  /** Seek time in seconds; by default an early, non-black frame. */
  at?: number;
  timeoutMs?: number;
  /** Longest edge of the poster in pixels. */
  maxEdge?: number;
}
export interface StoreVideoAssetOptions {
  /** Result of an earlier probe, to avoid probing again. */
  probed?: VideoMetadata | VideoProbeFailure;
  probe?: (file: File) => Promise<VideoMetadata | VideoProbeFailure>;
}
/** A video that was uploaded to the host asset store. */
export interface StoredVideoBlob extends VideoMetadata {
  kind: "blob";
  id: string;
  /** Stored reference to put in the deck. */
  src: string;
  bytes: number;
}
export interface VideoAssetRefusal {
  kind: "refused";
  /** A refusal code from this module or an upload error code from the host. */
  reason: string;
}
export type StoreVideoAssetResult = StoredVideoBlob | VideoAssetRefusal;
/** Attributes every playing `<video>` element gets. */
export interface VideoPlaybackDefaults {
  autoPlay: boolean;
  loop: boolean;
  muted: boolean;
  playsInline: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    videoMimeType: (file: File) => string;
    isVideoFile: (file: File) => boolean;
    videoFileRefusalReason: (file: File) => VideoFileRefusalReason | null;
    sniffQuickTimeContainer: (file: File) => Promise<string | null>;
    identifyVideoContainer: (
      file: File,
      timeoutMs?: number,
    ) => Promise<VideoContainerResult>;
    probeVideoFile_Ql0: <T>(
      file: File,
      timeoutMs: number,
      inspectVideo: VideoInspector<T>,
      seekTime?: VideoSeekTime,
    ) => Promise<T | VideoProbeFailure>;
    withLoadedVideoElement: <T>(
      file: File,
      timeoutMs: number,
      inspectVideo: VideoInspector<T>,
      seekTime?: VideoSeekTime,
    ) => Promise<T | VideoProbeFailure>;
    readVideoMetadata: (video: HTMLVideoElement) => VideoMetadata | "unplayable";
    probeVideoMetadata: (
      file: File,
      timeoutMs?: number,
    ) => Promise<VideoMetadata | VideoProbeFailure>;
    videoFrameBrightness: (video: HTMLVideoElement) => number;
    captureVideoPoster: (
      file: File,
      options?: CaptureVideoPosterOptions,
    ) => Promise<VideoPoster | VideoProbeFailure>;
    storeVideoAsset: (
      file: File,
      options?: StoreVideoAssetOptions,
    ) => Promise<StoreVideoAssetResult>;
    videoRefusalMessage: (reason: string) => string;
    supportedVideoMimeTypes: string[];
    maxVideoUploadBytes: number;
    quickTimeMimeType: string;
    videoFileAccept: string;
    minimumVideoPosterBrightness: number;
    videoPlaybackDefaults: VideoPlaybackDefaults;
    initializeVideoAssets: () => void;
  }
}

export function installMediaVideoAssets(runtime: RuntimeBindings): () => void {
  var supportedVideoMimeTypes: RuntimeBindings["supportedVideoMimeTypes"];
  var maxVideoUploadBytes: RuntimeBindings["maxVideoUploadBytes"];
  var quickTimeMimeType: RuntimeBindings["quickTimeMimeType"];
  var videoFileAccept: RuntimeBindings["videoFileAccept"];
  var minimumVideoPosterBrightness: RuntimeBindings["minimumVideoPosterBrightness"];
  var videoPlaybackDefaults: RuntimeBindings["videoPlaybackDefaults"];
  var initializeVideoAssets: RuntimeBindings["initializeVideoAssets"];
  function videoMimeType(file: File): string {
    let mimeType = (file.type.split(";")[0] ?? "")
      .trim()
      .toLowerCase();
    if (mimeType === "" && /\.mov$/i.test(file.name ?? "")) {
      return quickTimeMimeType;
    } else {
      return mimeType;
    }
  }
  function isVideoFile(file: File): boolean {
    return videoMimeType(file).startsWith("video/");
  }
  function videoFileRefusalReason(file: File): VideoFileRefusalReason | null {
    let mimeType = videoMimeType(file);
    if (
      mimeType !== quickTimeMimeType &&
      !supportedVideoMimeTypes.includes(mimeType)
    ) {
      return "unsupported_type";
    }
    if (file.size > maxVideoUploadBytes) {
      return "too_large";
    } else {
      return null;
    }
  }
  async function sniffQuickTimeContainer(file: File): Promise<string | null> {
    let mimeType = videoMimeType(file);
    if (mimeType !== quickTimeMimeType) {
      return mimeType;
    }
    let header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (
      header.length === 12 &&
      String.fromCharCode(...header.subarray(4, 8)) === "ftyp"
    ) {
      return "video/mp4";
    } else {
      return null;
    }
  }
  async function identifyVideoContainer(
    file: File,
    timeoutMs: number = 8000,
  ): Promise<VideoContainerResult> {
    if (videoMimeType(file) !== quickTimeMimeType) {
      return {
        type: videoMimeType(file),
      };
    }
    let cancelTimeout = (): void => {},
      timeoutPromise = new Promise<undefined>((input): void => {
        let value = setTimeout(input, timeoutMs);
        cancelTimeout = (): void => clearTimeout(value);
      });
    try {
      let value = await Promise.race([
        sniffQuickTimeContainer(file),
        timeoutPromise,
      ]);
      if (value === undefined) {
        return "probe_timeout";
      } else {
        if (value === null) {
          return "old_quicktime";
        } else {
          return {
            type: value,
          };
        }
      }
    } catch {
      return "probe_timeout";
    } finally {
      cancelTimeout();
    }
  }
  function probeVideoFile_Ql0<T>(
    file: File,
    timeoutMs: number,
    inspectVideo: VideoInspector<T>,
    seekTime?: VideoSeekTime,
  ): Promise<T | VideoProbeFailure> {
    if (videoMimeType(file) !== quickTimeMimeType) {
      return withLoadedVideoElement(file, timeoutMs, inspectVideo, seekTime);
    }
    return identifyVideoContainer(file, timeoutMs).then(
      (input): T | VideoProbeFailure | Promise<T | VideoProbeFailure> =>
        typeof input === "string"
          ? input
          : withLoadedVideoElement(file, timeoutMs, inspectVideo, seekTime),
    );
  }
  function withLoadedVideoElement<T>(
    file: File,
    timeoutMs: number,
    inspectVideo: VideoInspector<T>,
    seekTime?: VideoSeekTime,
  ): Promise<T | VideoProbeFailure> {
    return new Promise<T | VideoProbeFailure>((input): void => {
      let value = URL.createObjectURL(file),
        value2 = document.createElement("video"),
        flag = false,
        callback = (input2: T | VideoProbeFailure): void => {
          if (flag) {
            return;
          }
          flag = true;
          clearTimeout(value3);
          value2.removeAttribute("src");
          value2.load();
          URL.revokeObjectURL(value);
          input(input2);
        },
        value3 = setTimeout((): void => callback("probe_timeout"), timeoutMs),
        flag2 = false,
        callback2 = (): void => {
          if (flag2 || flag) {
            return;
          }
          flag2 = true;
          Promise.resolve()
            .then((): T | Promise<T> => inspectVideo(value2))
            .then(callback, (): void => callback("probe_timeout"));
        };
      value2.muted = true;
      value2.playsInline = true;
      value2.preload = "auto";
      value2.onerror = (): void => callback("unplayable");
      if (!seekTime) {
        value2.onloadedmetadata = callback2;
      } else {
        value2.onloadeddata = (): void => {
          let value4 = seekTime(value2);
          if (Number.isFinite(value4) && value4 > 0) {
            value2.currentTime = value4;
          } else {
            callback2();
          }
        };
        value2.onseeked = callback2;
      }
      value2.src = value;
    });
  }
  function readVideoMetadata(
    video: HTMLVideoElement,
  ): VideoMetadata | "unplayable" {
    if (!(video.videoWidth > 0 && video.videoHeight > 0)) {
      return "unplayable";
    }
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
    };
  }
  function probeVideoMetadata(
    file: File,
    timeoutMs: number = 6000,
  ): Promise<VideoMetadata | VideoProbeFailure> {
    return probeVideoFile_Ql0(file, timeoutMs, readVideoMetadata);
  }
  function videoFrameBrightness(video: HTMLVideoElement): number {
    try {
      let value = document.createElement("canvas");
      value.width = 32;
      value.height = 18;
      let value2 = value.getContext("2d");
      if (value2 === null) {
        return 255;
      }
      value2.drawImage(video, 0, 0, 32, 18);
      let data = value2.getImageData(0, 0, 32, 18).data,
        index = 0;
      for (let index2 = 0; index2 < data.length; index2 += 4)
        index +=
          0.2126 * (data[index2] ?? 0) +
          0.7152 * (data[index2 + 1] ?? 0) +
          0.0722 * (data[index2 + 2] ?? 0);
      return index / (data.length / 4);
    } catch {
      return 255;
    }
  }
  function captureVideoPoster(
    file: File,
    options: CaptureVideoPosterOptions = {},
  ): Promise<VideoPoster | VideoProbeFailure> {
    let seekTime = (input: HTMLVideoElement): number =>
      options.at ??
      (Number.isFinite(input.duration) && input.duration > 0
        ? Math.min(0.1, input.duration / 2)
        : 0);
    return probeVideoFile_Ql0(
      file,
      options.timeoutMs ?? 8000,
      async (
        input,
      ): Promise<VideoPoster | "unplayable" | "probe_timeout"> => {
        let value = readVideoMetadata(input);
        if (typeof value === "string") {
          return value;
        }
        let value2 = Math.min(1, value.duration / 2);
        if (
          options.at === undefined &&
          value2 > input.currentTime &&
          videoFrameBrightness(input) < minimumVideoPosterBrightness
        ) {
          await new Promise<void>((input2): void => {
            input.onseeked = (): void => input2();
            input.currentTime = value2;
          });
        }
        let value3 = Math.min(
            1,
            (options.maxEdge ?? 1920) / Math.max(value.width, value.height),
          ),
          value4 = document.createElement("canvas");
        value4.width = Math.max(1, Math.round(value.width * value3));
        value4.height = Math.max(1, Math.round(value.height * value3));
        let value5 = value4.getContext("2d");
        if (value5 === null) {
          return "probe_timeout";
        }
        value5.drawImage(input, 0, 0, value4.width, value4.height);
        let value6 = await new Promise<Blob | null>((input2): void =>
          value4.toBlob(input2, "image/jpeg", 0.85),
        );
        if (value6 === null) {
          return "probe_timeout";
        } else {
          return {
            blob: value6,
            ...value,
          };
        }
      },
      seekTime,
    );
  }
  async function storeVideoAsset(
    file: File,
    options: StoreVideoAssetOptions = {},
  ): Promise<StoreVideoAssetResult> {
    let refuse = (input: string): VideoAssetRefusal => ({
        kind: "refused",
        reason: input,
      }),
      refusal = videoFileRefusalReason(file);
    if (refusal !== null) {
      return refuse(refusal);
    }
    let container = await identifyVideoContainer(file);
    if (typeof container === "string") {
      return refuse(container);
    }
    let probed =
      options.probed ??
      (await (options.probe ?? probeVideoMetadata)(file).catch(
        (): VideoProbeFailure => "probe_timeout",
      ));
    if (typeof probed === "string") {
      return refuse(probed);
    }
    let metadata: VideoMetadata = {
        width: probed.width,
        height: probed.height,
        duration: probed.duration,
      },
      assets = await (0, runtime.getAssetsCapability)();
    if (assets === null || typeof assets.upload !== "function") {
      return refuse("unavailable");
    }
    try {
      let value = (0, runtime.normalizeUploadedAsset)(
        await assets.upload.call(assets, file, {
          type: container.type,
        }),
      );
      if (value === undefined) {
        return refuse("bad_result");
      } else {
        return {
          kind: "blob",
          ...value,
          ...metadata,
        };
      }
    } catch (value) {
      let value2 =
        typeof value === "object" && value !== null
          ? String((value as { code?: unknown }).code ?? "")
          : "";
      return refuse(value2 || "upload_failed");
    }
  }
  function videoRefusalMessage(reason: string): string {
    switch (reason) {
      case "unsupported_type":
        return "Only .mp4, .mov and .webm videos can be added. Convert it to .mp4 (H.264) first.";
      case "old_quicktime":
        return "This .mov is in an older QuickTime format that can't be added. Convert it to .mp4 (H.264) first.";
      case "too_large":
        return "Videos over 20 MB can't be added. Trim or compress it first.";
      case "unplayable":
        return "This browser can't play that video, so it wasn't added. Try an H.264 .mp4.";
      case "probe_timeout":
        return "Couldn't read that video. Try again.";
      case "quota_or_state":
        return "No more uploads can be added here right now (storage may be full).";
      case "unavailable":
      case "not_granted":
      case "capability_disabled":
      case "capability_removed":
        return "Uploads aren't available in this view, so videos can't be added.";
      default:
        return "The video couldn't be uploaded. Try again in a moment.";
    }
  }
  bindRuntimeValue(runtime, "videoMimeType", () => videoMimeType);
  bindRuntimeValue(runtime, "isVideoFile", () => isVideoFile);
  bindRuntimeValue(
    runtime,
    "videoFileRefusalReason",
    () => videoFileRefusalReason,
  );
  bindRuntimeValue(
    runtime,
    "sniffQuickTimeContainer",
    () => sniffQuickTimeContainer,
  );
  bindRuntimeValue(
    runtime,
    "identifyVideoContainer",
    () => identifyVideoContainer,
  );
  bindRuntimeValue(runtime, "probeVideoFile_Ql0", () => probeVideoFile_Ql0);
  bindRuntimeValue(
    runtime,
    "withLoadedVideoElement",
    () => withLoadedVideoElement,
  );
  bindRuntimeValue(runtime, "readVideoMetadata", () => readVideoMetadata);
  bindRuntimeValue(runtime, "probeVideoMetadata", () => probeVideoMetadata);
  bindRuntimeValue(runtime, "videoFrameBrightness", () => videoFrameBrightness);
  bindRuntimeValue(runtime, "captureVideoPoster", () => captureVideoPoster);
  bindRuntimeValue(runtime, "storeVideoAsset", () => storeVideoAsset);
  bindRuntimeValue(runtime, "videoRefusalMessage", () => videoRefusalMessage);
  bindRuntimeValue(
    runtime,
    "supportedVideoMimeTypes",
    () => supportedVideoMimeTypes,
    (value) => {
      supportedVideoMimeTypes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxVideoUploadBytes",
    () => maxVideoUploadBytes,
    (value) => {
      maxVideoUploadBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "quickTimeMimeType",
    () => quickTimeMimeType,
    (value) => {
      quickTimeMimeType = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoFileAccept",
    () => videoFileAccept,
    (value) => {
      videoFileAccept = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "minimumVideoPosterBrightness",
    () => minimumVideoPosterBrightness,
    (value) => {
      minimumVideoPosterBrightness = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoPlaybackDefaults",
    () => videoPlaybackDefaults,
    (value) => {
      videoPlaybackDefaults = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeVideoAssets",
    () => initializeVideoAssets,
    (value) => {
      initializeVideoAssets = value;
    },
  );
  return () => {
    maxVideoUploadBytes = 20971520;
    quickTimeMimeType = "video/quicktime";
    videoFileAccept = "video/mp4,video/webm,video/quicktime,.mov";
    minimumVideoPosterBrightness = 8;
    initializeVideoAssets = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeAssetStorage)();
      supportedVideoMimeTypes = ["video/mp4", "video/webm"];
      videoPlaybackDefaults = {
        autoPlay: true,
        loop: true,
        muted: true,
        playsInline: true,
      };
    });
  };
}
