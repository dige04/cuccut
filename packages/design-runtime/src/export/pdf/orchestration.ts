/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installExportPdfOrchestration(
  runtime: RuntimeBindings,
): () => void {
  var PdfOrchestrationLimit: Dynamic;
  var ApplicationPdfValue: Dynamic;
  var PdfOrchestrationLimit_2: Dynamic;
  function capturedTextToPdfPoints(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = value / options,
      value3: Dynamic = extra / context;
    return input.map(
      (input2?: Dynamic): Dynamic => ({
        text: input2.t,
        xPt: Math.min(value, input2.x * value2),
        yPt: Math.max(0, extra - input2.y * value3),
        sizePt: Math.min(extra, input2.s * value3),
        widthPt: input2.w * value2,
        ...(input2.b !== undefined
          ? {
              block: input2.b,
            }
          : {}),
        ...(input2.i !== undefined
          ? {
              item: input2.i,
            }
          : {}),
        ...(input2.sp !== undefined
          ? {
              spaceBefore: input2.sp,
            }
          : {}),
        ...(input2.a !== undefined
          ? {
              link: input2.a,
            }
          : {}),
      }),
    );
  }
  function capturedBlocksToPdfPoints(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = value / options,
      value3: Dynamic = extra / context;
    return input.map(
      (input2?: Dynamic): Dynamic =>
        input2.role !== "Figure"
          ? {
              role: input2.role,
            }
          : {
              role: "Figure",
              ...(input2.alt !== undefined
                ? {
                    alt: input2.alt,
                  }
                : {}),
              ...(input2.link !== undefined
                ? {
                    link: input2.link,
                  }
                : {}),
              box: {
                xPt: input2.x * value2,
                yPt: extra - (input2.y + input2.h) * value3,
                widthPt: input2.w * value2,
                heightPt: input2.h * value3,
              },
            },
    );
  }
  function sharedExportLanguage(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input2.split("-")[0].toLowerCase(),
      value: Dynamic = input.filter(
        (input2?: Dynamic): Dynamic => input2 !== undefined,
      ),
      value2: Dynamic =
        value.length > 0 &&
        value.every(
          (input2?: Dynamic): Dynamic =>
            callback(input2) === callback(value[0]),
        )
          ? value[0]
          : undefined,
      value3: Dynamic =
        options +
        `
` +
        context.flatMap(
          (input2?: Dynamic): Dynamic =>
            (input2.textRuns ?? []).map(
              (input3?: Dynamic): Dynamic => input3.text,
            ),
        ).join(`
`),
      value4: Dynamic =
        value.length === 0
          ? (0, runtime.inferPdfLanguage)(value3)
          : (0, runtime.inferPdfLanguage)(value3, value2 ?? "und");
    return value2 === undefined
      ? value4
      : callback(value4) === callback(value2) ||
          (callback(value2) !== "en" &&
            callback(
              (0, runtime.inferPdfLanguage)(
                value3.replace(/[^\p{L}]+/gu, ""),
                value2,
              ),
            ) === callback(value2))
        ? value2
        : value4;
  }
  function capturedLinksToPdfPoints(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = value / options,
      value3: Dynamic = extra / context;
    return input.map(
      (input2?: Dynamic): Dynamic => ({
        uri: input2.u,
        xPt: input2.x * value2,
        yPt: extra - (input2.y + input2.h) * value3,
        widthPt: input2.w * value2,
        heightPt: input2.h * value3,
        ...(input2.a !== undefined
          ? {
              anchor: input2.a,
            }
          : {}),
      }),
    );
  }
  function pdfExportFileName(input?: Dynamic): Dynamic {
    return ((0, runtime.sanitizeExportFileName)(input) || "design") + ".pdf";
  }
  async function collectPdfExportPages(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = {},
  ): Promise<Dynamic> {
    let value2: Dynamic = value.capture ?? runtime.captureArtboardPdfPages,
      value3: Dynamic = value.resolveHandle ?? runtime.createPreviewHandle,
      value4: Dynamic = value.measureTail ?? runtime.measureEmptyExportTail,
      index: Dynamic = 0,
      index2: Dynamic = 0,
      items: Dynamic = [],
      items2: Dynamic = [],
      items3: Dynamic = [],
      items4: Dynamic = [],
      items5: Dynamic = [],
      items6: Dynamic = [],
      items7: Dynamic = [],
      items8: Dynamic = [],
      index3: Dynamic = 0,
      index4: Dynamic = 0,
      index5: Dynamic = 0,
      index6: Dynamic = 0,
      index7: Dynamic = 0,
      items9: Dynamic = [],
      state: Dynamic = {
        innerClipped: 0,
        scrollRegion: 0,
        collapsed: 0,
        unrevealed: 0,
      },
      items10: Dynamic = [];
    for (let value8 of (0, runtime.artboardsInReadingOrder)(input) as Dynamic) {
      value.signal?.throwIfAborted();
      let value9: Dynamic = (0, runtime.exportFileName)(
          value8.file,
          value8.title,
        ),
        value10: Dynamic = await options(value8.file);
      value.signal?.throwIfAborted();
      if (value10 && value10.getBoundingClientRect().width === 0) {
        index4 += 1;
        continue;
      }
      let value11: Dynamic = value10 ? value3(value10) : null;
      if (!value11)
        throw new Error(
          '"' + value9 + '" is still loading \u2014 try again in a moment',
        );
      let value12: Dynamic = (0, runtime.isFlowExport)(
          {
            expand: value8.expand,
          },
          value.rules,
        ),
        value13: Dynamic = (0, runtime.isFlowExport)(value8, value.rules)
          ? (0, runtime.getArtboardPaperSize)(value8)
          : null,
        value14: Dynamic;
      try {
        let value19: Dynamic = value13
          ? (0, runtime.paperHeightForWidth)(value8.w, value13)
          : 0;
        value14 = await value2(
          value11,
          {
            w: value8.w,
            h: value8.h,
          },
          value13
            ? {
                flow: true,
                pageH: value19,
                ...(value12
                  ? {
                      maxScale: (0, runtime.getPdfRasterScale)(value8.w),
                      ifScrolls: value8.print !== "flow" && value8.h <= value19,
                    }
                  : {}),
              }
            : {
                flow: false,
              },
          value.rules?.settle === true &&
            index2 < runtime.ExportCaptureViewportLimit,
        );
      } catch (value19: Dynamic) {
        throw new Error(
          '"' +
            value9 +
            '" could not be captured: ' +
            (value19 instanceof Error ? value19.message : String(value19)),
        );
      }
      if (!value14.ok) {
        if (value14.softError === "zero-size") {
          index4 += 1;
          continue;
        }
        throw new Error('"' + value9 + '" could not be captured');
      }
      value14.atFrame && (value13 = null);
      let value15: Dynamic = value14.pages.map((input2?: Dynamic): Dynamic => {
          let value19: Dynamic = (0, runtime.decodeJpegDataUrl)(input2.uri);
          try {
            if (value19 === undefined) throw new Error("not a JPEG data URI");
            (0, runtime.readJpegDimensions)(value19);
          } catch (value20: Dynamic) {
            throw new Error(
              '"' +
                value9 +
                '" produced an unreadable capture: ' +
                (value20 instanceof Error ? value20.message : String(value20)),
            );
          }
          return value19;
        }),
        value16: Dynamic = value13
          ? runtime.paperSizes[value13].wPt
          : (0, runtime.pixelsToPoints)(value14.cssW),
        value17: Dynamic = value13
          ? runtime.paperSizes[value13].hPt
          : (0, runtime.pixelsToPoints)(value14.cssH),
        value18: Dynamic = Math.max(value16, value17);
      value18 > PdfOrchestrationLimit_2 &&
        (value16 >= value17
          ? ((value17 = Math.min(
              PdfOrchestrationLimit_2,
              (value17 * PdfOrchestrationLimit_2) / value18,
            )),
            (value16 = PdfOrchestrationLimit_2))
          : ((value16 = Math.min(
              PdfOrchestrationLimit_2,
              (value16 * PdfOrchestrationLimit_2) / value18,
            )),
            (value17 = PdfOrchestrationLimit_2)));
      if (!(value16 >= 3 && value17 >= 3))
        throw new Error(
          '"' + value9 + '" is too small to export as a PDF page',
        );
      index5 += value14.embedWarningCount;
      index6 += value14.fontWarningCount ?? 0;
      index2 += value14.settleMs ?? 0;
      value14.scaledDown && (index7 += 1);
      value14.textPartial && items9.push(value9);
      for (let value19 of [
        "innerClipped",
        "scrollRegion",
        "collapsed",
        "unrevealed",
      ] as Dynamic)
        (value14.hiddenContent?.[value19] ?? 0) > 0 && (state[value19] += 1);
      value14.linksPartial &&
        console.warn(
          '[pdf-export] "' +
            value9 +
            '": some links are not clickable in the PDF',
        );
      value14.overflowed
        ? (value13
            ? value14.pages.length >= runtime.PdfCaptureLimit_2
              ? items5
              : items6
            : items3
          ).push(value9)
        : value14.boxed && items6.push(value9);
      value14.overflowed && !value13 && items4.push(value8.file);
      if (
        value12 &&
        value14.atFrame === true &&
        !value14.overflowed &&
        (0, runtime.isFillPagedExport)(value8) &&
        index < PdfOrchestrationLimit
      ) {
        let value19: Dynamic = Date.now(),
          value20: Dynamic = await value4(value11, {
            w: value8.w,
            h: value8.h,
          }).catch((): Dynamic => null);
        index += Date.now() - value19;
        value.signal?.throwIfAborted();
        value20 !== null &&
          value20 >= runtime.ExportPaperAndScaleLimit_2 &&
          (items7.push(value9),
          items8.push(value8.file),
          (index3 = Math.max(index3, value20)));
      }
      items2.push(value9);
      items10.push(value14.lang);
      value14.pages.forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
        items.push({
          jpeg: value15[options2],
          widthPt: value16,
          heightPt: value17,
          textRuns: capturedTextToPdfPoints(
            input2.textRuns,
            value14.cw,
            value14.ch,
            value16,
            value17,
          ),
          links: capturedLinksToPdfPoints(
            input2.links ?? [],
            value14.cw,
            value14.ch,
            value16,
            value17,
          ),
          ...(input2.blocks !== undefined
            ? {
                blocks: capturedBlocksToPdfPoints(
                  input2.blocks,
                  value14.cw,
                  value14.ch,
                  value16,
                  value17,
                ),
              }
            : {}),
        });
      });
    }
    if (items.length === 0)
      throw new Error(
        index4 > 0
          ? "every artboard is hidden while one is expanded \u2014 collapse it to export"
          : "there are no artboards to export",
      );
    let value5: Dynamic = pdfExportFileName(context),
      state2: Dynamic = {
        title: context,
        textEncoding: value.textEncoding,
      },
      value6: Dynamic =
        value.tagged === true
          ? {
              ...state2,
              tagged: true,
              lang: sharedExportLanguage(items10, context, items),
            }
          : state2,
      value7: Dynamic;
    try {
      value7 = (0, runtime.buildPdfDocument)(items, value6);
    } catch (value8: Dynamic) {
      try {
        if (value6 === state2) throw value8;
        value7 = (0, runtime.buildPdfDocument)(items, state2);
        console.warn(
          "[pdf-export] the PDF writer rejected the accessibility tags; the file was written without them:",
          value8,
        );
      } catch (value9: Dynamic) {
        if (
          !items.some(
            (input2?: Dynamic): Dynamic =>
              input2.textRuns !== undefined && input2.textRuns.length > 0,
          )
        )
          throw value9;
        value7 = (0, runtime.buildPdfDocument)(
          items.map(
            (input2?: Dynamic): Dynamic => ({
              jpeg: input2.jpeg,
              widthPt: input2.widthPt,
              heightPt: input2.heightPt,
              links: input2.links,
            }),
          ),
          state2,
        );
        items9 = items2.slice();
      }
    }
    return {
      blob: new Blob([value7.slice().buffer], {
        type: ApplicationPdfValue,
      }),
      exported: items2.length,
      pages: items.length,
      clipped: items3,
      clippedFiles: items4,
      capped: items5,
      emptyTail: items7,
      emptyTailFiles: items8,
      emptyTailPx: index3,
      boxed: items6,
      hidden: index4,
      filename: value5,
      embedWarningCount: index5,
      fontWarningCount: index6,
      scaledDown: index7,
      textPartial: items9,
      hiddenContent: state,
    };
  }
  function pdfExportWarnings(input?: Dynamic): Dynamic {
    return {
      blankImages: input.embedWarningCount,
      clipped: input.clipped.length > 0,
      flowOverflow: input.capped.length > 0 || input.boxed.length > 0,
      hiddenSkipped: input.hidden,
      fontFallback: input.fontWarningCount,
      scaledDown: input.scaledDown > 0,
      ...input.hiddenContent,
    };
  }
  async function exportPdf(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = {},
  ): Promise<Dynamic> {
    if (await (0, runtime.downloadsWithheld)())
      return {
        exported: 0,
        pages: 0,
        clipped: [],
        clippedFiles: [],
        capped: [],
        boxed: [],
        emptyTail: [],
        emptyTailFiles: [],
        emptyTailPx: 0,
        hidden: 0,
        filename: pdfExportFileName(context),
        embedWarningCount: 0,
        fontWarningCount: 0,
        scaledDown: 0,
        textPartial: [],
        hiddenContent: {
          innerClipped: 0,
          scrollRegion: 0,
          collapsed: 0,
          unrevealed: 0,
        },
        saveOutcome: "withheld",
      };
    let { blob: value2, ...value3 }: Dynamic = await collectPdfExportPages(
      input,
      options,
      context,
      value,
    );
    (0, runtime.reportExportBuilt)({
      ...pdfExportWarnings(value3),
      ...value.scope,
    });
    let { filename: value4, embedWarningCount: value5 }: Dynamic = value3,
      value6: Dynamic =
        value5 > 0 ? null : await (0, runtime.saveThroughHost)(value2, value4),
      value7: Dynamic = value6?.outcome ?? "unsupported";
    if (value7 === "unsupported") {
      try {
        let value8: Dynamic = (document as Dynamic).createElement("a");
        value8.href = URL.createObjectURL(value2);
        value8.download = value4;
        value8.rel = "noopener";
        value8.style.display = "none";
        (document as Dynamic).body.appendChild(value8);
        value8.click();
        value8.remove();
        setTimeout((): Dynamic => URL.revokeObjectURL(value8.href), 6e4);
      } catch {}
      (window as Dynamic).dispatchEvent(
        new CustomEvent(runtime.exportDeliveryEventName, {
          detail: {
            url: "",
            filename: value4,
            embedWarningCount: value5,
            file: {
              blob: value2,
              mime: ApplicationPdfValue,
            },
            refusal: value6?.code,
          },
        }),
      );
    }
    return {
      ...value3,
      saveOutcome: value7,
    };
  }
  function pdfExportMessage(
    input?: Dynamic,
    options?: Dynamic,
    {
      embeds: context = false,
      fitOffered: context2 = false,
      fitAdvice: context3 = false,
      fonts: context4 = true,
    }: Dynamic = {},
  ): Dynamic {
    let items: Dynamic = [];
    input.hidden > 0 &&
      items.push(
        "Exported " +
          String(input.exported) +
          " of " +
          String(options) +
          " artboards \u2014 " +
          String(input.hidden) +
          (input.hidden === 1 ? " is" : " are") +
          " hidden while an artboard is expanded (collapse to export all).",
      );
    context &&
      input.embedWarningCount > 0 &&
      items.push(
        input.embedWarningCount === 1
          ? "1 image could not be embedded and renders blank in the PDF."
          : String(input.embedWarningCount) +
              " images could not be embedded and render blank in the PDF.",
      );
    let value: Dynamic = runtime.formatArtboardNames;
    input.textPartial.length > 0 &&
      items.push(
        "Some text on " +
          value(input.textPartial) +
          " can't be selected in the PDF (it still shows on the page).",
      );
    if (input.clipped.length > 0) {
      let value2: Dynamic = input.clipped.length === 1;
      items.push(
        value(input.clipped) +
          (value2
            ? " runs past its frame, so the PDF keeps one page"
            : " run past their frames, so the PDF keeps one page each") +
          (context2 ? "." : " \u2014 set Print mode to Flow to paginate."),
      );
    }
    input.capped.length > 0 &&
      items.push(
        value(input.capped) +
          " stopped at " +
          String(runtime.PdfCaptureLimit_2) +
          " pages.",
      );
    input.emptyTail.length > 0 &&
      items.push(
        (0, runtime.emptyExportTailMessage)(
          input.emptyTail,
          input.emptyTailPx,
          context3,
        ),
      );
    context4 &&
      items.push(
        ...(0, runtime.fontSubstitutionWarnings)(input.fontWarningCount),
      );
    input.boxed.length > 0 &&
      items.push(
        value(input.boxed) +
          (input.boxed.length === 1 ? " has" : " have") +
          " content past the frame that isn\u2019t in the PDF (it sits where pages can\u2019t reach: clipped, or positioned outside the flow).",
      );
    return items;
  }
  async function exportPdfWithFeedback(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra: Dynamic = {},
    detail?: Dynamic,
  ): Promise<Dynamic> {
    try {
      let value2: Dynamic = await exportPdf(items, options, context, extra);
      (0, runtime.reportExportOutcome)(
        (0, runtime.classifyExportSaveOutcome)("pdf", value2.saveOutcome),
        runtime.designAnalyticsEvents.exported.pdf,
      );
      if (value2.saveOutcome === "withheld") {
        value(runtime.DownloadsArenTAvailableToYouForMessage);
        return;
      }
      let items2: Dynamic = [...value2.clippedFiles, ...value2.emptyTailFiles],
        value3: Dynamic = detail ? items2.filter(detail.eligible) : [],
        value4: Dynamic = value3.length < items2.length,
        value5: Dynamic =
          detail && value3.length > 0
            ? detail.action(
                value3,
                value4,
                value2.saveOutcome === "unsupported",
              )
            : undefined,
        value6: Dynamic = pdfExportMessage(value2, items.length, {
          fitOffered: value3.length > 0 && !value4,
          fonts: value2.saveOutcome !== "declined",
        }),
        value7: Dynamic =
          value2.saveOutcome === "saved"
            ? "Saved " + value2.filename + "."
            : value6.shift();
      if (value7 === undefined) return;
      value(
        value7,
        value2.saveOutcome === "saved" ? "success" : undefined,
        value6.length > 0 || value5 !== undefined
          ? {
              ...(value6.length > 0
                ? {
                    description: value6.join(" "),
                  }
                : {}),
              ...(value5 !== undefined
                ? {
                    action: value5,
                    pinned: true,
                  }
                : {}),
            }
          : undefined,
      );
    } catch (value2: Dynamic) {
      runtime.healthReporter.report(
        ...(0, runtime.classifyExportFailure)("pdf"),
      );
      (0, runtime.reportExportEvent)("failed");
      value(
        "PDF export failed \u2014 " +
          (value2 instanceof Error ? value2.message : String(value2)) +
          ".",
        "error",
      );
    }
  }
  bindRuntimeValue(
    runtime,
    "PdfOrchestrationLimit",
    () => PdfOrchestrationLimit,
    (value) => {
      PdfOrchestrationLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ApplicationPdfValue",
    () => ApplicationPdfValue,
    (value) => {
      ApplicationPdfValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PdfOrchestrationLimit_2",
    () => PdfOrchestrationLimit_2,
    (value) => {
      PdfOrchestrationLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "capturedTextToPdfPoints",
    () => capturedTextToPdfPoints,
  );
  bindRuntimeValue(
    runtime,
    "capturedBlocksToPdfPoints",
    () => capturedBlocksToPdfPoints,
  );
  bindRuntimeValue(runtime, "sharedExportLanguage", () => sharedExportLanguage);
  bindRuntimeValue(
    runtime,
    "capturedLinksToPdfPoints",
    () => capturedLinksToPdfPoints,
  );
  bindRuntimeValue(runtime, "pdfExportFileName", () => pdfExportFileName);
  bindRuntimeValue(
    runtime,
    "collectPdfExportPages",
    () => collectPdfExportPages,
  );
  bindRuntimeValue(runtime, "pdfExportWarnings", () => pdfExportWarnings);
  bindRuntimeValue(runtime, "exportPdf", () => exportPdf);
  bindRuntimeValue(runtime, "pdfExportMessage", () => pdfExportMessage);
  bindRuntimeValue(
    runtime,
    "exportPdfWithFeedback",
    () => exportPdfWithFeedback,
  );
  return () => {
    PdfOrchestrationLimit = 6e3;
    ApplicationPdfValue = "application/pdf";
    PdfOrchestrationLimit_2 = 14400;
  };
}
