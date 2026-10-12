/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasFrameReadiness(
  runtime: RuntimeBindings,
): () => void {
  var resolveDesignFramesReady: Dynamic;
  var designFramesReadyPromise: Dynamic;
  var resolveCaptureFramesReady: Dynamic;
  var captureFramesReadyPromise: Dynamic;
  function markDesignFramesReady(): Dynamic {
    resolveDesignFramesReady();
  }
  function unblockDesignFramesReady(): Dynamic {
    resolveDesignFramesReady();
  }
  function markCaptureFramesReady(): Dynamic {
    resolveCaptureFramesReady();
  }
  function waitForDesignFramesReady(): Dynamic {
    return designFramesReadyPromise;
  }
  function waitForActiveDesignFramesReady(): Dynamic {
    return (0, runtime.isFrameCaptureDocument)()
      ? captureFramesReadyPromise
      : designFramesReadyPromise;
  }
  function waitForDesignProjectFrames(project?: Dynamic): Dynamic {
    return Object.keys(project.files).some(runtime.isArtboardFile)
      ? waitForActiveDesignFramesReady()
      : Promise.resolve();
  }
  bindRuntimeValue(
    runtime,
    "resolveDesignFramesReady",
    () => resolveDesignFramesReady,
    (value) => {
      resolveDesignFramesReady = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designFramesReadyPromise",
    () => designFramesReadyPromise,
    (value) => {
      designFramesReadyPromise = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "markDesignFramesReady",
    () => markDesignFramesReady,
  );
  bindRuntimeValue(
    runtime,
    "unblockDesignFramesReady",
    () => unblockDesignFramesReady,
  );
  bindRuntimeValue(
    runtime,
    "resolveCaptureFramesReady",
    () => resolveCaptureFramesReady,
    (value) => {
      resolveCaptureFramesReady = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "captureFramesReadyPromise",
    () => captureFramesReadyPromise,
    (value) => {
      captureFramesReadyPromise = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "markCaptureFramesReady",
    () => markCaptureFramesReady,
  );
  bindRuntimeValue(
    runtime,
    "waitForDesignFramesReady",
    () => waitForDesignFramesReady,
  );
  bindRuntimeValue(
    runtime,
    "waitForActiveDesignFramesReady",
    () => waitForActiveDesignFramesReady,
  );
  bindRuntimeValue(
    runtime,
    "waitForDesignProjectFrames",
    () => waitForDesignProjectFrames,
  );
  return () => {
    resolveDesignFramesReady = (): Dynamic => {};
    designFramesReadyPromise = new Promise((input?: Dynamic): Dynamic => {
      resolveDesignFramesReady = input;
    });
    resolveCaptureFramesReady = (): Dynamic => {};
    captureFramesReadyPromise = new Promise((input?: Dynamic): Dynamic => {
      resolveCaptureFramesReady = input;
    });
  };
}
