/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorInspectorEditor(
  runtime: RuntimeBindings,
): () => void {
  var jsxInspectorEditor: Dynamic;
  var InspectorEditorLazyComponent: Dynamic;
  var TextListValue: Dynamic;
  var InspectorEditorConstant: Dynamic;
  var InspectorEditorConstant_2: Dynamic;
  var InspectorEditorItems: Dynamic;
  var InspectorEditorItems_2: Dynamic;
  var InspectorEditorSubscribers: Dynamic;
  var InspectorEditorConstant_3: Dynamic;
  var InspectorEditorLabel: Dynamic;
  var InspectorEditorResolvedValue: Dynamic;
  var InspectorEditorMetaControlShiftSet: Dynamic;
  var InspectorEditorSubscribers_2: Dynamic;
  var InspectorEditorEvery: Dynamic;
  var InspectorEditorKeys: Dynamic;
  var InspectorEditorSubscribers_3: Dynamic;
  var InspectorEditorReplace: Dynamic;
  var InspectorEditorFontFamilyFontWeightFontSizeSet: Dynamic;
  var InspectorEditorSubscribers_4: Dynamic;
  var InspectorEditorResolvedValue_2: Dynamic;
  var InspectorEditorPropLabelSpecConfig: Dynamic;
  var InspectorEditorLabel_2: Dynamic;
  var InspectorEditorLabel_3: Dynamic;
  var InspectorEditorLabel_4: Dynamic;
  var inspectorSingleSelectionMessage: Dynamic;
  function markBlockedDragElements(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    for (let value of (options ?? []) as Dynamic)
      value !== context &&
        input.setAttribute(value, "data-dc-drag-block", String(value));
  }
  function normalizePasteStamp(input?: Dynamic): Dynamic {
    let stamp: Dynamic = input.stamp;
    return typeof stamp == "string" && stamp.length > 0 && stamp.length <= 64
      ? stamp
      : null;
  }
  function foreignArtboardPasteContext(input?: Dynamic): Dynamic {
    let foreignArtboards: Dynamic = input.foreignArtboards;
    return typeof foreignArtboards == "number" &&
      Number.isFinite(foreignArtboards) &&
      foreignArtboards > 0
      ? {
          forwarded: Math.min(Math.floor(foreignArtboards), 999),
        }
      : undefined;
  }
  function boundedPasteText(input?: Dynamic): Dynamic {
    return typeof input.text == "string"
      ? (0, runtime.utf16SafeSlice)(input.text, InspectorEditorResolvedValue)
      : "";
  }
  function textContrastGround(input?: Dynamic, options?: Dynamic): Dynamic {
    if (
      input === null ||
      options.backgroundClip === "text" ||
      options.webkitBackgroundClip === "text"
    )
      return null;
    let value: Dynamic = (0, runtime.normalizePixelValue)(options.fontSize),
      value2: Dynamic = (0, runtime.normalizeFontWeight)(options.fontWeight);
    return {
      ...(0, runtime.textContrastContext)(
        input.behind,
        value === null ? null : parseFloat(value),
        value2 === null ? null : parseFloat(value2),
      ),
      ink: input.ink,
    };
  }
  function InspectorEmptyState(input?: Dynamic): Dynamic {
    return (
      <div
        {...input}
        className={(0, runtime.cn)(
          "py-7 px-5 text-center text-xs text-secondary leading-normal",
          input.className,
        )}
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxInspectorEditor",
    () => jsxInspectorEditor,
    (value) => {
      jsxInspectorEditor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorLazyComponent",
    () => InspectorEditorLazyComponent,
    (value) => {
      InspectorEditorLazyComponent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextListValue",
    () => TextListValue,
    (value) => {
      TextListValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorConstant",
    () => InspectorEditorConstant,
    (value) => {
      InspectorEditorConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorConstant_2",
    () => InspectorEditorConstant_2,
    (value) => {
      InspectorEditorConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorItems",
    () => InspectorEditorItems,
    (value) => {
      InspectorEditorItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorItems_2",
    () => InspectorEditorItems_2,
    (value) => {
      InspectorEditorItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorSubscribers",
    () => InspectorEditorSubscribers,
    (value) => {
      InspectorEditorSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "markBlockedDragElements",
    () => markBlockedDragElements,
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorConstant_3",
    () => InspectorEditorConstant_3,
    (value) => {
      InspectorEditorConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorLabel",
    () => InspectorEditorLabel,
    (value) => {
      InspectorEditorLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorResolvedValue",
    () => InspectorEditorResolvedValue,
    (value) => {
      InspectorEditorResolvedValue = value;
    },
  );
  bindRuntimeValue(runtime, "normalizePasteStamp", () => normalizePasteStamp);
  bindRuntimeValue(
    runtime,
    "foreignArtboardPasteContext",
    () => foreignArtboardPasteContext,
  );
  bindRuntimeValue(runtime, "boundedPasteText", () => boundedPasteText);
  bindRuntimeValue(
    runtime,
    "InspectorEditorMetaControlShiftSet",
    () => InspectorEditorMetaControlShiftSet,
    (value) => {
      InspectorEditorMetaControlShiftSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorSubscribers_2",
    () => InspectorEditorSubscribers_2,
    (value) => {
      InspectorEditorSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorEvery",
    () => InspectorEditorEvery,
    (value) => {
      InspectorEditorEvery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorKeys",
    () => InspectorEditorKeys,
    (value) => {
      InspectorEditorKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorSubscribers_3",
    () => InspectorEditorSubscribers_3,
    (value) => {
      InspectorEditorSubscribers_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorReplace",
    () => InspectorEditorReplace,
    (value) => {
      InspectorEditorReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorFontFamilyFontWeightFontSizeSet",
    () => InspectorEditorFontFamilyFontWeightFontSizeSet,
    (value) => {
      InspectorEditorFontFamilyFontWeightFontSizeSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorSubscribers_4",
    () => InspectorEditorSubscribers_4,
    (value) => {
      InspectorEditorSubscribers_4 = value;
    },
  );
  bindRuntimeValue(runtime, "textContrastGround", () => textContrastGround);
  bindRuntimeValue(
    runtime,
    "InspectorEditorResolvedValue_2",
    () => InspectorEditorResolvedValue_2,
    (value) => {
      InspectorEditorResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(runtime, "InspectorEmptyState", () => InspectorEmptyState);
  bindRuntimeValue(
    runtime,
    "InspectorEditorPropLabelSpecConfig",
    () => InspectorEditorPropLabelSpecConfig,
    (value) => {
      InspectorEditorPropLabelSpecConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorLabel_2",
    () => InspectorEditorLabel_2,
    (value) => {
      InspectorEditorLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorLabel_3",
    () => InspectorEditorLabel_3,
    (value) => {
      InspectorEditorLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorEditorLabel_4",
    () => InspectorEditorLabel_4,
    (value) => {
      InspectorEditorLabel_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inspectorSingleSelectionMessage",
    () => inspectorSingleSelectionMessage,
    (value) => {
      inspectorSingleSelectionMessage = value;
    },
  );
  return () => {
    jsxInspectorEditor = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    InspectorEditorLazyComponent = (0, runtime.reactCanvasShape_2.lazy)(
      (): Dynamic =>
        Promise.resolve()
          .then(
            (): Dynamic => (
              (0, runtime.initializeInspectorLinkPopover)(),
              runtime.linkPopoverExports
            ),
          )
          .then(
            (input?: Dynamic): Dynamic => ({
              default: input.DcLinkPopover,
            }),
          ),
    );
    TextListValue = "text:list";
    InspectorEditorConstant = 12;
    InspectorEditorConstant_2 = 48;
    InspectorEditorItems = [];
    InspectorEditorItems_2 = [];
    InspectorEditorSubscribers = new Set();
    InspectorEditorConstant_3 = 5e3;
    InspectorEditorLabel =
      "Editor is still loading \u2014 try again in a moment.";
    InspectorEditorResolvedValue = 2 * 1024 * 1024;
    InspectorEditorMetaControlShiftSet = new Set([
      "Meta",
      "Control",
      "Shift",
      "Alt",
      "CapsLock",
    ]);
    InspectorEditorSubscribers_2 = new Set();
    if (typeof window !== "undefined") {
      let callback: Dynamic = (): Dynamic =>
        InspectorEditorSubscribers_2.forEach(
          (input?: Dynamic): Dynamic => input(),
        );
      (window as Dynamic).addEventListener("pointerdown", callback, true);
      (window as Dynamic).addEventListener(
        "keydown",
        (input?: Dynamic): Dynamic => {
          InspectorEditorMetaControlShiftSet.has(input.key) || callback();
        },
        true,
      );
    }
    InspectorEditorEvery = (items?: Dynamic, items2?: Dynamic): Dynamic =>
      items.length === items2.length &&
      items.every(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          input === items2[options],
      );
    InspectorEditorKeys = (input?: Dynamic, options: Dynamic = true): Dynamic =>
      new Set(
        Object.keys(input ?? {}).filter(
          (input2?: Dynamic): Dynamic =>
            !(
              options &&
              runtime.PropertiesInspectorFieldNameComponentFromSet.has(input2)
            ) && (0, runtime.isEditablePropMetadata)(input?.[input2]),
        ),
      );
    InspectorEditorSubscribers_3 = new Set();
    InspectorEditorReplace = (input?: Dynamic): Dynamic =>
      input.replace(
        /-([a-z])/g,
        (input2?: Dynamic, options?: Dynamic): Dynamic => options.toUpperCase(),
      );
    InspectorEditorFontFamilyFontWeightFontSizeSet = new Set([
      "font-family",
      "font-weight",
      "font-size",
      "line-height",
      "letter-spacing",
    ]);
    InspectorEditorSubscribers_4 = new Set([
      "color",
      "font-size",
      "font-weight",
      "font",
      "background",
      "background-color",
      "background-image",
      "background-clip",
      "-webkit-background-clip",
      "opacity",
      "filter",
      "backdrop-filter",
      "mix-blend-mode",
    ]);
    InspectorEditorResolvedValue_2 = runtime.HostValue + "followed";
    InspectorEditorPropLabelSpecConfig = {
      prop: "background",
      label: "Background",
      spec: {
        ...runtime.InspectorPropertySchemaItems_2.find(
          (input?: Dynamic): Dynamic => input.prop === "background",
        ),
        label: "Background",
      },
      value: null,
    };
    InspectorEditorLabel_2 = "Select just one element to copy it as a PNG";
    InspectorEditorLabel_3 = "Select just one element to copy it as an SVG";
    InspectorEditorLabel_4 =
      "Sized by its content \u2014 double-click it to edit";
    inspectorSingleSelectionMessage =
      "One page at the frame\u2019s size while the content fits the frame and the frame fits a sheet; Letter/A4 pages beyond that, and a PNG keeps its full length\u2014for an artboard that fills the window and scrolls";
  };
}
