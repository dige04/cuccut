/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorChromeMenuItem(
  runtime: RuntimeBindings,
): () => void {
  var ChromeMenuItemPreventDefault: Dynamic;
  var ChromeMenuItemTarget: Dynamic;
  function EditorMenuItem({
    onClick: onClick,
    children: children,
    disabled: disabled2,
    title: title,
    danger: danger,
    checked: checked,
    hint: hint,
    icon: icon,
    "data-testid": dataTestid,
  }: Dynamic): Dynamic {
    return (
      <button
        type={"button"}
        data-kit={"MenuItem"}
        data-testid={dataTestid}
        disabled={disabled2}
        title={title}
        aria-pressed={checked}
        onMouseDown={ChromeMenuItemPreventDefault}
        onClick={onClick}
        className={(0, runtime.joinClassNames)(
          (0, runtime.menuItemVariants)({
            variant: danger ? "danger" : "default",
          }),
          "cursor-default text-left disabled:cursor-not-allowed disabled:opacity-50",
          danger
            ? "enabled:hover:bg-fill-danger enabled:hover:text-on-danger focus-visible:bg-fill-danger focus-visible:text-on-danger"
            : "enabled:hover:bg-fill-ghost-hover focus-visible:bg-fill-ghost-hover",
        )}
      >
        {icon !== undefined ? (
          <span
            className={"flex size-icon shrink-0 items-center justify-center"}
          >
            {typeof icon == "string" ? (
              <runtime.Icon name={icon} size={"auto"} />
            ) : (
              icon || null
            )}
          </span>
        ) : null}
        {typeof children == "string" || typeof children == "number" ? (
          <span className={"min-w-0 flex-1 truncate"}>{children}</span>
        ) : (
          <span className={"flex min-w-0 flex-1 items-center gap-xs"}>
            {children}
          </span>
        )}
        {checked !== undefined || hint ? (
          <span className={"ml-md flex shrink-0 items-center gap-xs"}>
            {hint ? (
              <span
                className={(0, runtime.joinClassNames)(
                  "max-w-[160px] shrink-0 truncate py-[0.125em] -my-[0.125em] text-footnote tabular-nums text-muted",
                  danger &&
                    !disabled2 &&
                    "group-hover/menu-danger:text-on-danger group-focus-visible/menu-danger:text-on-danger",
                )}
              >
                {hint}
              </span>
            ) : null}
            {checked !== undefined ? (
              <span
                className={
                  "-mr-1 flex size-icon shrink-0 items-center justify-center"
                }
                style={{
                  color: "var(--cds-fill-accent)",
                }}
              >
                {checked ? (
                  <runtime.Icon name={"Check"} size={"auto"} bold={true} />
                ) : null}
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
    );
  }
  function getFocusableElements(input?: Dynamic): Dynamic {
    return Array.from(
      input.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (input2?: Dynamic): Dynamic =>
        input2.tabIndex >= 0 && input2.closest('[aria-hidden="true"]') === null,
    );
  }
  function isBaseUiFocusGuard(input?: Dynamic): Dynamic {
    let value: Dynamic = input.trigger ?? input.event?.target;
    return (
      value instanceof Element && value.hasAttribute("data-base-ui-focus-guard")
    );
  }
  bindRuntimeValue(runtime, "EditorMenuItem", () => EditorMenuItem);
  bindRuntimeValue(runtime, "getFocusableElements", () => getFocusableElements);
  bindRuntimeValue(runtime, "isBaseUiFocusGuard", () => isBaseUiFocusGuard);
  bindRuntimeValue(
    runtime,
    "ChromeMenuItemPreventDefault",
    () => ChromeMenuItemPreventDefault,
    (value) => {
      ChromeMenuItemPreventDefault = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromeMenuItemTarget",
    () => ChromeMenuItemTarget,
    (value) => {
      ChromeMenuItemTarget = value;
    },
  );
  return () => {
    ChromeMenuItemPreventDefault = (event?: Dynamic): Dynamic =>
      event.preventDefault();
    ChromeMenuItemTarget = (event?: Dynamic): Dynamic => {
      (!(event.target instanceof Element) ||
        event.target.closest(runtime.editableElementSelector) === null) &&
        event.preventDefault();
    };
  };
}
