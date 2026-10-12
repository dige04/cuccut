/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorMediaVideoPlayback(
  runtime: RuntimeBindings,
): () => void {
  var B6b0a7Value: Dynamic;
  var defaultAnnotationStrokeColor: Dynamic;
  var MediaVideoPlaybackPlayPauseSeekConfig: Dynamic;
  var MediaVideoPlaybackPlayPauseConfig: Dynamic;
  var MediaVideoPlaybackPlayPauseTimeupdateValues: Dynamic;
  function formatVideoTime(input?: Dynamic): Dynamic {
    let value: Dynamic =
        Number.isFinite(input) && input > 0 ? Math.floor(input) : 0,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        String(input2).padStart(2, "0"),
      value2: Dynamic = Math.floor(value / 3600),
      value3: Dynamic = Math.floor((value % 3600) / 60);
    return value2 > 0
      ? String(value2) + ":" + callback(value3) + ":" + callback(value % 60)
      : String(value3) + ":" + callback(value % 60);
  }
  function createVideoPlaybackStore(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set(),
      callback: Dynamic = (): Dynamic => {
        let value: Dynamic =
          Number.isFinite(input.duration) && input.duration > 0;
        return {
          paused: input.paused,
          currentTime: Number.isFinite(input.currentTime)
            ? input.currentTime
            : 0,
          duration: value ? input.duration : 0,
          ready: input.readyState >= 1,
          seekable: value,
          failed: input.error != null,
        };
      },
      callback2: Dynamic = (): Dynamic => {
        let value: Dynamic = callback();
        for (let value2 of [...values] as Dynamic) value2(value);
      };
    for (let value of MediaVideoPlaybackPlayPauseTimeupdateValues as Dynamic)
      input.addEventListener(value, callback2);
    let callback3: Dynamic = (): Dynamic => {
      Promise.resolve(input.play()).catch((): Dynamic => callback2());
    };
    return {
      play: callback3,
      pause: (): Dynamic => input.pause(),
      toggle: (): Dynamic => (input.paused ? callback3() : input.pause()),
      seek: (input2?: Dynamic): Dynamic => {
        let duration: Dynamic = callback().duration;
        Number.isFinite(input2) &&
          (input.currentTime = Math.max(
            0,
            duration > 0 ? Math.min(input2, duration) : input2,
          ));
      },
      subscribe: (input2?: Dynamic): Dynamic => (
        values.add(input2),
        input2(callback()),
        (): Dynamic => {
          values.delete(input2);
        }
      ),
      detach: (): Dynamic => {
        for (let value of MediaVideoPlaybackPlayPauseTimeupdateValues as Dynamic)
          input.removeEventListener(value, callback2);
        values.clear();
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "B6b0a7Value",
    () => B6b0a7Value,
    (value) => {
      B6b0a7Value = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultAnnotationStrokeColor",
    () => defaultAnnotationStrokeColor,
    (value) => {
      defaultAnnotationStrokeColor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaVideoPlaybackPlayPauseSeekConfig",
    () => MediaVideoPlaybackPlayPauseSeekConfig,
    (value) => {
      MediaVideoPlaybackPlayPauseSeekConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaVideoPlaybackPlayPauseConfig",
    () => MediaVideoPlaybackPlayPauseConfig,
    (value) => {
      MediaVideoPlaybackPlayPauseConfig = value;
    },
  );
  bindRuntimeValue(runtime, "formatVideoTime", () => formatVideoTime);
  bindRuntimeValue(
    runtime,
    "MediaVideoPlaybackPlayPauseTimeupdateValues",
    () => MediaVideoPlaybackPlayPauseTimeupdateValues,
    (value) => {
      MediaVideoPlaybackPlayPauseTimeupdateValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createVideoPlaybackStore",
    () => createVideoPlaybackStore,
  );
  return () => {
    B6b0a7Value = "#b6b0a7";
    defaultAnnotationStrokeColor = "#8a8378";
    (0, runtime.initializeCdsIndex)();
    MediaVideoPlaybackPlayPauseSeekConfig = {
      play: "Play",
      pause: "Pause",
      seek: "Seek",
    };
    MediaVideoPlaybackPlayPauseConfig = {
      play: "PlayFilled",
      pause: "Pause",
    };
    MediaVideoPlaybackPlayPauseTimeupdateValues = [
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
  };
}
