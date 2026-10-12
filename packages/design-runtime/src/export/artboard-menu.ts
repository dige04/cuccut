/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installExportArtboardMenu(
  runtime: RuntimeBindings,
): () => void {
  var exportSelectionHint: Dynamic;
  var noExportableArtboardsMessage: Dynamic;
  function selectedExportableArtboards(
    artboards?: Dynamic,
    pickedFiles?: Dynamic,
  ): Dynamic {
    return artboards.filter(
      (input?: Dynamic): Dynamic =>
        !input.frameless && pickedFiles.has(input.file),
    );
  }
  function artboardExportMenuItems(
    file?: Dynamic,
    artboards?: Dynamic,
    callbacks?: Dynamic,
    pickedFiles: Dynamic = new Set(),
    extra: Dynamic = {},
  ): Dynamic {
    let value: Dynamic = artboards.find(
      (input?: Dynamic): Dynamic => input.file === file,
    );
    if (!value || !callbacks.onExportArtboard) return [];
    let onExportArtboard: Dynamic = callbacks.onExportArtboard,
      value2: Dynamic = (0, runtime.imageCaptureScaleOptions)(value.w, value.h),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value4: Dynamic = value2.find(
          (input2?: Dynamic): Dynamic => input2.scale === input,
        );
        return {
          label: "PNG " + String(input) + "\xD7",
          description: value4
            ? String(value4.outW) +
              ((0, runtime.getArtboardCaptureMode)(value, extra) === "full"
                ? " px wide, full length"
                : " \xD7 " + String(value4.outH) + " px") +
              (value4.fits ? "" : " \u2014 too large")
            : undefined,
          disabled: value4 ? !value4.fits : false,
          onSelect: (): Dynamic => onExportArtboard(file, input),
        };
      },
      value3: Dynamic = artboards.filter(
        (input?: Dynamic): Dynamic => !input.frameless,
      ),
      length: Dynamic = value3.length,
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        (0, runtime.isFlowExport)(input, extra)
          ? input.print === "flow" ||
            input.h >
              (0, runtime.paperHeightForWidth)(
                input.w,
                (0, runtime.getArtboardPaperSize)(input),
              )
            ? "pages"
            : "scrolls"
          : "page",
      callback3: Dynamic = (input?: Dynamic): Dynamic =>
        runtime.paperSizes[(0, runtime.getArtboardPaperSize)(input)].label +
        " pages",
      items: Dynamic = [callback(1), callback(2)];
    if (callbacks.onExportArtboardPdf) {
      let onExportArtboardPdf: Dynamic = callbacks.onExportArtboardPdf,
        value4: Dynamic = callback2(value);
      items.push({
        label: "PDF (.pdf)",
        description:
          value4 === "page"
            ? "One page at this artboard\u2019s size"
            : value4 === "pages"
              ? "Paginated onto " + callback3(value)
              : "One page, or " + callback3(value) + " if it scrolls",
        onSelect: (): Dynamic => onExportArtboardPdf(file),
      });
    }
    if (callbacks.onExportArtboardHtmlZip) {
      let onExportArtboardHtmlZip: Dynamic = callbacks.onExportArtboardHtmlZip;
      items.push({
        label: "HTML (.zip)",
        description: "Page + its images and runtime",
        onSelect: (): Dynamic => onExportArtboardHtmlZip(file),
      });
    }
    if (callbacks.onExportAllArtboardsPdf) {
      let onExportAllArtboardsPdf: Dynamic = callbacks.onExportAllArtboardsPdf;
      items.push({
        label: "All artboards (.pdf)",
        description:
          length === 1
            ? (
                {
                  page: "1 artboard, one PDF page",
                  pages: "1 artboard, paginated onto " + callback3(value3[0]),
                  scrolls:
                    "1 artboard: one page, or " +
                    callback3(value3[0]) +
                    " if it scrolls",
                } as Dynamic
              )[callback2(value3[0])]
            : length === 0
              ? undefined
              : "All " +
                String(length) +
                " artboards in order of canvas position",
        separatorBefore: true,
        disabled: length === 0,
        disabledReason: noExportableArtboardsMessage,
        onSelect: (): Dynamic => onExportAllArtboardsPdf(),
      });
    }
    if (callbacks.onExportSelectedArtboardsPdf) {
      let onExportSelectedArtboardsPdf: Dynamic =
          callbacks.onExportSelectedArtboardsPdf,
        length2: Dynamic = selectedExportableArtboards(
          artboards,
          pickedFiles,
        ).length,
        value4: Dynamic = length2 >= 2;
      items.push({
        label: "Selected artboards (.pdf)",
        description: value4
          ? String(length2) + " artboards in order of canvas position"
          : undefined,
        separatorBefore: !callbacks.onExportAllArtboardsPdf,
        disabled: !value4,
        disabledReason: exportSelectionHint,
        onSelect: value4
          ? (): Dynamic => onExportSelectedArtboardsPdf()
          : undefined,
      });
    }
    return items;
  }
  bindRuntimeValue(
    runtime,
    "exportSelectionHint",
    () => exportSelectionHint,
    (value) => {
      exportSelectionHint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noExportableArtboardsMessage",
    () => noExportableArtboardsMessage,
    (value) => {
      noExportableArtboardsMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectedExportableArtboards",
    () => selectedExportableArtboards,
  );
  bindRuntimeValue(
    runtime,
    "artboardExportMenuItems",
    () => artboardExportMenuItems,
  );
  return () => {
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializePlatformCdsIsland)();
    exportSelectionHint = "Select two or more artboards to export only those.";
    noExportableArtboardsMessage =
      "Nothing to export on this page \u2014 loose pieces aren\u2019t pages.";
  };
}
