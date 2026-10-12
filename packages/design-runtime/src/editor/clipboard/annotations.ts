/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardAnnotations(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardAnnotationsWebpAvifPattern: Dynamic;
  var ClipboardAnnotationsDataImagePattern: Dynamic;
  var ClipboardAnnotationsHelmetScHelmetPattern: Dynamic;
  var ClipboardAnnotationsTest: Dynamic;
  var ClipboardAnnotationsResolvedValue: Dynamic;
  var ClipboardAnnotationsResolvedValue_2: Dynamic;
  var ClipboardAnnotationsResolvedValue_3: Dynamic;
  var ClipboardAnnotationsLimit: Dynamic;
  var ClipboardAnnotationsRectOvalLineValues: Dynamic;
  var ClipboardAnnotationsIncludes: Dynamic;
  var ClipboardAnnotationsGetLength: Dynamic;
  var ClipboardAnnotationsIncludes_2: Dynamic;
  var ClipboardAnnotationsTest_2: Dynamic;
  var ClipboardAnnotationsDataImagePattern_2: Dynamic;
  var ClipboardAnnotationsTest_3: Dynamic;
  var ClipboardAnnotationsIdKindXValues: Dynamic;
  var ClipboardAnnotationsSrcAltValues: Dynamic;
  var ClipboardAnnotationsLimit_2: Dynamic;
  var ClipboardAnnotationsCharCodeAt: Dynamic;
  function blankArtboardBody(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.blankDcDocument)(),
      value2: Dynamic = value.indexOf('<section class="stage"'),
      value3: Dynamic = value.indexOf("</section>", value2) + 10;
    if (value2 < 0 || value3 < value2)
      throw new Error("blank artboard source has no empty stage");
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        value.slice(0, value2) + input2 + value.slice(value3),
      value4: Dynamic = input.artboards.map(
        (input2?: Dynamic): Dynamic => ({
          ...input2,
          src: callback(
            ClipboardAnnotationsTest(
              (0, runtime.parseDcHtmlDocument)(input2.src)?.template ??
                input2.src,
            ),
          ),
        }),
      ),
      value5: Dynamic = Object.fromEntries(
        Object.entries(input.files).filter(
          ([input2]: Dynamic): Dynamic =>
            ClipboardAnnotationsWebpAvifPattern.test(input2),
        ),
      ),
      value6: Dynamic = Object.fromEntries(
        Object.entries(input.assets).filter(
          ([, input2]: Dynamic): Dynamic =>
            ClipboardAnnotationsDataImagePattern.test(input2),
        ),
      );
    return {
      v: 1,
      artboards: value4,
      files: value5,
      assets: value6,
    };
  }
  function annotationImageReferences(input?: Dynamic): Dynamic {
    return input
      .flatMap(
        (source?: Dynamic): Dynamic =>
          source.kind === "image" &&
          source.video === undefined &&
          ClipboardAnnotationsTest_2(source.src) !== null
            ? [source.src]
            : [],
      )
      .slice(0, ClipboardAnnotationsLimit);
  }
  function annotationClipboardEntries(
    items?: Dynamic,
    options?: Dynamic,
    context: Dynamic = runtime.ClipboardArtboardsResolvedValue,
    value: Dynamic = false,
    extra?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
        notRead: 0,
        cannot: 0,
        noRoom: 0,
        overCap: 0,
      },
      callback: Dynamic = (source?: Dynamic): Dynamic =>
        source.kind === "image" && source.video !== undefined,
      value2: Dynamic = items
        .filter(
          (source?: Dynamic): Dynamic =>
            ClipboardAnnotationsIncludes(source.kind) !== null &&
            !callback(source),
        )
        .map(({ page: page, ...props }: Dynamic): Dynamic => props),
      value3: Dynamic = value2.reduce(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          input + ClipboardAnnotationsGetLength(options2),
        0,
      ),
      value4: Dynamic =
        value3 > ClipboardAnnotationsResolvedValue_2 || value3 > context
          ? "budget"
          : value &&
              (0, runtime.ClipboardPastePlanningKind)(
                value2.filter(ClipboardAnnotationsIncludes_2),
              )
            ? "bounds"
            : false;
    if (value4)
      return {
        fields: {
          stayed: value2.length,
        },
        tooLarge: value4,
        assets: {},
        left: state,
      };
    let state2: Dynamic = {},
      value5: Dynamic = context - value3,
      length: Dynamic = Object.keys(extra?.assets ?? {}).length,
      index: Dynamic = 0,
      index2: Dynamic = 0,
      flag: Dynamic = false,
      value6: Dynamic = value2.flatMap((source?: Dynamic): Dynamic => {
        if (source.kind !== "image") return [source];
        let value11: Dynamic = ClipboardAnnotationsTest_2(source.src);
        if (value11 === null) state.cannot++;
        else if (value && ++index > ClipboardAnnotationsLimit) state.overCap++;
        else {
          let value12: Dynamic = extra?.assets[value11] ?? state2[value11],
            value13: Dynamic =
              value12 ??
              (!flag &&
              index2 < ClipboardAnnotationsLimit &&
              length + index2 < runtime.ClipboardArtboardsLimit
                ? extra?.read(source.src)
                : "");
          if (value13 === undefined) {
            state.notRead++;
            index2++;
          } else if (value13 === "") state.noRoom++;
          else if (
            value13.length > runtime.ClipboardArtboardsResolvedValue_2 ||
            !ClipboardAnnotationsTest_3(value13)
          )
            state.cannot++;
          else if (value12 === undefined && value13.length > value5) {
            state.noRoom++;
            flag = true;
          } else {
            value12 === undefined &&
              ((state2[value11] = value13),
              (value5 -= value13.length),
              length++);
            return [
              {
                ...source,
                src: value11,
              },
            ];
          }
        }
        return [];
      }),
      value7: Dynamic = items.length - value6.length,
      length2: Dynamic = items.filter(callback).length,
      value8: Dynamic = value6.map(runtime.annotationVisibleBounds),
      value9: Dynamic = options ?? {
        x: Math.min(...value8.map((input?: Dynamic): Dynamic => input.x)),
        y: Math.min(...value8.map((input?: Dynamic): Dynamic => input.y)),
      },
      value10: Dynamic = value6.map(
        (input?: Dynamic, options2?: Dynamic): Dynamic => ({
          spec: input,
          dx: value8[options2].x - value9.x,
          dy: value8[options2].y - value9.y,
        }),
      );
    return {
      fields: {
        ...(value10.length > 0
          ? {
              annotations: value10,
            }
          : {}),
        ...(value7 > 0
          ? {
              leftOut: value7,
            }
          : {}),
        ...(length2 > 0
          ? {
              videos: length2,
            }
          : {}),
      },
      tooLarge: false,
      assets: state2,
      left: state,
    };
  }
  function normalizeClipboardAnnotation(
    input?: Dynamic,
    options: Dynamic = false,
  ): Dynamic {
    let callback: Dynamic = (items?: Dynamic): Dynamic =>
        typeof items == "boolean" ||
        (typeof items == "number" && Number.isFinite(items)) ||
        (typeof items == "string" &&
          items.length <= ClipboardAnnotationsResolvedValue),
      state: Dynamic = {},
      index: Dynamic = 0;
    for (let value of (options
      ? [
          ...ClipboardAnnotationsIdKindXValues,
          ...ClipboardAnnotationsSrcAltValues,
        ]
      : ClipboardAnnotationsIdKindXValues) as Dynamic)
      if (Object.hasOwn(input, value)) {
        if (!callback(input[value])) return null;
        state[value] = input[value];
        typeof input[value] == "string" && (index += input[value].length);
      }
    if (index > ClipboardAnnotationsResolvedValue) return null;
    if (options && Object.hasOwn(input, "crop")) {
      let crop: Dynamic = input.crop;
      if (typeof crop != "object" || crop === null || Array.isArray(crop))
        return null;
      let [value, value2, value3]: Dynamic = ["zoom", "x", "y"].map(
        (input2?: Dynamic): Dynamic =>
          Object.hasOwn(crop, input2) ? crop[input2] : undefined,
      );
      if (
        ![value, value2, value3].every(
          (input2?: Dynamic): Dynamic =>
            typeof input2 == "number" && Number.isFinite(input2),
        )
      )
        return null;
      state.crop = {
        zoom: value,
        x: value2,
        y: value3,
      };
    }
    if (!Object.hasOwn(input, "css")) return state;
    let css: Dynamic = input.css;
    if (typeof css != "object" || css === null || Array.isArray(css))
      return null;
    let state2: Dynamic = {};
    for (let value of runtime.PlatformFileContentBackgroundBackgroundColorOpacityValues as Dynamic) {
      if (!Object.hasOwn(css, value)) continue;
      let value2: Dynamic = css[value];
      if (
        typeof value2 != "string" ||
        value2.length > ClipboardAnnotationsLimit_2 ||
        ClipboardAnnotationsCharCodeAt(value2)
      )
        return null;
      state2[value] = value2;
    }
    return {
      ...state,
      css: state2,
    };
  }
  function replaceClipboardPictureSource(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.PlatformFileContentTest_2)(options);
    return value === null
      ? null
      : {
          spec: {
            ...input.spec,
            src: value,
          },
          dx: input.dx,
          dy: input.dy,
          w: input.w,
          h: input.h,
          order: input.order,
        };
  }
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsWebpAvifPattern",
    () => ClipboardAnnotationsWebpAvifPattern,
    (value) => {
      ClipboardAnnotationsWebpAvifPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsDataImagePattern",
    () => ClipboardAnnotationsDataImagePattern,
    (value) => {
      ClipboardAnnotationsDataImagePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsHelmetScHelmetPattern",
    () => ClipboardAnnotationsHelmetScHelmetPattern,
    (value) => {
      ClipboardAnnotationsHelmetScHelmetPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsTest",
    () => ClipboardAnnotationsTest,
    (value) => {
      ClipboardAnnotationsTest = value;
    },
  );
  bindRuntimeValue(runtime, "blankArtboardBody", () => blankArtboardBody);
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsResolvedValue",
    () => ClipboardAnnotationsResolvedValue,
    (value) => {
      ClipboardAnnotationsResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsResolvedValue_2",
    () => ClipboardAnnotationsResolvedValue_2,
    (value) => {
      ClipboardAnnotationsResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsResolvedValue_3",
    () => ClipboardAnnotationsResolvedValue_3,
    (value) => {
      ClipboardAnnotationsResolvedValue_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsLimit",
    () => ClipboardAnnotationsLimit,
    (value) => {
      ClipboardAnnotationsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsRectOvalLineValues",
    () => ClipboardAnnotationsRectOvalLineValues,
    (value) => {
      ClipboardAnnotationsRectOvalLineValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsIncludes",
    () => ClipboardAnnotationsIncludes,
    (value) => {
      ClipboardAnnotationsIncludes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsGetLength",
    () => ClipboardAnnotationsGetLength,
    (value) => {
      ClipboardAnnotationsGetLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsIncludes_2",
    () => ClipboardAnnotationsIncludes_2,
    (value) => {
      ClipboardAnnotationsIncludes_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsTest_2",
    () => ClipboardAnnotationsTest_2,
    (value) => {
      ClipboardAnnotationsTest_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsDataImagePattern_2",
    () => ClipboardAnnotationsDataImagePattern_2,
    (value) => {
      ClipboardAnnotationsDataImagePattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsTest_3",
    () => ClipboardAnnotationsTest_3,
    (value) => {
      ClipboardAnnotationsTest_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "annotationImageReferences",
    () => annotationImageReferences,
  );
  bindRuntimeValue(
    runtime,
    "annotationClipboardEntries",
    () => annotationClipboardEntries,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsIdKindXValues",
    () => ClipboardAnnotationsIdKindXValues,
    (value) => {
      ClipboardAnnotationsIdKindXValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsSrcAltValues",
    () => ClipboardAnnotationsSrcAltValues,
    (value) => {
      ClipboardAnnotationsSrcAltValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsLimit_2",
    () => ClipboardAnnotationsLimit_2,
    (value) => {
      ClipboardAnnotationsLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardAnnotationsCharCodeAt",
    () => ClipboardAnnotationsCharCodeAt,
    (value) => {
      ClipboardAnnotationsCharCodeAt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeClipboardAnnotation",
    () => normalizeClipboardAnnotation,
  );
  bindRuntimeValue(
    runtime,
    "replaceClipboardPictureSource",
    () => replaceClipboardPictureSource,
  );
  return () => {
    ClipboardAnnotationsWebpAvifPattern = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
    ClipboardAnnotationsDataImagePattern =
      /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);/i;
    ClipboardAnnotationsHelmetScHelmetPattern =
      /<\/?(?:helmet|sc-helmet|x-import|dc-import|script)\b/i;
    ClipboardAnnotationsTest = (input?: Dynamic): Dynamic => {
      let value: Dynamic = (0, runtime.sanitizePastedHtml)(input);
      return ClipboardAnnotationsHelmetScHelmetPattern.test(value)
        ? (0, runtime.escapeHtml)(input)
        : value;
    };
    ClipboardAnnotationsResolvedValue = 64 * 1024;
    ClipboardAnnotationsResolvedValue_2 = 1024 * 1024;
    ClipboardAnnotationsResolvedValue_3 =
      2 * ClipboardAnnotationsResolvedValue_2;
    ClipboardAnnotationsLimit = 20;
    ClipboardAnnotationsRectOvalLineValues = [
      "rect",
      "oval",
      "line",
      "arrow",
      "pen",
    ];
    ClipboardAnnotationsIncludes = (input?: Dynamic): Dynamic =>
      input === undefined || input === "note"
        ? "note"
        : input === "title1" ||
            input === "image" ||
            ClipboardAnnotationsRectOvalLineValues.includes(input)
          ? input
          : null;
    ClipboardAnnotationsGetLength = (input?: Dynamic): Dynamic =>
      JSON.stringify(input).length;
    ClipboardAnnotationsIncludes_2 = (source?: Dynamic): Dynamic =>
      ["note", "title1"].includes(
        ClipboardAnnotationsIncludes(source.kind) ?? "",
      );
    ClipboardAnnotationsTest_2 = (input?: Dynamic): Dynamic =>
      /^\/?_blob\/[0-9a-f]{32}$/.test(input)
        ? input.replace(/^\//, "")
        : runtime.ClipboardArtboardsBlobBlobPattern.test(input)
          ? input
          : null;
    ClipboardAnnotationsDataImagePattern_2 =
      /^data:image\/(?:png|jpeg|gif|webp|avif|bmp);/;
    ClipboardAnnotationsTest_3 = (input?: Dynamic): Dynamic =>
      runtime.ClipboardArtboardsDataImagePattern.test(input) &&
      ClipboardAnnotationsDataImagePattern_2.test(input);
    ClipboardAnnotationsIdKindXValues = [
      "id",
      "kind",
      "x",
      "y",
      "w",
      "h",
      "x2",
      "y2",
      "headStart",
      "headEnd",
      "d",
      "text",
      "size",
      "bold",
      "italic",
      "color",
      "fill",
      "rotate",
      "flipX",
      "flipY",
      "maxW",
      "maxH",
    ];
    ClipboardAnnotationsSrcAltValues = ["src", "alt"];
    ClipboardAnnotationsLimit_2 = 1200;
    ClipboardAnnotationsCharCodeAt = (items?: Dynamic): Dynamic => {
      let index: Dynamic = 0;
      for (let index2: Dynamic = 0; index2 < items.length; index2++) {
        let value: Dynamic = items.charCodeAt(index2);
        index =
          (value >= 97 && value <= 122) ||
          (value >= 65 && value <= 90) ||
          value === 45
            ? index + 1
            : 0;
        if (index > 32) return true;
      }
      return false;
    };
  };
}
