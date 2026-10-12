/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInspectorColorPick(
  runtime: RuntimeBindings,
): () => void {
  var supportsDirectoryPicker: Dynamic;
  var supportsSpeechRecognition: Dynamic;
  var InspectorColorPickResolvedValue: Dynamic;
  var InspectorColorPickResolvedValue_2: Dynamic;
  var InspectorColorPickResolvedValue_3: Dynamic;
  var InspectorColorPickResolvedValue_4: Dynamic;
  var InspectorColorPickResolvedValue_5: Dynamic;
  var InspectorColorPickResolvedValue_6: Dynamic;
  var supportsScreenDetails: Dynamic;
  var supportsIntlSegmentation: Dynamic;
  function inspectSelectedColor(input?: Dynamic): Dynamic {
    let value: Dynamic = input.tag.toLowerCase(),
      value2: Dynamic = (0, runtime.parseStyleDeclarations)(
        input.authoredStyle,
      ),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        value2.find((input3?: Dynamic): Dynamic => input3.prop === input2)
          ?.value;
    if (
      runtime.svgShapeTags.has(value) ||
      runtime.InspectorPopoverPositionGUseSet.has(value)
    ) {
      let value6: Dynamic = (
        callback("stroke") ??
        input.computed.stroke ??
        ""
      ).toLowerCase();
      return runtime.svgShapeTags.has(value) &&
        value6 !== "" &&
        value6 !== "none"
        ? {
            prop: (0, runtime.formatPropertyKey)("stroke", callback),
          }
        : {
            prop: runtime.svgShapeTags.has(value)
              ? (0, runtime.formatPropertyKey)("fill", callback)
              : "fill",
          };
    }
    if (input.isTextEditable)
      return (0, runtime.hasTextBackgroundClip)(callback)
        ? {
            prop: "color",
            unset: ["background", ...runtime.InspectorPropertySchemaItems],
          }
        : {
            prop: "color",
          };
    let value3: Dynamic = callback("background") != null;
    if (value3 || callback("background-color") != null)
      return value3
        ? {
            ...runtime.InspectorPopoverPositionPropConfig,
            unset: ["background"],
          }
        : runtime.InspectorPopoverPositionPropConfig;
    if (value === "svg") {
      let value6: Dynamic = (
        callback("stroke") ??
        input.computed.stroke ??
        ""
      ).toLowerCase();
      if (value6 !== "" && value6 !== "none")
        return {
          prop: "stroke",
        };
    }
    let value4: Dynamic = input.computed.borderTopStyle ?? "",
      value5: Dynamic = input.computed.borderTopWidth ?? "";
    return (0, runtime.hasAuthoredAppearance)(input.authoredStyle) ||
      (value4 !== "" && value4 !== "none" && value5 !== "" && value5 !== "0px")
      ? {
          prop: "border-color",
        }
      : runtime.InspectorPopoverPositionPropConfig;
  }
  function supportsInspectorEyeDropper(): Dynamic {
    return typeof EyeDropper !== "undefined";
  }
  async function pickInspectorEyeDropper(): Promise<Dynamic> {
    if (typeof EyeDropper === "undefined") return null;
    try {
      return (await new EyeDropper().open()).sRGBHex;
    } catch {
      return null;
    }
  }
  bindRuntimeValue(runtime, "inspectSelectedColor", () => inspectSelectedColor);
  bindRuntimeValue(
    runtime,
    "supportsInspectorEyeDropper",
    () => supportsInspectorEyeDropper,
  );
  bindRuntimeValue(
    runtime,
    "pickInspectorEyeDropper",
    () => pickInspectorEyeDropper,
  );
  bindRuntimeValue(
    runtime,
    "supportsDirectoryPicker",
    () => supportsDirectoryPicker,
    (value) => {
      supportsDirectoryPicker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsSpeechRecognition",
    () => supportsSpeechRecognition,
    (value) => {
      supportsSpeechRecognition = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorColorPickResolvedValue",
    () => InspectorColorPickResolvedValue,
    (value) => {
      InspectorColorPickResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorColorPickResolvedValue_2",
    () => InspectorColorPickResolvedValue_2,
    (value) => {
      InspectorColorPickResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorColorPickResolvedValue_3",
    () => InspectorColorPickResolvedValue_3,
    (value) => {
      InspectorColorPickResolvedValue_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorColorPickResolvedValue_4",
    () => InspectorColorPickResolvedValue_4,
    (value) => {
      InspectorColorPickResolvedValue_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorColorPickResolvedValue_5",
    () => InspectorColorPickResolvedValue_5,
    (value) => {
      InspectorColorPickResolvedValue_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorColorPickResolvedValue_6",
    () => InspectorColorPickResolvedValue_6,
    (value) => {
      InspectorColorPickResolvedValue_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsScreenDetails",
    () => supportsScreenDetails,
    (value) => {
      supportsScreenDetails = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsIntlSegmentation",
    () => supportsIntlSegmentation,
    (value) => {
      supportsIntlSegmentation = value;
    },
  );
  return () => {
    supportsDirectoryPicker =
      typeof window !== "undefined" && "showDirectoryPicker" in window;
    supportsSpeechRecognition =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    InspectorColorPickResolvedValue =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" &&
          (navigator.maxTouchPoints ?? 0) > 1));
    InspectorColorPickResolvedValue_2 =
      typeof navigator !== "undefined" &&
      /^Mac/.test(navigator.platform) &&
      !InspectorColorPickResolvedValue;
    InspectorColorPickResolvedValue_3 =
      typeof window !== "undefined" &&
      typeof (window as Dynamic).matchMedia == "function" &&
      (window as Dynamic).matchMedia("(pointer: coarse)").matches;
    InspectorColorPickResolvedValue_4 =
      typeof window !== "undefined" &&
      (!!(window as Dynamic).__OMELETTE_DESKTOP__ ||
        (typeof navigator !== "undefined" &&
          /claude(nest|gov)?\//i.test(navigator.userAgent)));
    InspectorColorPickResolvedValue_5 =
      InspectorColorPickResolvedValue_4 &&
      typeof navigator !== "undefined" &&
      /claudenest\//i.test(navigator.userAgent);
    InspectorColorPickResolvedValue_6 =
      InspectorColorPickResolvedValue_4 &&
      typeof window !== "undefined" &&
      (window as Dynamic).self === (window as Dynamic).top;
    supportsScreenDetails =
      typeof window !== "undefined" && "getScreenDetails" in window;
    supportsIntlSegmentation = ((): Dynamic => {
      if (typeof Intl === "undefined" || typeof Intl.Segmenter != "function")
        return null;
      try {
        return new Intl.Segmenter(
          (typeof navigator !== "undefined" && navigator.language) || "en-US",
          {
            granularity: "word",
          },
        );
      } catch {
        try {
          return new Intl.Segmenter("en-US", {
            granularity: "word",
          });
        } catch {
          return null;
        }
      }
    })();
    (0, runtime.initializeEditorAttributeValidation)();
  };
}
