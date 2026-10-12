/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsButtonGroup(runtime: RuntimeBindings): () => void {
  var reactButtonGroup: Dynamic;
  var jsxButtonGroup: Dynamic;
  var ButtonGroupClassNames: Dynamic;
  var ButtonGroupSecondaryPrimaryDangerConfig: Dynamic;
  var buttonGroupJoinClasses: Dynamic;
  var ButtonGroupLabel: Dynamic;
  var initializeButtonGroup: Dynamic;
  var reactButtonGroup_2: Dynamic;
  var jsxButtonGroup_2: Dynamic;
  var ButtonGroupAspectRatioPaddingInlineMinWidthConfig: Dynamic;
  var ButtonGroupWidthConfig: Dynamic;
  var ButtonGroupPaddingInlineEndConfig: Dynamic;
  var ButtonGroupLabel_2: Dynamic;
  var ButtonGroupPaddingInlineEndConfig_2: Dynamic;
  var ButtonGroupPrimarySecondaryGhostConfig: Dynamic;
  var ButtonGroupLabel_3: Dynamic;
  var PeerDisabledNotAriaBusySlotOpacityDisabledValue: Dynamic;
  var ButtonGroupPaddingInlineStartConfig: Dynamic;
  var ButtonGroupClassNames_2: Dynamic;
  var ButtonGroupLabel_4: Dynamic;
  var GroupDataPopupOpenSplitPointerEventsNoneValue: Dynamic;
  var ButtonGroupClassNames_3: Dynamic;
  var ButtonGroupClassNames_4: Dynamic;
  var ButtonGroupJoinValue: Dynamic;
  var ButtonGroupLabel_5: Dynamic;
  var initializeButtonGroup_2: Dynamic;
  var ButtonGroupObservedElements: Dynamic;
  var initializeButtonGroup_3: Dynamic;
  var reactButtonGroup_3: Dynamic;
  var jsxButtonGroup_3: Dynamic;
  var initializeButtonGroup_4: Dynamic;
  function ButtonGroupDivider({ variant: variant }: Dynamic): Dynamic {
    let value: Dynamic = ButtonGroupSecondaryPrimaryDangerConfig[variant];
    if (!value)
      return (
        <span aria-hidden={true} className={"w-px shrink-0 self-stretch"} />
      );
    let value2: Dynamic = variant === "secondary" ? "" : ButtonGroupLabel;
    return (
      <span
        aria-hidden={true}
        className={`relative w-px shrink-0 self-stretch ${value.seam} ${buttonGroupJoinClasses} ${value2}`}
      >
        <span
          data-cds-seam-line={""}
          className={`absolute inset-x-0 inset-y-[4px] ${value.line}`}
        />
      </span>
    );
  }
  function ButtonGroupLayout({
    "aria-label": ariaLabel,
    variant = "spaced",
    orientation = "horizontal",
    size: size,
    buttonVariant = "secondary",
    className: className,
    children: children,
    ...props
  }: Dynamic): Dynamic {
    let value: Dynamic = variant === "joined",
      value2: Dynamic = reactButtonGroup.Children.toArray(children),
      value3: Dynamic = value2.length - 1,
      value4: Dynamic = value && value3 > 0,
      value5: Dynamic = (0, reactButtonGroup.useMemo)((): Dynamic => {
        let state: Dynamic = {
          size: size,
          buttonVariant: buttonVariant,
          enforceVariant: value,
        };
        return {
          start: {
            ...state,
            joined: value4 ? "start" : undefined,
          },
          middle: {
            ...state,
            joined: value4 ? "middle" : undefined,
          },
          end: {
            ...state,
            joined: value4 ? "end" : undefined,
          },
        };
      }, [size, buttonVariant, value, value4]);
    return (
      <div
        data-cds={"ButtonGroup"}
        {...props}
        role={"group"}
        aria-label={ariaLabel}
        {...(0, runtime.getSizeAttribute)(size)}
        className={(0, runtime.cn)(
          "relative inline-flex w-fit shrink-0",
          orientation === "vertical"
            ? "flex-col items-stretch"
            : "items-stretch",
          value4
            ? `rounded ${buttonVariant === "secondary" ? `shadow-field-drop ${ButtonGroupClassNames}` : ""}`
            : value
              ? ""
              : "gap-xs",
          className,
        )}
      >
        <runtime.TooltipGroup>
          {value2.map((input?: Dynamic, options?: Dynamic): Dynamic => {
            let value6: Dynamic =
              options === 0 ? "start" : options === value3 ? "end" : "middle";
            return (() => {
              const _Component = reactButtonGroup.Fragment;
              const _props = {
                children: [
                  value4 && options > 0 && (
                    <ButtonGroupDivider variant={buttonVariant} />
                  ),
                  <runtime.ButtonGroupOptionsContext.Provider
                    value={value5[value6]}
                  >
                    <div data-cds-segment={""} className={"contents"}>
                      {input}
                    </div>
                  </runtime.ButtonGroupOptionsContext.Provider>,
                ],
              } as const;
              const _key = (0, reactButtonGroup.isValidElement)(input)
                ? input.key
                : options;
              return <_Component key={_key} {..._props} />;
            })();
          })}
        </runtime.TooltipGroup>
      </div>
    );
  }
  function SplitButton({
    variant = "secondary",
    size: size,
    label: label,
    icon: icon,
    shortcut: shortcut,
    tooltip = false,
    tooltipSide: tooltipSide,
    "aria-label": ariaLabel,
    "aria-expanded": ariaExpanded,
    "aria-haspopup": ariaHaspopup,
    "aria-controls": ariaControls,
    "aria-keyshortcuts": ariaKeyshortcuts,
    onPrimaryClick: onPrimaryClick,
    onPrimaryPointerDown: onPrimaryPointerDown,
    onPrimaryMouseDown: onPrimaryMouseDown,
    pressed: pressed,
    menuLabel: menuLabel,
    items: items,
    disabled: disabled2,
    busy: busy,
    status: status,
    caretSize: caretSize,
    side: side,
    align = "end",
    collisionPadding: collisionPadding,
    open: open,
    onOpenChange: onOpenChange,
    className: className,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useLabel)("moreOptions", "More options"),
      value2: Dynamic = menuLabel ?? value,
      value3: Dynamic = (0, runtime.useDensity)(),
      value4: Dynamic = caretSize ?? (0, runtime.menuCaretSize)(value3, size),
      value5: Dynamic =
        !disabled2 && (variant === "secondary" || variant === "ghost"),
      [value6, value7]: Dynamic = (0, reactButtonGroup_2.useState)(false),
      value8: Dynamic = open ?? value6,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        value7(input);
        onOpenChange?.(input);
      },
      value9: Dynamic = status != null && status !== false,
      value10: Dynamic = variant === "ghost" && label !== undefined && !value9,
      value11: Dynamic = variant === "ghost" && label === undefined && !value9,
      value12: Dynamic = variant === "ghost" && value9,
      value13: Dynamic = value10 || value11,
      value14: Dynamic = (0, runtime.buttonIconPadding)(
        (0, runtime.useButtonIconSize)(size),
      ),
      value15: Dynamic =
        variant !== "ghost"
          ? ButtonGroupAspectRatioPaddingInlineMinWidthConfig
          : value10
            ? ButtonGroupPaddingInlineStartConfig
            : value11
              ? {
                  ...ButtonGroupWidthConfig,
                  "--cds-split-caret-tuck": value14,
                  marginInlineStart: `calc(-1 * ${value14})`,
                }
              : ButtonGroupWidthConfig,
      value16: Dynamic = (
        <div className={"contents"}>
          {label === undefined ? (
            <runtime.Button
              busy={busy}
              disabled={disabled2}
              pressed={pressed}
              onClick={onPrimaryClick}
              onPointerDown={onPrimaryPointerDown}
              onMouseDown={onPrimaryMouseDown}
              icon={icon}
              iconOnly={true}
              aria-label={ariaLabel ?? ""}
              aria-expanded={ariaExpanded}
              aria-haspopup={ariaHaspopup}
              aria-controls={ariaControls}
              {...(ariaKeyshortcuts !== undefined
                ? {
                    "aria-keyshortcuts": ariaKeyshortcuts,
                  }
                : undefined)}
              tooltip={tooltip}
              tooltipSide={tooltipSide}
              className={(0, runtime.npm_clsx_Ea)(
                value9 && "peer/slot",
                value12 && ButtonGroupClassNames_3,
                value11 && GroupDataPopupOpenSplitPointerEventsNoneValue,
              )}
            />
          ) : (
            <runtime.Button
              busy={busy}
              disabled={disabled2}
              pressed={pressed}
              onClick={onPrimaryClick}
              onPointerDown={onPrimaryPointerDown}
              onMouseDown={onPrimaryMouseDown}
              aria-expanded={ariaExpanded}
              aria-haspopup={ariaHaspopup}
              aria-controls={ariaControls}
              {...(ariaKeyshortcuts !== undefined
                ? {
                    "aria-keyshortcuts": ariaKeyshortcuts,
                  }
                : undefined)}
              icon={icon}
              shortcut={shortcut}
              className={(0, runtime.npm_clsx_Ea)(
                ButtonGroupLabel_2,
                value9 && "peer/slot",
                value12 && ButtonGroupClassNames_3,
              )}
              style={
                value10
                  ? ButtonGroupPaddingInlineEndConfig
                  : value9
                    ? ButtonGroupPaddingInlineEndConfig_2
                    : undefined
              }
            >
              {label}
            </runtime.Button>
          )}
          {value9 && (
            <span
              className={(0, runtime.cn)(
                "flex shrink-0 items-center self-stretch pe-md",
                value12 && ButtonGroupClassNames_4,
                ButtonGroupSecondaryPrimaryDangerConfig[variant]?.seam,
                ButtonGroupPrimarySecondaryGhostConfig[variant],
                ButtonGroupLabel_3,
                PeerDisabledNotAriaBusySlotOpacityDisabledValue,
              )}
            >
              {status}
            </span>
          )}
        </div>
      );
    return (
      <ButtonGroupLayout
        data-cds={"SplitDropdownButton"}
        aria-label={typeof label == "string" ? label : (ariaLabel ?? value2)}
        variant={"joined"}
        buttonVariant={variant}
        size={size}
        className={(0, runtime.cn)(
          "group/split",
          value13 && ButtonGroupJoinValue,
          value10 && ButtonGroupLabel_5,
          className,
        )}
        data-popup-open={value8 ? "" : undefined}
        data-disabled={disabled2 || undefined}
        style={
          value13
            ? {
                "--cds-split-inset": `min(calc(${value14} / 2), calc(0.1875rem * var(--cds-rem-scale, 1)))`,
              }
            : undefined
        }
      >
        {value16}
        <runtime.MenuMenuAssignValue
          iconOnly={true}
          icon={
            <runtime.Icon
              name={"CaretDown"}
              size={value4}
              className={value5 ? "text-muted" : undefined}
            />
          }
          aria-label={value2}
          tooltip={false}
          disabled={disabled2}
          className={
            variant === "ghost"
              ? (0, runtime.cn)(
                  ButtonGroupClassNames_2,
                  value11 && ButtonGroupLabel_4,
                )
              : undefined
          }
          items={items}
          side={side}
          align={align}
          collisionPadding={collisionPadding}
          open={open}
          onOpenChange={callback}
          style={value15}
        />
      </ButtonGroupLayout>
    );
  }
  function isSingleRowFlex(input?: Dynamic): Dynamic {
    let value: Dynamic = getComputedStyle(input);
    return (
      value.display.endsWith("flex") &&
      !value.flexDirection.startsWith("column") &&
      !value.flexWrap.startsWith("wrap")
    );
  }
  function elementInnerWidth(input?: Dynamic): Dynamic {
    let value: Dynamic = getComputedStyle(input);
    return (
      input.getBoundingClientRect().width -
      (Number.parseFloat(value.paddingLeft) || 0) -
      (Number.parseFloat(value.paddingRight) || 0) -
      (Number.parseFloat(value.borderLeftWidth) || 0) -
      (Number.parseFloat(value.borderRightWidth) || 0)
    );
  }
  function flexRowWidth(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return (
      context +
      flexSiblingWidth(
        input,
        options,
        Number.parseFloat(getComputedStyle(input).columnGap) || 0,
      )
    );
  }
  function flexSiblingWidth(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let index: Dynamic = 0;
    for (let value of Array.from(input.children) as Dynamic) {
      if (value === options || !(0, runtime.isHtmlElement)(value)) continue;
      let value2: Dynamic = getComputedStyle(value);
      if (
        value2.position === "absolute" ||
        value2.position === "fixed" ||
        value2.display === "none"
      )
        continue;
      if (value2.display === "contents") {
        index += flexSiblingWidth(value, options, context);
        continue;
      }
      if (value2.flexShrink === "0" && value2.flexGrow === "0") {
        index += value.getBoundingClientRect().width + context;
        continue;
      }
      let value3: Dynamic = parsePixelLength(value2.flexBasis),
        attribute: Dynamic = value.getAttribute("style"),
        cssText: Dynamic = value.style.cssText;
      value.style.flex = "0 0 auto";
      value.style.width = "min-content";
      let width: Dynamic = value.getBoundingClientRect().width;
      restoreFlexInlineStyle(value, attribute, cssText);
      index += Math.max(width, value3) + context;
    }
    return index;
  }
  function restoreFlexInlineStyle(
    element?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (options === null) {
      element.removeAttribute("style");
      return;
    }
    let cssText: Dynamic = element.style.cssText;
    if (!ButtonGroupObservedElements.has(element.ownerDocument)) {
      element.setAttribute("style", options);
      if (!(cssText !== context && element.style.cssText === cssText)) return;
      ButtonGroupObservedElements.add(element.ownerDocument);
    }
    element.style.cssText = context;
  }
  function parsePixelLength(input?: Dynamic): Dynamic {
    return /^\d*\.?\d+px$/.test(input) ? Number.parseFloat(input) : 0;
  }
  function flexContentBounds(input?: Dynamic): Dynamic {
    let POSITIVE_INFINITY: Dynamic = Number.POSITIVE_INFINITY,
      NEGATIVE_INFINITY: Dynamic = Number.NEGATIVE_INFINITY;
    for (let value2 of Array.from(input.children) as Dynamic) {
      if (
        !(0, runtime.isHtmlElement)(value2) &&
        !(0, runtime.isSvgElement)(value2)
      )
        continue;
      let position: Dynamic = getComputedStyle(value2).position;
      if (position === "absolute" || position === "fixed") continue;
      let bounds: Dynamic = value2.getBoundingClientRect();
      (bounds.width <= 0 && bounds.height <= 0) ||
        ((POSITIVE_INFINITY = Math.min(POSITIVE_INFINITY, bounds.left)),
        (NEGATIVE_INFINITY = Math.max(NEGATIVE_INFINITY, bounds.right)));
    }
    if (NEGATIVE_INFINITY < POSITIVE_INFINITY) return 0;
    let value: Dynamic = getComputedStyle(input);
    return (
      NEGATIVE_INFINITY -
      POSITIVE_INFINITY +
      (Number.parseFloat(value.paddingLeft) || 0) +
      (Number.parseFloat(value.paddingRight) || 0)
    );
  }
  function ButtonGroup(input?: Dynamic): Dynamic {
    let {
        variant: value3 = "spaced",
        orientation: value4 = "horizontal",
        children: value,
        size: value2,
        buttonVariant: value5 = "secondary",
      }: Dynamic = input,
      value6: Dynamic = value3 === "spaced" && value4 === "horizontal",
      value7: Dynamic = (0, reactButtonGroup_3.useMemo)(
        (): Dynamic => (value6 ? parseButtonGroupChildren(value) : null),
        [value6, value],
      ),
      value8: Dynamic = value7 !== null && value7 !== "unrecognised";
    value7 === "unrecognised" && undefined;
    let value9: Dynamic = (0, reactButtonGroup_3.useRef)(null),
      [value10, value11]: Dynamic = (0, reactButtonGroup_3.useState)(false),
      value12: Dynamic = (0, reactButtonGroup_3.useRef)(0);
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      if (!value8) return;
      let current: Dynamic = value9.current,
        value14: Dynamic = current?.parentElement ?? null;
      if (current === null || value14 === null) return;
      let value15: Dynamic = (0, runtime.getResizeObserver)(value14);
      if (value15 === undefined) return;
      let callback: Dynamic = (): Dynamic => {
        let value17: Dynamic = elementInnerWidth(value14);
        if (value17 <= 0) return;
        if (!isSingleRowFlex(value14)) {
          value10 && value11(false);
          return;
        }
        if (value10) {
          value17 >= value12.current + 64 && value11(false);
          return;
        }
        let firstElementChild2: Dynamic = current.firstElementChild;
        if (!(0, runtime.isHtmlElement)(firstElementChild2)) return;
        let value18: Dynamic = flexRowWidth(
          value14,
          current,
          firstElementChild2.getBoundingClientRect().width,
        );
        value12.current = value18;
        value17 < value18 && value11(true);
      };
      callback();
      let value16: Dynamic = new value15(callback);
      value16.observe(value14);
      let firstElementChild: Dynamic = current.firstElementChild;
      (0, runtime.isHtmlElement)(firstElementChild) &&
        value16.observe(firstElementChild);
      return (): Dynamic => value16.disconnect();
    }, [value8, value10]);
    if (!value6) return <ButtonGroupLayout {...input} />;
    let value13: Dynamic = value8 && value10;
    return (
      <span
        ref={value9}
        className={"contents"}
        data-cds-collapsing={value8 ? "" : undefined}
        data-collapsed={value13 ? "" : undefined}
      >
        {value13 ? (
          <SplitButton
            {...(value7.primary.iconOnly && value7.primary.icon !== undefined
              ? {
                  icon: value7.primary.icon,
                  "aria-label": value7.primary.label,
                }
              : {
                  label: value7.primary.label,
                })}
            variant={value7.primary.variant ?? value5}
            size={value2}
            pressed={value7.primary.pressed}
            disabled={value7.primary.disabled}
            onPrimaryClick={value7.primary.onClick}
            items={value7.overflow}
            className={input.className}
          />
        ) : (
          <ButtonGroupLayout {...input} />
        )}
      </span>
    );
  }
  function componentHasDisplayName(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return input.type?.displayName === options;
  }
  function sameComponentType(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.type?.displayName;
    return input.type === options || (!!value && value === options.displayName);
  }
  function flattenReactFragments(input?: Dynamic): Dynamic {
    return reactButtonGroup_3.Children.toArray(input).flatMap(
      (input2?: Dynamic): Dynamic =>
        (0, reactButtonGroup_3.isValidElement)(input2) &&
        input2.type === reactButtonGroup_3.Fragment
          ? reactButtonGroup_3.Children.toArray(input2.props.children)
          : [input2],
    );
  }
  function parseButtonGroupChildren(input?: Dynamic): Dynamic {
    let value: Dynamic = flattenReactFragments(input);
    if (value.length < 2) return null;
    let items: Dynamic = [],
      value2: Dynamic = null;
    for (let value3 of value as Dynamic) {
      if (!(0, reactButtonGroup_3.isValidElement)(value3))
        return "unrecognised";
      if (sameComponentType(value3, runtime.Button)) {
        let props: Dynamic = value3.props;
        if ("href" in props && props.href !== undefined) return "unrecognised";
        let value4: Dynamic =
            typeof props.icon == "string" ? props.icon : undefined,
          value5: Dynamic =
            props.iconOnly === true
              ? props["aria-label"]
              : typeof props.children == "string"
                ? props.children
                : null;
        if (value5 === null) return "unrecognised";
        let onClick: Dynamic = props.onClick;
        if (
          onClick === undefined ||
          props.type === "submit" ||
          props.type === "reset" ||
          "render" in props
        )
          return null;
        value2 === null
          ? (value2 = {
              label: value5,
              icon: value4,
              iconOnly: props.iconOnly === true,
              onClick: onClick,
              pressed: props.pressed,
              disabled: props.disabled,
              variant: props.variant,
            })
          : items.push({
              icon: value4,
              label: value5,
              disabled: props.disabled,
              onSelect: onClick,
              shortcut: "shortcut" in props ? props.shortcut : undefined,
              ...(props.pressed !== undefined && {
                checked: props.pressed,
                checkedRole: "checkbox",
                keepOpen: true,
              }),
            });
      } else if (componentHasDisplayName(value3, "DropdownButton")) {
        let props: Dynamic = value3.props;
        if (!Array.isArray(props.items)) return "unrecognised";
        let value4: Dynamic =
          props.trigger === "label" || props.trigger === undefined
            ? typeof props.label == "string"
              ? props.label
              : null
            : props["aria-label"];
        if (value4 === null) return "unrecognised";
        items.push({
          icon: "icon" in props ? props.icon : undefined,
          label: value4,
          disabled: props.disabled,
          items: props.items,
        });
      } else return "unrecognised";
    }
    return value2 === null ||
      (value2.disabled === true &&
        items.some((input2?: Dynamic): Dynamic => input2.disabled !== true))
      ? null
      : {
          primary: value2,
          overflow: items,
        };
  }
  bindRuntimeValue(runtime, "ButtonGroupDivider", () => ButtonGroupDivider);
  bindRuntimeValue(runtime, "ButtonGroupLayout", () => ButtonGroupLayout);
  bindRuntimeValue(
    runtime,
    "reactButtonGroup",
    () => reactButtonGroup,
    (value) => {
      reactButtonGroup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxButtonGroup",
    () => jsxButtonGroup,
    (value) => {
      jsxButtonGroup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupClassNames",
    () => ButtonGroupClassNames,
    (value) => {
      ButtonGroupClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupSecondaryPrimaryDangerConfig",
    () => ButtonGroupSecondaryPrimaryDangerConfig,
    (value) => {
      ButtonGroupSecondaryPrimaryDangerConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonGroupJoinClasses",
    () => buttonGroupJoinClasses,
    (value) => {
      buttonGroupJoinClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupLabel",
    () => ButtonGroupLabel,
    (value) => {
      ButtonGroupLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeButtonGroup",
    () => initializeButtonGroup,
    (value) => {
      initializeButtonGroup = value;
    },
  );
  bindRuntimeValue(runtime, "SplitButton", () => SplitButton);
  bindRuntimeValue(
    runtime,
    "reactButtonGroup_2",
    () => reactButtonGroup_2,
    (value) => {
      reactButtonGroup_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxButtonGroup_2",
    () => jsxButtonGroup_2,
    (value) => {
      jsxButtonGroup_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupAspectRatioPaddingInlineMinWidthConfig",
    () => ButtonGroupAspectRatioPaddingInlineMinWidthConfig,
    (value) => {
      ButtonGroupAspectRatioPaddingInlineMinWidthConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupWidthConfig",
    () => ButtonGroupWidthConfig,
    (value) => {
      ButtonGroupWidthConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupPaddingInlineEndConfig",
    () => ButtonGroupPaddingInlineEndConfig,
    (value) => {
      ButtonGroupPaddingInlineEndConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupLabel_2",
    () => ButtonGroupLabel_2,
    (value) => {
      ButtonGroupLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupPaddingInlineEndConfig_2",
    () => ButtonGroupPaddingInlineEndConfig_2,
    (value) => {
      ButtonGroupPaddingInlineEndConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupPrimarySecondaryGhostConfig",
    () => ButtonGroupPrimarySecondaryGhostConfig,
    (value) => {
      ButtonGroupPrimarySecondaryGhostConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupLabel_3",
    () => ButtonGroupLabel_3,
    (value) => {
      ButtonGroupLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PeerDisabledNotAriaBusySlotOpacityDisabledValue",
    () => PeerDisabledNotAriaBusySlotOpacityDisabledValue,
    (value) => {
      PeerDisabledNotAriaBusySlotOpacityDisabledValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupPaddingInlineStartConfig",
    () => ButtonGroupPaddingInlineStartConfig,
    (value) => {
      ButtonGroupPaddingInlineStartConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupClassNames_2",
    () => ButtonGroupClassNames_2,
    (value) => {
      ButtonGroupClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupLabel_4",
    () => ButtonGroupLabel_4,
    (value) => {
      ButtonGroupLabel_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GroupDataPopupOpenSplitPointerEventsNoneValue",
    () => GroupDataPopupOpenSplitPointerEventsNoneValue,
    (value) => {
      GroupDataPopupOpenSplitPointerEventsNoneValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupClassNames_3",
    () => ButtonGroupClassNames_3,
    (value) => {
      ButtonGroupClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupClassNames_4",
    () => ButtonGroupClassNames_4,
    (value) => {
      ButtonGroupClassNames_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupJoinValue",
    () => ButtonGroupJoinValue,
    (value) => {
      ButtonGroupJoinValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupLabel_5",
    () => ButtonGroupLabel_5,
    (value) => {
      ButtonGroupLabel_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeButtonGroup_2",
    () => initializeButtonGroup_2,
    (value) => {
      initializeButtonGroup_2 = value;
    },
  );
  bindRuntimeValue(runtime, "isSingleRowFlex", () => isSingleRowFlex);
  bindRuntimeValue(runtime, "elementInnerWidth", () => elementInnerWidth);
  bindRuntimeValue(runtime, "flexRowWidth", () => flexRowWidth);
  bindRuntimeValue(runtime, "flexSiblingWidth", () => flexSiblingWidth);
  bindRuntimeValue(
    runtime,
    "restoreFlexInlineStyle",
    () => restoreFlexInlineStyle,
  );
  bindRuntimeValue(runtime, "parsePixelLength", () => parsePixelLength);
  bindRuntimeValue(runtime, "flexContentBounds", () => flexContentBounds);
  bindRuntimeValue(
    runtime,
    "ButtonGroupObservedElements",
    () => ButtonGroupObservedElements,
    (value) => {
      ButtonGroupObservedElements = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeButtonGroup_3",
    () => initializeButtonGroup_3,
    (value) => {
      initializeButtonGroup_3 = value;
    },
  );
  bindRuntimeValue(runtime, "ButtonGroup", () => ButtonGroup);
  bindRuntimeValue(
    runtime,
    "componentHasDisplayName",
    () => componentHasDisplayName,
  );
  bindRuntimeValue(runtime, "sameComponentType", () => sameComponentType);
  bindRuntimeValue(
    runtime,
    "flattenReactFragments",
    () => flattenReactFragments,
  );
  bindRuntimeValue(
    runtime,
    "parseButtonGroupChildren",
    () => parseButtonGroupChildren,
  );
  bindRuntimeValue(
    runtime,
    "reactButtonGroup_3",
    () => reactButtonGroup_3,
    (value) => {
      reactButtonGroup_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxButtonGroup_3",
    () => jsxButtonGroup_3,
    (value) => {
      jsxButtonGroup_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeButtonGroup_4",
    () => initializeButtonGroup_4,
    (value) => {
      initializeButtonGroup_4 = value;
    },
  );
  return () => {
    initializeButtonGroup = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeTooltipTooltip)();
      (0, runtime.initializeButtonButton)();
      reactButtonGroup = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxButtonGroup = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ButtonGroupClassNames =
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:[box-shadow:inset_0_0_0_1px_var(--cds-fill-secondary-ring)]";
      ButtonGroupSecondaryPrimaryDangerConfig = {
        secondary: {
          seam: "bg-fill-secondary",
          line: "bg-border",
        },
        primary: {
          seam: "bg-fill-primary",
          line: "bg-[var(--cds-on-primary)] opacity-25",
        },
        danger: {
          seam: "bg-fill-danger",
          line: "bg-[var(--cds-on-danger)] opacity-25",
        },
        brand: {
          seam: "bg-fill-brand",
          line: "bg-[var(--cds-on-brand)] opacity-25",
        },
      };
      buttonGroupJoinClasses =
        "[[data-cds-segment]:hover+&>[data-cds-seam-line]]:opacity-0 [&:has(+[data-cds-segment]:hover)>[data-cds-seam-line]]:opacity-0 [[data-cds-segment]:has([aria-haspopup][aria-expanded=true])+&>[data-cds-seam-line]]:opacity-0 [&:has(+[data-cds-segment]_[aria-haspopup][aria-expanded=true])>[data-cds-seam-line]]:opacity-0 [[data-cds-segment]:has([aria-pressed=true])+&>[data-cds-seam-line]]:opacity-0 [&:has(+[data-cds-segment]_[aria-pressed=true])>[data-cds-seam-line]]:opacity-0";
      ButtonGroupLabel =
        "[[data-cds-segment]:has(:disabled:not([aria-busy]))+&:has(+[data-cds-segment]_:disabled:not([aria-busy]))]:opacity-disabled";
    });
    initializeButtonGroup_2 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeComponentsIcon_2)();
      (0, runtime.initializeButtonButton)();
      (0, runtime.initializeMenuMenu_5)();
      initializeButtonGroup();
      reactButtonGroup_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      (0, runtime.initializeNpm_clsx_xh)();
      jsxButtonGroup_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ButtonGroupAspectRatioPaddingInlineMinWidthConfig = {
        aspectRatio: "auto",
        paddingInline: 4,
        minWidth: 0,
      };
      ButtonGroupWidthConfig = {
        ...ButtonGroupAspectRatioPaddingInlineMinWidthConfig,
        width: "auto",
      };
      ButtonGroupPaddingInlineEndConfig = {
        paddingInlineEnd: 5,
      };
      ButtonGroupLabel_2 = "min-w-0 shrink";
      ButtonGroupPaddingInlineEndConfig_2 = {
        paddingInlineEnd: 4,
      };
      ButtonGroupPrimarySecondaryGhostConfig = {
        primary: "peer-hover/slot:bg-fill-primary-hover",
        secondary: "peer-hover/slot:bg-fill-secondary-hover",
        ghost: "peer-hover/slot:bg-fill-ghost-hover",
        danger: "peer-hover/slot:bg-fill-danger-hover",
        brand: "peer-hover/slot:bg-fill-brand-hover",
      };
      ButtonGroupLabel_3 = "transition-colors duration-fast ease-out";
      PeerDisabledNotAriaBusySlotOpacityDisabledValue =
        "peer-[:disabled:not([aria-busy])]/slot:opacity-disabled";
      ButtonGroupPaddingInlineStartConfig = {
        ...ButtonGroupWidthConfig,
        paddingInlineStart: 0,
      };
      ButtonGroupClassNames_2 =
        "after:absolute after:inset-y-0 after:start-0 after:-end-2 after:content-['']";
      ButtonGroupLabel_4 =
        "pointer-events-none after:pointer-events-auto after:start-[calc(var(--cds-split-caret-tuck)-1px)] after:-end-[calc(3px+var(--cds-split-caret-tuck))]";
      GroupDataPopupOpenSplitPointerEventsNoneValue =
        "group-data-[popup-open]/split:pointer-events-none";
      ButtonGroupClassNames_3 = "rounded-e-none";
      ButtonGroupClassNames_4 = "rounded-e";
      ButtonGroupJoinValue = [
        "shadow-[inset_0_0_0_1px_var(--cds-split-ring,transparent)] transition-[box-shadow] duration-fast ease-out",
        "[&:not([data-disabled])]:hover:[--cds-split-ring:var(--cds-border)]",
        "data-[popup-open]:[--cds-split-ring:var(--cds-border)]",
        "[&:not([data-disabled])]:has-[[aria-pressed=true]]:[--cds-split-ring:var(--cds-border)]",
        "[&_[data-cds-part=paint]]:p-(--cds-split-inset) [&_[data-cds-part=paint]]:bg-clip-content",
      ].join(" ");
      ButtonGroupLabel_5 =
        "[&>[data-cds-segment]:first-child_[data-cds-part=paint]]:pe-0 [&>[data-cds-segment]:last-child_[data-cds-part=paint]]:ps-0";
    });
    initializeButtonGroup_3 = (0, runtime.initializeOnce)((): Dynamic => {
      (0, runtime.initializeDomRefComposition_2)();
      ButtonGroupObservedElements = new WeakSet();
    });
    initializeButtonGroup_4 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeDomRefComposition_2)();
      (0, runtime.initializeTooltipTrigger_2)();
      (0, runtime.initializeButtonButton)();
      initializeButtonGroup_3();
      initializeButtonGroup();
      initializeButtonGroup_2();
      reactButtonGroup_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxButtonGroup_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (ButtonGroup as Dynamic).displayName = "ButtonGroup";
    });
  };
}
