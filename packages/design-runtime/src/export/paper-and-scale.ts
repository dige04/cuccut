import type {
  PaperSize,
  PaperSizeName,
  ExportArtboard,
  ExportHeight,
  ImageCaptureScale,
} from "../contracts/export";
import type { Size } from "../contracts/geometry";
/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installExportPaperAndScale(
  runtime: RuntimeBindings,
): () => void {
  var paperSizes: Record<PaperSizeName, PaperSize>;
  var letterPaperRegions: Set<string>;
  var needsPagedExport: Dynamic;
  var isFillPagedExport: Dynamic;
  var exportHeightTolerance: Dynamic;
  var ExportPaperAndScaleLimit: Dynamic;
  var ExportPaperAndScaleLimit_2: Dynamic;
  var isFlowExport: Dynamic;
  var exportImageMimeTypes: Dynamic;
  var ExportPaperAndScaleConstant: Dynamic;
  function inferLocalePaperSize(
    languages: readonly (string | null | undefined)[] = typeof navigator !==
    "undefined"
      ? navigator.languages?.length
        ? navigator.languages
        : [navigator.language]
      : [],
  ): PaperSizeName {
    for (let value of languages) {
      let value2 = /^[a-z]{2,3}(?:[-_][a-z]{4})?[-_]([a-z]{2})(?:[-_]|$)/i.exec(
        value ?? "",
      )?.[1];
      if (value2)
        return letterPaperRegions.has(value2.toUpperCase()) ? "letter" : "a4";
    }
    return /^en$/i.test(languages[0] ?? "") ? "letter" : "a4";
  }
  function inferArtboardPaperSize(size: Size): PaperSizeName | undefined {
    let callback: (
      dimension: number,
      expected: number,
      tolerance: number,
    ) => boolean = (input2, options, context) =>
      Math.abs(input2 - options) <= options * context;
    for (let value of ["letter", "a4"] as readonly PaperSizeName[])
      if (callback(size.w, (paperSizes[value].wPt * 96) / 72, 0.005))
        return value;
    for (let value of ["letter", "a4"] as readonly PaperSizeName[])
      if (
        size.w > 0 &&
        callback(
          size.h / size.w,
          paperSizes[value].hPt / paperSizes[value].wPt,
          0.01,
        )
      )
        return value;
  }
  function resolveMeasuredExportHeight(
    declared: number,
    measured: number,
    naturalHeight?: number,
  ): ExportHeight {
    let value = Math.min(
      runtime.PlatformFileContentLimit_6,
      Math.ceil(measured),
    );
    if (value > Math.round(declared) + exportHeightTolerance) return value;
    if (measured > runtime.PlatformFileContentLimit_6 + exportHeightTolerance)
      return "capped";
    if (naturalHeight !== undefined && Number.isFinite(naturalHeight)) {
      let value2 = Math.ceil(naturalHeight);
      if (Math.round(declared) - value2 >= ExportPaperAndScaleLimit)
        return value2;
    }
    return "fits";
  }
  function getArtboardPaperSize(artboard: ExportArtboard): PaperSizeName {
    return (
      artboard.paper ??
      inferArtboardPaperSize(artboard) ??
      inferLocalePaperSize()
    );
  }
  function paperHeightForWidth(width: number, paper: PaperSizeName): number {
    let value = paperSizes[paper];
    return Math.round((width * value.hPt) / value.wPt);
  }
  function maxImageCaptureScale(width: number, height: number): number {
    return Math.min(
      runtime.maxCaptureEdge / Math.max(width, height, 1),
      Math.sqrt(runtime.maxCapturePixels / Math.max(width * height, 1)),
    );
  }
  function imageCaptureScaleOptions(
    width: number,
    height: number,
  ): ImageCaptureScale[] {
    let value = maxImageCaptureScale(width, height);
    return [1, 2, 3].map((input2) => ({
      scale: input2,
      outW: Math.round(width * input2),
      outH: Math.round(height * input2),
      fits: input2 <= value + 1e-9,
    }));
  }
  bindRuntimeValue(
    runtime,
    "paperSizes",
    () => paperSizes,
    (value) => {
      paperSizes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "letterPaperRegions",
    () => letterPaperRegions,
    (value) => {
      letterPaperRegions = value;
    },
  );
  bindRuntimeValue(runtime, "inferLocalePaperSize", () => inferLocalePaperSize);
  bindRuntimeValue(
    runtime,
    "inferArtboardPaperSize",
    () => inferArtboardPaperSize,
  );
  bindRuntimeValue(
    runtime,
    "needsPagedExport",
    () => needsPagedExport,
    (value) => {
      needsPagedExport = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isFillPagedExport",
    () => isFillPagedExport,
    (value) => {
      isFillPagedExport = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportHeightTolerance",
    () => exportHeightTolerance,
    (value) => {
      exportHeightTolerance = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportPaperAndScaleLimit",
    () => ExportPaperAndScaleLimit,
    (value) => {
      ExportPaperAndScaleLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportPaperAndScaleLimit_2",
    () => ExportPaperAndScaleLimit_2,
    (value) => {
      ExportPaperAndScaleLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveMeasuredExportHeight",
    () => resolveMeasuredExportHeight,
  );
  bindRuntimeValue(
    runtime,
    "isFlowExport",
    () => isFlowExport,
    (value) => {
      isFlowExport = value;
    },
  );
  bindRuntimeValue(runtime, "getArtboardPaperSize", () => getArtboardPaperSize);
  bindRuntimeValue(runtime, "paperHeightForWidth", () => paperHeightForWidth);
  bindRuntimeValue(runtime, "maxImageCaptureScale", () => maxImageCaptureScale);
  bindRuntimeValue(
    runtime,
    "imageCaptureScaleOptions",
    () => imageCaptureScaleOptions,
  );
  bindRuntimeValue(
    runtime,
    "exportImageMimeTypes",
    () => exportImageMimeTypes,
    (value) => {
      exportImageMimeTypes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportPaperAndScaleConstant",
    () => ExportPaperAndScaleConstant,
    (value) => {
      ExportPaperAndScaleConstant = value;
    },
  );
  return () => {
    paperSizes = {
      letter: {
        label: "Letter",
        wPt: 612,
        hPt: 792,
      },
      a4: {
        label: "A4",
        wPt: 595.28,
        hPt: 841.89,
      },
    };
    letterPaperRegions = new Set([
      "BZ",
      "CA",
      "CL",
      "CO",
      "CR",
      "GT",
      "MX",
      "NI",
      "PA",
      "PH",
      "PR",
      "SV",
      "US",
      "VE",
    ]);
    needsPagedExport = (input?: Dynamic): Dynamic =>
      input.print !== "flow" &&
      !input.frameless &&
      (input.expand === "fill" || inferArtboardPaperSize(input) === undefined);
    isFillPagedExport = (input?: Dynamic): Dynamic =>
      needsPagedExport(input) && input.expand === "fill";
    exportHeightTolerance = 4;
    ExportPaperAndScaleLimit = 120;
    ExportPaperAndScaleLimit_2 = 400;
    isFlowExport = (
      input?: Dynamic,
      { migrated: options = false, fillFlows: options2 = false }: Dynamic = {},
    ): Dynamic =>
      input.print === "flow" ||
      (options2 && !options && input.expand === "fill");
    exportImageMimeTypes = {
      png: "image/png",
      jpg: "image/jpeg",
    };
    ExportPaperAndScaleConstant = 320;
  };
}
