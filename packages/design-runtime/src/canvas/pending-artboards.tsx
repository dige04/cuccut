/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasPendingArtboards(
  runtime: RuntimeBindings,
): () => void {
  var jsxCanvasPendingArtboards: Dynamic;
  var CanvasPendingArtboardsActiveWaitingArrivedConfig: Dynamic;
  var CanvasPendingArtboardsElementCache: Dynamic;
  function PendingArtboardTitle({
    spec: spec,
    tone: tone,
    className: className,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useViewportStore)();
    return (
      <div
        ref={value.stamp}
        aria-hidden={"true"}
        data-mega-pending-title={""}
        data-testid={"mega-pending-title-" + spec.file}
        className={(0, runtime.joinClassNames)(
          "pointer-events-none absolute bottom-full left-0 flex h-6 items-center text-xs select-none",
          CanvasPendingArtboardsActiveWaitingArrivedConfig[tone],
          className,
        )}
        style={{
          width: `calc(${spec.w}px * var(--mega-scale))`,
          transform: "scale(var(--mega-inv-scale))",
          transformOrigin: "left bottom",
          marginBottom: "calc(4px * var(--mega-inv-scale))",
        }}
      >
        <span className={"truncate"}>
          {spec.title ?? spec.file.replace(/\.dc\.html$/, "")}
        </span>
      </div>
    );
  }
  function PendingArtboardFace({
    spec: spec,
    sheen: sheen,
    className: className,
  }: Dynamic): Dynamic {
    return (
      <div
        aria-hidden={"true"}
        data-testid={"mega-pending-face-" + spec.file}
        className={(0, runtime.joinClassNames)(
          "pointer-events-none absolute inset-0 bg-om-bg-canvas mc-claude-box",
          sheen && "mc-claude-sheen",
          className,
        )}
        style={{
          borderRadius: (0, runtime.artboardRadiusCss)(spec.radius),
        }}
      />
    );
  }
  function PendingArtboards({
    boards: boards,
    sheen: sheen,
  }: Dynamic): Dynamic {
    return boards.map(
      (input?: Dynamic): Dynamic =>
        (() => {
          const _Component = "div";
          const _props = {
            "data-mega-pending": input.spec.file,
            "data-active": input.active ? "" : undefined,
            className: "pointer-events-none absolute",
            style: {
              left: input.spec.x,
              top: input.spec.y,
              width: input.spec.w,
              height: input.spec.h,
            },
            children: [
              <PendingArtboardTitle
                spec={input.spec}
                tone={input.active ? "active" : "waiting"}
              />,
              <PendingArtboardFace
                spec={input.spec}
                sheen={sheen && input.active}
              />,
            ],
          } as const;
          const _key = input.spec.file;
          return <_Component key={_key} {..._props} />;
        })(),
    );
  }
  function artboardAboveDistances(input?: Dynamic): Dynamic {
    let entry: Dynamic = CanvasPendingArtboardsElementCache.get(input);
    if (entry) return entry;
    let entries: Dynamic = new Map();
    for (let value of input as Dynamic) {
      if (value.frameless) continue;
      let value2: Dynamic = 1 / 0;
      for (let value3 of input as Dynamic) {
        if (
          value3 === value ||
          value3.x >= value.x + value.w ||
          value3.x + value3.w <= value.x
        )
          continue;
        let value4: Dynamic = value.y - (value3.y + value3.h);
        value4 >= 0 && value4 < value2 && (value2 = value4);
      }
      value2 !== 1 / 0 && entries.set(value.file, value2);
    }
    CanvasPendingArtboardsElementCache.set(input, entries);
    return entries;
  }
  function artboardTitleHeight(input?: Dynamic): Dynamic {
    return 28 / input;
  }
  function shouldHideArtboardTitle(input?: Dynamic): Dynamic {
    return !(
      input.phoneCanvas ||
      input.selected ||
      input.renaming ||
      input.playing ||
      input.tweaksOpen ||
      input.armedByTouch ||
      input.hovered
    );
  }
  function isAboveTitleRect(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return (
      input >= context.left &&
      input <= context.right &&
      options <= context.top &&
      options >= context.top - 4
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxCanvasPendingArtboards",
    () => jsxCanvasPendingArtboards,
    (value) => {
      jsxCanvasPendingArtboards = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPendingArtboardsActiveWaitingArrivedConfig",
    () => CanvasPendingArtboardsActiveWaitingArrivedConfig,
    (value) => {
      CanvasPendingArtboardsActiveWaitingArrivedConfig = value;
    },
  );
  bindRuntimeValue(runtime, "PendingArtboardTitle", () => PendingArtboardTitle);
  bindRuntimeValue(runtime, "PendingArtboardFace", () => PendingArtboardFace);
  bindRuntimeValue(runtime, "PendingArtboards", () => PendingArtboards);
  bindRuntimeValue(
    runtime,
    "CanvasPendingArtboardsElementCache",
    () => CanvasPendingArtboardsElementCache,
    (value) => {
      CanvasPendingArtboardsElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardAboveDistances",
    () => artboardAboveDistances,
  );
  bindRuntimeValue(runtime, "artboardTitleHeight", () => artboardTitleHeight);
  bindRuntimeValue(
    runtime,
    "shouldHideArtboardTitle",
    () => shouldHideArtboardTitle,
  );
  bindRuntimeValue(runtime, "isAboveTitleRect", () => isAboveTitleRect);
  return () => {
    jsxCanvasPendingArtboards = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    CanvasPendingArtboardsActiveWaitingArrivedConfig = {
      active: "text-primary",
      waiting: "text-muted",
      arrived: "text-secondary",
      component: "text-pro",
    };
    CanvasPendingArtboardsElementCache = new WeakMap();
  };
}
