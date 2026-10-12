/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasFramePayloads(
  runtime: RuntimeBindings,
): () => void {
  var maxSelectionChromeItems: Dynamic;
  var selectionChromeCoordinateOverscan: Dynamic;
  var selectionChromePathPattern: Dynamic;
  var maxSelectionChromePathLength: Dynamic;
  var selectionChromeMinimumScale: Dynamic;
  function normalizeArtboardMeasuredSize(box?: Dynamic): Dynamic {
    let { w: value, h: value2 }: Dynamic = box ?? {};
    if (
      typeof value != "number" ||
      typeof value2 != "number" ||
      !Number.isFinite(value) ||
      !Number.isFinite(value2)
    )
      return null;
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      Math.min(
        runtime.PlatformFileContentLimit_6,
        Math.max(runtime.PlatformFileContentConstant_17, Math.ceil(input)),
      );
    return {
      w: callback(value),
      h: callback(value2),
    };
  }
  function parseImageCropDescriptor(value?: Dynamic): Dynamic {
    let value2: Dynamic = value;
    if (!value2 || typeof value2 != "object") return null;
    if (
      value2.off === "unloaded" ||
      value2.off === "turned" ||
      value2.off === "auto"
    )
      return {
        off: value2.off,
      };
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      typeof input == "number" && input >= 1 && input <= 1e5;
    if (
      !Number.isSafeInteger(value2.tid) ||
      !callback(value2.w) ||
      !callback(value2.h) ||
      value2.w / value2.h > 20 ||
      value2.h / value2.w > 20 ||
      !Array.isArray(value2.inset) ||
      value2.inset.length !== 4
    )
      return null;
    let value3: Dynamic = value2.inset.map(
      (input?: Dynamic): Dynamic =>
        typeof input == "number" && input >= 0 && input < 0.5 ? input : null,
    );
    if (value3.some((input?: Dynamic): Dynamic => input === null)) return null;
    let callback2: Dynamic = (items5?: Dynamic): Dynamic =>
        typeof items5 != "string" ? "" : items5.length <= 120 ? items5 : null,
      [items, items2]: Dynamic = [callback2(value2.box), callback2(value2.pos)];
    if (items === null || items2 === null)
      return {
        off: "custom",
      };
    let [items3, items4]: Dynamic = [
      (0, runtime.parseObjectClipPath)(items),
      (0, runtime.parseObjectPosition)(items2),
    ];
    if (items3 === undefined || (items4 === null && items2 !== ""))
      return {
        off: "custom",
      };
    let value4: Dynamic = callback2(value2.fit) ?? "",
      state: Dynamic = {
        fit: /^(fill|contain|cover|none|scale-down)$/.test(value4)
          ? value4
          : "fill",
        pos: items4,
        box: items3,
      };
    return {
      tid: value2.tid,
      w: value2.w,
      h: value2.h,
      inset: value3,
      view: state,
      ...(value2.video === true
        ? {
            video: true,
          }
        : {}),
      ...(value2.abs === true
        ? {
            abs: true,
          }
        : {}),
      ...(value2.autoW === true
        ? {
            autoW: true,
          }
        : {}),
      ...(value2.autoH === true
        ? {
            autoH: true,
          }
        : {}),
    };
  }
  function artboardContentSizeDescriptor(
    box?: Dynamic,
    rowHeight?: Dynamic,
    component?: Dynamic,
  ): Dynamic {
    return box
      ? {
          w: box.w,
          h: box.h - rowHeight,
          component: component,
        }
      : undefined;
  }
  function parseSelectionChromePayload(
    value?: Dynamic,
    viewport?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        typeof input == "number" && Number.isFinite(input) ? input : null,
      value2: Dynamic = selectionChromeCoordinateOverscan,
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        Math.max(-value2, Math.min(viewport.w + value2, input)),
      callback3: Dynamic = (input?: Dynamic): Dynamic =>
        Math.max(-value2, Math.min(viewport.h + value2, input)),
      value3: Dynamic = value,
      items: Dynamic = [],
      flag: Dynamic = false;
    if (Array.isArray(value3.rings)) {
      let index: Dynamic = 0;
      for (let value12 of value3.rings.slice(0, 256) as Dynamic) {
        let value13: Dynamic = callback(value12?.x),
          value14: Dynamic = callback(value12?.y),
          value15: Dynamic = callback(value12?.w),
          value16: Dynamic = callback(value12?.h);
        if (
          value13 == null ||
          value14 == null ||
          value15 == null ||
          value16 == null ||
          value15 <= 0 ||
          value16 <= 0
        )
          continue;
        let value17: Dynamic =
          value12.k === "hov"
            ? "hov"
            : value12.k === "grip" && !flag && options.gripless !== true
              ? "grip"
              : "sel";
        value17 === "grip" && (flag = true);
        let value18: Dynamic =
          value17 === "grip" && options.cropTid !== undefined
            ? parseImageCropDescriptor(value12.media)
            : null;
        value2 =
          value18 !== null &&
          "tid" in value18 &&
          value18.tid === options.cropTid
            ? maxSelectionChromeItems
            : selectionChromeCoordinateOverscan;
        let value19: Dynamic = callback(value12.rot),
          value20: Dynamic =
            value19 != null && value19 !== 0 && Math.abs(value19) < 7
              ? value19
              : 0,
          value21: Dynamic = Math.abs(Math.cos(value20)),
          value22: Dynamic = Math.abs(Math.sin(value20)),
          value23: Dynamic = value15 * value21 + value16 * value22,
          value24: Dynamic = value15 * value22 + value16 * value21;
        if (!Number.isFinite(value23 + value24)) continue;
        let value25: Dynamic = value13 + (value15 - value23) / 2,
          value26: Dynamic = value14 + (value16 - value24) / 2,
          value27: Dynamic = callback2(value25),
          value28: Dynamic = callback3(value26),
          value29: Dynamic = callback2(value25 + value23),
          value30: Dynamic = callback3(value26 + value24);
        if (value29 <= value27 || value30 <= value28) continue;
        let value31: Dynamic =
            value27 !== value25 ||
            value28 !== value26 ||
            value29 !== value25 + value23 ||
            value30 !== value26 + value24,
          value32: Dynamic = value31
            ? {
                x: value27,
                y: value28,
                w: value29 - value27,
                h: value30 - value28,
                k: value17 === "grip" ? "sel" : value17,
              }
            : {
                x: value13,
                y: value14,
                w: value15,
                h: value16,
                k: value17,
              };
        if (value12.k === "busy") {
          let value33: Dynamic = Math.max(0, value32.x),
            value34: Dynamic = Math.max(0, value32.y),
            value35: Dynamic =
              Math.min(viewport.w, value32.x + value32.w) - value33,
            value36: Dynamic =
              Math.min(viewport.h, value32.y + value32.h) - value34;
          if (
            (0, runtime.getHiddenPickerTags)().length === 0 ||
            value35 <= 0 ||
            value36 <= 0 ||
            ++index > 16
          )
            continue;
          let value37: Dynamic =
            value33 === value13 &&
            value34 === value14 &&
            value35 === value15 &&
            value36 === value16;
          items.push(
            value37 && value20 !== 0
              ? {
                  x: value13,
                  y: value14,
                  w: value15,
                  h: value16,
                  k: "busy",
                  rot: value20,
                }
              : {
                  x: value33,
                  y: value34,
                  w: value35,
                  h: value36,
                  k: "busy",
                },
          );
          continue;
        }
        value20 !== 0 && !value31 && (value32.rot = value20);
        value12.component === true && (value32.component = true);
        if (value32.k === "grip") {
          value12.rotatable === true && (value32.rotatable = true);
          value12.group === true &&
            ((value32.group = true),
            value12.noResize === true && (value32.noResize = true),
            (value12.noRotate === "none" || value12.noRotate === "layout") &&
              (value32.noRotate = value12.noRotate),
            value12.aspectLock === true && (value32.aspectLock = true));
          let value33: Dynamic = callback(value12.deg);
          value33 != null &&
            Math.abs(value33) <= 360 &&
            (value32.deg = Math.round(value33));
        }
        if (value12.k === "grip" && value17 === "grip") {
          let value33: Dynamic = parseImageCropDescriptor(value12.media);
          value33 && "off" in value33
            ? (value32.cropOff = value33.off)
            : value33 && value32.k === "grip"
              ? (value32.media = value33)
              : value33 && (value32.cropOff = "offboard");
        }
        items.push(value32);
      }
    }
    value2 = selectionChromeCoordinateOverscan;
    let stroke: Dynamic = value3.stroke,
      value4: Dynamic = callback(stroke?.x1),
      value5: Dynamic = callback(stroke?.y1),
      value6: Dynamic = callback(stroke?.x2),
      value7: Dynamic = callback(stroke?.y2),
      value8: Dynamic =
        value4 != null &&
        value5 != null &&
        value6 != null &&
        value7 != null &&
        callback2(value4) === value4 &&
        callback3(value5) === value5 &&
        callback2(value6) === value6 &&
        callback3(value7) === value7
          ? {
              x1: value4,
              y1: value5,
              x2: value6,
              y2: value7,
            }
          : null,
      value9: Dynamic = null,
      measure: Dynamic = value3.measure;
    if (
      measure &&
      Array.isArray(measure.lines) &&
      Array.isArray(measure.labels)
    ) {
      let items2: Dynamic = [];
      for (let value12 of measure.lines.slice(0, 12) as Dynamic) {
        let value13: Dynamic = callback(value12?.x1),
          value14: Dynamic = callback(value12?.y1),
          value15: Dynamic = callback(value12?.x2),
          value16: Dynamic = callback(value12?.y2);
        value13 == null ||
          value14 == null ||
          value15 == null ||
          value16 == null ||
          items2.push({
            x1: callback2(value13),
            y1: callback3(value14),
            x2: callback2(value15),
            y2: callback3(value16),
            ...(value12.ext === 1
              ? {
                  ext: 1,
                }
              : null),
          });
      }
      let items3: Dynamic = [];
      for (let value12 of measure.labels.slice(0, 4) as Dynamic) {
        let value13: Dynamic = callback(value12?.x),
          value14: Dynamic = callback(value12?.y);
        value13 == null ||
          value14 == null ||
          typeof value12.text != "string" ||
          !/^\d{1,6}$/.test(value12.text) ||
          items3.push({
            x: callback2(value13),
            y: callback3(value14),
            text: value12.text,
            axis: value12.axis === "y" ? "y" : "x",
          });
      }
      items2.length > 0 &&
        (value9 = {
          lines: items2,
          labels: items3,
        });
    }
    let value10: Dynamic = null;
    if (Array.isArray(value3.guides)) {
      let state: Dynamic = {};
      for (let value12 of value3.guides.slice(0, 4) as Dynamic) {
        let value13: Dynamic =
            value12?.axis === "x" ? "x" : value12?.axis === "y" ? "y" : null,
          value14: Dynamic = callback(value12?.pos);
        value13 == null ||
          value14 == null ||
          state[value13] ||
          value14 < 0 ||
          value14 > (value13 === "x" ? viewport.w : viewport.h) ||
          ((state[value13] = true),
          (value10 ??= []).push({
            axis: value13,
            pos: value14,
          }));
      }
    }
    let value11: Dynamic = null,
      pen: Dynamic = value3.pen;
    if (
      pen &&
      options.gripless !== true &&
      typeof pen.d == "string" &&
      pen.d.length <= maxSelectionChromePathLength &&
      selectionChromePathPattern.test(pen.d)
    ) {
      let [
        items2,
        items3,
        items4,
        items5,
        items6,
        items7,
        items8,
        items9,
        items10,
      ]: Dynamic = [
        callback(pen.tid),
        callback(pen.x),
        callback(pen.y),
        callback(pen.w),
        callback(pen.h),
        callback(pen.vbW),
        callback(pen.vbH),
        callback(pen.kx),
        callback(pen.ky),
      ];
      if (
        items2 != null &&
        items2 >= 0 &&
        items3 != null &&
        items4 != null &&
        items5 != null &&
        items6 != null &&
        items5 > 0 &&
        items6 > 0 &&
        items7 != null &&
        items8 != null &&
        items7 > 0 &&
        items8 > 0 &&
        items9 != null &&
        items10 != null &&
        items9 > 0 &&
        items10 > 0 &&
        items9 < 1e3 &&
        items10 < 1e3 &&
        callback2(items3) === items3 &&
        callback3(items4) === items4 &&
        callback2(items3 + items5) === items3 + items5 &&
        callback3(items4 + items6) === items4 + items6
      ) {
        let [items11, items12]: Dynamic = [items5 / items7, items6 / items8];
        (pen.d.match(/-?\d+(?:\.\d+)?/g) ?? [])
          .map(Number)
          .every(
            (input?: Dynamic, options2?: Dynamic): Dynamic =>
              options2 % 2 === 0
                ? callback2(items3 + input * items11) ===
                  items3 + input * items11
                : callback3(items4 + input * items12) ===
                  items4 + input * items12,
          ) &&
          (value11 = {
            tid: Math.trunc(items2),
            x: items3,
            y: items4,
            w: items5,
            h: items6,
            vbW: items7,
            vbH: items8,
            kx: items9,
            ky: items10,
            d: pen.d,
          });
      }
    }
    return {
      rings: items,
      stroke: value8,
      measure: value9,
      guides: value10,
      artboard: value3.artboard === true,
      pen: value11,
    };
  }
  bindRuntimeValue(
    runtime,
    "normalizeArtboardMeasuredSize",
    () => normalizeArtboardMeasuredSize,
  );
  bindRuntimeValue(
    runtime,
    "parseImageCropDescriptor",
    () => parseImageCropDescriptor,
  );
  bindRuntimeValue(
    runtime,
    "maxSelectionChromeItems",
    () => maxSelectionChromeItems,
    (value) => {
      maxSelectionChromeItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectionChromeCoordinateOverscan",
    () => selectionChromeCoordinateOverscan,
    (value) => {
      selectionChromeCoordinateOverscan = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectionChromePathPattern",
    () => selectionChromePathPattern,
    (value) => {
      selectionChromePathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxSelectionChromePathLength",
    () => maxSelectionChromePathLength,
    (value) => {
      maxSelectionChromePathLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardContentSizeDescriptor",
    () => artboardContentSizeDescriptor,
  );
  bindRuntimeValue(
    runtime,
    "parseSelectionChromePayload",
    () => parseSelectionChromePayload,
  );
  bindRuntimeValue(
    runtime,
    "selectionChromeMinimumScale",
    () => selectionChromeMinimumScale,
    (value) => {
      selectionChromeMinimumScale = value;
    },
  );
  return () => {
    maxSelectionChromeItems = 8192;
    selectionChromeCoordinateOverscan = 256;
    selectionChromePathPattern =
      /^M ?-?\d+(\.\d+)?[ ,]-?\d+(\.\d+)?( ?([ML] ?-?\d+(\.\d+)?[ ,]-?\d+(\.\d+)?|C ?-?\d+(\.\d+)?([ ,]-?\d+(\.\d+)?){5}))+$/;
    maxSelectionChromePathLength = 24e3;
    selectionChromeMinimumScale = 0.25;
  };
}
