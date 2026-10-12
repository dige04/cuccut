/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCommentsAnchorCodec(
  runtime: RuntimeBindings,
): () => void {
  var react_bB: Dynamic;
  var reactDOM_idn: Dynamic;
  var jsx_sdn: Dynamic;
  var react_YEt: Dynamic;
  var anchorRootIdPattern: Dynamic;
  var anchorElementPathPattern: Dynamic;
  var anchorPayloadPattern: Dynamic;
  var anchorTemplateIdPattern: Dynamic;
  var anchorFingerprintPattern: Dynamic;
  var anchorFileFingerprintPattern: Dynamic;
  var anchorPagePattern: Dynamic;
  var anchorAreaReferencePattern: Dynamic;
  var encodeAnchorFraction: Dynamic;
  var decodeAnchorFraction: Dynamic;
  var maxBase36AnchorCoordinate: Dynamic;
  var encodeBase36AnchorCoordinate: Dynamic;
  var encodeSignedAnchorCoordinate: Dynamic;
  var decodeSignedAnchorCoordinate: Dynamic;
  var encodeAnchorTemplatePath: Dynamic;
  var encodeAnchorPayloadSelector: Dynamic;
  var encodeAnchorAreaPercent: Dynamic;
  var encodeAnchorArea: Dynamic;
  var decodeAnchorArea: Dynamic;
  var encodeAnchorCoverage: Dynamic;
  function stableAnchorHash(value?: Dynamic): Dynamic {
    let lowHash: Dynamic = -559038737,
      highHash: Dynamic = 1103547991;
    for (let index: Dynamic = 0; index < value.length; index++) {
      let value2: Dynamic = value.charCodeAt(index);
      lowHash = Math.imul(lowHash ^ value2, 2654435761);
      highHash = Math.imul(highHash ^ value2, 1597334677);
    }
    lowHash =
      Math.imul(lowHash ^ (lowHash >>> 16), 2246822507) ^
      Math.imul(highHash ^ (highHash >>> 13), 3266489909);
    highHash =
      Math.imul(highHash ^ (highHash >>> 16), 2246822507) ^
      Math.imul(lowHash ^ (lowHash >>> 13), 3266489909);
    return (4294967296 * (2097151 & highHash) + (lowHash >>> 0))
      .toString(16)
      .padStart(14, "0")
      .slice(-12);
  }
  function isValidAnchorElementPath(path?: Dynamic): Dynamic {
    let value: Dynamic = path.split(" > ");
    return value.length === 0 || value.length > 8
      ? false
      : value.every(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            (anchorElementPathPattern.test(input) &&
              !anchorPayloadPattern.test(input) &&
              !anchorTemplateIdPattern.test(input) &&
              !anchorFileFingerprintPattern.test(input) &&
              !anchorPagePattern.test(input) &&
              !anchorAreaReferencePattern.test(input)) ||
            (options === 0 && anchorRootIdPattern.test(input)),
        );
  }
  function serializeDesignCommentAnchor(anchor?: Dynamic): Dynamic {
    let value: Dynamic;
    if (anchor.kind === "el") {
      if (!isValidAnchorElementPath(anchor.path)) return null;
      value =
        anchor.path +
        " > " +
        encodeAnchorTemplatePath(anchor.path, anchor.tid, anchor.fp) +
        encodeAnchorPayloadSelector(
          "e",
          stableAnchorHash(anchor.file) +
            encodeAnchorFraction(anchor.fx) +
            encodeAnchorFraction(anchor.fy),
        );
    } else if (anchor.kind === "artboard")
      value =
        "px" in anchor
          ? encodeAnchorPayloadSelector(
              "d",
              stableAnchorHash(anchor.file) +
                encodeBase36AnchorCoordinate(anchor.px) +
                encodeBase36AnchorCoordinate(anchor.py),
            )
          : encodeAnchorPayloadSelector(
              "a",
              stableAnchorHash(anchor.file) +
                encodeAnchorFraction(anchor.fx) +
                encodeAnchorFraction(anchor.fy),
            );
    else if (anchor.kind === "note")
      value = encodeAnchorPayloadSelector(
        "n",
        stableAnchorHash(anchor.id) +
          (anchor.fx != null && anchor.fy != null
            ? encodeAnchorFraction(anchor.fx) + encodeAnchorFraction(anchor.fy)
            : ""),
      );
    else if (anchor.kind === "notearea")
      value = encodeAnchorPayloadSelector(
        "o",
        stableAnchorHash(anchor.id) + encodeAnchorArea(anchor.box),
      );
    else if (anchor.kind === "canvas")
      value =
        "dcp" +
        stableAnchorHash(anchor.page) +
        ":nth-of-type(1) > " +
        encodeAnchorPayloadSelector(
          "c",
          encodeSignedAnchorCoordinate(anchor.x) +
            encodeSignedAnchorCoordinate(anchor.y),
        );
    else if (anchor.kind === "area") {
      let text: Dynamic = "";
      if (anchor.path != null) {
        if (!isValidAnchorElementPath(anchor.path)) return null;
        text =
          anchor.path +
          " > " +
          encodeAnchorTemplatePath(anchor.path, anchor.tid, anchor.fp);
      }
      value =
        text +
        encodeAnchorPayloadSelector(
          "g",
          stableAnchorHash(anchor.file) + encodeAnchorArea(anchor.box),
        );
    } else {
      if (anchor.boards.length === 0 || anchor.boards.length > 7) return null;
      let value2: Dynamic = anchor.boards
        .map(
          (input?: Dynamic): Dynamic =>
            "dcr" +
            stableAnchorHash(input.file) +
            encodeAnchorCoverage(input.cov) +
            ":nth-of-type(1)",
        )
        .sort();
      value = [
        "dcp" + stableAnchorHash(anchor.page) + ":nth-of-type(1)",
        ...value2,
        encodeAnchorPayloadSelector("b", encodeAnchorArea(anchor.box)),
      ].join(" > ");
    }
    return value
      .split(" > ")
      .every(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          anchorElementPathPattern.test(input) ||
          (options === 0 && anchorRootIdPattern.test(input)),
      ) &&
      value.length <= 1024 &&
      value.split(" > ").length <= 10
      ? value
      : null;
  }
  function parseDesignCommentAnchor(serializedAnchor?: Dynamic): Dynamic {
    if (
      typeof serializedAnchor != "string" ||
      serializedAnchor === "" ||
      serializedAnchor.length > 1024
    )
      return null;
    let value: Dynamic = serializedAnchor.split(" > ");
    if (value.length > 10) return null;
    let value2: Dynamic = anchorPayloadPattern.exec(
      value[value.length - 1] ?? "",
    );
    if (!value2 || Number(value2[3]) !== 1) return null;
    let value3: Dynamic = value2[1],
      value4: Dynamic = value2[2] ?? "",
      value5: Dynamic = value.slice(0, -1),
      value6: Dynamic =
        value3 === "e" || value3 === "g"
          ? anchorTemplateIdPattern.exec(value5[value5.length - 1] ?? "")
          : null,
      value7: Dynamic = value6 ? Number(value6[1]) - 1 : null;
    value6 && (value5 = value5.slice(0, -1));
    let state: Dynamic = {};
    for (; value6; ) {
      let value12: Dynamic = anchorFileFingerprintPattern.exec(
        value5[value5.length - 1] ?? "",
      );
      if (!value12) break;
      value5 = value5.slice(0, -1);
      state.fp == null &&
        anchorFingerprintPattern.test(value12[1].slice(0, 8)) &&
        (state = {
          fp: value12[1].slice(0, 8),
        });
    }
    let value8: Dynamic = value5.join(" > ");
    if (value3 === "g") {
      let value12: Dynamic = /^([0-9a-f]{12})(\d{8}[0-3]?)$/.exec(value4),
        value13: Dynamic = value12 ? decodeAnchorArea(value12[2]) : null;
      return !value12 ||
        !value13 ||
        (value8 === "" && value6) ||
        (value8 !== "" && !isValidAnchorElementPath(value8))
        ? null
        : {
            kind: "area",
            fileHash: value12[1],
            path: value8 === "" ? null : value8,
            tid: value8 === "" ? null : value7,
            ...state,
            box: value13,
          };
    }
    if (value3 === "b") {
      let value12: Dynamic = decodeAnchorArea(value4),
        value13: Dynamic = anchorPagePattern.exec(value5[0] ?? "");
      if (!value12 || !value13 || value5.length < 2 || value5.length > 8)
        return null;
      let items: Dynamic = [],
        text: Dynamic = "";
      for (let value14 of value5.slice(1) as Dynamic) {
        let value15: Dynamic = anchorAreaReferencePattern.exec(value14);
        if (!value15 || value14 <= text) return null;
        text = value14;
        items.push({
          fileHash: value15[1],
          cov: value15[2] === "9" ? 1 : Number(value15[2]) / 9,
        });
      }
      return {
        kind: "boards",
        pageHash: value13[1],
        boards: items,
        box: value12,
      };
    }
    if (value3 === "e" || value3 === "a") {
      let value12: Dynamic = /^([0-9a-f]{12})(\d{4})(\d{4})$/.exec(value4);
      if (!value12) return null;
      let [, value13, value14, value15]: Dynamic = value12;
      return value3 === "a"
        ? value8 === ""
          ? {
              kind: "artboard",
              fileHash: value13,
              fx: decodeAnchorFraction(value14),
              fy: decodeAnchorFraction(value15),
            }
          : null
        : value8 === "" || !isValidAnchorElementPath(value8)
          ? null
          : {
              kind: "el",
              fileHash: value13,
              path: value8,
              tid: value7,
              ...state,
              fx: decodeAnchorFraction(value14),
              fy: decodeAnchorFraction(value15),
            };
    }
    if (value3 === "d") {
      let value12: Dynamic =
        value8 === ""
          ? /^([0-9a-f]{12})([0-9a-z]{4})([0-9a-z]{4})$/.exec(value4)
          : null;
      return value12
        ? {
            kind: "artboard",
            fileHash: value12[1],
            px: parseInt(value12[2], 36),
            py: parseInt(value12[3], 36),
          }
        : null;
    }
    if (value3 === "o") {
      let value12: Dynamic =
          value8 === "" ? /^([0-9a-f]{12})(\d{8}[0-3]?)$/.exec(value4) : null,
        value13: Dynamic = value12 ? decodeAnchorArea(value12[2]) : null;
      return value12 && value13
        ? {
            kind: "notearea",
            idHash: value12[1],
            box: value13,
          }
        : null;
    }
    if (value3 === "n") {
      let value12: Dynamic =
        value8 === ""
          ? /^([0-9a-f]{12})(?:(\d{4})(\d{4}))?$/.exec(value4)
          : null;
      return value12
        ? value12[2] != null && value12[3] != null
          ? {
              kind: "note",
              idHash: value12[1],
              fx: decodeAnchorFraction(value12[2]),
              fy: decodeAnchorFraction(value12[3]),
            }
          : {
              kind: "note",
              idHash: value12[1],
            }
        : null;
    }
    let value9: Dynamic =
        value5.length === 1 ? anchorPagePattern.exec(value5[0]) : null,
      value10: Dynamic = decodeSignedAnchorCoordinate(value4.slice(0, 8)),
      value11: Dynamic = decodeSignedAnchorCoordinate(value4.slice(8));
    return value9 && value10 != null && value11 != null && value4.length === 16
      ? {
          kind: "canvas",
          pageHash: value9[1],
          x: value10,
          y: value11,
        }
      : null;
  }
  bindRuntimeValue(
    runtime,
    "react_bB",
    () => react_bB,
    (value) => {
      react_bB = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOM_idn",
    () => reactDOM_idn,
    (value) => {
      reactDOM_idn = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_sdn",
    () => jsx_sdn,
    (value) => {
      jsx_sdn = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "react_YEt",
    () => react_YEt,
    (value) => {
      react_YEt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anchorRootIdPattern",
    () => anchorRootIdPattern,
    (value) => {
      anchorRootIdPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anchorElementPathPattern",
    () => anchorElementPathPattern,
    (value) => {
      anchorElementPathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anchorPayloadPattern",
    () => anchorPayloadPattern,
    (value) => {
      anchorPayloadPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anchorTemplateIdPattern",
    () => anchorTemplateIdPattern,
    (value) => {
      anchorTemplateIdPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anchorFingerprintPattern",
    () => anchorFingerprintPattern,
    (value) => {
      anchorFingerprintPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anchorFileFingerprintPattern",
    () => anchorFileFingerprintPattern,
    (value) => {
      anchorFileFingerprintPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anchorPagePattern",
    () => anchorPagePattern,
    (value) => {
      anchorPagePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anchorAreaReferencePattern",
    () => anchorAreaReferencePattern,
    (value) => {
      anchorAreaReferencePattern = value;
    },
  );
  bindRuntimeValue(runtime, "stableAnchorHash", () => stableAnchorHash);
  bindRuntimeValue(
    runtime,
    "encodeAnchorFraction",
    () => encodeAnchorFraction,
    (value) => {
      encodeAnchorFraction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeAnchorFraction",
    () => decodeAnchorFraction,
    (value) => {
      decodeAnchorFraction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxBase36AnchorCoordinate",
    () => maxBase36AnchorCoordinate,
    (value) => {
      maxBase36AnchorCoordinate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeBase36AnchorCoordinate",
    () => encodeBase36AnchorCoordinate,
    (value) => {
      encodeBase36AnchorCoordinate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeSignedAnchorCoordinate",
    () => encodeSignedAnchorCoordinate,
    (value) => {
      encodeSignedAnchorCoordinate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeSignedAnchorCoordinate",
    () => decodeSignedAnchorCoordinate,
    (value) => {
      decodeSignedAnchorCoordinate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeAnchorTemplatePath",
    () => encodeAnchorTemplatePath,
    (value) => {
      encodeAnchorTemplatePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeAnchorPayloadSelector",
    () => encodeAnchorPayloadSelector,
    (value) => {
      encodeAnchorPayloadSelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeAnchorAreaPercent",
    () => encodeAnchorAreaPercent,
    (value) => {
      encodeAnchorAreaPercent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeAnchorArea",
    () => encodeAnchorArea,
    (value) => {
      encodeAnchorArea = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeAnchorArea",
    () => decodeAnchorArea,
    (value) => {
      decodeAnchorArea = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeAnchorCoverage",
    () => encodeAnchorCoverage,
    (value) => {
      encodeAnchorCoverage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isValidAnchorElementPath",
    () => isValidAnchorElementPath,
  );
  bindRuntimeValue(
    runtime,
    "serializeDesignCommentAnchor",
    () => serializeDesignCommentAnchor,
  );
  bindRuntimeValue(
    runtime,
    "parseDesignCommentAnchor",
    () => parseDesignCommentAnchor,
  );
  return () => {
    react_bB = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    reactDOM_idn = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_dom)(),
      1,
    );
    (0, runtime.initializePlatformCdsIsland)();
    (0, runtime.initializeInspectorContext)();
    jsx_sdn = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    react_YEt = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    anchorRootIdPattern = /^#[A-Za-z_][A-Za-z0-9_-]{0,31}$/;
    anchorElementPathPattern =
      /^[a-z][a-z0-9-]{0,23}:nth-of-type\([1-9][0-9]{0,3}\)$/;
    anchorPayloadPattern =
      /^dc([eancgbod])([0-9a-z]*):nth-of-type\(([1-9][0-9]{0,3})\)$/;
    anchorTemplateIdPattern = /^dct:nth-of-type\(([1-9][0-9]{0,3})\)$/;
    anchorFingerprintPattern = /^x[0-9a-z]{7}$/;
    anchorFileFingerprintPattern = /^dcf([0-9a-z]{1,21}):nth-of-type\(1\)$/;
    anchorPagePattern = /^dcp([0-9a-f]{12}):nth-of-type\(1\)$/;
    anchorAreaReferencePattern = /^dcr([0-9a-f]{12})(\d):nth-of-type\(1\)$/;
    encodeAnchorFraction = (input?: Dynamic): Dynamic =>
      String(
        Math.round(
          Math.min(1, Math.max(0, Number.isFinite(input) ? input : 0.5)) * 9999,
        ),
      ).padStart(4, "0");
    decodeAnchorFraction = (input?: Dynamic): Dynamic => Number(input) / 9999;
    maxBase36AnchorCoordinate = 36 ** 4 - 1;
    encodeBase36AnchorCoordinate = (input?: Dynamic): Dynamic =>
      Math.round(
        Math.min(
          maxBase36AnchorCoordinate,
          Math.max(0, Number.isFinite(input) ? input : 0),
        ),
      )
        .toString(36)
        .padStart(4, "0");
    encodeSignedAnchorCoordinate = (input?: Dynamic): Dynamic => {
      let value: Dynamic = Math.round(
        Math.min(
          9999999,
          Math.max(-9999999, Number.isFinite(input) ? input : 0),
        ),
      );
      return (value < 0 ? "n" : "p") + String(Math.abs(value)).padStart(7, "0");
    };
    decodeSignedAnchorCoordinate = (input?: Dynamic): Dynamic => {
      let value: Dynamic = /^([np])(\d{7})$/.exec(input);
      return value ? (value[1] === "n" ? -1 : 1) * Number(value[2]) : null;
    };
    encodeAnchorTemplatePath = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic =>
      options != null &&
      Number.isInteger(options) &&
      options >= 0 &&
      options < 9999
        ? (typeof context == "string" &&
          anchorFingerprintPattern.test(context) &&
          input.split(" > ").length <= 7
            ? "dcf" + context + ":nth-of-type(1) > "
            : "") +
          "dct:nth-of-type(" +
          String(options + 1) +
          ") > "
        : "";
    encodeAnchorPayloadSelector = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => "dc" + input + options + ":nth-of-type(" + String(1) + ")";
    encodeAnchorAreaPercent = (input?: Dynamic, options?: Dynamic): Dynamic => {
      let value: Dynamic =
          Math.min(
            1,
            Math.max(0, Number.isFinite(input) ? input : options ? 1 : 0),
          ) * 100,
        value2: Dynamic = Math.min(
          99,
          Math.max(
            0,
            options ? Math.ceil(value - 1e-7) - 1 : Math.floor(value + 1e-7),
          ),
        );
      return String(value2).padStart(2, "0");
    };
    encodeAnchorArea = (input?: Dynamic): Dynamic => {
      let value: Dynamic = encodeAnchorAreaPercent(input.x0, false),
        value2: Dynamic = encodeAnchorAreaPercent(input.y0, false),
        value3: Dynamic = encodeAnchorAreaPercent(input.x1, true),
        value4: Dynamic = encodeAnchorAreaPercent(input.y1, true);
      return (
        value +
        value2 +
        (value3 < value ? value : value3) +
        (value4 < value2 ? value2 : value4) +
        (input.corner != null ? String(input.corner) : "")
      );
    };
    decodeAnchorArea = (input?: Dynamic): Dynamic => {
      let value: Dynamic = /^(\d\d)(\d\d)(\d\d)(\d\d)([0-3])?$/.exec(input);
      if (!value) return null;
      let [items, items2, items3, items4]: Dynamic = [
        Number(value[1]) / 100,
        Number(value[2]) / 100,
        (Number(value[3]) + 1) / 100,
        (Number(value[4]) + 1) / 100,
      ];
      return items3 > items && items4 > items2
        ? value[5] != null
          ? {
              x0: items,
              y0: items2,
              x1: items3,
              y1: items4,
              corner: Number(value[5]),
            }
          : {
              x0: items,
              y0: items2,
              x1: items3,
              y1: items4,
            }
        : null;
    };
    encodeAnchorCoverage = (input?: Dynamic): Dynamic => {
      let value: Dynamic = Number.isFinite(input) ? input : 0;
      return value >= 0.85
        ? "9"
        : String(Math.min(8, Math.max(0, Math.floor(value * 9 + 1e-9))));
    };
  };
}
