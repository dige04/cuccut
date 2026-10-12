/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesDropShadowEditor(
  runtime: RuntimeBindings,
): () => void {
  var reactPropertiesDropShadowEditor: Dynamic;
  var reactPropertiesDropShadowEditor_2: Dynamic;
  var reactPropertiesDropShadowEditor_3: Dynamic;
  var jsxPropertiesDropShadowEditor: Dynamic;
  var PropertiesDropShadowEditorTest: Dynamic;
  function DropShadowEditor({
    value: value,
    open: open,
    onOpenChange: onOpenChange,
    disabled: disabled2,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
  }: Dynamic): Dynamic {
    let value2: Dynamic = (0, runtime.useEditorColorSwatches)(),
      [value3, value4]: Dynamic = (0,
      runtime.reactComponentsPropsPanel.useState)(false),
      value5: Dynamic = (0, runtime.reactComponentsPropsPanel.useRef)(null),
      state: Dynamic = {
        x: value.x,
        y: value.y,
        blur: value.blur,
        color: value.color,
      },
      callback: Dynamic = (input?: Dynamic): Dynamic => ({
        x: input.x,
        y: input.y,
        blur: input.blur,
        color: input.color,
      });
    return (
      <runtime.PropertyRow
        label={"Text shadow"}
        disabled={disabled2}
        data-testid={"dc-prop-text-shadow"}
        trailing={
          <runtime.RemovePropertyButton
            label={"Text shadow"}
            disabled={disabled2}
            onClick={(): Dynamic => {
              onOpenChange(false);
              onChange(null);
            }}
          />
        }
      >
        <span ref={value5} className={"relative flex min-w-0 flex-1"}>
          <runtime.PropertyEditorPopover
            open={open}
            onOpenChange={onOpenChange}
            trigger={
              <runtime.ColorEffectButton
                label={"Text shadow"}
                color={value.color}
                text={`${value.x}, ${value.y} \xB7 ${value.blur}px`}
                disabled={disabled2}
                onClick={(input?: Dynamic): Dynamic =>
                  value4(input.detail === 0)
                }
              />
            }
            anchor={(): Dynamic =>
              value5.current?.closest("[data-property-row]") ?? null
            }
            focusOnOpen={value3}
          >
            <runtime.ShadowEditor
              title={"Text shadow"}
              value={state}
              spread={false}
              bounds={runtime.PropertiesCssEffectsXYBlurConfig_2}
              disabled={disabled2}
              unifiedPopover={true}
              swatches={value2}
              onChange={(input?: Dynamic): Dynamic => onChange(callback(input))}
              onLive={(input?: Dynamic): Dynamic => onLive(callback(input))}
              onLiveEnd={onLiveEnd}
              onClose={(): Dynamic => onOpenChange(false)}
            />
          </runtime.PropertyEditorPopover>
        </span>
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(runtime, "DropShadowEditor", () => DropShadowEditor);
  bindRuntimeValue(
    runtime,
    "reactPropertiesDropShadowEditor",
    () => reactPropertiesDropShadowEditor,
    (value) => {
      reactPropertiesDropShadowEditor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactPropertiesDropShadowEditor_2",
    () => reactPropertiesDropShadowEditor_2,
    (value) => {
      reactPropertiesDropShadowEditor_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactPropertiesDropShadowEditor_3",
    () => reactPropertiesDropShadowEditor_3,
    (value) => {
      reactPropertiesDropShadowEditor_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesDropShadowEditor",
    () => jsxPropertiesDropShadowEditor,
    (value) => {
      jsxPropertiesDropShadowEditor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesDropShadowEditorTest",
    () => PropertiesDropShadowEditorTest,
    (value) => {
      PropertiesDropShadowEditorTest = value;
    },
  );
  return () => {
    reactPropertiesDropShadowEditor = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    reactPropertiesDropShadowEditor_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactPropertiesDropShadowEditor_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    jsxPropertiesDropShadowEditor = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesDropShadowEditorTest = (input?: Dynamic): Dynamic =>
      !/\b(var|env|attr|calc|color-mix)\(|^\s*(currentcolor|inherit|initial|unset|revert|revert-layer)\s*$/i.test(
        input,
      ) &&
      (typeof CSS === "undefined" ||
        typeof CSS.supports != "function" ||
        CSS.supports("color", input));
  };
}
