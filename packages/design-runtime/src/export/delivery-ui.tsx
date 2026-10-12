/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installExportDeliveryUi(runtime: RuntimeBindings): () => void {
  var reactExportDeliveryUi: Dynamic;
  var jsxExportDeliveryUi: Dynamic;
  var ChromeOrEdgeMayNotWorkMessage: Dynamic;
  var ExportDeliveryUiResolvedValue: Dynamic;
  var ExportDeliveryUiResolvedValue_2: Dynamic;
  var ExportDeliveryUiRejectedExtensionExtensionNotEnabledTooLargeSet: Dynamic;
  function decodeExportDeliveryBlob(input?: Dynamic): Dynamic {
    let value: Dynamic = input.indexOf(","),
      value2: Dynamic = input.slice(0, value),
      value3: Dynamic = value2.slice(
        5,
        value2.indexOf(";") >= 0 ? value2.indexOf(";") : value2.length,
      ),
      value4: Dynamic = atob(input.slice(value + 1)),
      value5: Dynamic = new Uint8Array(value4.length);
    for (let index: Dynamic = 0; index < value4.length; index++)
      value5[index] = value4.charCodeAt(index);
    return new Blob([value5], {
      type: value3,
    });
  }
  function exportDeliveryFailureMessage(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.lastIndexOf("."),
      value2: Dynamic =
        value === -1 ? "this kind of file" : options.slice(value) + " files";
    switch (input) {
      case "rejected_extension":
        return (
          "This host can\u2019t save " +
          value2 +
          ". " +
          ExportDeliveryUiResolvedValue
        );
      case "extension_not_enabled":
        return (
          "This host can\u2019t save " +
          value2 +
          " yet. " +
          ExportDeliveryUiResolvedValue
        );
      case "too_large":
        return (
          "This host wouldn\u2019t save " +
          options +
          " at " +
          (Math.ceil((context / (1024 * 1024)) * 10) / 10).toFixed(1) +
          " MB. " +
          ExportDeliveryUiResolvedValue
        );
      case "rate_limited":
        return (
          "The save didn\u2019t go through (another prompt may be open). Try Download again, or drag the file out of this window instead (" +
          ChromeOrEdgeMayNotWorkMessage +
          ")."
        );
      default:
        return (
          "The save didn\u2019t go through. " + ExportDeliveryUiResolvedValue
        );
    }
  }
  function useExportDeliveries(): Dynamic {
    let [value, value2]: Dynamic = (0, reactExportDeliveryUi.useState)([]),
      [value3, value4]: Dynamic = (0, reactExportDeliveryUi.useState)(false);
    (0, runtime.npm_useEventListener_bc)(
      runtime.exportDeliveryEventName,
      (input?: Dynamic): Dynamic => {
        let detail: Dynamic = input.detail;
        value2(
          (input2?: Dynamic): Dynamic => [
            ...(value3
              ? input2.filter(
                  (input3?: Dynamic): Dynamic =>
                    input3.filename !== detail.filename,
                )
              : []),
            detail,
          ],
        );
        value4(true);
      },
    );
    return (
      <runtime.CdsIsland density={"compact"} className={"contents"}>
        <runtime.DialogDialogRootTriggerPopupConfig.Root
          open={value3}
          onOpenChange={value4}
          onOpenChangeComplete={(input?: Dynamic): Dynamic => {
            input || value2([]);
          }}
        >
          <runtime.DialogDialogRootTriggerPopupConfig.Popup
            data-testid={"export-delivery-dialog"}
          >
            <runtime.DialogDialogRootTriggerPopupConfig.Header>
              {value.length === 1
                ? "Export ready"
                : String(value.length) + " exports ready"}
            </runtime.DialogDialogRootTriggerPopupConfig.Header>
            <div className={"flex max-h-[60vh] flex-col gap-2 overflow-auto"}>
              {value.map(
                (input?: Dynamic): Dynamic =>
                  (() => {
                    const _Component = ExportDeliveryNotice;
                    const _props = {
                      delivery: input,
                    } as const;
                    const _key = input.filename;
                    return <_Component key={_key} {..._props} />;
                  })(),
              )}
            </div>
          </runtime.DialogDialogRootTriggerPopupConfig.Popup>
        </runtime.DialogDialogRootTriggerPopupConfig.Root>
      </runtime.CdsIsland>
    );
  }
  function ExportDeliveryNotice({ delivery: delivery }: Dynamic): Dynamic {
    let { showToast: value }: Dynamic = (0, runtime.useToast)(),
      value2: Dynamic = delivery.file == null,
      value3: Dynamic = (0, reactExportDeliveryUi.useMemo)((): Dynamic => {
        if (delivery.file) return delivery.file.blob;
        try {
          return decodeExportDeliveryBlob(delivery.url);
        } catch {
          return new Blob([], {
            type: "application/octet-stream",
          });
        }
      }, [delivery]),
      value4: Dynamic = delivery.file?.mime ?? delivery.mime ?? value3.type,
      value5: Dynamic = (0, reactExportDeliveryUi.useMemo)(
        (): Dynamic =>
          URL.createObjectURL(
            new Blob([value3], {
              type: "application/octet-stream",
            }),
          ),
        [value3],
      );
    (0, reactExportDeliveryUi.useEffect)(
      (): Dynamic => (): Dynamic => URL.revokeObjectURL(value5),
      [value5],
    );
    let value6: Dynamic = Math.max(1, Math.round(value3.size / 1024)),
      [value7, value8]: Dynamic = (0, reactExportDeliveryUi.useState)(false),
      [value9, value10]: Dynamic = (0, reactExportDeliveryUi.useState)(
        undefined,
      ),
      value11: Dynamic = (0, runtime.hasDownloadCapability)(),
      value12: Dynamic =
        delivery.filename
          .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
          .replace(/\s+/g, " ")
          .trim() || "export",
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        input.dataTransfer.effectAllowed = "copy";
        input.dataTransfer.setData(
          "DownloadURL",
          value4 + ":" + value12 + ":" + value5,
        );
      },
      value13: Dynamic = value9 ?? delivery.refusal,
      value14: Dynamic =
        !value11 || value13 === "rate_limited"
          ? undefined
          : (0, runtime.normalizeDownloadName)(value12)
            ? value13 !== undefined &&
              ExportDeliveryUiRejectedExtensionExtensionNotEnabledTooLargeSet.has(
                value13,
              )
              ? exportDeliveryFailureMessage(value13, value12, value3.size)
              : undefined
            : exportDeliveryFailureMessage(
                "rejected_extension",
                value12,
                value3.size,
              ),
      callback2: Dynamic = (): Dynamic => {
        (async (): Promise<Dynamic> => {
          value8(true);
          try {
            let { outcome: value15, code: value16 }: Dynamic = await (0,
            runtime.saveThroughHost)(value3, value12);
            if (value15 === "saved") {
              value("Saved " + value12 + ".", "success");
              return;
            }
            if (value15 === "declined" || value15 === "withheld") return;
            if (value11 && value16 !== "no_shell_save") {
              ExportDeliveryUiRejectedExtensionExtensionNotEnabledTooLargeSet.has(
                value16,
              ) && value10(value16);
              value(
                exportDeliveryFailureMessage(value16, value12, value3.size),
              );
              return;
            }
            let value17: Dynamic = (document as Dynamic).createElement("a");
            value17.href = value5;
            value17.download = value12;
            value17.rel = "noopener";
            value17.style.display = "none";
            (document as Dynamic).body.appendChild(value17);
            value17.click();
            value17.remove();
            value("If no download started: " + ExportDeliveryUiResolvedValue);
          } finally {
            value8(false);
          }
        })();
      };
    return (
      <div className={"flex flex-col gap-1.5"}>
        <div
          data-testid={"export-delivery-card"}
          className={
            "flex items-center gap-2.5 rounded-lg border bg-surface-1 px-2.5 py-2 shadow-sm"
          }
        >
          <div
            draggable={true}
            onDragStart={callback}
            title={ExportDeliveryUiResolvedValue_2}
            className={
              "flex min-w-0 flex-1 cursor-grab items-center gap-2.5 select-none active:cursor-grabbing"
            }
          >
            {value2 ? (
              <img
                src={delivery.url}
                alt={""}
                draggable={true}
                onDragStart={callback}
                className={
                  "h-9 w-12 shrink-0 rounded border bg-white object-contain"
                }
              />
            ) : (
              <span
                className={
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-surface-2 text-muted"
                }
              >
                <runtime.Icon name={"File"} size={"sm"} />
              </span>
            )}
            <div className={"min-w-0 flex-1"}>
              <div className={"truncate text-body font-medium text-primary"}>
                {delivery.filename}
              </div>
              <div className={"text-caption text-muted"}>
                {value6}
                {" KB"}
              </div>
            </div>
          </div>
          <runtime.DisabledReasonTooltip reason={value14}>
            <runtime.Button
              variant={"primary"}
              busy={value7}
              busyLabel={"Downloading\u2026"}
              disabled={value14 !== undefined}
              onClick={callback2}
              data-testid={"export-delivery-download"}
            >
              {"Download"}
            </runtime.Button>
          </runtime.DisabledReasonTooltip>
          <span
            draggable={true}
            onDragStart={callback}
            title={ExportDeliveryUiResolvedValue_2}
            className={
              "inline-flex h-control pointer-coarse:min-h-10 shrink-0 cursor-grab items-center rounded border border-strong px-2 text-footnote font-medium text-primary select-none hover:bg-fill-ghost-hover active:cursor-grabbing"
            }
          >
            {"Drag out\u2026"}
          </span>
        </div>
        {delivery.embedWarningCount > 0 && (
          <div className={"px-1 text-footnote text-danger"}>
            {delivery.embedWarningCount === 1
              ? "One image could not be embedded and renders blank in the export."
              : `${delivery.embedWarningCount} images could not be embedded and render blank in the export.`}
          </div>
        )}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactExportDeliveryUi",
    () => reactExportDeliveryUi,
    (value) => {
      reactExportDeliveryUi = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxExportDeliveryUi",
    () => jsxExportDeliveryUi,
    (value) => {
      jsxExportDeliveryUi = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeExportDeliveryBlob",
    () => decodeExportDeliveryBlob,
  );
  bindRuntimeValue(
    runtime,
    "ChromeOrEdgeMayNotWorkMessage",
    () => ChromeOrEdgeMayNotWorkMessage,
    (value) => {
      ChromeOrEdgeMayNotWorkMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportDeliveryUiResolvedValue",
    () => ExportDeliveryUiResolvedValue,
    (value) => {
      ExportDeliveryUiResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportDeliveryUiResolvedValue_2",
    () => ExportDeliveryUiResolvedValue_2,
    (value) => {
      ExportDeliveryUiResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportDeliveryFailureMessage",
    () => exportDeliveryFailureMessage,
  );
  bindRuntimeValue(
    runtime,
    "ExportDeliveryUiRejectedExtensionExtensionNotEnabledTooLargeSet",
    () => ExportDeliveryUiRejectedExtensionExtensionNotEnabledTooLargeSet,
    (value) => {
      ExportDeliveryUiRejectedExtensionExtensionNotEnabledTooLargeSet = value;
    },
  );
  bindRuntimeValue(runtime, "useExportDeliveries", () => useExportDeliveries);
  bindRuntimeValue(runtime, "ExportDeliveryNotice", () => ExportDeliveryNotice);
  return () => {
    reactExportDeliveryUi = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeNpm_usehooks_ts_p0)();
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializePlatformCdsIsland)();
    jsxExportDeliveryUi = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ChromeOrEdgeMayNotWorkMessage =
      "Chrome or Edge; may not work in the desktop app";
    ExportDeliveryUiResolvedValue =
      "Drag the file out of this window onto your desktop or a folder instead (" +
      ChromeOrEdgeMayNotWorkMessage +
      ").";
    ExportDeliveryUiResolvedValue_2 =
      "Drag this out of the window onto your desktop or a folder (" +
      ChromeOrEdgeMayNotWorkMessage +
      ").";
    ExportDeliveryUiRejectedExtensionExtensionNotEnabledTooLargeSet = new Set([
      "rejected_extension",
      "extension_not_enabled",
      "too_large",
      "not_granted",
      "capability_disabled",
      "capability_removed",
    ]);
  };
}
