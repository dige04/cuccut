/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfTextOperators(
  runtime: RuntimeBindings,
): () => void {
  var PdfTextOperatorsLimit: Dynamic;
  var PdfTextOperatorsFreezeValue: Dynamic;
  var PdfTextOperatorsFreezeValue_2: Dynamic;
  var PdfTextOperatorsFreezeValue_3: Dynamic;
  var PdfTextOperatorsSubscribers: Dynamic;
  var PdfTextOperatorsSubscribers_2: Dynamic;
  var PdfTextOperatorsLimit_2: Dynamic;
  var getTableCellStructureRole: Dynamic;
  function buildPdfTextRuns(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
    argument?: Dynamic,
  ): Dynamic {
    let index: Dynamic = 0,
      items: Dynamic = [],
      flag: Dynamic = false;
    input.forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
      let value2: Dynamic =
          flag && input2.spaceBefore !== undefined
            ? {
                ...input2,
                spaceBefore: undefined,
              }
            : input2,
        value3: Dynamic =
          "page " + String(options + 1) + " text run " + String(options2 + 1);
      if (
        typeof value2.text != "string" ||
        !Number.isFinite(value2.xPt) ||
        !Number.isFinite(value2.yPt) ||
        !Number.isFinite(value2.sizePt) ||
        !Number.isFinite(value2.widthPt) ||
        value2.sizePt <= 0 ||
        value2.widthPt < 0 ||
        value2.sizePt > runtime.PdfDocumentLimit_2 ||
        value2.widthPt > runtime.PdfDocumentResolvedValue ||
        Math.abs(value2.xPt) > runtime.PdfDocumentResolvedValue ||
        Math.abs(value2.yPt) > runtime.PdfDocumentResolvedValue
      )
        throw new Error(value3 + " is not a valid text run");
      if (
        argument &&
        value2.block !== undefined &&
        !(
          Number.isInteger(value2.block) &&
          value2.block >= 0 &&
          value2.block < (detail?.length ?? 0) &&
          detail?.[value2.block] != null
        )
      )
        throw new Error(value3 + " names a block the page does not have");
      if (
        argument &&
        value2.block !== undefined &&
        detail?.[value2.block]?.role === "Figure"
      )
        throw new Error(
          value3 +
            " points at block " +
            String(value2.block + 1) +
            ", a figure, which can hold no text",
        );
      if (
        argument &&
        value2.spaceBefore !== undefined &&
        typeof value2.spaceBefore != "boolean"
      )
        throw new Error(
          value3 +
            " has a spaceBefore other than true or false (leave it out when unknown)",
        );
      if (
        argument &&
        value2.link !== undefined &&
        !(Number.isInteger(value2.link) && value2.link >= 0)
      )
        throw new Error(
          value3 +
            " has link " +
            (typeof value2.link == "string"
              ? JSON.stringify(value2.link)
              : String(value2.link)
            ).slice(0, 20) +
            "; it must be a whole number, 0 or more",
        );
      if (
        argument &&
        value2.item !== undefined &&
        !(
          Number.isInteger(value2.item) &&
          value2.item >= 0 &&
          value2.item < PdfTextOperatorsLimit_2
        )
      )
        throw new Error(
          value3 + " names a list item that is not a whole number from 0",
        );
      let value4: Dynamic =
        argument &&
        value2.block !== undefined &&
        detail?.[value2.block]?.role === "Table"
          ? detail[value2.block]
          : undefined;
      if (
        value4 !== undefined &&
        value2.cell !== undefined &&
        !(
          Number.isInteger(value2.cell) &&
          value2.cell >= 0 &&
          value2.cell < value4.rows * value4.cols
        )
      )
        throw new Error(
          value3 +
            " names table cell " +
            String(value2.cell).slice(0, 20) +
            ", but block " +
            String(value2.block + 1) +
            " is a " +
            String(value4.rows) +
            " \xD7 " +
            String(value4.cols) +
            " table whose cells are numbered 0 to " +
            String(value4.rows * value4.cols - 1),
        );
      index += value2.text.length;
      if (index > PdfTextOperatorsLimit)
        throw new Error(
          "page " +
            String(options + 1) +
            " has an implausibly large text layer",
        );
      if (
        value2.xPt > context ||
        value2.yPt < 0 ||
        value2.yPt > value ||
        value2.xPt + value2.widthPt < 0
      ) {
        flag = true;
        return;
      }
      let value5: Dynamic =
        value2.sizePt < 0.005 ? undefined : extra(value2.text);
      if (value5 === undefined) {
        flag = true;
        return;
      }
      flag = false;
      let value6: Dynamic = detail?.[value2.block ?? -1]?.role;
      items.push({
        run: value2,
        encoded: value5,
        block: value2.block,
        item:
          value6 === "L"
            ? (value2.item ?? 0)
            : value6 === "Table"
              ? (value2.cell ?? 0)
              : undefined,
        link: argument && value6 !== "Artifact" ? value2.link : undefined,
      });
    });
    return items;
  }
  function textRunsNeedSpace(input?: Dynamic, options?: Dynamic): Dynamic {
    return options.spaceBefore !== undefined
      ? options.spaceBefore &&
          (0, runtime.needsInterwordSpace)(input.text, options.text, true)
      : Math.abs(options.yPt - input.yPt) >=
          0.5 * Math.max(input.sizePt, options.sizePt) &&
          (0, runtime.needsInterwordSpace)(input.text, options.text, false);
  }
  function buildPdfTextOperators(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    if (items.length === 0)
      return {
        ops: "",
        marks: [],
      };
    items = items.map(
      (input?: Dynamic): Dynamic =>
        input.link === undefined || detail.has(input.link)
          ? input
          : {
              ...input,
              link: undefined,
            },
    );
    let items2: Dynamic = [],
      value2: Dynamic = `BT
3 Tr
`,
      callback: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic =>
        options2 !== undefined &&
        input.block !== undefined &&
        options2.block === input.block &&
        options2.item === input.item,
      callback2: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic =>
        callback(input, options2) && options2.link === input.link;
    items.forEach((input?: Dynamic, options2?: Dynamic): Dynamic => {
      let {
          run: value3,
          encoded: value4,
          block: value5,
          item: value6,
          link: value7,
        }: Dynamic = input,
        value8: Dynamic = items[options2 + 1];
      if (context && !(options2 > 0 && callback2(items[options2 - 1], input))) {
        options2 > 0 &&
          (value2 += `EMC
`);
        let value12: Dynamic = value5 === undefined ? "P" : value[value5],
          value13: Dynamic =
            value12 === "L"
              ? "LBody"
              : value12 === "Table"
                ? getTableCellStructureRole(extra[value5], value6 ?? 0)
                : value12;
        value13 === "Artifact"
          ? (value2 += `/Artifact BMC
`)
          : ((value2 +=
              "/" +
              (value7 !== undefined ? "Link" : value13) +
              " << /MCID " +
              String(items2.length) +
              ` >> BDC
`),
            items2.push({
              mcid: items2.length,
              block: value5,
              item: value6,
              link: value7,
            }));
      }
      let value9: Dynamic =
          context &&
          callback(input, value8) &&
          value4.reordered !== true &&
          textRunsNeedSpace(value3, value8.run)
            ? options
            : undefined,
        value10: Dynamic = value4.em * value3.sizePt,
        value11: Dynamic = value10 > 0 ? (100 * value3.widthPt) / value10 : 100;
      value11 = Math.max(10, Math.min(1e3, value11));
      value2 +=
        "/F0 " +
        (0, runtime.formatPdfNumber)(value3.sizePt) +
        ` Tf
` +
        (0, runtime.formatPdfNumber)(value11) +
        ` Tz
1 0 0 1 ` +
        (0, runtime.formatPdfNumber)(value3.xPt) +
        " " +
        (0, runtime.formatPdfNumber)(value3.yPt) +
        ` Tm
`;
      value2 +=
        value9 === undefined
          ? value4.operand +
            ` Tj
`
          : "[" +
            value4.operand +
            " " +
            (0, runtime.formatPdfNumber)(value9.em * 1e3) +
            " " +
            value9.operand +
            `] TJ
`;
    });
    return {
      ops:
        value2 +
        (context
          ? `EMC
`
          : "") +
        `ET
`,
      marks: items2,
    };
  }
  bindRuntimeValue(
    runtime,
    "PdfTextOperatorsLimit",
    () => PdfTextOperatorsLimit,
    (value) => {
      PdfTextOperatorsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfTextOperatorsFreezeValue",
    () => PdfTextOperatorsFreezeValue,
    (value) => {
      PdfTextOperatorsFreezeValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfTextOperatorsFreezeValue_2",
    () => PdfTextOperatorsFreezeValue_2,
    (value) => {
      PdfTextOperatorsFreezeValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfTextOperatorsFreezeValue_3",
    () => PdfTextOperatorsFreezeValue_3,
    (value) => {
      PdfTextOperatorsFreezeValue_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfTextOperatorsSubscribers",
    () => PdfTextOperatorsSubscribers,
    (value) => {
      PdfTextOperatorsSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfTextOperatorsSubscribers_2",
    () => PdfTextOperatorsSubscribers_2,
    (value) => {
      PdfTextOperatorsSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfTextOperatorsLimit_2",
    () => PdfTextOperatorsLimit_2,
    (value) => {
      PdfTextOperatorsLimit_2 = value;
    },
  );
  bindRuntimeValue(runtime, "buildPdfTextRuns", () => buildPdfTextRuns);
  bindRuntimeValue(runtime, "textRunsNeedSpace", () => textRunsNeedSpace);
  bindRuntimeValue(
    runtime,
    "getTableCellStructureRole",
    () => getTableCellStructureRole,
    (value) => {
      getTableCellStructureRole = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildPdfTextOperators",
    () => buildPdfTextOperators,
  );
  return () => {
    PdfTextOperatorsLimit = 2e5;
    PdfTextOperatorsFreezeValue = Object.freeze([
      "P",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "L",
      "Table",
      "Figure",
      "Artifact",
    ]);
    PdfTextOperatorsFreezeValue_2 = Object.freeze([
      "P",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "L",
      "Artifact",
    ]);
    PdfTextOperatorsFreezeValue_3 = Object.freeze([
      "None",
      "Disc",
      "Circle",
      "Square",
      "Decimal",
      "UpperRoman",
      "LowerRoman",
      "UpperAlpha",
      "LowerAlpha",
    ]);
    PdfTextOperatorsSubscribers = new Set(PdfTextOperatorsFreezeValue);
    PdfTextOperatorsSubscribers_2 = new Set(PdfTextOperatorsFreezeValue_3);
    PdfTextOperatorsLimit_2 = 1e4;
    getTableCellStructureRole = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      options < (input.headerRows ?? 0) * input.cols ? "TH" : "TD";
  };
}
