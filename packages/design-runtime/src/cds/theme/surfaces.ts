import type {
  ColorMode,
  Elevation,
  SurfaceBackground,
  VirtualTriggerAnchor,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsThemeSurfaces(runtime: RuntimeBindings): () => void {
  var surfaceBackgroundTokens: Record<Elevation, SurfaceBackground>;
  var ThemeSurfacesPanelPopoverConfig: Record<Elevation, string>;
  var ThemeSurfacesSurface2Surface3Config: Record<SurfaceBackground, string>;
  var focusShadowTokens: Record<ColorMode, string>;
  var dangerFocusShadowTokens: Record<ColorMode, string>;
  var initializeThemeSurfaces: () => void;
  function virtualTriggerAnchor(input: {
    triggerRef: React.RefObject<Element | null>;
  }): VirtualTriggerAnchor {
    return {
      get contextElement() {
        return input.triggerRef.current ?? undefined;
      },
      getBoundingClientRect: () => {
        let value = input.triggerRef.current?.getBoundingClientRect(),
          value2 = input.triggerRef.current
            ?.closest(runtime.MenuConfigurationLabel)
            ?.getBoundingClientRect(),
          value3 = value2?.x ?? value?.x ?? 0,
          value4 = value?.y ?? 0,
          value5 = value2?.width ?? value?.width ?? 0,
          value6 = value?.height ?? 0;
        return {
          x: value3,
          y: value4,
          width: value5,
          height: value6,
          top: value4,
          left: value3,
          right: value3 + value5,
          bottom: value4 + value6,
        };
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "surfaceBackgroundTokens",
    () => surfaceBackgroundTokens,
    (value) => {
      surfaceBackgroundTokens = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeSurfacesPanelPopoverConfig",
    () => ThemeSurfacesPanelPopoverConfig,
    (value) => {
      ThemeSurfacesPanelPopoverConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThemeSurfacesSurface2Surface3Config",
    () => ThemeSurfacesSurface2Surface3Config,
    (value) => {
      ThemeSurfacesSurface2Surface3Config = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "focusShadowTokens",
    () => focusShadowTokens,
    (value) => {
      focusShadowTokens = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dangerFocusShadowTokens",
    () => dangerFocusShadowTokens,
    (value) => {
      dangerFocusShadowTokens = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeThemeSurfaces",
    () => initializeThemeSurfaces,
    (value) => {
      initializeThemeSurfaces = value;
    },
  );
  bindRuntimeValue(runtime, "virtualTriggerAnchor", () => virtualTriggerAnchor);
  return () => {
    initializeThemeSurfaces = (0, runtime.initializeOnce)(() => {
      surfaceBackgroundTokens = {
        panel: "surface-2",
        popover: "surface-3",
      };
      ThemeSurfacesPanelPopoverConfig = {
        panel: "shadow-panel-sm",
        popover: "shadow-panel",
      };
      ThemeSurfacesSurface2Surface3Config = {
        "surface-2": "bg-surface-2",
        "surface-3": "bg-surface-3",
      };
      focusShadowTokens = {
        light:
          "inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-accent), 0 0 6px 1px var(--cds-bg-accent)",
        dark: "inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-accent), 0 0 6px 1px hsl(from var(--cds-role-accent-600) h s l / 60%)",
      };
      dangerFocusShadowTokens = {
        light:
          "inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-danger), 0 0 6px 1px var(--cds-bg-danger)",
        dark: "inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-danger), 0 0 6px 1px hsl(from var(--cds-role-danger-600) h s l / 60%)",
      };
    });
  };
}
