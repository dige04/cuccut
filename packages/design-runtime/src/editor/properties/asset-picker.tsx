/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesAssetPicker(
  runtime: RuntimeBindings,
): () => void {
  var reactPropertiesAssetPicker: Dynamic;
  var reactPropertiesAssetPicker_2: Dynamic;
  var jsxPropertiesAssetPicker: Dynamic;
  var W155remValue: Dynamic;
  var W64Value: Dynamic;
  var jsxPropertiesAssetPicker_2: Dynamic;
  var PropertiesAssetPickerWebpAvifPattern: Dynamic;
  var reactPropertiesAssetPicker_3: Dynamic;
  var jsxPropertiesAssetPicker_3: Dynamic;
  var PropertiesAssetPickerPattern: Dynamic;
  var PropertiesAssetPickerAZAZPattern: Dynamic;
  function useAssetPickerContext(): Dynamic {
    return (0, runtime.reactPropertiesTokenColorPicker_2.useContext)(
      runtime.AssetPickerContext,
    );
  }
  function useProjectFiles(input?: Dynamic, options: Dynamic = ""): Dynamic {
    let [value, value2]: Dynamic = (0, reactPropertiesAssetPicker.useState)([]),
      [value3, value4]: Dynamic = (0, reactPropertiesAssetPicker.useState)(
        true,
      );
    (0, reactPropertiesAssetPicker.useEffect)((): Dynamic => {
      let flag: Dynamic = true;
      runtime.projectFilesystem
        .readdir(options)
        .then((input2?: Dynamic): Dynamic => {
          flag && value2(input2);
        })
        .catch((): Dynamic => {})
        .finally((): Dynamic => {
          flag && value4(false);
        });
      return (): Dynamic => {
        flag = false;
      };
    }, [options]);
    return {
      files: value,
      loading: value3,
    };
  }
  function PropertyAssetPopup({
    open: open,
    onOpenChange: onOpenChange,
    trigger: trigger,
    title: title,
    removeLabel: removeLabel,
    onRemove: onRemove,
    removeDisabled: removeDisabled,
    header: header,
    planHeight: planHeight,
    editsAreUndoSteps = false,
    children: children,
    "data-testid": dataTestid,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, reactPropertiesAssetPicker_2.useRef)(null),
      value2: Dynamic = (0, reactPropertiesAssetPicker_2.useRef)(null),
      [value3, value4]: Dynamic = (0, reactPropertiesAssetPicker_2.useState)({
        side: "bottom",
        maxHeight: undefined,
      });
    (0, reactPropertiesAssetPicker_2.useLayoutEffect)((): Dynamic => {
      open &&
        value4(
          planHeight !== undefined
            ? (0, runtime.choosePopoverPlacement)(
                value2.current?.firstElementChild,
                planHeight,
              )
            : {
                side: "bottom",
                maxHeight: undefined,
              },
        );
    }, [open]);
    let value5: Dynamic = (0, reactPropertiesAssetPicker_2.useRef)(null),
      value6: Dynamic = (0, reactPropertiesAssetPicker_2.useRef)(""),
      value7: Dynamic = (0, reactPropertiesAssetPicker_2.useRef)(false);
    return (
      <runtime.PopoverPopoverRootTriggerPopupConfig.Root
        open={open}
        modal={true}
        onOpenChange={(input?: Dynamic, options?: Dynamic): Dynamic => {
          if (!input && options.reason === "escape-key") {
            if (options.event.defaultPrevented) {
              options.cancel();
              return;
            }
            options.event.preventDefault();
          }
          onOpenChange(input);
        }}
      >
        <span ref={value2} className={"contents"}>
          <runtime.PopoverPopoverRootTriggerPopupConfig.Trigger
            render={trigger}
          />
        </span>
        <runtime.PopoverPopoverRootTriggerPopupConfig.Popup
          padding={"none"}
          side={value3.side}
          style={
            value3.maxHeight !== undefined
              ? {
                  maxHeight: value3.maxHeight,
                }
              : undefined
          }
          align={"start"}
          sideOffset={4}
          collisionPadding={8}
          initialFocus={(input?: Dynamic): Dynamic => {
            if (input === "touch") return true;
            if (editsAreUndoSteps && input !== "keyboard")
              return value.current?.closest('[data-cds="Popover"]') ?? true;
            let value8: Dynamic = value.current?.querySelector(
              'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])',
            );
            return value8
              ? (setTimeout((): Dynamic => {
                  value8.ownerDocument.activeElement === value8 &&
                    value8.select();
                }, 0),
                value8)
              : true;
          }}
          data-testid={dataTestid}
          {...(editsAreUndoSteps ? runtime.undoStepOverlayProps : {})}
          className={header !== undefined ? W64Value : W155remValue}
        >
          <div
            ref={value}
            className={(0, runtime.cn)(
              "flex flex-col pt-md [--pp-label-w:3rem]",
              header !== undefined
                ? "pb-4 [--pp-edge:16px] [--pp-gutter-l:16px] [--pp-gutter-r:16px]"
                : "pb-lg [--pp-gutter-r:var(--cds-pad-lg)]",
            )}
            onInputCapture={(event?: Dynamic): Dynamic => {
              (event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement) &&
                ((value5.current = event.target),
                (value6.current = event.target.value));
            }}
            onBlurCapture={(event?: Dynamic): Dynamic => {
              value5.current === event.target && (value5.current = null);
            }}
            onKeyDownCapture={(event?: Dynamic): Dynamic => {
              value7.current = false;
              let value8: Dynamic =
                (event.target instanceof HTMLInputElement ||
                  event.target instanceof HTMLTextAreaElement) &&
                value.current?.contains(event.target)
                  ? event.target
                  : null;
              if (!value8) return;
              let value9: Dynamic =
                value5.current === value8 && value8.value === value6.current;
              if (
                event.key === "Escape" &&
                value8.hasAttribute("data-kit-search") &&
                value8.value !== ""
              ) {
                value7.current = true;
                return;
              }
              event.key === "Escape"
                ? ((value7.current = value9),
                  (value5.current = null),
                  value9
                    ? setTimeout((): Dynamic => {
                        value8.isConnected &&
                          (value8.focus(),
                          value8 instanceof HTMLInputElement &&
                            value8.select());
                      }, 0)
                    : (document as Dynamic).querySelector(
                        "[data-mc-popover]",
                      ) === null && onOpenChange(false))
                : event.key === "Enter" && (value5.current = null);
            }}
            onKeyDown={(input?: Dynamic): Dynamic => {
              input.key === "Escape" &&
                value7.current &&
                ((value7.current = false), input.stopPropagation());
            }}
          >
            <div
              className={(0, runtime.cn)(
                "flex items-center gap-xs pr-md",
                header !== undefined ? "pb-1 pl-md" : "pb-xs pl-lg",
              )}
            >
              {header !== undefined ? (
                <jsxPropertiesAssetPicker.Fragment>
                  <runtime.PopoverPopoverRootTriggerPopupConfig.Title
                    className={"sr-only"}
                  >
                    {title}
                  </runtime.PopoverPopoverRootTriggerPopupConfig.Title>
                  <div className={"min-w-0 flex-1"}>{header}</div>
                </jsxPropertiesAssetPicker.Fragment>
              ) : (
                <runtime.PopoverPopoverRootTriggerPopupConfig.Title
                  className={
                    "min-w-0 flex-1 truncate text-body-semibold text-primary"
                  }
                >
                  {title}
                </runtime.PopoverPopoverRootTriggerPopupConfig.Title>
              )}
              {onRemove !== undefined ? (
                <runtime.Button
                  variant={"ghost"}
                  size={"sm"}
                  iconOnly={true}
                  icon={"Trash"}
                  aria-label={removeLabel ?? "Remove"}
                  disabled={removeDisabled}
                  onClick={(): Dynamic => {
                    onRemove();
                    onOpenChange(false);
                  }}
                />
              ) : null}
              <runtime.PopoverPopoverRootTriggerPopupConfig.Close
                render={
                  <runtime.Button
                    variant={"ghost"}
                    size={"sm"}
                    iconOnly={true}
                    icon={"X"}
                    aria-label={"Close"}
                  />
                }
              />
            </div>
            {children}
          </div>
        </runtime.PopoverPopoverRootTriggerPopupConfig.Popup>
      </runtime.PopoverPopoverRootTriggerPopupConfig.Root>
    );
  }
  function PropertyPopupField({
    label: label,
    className: className,
    children: children,
    ...props
  }: Dynamic): Dynamic {
    return (
      <div
        className={(0, runtime.cn)(
          "flex flex-col gap-xs pt-xs pl-[var(--pp-edge,var(--cds-pad-lg))] pr-[var(--pp-gutter-r,var(--cds-pad-lg))]",
          className,
        )}
        {...props}
      >
        {label !== undefined && (
          <span className={"text-footnote text-muted select-none"}>
            {label}
          </span>
        )}
        {children}
      </div>
    );
  }
  function resolveAssetPreviewUrl(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (options ?? "").trim();
    return value
      ? /^(https?:|data:|blob:)/i.test(value) ||
        runtime.blobAssetPathPattern.test(value)
        ? value
        : (0, runtime.resolveProjectAssetUrl)(input, value.replace(/^\.\//, ""))
      : null;
  }
  function escapeCssUrl(input?: Dynamic): Dynamic {
    return input.replace(
      /["'()\\\s]/g,
      (input2?: Dynamic): Dynamic =>
        "%" + input2.charCodeAt(0).toString(16).padStart(2, "0"),
    );
  }
  function AssetColorWell({ src: src }: Dynamic): Dynamic {
    let { projectPath: value }: Dynamic = useAssetPickerContext(),
      value2: Dynamic = resolveAssetPreviewUrl(value, src);
    return (
      <runtime.PropertyColorWell
        background={
          value2
            ? `url("${escapeCssUrl(value2)}") center / cover no-repeat`
            : undefined
        }
      />
    );
  }
  function ImageAssetPicker({
    value: value,
    onChange: onChange,
    disabled: disabled2,
    previewSize: previewSize,
    onPickFile: onPickFile,
    uploadOnlyReason: uploadOnlyReason,
  }: Dynamic): Dynamic {
    let { projectPath: value2 }: Dynamic = useAssetPickerContext(),
      { files: value3 }: Dynamic = useProjectFiles(value2),
      { showToast: value4 }: Dynamic = (0, runtime.useToast)(),
      [value5, value6]: Dynamic = (0,
      runtime.reactPropertiesTokenColorPicker.useState)(value ?? ""),
      value7: Dynamic = (0, runtime.reactPropertiesTokenColorPicker.useRef)(
        false,
      ),
      value8: Dynamic = (0, runtime.reactPropertiesTokenColorPicker.useRef)(
        false,
      );
    !value7.current && (value ?? "") !== value5 && value6(value ?? "");
    let value9: Dynamic = (0, runtime.reactPropertiesTokenColorPicker.useRef)(
        null,
      ),
      value10: Dynamic = (value3 ?? []).filter(
        (input?: Dynamic): Dynamic =>
          input.isFile && PropertiesAssetPickerWebpAvifPattern.test(input.name),
      ),
      callback: Dynamic = async (input?: Dynamic): Promise<Dynamic> => {
        try {
          let { src: value13 }: Dynamic = await (0, runtime.uploadDesignFile)(
            value2,
            null,
            input,
          );
          onChange(value13);
          return true;
        } catch (value13: Dynamic) {
          console.error("[dc-editor] image upload failed:", value13);
          value4("Could not upload the image.", "error");
          return false;
        }
      },
      value11: Dynamic = resolveAssetPreviewUrl(value2, value),
      value12: Dynamic = `repeating-conic-gradient(${runtime.editorThemeTokens.bg.muted} 0% 25%, ${runtime.editorThemeTokens.bg.elevated} 0% 50%) 0 / 8px 8px`;
    return (
      <jsxPropertiesAssetPicker_2.Fragment>
        {previewSize && (
          <runtime.PropertyRow className={"my-[3px]"}>
            <div
              data-testid={"dc-image-preview"}
              className={"h-24 min-w-0 flex-1 rounded-md shadow-card-ring"}
              style={{
                background: value11
                  ? `url("${escapeCssUrl(value11)}") center / ${previewSize} no-repeat, ${value12}`
                  : value12,
              }}
            />
          </runtime.PropertyRow>
        )}
        <runtime.PropertyRow label={"Source"} title={uploadOnlyReason}>
          <runtime.TextInput
            fullWidth={true}
            value={value5}
            placeholder={"https://\u2026 or ./file.png"}
            aria-label={"Image source"}
            inputMode={"url"}
            disabled={disabled2 || uploadOnlyReason !== undefined}
            onFocus={(input?: Dynamic): Dynamic => {
              value7.current = true;
              input.currentTarget.select();
            }}
            onChange={(event?: Dynamic): Dynamic => value6(event.target.value)}
            onBlur={(): Dynamic => {
              value7.current = false;
              if (value8.current) {
                value8.current = false;
                value6(value ?? "");
                return;
              }
              let value13: Dynamic = value5.trim();
              value13 !== (value ?? "") && onChange(value13 || null);
            }}
            onKeyDown={(event?: Dynamic): Dynamic => {
              (event.key === "Enter" || event.key === "Escape") &&
                (event.key === "Escape" &&
                  ((value8.current = true), value6(value ?? "")),
                event.target.blur());
            }}
          />
        </runtime.PropertyRow>
        <runtime.PropertyRow label={"Upload"}>
          <runtime.Button
            variant={"secondary"}
            icon={"Upload"}
            className={"min-w-0 flex-1"}
            disabled={disabled2}
            onClick={(): Dynamic => value9.current?.click()}
          >
            {"Upload image\u2026"}
          </runtime.Button>
          <input
            ref={value9}
            type={"file"}
            accept={"image/*"}
            style={{
              display: "none",
            }}
            onChange={(event?: Dynamic): Dynamic => {
              let value13: Dynamic = event.target.files?.[0];
              value13 &&
                (onPickFile
                  ? onPickFile(value13)
                  : (0, runtime.trackEmbeddedWrite)(callback(value13)));
              event.target.value = "";
            }}
          />
        </runtime.PropertyRow>
        {!previewSize && value10.length > 0 && (
          <PropertyPopupField label={"Project images"}>
            <div className={"-mx-1 flex max-h-40 flex-col overflow-y-auto"}>
              {value10.map((input?: Dynamic): Dynamic => {
                let value13: Dynamic = value === `./${input.name}`;
                return (() => {
                  const _Component = "button";
                  const _props = {
                    type: "button",
                    "aria-pressed": value13,
                    className: (0, runtime.cn)(
                      "flex min-h-control min-w-0 cursor-default items-center gap-sm overflow-hidden rounded-md px-1 text-left text-body text-primary outline-none focus-visible:outline-hidden focus-visible:shadow-focus forced-colors:focus-visible:-outline-offset-2",
                      value13
                        ? "bg-fill-ghost-hover"
                        : "bg-transparent hover:bg-fill-ghost-hover",
                    ),
                    disabled: disabled2,
                    onClick: (): Dynamic => onChange(`./${input.name}`),
                    children: [
                      <AssetColorWell src={input.name} />,
                      <span className={"min-w-0 flex-1 truncate"}>
                        {input.name}
                      </span>,
                      value13 && (
                        <runtime.Icon
                          name={"Check"}
                          size={"sm"}
                          className={"shrink-0 text-secondary"}
                        />
                      ),
                    ],
                  } as const;
                  const _key = input.name;
                  return <_Component key={_key} {..._props} />;
                })();
              })}
            </div>
          </PropertyPopupField>
        )}
        {!previewSize && value10.length === 0 && (
          <PropertyPopupField>
            <span className={"text-caption text-muted"}>
              {uploadOnlyReason !== undefined
                ? "No images in this project yet \u2014 upload one."
                : "No images in this project yet \u2014 upload one or paste a URL."}
            </span>
          </PropertyPopupField>
        )}
      </jsxPropertiesAssetPicker_2.Fragment>
    );
  }
  function PropertyImageRow({
    label: label,
    value: value,
    mixed: mixed,
    disabled: disabled2,
    onCommit: onCommit,
    onPickFile: onPickFile,
    uploadOnlyReason: uploadOnlyReason,
  }: Dynamic): Dynamic {
    let [value2, value3]: Dynamic = (0,
      runtime.reactPropertiesTokenColorPicker.useState)(false),
      value4: Dynamic = mixed
        ? "Mixed"
        : value?.startsWith("data:") && value.includes("#drop")
          ? "Uploading\u2026"
          : value || "Choose image\u2026";
    return (
      <PropertyAssetPopup
        open={value2}
        onOpenChange={value3}
        title={label}
        removeLabel={"Remove image"}
        removeDisabled={
          disabled2 || (!value && !mixed) || uploadOnlyReason !== undefined
        }
        onRemove={(): Dynamic => onCommit(null)}
        data-testid={"dc-image-popover"}
        trigger={
          <runtime.PropertyPickerButton
            aria-label={`${label}: ${value4}`}
            className={"w-full"}
            disabled={disabled2}
            chip={<AssetColorWell src={value} />}
            muted={!value}
          >
            {value4}
          </runtime.PropertyPickerButton>
        }
      >
        <ImageAssetPicker
          value={value}
          onChange={onCommit}
          disabled={disabled2}
          onPickFile={
            onPickFile &&
            ((input?: Dynamic): Dynamic => {
              value3(false);
              onPickFile(input);
            })
          }
          uploadOnlyReason={uploadOnlyReason}
        />
      </PropertyAssetPopup>
    );
  }
  bindRuntimeValue(
    runtime,
    "useAssetPickerContext",
    () => useAssetPickerContext,
  );
  bindRuntimeValue(
    runtime,
    "reactPropertiesAssetPicker",
    () => reactPropertiesAssetPicker,
    (value) => {
      reactPropertiesAssetPicker = value;
    },
  );
  bindRuntimeValue(runtime, "useProjectFiles", () => useProjectFiles);
  bindRuntimeValue(
    runtime,
    "reactPropertiesAssetPicker_2",
    () => reactPropertiesAssetPicker_2,
    (value) => {
      reactPropertiesAssetPicker_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesAssetPicker",
    () => jsxPropertiesAssetPicker,
    (value) => {
      jsxPropertiesAssetPicker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "W155remValue",
    () => W155remValue,
    (value) => {
      W155remValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "W64Value",
    () => W64Value,
    (value) => {
      W64Value = value;
    },
  );
  bindRuntimeValue(runtime, "PropertyAssetPopup", () => PropertyAssetPopup);
  bindRuntimeValue(runtime, "PropertyPopupField", () => PropertyPopupField);
  bindRuntimeValue(
    runtime,
    "jsxPropertiesAssetPicker_2",
    () => jsxPropertiesAssetPicker_2,
    (value) => {
      jsxPropertiesAssetPicker_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAssetPickerWebpAvifPattern",
    () => PropertiesAssetPickerWebpAvifPattern,
    (value) => {
      PropertiesAssetPickerWebpAvifPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveAssetPreviewUrl",
    () => resolveAssetPreviewUrl,
  );
  bindRuntimeValue(runtime, "escapeCssUrl", () => escapeCssUrl);
  bindRuntimeValue(runtime, "AssetColorWell", () => AssetColorWell);
  bindRuntimeValue(runtime, "ImageAssetPicker", () => ImageAssetPicker);
  bindRuntimeValue(runtime, "PropertyImageRow", () => PropertyImageRow);
  bindRuntimeValue(
    runtime,
    "reactPropertiesAssetPicker_3",
    () => reactPropertiesAssetPicker_3,
    (value) => {
      reactPropertiesAssetPicker_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesAssetPicker_3",
    () => jsxPropertiesAssetPicker_3,
    (value) => {
      jsxPropertiesAssetPicker_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAssetPickerPattern",
    () => PropertiesAssetPickerPattern,
    (value) => {
      PropertiesAssetPickerPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAssetPickerAZAZPattern",
    () => PropertiesAssetPickerAZAZPattern,
    (value) => {
      PropertiesAssetPickerAZAZPattern = value;
    },
  );
  return () => {
    reactPropertiesAssetPicker = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactPropertiesAssetPicker_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxPropertiesAssetPicker = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    W155remValue = "w-[15.5rem]";
    W64Value = "w-64";
    jsxPropertiesAssetPicker_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesAssetPickerWebpAvifPattern = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
    reactPropertiesAssetPicker_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxPropertiesAssetPicker_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesAssetPickerPattern = /^-?[\d.]+(%|[a-z]+)?$/i;
    PropertiesAssetPickerAZAZPattern =
      /^(#[0-9a-f]{3,8}|[a-z-]+|[a-z-]+\((?:[^()]|\([^()]*\))*\))$/i;
  };
}
