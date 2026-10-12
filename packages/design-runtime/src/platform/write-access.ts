/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformWriteAccess(
  runtime: RuntimeBindings,
): () => void {
  var SIGN_IN_REQUIRED_REASON: Dynamic;
  var EDITING_UNAVAILABLE_REASON: Dynamic;
  var LIVE_READONLY_REASON: Dynamic;
  var CANVAS_READ_ERROR_REASON: Dynamic;
  var unavailableEmbeddedCache: Dynamic;
  var EMPTY_EMBEDDED_CONTENT: Dynamic;
  async function resolveDesignWriteAccess(): Promise<Dynamic> {
    if (!(0, runtime.canRequestPublishCapability)())
      return {
        canWrite: false,
        reason: EDITING_UNAVAILABLE_REASON,
      };
    let value: Dynamic = (0, runtime.readReadOnlyStash)();
    if (value !== null)
      return {
        canWrite: false,
        reason: value,
      };
    let [value2, value3, value4, value5]: Dynamic = await Promise.all([
      (0, runtime.getCurrentUserPermission)("data.write"),
      (0, runtime.getCurrentUserPermission)("files.write"),
      (0, runtime.getCurrentUserCanEdit)(),
      (0, runtime.getAssetsCapability)(),
    ]);
    return value2 !== null || value3 !== null
      ? (value2 === true || value3 === true) && value4 !== false
        ? {
            canWrite: true,
          }
        : {
            canWrite: false,
            reason: LIVE_READONLY_REASON,
          }
      : value4 !== true && value5 === null
        ? {
            canWrite: false,
            reason: LIVE_READONLY_REASON,
          }
        : {
            canWrite: true,
          };
  }
  function createReadonlyEmbeddedCache(input?: Dynamic): Dynamic {
    return {
      read: (): Dynamic => input,
      write: (): Dynamic => false,
      clear(): Dynamic {},
    };
  }
  function createEmbeddedReadonlyState(
    input?: Dynamic,
    options: Dynamic = SIGN_IN_REQUIRED_REASON,
  ): Dynamic {
    return {
      embeddedState: {
        title:
          typeof document !== "undefined"
            ? (document as Dynamic).title
            : undefined,
        content: input,
        comments: [],
      },
      roFlag: createReadonlyEmbeddedCache(options),
      stash: unavailableEmbeddedCache,
      canPublish: true,
      pageParts: EMPTY_EMBEDDED_CONTENT,
    };
  }
  bindRuntimeValue(
    runtime,
    "SIGN_IN_REQUIRED_REASON",
    () => SIGN_IN_REQUIRED_REASON,
    (value) => {
      SIGN_IN_REQUIRED_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITING_UNAVAILABLE_REASON",
    () => EDITING_UNAVAILABLE_REASON,
    (value) => {
      EDITING_UNAVAILABLE_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_READONLY_REASON",
    () => LIVE_READONLY_REASON,
    (value) => {
      LIVE_READONLY_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CANVAS_READ_ERROR_REASON",
    () => CANVAS_READ_ERROR_REASON,
    (value) => {
      CANVAS_READ_ERROR_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveDesignWriteAccess",
    () => resolveDesignWriteAccess,
  );
  bindRuntimeValue(
    runtime,
    "unavailableEmbeddedCache",
    () => unavailableEmbeddedCache,
    (value) => {
      unavailableEmbeddedCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createReadonlyEmbeddedCache",
    () => createReadonlyEmbeddedCache,
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_EMBEDDED_CONTENT",
    () => EMPTY_EMBEDDED_CONTENT,
    (value) => {
      EMPTY_EMBEDDED_CONTENT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createEmbeddedReadonlyState",
    () => createEmbeddedReadonlyState,
  );
  return () => {
    SIGN_IN_REQUIRED_REASON =
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      "Sign in to see this content, then reload the page. If you\u2019re already signed in, you might not have access to it.";
    EDITING_UNAVAILABLE_REASON = "Editing isn\u2019t available in this view.";
    LIVE_READONLY_REASON = "Read-only. You can view live changes.";
    CANVAS_READ_ERROR_REASON =
      "Couldn\u2019t read the full file list. Reload to try again.";
    unavailableEmbeddedCache = {
      read: (): Dynamic => null,
      write: (): Dynamic => false,
      clear(): Dynamic {},
    };
    EMPTY_EMBEDDED_CONTENT = {
      title: "",
      readme: "",
      readmeMeta: "",
      css: "",
      js: "",
      emulator: false,
    };
  };
}
