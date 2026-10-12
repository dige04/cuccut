/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfFigureOperators(
  runtime: RuntimeBindings,
): () => void {
  var PdfFigureOperatorsConstant: Dynamic;
  function clipPdfBlockBox(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let box: Dynamic = input.box,
      [items, items2, items3, items4]: Dynamic = [
        Math.max(0, box.xPt),
        Math.max(0, box.yPt),
        Math.min(options, box.xPt + box.widthPt),
        Math.min(context, box.yPt + box.heightPt),
      ];
    return items3 - items < 0.5 || items4 - items2 < 0.5
      ? undefined
      : {
          x0: items,
          y0: items2,
          x1: items3,
          y1: items4,
        };
  }
  function buildPdfFigureOperators(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let items: Dynamic = [],
      text: Dynamic = "";
    return extra
      ? ((input ?? []).forEach(
          (input2?: Dynamic, options2?: Dynamic): Dynamic => {
            if (input2.role !== "Figure") return;
            let value2: Dynamic = clipPdfBlockBox(input2, options, context);
            if (value2 === undefined) return;
            let value3: Dynamic = value + items.length;
            items.push({
              mcid: value3,
              block: options2,
              item: undefined,
              link: undefined,
            });
            text +=
              "/Figure << /MCID " +
              String(value3) +
              ` >> BDC
` +
              [
                value2.x0,
                value2.y0,
                value2.x1 - value2.x0,
                value2.y1 - value2.y0,
              ]
                .map(runtime.formatPdfNumber)
                .join(" ") +
              ` re n
EMC
`;
          },
        ),
        {
          ops: text,
          marks: items,
        })
      : {
          ops: text,
          marks: items,
        };
  }
  function mapPdfFigureLinks(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set(
        options
          .map((input2?: Dynamic): Dynamic => input2.link)
          .filter((input2?: Dynamic): Dynamic => input2 !== undefined),
      ),
      entries: Dynamic = new Map();
    (input ?? []).forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
      input2.role !== "Figure" ||
        input2.link === undefined ||
        values.has(input2.link) ||
        entries.has(input2.link) ||
        clipPdfBlockBox(input2, context, value) === undefined ||
        entries.set(input2.link, options2);
    });
    return entries;
  }
  bindRuntimeValue(
    runtime,
    "PdfFigureOperatorsConstant",
    () => PdfFigureOperatorsConstant,
    (value) => {
      PdfFigureOperatorsConstant = value;
    },
  );
  bindRuntimeValue(runtime, "clipPdfBlockBox", () => clipPdfBlockBox);
  bindRuntimeValue(
    runtime,
    "buildPdfFigureOperators",
    () => buildPdfFigureOperators,
  );
  bindRuntimeValue(runtime, "mapPdfFigureLinks", () => mapPdfFigureLinks);
  return () => {
    PdfFigureOperatorsConstant = 1e3;
  };
}
