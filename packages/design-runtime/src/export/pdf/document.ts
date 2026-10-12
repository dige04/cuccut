/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfDocument(runtime: RuntimeBindings): () => void {
  var PdfDocumentLimit: Dynamic;
  var PdfDocumentLimit_2: Dynamic;
  var PdfDocumentResolvedValue: Dynamic;
  function encodeAsciiBytes(text?: Dynamic): Dynamic {
    let bytes: Dynamic = new Uint8Array(text.length);
    for (let index: Dynamic = 0; index < text.length; index++) {
      let value: Dynamic = text.charCodeAt(index);
      if (value > 127) throw new Error("internal: non-ASCII in PDF structure");
      bytes[index] = value;
    }
    return bytes;
  }
  function formatPdfNumber(value?: Dynamic): Dynamic {
    return String(Math.round(value * 100) / 100);
  }
  function sanitizePdfText(input?: Dynamic, options?: Dynamic): Dynamic {
    return options === "winansi"
      ? Array.from(
          input.slice(0, 256),
          (input2?: Dynamic): Dynamic =>
            /^[\x20-\x7e]$/.test(input2) ? input2 : " ",
        ).join("")
      : truncatePdfText(input, 256);
  }
  function truncatePdfText(input?: Dynamic, options?: Dynamic): Dynamic {
    return Array.from(input.slice(0, 2 * options))
      .slice(0, options)
      .map((input2?: Dynamic): Dynamic => {
        let value: Dynamic = input2.codePointAt(0);
        return value < 32 || (value >= 127 && value <= 159)
          ? " "
          : value >= 55296 && value <= 57343
            ? String.fromCharCode(runtime.PdfUnicodeFontConstant)
            : input2;
      })
      .join("");
  }
  function normalizePdfTitle(input?: Dynamic, options?: Dynamic): Dynamic {
    return truncatePdfText(
      input.replace(/[\s\p{Cc}]+/gu, " ").trim(),
      options,
    ).trimEnd();
  }
  function pdfStringOperand(items?: Dynamic): Dynamic {
    if (/^[\x20-\x7e]*$/.test(items))
      return "(" + items.replace(/[\\()]/g, "\\$&") + ")";
    let text: Dynamic = "feff";
    for (let index: Dynamic = 0; index < items.length; index++)
      text += (0, runtime.pdfHexCodeUnit)(items.charCodeAt(index));
    return "<" + text + ">";
  }
  function pdfTextOperand(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input === "") return "";
    let value: Dynamic = sanitizePdfText(input, options);
    if (
      options === "winansi" ||
      Array.from(input)
        .slice(0, 256)
        .every((input2?: Dynamic): Dynamic => /^[\x20-\x7e]$/.test(input2))
    )
      return "(" + value.replace(/[\\()]/g, "\\$&") + ")";
    let text: Dynamic = "feff";
    for (let index: Dynamic = 0; index < value.length; index++)
      text += (0, runtime.pdfHexCodeUnit)(value.charCodeAt(index));
    return "<" + text + ">";
  }
  function buildPdfXmpMetadata(input?: Dynamic): Dynamic {
    let value: Dynamic =
        `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
` +
        [
          "<dc:format>application/pdf</dc:format>",
          ...(input === ""
            ? []
            : [
                '<dc:title><rdf:Alt><rdf:li xml:lang="x-default">' +
                  ((input2?: Dynamic): Dynamic =>
                    input2
                      .replace(
                        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,
                        "\uFFFD",
                      )
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;"))(input) +
                  "</rdf:li></rdf:Alt></dc:title>",
              ]),
        ].join(`
`) +
        `
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`,
      value2: Dynamic = new TextEncoder().encode(value);
    return [
      encodeAsciiBytes(
        "<< /Type /Metadata /Subtype /XML /Length " +
          String(value2.length) +
          ` >>
stream
`,
      ),
      value2,
      encodeAsciiBytes(`
endstream`),
    ];
  }
  function buildPdfDocument(items?: Dynamic, options?: Dynamic): Dynamic {
    if (items.length === 0)
      throw new Error("nothing to export \u2014 no pages were produced");
    let value: Dynamic = items.map(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          if (
            !Number.isFinite(input.widthPt) ||
            !Number.isFinite(input.heightPt) ||
            input.widthPt < PdfDocumentLimit ||
            input.heightPt < PdfDocumentLimit ||
            input.widthPt > PdfDocumentLimit_2 ||
            input.heightPt > PdfDocumentLimit_2
          )
            throw new Error(
              "page " + String(options2 + 1) + " has an out-of-range page size",
            );
          try {
            let value29: Dynamic = (0, runtime.readJpegDimensions)(input.jpeg);
            input.lossless != null &&
              (0, runtime.validateLosslessPicture)(input.lossless, value29);
            if (options?.tagged === true && input.blocks != null) {
              if (!Array.isArray(input.blocks))
                throw new Error("its blocks are not a list");
              if (input.blocks.length > runtime.PdfTextOperatorsLimit_2)
                throw new Error(
                  "it has more than " +
                    String(runtime.PdfTextOperatorsLimit_2) +
                    " blocks",
                );
              let value30: Dynamic = input.blocks.findIndex(
                (input2?: Dynamic): Dynamic =>
                  typeof input2 != "object" ||
                  input2 === null ||
                  !runtime.PdfTextOperatorsSubscribers.has(input2.role),
              );
              if (value30 >= 0)
                throw new Error(
                  "block " +
                    String(value30 + 1) +
                    " has a role other than " +
                    runtime.PdfTextOperatorsFreezeValue.join(", "),
                );
              let value31: Dynamic = input.blocks.findIndex(
                  (input2?: Dynamic): Dynamic =>
                    input2.role === "Figure" &&
                    !(
                      typeof input2.box == "object" &&
                      input2.box !== null &&
                      [
                        input2.box.xPt,
                        input2.box.yPt,
                        input2.box.widthPt,
                        input2.box.heightPt,
                      ].every(
                        (input3?: Dynamic): Dynamic =>
                          Number.isFinite(input3) &&
                          Math.abs(input3) <= PdfDocumentResolvedValue,
                      ) &&
                      (input2.alt === undefined ||
                        typeof input2.alt == "string")
                    ),
                ),
                value32: Dynamic = input.blocks.findIndex(
                  (input2?: Dynamic): Dynamic =>
                    input2.role === "Table" &&
                    !(
                      Number.isInteger(input2.cols) &&
                      Number.isInteger(input2.rows) &&
                      input2.cols >= 1 &&
                      input2.rows >= 1 &&
                      input2.cols * input2.rows <=
                        runtime.PdfTextOperatorsLimit_2 &&
                      (input2.headerRows == null ||
                        (Number.isInteger(input2.headerRows) &&
                          input2.headerRows >= 0 &&
                          input2.headerRows <= input2.rows))
                    ),
                );
              if (value32 >= 0) {
                let value35: Dynamic = input.blocks[value32],
                  callback6: Dynamic = (input2?: Dynamic): Dynamic =>
                    String(input2).slice(0, 20);
                throw new Error(
                  "block " +
                    String(value32 + 1) +
                    " is a table with rows " +
                    callback6(value35.rows) +
                    ", cols " +
                    callback6(value35.cols) +
                    ", headerRows " +
                    callback6(value35.headerRows) +
                    ": rows and cols must be whole numbers from 1 with rows \xD7 cols at most " +
                    String(runtime.PdfTextOperatorsLimit_2) +
                    ", and headerRows, when given, a whole number from 0 to rows",
                );
              }
              if (
                input.blocks.reduce(
                  (input2?: Dynamic, options3?: Dynamic): Dynamic =>
                    input2 +
                    (options3.role === "Table"
                      ? options3.rows * options3.cols
                      : 0),
                  0,
                ) > runtime.PdfTextOperatorsLimit_2
              )
                throw new Error(
                  "its tables hold more than " +
                    String(runtime.PdfTextOperatorsLimit_2) +
                    " cells in all",
                );
              if (value31 >= 0)
                throw new Error(
                  "block " +
                    String(value31 + 1) +
                    " is a figure with a bad box (xPt, yPt, widthPt and heightPt must each be a finite number of at most " +
                    String(PdfDocumentResolvedValue) +
                    ") or an alt that is not a string",
                );
              let value33: Dynamic = input.blocks.findIndex(
                (input2?: Dynamic): Dynamic =>
                  input2.role === "Figure" &&
                  input2.link !== undefined &&
                  !(Number.isInteger(input2.link) && input2.link >= 0),
              );
              if (value33 >= 0) {
                let link: Dynamic = input.blocks[value33].link;
                throw new Error(
                  "block " +
                    String(value33 + 1) +
                    " is a figure with link " +
                    (typeof link == "string"
                      ? JSON.stringify(link)
                      : String(link)
                    ).slice(0, 20) +
                    "; it must be a whole number, 0 or more",
                );
              }
              let value34: Dynamic = input.blocks.findIndex(
                (input2?: Dynamic): Dynamic =>
                  input2.numbering != null &&
                  !(
                    typeof input2.numbering == "string" &&
                    runtime.PdfTextOperatorsSubscribers_2.has(input2.numbering)
                  ),
              );
              if (value34 >= 0)
                throw new Error(
                  "block " +
                    String(value34 + 1) +
                    " has list numbering " +
                    JSON.stringify(
                      String(input.blocks[value34].numbering).slice(0, 40),
                    ) +
                    "; allowed: " +
                    runtime.PdfTextOperatorsFreezeValue_3.join(", "),
                );
            }
            return value29;
          } catch (value29: Dynamic) {
            throw new Error(
              "page " +
                String(options2 + 1) +
                ": " +
                (value29 instanceof Error ? value29.message : String(value29)),
            );
          }
        },
      ),
      callback: Dynamic = (input?: Dynamic): Dynamic => 4 + 3 * input,
      callback2: Dynamic = (input?: Dynamic): Dynamic => 5 + 3 * input,
      callback3: Dynamic = (input?: Dynamic): Dynamic => 6 + 3 * input,
      value2: Dynamic = items.some(
        (input?: Dynamic): Dynamic => (input.textRuns?.length ?? 0) > 0,
      ),
      value3: Dynamic =
        options?.textEncoding === "unicode" ? "unicode" : "winansi",
      state: Dynamic = {
        astral: new Map(),
        highBytes: new Set(),
      },
      value4: Dynamic =
        value3 === "unicode"
          ? (0, runtime.createPdfUnicodeEncoder)(state)
          : runtime.PdfTextEncodingReduce,
      value5: Dynamic = 4 + 3 * items.length,
      value6: Dynamic = value2 ? (value3 === "unicode" ? 6 : 1) : 0,
      value7: Dynamic = options?.tagged === true,
      value8: Dynamic = options?.lang;
    if (value7 && value8 !== undefined && !(0, runtime.isLanguageTag)(value8))
      throw new Error(
        "the document language " +
          JSON.stringify(String(value8).slice(0, 40)) +
          ' is not a language tag such as "en" or "ja-JP"',
      );
    let value9: Dynamic = items.map(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          (input.textRuns?.length ?? 0) > 0
            ? (0, runtime.buildPdfTextRuns)(
                input.textRuns,
                options2,
                input.widthPt,
                input.heightPt,
                value4,
                input.blocks,
                value7,
              )
            : [],
      ),
      value10: Dynamic = value9.map(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          value7
            ? (0, runtime.mapPdfFigureLinks)(
                items[options2].blocks,
                input,
                items[options2].widthPt,
                items[options2].heightPt,
              )
            : new Map(),
      ),
      value11: Dynamic = value9.map(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          let entries: Dynamic = new Map();
          for (let value29 of input as Dynamic) {
            if (value29.link === undefined) continue;
            let entry: Dynamic = entries.get(value29.link);
            entry === undefined
              ? entries.set(value29.link, {
                  text: value29.run.text,
                  last: value29.run,
                })
              : entries.set(value29.link, {
                  text:
                    entry.text +
                    ((0, runtime.textRunsNeedSpace)(entry.last, value29.run)
                      ? " "
                      : "") +
                    value29.run.text,
                  last: value29.run,
                });
          }
          let entries2: Dynamic = new Map();
          for (let [value29, value30] of entries as Dynamic) {
            let value31: Dynamic = normalizePdfTitle(
              value30.text,
              runtime.PdfOutlineConstant,
            );
            value31 !== "" && entries2.set(value29, value31);
          }
          for (let [value29, value30] of value10[options2] as Dynamic) {
            let alt2: Dynamic = items[options2].blocks[value30].alt,
              value31: Dynamic =
                typeof alt2 == "string"
                  ? normalizePdfTitle(alt2, runtime.PdfOutlineConstant)
                  : "";
            value31 !== "" && entries2.set(value29, value31);
          }
          return (input2?: Dynamic): Dynamic => entries2.get(input2);
        },
      ),
      value12: Dynamic = runtime.PdfLinkAnnotationsConstant_2,
      flag: Dynamic = false,
      index: Dynamic = 0,
      value13: Dynamic = items.map(
        (input?: Dynamic, options2?: Dynamic): Dynamic => {
          let value29: Dynamic = (0, runtime.buildPdfLinkAnnotations)(
            input.links,
            input.widthPt,
            input.heightPt,
            value12,
            (): Dynamic => (flag = true),
            value7 ? items.length + index : undefined,
            value7 ? value11[options2] : undefined,
          );
          value12 -= value29.dicts.length;
          index += value29.dicts.length;
          return value29;
        },
      );
    flag &&
      console.warn(
        "[pdf] the file holds " +
          String(runtime.PdfLinkAnnotationsConstant_2) +
          " links; any further ones are not clickable",
      );
    let value14: Dynamic = value5 + value6,
      value15: Dynamic = value13.map(
        (input?: Dynamic): Dynamic => input.dicts.map((): Dynamic => value14++),
      ),
      value16: Dynamic = value15.map(
        (input?: Dynamic): Dynamic =>
          input
            .map((input2?: Dynamic): Dynamic => String(input2) + " 0 R")
            .join(" "),
      ),
      value17: Dynamic = value7
        ? (0, runtime.collectPdfStructureRoles)(items, value9)
        : items.map((): Dynamic => []),
      value18: Dynamic = value9.map(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          (0, runtime.buildPdfTextOperators)(
            input,
            runtime.PdfTextEncodingWinansiUnicodeConfig[value3],
            value7,
            value17[options2],
            items[options2].blocks,
            new Set(
              value13[options2].anchors.filter(
                (input2?: Dynamic): Dynamic => input2 !== undefined,
              ),
            ),
          ),
      ),
      value19: Dynamic = items.map(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          (0, runtime.buildPdfFigureOperators)(
            input.blocks,
            input.widthPt,
            input.heightPt,
            value18[options2].marks.length,
            value7,
          ),
      );
    value7 && value3 === "unicode" && state.highBytes.add(0);
    let value20: Dynamic = value7
        ? (0, runtime.buildPdfStructureTree)(
            value14,
            items,
            value18,
            value19,
            value17,
            value15,
            value13.map((input?: Dynamic): Dynamic => input.anchors),
            value10,
            callback,
          )
        : undefined,
      value21: Dynamic =
        value20 !== undefined && options?.outline === true
          ? (0, runtime.buildPdfOutline)(
              value20.nextObj,
              value9,
              value17,
              callback,
            )
          : undefined,
      value22: Dynamic =
        value20 !== undefined
          ? (value21?.nextObj ?? value20.nextObj)
          : undefined,
      value23: Dynamic = value22 ?? value14 - 1,
      value24: Dynamic = items
        .map(
          (input?: Dynamic, options2?: Dynamic): Dynamic =>
            String(callback(options2)) + " 0 R",
        )
        .join(" "),
      value25: Dynamic = pdfTextOperand(options?.title ?? "", value3),
      items2: Dynamic = [];
    items2.push([
      encodeAsciiBytes(
        value20 === undefined
          ? "<< /Type /Catalog /Pages 2 0 R >>"
          : "<< /Type /Catalog /Pages 2 0 R /MarkInfo << /Marked true >> /ViewerPreferences << /DisplayDocTitle true >> /Lang (" +
              (value8 ?? "und") +
              ") /StructTreeRoot " +
              String(value20.rootObj) +
              " 0 R" +
              (value21 !== undefined
                ? " /Outlines " + String(value21.rootObj) + " 0 R"
                : "") +
              " /Metadata " +
              String(value22) +
              " 0 R >>",
      ),
    ]);
    items2.push([
      encodeAsciiBytes(
        "<< /Type /Pages /Kids [" +
          value24 +
          "] /Count " +
          String(items.length) +
          " >>",
      ),
    ]);
    items2.push([
      encodeAsciiBytes(
        "<<" + (value25 === "" ? "" : " /Title " + value25) + " >>",
      ),
    ]);
    items.forEach((input?: Dynamic, options2?: Dynamic): Dynamic => {
      let value29: Dynamic = value[options2],
        value30: Dynamic =
          input.lossless != null &&
          input.lossless.zlib.length + 2 < input.jpeg.length
            ? input.lossless
            : undefined,
        value31: Dynamic = formatPdfNumber(input.widthPt),
        value32: Dynamic = formatPdfNumber(input.heightPt),
        value33: Dynamic = (input.textRuns?.length ?? 0) > 0;
      items2.push([
        encodeAsciiBytes(
          "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
            value31 +
            " " +
            value32 +
            "] /Resources << /XObject << /Im0 " +
            String(callback3(options2)) +
            " 0 R >> " +
            (value33 ? "/Font << /F0 " + String(value5) + " 0 R >> " : "") +
            "/ProcSet [/PDF /ImageC" +
            (value33 ? " /Text" : "") +
            "] >> /Contents " +
            String(callback2(options2)) +
            " 0 R" +
            (value16[options2] === ""
              ? ""
              : " /Annots [" + value16[options2] + "]") +
            (value20 === undefined
              ? ""
              : " /StructParents " + String(options2) + " /Tabs /S") +
            " >>",
        ),
      ]);
      let value34: Dynamic =
          `q
` +
          value31 +
          " 0 0 " +
          value32 +
          ` 0 0 cm
/Im0 Do
Q
`,
        value35: Dynamic =
          (value20 === undefined
            ? value34
            : `/Artifact BMC
` +
              value34 +
              `EMC
`) +
          value18[options2].ops +
          value19[options2].ops;
      items2.push([
        encodeAsciiBytes(
          "<< /Length " +
            String(value35.length) +
            ` >>
stream
` +
            value35 +
            "endstream",
        ),
      ]);
      let value36: Dynamic = value30 !== undefined ? value30.zlib : input.jpeg;
      items2.push([
        encodeAsciiBytes(
          "<< /Type /XObject /Subtype /Image /Width " +
            String(value29.width) +
            " /Height " +
            String(value29.height) +
            " /ColorSpace " +
            (value30 !== undefined || value29.components === 3
              ? "/DeviceRGB"
              : "/DeviceGray") +
            " /BitsPerComponent 8 /Filter " +
            (value30 !== undefined ? "/FlateDecode" : "/DCTDecode") +
            " /Length " +
            String(value36.length) +
            ` >>
stream
`,
        ),
        value36,
        encodeAsciiBytes(`
endstream`),
      ]);
    });
    value2 && value3 === "unicode"
      ? items2.push(...(0, runtime.buildPdfFontObjects)(value5, state))
      : value2 &&
        items2.push([
          encodeAsciiBytes(
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
          ),
        ]);
    for (let value29 of value13 as Dynamic)
      for (let value30 of value29.dicts as Dynamic)
        items2.push([encodeAsciiBytes(value30)]);
    if (value20 !== undefined) {
      for (let value29 of value20.bodies as Dynamic)
        items2.push([encodeAsciiBytes(value29)]);
      for (let value29 of (value21?.bodies ?? []) as Dynamic)
        items2.push([encodeAsciiBytes(value29)]);
      items2.push(
        buildPdfXmpMetadata(sanitizePdfText(options?.title ?? "", value3)),
      );
    }
    let items3: Dynamic = [],
      index2: Dynamic = 0,
      callback4: Dynamic = (items5?: Dynamic): Dynamic => {
        items3.push(items5);
        index2 += items5.length;
      };
    callback4(
      encodeAsciiBytes(
        value20 === undefined
          ? `%PDF-1.4
`
          : `%PDF-1.7
`,
      ),
    );
    callback4(Uint8Array.from([37, 226, 227, 207, 211, 10]));
    let items4: Dynamic = [];
    items2.forEach((input?: Dynamic, options2?: Dynamic): Dynamic => {
      items4.push(index2);
      callback4(
        encodeAsciiBytes(
          String(options2 + 1) +
            ` 0 obj
`,
        ),
      );
      for (let value29 of input as Dynamic) callback4(value29);
      callback4(
        encodeAsciiBytes(`
endobj
`),
      );
    });
    let value26: Dynamic = index2,
      callback5: Dynamic = (input?: Dynamic): Dynamic =>
        String(input).padStart(10, "0");
    callback4(
      encodeAsciiBytes(
        `xref
0 ` +
          String(value23 + 1) +
          `
0000000000 65535 f 
` +
          items4
            .map(
              (input?: Dynamic): Dynamic =>
                callback5(input) +
                ` 00000 n 
`,
            )
            .join("") +
          `trailer
<< /Size ` +
          String(value23 + 1) +
          ` /Root 1 0 R /Info 3 0 R >>
startxref
` +
          String(value26) +
          `
%%EOF
`,
      ),
    );
    let value27: Dynamic = items3.reduce(
        (input?: Dynamic, items5?: Dynamic): Dynamic => input + items5.length,
        0,
      ),
      value28: Dynamic = new Uint8Array(value27),
      index3: Dynamic = 0;
    for (let value29 of items3 as Dynamic) {
      value28.set(value29, index3);
      index3 += value29.length;
    }
    return value28;
  }
  bindRuntimeValue(
    runtime,
    "PdfDocumentLimit",
    () => PdfDocumentLimit,
    (value) => {
      PdfDocumentLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfDocumentLimit_2",
    () => PdfDocumentLimit_2,
    (value) => {
      PdfDocumentLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfDocumentResolvedValue",
    () => PdfDocumentResolvedValue,
    (value) => {
      PdfDocumentResolvedValue = value;
    },
  );
  bindRuntimeValue(runtime, "encodeAsciiBytes", () => encodeAsciiBytes);
  bindRuntimeValue(runtime, "formatPdfNumber", () => formatPdfNumber);
  bindRuntimeValue(runtime, "sanitizePdfText", () => sanitizePdfText);
  bindRuntimeValue(runtime, "truncatePdfText", () => truncatePdfText);
  bindRuntimeValue(runtime, "normalizePdfTitle", () => normalizePdfTitle);
  bindRuntimeValue(runtime, "pdfStringOperand", () => pdfStringOperand);
  bindRuntimeValue(runtime, "pdfTextOperand", () => pdfTextOperand);
  bindRuntimeValue(runtime, "buildPdfXmpMetadata", () => buildPdfXmpMetadata);
  bindRuntimeValue(runtime, "buildPdfDocument", () => buildPdfDocument);
  return () => {
    PdfDocumentLimit = 3;
    PdfDocumentLimit_2 = 14400;
    PdfDocumentResolvedValue = 4 * PdfDocumentLimit_2;
  };
}
