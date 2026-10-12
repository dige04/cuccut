/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Codecs the shrink worker can encode to. */
export type VideoEncodeCodec = "avc" | "vp9";
/** What the shrink worker learned about a source video (the reply to a `probe` request). */
export interface VideoProbe {
  width: number;
  height: number;
  /** Seconds. */
  duration: number;
  fps: number;
  canDecode: boolean;
  /** Codec this browser can encode at the working size; null when none can. */
  encode: VideoEncodeCodec | null;
  /** True when the source has an audio track that can be re-encoded. */
  sound?: boolean;
}
/** One step of the resolution ladder, bitrates in bits per second. */
export interface VideoEncodingRung {
  /** Short edge in pixels. */
  short: number;
  floor: number;
  ceiling: number;
}
/** How the worker should re-encode a video. */
export interface VideoEncodingPlan {
  width: number;
  height: number;
  bitrate: number;
  codec: VideoEncodeCodec;
  frameRate?: number;
  /** Index into the rung ladder. */
  rung: number;
  keepSound?: boolean;
}
/** Why no encoding plan could be produced. */
export type VideoEncodingPlanFailure =
  | "cannot_decode"
  | "cannot_encode"
  | "too_long";
/** Reasons a video shrink is reported as failed or degraded. */
export type VideoShrinkFailureReason =
  | "too_long"
  | "too_big"
  | "encode_failed"
  | "sound_dropped";

declare module "../bindings" {
  interface RuntimeBindings {
    VIDEO_TARGET_BYTES: number;
    VIDEO_ENCODE_MAX_ATTEMPTS: number;
    VIDEO_AUDIO_BITRATE: number;
    VIDEO_ENCODE_FPS: number;
    VIDEO_ENCODING_RUNGS: VideoEncodingRung[];
    evenVideoDimension: (dimension: number) => number;
    VIDEO_LIMIT_MEGABYTES: string;
    videoPlanForRung: (
      probe: VideoProbe,
      rung: number,
      bitrate: number,
      keepSound: boolean,
    ) => VideoEncodingPlan;
    initialVideoEncodingPlan: (
      probe: VideoProbe,
    ) => VideoEncodingPlan | VideoEncodingPlanFailure;
    reducedVideoEncodingPlan: (
      probe: VideoProbe,
      plan: VideoEncodingPlan,
      encodedBytes: number,
    ) => VideoEncodingPlan | null;
    videoShrinkFailureMessage: (
      reason: VideoShrinkFailureReason,
    ) => string;
  }
}

