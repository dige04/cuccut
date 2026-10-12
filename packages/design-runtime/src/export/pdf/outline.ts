/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfOutline(runtime: RuntimeBindings): () => void {
  var PdfOutlineConstant: Dynamic;
  function buildPdfOutline(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [];
    options.forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
      context[options2].some(
        (input3?: Dynamic, options3?: Dynamic): Dynamic => {
          if (!/^H[1-6]$/.test(input3)) return false;
          let text: Dynamic = "",
            value2: Dynamic;
          for (let value3 of input2 as Dynamic)
            value3.block === options3 &&
              ((text +=
                (value2 !== undefined &&
                (0, runtime.textRunsNeedSpace)(value2, value3.run)
                  ? " "
                  : "") + value3.run.text),
              (value2 = value3.run));
          text = (0, runtime.normalizePdfTitle)(text, PdfOutlineConstant);
          return text === ""
            ? false
            : (items.push({
                page: options2,
                title: text,
              }),
              true);
        },
      );
    });
    if (items.length === 0) return;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        String(input2) + " 0 R",
      items2: Dynamic = [
        "<< /Type /Outlines /First " +
          callback(input + 1) +
          " /Last " +
          callback(input + items.length) +
          " /Count " +
          String(items.length) +
          " >>",
      ];
    items.forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
      let value2: Dynamic = input + 1 + options2;
      items2.push(
        "<< /Title " +
          (0, runtime.pdfStringOperand)(input2.title) +
          " /Parent " +
          callback(input) +
          (options2 > 0 ? " /Prev " + callback(value2 - 1) : "") +
          (options2 < items.length - 1
            ? " /Next " + callback(value2 + 1)
            : "") +
          " /Dest [" +
          callback(value(input2.page)) +
          " /XYZ null null null] >>",
      );
    });
    return {
      rootObj: input,
      nextObj: input + items2.length,
      bodies: items2,
    };
  }
  bindRuntimeValue(
    runtime,
    "PdfOutlineConstant",
    () => PdfOutlineConstant,
    (value) => {
      PdfOutlineConstant = value;
    },
  );
  bindRuntimeValue(runtime, "buildPdfOutline", () => buildPdfOutline);
  return () => {
    PdfOutlineConstant = 200;
  };
}
