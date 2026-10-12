import type * as React from "react";
import type * as Token from "../contracts/token-editors";
import type * as Model from "../contracts";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorRowContextMenu(
  runtime: RuntimeBindings,
): () => void {
  var reactRowContextMenu: typeof import("react");
  var jsxRowContextMenu: typeof import("react/jsx-runtime");
  var ROW_CONTEXT_LONG_PRESS_MS: number;
  var ROW_CONTEXT_MOVE_TOLERANCE_PX: number;
  async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
    try {
      let value = document.createElement("textarea");
      value.value = text;
      value.style.position = "fixed";
      value.style.opacity = "0";
      document.body.appendChild(value);
      value.select();
      let value2 = document.execCommand("copy");
      value.remove();
      return value2;
    } catch {
      return false;
    }
  }
  function RemoveRowButton({
    label: label,
    onRemove: onRemove,
    tabIndex: tabIndex,
    "data-testid": dataTestid,
  }: Token.RemoveRowButtonProps): React.ReactElement {
    return (
      <runtime.Button
        variant={"ghost"}
        size={"sm"}
        iconOnly={true}
        icon={"Trash"}
        aria-label={label}
        tooltip={label}
        className={
          "ds-row-trash opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        }
        onClick={(input: React.MouseEvent<HTMLButtonElement>): void => {
          input.stopPropagation();
          let value =
            tabIndex === -1
              ? (): void => {
                  return;
                }
              : (0, runtime.restoreFocusAfterRemoval)(input.currentTarget);
          onRemove();
          value();
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLButtonElement>): void => {
          if (event.repeat && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
          }
        }}
        {...(tabIndex !== undefined
          ? {
              tabIndex: tabIndex,
            }
          : {})}
        data-testid={dataTestid}
        {...runtime.UNCOMMENTABLE_PROPS}
      />
    );
  }
  function useRowContextMenu(enabled: boolean = true): Token.RowContextState {
    let [value, value2] = reactRowContextMenu.useState<Token.RowPoint | null>(
        null,
      ),
      [value3, value4] = reactRowContextMenu.useState<"point" | "tap">("point"),
      ref = reactRowContextMenu.useRef<Token.RowTouchSession | null>(null),
      ref2 = reactRowContextMenu.useRef(false),
      callback = () => {
        let current = ref.current;
        if (current === null) {
          return false;
        }
        window.clearTimeout(current.timer);
        ref.current = null;
        return current.fired;
      };
    reactRowContextMenu.useEffect(() => () => void callback(), []);
    let callback2 = (input: HTMLElement, options: HTMLElement) =>
      !input.contains(options) ||
      options.closest('input, textarea, [contenteditable="true"]') !== null;
    return {
      at: value,
      anchor: value3,
      close: () => value2(null),
      rowProps: {
        onTouchStart: (
          event: React.TouchEvent<HTMLElement> & {
            target: HTMLElement;
          },
        ): void => {
          callback();
          if (!enabled || event.touches.length !== 1) {
            return;
          }
          let target = event.target;
          if (callback2(event.currentTarget, target)) {
            return;
          }
          let { clientX: value5, clientY: value6 } = event.touches[0];
          ref.current = {
            x: value5,
            y: value6,
            fired: false,
            timer: window.setTimeout((): void => {
              if (ref.current !== null) {
                ref.current.fired = true;
              }
              value4("tap");
              value2({
                x: value5,
                y: value6,
              });
            }, ROW_CONTEXT_LONG_PRESS_MS),
          };
        },
        onTouchMove: (input: React.TouchEvent<HTMLElement>): void => {
          let current = ref.current,
            value5 = input.touches[0];
          if (
            current !== null &&
            !current.fired &&
            value5 !== undefined &&
            Math.hypot(value5.clientX - current.x, value5.clientY - current.y) >
              ROW_CONTEXT_MOVE_TOLERANCE_PX
          ) {
            callback();
          }
        },
        onTouchEnd: (
          event: React.TouchEvent<HTMLElement> & {
            target: HTMLElement;
          },
        ): void => {
          if (callback()) {
            event.preventDefault();
            ref2.current = true;
            window.setTimeout(() => (ref2.current = false), 400);
          }
        },
        onTouchCancel: () => void callback(),
        onClickCapture: (
          event: React.MouseEvent<HTMLElement> & {
            target: HTMLElement;
          },
        ): void => {
          if (ref2.current && event.currentTarget.contains(event.target)) {
            ref2.current = false;
            event.preventDefault();
            event.stopPropagation();
          }
        },
        onContextMenu: (
          event: React.MouseEvent<HTMLElement> & {
            target: HTMLElement;
          },
        ): void => {
          if (!enabled) {
            return;
          }
          let target = event.target;
          if (callback2(event.currentTarget, target)) {
            return;
          }
          event.preventDefault();
          if (ref.current?.fired === true) {
            return;
          }
          callback();
          value4("point");
          let bounds = event.currentTarget.getBoundingClientRect();
          value2(
            event.clientX === 0 && event.clientY === 0
              ? {
                  x: bounds.left + 24,
                  y: bounds.top + bounds.height / 2,
                }
              : {
                  x: event.clientX,
                  y: event.clientY,
                },
          );
        },
      },
    };
  }
  function RowContextMenu({
    title: title,
    at: at2,
    anchor: anchor,
    onClose: onClose,
    actions: actions,
    testid: testid,
  }: Token.RowContextMenuProps): React.ReactElement {
    let {
        rename: value,
        copy: value2,
        remove: value3,
        removeLabel: value5 = "Remove",
        goto: value4,
        gotoLabel: value6 = "Go to target",
        inherit: value7 = [],
      } = actions,
      ref = reactRowContextMenu.useRef<HTMLSpanElement | null>(null);
    return (
      <jsxRowContextMenu.Fragment>
        {[
          <span ref={ref} hidden={true} />,
          <runtime.ContextMenu
            at={at2}
            {...(anchor !== undefined
              ? {
                  anchor: anchor,
                }
              : {})}
            onClose={onClose}
            title={title}
            className={"min-w-[11rem]"}
          >
            {[
              value4 !== undefined ? (
                <runtime.Menu.Item
                  icon={"ArrowRight"}
                  onClick={() => requestAnimationFrame(value4)}
                  data-testid={
                    testid !== undefined ? testid + "-goto" : undefined
                  }
                >
                  {value6}
                </runtime.Menu.Item>
              ) : null,
              value7.map((input, options) =>
                (() => {
                  const _Element = runtime.Menu.Item;
                  const _elementProps = {
                    icon: "ArrowCounterClockwise",
                    onClick: input.run,
                    "data-testid":
                      testid !== undefined
                        ? testid + "-inherit-" + String(options)
                        : undefined,
                    children: input.label,
                  };
                  const _elementKey = "inh" + String(options);
                  return <_Element key={_elementKey} {..._elementProps} />;
                })(),
              ),
              value !== undefined ? (
                <runtime.Menu.Item
                  icon={"Edit"}
                  onClick={() => requestAnimationFrame(value)}
                  data-testid={
                    testid !== undefined ? testid + "-rename" : undefined
                  }
                >
                  {"Rename…"}
                </runtime.Menu.Item>
              ) : null,
              value2 !== undefined && value2 !== "" ? (
                <runtime.Menu.Item
                  icon={"Copy"}
                  onClick={() =>
                    void copyTextToClipboard(value2).then((input: boolean) =>
                      (0, runtime.showEditorNotification)(
                        input ? "Copied " + value2 : "Couldn’t copy",
                      ),
                    )
                  }
                  data-testid={
                    testid !== undefined ? testid + "-copy" : undefined
                  }
                >
                  {"Copy value"}
                </runtime.Menu.Item>
              ) : null,
              value3 !== undefined ? (
                <jsxRowContextMenu.Fragment>
                  {[
                    value !== undefined ||
                    (value2 !== undefined && value2 !== "") ? (
                      <runtime.Menu.Separator />
                    ) : null,
                    <runtime.Menu.Item
                      icon={"Trash"}
                      variant={"danger"}
                      onClick={(): void => {
                        let value8 =
                          ref.current !== null
                            ? (0, runtime.restoreFocusAfterRemoval)(
                                ref.current,
                                true,
                              )
                            : (): void => {
                                return;
                              };
                        value3();
                        value8();
                      }}
                      data-testid={
                        testid !== undefined ? testid + "-remove" : undefined
                      }
                    >
                      {value5}
                    </runtime.Menu.Item>,
                  ]}
                </jsxRowContextMenu.Fragment>
              ) : null,
            ]}
          </runtime.ContextMenu>,
        ]}
      </jsxRowContextMenu.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactRowContextMenu",
    () => reactRowContextMenu,
    (value) => {
      reactRowContextMenu = value;
    },
  );
  bindRuntimeValue(runtime, "copyTextToClipboard", () => copyTextToClipboard);
  bindRuntimeValue(
    runtime,
    "jsxRowContextMenu",
    () => jsxRowContextMenu,
    (value) => {
      jsxRowContextMenu = value;
    },
  );
  bindRuntimeValue(runtime, "RemoveRowButton", () => RemoveRowButton);
  bindRuntimeValue(
    runtime,
    "ROW_CONTEXT_LONG_PRESS_MS",
    () => ROW_CONTEXT_LONG_PRESS_MS,
    (value) => {
      ROW_CONTEXT_LONG_PRESS_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ROW_CONTEXT_MOVE_TOLERANCE_PX",
    () => ROW_CONTEXT_MOVE_TOLERANCE_PX,
    (value) => {
      ROW_CONTEXT_MOVE_TOLERANCE_PX = value;
    },
  );
  bindRuntimeValue(runtime, "useRowContextMenu", () => useRowContextMenu);
  bindRuntimeValue(runtime, "RowContextMenu", () => RowContextMenu);
  return () => {
    reactRowContextMenu = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxRowContextMenu = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    ROW_CONTEXT_LONG_PRESS_MS = 500;
    ROW_CONTEXT_MOVE_TOLERANCE_PX = 10;
  };
}
