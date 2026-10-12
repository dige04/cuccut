/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorInspectorLinkPopover(
  runtime: RuntimeBindings,
): () => void {
  var linkPopoverExports: Dynamic;
  var reactInspectorLinkPopover: Dynamic;
  var jsxInspectorLinkPopover: Dynamic;
  var initializeInspectorLinkPopover: Dynamic;
  function DcLinkPopover({
    open: open,
    href: href,
    collapsed: collapsed,
    isElementLink = false,
    anchorPosition: anchorPosition,
    anchorTop: anchorTop,
    canvasTop: canvasTop,
    onApply: onApply,
    onCancel: onCancel,
    onActivity: onActivity,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, reactInspectorLinkPopover.useState)(
        href,
      ),
      [value3, value4]: Dynamic = (0, reactInspectorLinkPopover.useState)(
        false,
      ),
      value5: Dynamic = (0, reactInspectorLinkPopover.useRef)(null),
      value6: Dynamic = (0, reactInspectorLinkPopover.useRef)(null),
      value7: Dynamic = anchorPosition?.x ?? 0,
      value8: Dynamic = anchorPosition?.y ?? 0,
      value9: Dynamic = Math.min(anchorTop ?? value8, value8),
      value10: Dynamic = (0, reactInspectorLinkPopover.useMemo)(
        (): Dynamic => ({
          getBoundingClientRect: (): Dynamic =>
            DOMRect.fromRect({
              x: value7,
              y: value9,
              width: 0,
              height: value8 - value9,
            }),
        }),
        [value7, value8, value9],
      );
    (0, reactInspectorLinkPopover.useEffect)((): Dynamic => {
      open && (value2(href), value4(false));
    }, [open, href]);
    if (!open) return null;
    let value11: Dynamic = href.trim() !== "",
      value12: Dynamic = value11
        ? (0, runtime.sanitizeEditableLink)(value)
        : (0, runtime.normalizeLinkInput)(value),
      value13: Dynamic = collapsed && !value11,
      value14: Dynamic = isElementLink || value11,
      value15: Dynamic =
        value11 &&
        !value3 &&
        value12 != null &&
        value.trim() !== "" &&
        !/^[a-z][a-z0-9+.-]*:/i.test(value.trim()) &&
        !value.trim().startsWith("//") &&
        !value.trim().startsWith("#"),
      callback: Dynamic = (): Dynamic => {
        if (!value13) {
          if (value14 && value.trim() === "") {
            onApply(null);
            return;
          }
          if (value12 == null) {
            value4(true);
            value5.current?.focus();
            return;
          }
          onApply(value12);
        }
      },
      callback2: Dynamic = (event?: Dynamic): Dynamic => {
        if (event.key !== "Tab") return;
        let current: Dynamic = value6.current;
        if (!current) return;
        let value16: Dynamic = Array.from(
          current.querySelectorAll("input, button:not([disabled])"),
        );
        if (value16.length === 0) return;
        let value17: Dynamic = value16[0],
          value18: Dynamic = value16[value16.length - 1],
          activeElement: Dynamic = (document as Dynamic).activeElement;
        event.shiftKey &&
        (activeElement === value17 || !current.contains(activeElement))
          ? (event.preventDefault(), value18.focus())
          : !event.shiftKey &&
            (activeElement === value18 || !current.contains(activeElement)) &&
            (event.preventDefault(), value17.focus());
      };
    return (
      <runtime.CdsIsland density={"compact"} className={"contents"}>
        <runtime.PopoverPopoverRootTriggerPopupConfig.Root
          open={true}
          modal={true}
          onOpenChange={(input?: Dynamic, options?: Dynamic): Dynamic => {
            input ||
              (options.reason === "escape-key" &&
                options.event.preventDefault(),
              onCancel());
          }}
        >
          <runtime.PopoverPopoverRootTriggerPopupConfig.Popup
            anchor={value10}
            side={"bottom"}
            align={"start"}
            sideOffset={6}
            collisionPadding={{
              top: Math.max(8, (canvasTop ?? 0) + 8),
              right: 8,
              bottom: 8,
              left: 8,
            }}
            padding={"sm"}
            finalFocus={false}
            aria-label={"Edit link"}
            className={"w-80"}
            {...{
              [runtime.linkPopoverAttribute]: "",
            }}
          >
            <div
              ref={value6}
              onKeyDown={(input?: Dynamic): Dynamic => {
                onActivity?.();
                callback2(input);
              }}
              className={"flex flex-col gap-sm"}
            >
              <runtime.FieldExports.Root invalid={value3}>
                <div className={"flex items-center gap-sm"}>
                  <runtime.TextInput
                    ref={value5}
                    size={"sm"}
                    inputMode={"url"}
                    value={value}
                    placeholder={"https://\u2026"}
                    aria-label={"Link URL"}
                    autoFocus={true}
                    onFocus={(input?: Dynamic): Dynamic =>
                      input.currentTarget.select()
                    }
                    onChange={(input?: Dynamic): Dynamic => {
                      onActivity?.();
                      value2(input.currentTarget.value);
                      value4(false);
                    }}
                    onKeyDown={(event?: Dynamic): Dynamic => {
                      event.key === "Enter" &&
                        (event.preventDefault(), callback());
                    }}
                    data-testid={"dc-link-url-input"}
                  />
                  <runtime.Button
                    size={"sm"}
                    disabled={value13}
                    onClick={callback}
                    data-testid={"dc-link-apply"}
                  >
                    {"Apply"}
                  </runtime.Button>
                </div>
                {value3 && (
                  <runtime.FieldExports.Error match={true}>
                    {"Enter a web address like https://example.com"}
                  </runtime.FieldExports.Error>
                )}
                {value13 && (
                  <runtime.FieldExports.Description className={"text-caption"}>
                    {"Select some text to link it."}
                  </runtime.FieldExports.Description>
                )}
                {value15 && !value13 && (
                  <runtime.FieldExports.Description
                    className={"text-caption"}
                    data-testid={"dc-link-relative-hint"}
                  >
                    {
                      "Links to a page inside this project \u2014 for a website, start with https://"
                    }
                  </runtime.FieldExports.Description>
                )}
              </runtime.FieldExports.Root>
              {(isElementLink || href.trim() !== "") && (
                <div className={"flex"}>
                  <runtime.Button
                    variant={"ghost"}
                    size={"sm"}
                    className={"text-danger hover:underline"}
                    onClick={(): Dynamic => onApply(null)}
                    data-testid={"dc-link-remove"}
                  >
                    {"Remove link"}
                  </runtime.Button>
                </div>
              )}
            </div>
          </runtime.PopoverPopoverRootTriggerPopupConfig.Popup>
        </runtime.PopoverPopoverRootTriggerPopupConfig.Root>
      </runtime.CdsIsland>
    );
  }
  bindRuntimeValue(
    runtime,
    "linkPopoverExports",
    () => linkPopoverExports,
    (value) => {
      linkPopoverExports = value;
    },
  );
  bindRuntimeValue(runtime, "DcLinkPopover", () => DcLinkPopover);
  bindRuntimeValue(
    runtime,
    "reactInspectorLinkPopover",
    () => reactInspectorLinkPopover,
    (value) => {
      reactInspectorLinkPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxInspectorLinkPopover",
    () => jsxInspectorLinkPopover,
    (value) => {
      jsxInspectorLinkPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeInspectorLinkPopover",
    () => initializeInspectorLinkPopover,
    (value) => {
      initializeInspectorLinkPopover = value;
    },
  );
  return () => {
    linkPopoverExports = {};
    (0, runtime.defineLiveExports)(linkPopoverExports, {
      DcLinkPopover: (): Dynamic => DcLinkPopover,
    });
    initializeInspectorLinkPopover = (0, runtime.initializeOnce)(
      (): Dynamic => {
        "use strict";

        reactInspectorLinkPopover = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react)(),
          1,
        );
        (0, runtime.initializeCdsIndex)();
        (0, runtime.initializePlatformCdsIsland)();
        (0, runtime.initializeInspectorContext)();
        (0, runtime.initializeEditorAttributeValidation)();
        jsxInspectorLinkPopover = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react_jsx_runtime)(),
          1,
        );
      },
    );
  };
}
