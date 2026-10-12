/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { VideoEncodingPlan, VideoProbe } from "./video-encoding-plans";
import type { VideoShrinkEncoder, VideoSoundOutcome } from "./video-worker";

export type VideoShrinkJobState = "queued" | "encoding" | "placing";
/** Why a finished video is held back instead of being placed ("typing": a text box is being edited). */
export type VideoShrinkWaitReason = "typing";
/** What a caller passes to queue a video for shrinking. */
export interface VideoShrinkRequest {
  file: File;
  probe: VideoProbe;
  plan: VideoEncodingPlan;
  encoder: VideoShrinkEncoder;
}
/** How a shrink job ended. A "ready" result stays alive until its `release` or `rest` is called. */
export type VideoShrinkResult =
  | { kind: "cancelled" }
  | {
      kind: "failed";
      reason: "encode_failed" | "too_big";
      /** Error message from the encoder, when there was one. */
      detail?: string;
    }
  | {
      kind: "ready";
      file: File;
      sound: VideoSoundOutcome;
      /** Frees the job after the video was placed. */
      release: () => void;
      /** Frees the job without placing (the result may be resumed later). */
      rest: () => void;
      /** Re-adds a rested job; false when it was released or aborted. */
      resume: () => boolean;
      signal: AbortSignal;
      /** Reports why placement is on hold, or null when it is not. */
      waitingFor: (reason: VideoShrinkWaitReason | null) => void;
    };
/** A job in the queue, including the machinery that settles it. */
export interface VideoShrinkQueueJob extends VideoShrinkRequest {
  id: number;
  name: string;
  state: VideoShrinkJobState;
  attempt: number;
  /** Encode progress from 0 to 1. */
  progress: number;
  waitingFor: VideoShrinkWaitReason | null;
  abort: AbortController;
  settle: (result: VideoShrinkResult) => void;
}
/** What the UI sees of a job. */
export interface VideoShrinkJobSnapshot {
  id: number;
  name: string;
  state: VideoShrinkJobState;
  attempt: number;
  progress: number;
  waitingFor: VideoShrinkWaitReason | null;
}
export interface VideoShrinkHandle {
  id: number;
  result: Promise<VideoShrinkResult>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    videoShrinkJobs: VideoShrinkQueueJob[];
    videoShrinkJobSnapshots: VideoShrinkJobSnapshot[];
    nextVideoShrinkJobId: number;
    videoShrinkSubscribers: Set<() => void>;
    videoShrinkLeaveHold: (() => void) | null;
    preventLeaveDuringVideoShrink: (event: BeforeUnloadEvent) => void;
    holdVideoShrinkLock: () => () => void;
    publishVideoShrinkJobs: () => void;
    finishVideoShrinkJob: (
      job: VideoShrinkQueueJob,
      result?: VideoShrinkResult,
    ) => void;
    processVideoShrinkJob: (job: VideoShrinkQueueJob) => Promise<void>;
    startNextVideoShrinkJob: () => void;
    enqueueVideoShrink: (options: VideoShrinkRequest) => VideoShrinkHandle;
    cancelVideoShrink: (jobId: number) => void;
    getVideoShrinkJobs: () => VideoShrinkJobSnapshot[];
    hasVideoShrinkJobs: () => boolean;
    subscribeVideoShrinkJobs: (listener: () => void) => () => void;
  }
}

