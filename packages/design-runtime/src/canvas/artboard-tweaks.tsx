/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasArtboardTweaks(
  runtime: RuntimeBindings,
): () => void {
  var react_Uu: Dynamic;
  var jsx_wc: Dynamic;
  var artboardTweaksRowHeight: Dynamic;
  var artboardTweaksChipHeight: Dynamic;
  var artboardTweaksChipFontSize: Dynamic;
  var tweaksSecondaryTextClass: Dynamic;
  var tweaksValueTextClass: Dynamic;
  function ArtboardTweaksRow({
    file: file,
    dcProps: dcProps,
    width: width,
    interactive = true,
    keyboardInert = false,
    readonly = false,
    onOpenTweaks: onOpenTweaks,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, react_Uu.useMemo)(
        (): Dynamic =>
          (0, runtime.groupComponentProps)(
            Object.entries(dcProps.propsMeta).filter(
              ([, input]: Dynamic): Dynamic =>
                (0, runtime.isEditablePropMetadata)(input),
            ),
          ).flatMap((input?: Dynamic): Dynamic => input.rows),
        [dcProps.propsMeta],
      ),
      value2: Dynamic = (0, react_Uu.useRef)(null),
      value3: Dynamic = (0, react_Uu.useRef)(0),
      [value4, value5]: Dynamic = (0, react_Uu.useState)(value.length),
      [value6, value7]: Dynamic = (0, react_Uu.useState)(0),
      value8: Dynamic = width - 2 * artboardTweaksChipFontSize;
    (0, react_Uu.useEffect)((): Dynamic => {
      let current: Dynamic = value2.current;
      if (!current || typeof ResizeObserver === "undefined") return;
      let observer: Dynamic = new ResizeObserver(
        (): Dynamic => value7((input?: Dynamic): Dynamic => input + 1),
      );
      observer.observe(current);
      return (): Dynamic => observer.disconnect();
    }, []);
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
      value3.current += input ? 1 : -1;
      value3.current <= 0 &&
        ((value3.current = 0),
        value7((input2?: Dynamic): Dynamic => input2 + 1));
    };
    (0, react_Uu.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value2.current;
      if (!current || value3.current > 0) return;
      let value10: Dynamic = [...current.children].map(
          (input?: Dynamic): Dynamic => input.offsetWidth,
        ),
        value11: Dynamic = value10[value10.length - 1] ?? 0,
        value12: Dynamic = value10.slice(0, -1);
      if (
        value12.reduce(
          (input?: Dynamic, options?: Dynamic): Dynamic => input + options,
          0,
        ) +
          artboardTweaksChipHeight * (value12.length - 1) <=
        value8
      ) {
        value5(value12.length);
        return;
      }
      let index: Dynamic = 0,
        index2: Dynamic = 0;
      for (; index2 < value12.length; index2++) {
        let value13: Dynamic =
          index + (index2 > 0 ? artboardTweaksChipHeight : 0) + value12[index2];
        if (value13 + artboardTweaksChipHeight + value11 > value8) break;
        index = value13;
      }
      value5(index2);
    }, [value, dcProps.values, value8, value6]);
    let value9: Dynamic = value.length - value4,
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        value
          .slice(0, input ? value.length : value4)
          .map(
            ([input2, input3]: Dynamic): Dynamic => (
              <TweakValuePopover
                key={input2}
                name={input2}
                meta={input3}
                value={dcProps.values[input2]}
                onChange={(input4?: Dynamic): Dynamic =>
                  dcProps.setProp(input2, input4)
                }
                onOpenChange={callback}
                inert={input}
              />
            ),
          ),
      callback3: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => (
        <button
          type={"button"}
          data-testid={
            options ? undefined : "mega-artboard-tweaks-more-" + file
          }
          disabled={readonly}
          title={
            readonly
              ? runtime.ViewOnlyYouCanInspectThisMessage
              : "Show all tweaks"
          }
          aria-label={
            input === value.length
              ? undefined
              : "+" +
                String(input) +
                ", show all " +
                String(value.length) +
                " tweaks"
          }
          className={
            "pointer-events-auto inline-flex h-6 shrink-0 items-center whitespace-nowrap text-secondary hover:text-primary disabled:opacity-50"
          }
          onPointerDown={(input2?: Dynamic): Dynamic =>
            input2.stopPropagation()
          }
          onClick={(input2?: Dynamic): Dynamic => {
            input2.stopPropagation();
            options || onOpenTweaks?.(file);
          }}
        >
          {input === value.length
            ? String(input) + (input === 1 ? " tweak" : " tweaks")
            : "+" + String(input)}
        </button>
      );
    return (
      <div
        data-mega-chrome={"tweaks"}
        data-testid={"mega-artboard-tweaks-" + file}
        inert={keyboardInert ? true : undefined}
        className={(0, runtime.cn)(
          "pointer-events-none relative z-[25] w-full shrink-0 overflow-hidden border-b bg-page text-xs",
          !interactive && "[&_*]:!pointer-events-none",
        )}
        style={{
          height: artboardTweaksRowHeight,
        }}
        onPointerDown={(input?: Dynamic): Dynamic => input.stopPropagation()}
        onDoubleClick={(input?: Dynamic): Dynamic => input.stopPropagation()}
        onKeyDown={(input?: Dynamic): Dynamic => {
          input.key !== "Escape" && input.stopPropagation();
        }}
      >
        <div
          className={"flex h-full w-full items-center"}
          style={{
            gap: artboardTweaksChipHeight,
            paddingLeft: artboardTweaksChipFontSize,
            paddingRight: artboardTweaksChipFontSize,
          }}
        >
          {callback2(false)}
          {value9 > 0 && callback3(value9, false)}
        </div>
        <div
          ref={value2}
          aria-hidden={"true"}
          className={
            "invisible absolute top-0 left-0 inline-flex h-full items-center"
          }
          style={{
            gap: artboardTweaksChipHeight,
            paddingLeft: artboardTweaksChipFontSize,
            paddingRight: artboardTweaksChipFontSize,
          }}
        >
          {callback2(true)}
          {callback3(value.length, true)}
        </div>
      </div>
    );
  }
  function describeTweakValue(input?: Dynamic, options?: Dynamic): Dynamic {
    switch (input.editor) {
      case "color":
        return {
          color:
            typeof options == "string" && options.trim() !== ""
              ? options.trim()
              : Array.isArray(options) && typeof options[0] == "string"
                ? options[0]
                : null,
        };
      case "boolean":
        return {
          text: options ? "On" : "Off",
        };
      case "enum": {
        let value: Dynamic = (0, runtime.propOptionItems)(input.options),
          value2: Dynamic = options ?? value[0]?.value;
        return {
          text:
            (typeof value2 == "object" && value2 !== null
              ? undefined
              : value.find(
                  (input2?: Dynamic): Dynamic =>
                    String(input2.value) === String(value2),
                )
            )?.label ?? (0, runtime.primitivePropText)(value2),
        };
      }
      case "int":
      case "float":
      case "range": {
        let value: Dynamic =
            typeof options == "number"
              ? options
              : parseFloat((0, runtime.primitivePropText)(options)),
          value2: Dynamic = typeof input.unit == "string" ? input.unit : "";
        return {
          text:
            (Number.isFinite(value) ? String(value) : "\u2014") +
            (value2 ? " " + value2 : ""),
        };
      }
      default:
        return {};
    }
  }
  function TweakValuePopover({
    name: name,
    meta: meta,
    value: value,
    onChange: onChange,
    onOpenChange: onOpenChange,
    inert: inert,
  }: Dynamic): Dynamic {
    let [value2, value3]: Dynamic = (0, react_Uu.useState)(false),
      value4: Dynamic = (0, react_Uu.useRef)(null),
      [value5, value6]: Dynamic = (0, react_Uu.useState)({
        side: "bottom",
        maxHeight: undefined,
      });
    (0, react_Uu.useLayoutEffect)((): Dynamic => {
      value2 &&
        value6(
          meta.editor === "color"
            ? (0, runtime.choosePopoverPlacement)(
                value4.current?.firstElementChild,
                runtime.ColorPickerConstant,
              )
            : {
                side: "bottom",
                maxHeight: undefined,
              },
        );
    }, [value2]);
    let value7: Dynamic = (0, react_Uu.useRef)(onOpenChange);
    value7.current = onOpenChange;
    (0, react_Uu.useEffect)((): Dynamic => {
      if (value2) {
        value7.current?.(true);
        return (): Dynamic => value7.current?.(false);
      }
    }, [value2]);
    let value8: Dynamic = value === undefined ? meta.default : value,
      value9: Dynamic = describeTweakValue(meta, value8),
      value10: Dynamic = (
        <button
          type={"button"}
          data-testid={inert ? undefined : "mega-tweak-chip-" + name}
          tabIndex={inert ? -1 : undefined}
          title={name}
          className={
            "pointer-events-auto relative inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-1 hover:bg-black/5"
          }
          onPointerDown={(input?: Dynamic): Dynamic => input.stopPropagation()}
          onClick={(input?: Dynamic): Dynamic => input.stopPropagation()}
        >
          <span
            aria-hidden={"true"}
            className={
              "absolute top-1/2 left-1/2 hidden h-10 w-full min-w-10 -translate-x-1/2 -translate-y-1/2 pointer-coarse:block"
            }
          />
          {"color" in value9 ? (
            <span
              className={
                "block h-2.5 w-2.5 rounded-[3px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]"
              }
              style={{
                background:
                  value9.color == null
                    ? "#000000"
                    : (0, runtime.sanitizeCssColor)(value9.color),
              }}
            />
          ) : null}
          <span className={tweaksSecondaryTextClass}>{name}</span>
          {value9.text != null && (
            <span className={tweaksValueTextClass}>{value9.text}</span>
          )}
          <runtime.EditorIcon name={"CaretDown"} size={11} />
        </button>
      );
    return inert ? (
      value10
    ) : (
      <runtime.PopoverPopoverRootTriggerPopupConfig.Root
        open={value2}
        modal={true}
        onOpenChange={(input?: Dynamic, options?: Dynamic): Dynamic => {
          !input &&
            options.reason === "escape-key" &&
            options.event.preventDefault();
          value3(input);
        }}
      >
        <span ref={value4} className={"contents"}>
          <runtime.PopoverPopoverRootTriggerPopupConfig.Trigger
            render={value10}
          />
        </span>
        <runtime.PopoverPopoverRootTriggerPopupConfig.Popup
          data-tweak-popup={""}
          side={value5.side}
          style={
            value5.maxHeight !== undefined
              ? {
                  maxHeight: value5.maxHeight,
                }
              : undefined
          }
          align={"start"}
          padding={
            hasTweakValueEditor(meta) || meta.editor === "color" ? "none" : "md"
          }
          aria-label={name}
          className={
            hasTweakValueEditor(meta)
              ? "w-72"
              : meta.editor === "color"
                ? undefined
                : "w-80"
          }
          onPointerDown={(input?: Dynamic): Dynamic => input.stopPropagation()}
        >
          <TweakOptionsEditor
            name={name}
            meta={meta}
            cur={value8}
            onChange={onChange}
          />
        </runtime.PopoverPopoverRootTriggerPopupConfig.Popup>
      </runtime.PopoverPopoverRootTriggerPopupConfig.Root>
    );
  }
  function hasTweakValueEditor(input?: Dynamic): Dynamic {
    return (
      input.editor !== "color" && input.editor !== "text" && !!input.editor
    );
  }
  function TweakOptionsEditor({
    name: name,
    meta: meta,
    cur: cur,
    onChange: onChange,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, react_Uu.useMemo)(
        (): Dynamic =>
          (Array.isArray(meta.options) ? meta.options : []).slice(0, 64),
        [meta.options],
      ),
      value2: Dynamic =
        (0, runtime.propColorEditorKind)(value) === "palette-cards",
      value3: Dynamic = (0, react_Uu.useMemo)(
        (): Dynamic =>
          value2
            ? []
            : value.filter(
                (input?: Dynamic): Dynamic => typeof input == "string",
              ),
        [value.join("\0"), value.length, value2],
      ),
      value4: Dynamic = (0, react_Uu.useMemo)(
        (): Dynamic => (0, runtime.propColorOptionKeys)(value3),
        [value3],
      ),
      value5: Dynamic = (0, runtime.useDesignSystems)(),
      value6: Dynamic = (0, react_Uu.useMemo)(
        (): Dynamic =>
          (0, runtime.designSystemPropColorOptions)(value3, value4, value5),
        [value3, value4, value5],
      );
    if (meta.editor === "text" || !meta.editor) {
      let value8: Dynamic = (0, runtime.primitivePropText)(cur);
      return (
        <label className={"flex flex-col gap-1.5"}>
          <span className={"text-caption font-medium text-secondary"}>
            {name}
          </span>
          <runtime.TextArea
            autoFocus={true}
            rows={Math.min(4, Math.max(2, Math.ceil(value8.length / 40)))}
            value={value8}
            aria-label={name}
            onChange={(event?: Dynamic): Dynamic =>
              onChange(event.target.value)
            }
          />
        </label>
      );
    }
    if (hasTweakValueEditor(meta))
      return (
        <runtime.PropertyPanelRoot className={"py-1.5 [--pp-label-w:52px]"}>
          <runtime.ComponentPropInput
            name={name}
            meta={meta}
            value={cur}
            onChange={onChange}
            tweak={true}
          />
        </runtime.PropertyPanelRoot>
      );
    if (value2)
      return (
        <div className={"w-64 p-md"}>
          <runtime.PropPaletteCards
            aria-label={name}
            options={value}
            value={cur}
            onChange={onChange}
          />
        </div>
      );
    let value7: Dynamic =
      typeof cur == "string" && cur.trim() !== "" ? cur.trim() : null;
    return (
      <runtime.ColorPickerWithSwatches
        title={name}
        value={value7 ?? "#000000"}
        unset={value7 === null}
        swatches={value6}
        onChange={(input?: Dynamic): Dynamic =>
          onChange((0, runtime.restorePropColorOption)(value3, value4, input))
        }
        className={runtime.ColorPickerLabel}
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "react_Uu",
    () => react_Uu,
    (value) => {
      react_Uu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_wc",
    () => jsx_wc,
    (value) => {
      jsx_wc = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardTweaksRowHeight",
    () => artboardTweaksRowHeight,
    (value) => {
      artboardTweaksRowHeight = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardTweaksChipHeight",
    () => artboardTweaksChipHeight,
    (value) => {
      artboardTweaksChipHeight = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardTweaksChipFontSize",
    () => artboardTweaksChipFontSize,
    (value) => {
      artboardTweaksChipFontSize = value;
    },
  );
  bindRuntimeValue(runtime, "ArtboardTweaksRow", () => ArtboardTweaksRow);
  bindRuntimeValue(
    runtime,
    "tweaksSecondaryTextClass",
    () => tweaksSecondaryTextClass,
    (value) => {
      tweaksSecondaryTextClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tweaksValueTextClass",
    () => tweaksValueTextClass,
    (value) => {
      tweaksValueTextClass = value;
    },
  );
  bindRuntimeValue(runtime, "describeTweakValue", () => describeTweakValue);
  bindRuntimeValue(runtime, "TweakValuePopover", () => TweakValuePopover);
  bindRuntimeValue(runtime, "hasTweakValueEditor", () => hasTweakValueEditor);
  bindRuntimeValue(runtime, "TweakOptionsEditor", () => TweakOptionsEditor);
  return () => {
    react_Uu = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    (0, runtime.initializeCdsIndex)();
    jsx_wc = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    artboardTweaksRowHeight = 36;
    artboardTweaksChipHeight = 20;
    artboardTweaksChipFontSize = 14;
    tweaksSecondaryTextClass = "text-secondary";
    tweaksValueTextClass = "text-primary tabular-nums";
  };
}
