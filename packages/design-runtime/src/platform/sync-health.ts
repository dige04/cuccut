/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformSyncHealth(
  runtime: RuntimeBindings,
): () => void {
  var SYNC_FAILURE_CODE_CATEGORIES: Dynamic;
  var FILES_SYNC_FAILURE_CODE_CATEGORIES: Dynamic;
  var INDEX_USER_ERROR_CATEGORIES: Dynamic;
  var UNSAVED_SYNC_STATUSES: Dynamic;
  var ACTIVE_SYNC_STATUSES: Dynamic;
  function classifySyncFailure(code?: Dynamic): Dynamic {
    return code === undefined
      ? "unknown"
      : Object.hasOwn(SYNC_FAILURE_CODE_CATEGORIES, code)
        ? SYNC_FAILURE_CODE_CATEGORIES[code]
        : Object.hasOwn(FILES_SYNC_FAILURE_CODE_CATEGORIES, code)
          ? FILES_SYNC_FAILURE_CODE_CATEGORIES[code]
          : "unknown";
  }
  function classifyRenderOutcome(
    loadState?: Dynamic,
    errorCode?: Dynamic,
  ): Dynamic {
    return loadState === "live"
      ? ["render", "success"]
      : loadState === "saved_copy"
        ? ["render", "success", "saved_copy"]
        : [
            "render",
            "failure",
            errorCode === "timeout" ? "timeout" : "capability_error",
          ];
  }
  function monitorDocumentLoadHealth(doc?: Dynamic, report?: Dynamic): Dynamic {
    let finished: Dynamic = false,
      unsubscribe: Dynamic,
      inspectLoadState: Dynamic = (): Dynamic => {
        if (finished) return;
        let value: Dynamic = doc.loadState();
        value !== "loading" &&
          ((value === "cached" && doc.cachedSettled?.() !== true) ||
            ((finished = true),
            unsubscribe?.(),
            reportSyncHealthSafely(
              report,
              classifyRenderOutcome(
                value === "cached" ? "saved_copy" : value,
                doc.syncDetail().lastError?.code,
              ),
            )));
      };
    unsubscribe = doc.subscribeLoad(inspectLoadState);
    inspectLoadState();
    return (): Dynamic => {
      finished = true;
      unsubscribe?.();
    };
  }
  function monitorDocumentSaveHealth(doc?: Dynamic, report?: Dynamic): Dynamic {
    let lastSaveStatus: Dynamic = doc.saveState().status,
      reportedLeftOutItems: Dynamic = new Map(),
      unsubscribeStuck: Dynamic =
        doc.subscribeStuck?.(
          (): Dynamic =>
            reportSyncHealthSafely(report, ["sync", "failure", "timeout"]),
        ) ?? ((): Dynamic => {}),
      unsubscribeSave: Dynamic = doc.subscribeSave(
        (state?: Dynamic): Dynamic => {
          let status: Dynamic = state.status;
          if (status === lastSaveStatus) return;
          let value: Dynamic = lastSaveStatus;
          lastSaveStatus = status;
          if (doc.loadState() === "live")
            if (
              (status === "ready" && (reportedLeftOutItems = new Map()),
              status === "ready" && UNSAVED_SYNC_STATUSES.has(value))
            )
              reportSyncHealthSafely(report, ["sync", "success"]);
            else if (status === "error" && ACTIVE_SYNC_STATUSES.has(value)) {
              let value2: Dynamic = doc.syncDetail().lastError?.code;
              if (value2 !== undefined || state.leftOut === undefined) {
                reportSyncHealthSafely(report, [
                  "sync",
                  "failure",
                  classifySyncFailure(value2 ?? state.code),
                ]);
                return;
              }
              let values: Dynamic = new Set();
              for (let value3 of state.leftOut as Dynamic)
                reportedLeftOutItems.get(value3.id) !== value3.cause &&
                  values.add(INDEX_USER_ERROR_CATEGORIES[value3.cause]);
              reportedLeftOutItems = new Map(
                state.leftOut.map(
                  (input?: Dynamic): Dynamic => [input.id, input.cause],
                ),
              );
              for (let value3 of values as Dynamic)
                reportSyncHealthSafely(report, ["sync", "failure", value3]);
            } else
              status === "readonly" &&
                UNSAVED_SYNC_STATUSES.has(value) &&
                doc.dirty() &&
                reportSyncHealthSafely(report, [
                  "sync",
                  "failure",
                  "capability_denied",
                ]);
        },
      );
    return (): Dynamic => {
      unsubscribeStuck();
      unsubscribeSave();
    };
  }
  function reportSyncHealthSafely(report?: Dynamic, metric?: Dynamic): Dynamic {
    try {
      report(metric);
    } catch (value: Dynamic) {
      console.error(
        "appifact sync health: reporter threw; report dropped",
        value,
      );
    }
  }
  bindRuntimeValue(
    runtime,
    "SYNC_FAILURE_CODE_CATEGORIES",
    () => SYNC_FAILURE_CODE_CATEGORIES,
    (value) => {
      SYNC_FAILURE_CODE_CATEGORIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_SYNC_FAILURE_CODE_CATEGORIES",
    () => FILES_SYNC_FAILURE_CODE_CATEGORIES,
    (value) => {
      FILES_SYNC_FAILURE_CODE_CATEGORIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INDEX_USER_ERROR_CATEGORIES",
    () => INDEX_USER_ERROR_CATEGORIES,
    (value) => {
      INDEX_USER_ERROR_CATEGORIES = value;
    },
  );
  bindRuntimeValue(runtime, "classifySyncFailure", () => classifySyncFailure);
  bindRuntimeValue(
    runtime,
    "classifyRenderOutcome",
    () => classifyRenderOutcome,
  );
  bindRuntimeValue(
    runtime,
    "monitorDocumentLoadHealth",
    () => monitorDocumentLoadHealth,
  );
  bindRuntimeValue(
    runtime,
    "UNSAVED_SYNC_STATUSES",
    () => UNSAVED_SYNC_STATUSES,
    (value) => {
      UNSAVED_SYNC_STATUSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ACTIVE_SYNC_STATUSES",
    () => ACTIVE_SYNC_STATUSES,
    (value) => {
      ACTIVE_SYNC_STATUSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "monitorDocumentSaveHealth",
    () => monitorDocumentSaveHealth,
  );
  bindRuntimeValue(
    runtime,
    "reportSyncHealthSafely",
    () => reportSyncHealthSafely,
  );
  return () => {
    SYNC_FAILURE_CODE_CATEGORIES = {
      refused: "too_large",
      quota_exceeded: "too_large",
      invalid_argument: "invalid_content",
      transform_error: "invalid_content",
      resource_exhausted: "backpressure",
      unavailable: "transient",
      timeout: "timeout",
      revoked: "capability_denied",
      not_granted: "capability_denied",
      capability_disabled: "capability_denied",
      capability_removed: "capability_denied",
    };
    FILES_SYNC_FAILURE_CODE_CATEGORIES = {
      conflict: "conflict",
      too_large: "too_large",
      invalid_content: "invalid_content",
      index_damaged: "invalid_content",
      index_newer_build: "internal",
      upstream_error: "transient",
      rate_limited: "backpressure",
      read_only_path: "internal",
      not_writer: "capability_denied",
      not_declared: "capability_denied",
      capability_disabled: "capability_denied",
    };
    INDEX_USER_ERROR_CATEGORIES = {
      size: "too_large",
      kind: "validation",
      name: "user_error",
      damaged_text: "user_error",
      gone: "internal",
      unreadable: "internal",
      other: "invalid_content",
    };
    UNSAVED_SYNC_STATUSES = new Set(["dirty", "saving", "error"]);
    ACTIVE_SYNC_STATUSES = new Set(["ready", "dirty", "saving"]);
  };
}
