/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformHealthAndAnalytics(
  runtime: RuntimeBindings,
): () => void {
  var ChatColumnOverlayActionsSlotValue: Dynamic;
  var AppifactHealthValue: Dynamic;
  var healthReporter: Dynamic;
  var PlatformHealthAndAnalyticsFramedPostConfig: Dynamic;
  var frameAnalyticsReporter: Dynamic;
  var reportExportOutcome: Dynamic;
  var designAnalyticsEvents: Dynamic;
  function getHealthReporter(): Dynamic {
    let value: Dynamic = (globalThis as Dynamic)[AppifactHealthValue];
    if (typeof value != "object" || value === null) return;
    let value2: Dynamic = value;
    return typeof value2.report == "function" &&
      typeof value2.track == "function"
      ? value
      : undefined;
  }
  function createFrameAnalyticsReporter(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set(),
      index: Dynamic = 0;
    return (input2?: Dynamic): Dynamic => {
      if (!values.has(input2)) {
        values.add(input2);
        try {
          if (!input.framed()) return;
          input.post({
            __frame_cap: true,
            cap: "analytics",
            id: "t" + String(++index),
            method: "track",
            args: [input2],
          });
        } catch {}
      }
    };
  }
  function createExportAnalyticsReporter(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return (input2?: Dynamic, options2?: Dynamic): Dynamic => {
      input(...input2);
      input2[1] === "success" && options(options2);
    };
  }
  bindRuntimeValue(
    runtime,
    "ChatColumnOverlayActionsSlotValue",
    () => ChatColumnOverlayActionsSlotValue,
    (value) => {
      ChatColumnOverlayActionsSlotValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AppifactHealthValue",
    () => AppifactHealthValue,
    (value) => {
      AppifactHealthValue = value;
    },
  );
  bindRuntimeValue(runtime, "getHealthReporter", () => getHealthReporter);
  bindRuntimeValue(
    runtime,
    "healthReporter",
    () => healthReporter,
    (value) => {
      healthReporter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFrameAnalyticsReporter",
    () => createFrameAnalyticsReporter,
  );
  bindRuntimeValue(
    runtime,
    "PlatformHealthAndAnalyticsFramedPostConfig",
    () => PlatformHealthAndAnalyticsFramedPostConfig,
    (value) => {
      PlatformHealthAndAnalyticsFramedPostConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "frameAnalyticsReporter",
    () => frameAnalyticsReporter,
    (value) => {
      frameAnalyticsReporter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createExportAnalyticsReporter",
    () => createExportAnalyticsReporter,
  );
  bindRuntimeValue(
    runtime,
    "reportExportOutcome",
    () => reportExportOutcome,
    (value) => {
      reportExportOutcome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designAnalyticsEvents",
    () => designAnalyticsEvents,
    (value) => {
      designAnalyticsEvents = value;
    },
  );
  return () => {
    ChatColumnOverlayActionsSlotValue = "chat-column-overlay-actions-slot";
    AppifactHealthValue = "__appifact_health";
    healthReporter = {
      report(input: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        try {
          getHealthReporter()?.report(input, options, context);
        } catch {}
      },
      async track(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
      ): Promise<Dynamic> {
        let value: Dynamic = getHealthReporter();
        if (value === undefined) return await options();
        let value2: Dynamic;
        try {
          value2 = value.track(input, options, context);
        } catch {
          return await options();
        }
        return await value2;
      },
    };
    // CucCut: no analytics. The page is never treated as framed for analytics, so no `__frame_cap` analytics
    // message is posted to the parent window (CucCut's UI). Health reports need globalThis.__appifact_health,
    // which the CucCut page template does not install, so they are dropped by the code above unchanged.
    PlatformHealthAndAnalyticsFramedPostConfig = {
      framed: (): Dynamic => false,
      post: (input?: Dynamic): Dynamic => {},
    };
    frameAnalyticsReporter = createFrameAnalyticsReporter(
      PlatformHealthAndAnalyticsFramedPostConfig,
    );
    reportExportOutcome = createExportAnalyticsReporter(
      (...input: Dynamic[]): Dynamic => healthReporter.report(...input),
      frameAnalyticsReporter,
    );
    designAnalyticsEvents = {
      artboardInserted: "frame_design_artboard_inserted",
      artboardDeleted: "frame_design_artboard_deleted",
      exported: {
        png: "frame_design_export_png",
        jpg: "frame_design_export_jpg",
        pdf: "frame_design_export_pdf",
        html: "frame_design_export_html",
        zip: "frame_design_export_zip",
      },
    };
  };
}
