/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfLinkAnnotations(
  runtime: RuntimeBindings,
): () => void {
  var PdfLinkAnnotationsUffefPattern: Dynamic;
  var PdfLinkAnnotationsLimit: Dynamic;
  var PdfLinkAnnotationsConstant: Dynamic;
  var PdfLinkAnnotationsConstant_2: Dynamic;
  var PdfLinkAnnotationsLimit_2: Dynamic;
  function needsInterwordSpace(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return input === "" ||
      options === "" ||
      /\s$/u.test(input) ||
      /^\s/u.test(options) ||
      (!context && /[\-\u00ad\u2010-\u2014]$/u.test(input))
      ? false
      : !(
          PdfLinkAnnotationsUffefPattern.test(input.slice(-1)) ||
          PdfLinkAnnotationsUffefPattern.test(options[0])
        );
  }
  function normalizePdfLink(items?: Dynamic): Dynamic {
    if (typeof items != "string" || items.length > PdfLinkAnnotationsLimit)
      return;
    let value: Dynamic = items.trim();
    if (!/^(?:https?:\/\/|mailto:)/i.test(value)) return;
    let value2: Dynamic;
    try {
      let value3: Dynamic = new URL(value);
      if (
        (value3.protocol !== "http:" &&
          value3.protocol !== "https:" &&
          value3.protocol !== "mailto:") ||
        value3.username !== "" ||
        value3.password !== "" ||
        (value3.protocol === "mailto:" && value3.pathname === "")
      )
        return;
      value2 = value3.href;
    } catch {
      return;
    }
    if (
      !(
        value2.length > PdfLinkAnnotationsLimit ||
        !/^[\x21-\x7e]+$/.test(value2)
      )
    )
      return value2;
  }
  function buildPdfLinkAnnotations(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
    argument?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [],
      items2: Dynamic = [];
    if (!Array.isArray(input))
      return {
        dicts: items,
        anchors: items2,
      };
    for (let value2 of input as Dynamic) {
      items.length >= value && extra();
      if (items.length >= Math.min(PdfLinkAnnotationsConstant, value)) break;
      if (typeof value2 != "object" || value2 === null) continue;
      let value3: Dynamic = normalizePdfLink(value2.uri);
      if (
        value3 === undefined ||
        !Number.isFinite(value2.xPt) ||
        !Number.isFinite(value2.yPt) ||
        !Number.isFinite(value2.widthPt) ||
        !Number.isFinite(value2.heightPt)
      )
        continue;
      let value4: Dynamic = Math.max(0, value2.xPt),
        value5: Dynamic = Math.max(0, value2.yPt),
        value6: Dynamic = Math.min(options, value2.xPt + value2.widthPt),
        value7: Dynamic = Math.min(context, value2.yPt + value2.heightPt);
      if (
        value6 - value4 < PdfLinkAnnotationsLimit_2 ||
        value7 - value5 < PdfLinkAnnotationsLimit_2
      )
        continue;
      let value8: Dynamic = value3.replace(/[\\()]/g, "\\$&"),
        value9: Dynamic =
          typeof value2.anchor == "number" &&
          Number.isInteger(value2.anchor) &&
          value2.anchor >= 0
            ? value2.anchor
            : undefined,
        value10: Dynamic =
          value9 !== undefined && argument !== undefined
            ? argument(value9)
            : undefined;
      items2.push(value9);
      items.push(
        "<< /Type /Annot /Subtype /Link /Rect [" +
          [value4, value5, value6, value7]
            .map(runtime.formatPdfNumber)
            .join(" ") +
          "] /Border [0 0 0] /H /N /F 4 /A << /Type /Action /S /URI /URI (" +
          value8 +
          ") >>" +
          (detail === undefined
            ? ""
            : " /StructParent " +
              String(detail + items.length) +
              " /Contents " +
              (value10 !== undefined
                ? (0, runtime.pdfStringOperand)(value10)
                : "(" + value8 + ")")) +
          " >>",
      );
    }
    return {
      dicts: items,
      anchors: items2,
    };
  }
  bindRuntimeValue(
    runtime,
    "PdfLinkAnnotationsUffefPattern",
    () => PdfLinkAnnotationsUffefPattern,
    (value) => {
      PdfLinkAnnotationsUffefPattern = value;
    },
  );
  bindRuntimeValue(runtime, "needsInterwordSpace", () => needsInterwordSpace);
  bindRuntimeValue(
    runtime,
    "PdfLinkAnnotationsLimit",
    () => PdfLinkAnnotationsLimit,
    (value) => {
      PdfLinkAnnotationsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfLinkAnnotationsConstant",
    () => PdfLinkAnnotationsConstant,
    (value) => {
      PdfLinkAnnotationsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfLinkAnnotationsConstant_2",
    () => PdfLinkAnnotationsConstant_2,
    (value) => {
      PdfLinkAnnotationsConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfLinkAnnotationsLimit_2",
    () => PdfLinkAnnotationsLimit_2,
    (value) => {
      PdfLinkAnnotationsLimit_2 = value;
    },
  );
  bindRuntimeValue(runtime, "normalizePdfLink", () => normalizePdfLink);
  bindRuntimeValue(
    runtime,
    "buildPdfLinkAnnotations",
    () => buildPdfLinkAnnotations,
  );
  return () => {
    PdfLinkAnnotationsUffefPattern =
      /[\u0e00-\u0e7f\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/u;
    PdfLinkAnnotationsLimit = 2048;
    PdfLinkAnnotationsConstant = 4e3;
    PdfLinkAnnotationsConstant_2 = 1e4;
    PdfLinkAnnotationsLimit_2 = 0.5;
  };
}
