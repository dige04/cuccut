/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportImage(runtime: RuntimeBindings): () => void {
  async function captureArtboardImage(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = 2,
    value?: Dynamic,
  ): Promise<Dynamic> {
    try {
      await value?.onBeforeCapture?.();
      let value2: Dynamic = value?.frame,
        value3: Dynamic =
          value2 !== undefined &&
          Number.isFinite(value2.w) &&
          Number.isFinite(value2.h) &&
          value2.w > 0 &&
          value2.h > 0,
        value4: Dynamic =
          value?.clipToFrame && value3
            ? {
                h: value2.h,
                max: 1,
                count: 1,
              }
            : null,
        value5: Dynamic = (0, runtime.buildCaptureScript)(
          runtime.exportImageMimeTypes[options],
          options === "jpg" ? 0.92 : 1,
          0,
          context,
          false,
          false,
          0,
          "",
          false,
          true,
          false,
          "",
          value?.selectionRoot ?? "",
          "",
          false,
          value4 !== null,
          value3
            ? {
                w: value2.w,
                h: value2.h,
                full: value?.fullLength === true && value4 === null,
              }
            : (value?.frame ?? null),
          value4,
        ),
        value6: Dynamic,
        index: Dynamic = 0;
      try {
        value6 = await (0, runtime.withCaptureViewport)(
          input,
          value?.frame,
          (input2?: Dynamic): Dynamic => (
            (index = input2),
            input.executeJavaScript(value5, 15e3)
          ),
          value?.settle === true,
        );
      } catch (value13: Dynamic) {
        throw (
          console.error("[selection-export] capture failed:", value13),
          new Error((0, runtime.describeCaptureFailure)(value13))
        );
      }
      if (typeof value6 != "object" || value6 === null)
        throw new Error(
          "its preview returned no image; reload it and try again",
        );
      let value7: Dynamic = value6;
      if ("e" in value7) {
        if (value7.e !== "no-selection" && value7.e !== "zero-size")
          throw new Error(
            "its preview returned no image; reload it and try again",
          );
        return {
          ok: false,
          softError: value7.e,
        };
      }
      let value8: Dynamic = Array.isArray(value7.w) ? value7.w.length : 0;
      value8 && console.warn("[selection-export] capture warnings:", value7.w);
      let value9: Dynamic = (0, runtime.countMatchingExportWarnings)(
          value7.w,
          runtime.ExportCaptureWarningsItems,
        ),
        value10: Dynamic = (0, runtime.countMatchingExportWarnings)(
          value7.w,
          runtime.ExportCaptureWarningsItems_2,
        ),
        value11: Dynamic = value4
          ? Array.isArray(value7.pg)
            ? value7.pg[0]
            : undefined
          : value7.u;
      if (
        typeof value11 != "string" ||
        !value11.startsWith(
          `data:${runtime.exportImageMimeTypes[options]};base64,`,
        )
      )
        throw new Error(
          "the image came back empty; it may be too large to export at this scale",
        );
      let value12: Dynamic = (0, runtime.normalizeExportWarnings)(value7.hc);
      return {
        ok: true,
        uri: value11,
        embedWarningCount: value9,
        warnings: value8,
        ...(value10
          ? {
              fontWarningCount: value10,
            }
          : {}),
        ...(value4 !== null && value7.pm === 1
          ? {
              clipped: true,
            }
          : {}),
        ...(Object.keys(value12).length > 0
          ? {
              hiddenContent: value12,
            }
          : {}),
        ...(value?.settle
          ? {
              settleMs: index,
            }
          : {}),
      };
    } finally {
      await input
        .executeJavaScript("window.__omCaptureCache=undefined;null", 5e3)
        .catch((): Dynamic => {});
    }
  }
  async function exportArtboardImage(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = 2,
    extra?: Dynamic,
  ): Promise<Dynamic> {
    if (await (0, runtime.downloadsWithheld)()) {
      runtime.healthReporter.report(
        ...(0, runtime.classifyExportAbort)("image"),
      );
      return {
        ok: true,
        saveOutcome: "withheld",
      };
    }
    try {
      let value2: Dynamic = await captureArtboardImage(
        input,
        context,
        value,
        extra,
      );
      if (!value2.ok) {
        runtime.healthReporter.report(
          ...(0, runtime.classifyExportAbort)("image"),
        );
        return {
          ok: false,
          softError: value2.softError,
        };
      }
      let {
        uri: value3,
        embedWarningCount: value4,
        clipped: value5,
        fontWarningCount: value6,
      }: Dynamic = value2;
      (0, runtime.reportExportBuilt)({
        blankImages: value4,
        clipped: value5,
        fontFallback: value6,
        ...extra?.scope,
        ...value2.hiddenContent,
      });
      let value7: Dynamic =
          extra?.filename ??
          (extra?.selectionRoot
            ? `${(0, runtime.exportFileName)(options, extra.title)}-element.${context}`
            : (0, runtime.selectionExportFileName)(
                options,
                context,
                extra?.title,
              )),
        value8: Dynamic =
          value4 > 0
            ? null
            : await (0, runtime.saveThroughHost)(
                (0, runtime.dataUrlToBytes)(value3),
                value7,
              ),
        value9: Dynamic = value8?.outcome ?? "unsupported";
      value9 === "unsupported" &&
        ((0, runtime.triggerBrowserDownload)(value3, value7),
        (window as Dynamic).dispatchEvent(
          new CustomEvent(runtime.exportDeliveryEventName, {
            detail: {
              url: value3,
              filename: value7,
              embedWarningCount: value4,
              mime: runtime.exportImageMimeTypes[context],
              refusal: value8?.code,
            },
          }),
        ));
      (0, runtime.reportExportOutcome)(
        (0, runtime.classifyImageSaveOutcome)(value8),
        runtime.designAnalyticsEvents.exported[context],
      );
      return {
        ok: true,
        saveOutcome: value9,
        ...(value4
          ? {
              embedWarningCount: value4,
            }
          : {}),
        ...(value5
          ? {
              clipped: value5,
            }
          : {}),
        ...(value6
          ? {
              fontWarningCount: value6,
            }
          : {}),
      };
    } catch (value2: Dynamic) {
      throw (
        runtime.healthReporter.report(
          ...(0, runtime.classifyExportFailure)("image"),
        ),
        (0, runtime.reportExportEvent)("failed"),
        value2
      );
    }
  }
  async function captureArtboardThumbnail(input?: Dynamic): Promise<Dynamic> {
    try {
      let value: Dynamic = (0, runtime.buildCaptureScript)(
          "image/png",
          1,
          runtime.ExportPaperAndScaleConstant,
          0,
          false,
          false,
          0,
          "",
          false,
          true,
        ),
        value2: Dynamic = await input.executeJavaScript(value, 15e3);
      return !value2 ||
        !("u" in value2) ||
        typeof value2.u != "string" ||
        !value2.u.startsWith("data:image/png")
        ? {
            ok: false,
          }
        : {
            ok: true,
            url: value2.u,
          };
    } catch (value: Dynamic) {
      console.warn("[selection-export] preview capture failed:", value);
      return {
        ok: false,
      };
    }
  }
  bindRuntimeValue(runtime, "captureArtboardImage", () => captureArtboardImage);
  bindRuntimeValue(runtime, "exportArtboardImage", () => exportArtboardImage);
  bindRuntimeValue(
    runtime,
    "captureArtboardThumbnail",
    () => captureArtboardThumbnail,
  );
  return () => {};
}
