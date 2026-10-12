/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  UsageNoteEditorProps,
  NotesPopoverEditorProps,
} from "../contracts/file-browser";
export function installEditorUsageNotes(runtime: RuntimeBindings): () => void {
  var reactUsageEditor: typeof import("react");
  var jsxUsageEditor: typeof import("react/jsx-runtime");
  var prefersCoarsePointer: () => boolean;
  function hasUsageNote(value: string | undefined) {
    return value !== undefined && value.trim() !== "";
  }
  function focusUsageEditorBackground(
    event: React.MouseEvent<HTMLDivElement>,
  ): void {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }
    if (
      event.nativeEvent.offsetX >= event.currentTarget.clientWidth ||
      event.nativeEvent.offsetY >= event.currentTarget.clientHeight
    ) {
      return;
    }
    let element = event.currentTarget.querySelector<HTMLElement>(
      ".ds-readme-editable",
    );
    if (element === null) {
      return;
    }
    event.preventDefault();
    element.focus();
    let value = element.ownerDocument.getSelection();
    value?.selectAllChildren(element);
    value?.collapseToEnd();
  }
  function UsageNoteEditor({
    value: value,
    label: label,
    onChange: onChange,
    onDone: onDone,
    title = "Usage notes",
    placeholder = "When to use it, and when not to…",
    size = "note",
    "data-testid": dataTestid,
    anchorKey: anchorKey,
  }: UsageNoteEditorProps) {
    let value2: boolean = onChange !== undefined,
      value3 = hasUsageNote(value),
      [value4, value5] = reactUsageEditor.useState(false),
      ref = reactUsageEditor.useRef(false),
      ref2 = reactUsageEditor.useRef(false);
    reactUsageEditor.useEffect(() => {
      let callback2 = (): void => {
          ref2.current = true;
        },
        callback3 = (): void => {
          ref2.current = false;
        };
      window.addEventListener("keydown", callback2, true);
      window.addEventListener("pointerdown", callback3, true);
      return (): void => {
        window.removeEventListener("keydown", callback2, true);
        window.removeEventListener("pointerdown", callback3, true);
      };
    }, []);
    let ref3 = reactUsageEditor.useRef<HTMLSpanElement | null>(null),
      ref4 = reactUsageEditor.useRef<HTMLElement | null>(null),
      ref5 = reactUsageEditor.useRef(false);
    if (!value2 && !value3) {
      return null;
    }
    let value6 =
        value4 || value3 || !value2 ? title : "Add " + title.toLowerCase(),
      callback = (): void => {
        value5(false);
        if (!ref.current && !ref2.current) {
          return;
        }
        let current = ref4.current,
          callback2 = (): void => {
            let activeElement = document.activeElement;
            if (
              activeElement === null ||
              activeElement === document.body ||
              !activeElement.isConnected ||
              (current !== null && current.contains(activeElement))
            ) {
              ref3.current?.querySelector("button")?.focus({
                preventScroll: true,
              });
            }
          };
        requestAnimationFrame(callback2);
        setTimeout(callback2, 200);
      };
    return (
      <span
        ref={ref3}
        className={"ds-nmark-anchor relative inline-flex"}
        onClick={(input: React.MouseEvent<HTMLElement>) =>
          input.stopPropagation()
        }
      >
        <runtime.PropertyPopup
          open={value4}
          onOpen={() => value5(true)}
          onClose={(): void => {
            if (ref5.current) {
              ref5.current = false;
              return;
            }
            callback();
          }}
          align={"right"}
          padding={"none"}
          focusOnOpen={ref.current}
          aria-label={title + ": " + label}
          trigger={
            <runtime.Button
              variant={"ghost"}
              size={"sm"}
              iconOnly={true}
              icon={
                <runtime.Icon
                  name={"Note"}
                  size={"sm"}
                  className={value3 ? "text-warning" : "text-muted"}
                />
              }
              aria-label={value6 + ": " + label}
              tooltip={value6}
              className={(0, runtime.joinClassNames)(
                "ds-nmark",
                !value3 &&
                  "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100",
              )}
              data-has={value3 ? "" : undefined}
              data-testid={
                dataTestid !== undefined ? dataTestid + "-mark" : undefined
              }
              onClick={(input: React.MouseEvent<HTMLElement>): void => {
                ref.current = input.detail === 0;
              }}
            />
          }
        >
          {value4 ? (
            <NotesPopoverEditor
              value={value}
              label={label}
              title={title}
              placeholder={placeholder}
              size={size}
              onChange={onChange}
              onDone={onDone}
              takeCaret={
                ref.current || (value2 && !value3 && !prefersCoarsePointer())
              }
              stripPress={ref5}
              popup={ref4}
              onClose={callback}
              testid={dataTestid}
              anchorKey={anchorKey}
            />
          ) : null}
        </runtime.PropertyPopup>
      </span>
    );
  }
  function NotesPopoverEditor({
    value: value,
    label: label,
    title: title,
    placeholder = "",
    size: size,
    onChange: onChange,
    onDone: onDone,
    takeCaret: takeCaret,
    stripPress: stripPress,
    popup: popup,
    onClose: onClose,
    testid: testid,
    anchorKey: anchorKey,
  }: NotesPopoverEditorProps) {
    let value2: boolean = onChange !== undefined,
      ref = reactUsageEditor.useRef<{
        open: boolean;
        done?: () => void;
      }>({
        open: false,
      });
    ref.current.done = onDone;
    reactUsageEditor.useEffect(
      () => (): void => {
        if (ref.current.open) {
          ref.current.done?.();
        }
      },
      [],
    );
    let ref2 = reactUsageEditor.useRef<HTMLDivElement | null>(null);
    reactUsageEditor.useEffect((): void => {
      popup.current =
        ref2.current?.closest('[data-cds="Popover"]')?.parentElement ??
        ref2.current?.closest(".ds-postit") ??
        null;
    }, [popup]);
    reactUsageEditor.useEffect(() => {
      if (!takeCaret || !value2) {
        return;
      }
      let value3 = requestAnimationFrame((): void => {
        let value4 = ref2.current?.querySelector<HTMLElement>(
          ".ds-readme-editable",
        );
        if (value4 === null || value4 === undefined) {
          return;
        }
        value4.focus({
          preventScroll: true,
        });
        let value5 = value4.ownerDocument.getSelection();
        value5?.selectAllChildren(value4);
        value5?.collapseToEnd();
      });
      return () => cancelAnimationFrame(value3);
    }, []);
    reactUsageEditor.useEffect(() => {
      let callback2 = () => {
          let activeElement = document.activeElement;
          return (
            activeElement !== null &&
            (ref2.current?.contains(activeElement) ?? false)
          );
        },
        callback3 = (): void => {
          stripPress.current = true;
          setTimeout((): void => {
            stripPress.current = false;
          }, 0);
        },
        callback4 = (event: PointerEvent): void => {
          let value3 =
              event.target instanceof Element
                ? event.target.closest("[data-mc-strip]")
                : null,
            activeElement = document.activeElement;
          if (
            value3 !== null &&
            activeElement !== null &&
            (callback2() || value3.contains(activeElement))
          ) {
            callback3();
          }
        },
        callback5 = (): void => {
          if (callback2()) {
            callback3();
          }
        },
        callback6 = (event: Event): void => {
          if (
            callback2() &&
            prefersCoarsePointer() &&
            !(
              event.target instanceof Node &&
              (ref2.current?.contains(event.target) ?? false)
            )
          ) {
            callback3();
          }
        };
      window.addEventListener("pointerdown", callback4, true);
      window.addEventListener("resize", callback5, true);
      window.addEventListener("scroll", callback6, true);
      return (): void => {
        window.removeEventListener("pointerdown", callback4, true);
        window.removeEventListener("resize", callback5, true);
        window.removeEventListener("scroll", callback6, true);
      };
    }, [stripPress]);
    let callback = (): void => {
      ref.current.open = false;
      onDone?.();
    };
    return (
      <div
        className={(0, runtime.joinClassNames)(
          "ds-postit flex flex-col",
          size === "doc" ? "ds-postit-doc" : undefined,
        )}
        role={"group"}
        aria-label={title + ": " + label}
        data-testid={testid !== undefined ? testid + "-note" : undefined}
        {...(anchorKey !== undefined
          ? (0, runtime.commentTargetProps)("note", anchorKey)
          : {})}
      >
        {[
          <div className={"ds-postit-head flex items-center gap-xs"}>
            {[
              <runtime.Icon
                name={"Note"}
                size={"sm"}
                className={"text-muted"}
              />,
              <span
                className={
                  "min-w-0 flex-1 truncate text-footnote font-semibold text-primary"
                }
              >
                {title}
              </span>,
              value2 && hasUsageNote(value) ? (
                <runtime.Button
                  variant={"ghost"}
                  size={"xs"}
                  iconOnly={true}
                  icon={"Trash"}
                  aria-label={"Delete " + title.toLowerCase()}
                  tooltip={"Delete"}
                  onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) =>
                    event.preventDefault()
                  }
                  onClick={(): void => {
                    (0, runtime.flushMarkdownCommitQueues)();
                    onChange!("");
                    ref.current.open = false;
                    onDone?.();
                    onClose();
                  }}
                  data-testid={
                    testid !== undefined ? testid + "-delete" : undefined
                  }
                />
              ) : null,
              <runtime.Button
                variant={"ghost"}
                size={"xs"}
                iconOnly={true}
                icon={"X"}
                aria-label={"Close"}
                tooltip={"Close"}
                onClick={onClose}
                data-note-close={""}
                data-testid={
                  testid !== undefined ? testid + "-close" : undefined
                }
              />,
            ]}
          </div>,
          <div
            ref={ref2}
            className={"ds-postit-body ds-desc ds-comp-about prose min-w-0"}
            onMouseDown={value2 ? focusUsageEditorBackground : undefined}
            data-testid={testid !== undefined ? testid + "-cell" : undefined}
          >
            <runtime.MarkdownEditor
              markdown={value!}
              readOnly={!value2}
              placeholder={placeholder}
              label={label + " " + title.toLowerCase()}
              {...(testid !== undefined
                ? {
                    testId: testid,
                  }
                : {})}
              {...(onChange !== undefined
                ? {
                    onMarkdown: (input: string): void => {
                      ref.current.open = true;
                      onChange(input);
                    },
                  }
                : {})}
              onDone={callback}
            />
          </div>,
        ]}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactUsageEditor",
    () => reactUsageEditor,
    (value) => {
      reactUsageEditor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxUsageEditor",
    () => jsxUsageEditor,
    (value) => {
      jsxUsageEditor = value;
    },
  );
  bindRuntimeValue(runtime, "hasUsageNote", () => hasUsageNote);
  bindRuntimeValue(
    runtime,
    "focusUsageEditorBackground",
    () => focusUsageEditorBackground,
  );
  bindRuntimeValue(
    runtime,
    "prefersCoarsePointer",
    () => prefersCoarsePointer,
    (value) => {
      prefersCoarsePointer = value;
    },
  );
  bindRuntimeValue(runtime, "UsageNoteEditor", () => UsageNoteEditor);
  bindRuntimeValue(runtime, "NotesPopoverEditor", () => NotesPopoverEditor);
  return () => {
    reactUsageEditor = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxUsageEditor = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    prefersCoarsePointer = () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
  };
}