export function installMediaVideoShrinkQueue(
  runtime: RuntimeBindings,
): () => void {
  var videoShrinkJobs: RuntimeBindings["videoShrinkJobs"];
  var videoShrinkJobSnapshots: RuntimeBindings["videoShrinkJobSnapshots"];
  var nextVideoShrinkJobId: RuntimeBindings["nextVideoShrinkJobId"];
  var videoShrinkSubscribers: RuntimeBindings["videoShrinkSubscribers"];
  var videoShrinkLeaveHold: RuntimeBindings["videoShrinkLeaveHold"];
  var preventLeaveDuringVideoShrink: RuntimeBindings["preventLeaveDuringVideoShrink"];
  var getVideoShrinkJobs: RuntimeBindings["getVideoShrinkJobs"];
  var hasVideoShrinkJobs: RuntimeBindings["hasVideoShrinkJobs"];
  function holdVideoShrinkLock(): () => void {
    let flag = false,
      callback = (): void => {
        return;
      },
      value = globalThis.navigator?.locks,
      callback2 = (): Promise<void> | undefined =>
        flag
          ? undefined
          : new Promise<void>((input) => (callback = input));
    if (typeof value?.request === "function") {
      value
        .request(
          "appifact-video-shrink-" +
            String(Date.now()) +
            "-" +
            String(Math.random()).slice(2),
          callback2,
        )
        .catch((): void => {
          return;
        });
    }
    globalThis.addEventListener?.(
      "beforeunload",
      preventLeaveDuringVideoShrink,
    );
    let value2 = (0, runtime.holdHostLeaveWarning)();
    return (): void => {
      flag = true;
      globalThis.removeEventListener?.(
        "beforeunload",
        preventLeaveDuringVideoShrink,
      );
      callback();
      value2();
    };
  }
  function publishVideoShrinkJobs(): void {
    videoShrinkJobSnapshots = videoShrinkJobs.map(
      ({
        id: id,
        name: name,
        state: state,
        attempt: attempt,
        progress: progress,
        waitingFor: waitingFor,
      }: VideoShrinkQueueJob): VideoShrinkJobSnapshot => ({
        id: id,
        name: name,
        state: state,
        attempt: attempt,
        progress: progress,
        waitingFor: waitingFor,
      }),
    );
    if (videoShrinkJobs.length > 0 && videoShrinkLeaveHold === null) {
      videoShrinkLeaveHold = holdVideoShrinkLock();
    } else if (videoShrinkJobs.length === 0 && videoShrinkLeaveHold !== null) {
      videoShrinkLeaveHold();
      videoShrinkLeaveHold = null;
    }
    for (let value of videoShrinkSubscribers)
      try {
        value();
      } catch {}
  }
  function finishVideoShrinkJob(
    job: VideoShrinkQueueJob,
    result?: VideoShrinkResult,
  ): void {
    videoShrinkJobs = videoShrinkJobs.filter(
      (input): boolean => input !== job,
    );
    if (result !== undefined) {
      job.settle(result);
    }
    publishVideoShrinkJobs();
    startNextVideoShrinkJob();
  }
  async function processVideoShrinkJob(job: VideoShrinkQueueJob): Promise<void> {
    let plan: VideoEncodingPlan | null = job.plan;
    for (
      let count = 1;
      plan !== null && count <= runtime.VIDEO_ENCODE_MAX_ATTEMPTS;
      count++
    ) {
      Object.assign(job, {
        state: "encoding",
        attempt: count,
        progress: 0,
      });
      publishVideoShrinkJobs();
      let value: Blob,
        text: VideoSoundOutcome = "none";
      try {
        value = await job.encoder.encode(job.file, plan, {
          signal: job.abort.signal,
          onSound: (input) => (text = input),
          onProgress: (input): void => {
            job.progress = Number.isFinite(input)
              ? Math.min(1, Math.max(0, input))
              : job.progress;
            publishVideoShrinkJobs();
          },
        });
      } catch (value2) {
        return finishVideoShrinkJob(
          job,
          job.abort.signal.aborted
            ? {
                kind: "cancelled",
              }
            : {
                kind: "failed",
                reason: "encode_failed",
                detail:
                  value2 instanceof Error ? value2.message : String(value2),
              },
        );
      }
      if (job.abort.signal.aborted) {
        return finishVideoShrinkJob(job, {
          kind: "cancelled",
        });
      }
      if (value.size <= runtime.maxVideoUploadBytes) {
        Object.assign(job, {
          state: "placing",
          progress: 1,
        });
        let value2 = value.type === "video/webm" ? ".webm" : ".mp4",
          callback = (input: VideoShrinkWaitReason | null): void => {
            if (job.waitingFor === input) {
              return;
            }
            job.waitingFor = input;
            publishVideoShrinkJobs();
          },
          flag = false,
          callback2 = (): void => {
            flag = true;
            finishVideoShrinkJob(job);
          },
          callback3 = (): boolean => {
            if (flag || job.abort.signal.aborted) {
              return false;
            }
            if (!videoShrinkJobs.includes(job)) {
              videoShrinkJobs = [...videoShrinkJobs, job];
            }
            publishVideoShrinkJobs();
            return true;
          },
          value3 = new File(
            [value],
            job.name.replace(/\.[^.]*$/, "") + value2,
            {
              type: value.type,
            },
          );
        job.settle({
          kind: "ready",
          file: value3,
          sound: text,
          release: callback2,
          rest: (): void => finishVideoShrinkJob(job),
          resume: callback3,
          signal: job.abort.signal,
          waitingFor: callback,
        });
        publishVideoShrinkJobs();
        return startNextVideoShrinkJob();
      }
      plan = (0, runtime.reducedVideoEncodingPlan)(job.probe, plan, value.size);
    }
    finishVideoShrinkJob(job, {
      kind: "failed",
      reason: "too_big",
    });
  }
  function startNextVideoShrinkJob(): void {
    if (
      videoShrinkJobs.some((input): boolean => input.state === "encoding")
    ) {
      return;
    }
    let value = videoShrinkJobs.find(
      (input): boolean => input.state === "queued",
    );
    if (value !== undefined) {
      processVideoShrinkJob(value).catch(
        (): void =>
          finishVideoShrinkJob(value, {
            kind: "failed",
            reason: "encode_failed",
          }),
      );
    }
  }
  function enqueueVideoShrink(options: VideoShrinkRequest): VideoShrinkHandle {
    let value = nextVideoShrinkJobId++,
      promise = new Promise<VideoShrinkResult>((input): void => {
        videoShrinkJobs = [
          ...videoShrinkJobs,
          {
            id: value,
            name: options.file.name,
            state: "queued",
            attempt: 1,
            progress: 0,
            waitingFor: null,
            ...options,
            abort: new AbortController(),
            settle: input,
          },
        ];
      });
    publishVideoShrinkJobs();
    startNextVideoShrinkJob();
    return {
      id: value,
      result: promise,
    };
  }
  function cancelVideoShrink(jobId: number): void {
    let value = videoShrinkJobs.find((input): boolean => input.id === jobId);
    if (value === undefined) {
      return;
    }
    value.abort.abort();
    if (value.state === "placing") {
      finishVideoShrinkJob(value);
    } else if (value.state === "queued") {
      finishVideoShrinkJob(value, {
        kind: "cancelled",
      });
    }
  }
  function subscribeVideoShrinkJobs(listener: () => void): () => void {
    videoShrinkSubscribers.add(listener);
    return (): void => {
      videoShrinkSubscribers.delete(listener);
    };
  }
  bindRuntimeValue(
    runtime,
    "videoShrinkJobs",
    () => videoShrinkJobs,
    (value) => {
      videoShrinkJobs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoShrinkJobSnapshots",
    () => videoShrinkJobSnapshots,
    (value) => {
      videoShrinkJobSnapshots = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nextVideoShrinkJobId",
    () => nextVideoShrinkJobId,
    (value) => {
      nextVideoShrinkJobId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoShrinkSubscribers",
    () => videoShrinkSubscribers,
    (value) => {
      videoShrinkSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoShrinkLeaveHold",
    () => videoShrinkLeaveHold,
    (value) => {
      videoShrinkLeaveHold = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventLeaveDuringVideoShrink",
    () => preventLeaveDuringVideoShrink,
    (value) => {
      preventLeaveDuringVideoShrink = value;
    },
  );
  bindRuntimeValue(runtime, "holdVideoShrinkLock", () => holdVideoShrinkLock);
  bindRuntimeValue(
    runtime,
    "publishVideoShrinkJobs",
    () => publishVideoShrinkJobs,
  );
  bindRuntimeValue(runtime, "finishVideoShrinkJob", () => finishVideoShrinkJob);
  bindRuntimeValue(
    runtime,
    "processVideoShrinkJob",
    () => processVideoShrinkJob,
  );
  bindRuntimeValue(
    runtime,
    "startNextVideoShrinkJob",
    () => startNextVideoShrinkJob,
  );
  bindRuntimeValue(runtime, "enqueueVideoShrink", () => enqueueVideoShrink);
  bindRuntimeValue(runtime, "cancelVideoShrink", () => cancelVideoShrink);
  bindRuntimeValue(
    runtime,
    "getVideoShrinkJobs",
    () => getVideoShrinkJobs,
    (value) => {
      getVideoShrinkJobs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasVideoShrinkJobs",
    () => hasVideoShrinkJobs,
    (value) => {
      hasVideoShrinkJobs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeVideoShrinkJobs",
    () => subscribeVideoShrinkJobs,
  );
  return () => {
    (0, runtime.initializeVideoAssets)();
    videoShrinkJobs = [];
    videoShrinkJobSnapshots = [];
    nextVideoShrinkJobId = 1;
    videoShrinkSubscribers = new Set();
    videoShrinkLeaveHold = null;
    preventLeaveDuringVideoShrink = (event): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    getVideoShrinkJobs = (): VideoShrinkJobSnapshot[] => videoShrinkJobSnapshots;
    hasVideoShrinkJobs = (): boolean => videoShrinkJobs.length > 0;
  };
}
