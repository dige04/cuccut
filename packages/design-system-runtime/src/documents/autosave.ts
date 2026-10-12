import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installDocumentsAutosave(runtime: RuntimeBindings): () => void {
  var AUTOSAVE_IDLE_MS: number;
  var AUTOSAVE_MAX_WAIT_MS: number;
  var AUTOSAVE_RETRY_DELAYS_MS: number[];
  function withAutomaticSave<Content>(
    artifactDocument: Host.ArtifactDocument<Content>,
    options: Host.AutosaveOptions = {},
  ): Host.ArtifactDocument<Content> {
    let offFlag =
      options.offFlag ?? (0, runtime.createArtifactLocalFlag)("autosave-off");
    if (artifactDocument.saveMode() === "auto" || offFlag.read() !== null) {
      return artifactDocument;
    }
    let timers = options.timers ?? {
        setTimeout: (input, options2) => setTimeout(input, options2),
        clearTimeout: (input) => clearTimeout(input),
        now: (): number => Date.now(),
      },
      idleMs = options.idleMs ?? AUTOSAVE_IDLE_MS,
      maxWaitMs = options.maxWaitMs ?? AUTOSAVE_MAX_WAIT_MS,
      saveTimer: ReturnType<typeof setTimeout> | undefined,
      previousStatus: Host.SaveState["status"] | undefined,
      firstDirtyAt: number | undefined,
      isSaving: boolean = false,
      retryCount = 0,
      retryAfter = 0,
      willRetry: boolean = false,
      disabled: boolean = false;
    function saveNow() {
      saveTimer = undefined;
      if (options.hold?.() === true) {
        return scheduleSave(timers.now() + idleMs);
      }
      isSaving = true;
      Promise.resolve(artifactDocument.save()).finally((): void => {
        isSaving = false;
        if (previousStatus === "dirty") {
          scheduleSave(Math.max(timers.now() + idleMs, retryAfter));
        }
      });
    }
    function scheduleSave(input: number): void {
      timers.clearTimeout(saveTimer);
      if (!disabled) {
        saveTimer = timers.setTimeout(
          saveNow,
          Math.max(0, input - timers.now()),
        );
      }
    }
    function handleSaveState(state: Host.SaveState): void {
      let value = previousStatus;
      previousStatus = state.status;
      if (state.reloading) {
        disabled = true;
        timers.clearTimeout(saveTimer);
        offFlag.write("1");
        return;
      }
      if (state.status === "dirty") {
        let value2 = timers.now();
        firstDirtyAt ??= value2;
        willRetry = false;
        if (!isSaving) {
          scheduleSave(
            Math.max(
              Math.min(value2 + idleMs, firstDirtyAt + maxWaitMs),
              retryAfter,
            ),
          );
        }
        return;
      }
      if (state.status === "error" && value === "error") {
        return;
      }
      timers.clearTimeout(saveTimer);
      saveTimer = undefined;
      willRetry = false;
      firstDirtyAt = undefined;
      if (state.status === "ready" && value === "saving") {
        retryCount = 0;
        retryAfter = 0;
      } else if (
        state.status === "error" &&
        (state.code === "upstream_error" || state.code === "rate_limited")
      ) {
        retryAfter =
          timers.now() +
          AUTOSAVE_RETRY_DELAYS_MS[
            Math.min(retryCount, AUTOSAVE_RETRY_DELAYS_MS.length - 1)
          ];
        willRetry = retryCount < AUTOSAVE_RETRY_DELAYS_MS.length;
        retryCount += 1;
        if (willRetry) {
          scheduleSave(retryAfter);
        }
      }
    }
    artifactDocument.subscribeSave(handleSaveState);
    handleSaveState(artifactDocument.saveState());
    if (
      typeof document !== "undefined" &&
      typeof document.addEventListener === "function"
    ) {
      document.addEventListener("visibilitychange", (): void => {
        if (
          document.visibilityState === "hidden" &&
          artifactDocument.saveState().status === "dirty" &&
          !disabled &&
          timers.now() >= retryAfter &&
          options.hold?.() !== true
        ) {
          artifactDocument.save();
        }
      });
    }
    let presentSaveState = (state: Host.SaveState): Host.SaveState => {
      if (state.status === "dirty" && state.message === undefined) {
        return {
          ...state,
          message:
            timers.now() < retryAfter
              ? "Not saved yet: waiting a little after a failed try; click to save now."
              : "Saving in a moment…",
        };
      }
      if (state.status !== "error") {
        return state;
      }
      if (willRetry) {
        return {
          status: "dirty",
          message:
            (state.message ?? "Not saved yet.") +
            " Retrying by itself; click to retry now.",
        };
      }
      if (state.code === "conflict") {
        return state;
      } else {
        return {
          ...state,
          message: (state.message ?? "Not saved.") + " Click to retry.",
        };
      }
    };
    return {
      ...artifactDocument,
      saveMode: (): "auto" => "auto",
      saveState: () => presentSaveState(artifactDocument.saveState()),
      subscribeSave: (input) =>
        artifactDocument.subscribeSave((input2) =>
          input(presentSaveState(input2)),
        ),
    };
  }
  bindRuntimeValue(
    runtime,
    "AUTOSAVE_IDLE_MS",
    () => AUTOSAVE_IDLE_MS,
    (value) => {
      AUTOSAVE_IDLE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AUTOSAVE_MAX_WAIT_MS",
    () => AUTOSAVE_MAX_WAIT_MS,
    (value) => {
      AUTOSAVE_MAX_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AUTOSAVE_RETRY_DELAYS_MS",
    () => AUTOSAVE_RETRY_DELAYS_MS,
    (value) => {
      AUTOSAVE_RETRY_DELAYS_MS = value;
    },
  );
  bindRuntimeValue(runtime, "withAutomaticSave", () => withAutomaticSave);
  return () => {
    AUTOSAVE_IDLE_MS = 3000;
    AUTOSAVE_MAX_WAIT_MS = 30000;
    AUTOSAVE_RETRY_DELAYS_MS = [20000, 60000, 180000];
  };
}
