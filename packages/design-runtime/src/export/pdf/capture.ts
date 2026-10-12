/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfCapture(runtime: RuntimeBindings): () => void {
  var PdfCaptureLimit: Dynamic;
  var PdfCaptureConstant: Dynamic;
  var PdfCaptureConstant_2: Dynamic;
  var getPdfRasterScale: Dynamic;
  var PdfCaptureConstant_3: Dynamic;
  var PdfCaptureConstant_4: Dynamic;
  var PdfCaptureLimit_2: Dynamic;
  var PdfCaptureLimit_3: Dynamic;
  var PdfCaptureLimit_4: Dynamic;
  var PdfCaptureLimit_5: Dynamic;
  var PdfCaptureLimit_6: Dynamic;
  var PdfCaptureConstant_5: Dynamic;
  var PdfCaptureLimit_7: Dynamic;
  var PdfCapturePH1H2Set: Dynamic;
  var PdfCaptureHas: Dynamic;
  var PdfCaptureConstant_6: Dynamic;
  function parseCapturedTextRuns(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (!Array.isArray(items))
      return {
        runs: [],
        capped: false,
      };
    let items2: Dynamic = [],
      index: Dynamic = 0,
      value: Dynamic = Math.min(items.length, 4 * PdfCaptureLimit_3);
    for (let index2: Dynamic = 0; index2 < value; index2++) {
      let value2: Dynamic = items[index2];
      if (typeof value2 != "object" || value2 === null) continue;
      let {
        t: value3,
        x: value4,
        y: value5,
        s: value6,
        w: value7,
        b: value8,
        i: value9,
        sp: value10,
        a: value11,
      }: Dynamic = value2;
      if (
        typeof value3 != "string" ||
        typeof value4 != "number" ||
        typeof value5 != "number" ||
        typeof value6 != "number" ||
        typeof value7 != "number" ||
        !Number.isFinite(value4) ||
        !Number.isFinite(value5) ||
        !Number.isFinite(value6) ||
        !Number.isFinite(value7) ||
        value6 <= 0 ||
        value6 > context ||
        value7 < 0 ||
        value7 > 3 * options ||
        value4 > options ||
        value4 + value7 < 0 ||
        value5 < 0 ||
        value5 > context
      )
        continue;
      let value12: Dynamic =
          value3.charCodeAt(PdfCaptureConstant_5) >= 56320 &&
          value3.charCodeAt(PdfCaptureConstant_5) <= 57343
            ? PdfCaptureConstant_5 - 1
            : PdfCaptureConstant_5,
        value13: Dynamic = value3.slice(0, value12);
      if (
        items2.length >= PdfCaptureLimit_3 ||
        index + value13.length > PdfCaptureLimit_7
      )
        return {
          runs: items2,
          capped: true,
        };
      index += value13.length;
      let state: Dynamic = {
        t: value13,
        x: value4,
        y: value5,
        s: value6,
        w: value7,
      };
      typeof value8 == "number" &&
        Number.isInteger(value8) &&
        value8 >= 0 &&
        value8 < PdfCaptureLimit_3 &&
        ((state.b = value8),
        typeof value9 == "number" &&
          Number.isInteger(value9) &&
          value9 >= 0 &&
          value9 < runtime.PdfTextOperatorsLimit_2 &&
          (state.i = value9),
        typeof value10 == "boolean" && (state.sp = value10));
      typeof value11 == "number" &&
        Number.isInteger(value11) &&
        value11 >= 0 &&
        value11 < PdfCaptureLimit_4 &&
        (state.a = value11);
      items2.push(state);
    }
    return {
      runs: items2,
      capped: false,
    };
  }
  function parseCapturedFigure(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (typeof input != "object" || input === null) return;
    let {
      r: value,
      a: value2,
      l: value3,
      x: value4,
      y: value5,
      w: value6,
      h: value7,
    }: Dynamic = input;
    if (
      value !== "Figure" ||
      typeof value4 != "number" ||
      typeof value5 != "number" ||
      typeof value6 != "number" ||
      typeof value7 != "number" ||
      ![value4, value5, value6, value7].every(Number.isFinite) ||
      !(value6 > 0) ||
      !(value7 > 0)
    )
      return;
    let value8: Dynamic = Math.max(0, value4),
      value9: Dynamic = Math.max(0, value5),
      value10: Dynamic = Math.min(options, value4 + value6),
      value11: Dynamic = Math.min(context, value5 + value7);
    if (!(value10 - value8 > 0) || !(value11 - value9 > 0)) return;
    let state: Dynamic = {
      ...(typeof value3 == "number" &&
      Number.isInteger(value3) &&
      value3 >= 0 &&
      value3 < PdfCaptureLimit_4
        ? {
            l: value3,
          }
        : {}),
      x: value8,
      y: value9,
      w: value10 - value8,
      h: value11 - value9,
    };
    if (typeof value2 != "string")
      return {
        r: "Figure",
        ...state,
      };
    let value12: Dynamic =
      value2.charCodeAt(PdfCaptureConstant_6 - 1) >= 55296 &&
      value2.charCodeAt(PdfCaptureConstant_6 - 1) <= 56319
        ? PdfCaptureConstant_6 - 1
        : PdfCaptureConstant_6;
    return {
      r: "Figure",
      a: value2.slice(0, value12),
      ...state,
    };
  }
  function parseCapturedBlocks(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (!Array.isArray(items)) return [];
    let items2: Dynamic = [],
      value: Dynamic = Math.min(items.length, PdfCaptureLimit_3);
    for (let index: Dynamic = 0; index < value; index++) {
      let value2: Dynamic = items[index];
      items2.push(
        PdfCaptureHas(value2)
          ? value2
          : parseCapturedFigure(value2, options, context),
      );
    }
    return items2;
  }
  function remapCapturedTextBlocks(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set();
    for (let value of input as Dynamic) {
      let value2: Dynamic =
        value.b === undefined ? undefined : options[value.b];
      typeof value2 == "string" &&
        !(value2 === "L" && value.i === undefined) &&
        values.add(value.b);
    }
    let items: Dynamic = [],
      entries: Dynamic = new Map();
    options.forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
      if (
        !(
          items.length >= runtime.PdfTextOperatorsLimit_2 ||
          input2 === undefined
        )
      ) {
        if (typeof input2 == "string") {
          if (!values.has(options2)) return;
          entries.set(options2, items.length);
          items.push({
            role: input2,
          });
        } else if (
          context === undefined ||
          (input2.y >= context.y0 && input2.y < context.y1)
        ) {
          let value: Dynamic =
              context === undefined
                ? input2.y
                : Math.max(input2.y, context.base ?? context.y0),
            value2: Dynamic =
              context === undefined
                ? value
                : value - (context.base ?? context.y0) + context.off,
            value3: Dynamic =
              context === undefined
                ? input2.h
                : Math.min(input2.y + input2.h, context.y1) - value;
          if (!(value3 > 0)) return;
          let state: Dynamic = {
            role: "Figure",
            ...(input2.a !== undefined
              ? {
                  alt: input2.a,
                }
              : {}),
            ...(input2.l !== undefined
              ? {
                  link: input2.l,
                }
              : {}),
            x: input2.x,
            y: value2,
            w: input2.w,
            h: value3,
          };
          items.push(state);
        }
      }
    });
    return {
      textRuns: input.map((input2?: Dynamic): Dynamic => {
        let { b: value, i: value2, sp: value3, ...value4 }: Dynamic = input2,
          value5: Dynamic =
            value === undefined ? undefined : entries.get(value),
          value6: Dynamic = value !== undefined && options[value] === "L";
        if (value5 === undefined || (value6 && value2 === undefined))
          return value4;
        let value7: Dynamic = value6
          ? {
              ...value4,
              b: value5,
              i: value2,
            }
          : {
              ...value4,
              b: value5,
            };
        value3 !== undefined && (value7.sp = value3);
        return value7;
      }),
      blocks: items,
    };
  }
  function normalizeCaptureLanguage(input?: Dynamic): Dynamic {
    return (0, runtime.isLanguageTag)(input) ? input : undefined;
  }
  function parseCapturedLinks(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (!Array.isArray(items)) return [];
    let items2: Dynamic = [],
      value: Dynamic = Math.min(items.length, 4 * PdfCaptureLimit_4);
    for (
      let index: Dynamic = 0;
      index < value && items2.length < PdfCaptureLimit_4;
      index++
    ) {
      let value2: Dynamic = items[index];
      if (typeof value2 != "object" || value2 === null) continue;
      let {
          u: value3,
          x: value4,
          y: value5,
          w: value6,
          h: value7,
          a: value8,
        }: Dynamic = value2,
        value9: Dynamic = (0, runtime.normalizePdfLink)(value3);
      if (
        value9 === undefined ||
        typeof value4 != "number" ||
        typeof value5 != "number" ||
        typeof value6 != "number" ||
        typeof value7 != "number"
      )
        continue;
      let value10: Dynamic = Math.max(0, value4),
        value11: Dynamic = Math.max(0, value5),
        value12: Dynamic = Math.min(options, value4 + value6),
        value13: Dynamic = Math.min(context, value5 + value7);
      if (!(value12 - value10 >= 1 && value13 - value11 >= 1)) continue;
      let state: Dynamic = {
        u: value9,
        x: value10,
        y: value11,
        w: value12 - value10,
        h: value13 - value11,
      };
      typeof value8 == "number" &&
        Number.isInteger(value8) &&
        value8 >= 0 &&
        value8 < PdfCaptureLimit_4 &&
        (state.a = value8);
      items2.push(state);
    }
    return items2;
  }
  function clipCapturedLinks(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return input.flatMap((input2?: Dynamic): Dynamic => {
      let value2: Dynamic = Math.max(input2.y, options),
        value3: Dynamic = Math.min(input2.y + input2.h, context);
      return value3 - value2 >= 1
        ? [
            {
              ...input2,
              y: value2 - options + value,
              h: value3 - value2,
            },
          ]
        : [];
    });
  }
  async function captureArtboardPdfPages(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = {
      flow: false,
    },
    value: Dynamic = false,
  ): Promise<Dynamic> {
    let value2: Dynamic = value
        ? context?.flow
          ? runtime.ExportDeliveryCapMsFinishAnimationsConfig
          : runtime.ExportDeliveryCapMsFinishAnimationsEagerImagesConfig
        : null,
      value3: Dynamic = await (0, runtime.lockCaptureViewport)(
        input,
        options,
        value2,
      ),
      release: Dynamic = value3.release,
      settleMs: Dynamic = value3.settleMs;
    try {
      let flag: Dynamic = false;
      context?.flow &&
        context.ifScrolls &&
        (await input
          .executeJavaScript(
            "Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0)>" +
              String(Number(options.h) + 4),
            2e3,
          )
          .catch((): Dynamic => null)) !== true &&
        ((context = {
          flow: false,
        }),
        (flag = true));
      let value4: Dynamic = context?.flow ? PdfCaptureLimit_2 : 1,
        value5: Dynamic =
          context?.flow && context.pageH
            ? {
                w: options.w,
                h: context.pageH,
              }
            : options,
        value6: Dynamic = context?.flow
          ? Math.round(value5.h * PdfCaptureConstant_3)
          : 0,
        callback: Dynamic = async (
          input2?: Dynamic,
          options2?: Dynamic,
          context2?: Dynamic,
        ): Promise<Dynamic> => {
          let value24: Dynamic = (0, runtime.buildCaptureScript)(
              "image/jpeg",
              PdfCaptureConstant,
              0,
              input2,
              false,
              false,
              0,
              "",
              false,
              true,
              false,
              "",
              "body",
              "",
              false,
              true,
              value5,
              context && {
                h: value5.h,
                max: value4,
                margin: value6,
                from: options2,
                count: PdfCaptureConstant_4,
                tops: context2,
              },
            ),
            value25: Dynamic;
          try {
            let value26: Dynamic =
              15e3 + (context?.flow ? 4e3 * PdfCaptureConstant_4 : 0);
            value25 = await input.executeJavaScript(value24, value26);
          } catch (value26: Dynamic) {
            throw (
              console.error("[pdf-export] capture failed:", value26),
              new Error("its page hit an error while it was being drawn")
            );
          }
          return typeof value25 == "object" && value25 !== null
            ? value25
            : null;
        },
        callback2: Dynamic = (items?: Dynamic): Dynamic =>
          typeof items == "string" &&
          items.length <= PdfCaptureLimit_5 &&
          items.startsWith("data:image/jpeg;base64,"),
        callback3: Dynamic = (items?: Dynamic): Dynamic => {
          if (
            !Array.isArray(items) ||
            items.length < 1 ||
            items.length > value4 ||
            items[0] !== 0
          )
            return null;
          for (let count: Dynamic = 1; count < items.length; count++) {
            let value24: Dynamic = items[count];
            if (
              typeof value24 != "number" ||
              !Number.isFinite(value24) ||
              !(value24 > items[count - 1])
            )
              return null;
          }
          return items;
        },
        callback4: Dynamic = async (input2?: Dynamic): Promise<Dynamic> => {
          let value24: Dynamic = await callback(input2, 0);
          if (!context || !value24 || "e" in value24)
            return {
              res: value24,
              uris: value24 && "u" in value24 ? [value24.u] : [],
            };
          let value25: Dynamic = callback3(value24.pt),
            value26: Dynamic = callback3(value24.pc);
          if (
            value25 === null ||
            value26 === null ||
            value26.length !== value25.length ||
            !Array.isArray(value24.pg)
          )
            throw new Error(
              "its preview returned no usable pages; reload it and try again",
            );
          let value27: Dynamic = value24.pg.slice(0, value25.length),
            count: Dynamic = 1,
            callback6: Dynamic = (): Dynamic =>
              value27.reduce(
                (input3?: Dynamic, items?: Dynamic): Dynamic =>
                  input3 + (typeof items == "string" ? items.length : 0),
                0,
              ) <= PdfCaptureLimit_6;
          if (!callback6())
            throw new Error("the pages are too large to export");
          for (
            ;
            value27.length < value25.length && value27.every(callback2);

          ) {
            if (++count > Math.ceil(value4 / PdfCaptureConstant_4) + 1)
              throw new Error(runtime.ExportCaptureViewportLabel);
            let value28: Dynamic = await callback(
                input2,
                value27.length,
                value26,
              ),
              value29: Dynamic =
                value28 && !("e" in value28) && Array.isArray(value28.pg)
                  ? value28.pg.slice(0, value25.length - value27.length)
                  : [];
            if (
              value29.length === 0 ||
              !value28 ||
              "e" in value28 ||
              typeof value28.lh != "number" ||
              typeof value24.lh != "number" ||
              !(Math.abs(value28.lh - value24.lh) <= 4)
            )
              throw new Error(runtime.ExportCaptureViewportLabel);
            if (!value29.every(callback2))
              throw new Error(
                "a page image came back empty; it may be too large to export",
              );
            value27.push(...value29);
            if (!callback6())
              throw new Error("the pages are too large to export");
          }
          return {
            res: value24,
            uris: value27,
          };
        };
      context?.flow &&
        (await input
          .executeJavaScript(
            "window.__omCaptureCache={};window.__omCaptureFontCss=null;null",
            5e3,
          )
          .catch((): Dynamic => {}));
      let flag2: Dynamic = false,
        callback5: Dynamic = (input2?: Dynamic): Dynamic =>
          callback4(input2).catch(
            async (input3?: Dynamic): Promise<Dynamic> => {
              if (
                value2 === null ||
                flag2 ||
                !(input3 instanceof Error) ||
                input3.message !== runtime.ExportCaptureViewportLabel
              )
                throw input3;
              flag2 = true;
              let value24: Dynamic = Date.now();
              await input.awaitSettled(value2);
              settleMs += Date.now() - value24;
              await input
                .executeJavaScript("window.__omCaptureFontCss=null;null", 5e3)
                .catch((): Dynamic => {});
              return callback4(input2);
            },
          ),
        value7: Dynamic = context?.maxScale ?? PdfCaptureLimit,
        flag3: Dynamic = false,
        { res: value8, uris: value9 }: Dynamic = await callback5(value7),
        value10: Dynamic = (0, runtime.collectCaptureWarnings)(
          [],
          value8,
          runtime.ExportCaptureWarningsItems_2,
        );
      for (let value24 of [2, 1].filter(
        (input2?: Dynamic): Dynamic => input2 < value7,
      ) as Dynamic) {
        if (
          !value8 ||
          "e" in value8 ||
          (value9.length > 0 && value9.every(callback2))
        )
          break;
        value7 = value24;
        flag3 = true;
        ({ res: value8, uris: value9 } = await callback5(value24));
        value10 = (0, runtime.collectCaptureWarnings)(
          value10,
          value8,
          runtime.ExportCaptureWarningsItems_2,
        );
      }
      if (!value8)
        throw new Error(
          "its preview returned no image; reload it and try again",
        );
      if ("e" in value8) {
        if (value8.e !== "no-selection" && value8.e !== "zero-size")
          throw new Error(
            "its preview returned no image; reload it and try again",
          );
        return {
          ok: false,
          softError: value8.e,
        };
      }
      let value11: Dynamic = (0, runtime.countMatchingExportWarnings)(
          value8.w,
          runtime.ExportCaptureWarningsItems,
        ),
        value12: Dynamic = (0, runtime.normalizeExportWarnings)(value8.hc),
        length: Dynamic = value10.length,
        state: Dynamic = {
          ...(length
            ? {
                fontWarningCount: length,
              }
            : {}),
          ...(flag3
            ? {
                scaledDown: true,
              }
            : {}),
        },
        value13: Dynamic = value9.filter(callback2);
      if (value13.length === 0 || value13.length !== value9.length)
        throw new Error(
          "a page image came back empty; it may be too large to export",
        );
      let value14: Dynamic =
          typeof value8.cw == "number" && Number.isInteger(value8.cw)
            ? value8.cw
            : 0,
        value15: Dynamic =
          typeof value8.ch == "number" && Number.isInteger(value8.ch)
            ? value8.ch
            : 0;
      if (value14 <= 0 || value15 <= 0 || value14 > 1e6 || value15 > 1e6)
        throw new Error("its preview returned an image with no usable size");
      let value16: Dynamic =
          Array.isArray(value8.w) &&
          value8.w.some(
            (input2?: Dynamic): Dynamic =>
              input2 === "links could not be measured" ||
              input2 === "some links were left out",
          ),
        value17: Dynamic =
          value8.tt === true ||
          (Array.isArray(value8.w) &&
            value8.w.some(
              (input2?: Dynamic): Dynamic =>
                input2 === "text layer could not be measured",
            )),
        value18: Dynamic = normalizeCaptureLanguage(value8.lg);
      if (!context) {
        let value24: Dynamic =
            typeof value8.lh == "number" && value8.lh < 1e7 ? value8.lh : 0,
          value25: Dynamic = parseCapturedTextRuns(value8.t, value14, value15);
        return {
          ok: true,
          pages: [
            {
              uri: value13[0],
              ...remapCapturedTextBlocks(
                value25.runs,
                parseCapturedBlocks(value8.tb, value14, value15),
              ),
              links: parseCapturedLinks(value8.l, value14, value15),
            },
          ],
          ...(value18 !== undefined
            ? {
                lang: value18,
              }
            : {}),
          cw: value14,
          ch: value15,
          cssW: value5.w,
          cssH: Math.max(value5.h, value24 > 0 ? value24 : value15 / value7),
          embedWarningCount: value11,
          ...state,
          textPartial: value25.capped || value17,
          linksPartial: value16,
          overflowed: false,
          boxed: false,
          ...(Object.keys(value12).length > 0
            ? {
                hiddenContent: value12,
              }
            : {}),
          ...(value
            ? {
                settleMs: settleMs,
              }
            : {}),
        };
      }
      let value19: Dynamic = callback3(value8.pt);
      if (!(value19[value19.length - 1] < value4 * value15))
        throw new Error(
          "its preview returned no usable pages; reload it and try again",
        );
      let value20: Dynamic =
          typeof value8.po == "number" && value8.po >= 0 && value8.po < value15
            ? value8.po
            : 0,
        value21: Dynamic = parseCapturedTextRuns(
          value8.t,
          value14,
          value19[value19.length - 1] + value15,
        ),
        value22: Dynamic = parseCapturedBlocks(
          value8.tb,
          value14,
          value19[value19.length - 1] + value15,
        ),
        value23: Dynamic = parseCapturedLinks(
          value8.l,
          value14,
          value19[value19.length - 1] + value15,
        );
      return {
        ok: true,
        pages: value13.map((input2?: Dynamic, options2?: Dynamic): Dynamic => {
          let value24: Dynamic = options2 > 0 ? value20 : 0;
          return {
            uri: input2,
            links: clipCapturedLinks(
              value23,
              value19[options2],
              Math.min(
                options2 + 1 < value19.length ? value19[options2 + 1] : 1 / 0,
                value19[options2] + value15 - value24,
              ),
              value24,
            ),
            ...remapCapturedTextBlocks(
              value21.runs
                .filter(
                  (input3?: Dynamic): Dynamic =>
                    input3.y >= value19[options2] &&
                    (options2 + 1 === value19.length ||
                      input3.y < value19[options2 + 1]) &&
                    input3.y - value19[options2] + value24 <= value15,
                )
                .map(
                  (input3?: Dynamic): Dynamic => ({
                    ...input3,
                    y: input3.y - value19[options2] + value24,
                  }),
                ),
              value22,
              {
                y0: options2 > 0 ? value19[options2] : -1 / 0,
                y1: Math.min(
                  options2 + 1 < value19.length ? value19[options2 + 1] : 1 / 0,
                  value19[options2] + value15 - value24,
                ),
                off: value24,
                base: value19[options2],
              },
            ),
          };
        }),
        ...(value18 !== undefined
          ? {
              lang: value18,
            }
          : {}),
        cw: value14,
        ch: value15,
        cssW: value5.w,
        cssH: value5.h,
        embedWarningCount: value11,
        ...state,
        textPartial: value21.capped || value17,
        linksPartial: value16,
        overflowed: value8.pm === 1,
        boxed: value8.pm === 2,
        ...(flag
          ? {
              atFrame: true,
            }
          : {}),
        ...(Object.keys(value12).length > 0
          ? {
              hiddenContent: value12,
            }
          : {}),
        ...(value
          ? {
              settleMs: settleMs,
            }
          : {}),
      };
    } finally {
      release();
      await input
        .executeJavaScript(
          "window.__omCaptureCache=undefined;window.__omCaptureFontCss=undefined;null",
          5e3,
        )
        .catch((): Dynamic => {});
    }
  }
  bindRuntimeValue(
    runtime,
    "PdfCaptureLimit",
    () => PdfCaptureLimit,
    (value) => {
      PdfCaptureLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureConstant",
    () => PdfCaptureConstant,
    (value) => {
      PdfCaptureConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureConstant_2",
    () => PdfCaptureConstant_2,
    (value) => {
      PdfCaptureConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getPdfRasterScale",
    () => getPdfRasterScale,
    (value) => {
      getPdfRasterScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureConstant_3",
    () => PdfCaptureConstant_3,
    (value) => {
      PdfCaptureConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureConstant_4",
    () => PdfCaptureConstant_4,
    (value) => {
      PdfCaptureConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureLimit_2",
    () => PdfCaptureLimit_2,
    (value) => {
      PdfCaptureLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureLimit_3",
    () => PdfCaptureLimit_3,
    (value) => {
      PdfCaptureLimit_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureLimit_4",
    () => PdfCaptureLimit_4,
    (value) => {
      PdfCaptureLimit_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureLimit_5",
    () => PdfCaptureLimit_5,
    (value) => {
      PdfCaptureLimit_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureLimit_6",
    () => PdfCaptureLimit_6,
    (value) => {
      PdfCaptureLimit_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureConstant_5",
    () => PdfCaptureConstant_5,
    (value) => {
      PdfCaptureConstant_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureLimit_7",
    () => PdfCaptureLimit_7,
    (value) => {
      PdfCaptureLimit_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCapturePH1H2Set",
    () => PdfCapturePH1H2Set,
    (value) => {
      PdfCapturePH1H2Set = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseCapturedTextRuns",
    () => parseCapturedTextRuns,
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureHas",
    () => PdfCaptureHas,
    (value) => {
      PdfCaptureHas = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfCaptureConstant_6",
    () => PdfCaptureConstant_6,
    (value) => {
      PdfCaptureConstant_6 = value;
    },
  );
  bindRuntimeValue(runtime, "parseCapturedFigure", () => parseCapturedFigure);
  bindRuntimeValue(runtime, "parseCapturedBlocks", () => parseCapturedBlocks);
  bindRuntimeValue(
    runtime,
    "remapCapturedTextBlocks",
    () => remapCapturedTextBlocks,
  );
  bindRuntimeValue(
    runtime,
    "normalizeCaptureLanguage",
    () => normalizeCaptureLanguage,
  );
  bindRuntimeValue(runtime, "parseCapturedLinks", () => parseCapturedLinks);
  bindRuntimeValue(runtime, "clipCapturedLinks", () => clipCapturedLinks);
  bindRuntimeValue(
    runtime,
    "captureArtboardPdfPages",
    () => captureArtboardPdfPages,
  );
  return () => {
    PdfCaptureLimit = 3;
    PdfCaptureConstant = 0.9;
    PdfCaptureConstant_2 = 2550;
    getPdfRasterScale = (input?: Dynamic): Dynamic => {
      let value: Dynamic = Math.ceil(PdfCaptureConstant_2 / input);
      return value >= PdfCaptureLimit ? PdfCaptureLimit : value >= 2 ? 2 : 1;
    };
    PdfCaptureConstant_3 = 0.05;
    PdfCaptureConstant_4 = 6;
    PdfCaptureLimit_2 = 100;
    PdfCaptureLimit_3 = 2e4;
    PdfCaptureLimit_4 = 4e3;
    PdfCaptureLimit_5 = 64e6;
    PdfCaptureLimit_6 = 52e7;
    PdfCaptureConstant_5 = 4e3;
    PdfCaptureLimit_7 = 15e4;
    PdfCapturePH1H2Set = new Set([
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
    PdfCaptureHas = (input?: Dynamic): Dynamic =>
      typeof input == "string" && PdfCapturePH1H2Set.has(input);
    PdfCaptureConstant_6 = 1e3;
  };
}
