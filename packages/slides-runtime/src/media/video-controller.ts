/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Playback state a video controller publishes to its subscribers. */
export interface VideoControllerState {
  paused: boolean;
  currentTime: number;
  duration: number;
  ready: boolean;
  seekable: boolean;
  failed: boolean;
}
export type VideoControllerListener = (state: VideoControllerState) => void;
/** Thin play/pause/seek wrapper around a `<video>` element that publishes its state. */
export interface VideoController {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  /** Calls the listener immediately and on every change; returns the unsubscribe function. */
  subscribe: (listener: VideoControllerListener) => () => void;
  /** Stops listening to the element and drops all subscribers. */
  detach: () => void;
}
export interface PlaybackActionLabels {
  play: string;
  pause: string;
  seek: string;
}
export interface PlaybackActionIcons {
  play: "PlayFilled";
  pause: "Pause";
}

declare module "../bindings" {
  interface RuntimeBindings {
    formatPlaybackTime: (seconds: number) => string;
    createVideoController: (video: HTMLVideoElement) => VideoController;
    playbackActionLabels: PlaybackActionLabels;
    playbackActionIcons: PlaybackActionIcons;
    videoControllerEvents: string[];
    initializeVideoController: () => void;
  }
}

export function installMediaVideoController(
  runtime: RuntimeBindings,
): () => void {
  var playbackActionLabels: RuntimeBindings["playbackActionLabels"];
  var playbackActionIcons: RuntimeBindings["playbackActionIcons"];
  var videoControllerEvents: RuntimeBindings["videoControllerEvents"];
  var initializeVideoController: RuntimeBindings["initializeVideoController"];
  function formatPlaybackTime(seconds: number): string {
    let value =
        Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0,
      callback = (input: number): string => String(input).padStart(2, "0"),
      value2 = Math.floor(value / 3600),
      value3 = Math.floor((value % 3600) / 60);
    if (value2 > 0) {
      return (
        String(value2) + ":" + callback(value3) + ":" + callback(value % 60)
      );
    } else {
      return String(value3) + ":" + callback(value % 60);
    }
  }
  function createVideoController(video: HTMLVideoElement): VideoController {
    let values = new Set<VideoControllerListener>(),
      callback = (): VideoControllerState => {
        let value = Number.isFinite(video.duration) && video.duration > 0;
        return {
          paused: video.paused,
          currentTime: Number.isFinite(video.currentTime)
            ? video.currentTime
            : 0,
          duration: value ? video.duration : 0,
          ready: video.readyState >= 1,
          seekable: value,
          failed: video.error != null,
        };
      },
      callback2 = (): void => {
        let value = callback();
        for (let value2 of [...values]) value2(value);
      };
    for (let value of videoControllerEvents)
      video.addEventListener(value, callback2);
    let callback3 = (): void => {
      Promise.resolve(video.play()).catch((): void => callback2());
    };
    return {
      play: callback3,
      pause: (): void => video.pause(),
      toggle: (): void => (video.paused ? callback3() : video.pause()),
      seek: (input: number): void => {
        let duration = callback().duration;
        if (!Number.isFinite(input)) {
          return;
        }
        video.currentTime = Math.max(
          0,
          duration > 0 ? Math.min(input, duration) : input,
        );
      },
      subscribe: (input: VideoControllerListener): (() => void) => {
        values.add(input);
        input(callback());
        return (): void => void values.delete(input);
      },
      detach: (): void => {
        for (let value of videoControllerEvents)
          video.removeEventListener(value, callback2);
        values.clear();
      },
    };
  }
  bindRuntimeValue(runtime, "formatPlaybackTime", () => formatPlaybackTime);
  bindRuntimeValue(
    runtime,
    "createVideoController",
    () => createVideoController,
  );
  bindRuntimeValue(
    runtime,
    "playbackActionLabels",
    () => playbackActionLabels,
    (value) => {
      playbackActionLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "playbackActionIcons",
    () => playbackActionIcons,
    (value) => {
      playbackActionIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "videoControllerEvents",
    () => videoControllerEvents,
    (value) => {
      videoControllerEvents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeVideoController",
    () => initializeVideoController,
    (value) => {
      initializeVideoController = value;
    },
  );
  return () => {
    initializeVideoController = (0, runtime.initializeOnce)((): void => {
      playbackActionLabels = {
        play: "Play",
        pause: "Pause",
        seek: "Seek",
      };
      playbackActionIcons = {
        play: "PlayFilled",
        pause: "Pause",
      };
      videoControllerEvents = [
        "play",
        "pause",
        "timeupdate",
        "durationchange",
        "loadedmetadata",
        "seeked",
        "ended",
        "emptied",
        "error",
      ];
    });
  };
}
