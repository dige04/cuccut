import type * as React from "react";
import type * as Preview from "../../contracts/preview";
import type * as Model from "../../contracts";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installFilesUiTheme(runtime: RuntimeBindings): () => void {
  var reactHostTheme: typeof import("react");
  var reactPreviewThemeMenu: typeof import("react");
  var jsxPreviewThemeMenu: typeof import("react/jsx-runtime");
  function readHostThemeMode(): Preview.PreviewMode {
    let attribute = document.documentElement.getAttribute("data-theme");
    if (attribute === "light" || attribute === "dark") {
      return attribute;
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    } else {
      return "light";
    }
  }
  function useHostThemeMode(): Preview.PreviewMode {
    let [value, value2] = reactHostTheme.useState(readHostThemeMode);
    reactHostTheme.useEffect(() => {
      let callback = () => value2(readHostThemeMode()),
        value3 = window.matchMedia("(prefers-color-scheme: dark)");
      value3.addEventListener("change", callback);
      let value4 = new (window as Window & typeof globalThis).MutationObserver(
        callback,
      );
      value4.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      callback();
      return () => {
        value3.removeEventListener("change", callback);
        value4.disconnect();
      };
    }, []);
    return value;
  }
  function isDarkThemeName(name: string): boolean {
    return /dark|night/i.test(name);
  }
  function previewThemeDisabledReason(
    themeCount: number,
    components: Preview.PreviewComponent[],
    runnable: boolean,
  ): string | undefined {
    if (themeCount < 2) {
      return "This design system has no other themes";
    }
    if (!components.some((input) => input.previewHtml !== undefined)) {
      return "No components to preview yet";
    }
    if (!runnable) {
      return "These component previews are static pictures, so they can’t change theme";
    }
    return;
  }
  function resolvePreviewTheme(
    themes: Preview.PreviewTheme[],
    hostMode: Preview.PreviewMode,
    selectedId?: string | null,
  ): Preview.PreviewThemeResolution {
    let modeOf = (
        input: Preview.PreviewTheme | undefined,
      ): Preview.PreviewMode =>
        themes.length > 1 && input !== undefined
          ? isDarkThemeName(input.name)
            ? "dark"
            : "light"
          : hostMode,
      hostTheme =
        themes.find(
          (input) => isDarkThemeName(input.name) === (hostMode === "dark"),
        ) ?? themes[0],
      previewTheme =
        themes.find((input) => input.id === selectedId) ?? hostTheme,
      stageMode = modeOf(previewTheme);
    return {
      hostThemeId: hostTheme?.id,
      hostThemeMode: modeOf(hostTheme),
      previewThemeId: previewTheme?.id,
      stageMode: stageMode,
      needsGround: previewTheme?.id !== hostTheme?.id || stageMode !== hostMode,
    };
  }
  function PreviewThemeMenu({
    themes: themes,
    value: value,
    onChange: onChange,
    disabledWhy: disabledWhy,
  }: Preview.PreviewThemeMenuProps): React.ReactElement {
    let value2 =
        themes.length > 0
          ? themes
          : [
              {
                id: "light",
                name: "Light",
              },
            ],
      value3 = value2.find((input) => input.id === value) ?? value2[0],
      [value4, value5] = reactPreviewThemeMenu.useState(false);
    if (value4 && disabledWhy !== undefined) {
      value5(false);
    }
    return (
      <runtime.Menu.Root open={value4} onOpenChange={value5}>
        {[
          <runtime.DisabledReasonTooltip reason={disabledWhy}>
            <runtime.Menu.Trigger
              disabled={disabledWhy !== undefined}
              render={
                <runtime.Button
                  variant={"secondary"}
                  disabled={disabledWhy !== undefined}
                  aria-label={value3.name + ", Preview theme"}
                  className={"max-w-56"}
                  data-testid={"ds-theme-menu"}
                >
                  {[
                    <span className={"min-w-0 truncate text-left"}>
                      {value3.name}
                    </span>,
                    <runtime.Icon
                      name={"CaretDown"}
                      size={"xs"}
                      className={"shrink-0 text-muted"}
                    />,
                  ]}
                </runtime.Button>
              }
            />
          </runtime.DisabledReasonTooltip>,
          <runtime.Menu.Popup
            side={"bottom"}
            align={"end"}
            {...runtime.UNCOMMENTABLE_PROPS}
          >
            <runtime.Menu.Group data-testid={"ds-theme-menu-list"}>
              {[
                <runtime.Menu.GroupLabel>
                  {value2.length > 1 ? "Themes in this system" : "Theme"}
                </runtime.Menu.GroupLabel>,
                value2.map((input) =>
                  (() => {
                    const _Element = runtime.Menu.Item;
                    const _elementProps = {
                      checkedRole: "radio" as const,
                      checked: input.id === value3.id,
                      "data-testid": "ds-theme-" + input.id,
                      onClick: () => onChange(input.id),
                      children: (
                        <span className={"ds-menu-label"}>{input.name}</span>
                      ),
                    };
                    const _elementKey = input.id;
                    return <_Element key={_elementKey} {..._elementProps} />;
                  })(),
                ),
              ]}
            </runtime.Menu.Group>
          </runtime.Menu.Popup>,
        ]}
      </runtime.Menu.Root>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactHostTheme",
    () => reactHostTheme,
    (value) => {
      reactHostTheme = value;
    },
  );
  bindRuntimeValue(runtime, "readHostThemeMode", () => readHostThemeMode);
  bindRuntimeValue(runtime, "useHostThemeMode", () => useHostThemeMode);
  bindRuntimeValue(
    runtime,
    "reactPreviewThemeMenu",
    () => reactPreviewThemeMenu,
    (value) => {
      reactPreviewThemeMenu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPreviewThemeMenu",
    () => jsxPreviewThemeMenu,
    (value) => {
      jsxPreviewThemeMenu = value;
    },
  );
  bindRuntimeValue(runtime, "isDarkThemeName", () => isDarkThemeName);
  bindRuntimeValue(
    runtime,
    "previewThemeDisabledReason",
    () => previewThemeDisabledReason,
  );
  bindRuntimeValue(runtime, "resolvePreviewTheme", () => resolvePreviewTheme);
  bindRuntimeValue(runtime, "PreviewThemeMenu", () => PreviewThemeMenu);
  return () => {
    reactHostTheme = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactPreviewThemeMenu = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxPreviewThemeMenu = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
