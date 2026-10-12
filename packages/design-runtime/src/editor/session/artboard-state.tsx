/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSessionArtboardState(
  runtime: RuntimeBindings,
): () => void {
  var SessionArtboardStateConstant: Dynamic;
  var SessionArtboardStateAlias: Dynamic;
  var SessionArtboardStateAlias_2: Dynamic;
  var reactSessionArtboardState: Dynamic;
  var jsxSessionArtboardState: Dynamic;
  var SessionArtboardStatePausedCurrentTimeDurationConfig: Dynamic;
  var SessionArtboardStateEscape: Dynamic;
  var SessionArtboardStateHandler: Dynamic;
  function setArtboardWritableCheck(input?: Dynamic): Dynamic {
    SessionArtboardStateAlias_2 = input;
  }
  function isArtboardWritable(input?: Dynamic): Dynamic {
    return SessionArtboardStateAlias_2 === "cannot tell"
      ? SessionArtboardStateAlias === input
      : SessionArtboardStateAlias_2?.(input) === true;
  }
  function artboardStorePath(input?: Dynamic): Dynamic {
    return (
      runtime.BoardsValue + "/" + (0, runtime.encodeStorePathSegment)(input)
    );
  }
  function currentEditingArtboardPath(): Dynamic {
    return SessionArtboardStateAlias === null
      ? null
      : artboardStorePath(SessionArtboardStateAlias);
  }
  function currentEditingArtboard(): Dynamic {
    return SessionArtboardStateAlias;
  }
  function setCurrentEditingArtboard(input?: Dynamic): Dynamic {
    if (input === SessionArtboardStateAlias) return null;
    let value: Dynamic = currentEditingArtboardPath();
    SessionArtboardStateAlias = input;
    return value;
  }
  bindRuntimeValue(
    runtime,
    "SessionArtboardStateConstant",
    () => SessionArtboardStateConstant,
    (value) => {
      SessionArtboardStateConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionArtboardStateAlias",
    () => SessionArtboardStateAlias,
    (value) => {
      SessionArtboardStateAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionArtboardStateAlias_2",
    () => SessionArtboardStateAlias_2,
    (value) => {
      SessionArtboardStateAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setArtboardWritableCheck",
    () => setArtboardWritableCheck,
  );
  bindRuntimeValue(runtime, "isArtboardWritable", () => isArtboardWritable);
  bindRuntimeValue(runtime, "artboardStorePath", () => artboardStorePath);
  bindRuntimeValue(
    runtime,
    "currentEditingArtboardPath",
    () => currentEditingArtboardPath,
  );
  bindRuntimeValue(
    runtime,
    "currentEditingArtboard",
    () => currentEditingArtboard,
  );
  bindRuntimeValue(
    runtime,
    "setCurrentEditingArtboard",
    () => setCurrentEditingArtboard,
  );
  bindRuntimeValue(
    runtime,
    "reactSessionArtboardState",
    () => reactSessionArtboardState,
    (value) => {
      reactSessionArtboardState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSessionArtboardState",
    () => jsxSessionArtboardState,
    (value) => {
      jsxSessionArtboardState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionArtboardStatePausedCurrentTimeDurationConfig",
    () => SessionArtboardStatePausedCurrentTimeDurationConfig,
    (value) => {
      SessionArtboardStatePausedCurrentTimeDurationConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionArtboardStateEscape",
    () => SessionArtboardStateEscape,
    (value) => {
      SessionArtboardStateEscape = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SessionArtboardStateHandler",
    () => SessionArtboardStateHandler,
    (value) => {
      SessionArtboardStateHandler = value;
    },
  );
  return () => {
    SessionArtboardStateConstant = 3e4;
    SessionArtboardStateAlias = null;
    SessionArtboardStateAlias_2 = null;
    reactSessionArtboardState = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxSessionArtboardState = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    SessionArtboardStatePausedCurrentTimeDurationConfig = {
      paused: true,
      currentTime: 0,
      duration: 0,
      ready: false,
      seekable: false,
      failed: false,
    };
    SessionArtboardStateEscape = (input?: Dynamic): Dynamic =>
      '[data-mega-annotation="' + CSS.escape(input) + '"] video';
    SessionArtboardStateHandler = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => "video[" + input + '="' + String(options) + '"]';
  };
}
