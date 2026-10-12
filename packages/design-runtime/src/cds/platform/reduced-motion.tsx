import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsPlatformReducedMotion(
  runtime: RuntimeBindings,
): () => void {
  var reactPlatformReducedMotion: typeof React;
  var reducedMotionMediaQuery: string;
  var reducedMotionAttribute: string;
  var initializePlatformReducedMotion: () => void;
  var DurationSheetValue: string;
  var PlatformReducedMotionCss: string;
  var PlatformReducedMotionClassNames: string;
  var PlatformReducedMotionCss_2: string;
  var PlatformReducedMotionLabel: string;
  var PlatformReducedMotionCss_3: string;
  var PlatformReducedMotionCss_4: string;
  var PlatformReducedMotionClassNames_2: string;
  var PlatformReducedMotionClassNames_3: string;
  var ClipPathInset00200vh0Value: string;
  var PlatformReducedMotionLabel_2: string;
  var initializePlatformReducedMotion_2: () => void;
  bindRuntimeValue(
    runtime,
    "reactPlatformReducedMotion",
    () => reactPlatformReducedMotion,
    (value) => {
      reactPlatformReducedMotion = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reducedMotionMediaQuery",
    () => reducedMotionMediaQuery,
    (value) => {
      reducedMotionMediaQuery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reducedMotionAttribute",
    () => reducedMotionAttribute,
    (value) => {
      reducedMotionAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePlatformReducedMotion",
    () => initializePlatformReducedMotion,
    (value) => {
      initializePlatformReducedMotion = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DurationSheetValue",
    () => DurationSheetValue,
    (value) => {
      DurationSheetValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformReducedMotionCss",
    () => PlatformReducedMotionCss,
    (value) => {
      PlatformReducedMotionCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformReducedMotionClassNames",
    () => PlatformReducedMotionClassNames,
    (value) => {
      PlatformReducedMotionClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformReducedMotionCss_2",
    () => PlatformReducedMotionCss_2,
    (value) => {
      PlatformReducedMotionCss_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformReducedMotionLabel",
    () => PlatformReducedMotionLabel,
    (value) => {
      PlatformReducedMotionLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformReducedMotionCss_3",
    () => PlatformReducedMotionCss_3,
    (value) => {
      PlatformReducedMotionCss_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformReducedMotionCss_4",
    () => PlatformReducedMotionCss_4,
    (value) => {
      PlatformReducedMotionCss_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformReducedMotionClassNames_2",
    () => PlatformReducedMotionClassNames_2,
    (value) => {
      PlatformReducedMotionClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformReducedMotionClassNames_3",
    () => PlatformReducedMotionClassNames_3,
    (value) => {
      PlatformReducedMotionClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipPathInset00200vh0Value",
    () => ClipPathInset00200vh0Value,
    (value) => {
      ClipPathInset00200vh0Value = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformReducedMotionLabel_2",
    () => PlatformReducedMotionLabel_2,
    (value) => {
      PlatformReducedMotionLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePlatformReducedMotion_2",
    () => initializePlatformReducedMotion_2,
    (value) => {
      initializePlatformReducedMotion_2 = value;
    },
  );
  return () => {
    initializePlatformReducedMotion = (0, runtime.initializeOnce)(() => {
      "use client";

      reactPlatformReducedMotion = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";
      reducedMotionAttribute = "data-reduce-motion";
    });
    initializePlatformReducedMotion_2 = (0, runtime.initializeOnce)(() => {
      DurationSheetValue = "duration-sheet";
      PlatformReducedMotionCss = `${DurationSheetValue} ease-out motion-reduce:transition-none`;
      PlatformReducedMotionClassNames = "rounded-t-card rounded-b-none";
      PlatformReducedMotionCss_2 = `group/sheet relative w-full min-w-0 max-w-none overflow-hidden ${PlatformReducedMotionClassNames} pb-[max(env(safe-area-inset-bottom),0.5rem)] transition-[translate,height,scale] ${PlatformReducedMotionCss} [&_[data-cds-sheet-scroll]]:overscroll-contain [&[data-cds-sheet-pressed]_[data-cds-sheet-scroll]]:[scroll-padding-block:0px]`;
      PlatformReducedMotionLabel = "calc(100% + 1.5rem)";
      PlatformReducedMotionCss_3 = `flex min-h-0 flex-1 flex-col transition-[translate] ${PlatformReducedMotionCss} group-data-[cds-sheet-drilled]/sheet:-translate-x-full rtl:group-data-[cds-sheet-drilled]/sheet:translate-x-full`;
      PlatformReducedMotionCss_4 = `draggable-none fixed inset-0 bg-backdrop transition-opacity ${PlatformReducedMotionCss} data-[starting-style]:opacity-0 data-[ending-style]:opacity-0`;
      PlatformReducedMotionClassNames_2 =
        "draggable-none fixed inset-0 bg-transparent";
      PlatformReducedMotionClassNames_3 =
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[100dvh] after:bg-surface-3";
      ClipPathInset00200vh0Value = "[clip-path:inset(0_0_-200vh_0)]";
      PlatformReducedMotionLabel_2 =
        "[&_[role=separator]]:-mx-1 [&_[role=separator]]:mt-0";
    });
  };
}
