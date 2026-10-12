/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardPictures(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardPicturesObjectFitObjectPositionOpacityValues: Dynamic;
  var ClipboardPicturesPattern: Dynamic;
  var ClipboardPicturesJoin: Dynamic;
  function isSafePictureShadow(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic =>
        Number(input2) >= runtime.StyleSchemaShadowXYBlurConfig[options].min &&
        Number(input2) <= runtime.StyleSchemaShadowXYBlurConfig[options].max,
      value: Dynamic = ClipboardPicturesPattern.exec(input);
    return (
      value !== null &&
      callback(value[1], "x") &&
      callback(value[2], "y") &&
      callback(value[3], "blur") &&
      callback(value[4], "spread") &&
      (0, runtime.validateStyleColor)(value[5]) !== undefined
    );
  }
  function normalizeClipboardPictureCss(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let { css: spec, ...spec2 }: Dynamic = input.spec;
    if (options || spec === undefined)
      return {
        picture: input,
        plain: false,
      };
    let state: Dynamic = {};
    for (let value3 of ClipboardPicturesObjectFitObjectPositionOpacityValues as Dynamic)
      spec[value3] !== undefined && (state[value3] = spec[value3]);
    for (let value3 of ["background", "background-color"] as Dynamic)
      spec[value3] !== undefined &&
        (0, runtime.validateStyleColor)(spec[value3]) !== undefined &&
        (state[value3] = spec[value3]);
    let value: Dynamic = ClipboardPicturesJoin(spec["box-shadow"] ?? "");
    value !== "" && (state["box-shadow"] = value);
    let value2: Dynamic =
      Object.keys(state).length < Object.keys(spec).length ||
      state["box-shadow"] !== spec["box-shadow"];
    return {
      picture: {
        ...input,
        spec:
          Object.keys(state).length > 0
            ? {
                ...spec2,
                css: state,
              }
            : spec2,
      },
      plain: value2,
    };
  }
  function parseAnnotationClipboard(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input === null) return null;
    let value: Dynamic = input,
      value2: Dynamic = (0, runtime.ClipboardStateHandler)(value.leftOut),
      value3: Dynamic = Math.min(
        (0, runtime.ClipboardStateHandler)(value.videos),
        value2,
      ),
      value4: Dynamic = Array.isArray(value.annotations)
        ? value.annotations
        : [];
    if (value4.length > runtime.PlatformFileContentLimit_5) return null;
    let index: Dynamic = 0,
      index2: Dynamic = 0,
      index3: Dynamic = 0,
      values: Dynamic = new Set(),
      values2: Dynamic = new Set(),
      items: Dynamic = [],
      items2: Dynamic = [];
    for (let [value7, value8] of value4.entries() as Dynamic)
      try {
        if (typeof value8 != "object" || value8 === null) continue;
        let { spec: value9, dx: value10, dy: value11 }: Dynamic = value8;
        if (
          typeof value9 != "object" ||
          value9 === null ||
          Array.isArray(value9)
        )
          continue;
        let value12: Dynamic = value9,
          value13: Dynamic = (0, runtime.ClipboardAnnotationsIncludes)(
            Object.hasOwn(value12, "kind") ? value12.kind : undefined,
          );
        if (
          value13 === "image" &&
          (index3++,
          Object.hasOwn(value12, "video") ||
            typeof value12.src != "string" ||
            (0, runtime.ClipboardAnnotationsTest_2)(value12.src) !==
              value12.src)
        )
          continue;
        let value14: Dynamic =
          value13 === null || values.has(value12.id)
            ? null
            : (0, runtime.normalizeClipboardAnnotation)(
                value12,
                value13 === "image",
              );
        if (value14 === null) continue;
        values.add(value12.id);
        let value15: Dynamic = JSON.stringify({
          annotations: [value14],
        });
        if (
          (index += value15.length) >
          runtime.ClipboardAnnotationsResolvedValue_3
        )
          return null;
        if (value15.length > runtime.ClipboardAnnotationsResolvedValue)
          continue;
        let value16: Dynamic = (0, runtime.parseCanvasMetadata)(value15, {})
          .annotations?.[0];
        if (
          value16 === undefined ||
          (value16.kind ?? "note") !== value13 ||
          values2.has(value16.id)
        )
          continue;
        if (
          (index2 += (0, runtime.ClipboardAnnotationsGetLength)(value16)) >
          runtime.ClipboardAnnotationsResolvedValue_2
        )
          return null;
        values2.add(value16.id);
        let value17: Dynamic = (0, runtime.annotationVisibleBounds)(value16),
          state: Dynamic = {
            dx: (0, runtime.ClipboardArtboardsMax)(
              value10,
              -runtime.ClipboardArtboardsConstant_4,
            ),
            dy: (0, runtime.ClipboardArtboardsMax)(
              value11,
              -runtime.ClipboardArtboardsConstant_4,
            ),
            w: value17.w,
            h: value17.h,
            order: value7,
          };
        if (value16.kind === "image") {
          let {
            src: value18,
            video: value19,
            page: value20,
            ...value21
          }: Dynamic = value16;
          items2.push({
            spec: value21,
            asset: value18,
            ...state,
          });
        } else
          items.push({
            spec: value16,
            ...state,
          });
      } catch {
        continue;
      }
    let value5: Dynamic = index3 - items2.length,
      value6: Dynamic = value4.length - items.length - items2.length - value5;
    return items.length > 0 || items2.length > 0 || value5 > 0 || value2 > 0
      ? {
          entries: items,
          pictures: items2,
          leftOut: value2,
          videos: value3,
          unread: value6,
          unreadPictures: value5,
        }
      : null;
  }
  function clipboardPictureEntries(items?: Dynamic): Dynamic {
    let value: Dynamic = items.filter(
      (input?: Dynamic): Dynamic =>
        (0, runtime.ClipboardAnnotationsIncludes_2)(input.spec),
    );
    return {
      entries: value,
      shapes: items.length - value.length,
    };
  }
  bindRuntimeValue(
    runtime,
    "ClipboardPicturesObjectFitObjectPositionOpacityValues",
    () => ClipboardPicturesObjectFitObjectPositionOpacityValues,
    (value) => {
      ClipboardPicturesObjectFitObjectPositionOpacityValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardPicturesPattern",
    () => ClipboardPicturesPattern,
    (value) => {
      ClipboardPicturesPattern = value;
    },
  );
  bindRuntimeValue(runtime, "isSafePictureShadow", () => isSafePictureShadow);
  bindRuntimeValue(
    runtime,
    "ClipboardPicturesJoin",
    () => ClipboardPicturesJoin,
    (value) => {
      ClipboardPicturesJoin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeClipboardPictureCss",
    () => normalizeClipboardPictureCss,
  );
  bindRuntimeValue(
    runtime,
    "parseAnnotationClipboard",
    () => parseAnnotationClipboard,
  );
  bindRuntimeValue(
    runtime,
    "clipboardPictureEntries",
    () => clipboardPictureEntries,
  );
  return () => {
    ClipboardPicturesObjectFitObjectPositionOpacityValues = [
      "object-fit",
      "object-position",
      "opacity",
      "border-radius",
      "border-top-left-radius",
      "border-top-right-radius",
      "border-bottom-right-radius",
      "border-bottom-left-radius",
      "border-style",
      "border-color",
      "border-width",
      "border-top-width",
      "border-right-width",
      "border-bottom-width",
      "border-left-width",
    ];
    ClipboardPicturesPattern =
      /^(-?[\d.]{1,8})px (-?[\d.]{1,8})px ([\d.]{1,8})px (-?[\d.]{1,8})px (.{1,64})$/;
    ClipboardPicturesJoin = (input?: Dynamic): Dynamic =>
      input
        .split(/,\s*(?![^(]*\))/)
        .filter(isSafePictureShadow)
        .slice(0, runtime.StyleSchemaValuesLimit)
        .join(", ");
  };
}
