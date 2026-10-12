/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfTextEncoding(
  runtime: RuntimeBindings,
): () => void {
  var PdfTextEncodingUfdffUfefcPattern: Dynamic;
  var PdfTextEncodingUfdffUfefcPattern_2: Dynamic;
  var PdfTextEncodingPattern: Dynamic;
  var PdfTextEncodingPattern_2: Dynamic;
  var PdfTextEncodingWinansiUnicodeConfig: Dynamic;
  var PdfTextEncodingReduce: Dynamic;
  function reverseMixedRtlText(input?: Dynamic): Dynamic {
    if (!PdfTextEncodingUfdffUfefcPattern_2.test(input)) return;
    let value: Dynamic = input.match(PdfTextEncodingPattern_2) ?? [];
    if (
      !value.some(
        (input2?: Dynamic): Dynamic =>
          PdfTextEncodingPattern.test(input2) &&
          !PdfTextEncodingUfdffUfefcPattern.test(input2),
      )
    )
      return value.reverse().join("");
  }
  function createPdfUnicodeEncoder(input?: Dynamic): Dynamic {
    return (input2?: Dynamic): Dynamic => {
      let value: Dynamic = reverseMixedRtlText(input2),
        value2: Dynamic = (0, runtime.encodePdfUnicode)(value ?? input2, input);
      if (value2 !== undefined)
        return {
          operand: "<" + value2.map(runtime.pdfHexCodeUnit).join("") + ">",
          em:
            value2.reduce(
              (input3?: Dynamic, options?: Dynamic): Dynamic =>
                input3 + (0, runtime.unicodeGlyphWidth)(options),
              0,
            ) / 1e3,
          reordered: value !== undefined,
        };
    };
  }
  bindRuntimeValue(
    runtime,
    "PdfTextEncodingUfdffUfefcPattern",
    () => PdfTextEncodingUfdffUfefcPattern,
    (value) => {
      PdfTextEncodingUfdffUfefcPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfTextEncodingUfdffUfefcPattern_2",
    () => PdfTextEncodingUfdffUfefcPattern_2,
    (value) => {
      PdfTextEncodingUfdffUfefcPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfTextEncodingPattern",
    () => PdfTextEncodingPattern,
    (value) => {
      PdfTextEncodingPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfTextEncodingPattern_2",
    () => PdfTextEncodingPattern_2,
    (value) => {
      PdfTextEncodingPattern_2 = value;
    },
  );
  bindRuntimeValue(runtime, "reverseMixedRtlText", () => reverseMixedRtlText);
  bindRuntimeValue(
    runtime,
    "PdfTextEncodingWinansiUnicodeConfig",
    () => PdfTextEncodingWinansiUnicodeConfig,
    (value) => {
      PdfTextEncodingWinansiUnicodeConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfTextEncodingReduce",
    () => PdfTextEncodingReduce,
    (value) => {
      PdfTextEncodingReduce = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createPdfUnicodeEncoder",
    () => createPdfUnicodeEncoder,
  );
  return () => {
    PdfTextEncodingUfdffUfefcPattern =
      /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
    PdfTextEncodingUfdffUfefcPattern_2 =
      /(?=\p{L})[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u;
    PdfTextEncodingPattern = /\p{L}/u;
    PdfTextEncodingPattern_2 =
      /[+\-\u2212#$%\u00a2-\u00a5\u00b0\u00b1\u066a\u2030\u2031\u20a0-\u20cf]{0,4}[0-9\u0660-\u0669\u066b\u066c\u06f0-\u06f9]+(?:[+\-\u2012\u2013\u2212,.:/\u00a0\u060c\u202f][0-9\u0660-\u0669\u066b\u066c\u06f0-\u06f9]+)*[#$%\u00a2-\u00a5\u00b0\u00b1\u066a\u2030\u2031\u20a0-\u20cf]{0,4}|[^]/gu;
    PdfTextEncodingWinansiUnicodeConfig = {
      winansi: {
        operand: "( )",
        em: (0, runtime.winAnsiGlyphWidth)(32) / 1e3,
      },
      unicode: {
        operand: "<0020>",
        em: (0, runtime.unicodeGlyphWidth)(32) / 1e3,
      },
    };
    PdfTextEncodingReduce = (input?: Dynamic): Dynamic => {
      let value: Dynamic = (0, runtime.encodeWinAnsiText)(input);
      if (value !== undefined)
        return {
          operand: "(" + (0, runtime.escapePdfLiteralBytes)(value) + ")",
          em:
            value.reduce(
              (input2?: Dynamic, options?: Dynamic): Dynamic =>
                input2 + (0, runtime.winAnsiGlyphWidth)(options),
              0,
            ) / 1e3,
        };
    };
  };
}
