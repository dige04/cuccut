/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorChromeTheme(runtime: RuntimeBindings): () => void {
  var reactChromeTheme: Dynamic;
  var editorThemeTokens: Dynamic;
  var reactChromeTheme_2: Dynamic;
  var reactChromeTheme_3: Dynamic;

  bindRuntimeValue(
    runtime,
    "reactChromeTheme",
    () => reactChromeTheme,
    (value) => {
      reactChromeTheme = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "editorThemeTokens",
    () => editorThemeTokens,
    (value) => {
      editorThemeTokens = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactChromeTheme_2",
    () => reactChromeTheme_2,
    (value) => {
      reactChromeTheme_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactChromeTheme_3",
    () => reactChromeTheme_3,
    (value) => {
      reactChromeTheme_3 = value;
    },
  );
  return () => {
    reactChromeTheme = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    editorThemeTokens = {
      bg: {
        app: "var(--cds-page-bg)",
        panel: "var(--cds-surface-panel)",
        surface: "var(--cds-surface-2)",
        elevated: "var(--cds-surface-popover)",
        hover: "var(--cds-fill-ghost-hover)",
        hoverOpaque: "var(--om-bg-hover-opaque)",
        active: "var(--cds-fill-control)",
        selected: "var(--cds-fill-ghost-selected)",
        muted: "var(--cds-fill-control)",
        canvas: "var(--om-bg-canvas)",
        stripe: "var(--om-bg-stripe)",
        tintDesignSystem: "var(--cds-bg-danger)",
        tintTemplate: "var(--cds-bg-pro)",
        primaryTabBar: "var(--cds-fill-control)",
        secondaryTabBar: "var(--cds-surface-1)",
        errorTint: "var(--cds-bg-danger)",
        introSplash: "var(--cds-surface-1)",
        scrim: "var(--cds-backdrop)",
      },
      border: {
        subtle: "var(--cds-border)",
        card: "var(--cds-border)",
        default: "var(--cds-border)",
        strong: "var(--cds-border-strong)",
        focus: "var(--cds-border-stronger)",
        modal: "var(--cds-border)",
      },
      text: {
        primary: "var(--cds-text-primary)",
        prose: "var(--cds-text-primary)",
        secondary: "var(--cds-text-secondary)",
        tertiary: "var(--cds-text-secondary)",
        disabled: "var(--cds-text-disabled)",
        designSystemBadge: "var(--cds-text-danger)",
        inverse: "var(--cds-on-primary)",
        link: "var(--cds-text-accent)",
      },
      accent: {
        primary: "var(--cds-fill-accent)",
        primaryBg: "var(--cds-bg-accent)",
        primaryTint: "var(--cds-bg-accent)",
        primaryHover: "var(--cds-fill-accent-hover)",
        primaryActive: "var(--cds-fill-accent-hover)",
        secondary: "var(--cds-fill-accent)",
        secondaryHover: "var(--cds-fill-accent-hover)",
        secondaryActive: "var(--cds-fill-accent-hover)",
        success: "var(--cds-text-success)",
        sage: "var(--cds-text-success)",
        warning: "var(--cds-text-warning)",
        error: "var(--cds-text-danger)",
        errorHover: "var(--cds-fill-danger-hover)",
        errorActive: "var(--cds-fill-danger-hover)",
        blue: "var(--cds-fill-accent)",
        blueBg: "var(--cds-bg-accent)",
        blueHover: "var(--cds-fill-accent-hover)",
        review: "var(--cds-fill-accent)",
        verifier: "var(--cds-fill-pro)",
        verifierSoft: "var(--cds-bg-pro)",
        componentText: "var(--cds-text-pro)",
        black: "var(--cds-fill-primary)",
        blackHover: "var(--cds-fill-primary-hover)",
        blackActive: "var(--cds-fill-primary-hover)",
      },
      scrollbar: {
        thumb: "var(--cds-alpha-3)",
        thumbHover: "var(--cds-alpha-4)",
      },
      shadow: {
        xs: "var(--cds-shadow-sm)",
        sm: "var(--cds-shadow-sm)",
        md: "var(--cds-shadow-md)",
        diffuse: "var(--cds-shadow-md)",
        lg: "var(--cds-shadow-lg)",
        inset: "var(--om-shadow-inset)",
        modal: "var(--cds-shadow-lg)",
        card: "var(--cds-shadow-lg)",
        pin: "var(--cds-shadow-md)",
        pinHover: "var(--cds-shadow-lg)",
      },
    };
    (0, runtime.initializeCdsIndex)();
    reactChromeTheme_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    reactChromeTheme_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
  };
}
