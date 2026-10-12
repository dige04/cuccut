/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorMediaVideoUpload(
  runtime: RuntimeBindings,
): () => void {
  var MediaVideoUploadItems: Dynamic;
  var MediaVideoUploadResolvedValue: Dynamic;
  var VideoQuicktimeValue: Dynamic;
  var VideoMp4VideoWebmVideoQuicktimeMovValue: Dynamic;
  var MediaVideoUploadLimit: Dynamic;
  var MediaVideoUploadAutoPlayLoopMutedConfig: Dynamic;
  var MediaVideoUploadAutoplayLoopMutedConfig: Dynamic;
  var MediaVideoUploadReplace: Dynamic;
  function videoMimeType(input?: Dynamic): Dynamic {
    let value: Dynamic = (input.type.split(";")[0] ?? "").trim().toLowerCase();
    return value === "" && /\.mov$/i.test(input.name ?? "")
      ? VideoQuicktimeValue
      : value;
  }
  function isVideoFile(input?: Dynamic): Dynamic {
    return videoMimeType(input).startsWith("video/");
  }
  function videoUploadRefusal(input?: Dynamic): Dynamic {
    let value: Dynamic = videoMimeType(input);
    return value !== VideoQuicktimeValue &&
      !MediaVideoUploadItems.includes(value)
      ? "unsupported_type"
      : input.size > MediaVideoUploadResolvedValue
        ? "too_large"
        : null;
  }
  async function sniffQuicktimeFormat(input?: Dynamic): Promise<Dynamic> {
    let value: Dynamic = videoMimeType(input);
    if (value !== VideoQuicktimeValue) return value;
    let value2: Dynamic = new Uint8Array(
      await input.slice(0, 12).arrayBuffer(),
    );
    return value2.length === 12 &&
      String.fromCharCode(...value2.subarray(4, 8)) === "ftyp"
      ? "video/mp4"
      : null;
  }
  async function normalizeQuicktimeUpload(
    input?: Dynamic,
    options: Dynamic = 8e3,
  ): Promise<Dynamic> {
    if (videoMimeType(input) !== VideoQuicktimeValue)
      return {
        type: videoMimeType(input),
      };
    let callback: Dynamic = (): Dynamic => {},
      promise: Dynamic = new Promise((input2?: Dynamic): Dynamic => {
        let value: Dynamic = setTimeout(input2, options);
        callback = (): Dynamic => clearTimeout(value);
      });
    try {
      let value: Dynamic = await Promise.race([
        sniffQuicktimeFormat(input),
        promise,
      ]);
      return value === undefined
        ? "probe_timeout"
        : value === null
          ? "old_quicktime"
          : {
              type: value,
            };
    } catch {
      return "probe_timeout";
    } finally {
      callback();
    }
  }
  function withVideoProbe(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return videoMimeType(input) !== VideoQuicktimeValue
      ? probeVideoElement(input, options, context, value)
      : normalizeQuicktimeUpload(input, options).then(
          (input2?: Dynamic): Dynamic =>
            typeof input2 == "string"
              ? input2
              : probeVideoElement(input, options, context, value),
        );
  }
  function probeVideoElement(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return new Promise((input2?: Dynamic): Dynamic => {
      let value2: Dynamic = URL.createObjectURL(input),
        value3: Dynamic = (document as Dynamic).createElement("video"),
        flag: Dynamic = false,
        callback: Dynamic = (input3?: Dynamic): Dynamic => {
          flag ||
            ((flag = true),
            clearTimeout(value4),
            value3.removeAttribute("src"),
            value3.load(),
            URL.revokeObjectURL(value2),
            input2(input3));
        },
        value4: Dynamic = setTimeout(
          (): Dynamic => callback("probe_timeout"),
          options,
        ),
        flag2: Dynamic = false,
        callback2: Dynamic = (): Dynamic => {
          flag2 ||
            flag ||
            ((flag2 = true),
            Promise.resolve()
              .then((): Dynamic => context(value3))
              .then(callback, (): Dynamic => callback("probe_timeout")));
        };
      value3.muted = true;
      value3.playsInline = true;
      value3.preload = "auto";
      value3.onerror = (): Dynamic => callback("unplayable");
      value
        ? ((value3.onloadeddata = (): Dynamic => {
            let value5: Dynamic = value(value3);
            Number.isFinite(value5) && value5 > 0
              ? (value3.currentTime = value5)
              : callback2();
          }),
          (value3.onseeked = callback2))
        : (value3.onloadedmetadata = callback2);
      value3.src = value2;
    });
  }
  function videoMetadata(input?: Dynamic): Dynamic {
    return input.videoWidth > 0 && input.videoHeight > 0
      ? {
          width: input.videoWidth,
          height: input.videoHeight,
          duration: Number.isFinite(input.duration) ? input.duration : 0,
        }
      : "unplayable";
  }
  function probeVideoFile(input?: Dynamic, options: Dynamic = 6e3): Dynamic {
    return withVideoProbe(input, options, videoMetadata);
  }
  function videoFrameLuminance(input?: Dynamic): Dynamic {
    try {
      let value: Dynamic = (document as Dynamic).createElement("canvas");
      value.width = 32;
      value.height = 18;
      let value2: Dynamic = value.getContext("2d");
      if (value2 === null) return 255;
      value2.drawImage(input, 0, 0, 32, 18);
      let data: Dynamic = value2.getImageData(0, 0, 32, 18).data,
        index: Dynamic = 0;
      for (let index2: Dynamic = 0; index2 < data.length; index2 += 4)
        index +=
          0.2126 * (data[index2] ?? 0) +
          0.7152 * (data[index2 + 1] ?? 0) +
          0.0722 * (data[index2 + 2] ?? 0);
      return index / (data.length / 4);
    } catch {
      return 255;
    }
  }
  function captureVideoPoster(input?: Dynamic, options: Dynamic = {}): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      options.at ??
      (Number.isFinite(input2.duration) && input2.duration > 0
        ? Math.min(0.1, input2.duration / 2)
        : 0);
    return withVideoProbe(
      input,
      options.timeoutMs ?? 8e3,
      async (input2?: Dynamic): Promise<Dynamic> => {
        let value: Dynamic = videoMetadata(input2);
        if (typeof value == "string") return value;
        let value2: Dynamic = Math.min(1, value.duration / 2);
        options.at === undefined &&
          value2 > input2.currentTime &&
          videoFrameLuminance(input2) < MediaVideoUploadLimit &&
          (await new Promise((input3?: Dynamic): Dynamic => {
            input2.onseeked = (): Dynamic => input3();
            input2.currentTime = value2;
          }));
        let value3: Dynamic = Math.min(
            1,
            (options.maxEdge ?? 1920) / Math.max(value.width, value.height),
          ),
          value4: Dynamic = (document as Dynamic).createElement("canvas");
        value4.width = Math.max(1, Math.round(value.width * value3));
        value4.height = Math.max(1, Math.round(value.height * value3));
        let value5: Dynamic = value4.getContext("2d");
        if (value5 === null) return "probe_timeout";
        value5.drawImage(input2, 0, 0, value4.width, value4.height);
        let value6: Dynamic = await new Promise(
          (input3?: Dynamic): Dynamic =>
            value4.toBlob(input3, "image/jpeg", 0.85),
        );
        return value6 === null
          ? "probe_timeout"
          : {
              blob: value6,
              ...value,
            };
      },
      callback,
    );
  }
  async function uploadVideo(
    input?: Dynamic,
    options: Dynamic = {},
  ): Promise<Dynamic> {
    let callback: Dynamic = (input2?: Dynamic): Dynamic => ({
        kind: "refused",
        reason: input2,
      }),
      value: Dynamic = videoUploadRefusal(input);
    if (value !== null) return callback(value);
    let value2: Dynamic = await normalizeQuicktimeUpload(input);
    if (typeof value2 == "string") return callback(value2);
    let value3: Dynamic =
      options.probed ??
      (await (options.probe ?? probeVideoFile)(input).catch(
        (): Dynamic => "probe_timeout",
      ));
    if (typeof value3 == "string") return callback(value3);
    let state: Dynamic = {
        width: value3.width,
        height: value3.height,
        duration: value3.duration,
      },
      value4: Dynamic = await (0, runtime.getAssetsCapability)();
    if (value4 === null || typeof value4.upload != "function")
      return callback("unavailable");
    try {
      let value5: Dynamic = (0, runtime.normalizeUploadedAsset)(
        await value4.upload.call(value4, input, {
          type: value2.type,
        }),
      );
      return value5 === undefined
        ? callback("bad_result")
        : {
            kind: "blob",
            ...value5,
            ...state,
          };
    } catch (value5: Dynamic) {
      let value6: Dynamic =
        typeof value5 == "object" && value5 !== null
          ? String(value5.code ?? "")
          : "";
      return callback(value6 || "upload_failed");
    }
  }
  function videoUploadFailureMessage(input?: Dynamic): Dynamic {
    switch (input) {
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
  function uploadedVideoHtml(input?: Dynamic, options?: Dynamic): Dynamic {
    if (!(0, runtime.isBlobAssetUrl)(input)) return "";
    let value: Dynamic = Object.entries(MediaVideoUploadAutoplayLoopMutedConfig)
        .map(([input2, input3]: Dynamic): Dynamic => `${input2}="${input3}"`)
        .join(" "),
      value2: Dynamic = options.style
        ? ` style="${MediaVideoUploadReplace(options.style)}"`
        : "",
      value3: Dynamic = options.label
        ? ` aria-label="${MediaVideoUploadReplace(options.label)}"`
        : "";
    return `<video src="${MediaVideoUploadReplace(input)}"${value3} ${value} width="${String(Math.round(options.width))}" height="${String(Math.round(options.height))}"${value2}></video>`;
  }
  bindRuntimeValue(
    runtime,
    "MediaVideoUploadItems",
    () => MediaVideoUploadItems,
    (value) => {
      MediaVideoUploadItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaVideoUploadResolvedValue",
    () => MediaVideoUploadResolvedValue,
    (value) => {
      MediaVideoUploadResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VideoQuicktimeValue",
    () => VideoQuicktimeValue,
    (value) => {
      VideoQuicktimeValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VideoMp4VideoWebmVideoQuicktimeMovValue",
    () => VideoMp4VideoWebmVideoQuicktimeMovValue,
    (value) => {
      VideoMp4VideoWebmVideoQuicktimeMovValue = value;
    },
  );
  bindRuntimeValue(runtime, "videoMimeType", () => videoMimeType);
  bindRuntimeValue(runtime, "isVideoFile", () => isVideoFile);
  bindRuntimeValue(runtime, "videoUploadRefusal", () => videoUploadRefusal);
  bindRuntimeValue(runtime, "sniffQuicktimeFormat", () => sniffQuicktimeFormat);
  bindRuntimeValue(
    runtime,
    "normalizeQuicktimeUpload",
    () => normalizeQuicktimeUpload,
  );
  bindRuntimeValue(runtime, "withVideoProbe", () => withVideoProbe);
  bindRuntimeValue(runtime, "probeVideoElement", () => probeVideoElement);
  bindRuntimeValue(runtime, "videoMetadata", () => videoMetadata);
  bindRuntimeValue(runtime, "probeVideoFile", () => probeVideoFile);
  bindRuntimeValue(
    runtime,
    "MediaVideoUploadLimit",
    () => MediaVideoUploadLimit,
    (value) => {
      MediaVideoUploadLimit = value;
    },
  );
  bindRuntimeValue(runtime, "videoFrameLuminance", () => videoFrameLuminance);
  bindRuntimeValue(runtime, "captureVideoPoster", () => captureVideoPoster);
  bindRuntimeValue(runtime, "uploadVideo", () => uploadVideo);
  bindRuntimeValue(
    runtime,
    "videoUploadFailureMessage",
    () => videoUploadFailureMessage,
  );
  bindRuntimeValue(
    runtime,
    "MediaVideoUploadAutoPlayLoopMutedConfig",
    () => MediaVideoUploadAutoPlayLoopMutedConfig,
    (value) => {
      MediaVideoUploadAutoPlayLoopMutedConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaVideoUploadAutoplayLoopMutedConfig",
    () => MediaVideoUploadAutoplayLoopMutedConfig,
    (value) => {
      MediaVideoUploadAutoplayLoopMutedConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaVideoUploadReplace",
    () => MediaVideoUploadReplace,
    (value) => {
      MediaVideoUploadReplace = value;
    },
  );
  bindRuntimeValue(runtime, "uploadedVideoHtml", () => uploadedVideoHtml);
  return () => {
    MediaVideoUploadItems = ["video/mp4", "video/webm"];
    MediaVideoUploadResolvedValue = 20 * 1024 * 1024;
    VideoQuicktimeValue = "video/quicktime";
    VideoMp4VideoWebmVideoQuicktimeMovValue =
      "video/mp4,video/webm,video/quicktime,.mov";
    MediaVideoUploadLimit = 8;
    MediaVideoUploadAutoPlayLoopMutedConfig = {
      autoPlay: true,
      loop: true,
      muted: true,
      playsInline: true,
    };
    MediaVideoUploadAutoplayLoopMutedConfig = {
      autoplay: "autoplay",
      loop: "loop",
      muted: "muted",
      playsinline: "playsinline",
    };
    MediaVideoUploadReplace = (input?: Dynamic): Dynamic =>
      input
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
  };
}