export function installMediaVideoEncodingPlans(
  runtime: RuntimeBindings,
): () => void {
  var VIDEO_TARGET_BYTES: RuntimeBindings["VIDEO_TARGET_BYTES"];
  var VIDEO_ENCODE_MAX_ATTEMPTS: RuntimeBindings["VIDEO_ENCODE_MAX_ATTEMPTS"];
  var VIDEO_AUDIO_BITRATE: RuntimeBindings["VIDEO_AUDIO_BITRATE"];
  var VIDEO_ENCODE_FPS: RuntimeBindings["VIDEO_ENCODE_FPS"];
  var VIDEO_ENCODING_RUNGS: RuntimeBindings["VIDEO_ENCODING_RUNGS"];
  var evenVideoDimension: RuntimeBindings["evenVideoDimension"];
  var VIDEO_LIMIT_MEGABYTES: RuntimeBindings["VIDEO_LIMIT_MEGABYTES"];
  function videoPlanForRung(
    probe: VideoProbe,
    rung: number,
    bitrate: number,
    keepSound: boolean,
  ): VideoEncodingPlan {
    let value = Math.min(probe.width, probe.height),
      value2 = Math.min(
        1,
        (VIDEO_ENCODING_RUNGS[rung]?.short ?? value) / value,
      );
    return {
      width: evenVideoDimension(probe.width * value2),
      height: evenVideoDimension(probe.height * value2),
      bitrate: Math.floor(bitrate),
      codec: probe.encode ?? "avc",
      ...(probe.fps > VIDEO_ENCODE_FPS + 0.5
        ? {
            frameRate: VIDEO_ENCODE_FPS,
          }
        : {}),
      rung: rung,
      ...(keepSound
        ? {
            keepSound: true,
          }
        : {}),
    };
  }
  function initialVideoEncodingPlan(
    probe: VideoProbe,
  ): VideoEncodingPlan | VideoEncodingPlanFailure {
    if (
      !probe.canDecode ||
      !(probe.width > 0 && probe.height > 0 && probe.duration > 0)
    ) {
      return "cannot_decode";
    }
    if (probe.encode === null) {
      return "cannot_encode";
    }
    let value = (VIDEO_TARGET_BYTES * 8) / probe.duration,
      value2 = Math.min(probe.width, probe.height),
      value3 = VIDEO_ENCODING_RUNGS.reduce(
        (input: number, options: VideoEncodingRung, context: number): number =>
          options.short >= value2 ? context : input,
        0,
      ),
      value4 = VIDEO_ENCODING_RUNGS.findIndex(
        (input: VideoEncodingRung, options: number): boolean =>
          options >= value3 && value >= input.floor,
      );
    if (value4 < 0) {
      return "too_long";
    }
    let value5 = probe.sound === true,
      value6 = value5 ? value - VIDEO_AUDIO_BITRATE : value;
    return videoPlanForRung(
      probe,
      value4,
      Math.min(value6, VIDEO_ENCODING_RUNGS[value4]?.ceiling ?? value6),
      value5,
    );
  }
  function reducedVideoEncodingPlan(
    probe: VideoProbe,
    plan: VideoEncodingPlan,
    encodedBytes: number,
  ): VideoEncodingPlan | null {
    let value =
      plan.bitrate * (VIDEO_TARGET_BYTES / encodedBytes) * 0.95;
    if (
      value >=
      (VIDEO_ENCODING_RUNGS[plan.rung]?.floor ?? 1 / 0) -
        (plan.keepSound === true ? VIDEO_AUDIO_BITRATE : 0)
    ) {
      return {
        ...plan,
        bitrate: Math.floor(value),
      };
    }
    for (
      let value2 = plan.rung + 1;
      value2 < VIDEO_ENCODING_RUNGS.length;
      value2++
    ) {
      let value3 = videoPlanForRung(
        probe,
        value2,
        Math.min(
          Math.max(value, VIDEO_ENCODING_RUNGS[value2]?.floor ?? value),
          VIDEO_ENCODING_RUNGS[value2]?.ceiling ?? value,
        ),
        plan.keepSound === true,
      );
      if (value3.height < plan.height) {
        return value3;
      }
    }
    let { keepSound: keepSound, ...remainingProps } = plan;
    if (keepSound === true) {
      return {
        ...remainingProps,
        bitrate: Math.min(
          plan.bitrate,
          VIDEO_ENCODING_RUNGS[plan.rung]?.floor ?? plan.bitrate,
        ),
      };
    } else {
      return null;
    }
  }
  function videoShrinkFailureMessage(
    reason: VideoShrinkFailureReason,
  ): string {
    switch (reason) {
      case "too_long":
        return (
          "This video is too long to fit in " +
          VIDEO_LIMIT_MEGABYTES +
          " MB. Trim it to about two and a half minutes or less."
        );
      case "too_big":
        return (
          "Couldn’t get this video under " +
          VIDEO_LIMIT_MEGABYTES +
          " MB. Trim it first."
        );
      case "encode_failed":
        return "Couldn’t shrink this video. Trim or compress it first.";
      case "sound_dropped":
        return (
          "This video was shrunk to fit, but its sound couldn’t be kept. To keep the sound, trim or compress the file to under " +
          VIDEO_LIMIT_MEGABYTES +
          " MB and use that file instead."
        );
    }
  }
  bindRuntimeValue(
    runtime,
    "VIDEO_TARGET_BYTES",
    () => VIDEO_TARGET_BYTES,
    (value) => {
      VIDEO_TARGET_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VIDEO_ENCODE_MAX_ATTEMPTS",
    () => VIDEO_ENCODE_MAX_ATTEMPTS,
    (value) => {
      VIDEO_ENCODE_MAX_ATTEMPTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VIDEO_AUDIO_BITRATE",
    () => VIDEO_AUDIO_BITRATE,
    (value) => {
      VIDEO_AUDIO_BITRATE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VIDEO_ENCODE_FPS",
    () => VIDEO_ENCODE_FPS,
    (value) => {
      VIDEO_ENCODE_FPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VIDEO_ENCODING_RUNGS",
    () => VIDEO_ENCODING_RUNGS,
    (value) => {
      VIDEO_ENCODING_RUNGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "evenVideoDimension",
    () => evenVideoDimension,
    (value) => {
      evenVideoDimension = value;
    },
  );
  bindRuntimeValue(runtime, "videoPlanForRung", () => videoPlanForRung);
  bindRuntimeValue(
    runtime,
    "initialVideoEncodingPlan",
    () => initialVideoEncodingPlan,
  );
  bindRuntimeValue(
    runtime,
    "reducedVideoEncodingPlan",
    () => reducedVideoEncodingPlan,
  );
  bindRuntimeValue(
    runtime,
    "VIDEO_LIMIT_MEGABYTES",
    () => VIDEO_LIMIT_MEGABYTES,
    (value) => {
      VIDEO_LIMIT_MEGABYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoShrinkFailureMessage",
    () => videoShrinkFailureMessage,
  );
  return () => {
    (0, runtime.initializeImageDownsampling)();
    (0, runtime.initializeVideoAssets)();
    (0, runtime.initializeVideoAssets)();
    VIDEO_TARGET_BYTES = Math.floor(runtime.maxVideoUploadBytes * 0.92);
    VIDEO_ENCODE_MAX_ATTEMPTS = 3;
    VIDEO_AUDIO_BITRATE = 132000;
    VIDEO_ENCODE_FPS = 30;
    VIDEO_ENCODING_RUNGS = [
      {
        short: 1080,
        floor: 4000000,
        ceiling: 6000000,
      },
      {
        short: 720,
        floor: 2000000,
        ceiling: 4000000,
      },
      {
        short: 480,
        floor: 1e6,
        ceiling: 2000000,
      },
    ];
    evenVideoDimension = (dimension: number): number =>
      Math.max(2, Math.round(dimension / 2) * 2);
    VIDEO_LIMIT_MEGABYTES = String(runtime.maxVideoUploadBytes / 1048576);
  };
}
