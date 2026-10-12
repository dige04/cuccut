/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardLayoutSnapshots(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardLayoutSnapshotsScriptStyleXmpSet: Dynamic;
  var ClipboardLayoutSnapshotsLeftTopRightSet: Dynamic;
  var ClipboardLayoutSnapshotsPattern: Dynamic;
  var ClipboardLayoutSnapshotsMarginGridAreaConfig: Dynamic;
  var ClipboardLayoutSnapshotsBeforeAfterIntoSet: Dynamic;
  var ClipboardLayoutSnapshotsIsArray: Dynamic;
  var ClipboardLayoutSnapshotsHandler: Dynamic;
  var ClipboardLayoutSnapshotsPattern_2: Dynamic;
  var ClipboardLayoutSnapshotsStrokeStrokeWidthStrokeLinecapSet: Dynamic;
  function normalizeFrozenLayoutStyle(input?: Dynamic): Dynamic {
    let state: Dynamic = {};
    if (typeof input != "object" || input == null) return state;
    for (let [value, value2] of Object.entries(input) as Dynamic) {
      if (Object.hasOwn(ClipboardLayoutSnapshotsMarginGridAreaConfig, value)) {
        value2 === ClipboardLayoutSnapshotsMarginGridAreaConfig[value] &&
          (state[value] = value2);
        continue;
      }
      ClipboardLayoutSnapshotsLeftTopRightSet.has(value) &&
        (typeof value2 != "string" ||
          !ClipboardLayoutSnapshotsPattern.test(value2) ||
          ((value === "width" || value === "height") &&
            value2.startsWith("-")) ||
          (state[value] = value2));
    }
    return state;
  }
  function parsePastedElementRects(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set(),
      items: Dynamic = [];
    for (let value of input.slice(0, 500) as Dynamic) {
      if (value == null || typeof value != "object") continue;
      let tid: Dynamic = value.tid;
      if (!Number.isInteger(tid) || values.has(tid)) continue;
      let value2: Dynamic = normalizeFrozenLayoutStyle(value.absStyles);
      if (Object.keys(value2).length === 0) continue;
      values.add(tid);
      let freezeStyle: Dynamic = value.freezeStyle,
        value3: Dynamic =
          freezeStyle != null &&
          typeof freezeStyle == "object" &&
          !Array.isArray(freezeStyle)
            ? freezeStyle
            : undefined;
      items.push({
        tid: tid,
        absStyles: value2,
        fixed: value.fixed === true,
        ...(value3
          ? {
              freezeStyle: value3,
            }
          : {}),
      });
    }
    return items;
  }
  function parsePastedElementKinds(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set(),
      items: Dynamic = [];
    for (let value of input.slice(0, 500) as Dynamic) {
      let value2: Dynamic =
        value != null && typeof value == "object" ? value.tid : undefined;
      if (!Number.isInteger(value2) || value2 < 0 || values.has(value2))
        continue;
      values.add(value2);
      let freezeStyle: Dynamic = value.freezeStyle;
      items.push({
        tid: value2,
        freezeStyle:
          freezeStyle != null &&
          typeof freezeStyle == "object" &&
          !Array.isArray(freezeStyle)
            ? freezeStyle
            : undefined,
      });
    }
    return items;
  }
  function parseGroupLayoutSnapshot(input?: Dynamic): Dynamic {
    if (input == null || typeof input != "object") return;
    let value: Dynamic = input,
      value2: Dynamic = ClipboardLayoutSnapshotsHandler(value.parentTid);
    if (value2 === undefined) return;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof input2 == "number" && Number.isFinite(input2) ? input2 : 0,
      value3: Dynamic = Array.isArray(value.siblings)
        ? value.siblings.slice(0, 200).flatMap((input2?: Dynamic): Dynamic => {
            if (input2 == null || typeof input2 != "object") return [];
            let value4: Dynamic = input2;
            return Number.isInteger(value4.tid)
              ? [
                  {
                    tid: value4.tid,
                    left: callback(value4.left),
                    top: callback(value4.top),
                    w: callback(value4.w),
                    h: callback(value4.h),
                    static: value4.static === true,
                  },
                ]
              : [];
          })
        : [];
    return {
      parentTid: value2,
      parentStatic: value.parentStatic === true,
      w: callback(value.w),
      h: callback(value.h),
      siblings: value3,
    };
  }
  function parseElementMoveSnapshot(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (input == null || typeof input != "object") return null;
    let value: Dynamic = input;
    if (
      !Number.isInteger(value.tid) ||
      !options.includes(value.tid) ||
      value.alt === true
    )
      return null;
    let value2: Dynamic = ClipboardLayoutSnapshotsHandler(value.targetTid);
    if (
      value2 === undefined ||
      typeof value.position != "string" ||
      !ClipboardLayoutSnapshotsBeforeAfterIntoSet.has(value.position)
    )
      return null;
    let value3: Dynamic = value.absolute === true,
      value4: Dynamic = Array.isArray(value.followers)
        ? parsePastedElementRects(value.followers).filter(
            (input2?: Dynamic): Dynamic => options.includes(input2.tid),
          )
        : undefined,
      value5: Dynamic = Array.isArray(value.group)
        ? parsePastedElementKinds(value.group).filter(
            (input2?: Dynamic): Dynamic => options.includes(input2.tid),
          )
        : undefined;
    return {
      tid: value.tid,
      targetTid: value2,
      position: value.position,
      alt: value.alt === true,
      absolute: value3,
      ...(value.breakout === true
        ? {
            breakout: true,
          }
        : {}),
      ...(value.fixed === true
        ? {
            fixed: true,
          }
        : {}),
      ...(value.absStyles != null
        ? {
            absStyles: normalizeFrozenLayoutStyle(value.absStyles),
          }
        : {}),
      ...(value.parentNeedsPositioning === true
        ? {
            parentNeedsPositioning: true,
          }
        : {}),
      ...(value3 && value.flatten != null
        ? {
            flatten: parseGroupLayoutSnapshot(value.flatten),
          }
        : {}),
      ...(value4 && value4.length > 0
        ? {
            followers: value4,
          }
        : {}),
      ...(value5 && value5.length > 0
        ? {
            group: value5,
          }
        : {}),
      block: null,
      ...(value.clearPositioning === true
        ? {
            clearPositioning: true,
          }
        : {}),
      ...(ClipboardLayoutSnapshotsIsArray(value.freezeStyle)
        ? {
            freezeStyle: ClipboardLayoutSnapshotsIsArray(value.freezeStyle),
          }
        : {}),
    };
  }
  function parseGroupMoveSnapshot(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input == null || typeof input != "object") return null;
    let value: Dynamic = input,
      value2: Dynamic = ClipboardLayoutSnapshotsHandler(value.container);
    if (
      value2 === undefined ||
      !Array.isArray(value.members) ||
      value.members.length > 500
    )
      return null;
    let items: Dynamic = [],
      items2: Dynamic = [],
      values: Dynamic = new Set();
    for (let value3 of value.members as Dynamic) {
      if (value3 == null || typeof value3 != "object") continue;
      let value4: Dynamic = value3;
      if (
        !Number.isInteger(value4.tid) ||
        !options.includes(value4.tid) ||
        values.has(value4.tid)
      )
        continue;
      if (typeof value4.refused == "string") {
        values.add(value4.tid);
        items2.push(value4.tid);
        continue;
      }
      let value5: Dynamic = ClipboardLayoutSnapshotsHandler(value4.targetTid);
      if (
        value5 === undefined ||
        typeof value4.position != "string" ||
        !ClipboardLayoutSnapshotsBeforeAfterIntoSet.has(value4.position) ||
        (value4.position === "root-end" ? value5 !== null : value5 === null)
      )
        continue;
      let value6: Dynamic = value4.absolute === true;
      if (
        value6 &&
        value4.position !== "into" &&
        value4.position !== "root-end"
      )
        continue;
      let value7: Dynamic = value6
          ? normalizeFrozenLayoutStyle(value4.absStyles)
          : undefined,
        value8: Dynamic = value7
          ? Object.fromEntries(
              Object.entries(value7).filter(
                ([input2]: Dynamic): Dynamic =>
                  input2 === "left" ||
                  input2 === "top" ||
                  input2 === "width" ||
                  input2 === "height",
              ),
            )
          : undefined;
      (value6 && (!value8 || !("left" in value8) || !("top" in value8))) ||
        (values.add(value4.tid),
        items.push({
          tid: value4.tid,
          targetTid: value5,
          position: value4.position,
          absolute: value6,
          ...(value8
            ? {
                absStyles: value8,
              }
            : {}),
          ...(value4.parentNeedsPositioning === true && value5 !== null
            ? {
                parentNeedsPositioning: true,
              }
            : {}),
        }));
    }
    for (let value3 of options as Dynamic)
      values.has(value3) || items2.push(value3);
    return {
      container: value2,
      landing: items,
      refused: items2,
    };
  }
  function normalizePasteScale(input?: Dynamic): Dynamic {
    return input === undefined
      ? 1
      : typeof input == "number" &&
          Number.isFinite(input) &&
          input > 1e-4 &&
          input < 1e4
        ? input
        : null;
  }
  function normalizeSvgStrokeProperties(input?: Dynamic): Dynamic {
    let state: Dynamic = {};
    if (input == null || typeof input != "object") return state;
    for (let [value, value2] of Object.entries(input) as Dynamic)
      ClipboardLayoutSnapshotsStrokeStrokeWidthStrokeLinecapSet.has(value) &&
        typeof value2 == "string" &&
        value2.length <= 64 &&
        (/^(?![\s\S]*url\()[\w #(),.%\/-]+$/i.test(value2) ||
          /^url\((#[\w-]+|"#[\w-]+")\)$/.test(value2)) &&
        (state[value] = value2);
    return state;
  }
  function parseVectorElements(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    if (!Array.isArray(input)) return items;
    let values: Dynamic = new Set(),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof input2 == "number" &&
        Number.isFinite(input2) &&
        Math.abs(input2) < 1e6;
    for (let value of input.slice(0, 500) as Dynamic) {
      if (value == null || typeof value != "object") continue;
      let {
        tid: value2,
        styles: value3,
        angle: value4,
        stroke: value5,
        fixed: value6,
      }: Dynamic = value;
      if (!Number.isInteger(value2) || value2 < 0 || values.has(value2))
        continue;
      let state: Dynamic = {
        tid: value2,
      };
      if (typeof value3 == "object" && value3 != null) {
        let value7: Dynamic = normalizeFrozenLayoutStyle(value3),
          state2: Dynamic = {};
        for (let value8 of ["left", "top", "right", "bottom"] as Dynamic)
          value7[value8] !== undefined && (state2[value8] = value7[value8]);
        for (let value8 of ["width", "height"] as Dynamic) {
          let value9: Dynamic = value3[value8];
          typeof value9 == "string" &&
            ClipboardLayoutSnapshotsPattern_2.test(value9) &&
            parseFloat(value9) >= 1 &&
            (state2[value8] = value9);
        }
        state2.left !== undefined && delete state2.right;
        state2.top !== undefined && delete state2.bottom;
        Object.keys(state2).length > 0 && (state.styles = state2);
      }
      value6 === true && (state.fixed = true);
      typeof value4 == "number" &&
        Number.isFinite(value4) &&
        Math.abs(value4) <= 360 &&
        (state.angle = value4);
      if (typeof value5 == "object" && value5 != null) {
        let value7: Dynamic = value5,
          value8: Dynamic = normalizePasteScale(value7.unitScale);
        value8 != null &&
          callback(value7.left) &&
          callback(value7.top) &&
          callback(value7.width) &&
          callback(value7.height) &&
          typeof value7.d == "string" &&
          value7.d.length <= 256 &&
          /^[MLZE\d\s.,-]+$/i.test(value7.d) &&
          (state.stroke = {
            left: value7.left,
            top: value7.top,
            width: Math.max(1, value7.width),
            height: Math.max(1, value7.height),
            d: value7.d,
            isArrow: value7.isArrow === true,
            unitScale: value8,
            paint: normalizeSvgStrokeProperties(value7.paint),
            svgPaint: normalizeSvgStrokeProperties(value7.svgPaint),
          });
      }
      (state.styles || state.angle !== undefined || state.stroke) &&
        (values.add(state.tid), items.push(state));
    }
    return items;
  }
  function normalizeComputedStyleCarry(input?: Dynamic): Dynamic {
    let state: Dynamic = {};
    if (typeof input != "object" || input == null) return state;
    for (let [value, value2] of Object.entries(input) as Dynamic) {
      if (
        !/^(?:--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z0-9-]*)$/.test(value) ||
        (0, runtime.isUnsafeCssProperty)(value) ||
        runtime.ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(
          value,
        ) ||
        typeof value2 != "string"
      )
        continue;
      let value3: Dynamic = value2.trim();
      value3.length === 0 ||
        value3.length > 2048 ||
        /;|[\r\n]/.test(value3) ||
        /\\$/.test(value3) ||
        runtime.ClipboardHtmlSanitizationExpressionMozBindingPattern.test(
          (0, runtime.decodeCssEscapes)(value3).replace(
            /[\u0000\t\n\r\f]/g,
            "",
          ),
        ) ||
        runtime.ClipboardHtmlSanitizationAZPattern.test(
          (0, runtime.decodeCssEscapes)(
            (0, runtime.removeCssStrings)(value3),
          ).replace(/[\u0000\t\n\r\f]/g, ""),
        ) ||
        runtime.ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(
          value3,
        ) ||
        (state[value] = value3);
    }
    return state;
  }
  bindRuntimeValue(
    runtime,
    "ClipboardLayoutSnapshotsScriptStyleXmpSet",
    () => ClipboardLayoutSnapshotsScriptStyleXmpSet,
    (value) => {
      ClipboardLayoutSnapshotsScriptStyleXmpSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardLayoutSnapshotsLeftTopRightSet",
    () => ClipboardLayoutSnapshotsLeftTopRightSet,
    (value) => {
      ClipboardLayoutSnapshotsLeftTopRightSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardLayoutSnapshotsPattern",
    () => ClipboardLayoutSnapshotsPattern,
    (value) => {
      ClipboardLayoutSnapshotsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardLayoutSnapshotsMarginGridAreaConfig",
    () => ClipboardLayoutSnapshotsMarginGridAreaConfig,
    (value) => {
      ClipboardLayoutSnapshotsMarginGridAreaConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeFrozenLayoutStyle",
    () => normalizeFrozenLayoutStyle,
  );
  bindRuntimeValue(
    runtime,
    "parsePastedElementRects",
    () => parsePastedElementRects,
  );
  bindRuntimeValue(
    runtime,
    "parsePastedElementKinds",
    () => parsePastedElementKinds,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardLayoutSnapshotsBeforeAfterIntoSet",
    () => ClipboardLayoutSnapshotsBeforeAfterIntoSet,
    (value) => {
      ClipboardLayoutSnapshotsBeforeAfterIntoSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardLayoutSnapshotsIsArray",
    () => ClipboardLayoutSnapshotsIsArray,
    (value) => {
      ClipboardLayoutSnapshotsIsArray = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardLayoutSnapshotsHandler",
    () => ClipboardLayoutSnapshotsHandler,
    (value) => {
      ClipboardLayoutSnapshotsHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseGroupLayoutSnapshot",
    () => parseGroupLayoutSnapshot,
  );
  bindRuntimeValue(
    runtime,
    "parseElementMoveSnapshot",
    () => parseElementMoveSnapshot,
  );
  bindRuntimeValue(
    runtime,
    "parseGroupMoveSnapshot",
    () => parseGroupMoveSnapshot,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardLayoutSnapshotsPattern_2",
    () => ClipboardLayoutSnapshotsPattern_2,
    (value) => {
      ClipboardLayoutSnapshotsPattern_2 = value;
    },
  );
  bindRuntimeValue(runtime, "normalizePasteScale", () => normalizePasteScale);
  bindRuntimeValue(
    runtime,
    "ClipboardLayoutSnapshotsStrokeStrokeWidthStrokeLinecapSet",
    () => ClipboardLayoutSnapshotsStrokeStrokeWidthStrokeLinecapSet,
    (value) => {
      ClipboardLayoutSnapshotsStrokeStrokeWidthStrokeLinecapSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeSvgStrokeProperties",
    () => normalizeSvgStrokeProperties,
  );
  bindRuntimeValue(runtime, "parseVectorElements", () => parseVectorElements);
  bindRuntimeValue(
    runtime,
    "normalizeComputedStyleCarry",
    () => normalizeComputedStyleCarry,
  );
  return () => {
    ClipboardLayoutSnapshotsScriptStyleXmpSet = new Set([
      "script",
      "style",
      "xmp",
      "iframe",
      "noembed",
      "noframes",
      "plaintext",
      "noscript",
    ]);
    ClipboardLayoutSnapshotsLeftTopRightSet = new Set([
      "left",
      "top",
      "right",
      "bottom",
      "width",
      "height",
    ]);
    ClipboardLayoutSnapshotsPattern = /^-?\d{1,6}(?:\.\d{1,4})?px$/;
    ClipboardLayoutSnapshotsMarginGridAreaConfig = {
      margin: "0px",
      "grid-area": "auto",
    };
    ClipboardLayoutSnapshotsBeforeAfterIntoSet = new Set([
      "before",
      "after",
      "into",
      "root-end",
    ]);
    ClipboardLayoutSnapshotsIsArray = (input?: Dynamic): Dynamic =>
      input != null && typeof input == "object" && !Array.isArray(input)
        ? input
        : undefined;
    ClipboardLayoutSnapshotsHandler = (input?: Dynamic): Dynamic =>
      input == null
        ? null
        : Number.isInteger(input) && input >= 0 && input <= 1e6
          ? input
          : undefined;
    ClipboardLayoutSnapshotsPattern_2 = /^\d{1,6}(?:\.\d{1,4})?px$/;
    ClipboardLayoutSnapshotsStrokeStrokeWidthStrokeLinecapSet = new Set([
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-dasharray",
      "stroke-dashoffset",
      "stroke-opacity",
      "stroke-miterlimit",
      "vector-effect",
    ]);
  };
}
