/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardNative(
  runtime: RuntimeBindings,
): () => void {
  var reactClipboardNative: Dynamic;
  var ClipboardNativeAlias: Dynamic;
  var ClipboardNativeObservedElements: Dynamic;
  var AppifactObjectAttribute: Dynamic;
  var clipboardObjectAttributePattern: Dynamic;
  var ClipboardNativeResolvedValue: Dynamic;
  function setClipboardMirror(input?: Dynamic): Dynamic {
    ClipboardNativeAlias = input;
    if (input === undefined || ClipboardNativeObservedElements.has(document))
      return;
    ClipboardNativeObservedElements.add(document);
    let callback: Dynamic = (): Dynamic => setClipboardMirror(undefined);
    (document as Dynamic).addEventListener("copy", callback, true);
    (document as Dynamic).addEventListener("cut", callback, true);
    (window as Dynamic).addEventListener("blur", callback);
  }
  async function writeClipboardText(input?: Dynamic): Promise<Dynamic> {
    try {
      await navigator.clipboard.writeText(input);
      setClipboardMirror(undefined);
      return true;
    } catch {}
    try {
      let value: Dynamic = (document as Dynamic).createElement("textarea");
      value.value = input;
      value.style.position = "fixed";
      value.style.opacity = "0";
      (document as Dynamic).body.appendChild(value);
      value.select();
      let value2: Dynamic = (document as Dynamic).execCommand("copy");
      value.remove();
      return value2;
    } catch {
      return false;
    }
  }
  function encodeClipboardUtf8(input?: Dynamic): Dynamic {
    let value: Dynamic = new TextEncoder().encode(input),
      text: Dynamic = "";
    for (let index: Dynamic = 0; index < value.length; index += 32768)
      text += String.fromCharCode(...value.subarray(index, index + 32768));
    return btoa(text);
  }
  function decodeClipboardUtf8(input?: Dynamic): Dynamic {
    try {
      let value: Dynamic = atob(input),
        value2: Dynamic = new Uint8Array(value.length);
      for (let index: Dynamic = 0; index < value.length; index++)
        value2[index] = value.charCodeAt(index);
      return new TextDecoder().decode(value2);
    } catch {
      return;
    }
  }
  function escapeClipboardHtml(input?: Dynamic): Dynamic {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function writeClipboardObject(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let clipboardData: Dynamic = input.clipboardData;
    if (!clipboardData) return false;
    let state: Dynamic = {
      appifact: 1,
      kind: options,
      data: context.data,
    };
    try {
      clipboardData.setData("text/plain", context.text);
      clipboardData.setData(
        "text/html",
        "<span " +
          AppifactObjectAttribute +
          '="' +
          encodeClipboardUtf8(JSON.stringify(state)) +
          '">' +
          escapeClipboardHtml(context.text) +
          "</span>",
      );
    } catch {
      return false;
    }
    ClipboardNativeResolvedValue =
      context.text === ""
        ? undefined
        : {
            kind: options,
            data: context.data,
            text: context.text,
          };
    setClipboardMirror({
      kind: options,
      data: context.data,
    });
    return true;
  }
  function readClipboardObject(input?: Dynamic): Dynamic {
    let clipboardData: Dynamic = input.clipboardData;
    if (!clipboardData) return;
    let value: Dynamic = clipboardData.getData("text/html"),
      value2: Dynamic =
        value === "" ? null : clipboardObjectAttributePattern.exec(value);
    if (value2?.[1] !== undefined) {
      let value3: Dynamic = decodeClipboardUtf8(value2[1]);
      if (value3 !== undefined)
        try {
          let value4: Dynamic = JSON.parse(value3);
          if (
            typeof value4 == "object" &&
            value4 !== null &&
            value4.appifact === 1 &&
            typeof value4.kind == "string" &&
            Object.hasOwn(value4, "data")
          )
            return {
              kind: value4.kind,
              data: value4.data,
            };
        } catch {}
    }
    if (
      ClipboardNativeResolvedValue !== undefined &&
      ClipboardNativeResolvedValue.text !== "" &&
      clipboardData.getData("text/plain") === ClipboardNativeResolvedValue.text
    )
      return {
        kind: ClipboardNativeResolvedValue.kind,
        data: ClipboardNativeResolvedValue.data,
      };
  }
  function clipboardContainsFileNames(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.trim();
    if (value === "" || /^https?:\/\/\S+$/.test(value)) return true;
    let values: Dynamic = new Set(
      input.map((input2?: Dynamic): Dynamic => input2.name),
    );
    return value
      .split(/\r\n|\r|\n/)
      .every(
        (input2?: Dynamic): Dynamic =>
          values.has(normalizeClipboardFileName(input2)),
      );
  }
  function normalizeClipboardFileName(input?: Dynamic): Dynamic {
    let value: Dynamic = input.trim().replace(/^"(.*)"$/, "$1");
    if (!/^(file:\/\/|\/|\\\\|[A-Za-z]:[\\/])/i.test(value)) return value;
    if (/^file:/i.test(value))
      try {
        value = decodeURIComponent(value);
      } catch {}
    return value.slice(
      Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\")) + 1,
    );
  }
  function copyClipboardObject(input?: Dynamic, options?: Dynamic): Dynamic {
    let flag: Dynamic = false,
      callback: Dynamic = (event?: Dynamic): Dynamic => {
        event.preventDefault();
        flag = writeClipboardObject(event, input, options);
      },
      activeElement: Dynamic = (document as Dynamic).activeElement,
      value: Dynamic = (document as Dynamic).createElement("textarea");
    value.value = options.text === "" ? " " : options.text;
    value.style.position = "fixed";
    value.style.opacity = "0";
    (document as Dynamic).body.appendChild(value);
    value.select();
    (document as Dynamic).addEventListener("copy", callback, {
      capture: true,
      once: true,
    });
    try {
      (document as Dynamic).execCommand("copy");
    } catch {}
    (document as Dynamic).removeEventListener("copy", callback, {
      capture: true,
    });
    value.remove();
    activeElement instanceof HTMLElement &&
      activeElement.isConnected &&
      activeElement.focus({
        preventScroll: true,
      });
    return flag;
  }
  bindRuntimeValue(
    runtime,
    "reactClipboardNative",
    () => reactClipboardNative,
    (value) => {
      reactClipboardNative = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardNativeAlias",
    () => ClipboardNativeAlias,
    (value) => {
      ClipboardNativeAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardNativeObservedElements",
    () => ClipboardNativeObservedElements,
    (value) => {
      ClipboardNativeObservedElements = value;
    },
  );
  bindRuntimeValue(runtime, "setClipboardMirror", () => setClipboardMirror);
  bindRuntimeValue(runtime, "writeClipboardText", () => writeClipboardText);
  bindRuntimeValue(
    runtime,
    "AppifactObjectAttribute",
    () => AppifactObjectAttribute,
    (value) => {
      AppifactObjectAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clipboardObjectAttributePattern",
    () => clipboardObjectAttributePattern,
    (value) => {
      clipboardObjectAttributePattern = value;
    },
  );
  bindRuntimeValue(runtime, "encodeClipboardUtf8", () => encodeClipboardUtf8);
  bindRuntimeValue(runtime, "decodeClipboardUtf8", () => decodeClipboardUtf8);
  bindRuntimeValue(runtime, "escapeClipboardHtml", () => escapeClipboardHtml);
  bindRuntimeValue(
    runtime,
    "ClipboardNativeResolvedValue",
    () => ClipboardNativeResolvedValue,
    (value) => {
      ClipboardNativeResolvedValue = value;
    },
  );
  bindRuntimeValue(runtime, "writeClipboardObject", () => writeClipboardObject);
  bindRuntimeValue(runtime, "readClipboardObject", () => readClipboardObject);
  bindRuntimeValue(
    runtime,
    "clipboardContainsFileNames",
    () => clipboardContainsFileNames,
  );
  bindRuntimeValue(
    runtime,
    "normalizeClipboardFileName",
    () => normalizeClipboardFileName,
  );
  bindRuntimeValue(runtime, "copyClipboardObject", () => copyClipboardObject);
  return () => {
    reactClipboardNative = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    ClipboardNativeObservedElements = new WeakSet();
    AppifactObjectAttribute = "data-appifact-object";
    clipboardObjectAttributePattern = new RegExp(
      AppifactObjectAttribute + '="([A-Za-z0-9+/=]+)"',
    );
  };
}
