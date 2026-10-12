/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTextDeferredInput(
  runtime: RuntimeBindings,
): () => void {
  var TextDeferredInputTokenTypedSinkConfig: Dynamic;
  var TextDeferredInputConstant: Dynamic;
  var TextDeferredInputHandler: Dynamic;
  var TextDeferredInputHandler_2: Dynamic;
  var TextDeferredInputNow: Dynamic;
  var TextDeferredInputHandler_3: Dynamic;
  function eventTargetsInput(event?: Dynamic): Dynamic {
    let value: Dynamic = event.composedPath?.()[0] ?? event.target;
    return (
      TextDeferredInputHandler_3(value) &&
      (value.tagName === "INPUT" ||
        value.tagName === "TEXTAREA" ||
        value.tagName === "SELECT" ||
        value.isContentEditable === true)
    );
  }
  function removeDeferredTextListeners(): Dynamic {
    (window as Dynamic).removeEventListener(
      "keydown",
      collectDeferredTypedText,
      true,
    );
    (window as Dynamic).removeEventListener(
      "pointerdown",
      TextDeferredInputNow,
      true,
    );
  }
  function collectDeferredTypedText(event?: Dynamic): Dynamic {
    let value: Dynamic = event.key ?? "";
    if (
      !TextDeferredInputTokenTypedSinkConfig?.keys ||
      !value ||
      event.isComposing ||
      value === "Shift" ||
      value === "Alt" ||
      value === "AltGraph" ||
      value === "Meta" ||
      value === "Control" ||
      value === "CapsLock"
    )
      return;
    let value2: Dynamic = event.getModifierState?.("AltGraph") === true;
    if (
      ((event.metaKey || event.ctrlKey) && !value2) ||
      value === "Escape" ||
      eventTargetsInput(event)
    ) {
      TextDeferredInputHandler_2();
      return;
    }
    if (event.altKey && !value2 && /^[a-z0-9]$/i.test(value)) return;
    let value3: Dynamic = value === "Backspace" ? "" : value;
    (value3.length > 1 && value3 !== "Enter" && value3 !== "Delete") ||
      (event.preventDefault(),
      event.stopImmediatePropagation(),
      !(value3.length > 1 || event.repeat) &&
        ((TextDeferredInputTokenTypedSinkConfig.typed = value3
          ? TextDeferredInputTokenTypedSinkConfig.typed + value3
          : TextDeferredInputTokenTypedSinkConfig.typed.slice(0, -1)),
        TextDeferredInputTokenTypedSinkConfig.sink?.key(value3)));
  }
  function beginDeferredTextInput(): Dynamic {
    return TextDeferredInputTokenTypedSinkConfig?.keys
      ? null
      : (TextDeferredInputTokenTypedSinkConfig &&
          finishDeferredTextInput("edit"),
        (window as Dynamic).addEventListener(
          "keydown",
          collectDeferredTypedText,
          true,
        ),
        (window as Dynamic).addEventListener(
          "pointerdown",
          TextDeferredInputNow,
          true,
        ),
        (TextDeferredInputTokenTypedSinkConfig = {
          token: ++TextDeferredInputConstant,
          typed: "",
          sink: null,
          keys: true,
          timer: setTimeout(TextDeferredInputHandler, 3e3),
          at: performance.now(),
        }),
        TextDeferredInputTokenTypedSinkConfig.token);
  }
  function hasDeferredTextSink(): Dynamic {
    return TextDeferredInputTokenTypedSinkConfig?.sink != null;
  }
  function cancelDeferredTextSink(): Dynamic {
    hasDeferredTextSink() && finishDeferredTextInput("edit");
  }
  function attachDeferredTextSink(input?: Dynamic, options?: Dynamic): Dynamic {
    return TextDeferredInputTokenTypedSinkConfig?.token !== input
      ? null
      : (clearTimeout(TextDeferredInputTokenTypedSinkConfig.timer),
        (TextDeferredInputTokenTypedSinkConfig.sink = options),
        (TextDeferredInputTokenTypedSinkConfig.timer = setTimeout(
          TextDeferredInputHandler_2,
          2100,
        )),
        {
          typed: TextDeferredInputTokenTypedSinkConfig.typed,
          until: Date.now() + 2e3,
        });
  }
  function resetDeferredTextPointer(): Dynamic {
    TextDeferredInputNow();
  }
  function finishDeferredTextInput(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (
      !TextDeferredInputTokenTypedSinkConfig ||
      (options !== undefined &&
        TextDeferredInputTokenTypedSinkConfig.token !== options) ||
      (input === "opened" && !TextDeferredInputTokenTypedSinkConfig.sink)
    )
      return;
    let { sink: value, keys: value2 }: Dynamic =
      TextDeferredInputTokenTypedSinkConfig;
    value2 && removeDeferredTextListeners();
    if (input === "keys" && !value) {
      value2 &&
        (clearTimeout(TextDeferredInputTokenTypedSinkConfig.timer),
        (TextDeferredInputTokenTypedSinkConfig.keys = false),
        (TextDeferredInputTokenTypedSinkConfig.typed = ""));
      return;
    }
    clearTimeout(TextDeferredInputTokenTypedSinkConfig.timer);
    TextDeferredInputTokenTypedSinkConfig = null;
    input !== "opened" && value?.drop(input === "keys");
  }
  bindRuntimeValue(
    runtime,
    "TextDeferredInputTokenTypedSinkConfig",
    () => TextDeferredInputTokenTypedSinkConfig,
    (value) => {
      TextDeferredInputTokenTypedSinkConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextDeferredInputConstant",
    () => TextDeferredInputConstant,
    (value) => {
      TextDeferredInputConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextDeferredInputHandler",
    () => TextDeferredInputHandler,
    (value) => {
      TextDeferredInputHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextDeferredInputHandler_2",
    () => TextDeferredInputHandler_2,
    (value) => {
      TextDeferredInputHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextDeferredInputNow",
    () => TextDeferredInputNow,
    (value) => {
      TextDeferredInputNow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextDeferredInputHandler_3",
    () => TextDeferredInputHandler_3,
    (value) => {
      TextDeferredInputHandler_3 = value;
    },
  );
  bindRuntimeValue(runtime, "eventTargetsInput", () => eventTargetsInput);
  bindRuntimeValue(
    runtime,
    "removeDeferredTextListeners",
    () => removeDeferredTextListeners,
  );
  bindRuntimeValue(
    runtime,
    "collectDeferredTypedText",
    () => collectDeferredTypedText,
  );
  bindRuntimeValue(
    runtime,
    "beginDeferredTextInput",
    () => beginDeferredTextInput,
  );
  bindRuntimeValue(runtime, "hasDeferredTextSink", () => hasDeferredTextSink);
  bindRuntimeValue(
    runtime,
    "cancelDeferredTextSink",
    () => cancelDeferredTextSink,
  );
  bindRuntimeValue(
    runtime,
    "attachDeferredTextSink",
    () => attachDeferredTextSink,
  );
  bindRuntimeValue(
    runtime,
    "resetDeferredTextPointer",
    () => resetDeferredTextPointer,
  );
  bindRuntimeValue(
    runtime,
    "finishDeferredTextInput",
    () => finishDeferredTextInput,
  );
  return () => {
    TextDeferredInputTokenTypedSinkConfig = null;
    TextDeferredInputConstant = 0;
    TextDeferredInputHandler = (): Dynamic => finishDeferredTextInput("keys");
    TextDeferredInputHandler_2 = (): Dynamic => finishDeferredTextInput("edit");
    TextDeferredInputNow = (input?: Dynamic): Dynamic => {
      TextDeferredInputTokenTypedSinkConfig?.keys &&
        (input?.timeStamp ?? performance.now()) -
          TextDeferredInputTokenTypedSinkConfig.at >
          500 &&
        TextDeferredInputHandler_2();
    };
    TextDeferredInputHandler_3 = (input?: Dynamic): Dynamic =>
      input != null && "tagName" in input && "isContentEditable" in input;
  };
}
