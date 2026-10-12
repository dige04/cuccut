import type {
  AccessibleNameProps,
  ComboboxBridgeProps,
  ComboboxChipProps,
  ComboboxChipsProps,
  ComboboxFooterActionProps,
  ComboboxGroupMap,
  ComboboxHostProps,
  ComboboxItemPartProps,
  ComboboxKey,
  ComboboxLabelInput,
  ComboboxLabelResult,
  ComboboxOption,
  ComboboxPartProps,
  ComboboxPopupProps,
  ComboboxPopupViewProps,
  ComboboxProps,
  ComboboxRegistration,
  ComboboxRowProps,
  ComboboxStatusProps,
  ComboboxTriggerProps,
  ComboboxValueProps,
  DesignStyle,
  ForwardComponent,
  GenericComboboxRow,
  ImperativeComboboxDetails,
  LabelResolver,
  MobileSheetParts,
  OverlayChange,
  PopupInputKind,
  SheetPopupState,
  SheetRenderState,
  VirtualComboboxActions,
  VirtualComboboxProps,
} from "../contracts/overlays";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiComboboxPrimitives(
  runtime: RuntimeBindings,
): () => void {
  var typographyThemeValues: {
    "font-size-body": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: {
        compact: {
          sm: number;
          md: number;
          lg: number;
        };
        comfortable: {
          sm: number;
          md: number;
          lg: number;
        };
      };
    };
    "font-size-caption": {
      compact: number;
      comfortable: number;
      steps: number[];
    };
    "font-size-code": {
      compact: number;
      comfortable: number;
    };
    "font-size-footnote": {
      compact: number;
      comfortable: number;
    };
    "font-size-heading": {
      compact: number;
      comfortable: number;
      textSize: {
        compact: {
          sm: number;
          md: number;
          lg: number;
        };
        comfortable: {
          sm: number;
          md: number;
          lg: number;
        };
      };
    };
    "font-size-prose": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: string;
    };
    "font-size-title": {
      compact: number;
      comfortable: number;
    };
    "leading-body": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: {
        compact: {
          sm: number;
          md: number;
          lg: number;
        };
        comfortable: {
          sm: number;
          md: number;
          lg: number;
        };
      };
    };
    "leading-caption": {
      compact: number;
      comfortable: number;
    };
    "leading-code": {
      compact: number;
      comfortable: number;
    };
    "leading-footnote": {
      compact: number;
      comfortable: number;
    };
    "leading-heading": {
      compact: number;
      comfortable: number;
      textSize: {
        compact: {
          sm: number;
          md: number;
          lg: number;
        };
        comfortable: {
          sm: number;
          md: number;
          lg: number;
        };
      };
    };
    "leading-prose": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: string;
    };
    "leading-title": {
      compact: number;
      comfortable: number;
    };
  };
  var reactForUiInputs222: typeof React;
  var reactComboboxStatus: typeof React;
  var jsxComboboxStatus: typeof import("react/jsx-runtime");
  var COMBOBOX_STATUS_DELAY_MS: number;
  var COMBOBOX_STATUS_CLASS: string;
  var COMBOBOX_LOADING_CLASS: string;
  var ComboboxStatus: ForwardComponent<HTMLDivElement, ComboboxStatusProps>;
  var reactForUiInputs24: typeof React;
  var jsxForUiInputs23: typeof import("react/jsx-runtime");
  var COMBOBOX_VIRTUAL_OVERSCAN: number;
  var COMBOBOX_SKELETON_ROW_COUNT: number;
  function comboboxAccessibilityProps({
    reactId: reactId,
    label: label,
    triggerPrefix: triggerPrefix,
    mode: mode,
    triggerMode: triggerMode,
    insideField: insideField,
  }: ComboboxLabelInput): ComboboxLabelResult {
    let value = label ? `${reactId}-label` : undefined,
      value2 = mode === "select" && triggerMode !== "chips",
      value3 =
        value !== undefined ||
        (!insideField && (triggerPrefix !== undefined || value2)),
      value4 = value3 ? `${reactId}-trigger` : undefined,
      value5 = value3 && value2 ? `${reactId}-trigger-value` : undefined,
      value6 = value3
        ? [value, value5].filter(Boolean).join(" ") || undefined
        : undefined;
    return {
      labelId: value,
      triggerId: value4,
      triggerValueId: value5,
      ownLabelProps:
        value3 && value4
          ? {
              id: value4,
              "aria-labelledby": value6,
            }
          : undefined,
    };
  }
  function accessibleNameFromElement(
    element: Element | null | undefined,
    {
      fallback: options,
      fromTextEntry = false,
    }: {
      fallback?: string;
      fromTextEntry?: boolean;
    } = {},
  ): AccessibleNameProps {
    if (
      element === null ||
      element === undefined ||
      (!fromTextEntry && (0, runtime.isEditableElement)(element))
    ) {
      return {};
    }
    let ownerDocument = element.ownerDocument,
      value = (element.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .filter((input: string) => {
          if (input === "") {
            return false;
          }
          let value2 = ownerDocument.getElementById(input);
          return value2 !== null && !element.contains(value2);
        });
    if (value.length > 0) {
      return {
        "aria-labelledby": value.join(" "),
      };
    }
    for (let value2 of [element.getAttribute("aria-label"), options]) {
      let value3 = value2?.trim();
      if (value3 !== undefined && value3 !== "") {
        return {
          "aria-label": value3,
        };
      }
    }
    return {};
  }
  function useMirroredAccessibleName(
    ref: React.Ref<HTMLElement> | undefined,
    getFallback: () => Element | null | undefined,
    nameProps: AccessibleNameProps,
    {
      fallback: options,
      fromTextEntry = false,
    }: {
      fallback?: string;
      fromTextEntry?: boolean;
    } = {},
  ): {
    ref: React.RefCallback<HTMLElement>;
    nameProps: AccessibleNameProps;
  } {
    let [value, value2] = reactForUiInputs222.useState<AccessibleNameProps>({}),
      value3 =
        nameProps["aria-label"] !== undefined ||
        nameProps["aria-labelledby"] !== undefined,
      callback = reactForUiInputs222.useCallback(
        (input: HTMLElement | null): void => {
          if (input === null || value3) {
            return;
          }
          let value4 = accessibleNameFromElement(getFallback(), {
            fallback: options,
            fromTextEntry: fromTextEntry,
          });
          value2((input2: AccessibleNameProps) =>
            input2["aria-labelledby"] === value4["aria-labelledby"] &&
            input2["aria-label"] === value4["aria-label"]
              ? input2
              : value4,
          );
        },
        [value3, getFallback, options, fromTextEntry],
      );
    return {
      ref: (0, runtime.useMergedRefs)(ref, callback),
      nameProps: value3 ? nameProps : value,
    };
  }
  function useDelayedVisible(timeoutMs: number): boolean {
    let [value, value2] = reactComboboxStatus.useState(timeoutMs <= 0);
    reactComboboxStatus.useEffect(() => {
      if (timeoutMs <= 0) {
        return;
      }
      let value3 = window.setTimeout(() => value2(true), timeoutMs);
      return () => window.clearTimeout(value3);
    }, [timeoutMs]);
    return timeoutMs <= 0 || value;
  }
  function DelayedVisible({
    ms: ms2,
    children: children,
  }: {
    ms: number;
    children?: React.ReactNode;
  }): React.ReactNode {
    if (useDelayedVisible(ms2)) {
      return children;
    } else {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "typographyThemeValues",
    () => typographyThemeValues,
    (value) => {
      typographyThemeValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxAccessibilityProps",
    () => comboboxAccessibilityProps,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiInputs222",
    () => reactForUiInputs222,
    (value) => {
      reactForUiInputs222 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "accessibleNameFromElement",
    () => accessibleNameFromElement,
  );
  bindRuntimeValue(
    runtime,
    "useMirroredAccessibleName",
    () => useMirroredAccessibleName,
  );
  bindRuntimeValue(
    runtime,
    "reactComboboxStatus",
    () => reactComboboxStatus,
    (value) => {
      reactComboboxStatus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComboboxStatus",
    () => jsxComboboxStatus,
    (value) => {
      jsxComboboxStatus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_STATUS_DELAY_MS",
    () => COMBOBOX_STATUS_DELAY_MS,
    (value) => {
      COMBOBOX_STATUS_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_STATUS_CLASS",
    () => COMBOBOX_STATUS_CLASS,
    (value) => {
      COMBOBOX_STATUS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_LOADING_CLASS",
    () => COMBOBOX_LOADING_CLASS,
    (value) => {
      COMBOBOX_LOADING_CLASS = value;
    },
  );
  bindRuntimeValue(runtime, "useDelayedVisible", () => useDelayedVisible);
  bindRuntimeValue(runtime, "DelayedVisible", () => DelayedVisible);
  bindRuntimeValue(
    runtime,
    "ComboboxStatus",
    () => ComboboxStatus,
    (value) => {
      ComboboxStatus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiInputs24",
    () => reactForUiInputs24,
    (value) => {
      reactForUiInputs24 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs23",
    () => jsxForUiInputs23,
    (value) => {
      jsxForUiInputs23 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_VIRTUAL_OVERSCAN",
    () => COMBOBOX_VIRTUAL_OVERSCAN,
    (value) => {
      COMBOBOX_VIRTUAL_OVERSCAN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_SKELETON_ROW_COUNT",
    () => COMBOBOX_SKELETON_ROW_COUNT,
    (value) => {
      COMBOBOX_SKELETON_ROW_COUNT = value;
    },
  );
  return () => {
    (0, runtime.initializeIsomorphicLayoutEffect)();
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeTranslations)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeLayers)();
    (0, runtime.initializeClickToFocus)();
    (0, runtime.initializeCloseOnActivityHide)();
    (0, runtime.initializeMergedRefs)();
    (0, runtime.initializePortalRoot)();
    (0, runtime.initializeRemScale)();
    (0, runtime.initializeIcons)();
    (0, runtime.initializeSurfaces)();
    (0, runtime.initializeSheetStyles)();
    (0, runtime.initializePresentationMode)();
    (0, runtime.initializeAdaptiveSheets)();
    (0, runtime.initializeSheetClassNames)();
    typographyThemeValues = {
      "font-size-body": {
        compact: 0.8125,
        comfortable: 0.875,
        steps: [0.75, 0.8125, 0.875, 0.875, 0.9375],
        textSize: {
          compact: {
            sm: 0.8125,
            md: 0.875,
            lg: 0.9375,
          },
          comfortable: {
            sm: 0.8125,
            md: 0.875,
            lg: 0.9375,
          },
        },
      },
      "font-size-caption": {
        compact: 0.6875,
        comfortable: 0.75,
        steps: [0.625, 0.6875, 0.75, 0.75, 0.8125],
      },
      "font-size-code": {
        compact: 0.75,
        comfortable: 0.8125,
      },
      "font-size-footnote": {
        compact: 0.75,
        comfortable: 0.8125,
      },
      "font-size-heading": {
        compact: 0.875,
        comfortable: 0.9375,
        textSize: {
          compact: {
            sm: 0.8125,
            md: 0.875,
            lg: 0.9375,
          },
          comfortable: {
            sm: 0.875,
            md: 0.9375,
            lg: 1,
          },
        },
      },
      "font-size-prose": {
        compact: 0.875,
        comfortable: 1,
        steps: [0.8125, 0.875, 0.9375, 1, 1.125],
        textSize: "shift",
      },
      "font-size-title": {
        compact: 1.25,
        comfortable: 1.375,
      },
      "leading-body": {
        compact: 1.1875,
        comfortable: 1.25,
        steps: [1.0625, 1.1875, 1.25, 1.25, 1.375],
        textSize: {
          compact: {
            sm: 1.1875,
            md: 1.25,
            lg: 1.375,
          },
          comfortable: {
            sm: 1.1875,
            md: 1.25,
            lg: 1.375,
          },
        },
      },
      "leading-caption": {
        compact: 1.0625,
        comfortable: 1.0625,
      },
      "leading-code": {
        compact: 1.0625,
        comfortable: 1.1875,
      },
      "leading-footnote": {
        compact: 0.9375,
        comfortable: 1.0625,
      },
      "leading-heading": {
        compact: 1.125,
        comfortable: 1.25,
        textSize: {
          compact: {
            sm: 1.125,
            md: 1.125,
            lg: 1.375,
          },
          comfortable: {
            sm: 1.25,
            md: 1.25,
            lg: 1.5,
          },
        },
      },
      "leading-prose": {
        compact: 1.25,
        comfortable: 1.5,
        steps: [1.1875, 1.25, 1.375, 1.5, 1.6875],
        textSize: "shift",
      },
      "leading-title": {
        compact: 1.5625,
        comfortable: 1.75,
      },
    };
    (0, runtime.initializeMergedRefs)();
    (0, runtime.initializeVisualKeyboard)();
    reactForUiInputs222 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeTranslations)();
    reactComboboxStatus = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxComboboxStatus = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    COMBOBOX_STATUS_DELAY_MS = 500;
    COMBOBOX_STATUS_CLASS = "px-md py-1.5 text-body text-muted select-none";
    COMBOBOX_LOADING_CLASS = `flex items-center gap-2 ${COMBOBOX_STATUS_CLASS}`;
    ComboboxStatus = reactComboboxStatus.forwardRef(
      (
        {
          loading = false,
          delay = COMBOBOX_STATUS_DELAY_MS,
          loadingLabel: loadingLabel,
          ...props
        }: ComboboxStatusProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let value = (0, runtime.useTranslation)(
          "loadingOptions",
          "Loading options",
        );
        return (
          <runtime.baseCombobox.Status ref={options} {...props}>
            {loading && (
              <DelayedVisible ms={delay}>
                <div className={COMBOBOX_LOADING_CLASS}>
                  {[
                    <runtime.Spinner size={"sm"} />,
                    <span>{loadingLabel ?? value}</span>,
                  ]}
                </div>
              </DelayedVisible>
            )}
          </runtime.baseCombobox.Status>
        );
      },
    );
    ComboboxStatus.displayName = "Combobox.Status";
    (0, runtime.initializeIsomorphicLayoutEffect)();
    reactForUiInputs24 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiInputs23 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    COMBOBOX_VIRTUAL_OVERSCAN = 5;
    COMBOBOX_SKELETON_ROW_COUNT = 4;
  };
}
