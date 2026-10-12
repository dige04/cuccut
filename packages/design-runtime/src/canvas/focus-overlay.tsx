/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasFocusOverlay(
  runtime: RuntimeBindings,
): () => void {
  var ArtboardFocusOverlay: Dynamic;
  bindRuntimeValue(
    runtime,
    "ArtboardFocusOverlay",
    () => ArtboardFocusOverlay,
    (value) => {
      ArtboardFocusOverlay = value;
    },
  );
  return () => {
    ArtboardFocusOverlay = (0, runtime.reactVectorToolState_2.memo)(function ({
      file: file,
      title: title,
      name: name,
      hintId: hintId,
      selected: selected,
      inside = false,
      testId: testId,
      inert: inert,
      onActivate: onActivate,
      keys: keys,
      yieldsEscape: yieldsEscape,
    }: Dynamic): Dynamic {
      let callback: Dynamic = (): Dynamic =>
          keys
            ? inside
              ? keys.onDescend(file)
              : keys.onEnter(file)
            : onActivate(file, false),
        value: Dynamic = (0, runtime.buttonKeyboardActivation)(
          (input?: Dynamic): Dynamic => {
            (inside && keys) ||
              onActivate(file, input.shiftKey || input.metaKey);
          },
        );
      return (
        <span
          data-mega-title-text={true}
          role={"button"}
          tabIndex={0}
          aria-pressed={selected}
          aria-label={name}
          aria-describedby={inside ? undefined : hintId}
          data-mega-inside={inside ? "" : undefined}
          data-testid={testId}
          inert={inert ? true : undefined}
          className={(0, runtime.joinClassNames)(
            "peer min-w-16 truncate rounded-sm outline-none group-data-[proto]/hdr:@max-[7.25rem]/hdr:min-w-8 focus-visible:outline-hidden focus-visible:shadow-focus",
            inside && "focus:outline-hidden focus:shadow-focus",
          )}
          onKeyDown={(event?: Dynamic): Dynamic => {
            if (event.defaultPrevented) return;
            if (event.key === " ") {
              inside && keys
                ? !event.altKey && !event.ctrlKey && event.preventDefault()
                : value.onKeyDown(event);
              return;
            }
            if (event.ctrlKey && !(inside && keys)) return;
            if (event.key === "Enter" && !event.ctrlKey) {
              if (event.altKey || (event.preventDefault(), event.repeat))
                return;
              inside && keys
                ? event.metaKey
                  ? onActivate(file, true)
                  : event.shiftKey
                    ? keys.onAscend(file)
                    : keys.onDescend(file)
                : event.shiftKey || event.metaKey
                  ? onActivate(file, true)
                  : callback();
              return;
            }
            if (!inside || !keys) return;
            if (event.key === "Tab" && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              keys.onStep(file, event.shiftKey ? "prev" : "next");
              return;
            }
            let value2: Dynamic =
              event.altKey || event.metaKey || event.ctrlKey;
            if (
              !value2 &&
              (event.key === "Home" || event.key === "End") &&
              !event.shiftKey
            ) {
              event.preventDefault();
              keys.onStep(file, event.key === "Home" ? "first" : "last");
              return;
            }
            if (
              !value2 &&
              (event.key === "ArrowDown" ||
                event.key === "ArrowRight" ||
                event.key === "ArrowUp" ||
                event.key === "ArrowLeft")
            ) {
              event.preventDefault();
              keys.onStep(
                file,
                event.key === "ArrowDown" || event.key === "ArrowRight"
                  ? "next"
                  : "prev",
              );
              return;
            }
            if (!value2 && event.key === "Escape" && !event.shiftKey) {
              if (yieldsEscape?.()) return;
              event.preventDefault();
              event.repeat || keys.onLeave(file);
              return;
            }
            !(0, runtime.isCanvasReservedShortcut)(event) &&
              keys.holdKey(file) &&
              (event.preventDefault(), event.stopPropagation());
          }}
          onKeyUp={value.onKeyUp}
          onBlur={value.onBlur}
          onClick={(input?: Dynamic): Dynamic => {
            input.detail === 0 &&
              (input.shiftKey || input.metaKey
                ? onActivate(file, true)
                : callback());
          }}
        >
          {title}
        </span>
      );
    });
  };
}
