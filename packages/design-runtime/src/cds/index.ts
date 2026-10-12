/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCdsIndex(runtime: RuntimeBindings): () => void {
  var initializeCdsIndex: Dynamic;

  bindRuntimeValue(
    runtime,
    "initializeCdsIndex",
    () => initializeCdsIndex,
    (value) => {
      initializeCdsIndex = value;
    },
  );
  return () => {
    initializeCdsIndex = (0, runtime.initializeOnce)((): Dynamic => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeTokens)();
      (0, runtime.initializeComponentsIcon_2)();
      (0, runtime.initializeEditorAlignmentGuides)();
      (0, runtime.initializeComponentsShortcut)();
      (0, runtime.initializeTooltipTooltip)();
      (0, runtime.initializeComponentsCollapsible)();
      (0, runtime.initializeComponentsSpinner)();
      (0, runtime.initializeTooltipDeferredProvider)();
      (0, runtime.initializeButtonButton)();
      (0, runtime.initializeComponentsSkeleton)();
      (0, runtime.initializeComponentsSurface)();
      (0, runtime.initializeComponentsTextInput)();
      (0, runtime.initializeMenuItemStyles)();
      (0, runtime.initializeMenuMenu_5)();
      (0, runtime.initializePopoverPopover_2)();
      (0, runtime.initializeComponentsTextArea)();
      (0, runtime.initializeComponentsBadge)();
      (0, runtime.initializeComponentsCounter_3)();
      (0, runtime.initializeComponentsCounter_5)();
      (0, runtime.initializeComponentsTextLink)();
      (0, runtime.initializeDialogDialog)();
      (0, runtime.initializeButtonGroup_4)();
      (0, runtime.initializeComponentsSwitch)();
      (0, runtime.initializeComponentsRadioGroup)();
      (0, runtime.initializeComponentsSelectionPoints)();
      (0, runtime.initializeComponentsSelectionRing)();
      (0, runtime.initializeComponentsSelectionRing_2)();
      (0, runtime.initializeComponentsSelectionRing_3)();
      (0, runtime.initializeComponentsSelectionRing_5)();
      (0, runtime.initializeComponentsSelectionRing_7)();
      (0, runtime.initializeTabsTabs)();
      (0, runtime.initializeToastToast)();
      (0, runtime.initializeFieldField_6)();
    });
  };
}
