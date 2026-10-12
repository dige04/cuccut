/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportAnalytics(runtime: RuntimeBindings): () => void {
  var exportAnalyticsEvents: Dynamic;
  var exportDeliveryAnalyticsEvents: Dynamic;
  function sendStaggeredAnalytics(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = globalThis,
  ): Dynamic {
    input.forEach(
      (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        context.setTimeout((): Dynamic => {
          try {
            options(input2);
          } catch {}
        }, options2 * 300),
    );
  }
  function describeExportScope(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return {
      partial: options === "whole" && input < context.printable,
      singleOfMany: options === "one" && context.printable > 1,
      otherPages: context.otherPages > 0,
    };
  }
  function exportBuildAnalyticsEvents(input?: Dynamic): Dynamic {
    let value: Dynamic =
      input.picked === true
        ? [exportAnalyticsEvents.built, exportAnalyticsEvents.pickBuilt]
        : [exportAnalyticsEvents.built];
    input.partial === true && value.push(exportAnalyticsEvents.partial);
    input.singleOfMany === true &&
      value.push(exportAnalyticsEvents.singleOfMany);
    input.otherPages === true && value.push(exportAnalyticsEvents.otherPages);
    (input.blankImages ?? 0) > 0 &&
      value.push(exportAnalyticsEvents.blankImages);
    input.clipped === true && value.push(exportAnalyticsEvents.clipped);
    input.flowOverflow === true &&
      value.push(exportAnalyticsEvents.flowOverflow);
    (input.hiddenSkipped ?? 0) > 0 &&
      value.push(exportAnalyticsEvents.hiddenSkipped);
    (input.fontFallback ?? 0) > 0 &&
      value.push(exportAnalyticsEvents.fontFallback);
    input.scaledDown === true && value.push(exportAnalyticsEvents.scaledDown);
    (input.innerClipped ?? 0) > 0 &&
      value.push(exportAnalyticsEvents.innerClipped);
    (input.scrollRegion ?? 0) > 0 &&
      value.push(exportAnalyticsEvents.scrollRegion);
    (input.collapsed ?? 0) > 0 && value.push(exportAnalyticsEvents.collapsed);
    (input.unrevealed ?? 0) > 0 && value.push(exportAnalyticsEvents.unrevealed);
    return value;
  }
  function reportExportBuilt(
    input?: Dynamic,
    options: Dynamic = runtime.frameAnalyticsReporter,
    context: Dynamic = globalThis,
  ): Dynamic {
    try {
      sendStaggeredAnalytics(
        exportBuildAnalyticsEvents(input),
        options,
        context,
      );
    } catch {}
  }
  function reportExportEvent(
    input?: Dynamic,
    options: Dynamic = runtime.frameAnalyticsReporter,
  ): Dynamic {
    try {
      options(exportAnalyticsEvents[input]);
    } catch {}
  }
  function reportExportDeliveryEvent(
    input?: Dynamic,
    options: Dynamic = runtime.frameAnalyticsReporter,
  ): Dynamic {
    try {
      options(exportDeliveryAnalyticsEvents[input]);
    } catch {}
  }
  bindRuntimeValue(
    runtime,
    "sendStaggeredAnalytics",
    () => sendStaggeredAnalytics,
  );
  bindRuntimeValue(
    runtime,
    "exportAnalyticsEvents",
    () => exportAnalyticsEvents,
    (value) => {
      exportAnalyticsEvents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportDeliveryAnalyticsEvents",
    () => exportDeliveryAnalyticsEvents,
    (value) => {
      exportDeliveryAnalyticsEvents = value;
    },
  );
  bindRuntimeValue(runtime, "describeExportScope", () => describeExportScope);
  bindRuntimeValue(
    runtime,
    "exportBuildAnalyticsEvents",
    () => exportBuildAnalyticsEvents,
  );
  bindRuntimeValue(runtime, "reportExportBuilt", () => reportExportBuilt);
  bindRuntimeValue(runtime, "reportExportEvent", () => reportExportEvent);
  bindRuntimeValue(
    runtime,
    "reportExportDeliveryEvent",
    () => reportExportDeliveryEvent,
  );
  return () => {
    exportAnalyticsEvents = {
      built: "frame_design_export_built",
      htmlBuilt: "frame_design_export_html_built",
      failed: "frame_design_export_failed",
      tooLarge: "frame_design_export_too_large",
      timedOut: "frame_design_export_timed_out",
      refused: "frame_design_export_refused",
      pickBuilt: "frame_design_export_pick_built",
      blankImages: "frame_design_export_blank_images",
      clipped: "frame_design_export_clipped",
      flowOverflow: "frame_design_export_flow_overflow",
      hiddenSkipped: "frame_design_export_hidden_skipped",
      fontFallback: "frame_design_export_font_fallback",
      scaledDown: "frame_design_export_scaled_down",
      partial: "frame_design_export_partial",
      singleOfMany: "frame_design_export_single_of_many",
      otherPages: "frame_design_export_other_pages",
      innerClipped: "frame_design_export_inner_clipped",
      scrollRegion: "frame_design_export_scroll_region",
      collapsed: "frame_design_export_collapsed",
      unrevealed: "frame_design_export_unrevealed",
    };
    exportDeliveryAnalyticsEvents = {
      opened: "frame_design_export_pick_opened",
      chosen: "frame_design_export_pick_chosen",
      cancelled: "frame_design_export_pick_cancelled",
      left: "frame_design_export_pick_left",
      lapsed: "frame_design_export_pick_lapsed",
      dropped: "frame_design_export_pick_dropped",
    };
  };
}
