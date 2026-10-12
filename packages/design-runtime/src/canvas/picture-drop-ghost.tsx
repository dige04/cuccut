/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasPictureDropGhost(
  runtime: RuntimeBindings,
): () => void {
  var reactCanvasPictureDropGhost: Dynamic;
  var jsxCanvasPictureDropGhost: Dynamic;
  function UploadingOverlay({ quiet = false }: Dynamic): Dynamic {
    let [value]: Dynamic = (0, reactCanvasPictureDropGhost.useState)(
      runtime.uploadingAnimationDelay,
    );
    return (
      <span
        data-testid={"mega-uploading"}
        className={
          "om-uploading pointer-events-none absolute inset-0 block bg-fg-muted"
        }
        style={{
          animationDelay: value,
        }}
      >
        {!quiet && (
          <span role={"status"} className={"sr-only"}>
            {"Uploading image"}
          </span>
        )}
      </span>
    );
  }
  function PictureDropGhost({
    x: x,
    y: y,
    w: w,
    h: h,
    clip: clip,
  }: Dynamic): Dynamic {
    (0, reactCanvasPictureDropGhost.useLayoutEffect)(
      (): Dynamic => (0, runtime.markDropPerformance)("ghost"),
      [],
    );
    return (
      <div
        data-testid={"mega-drop-ghost"}
        data-mega-chrome={"picture-pending"}
        aria-hidden={"true"}
        className={"pointer-events-none absolute z-30 overflow-hidden"}
        style={{
          left: clip.x,
          top: clip.y,
          width: clip.w,
          height: clip.h,
        }}
      >
        <div
          className={"absolute border border-border-strong bg-fg-muted/40"}
          style={{
            left: x - clip.x,
            top: y - clip.y,
            width: w,
            height: h,
          }}
        >
          <UploadingOverlay quiet={true} />
        </div>
      </div>
    );
  }
  function PictureDropGhosts({
    page: page,
    artboards: artboards,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, reactCanvasPictureDropGhost.useSyncExternalStore)(
      runtime.subscribeDropGhosts,
      runtime.getDropGhosts,
    );
    return (
      <jsxCanvasPictureDropGhost.Fragment>
        {value.map((input?: Dynamic): Dynamic => {
          if (input.file == null)
            return input.page === page
              ? (() => {
                  const _Component = PictureDropGhost;
                  const _props = {
                    x: input.x,
                    y: input.y,
                    w: input.w,
                    h: input.h,
                    clip: input,
                  } as const;
                  const _key = input.key;
                  return <_Component key={_key} {..._props} />;
                })()
              : null;
          let value2: Dynamic = artboards.find(
            (input2?: Dynamic): Dynamic => input2.file === input.file,
          );
          if (!value2) return null;
          let value3: Dynamic = Math.max(0, input.x),
            value4: Dynamic = Math.max(0, input.y),
            value5: Dynamic = Math.min(value2.w, input.x + input.w),
            value6: Dynamic = Math.min(value2.h, input.y + input.h);
          return value5 <= value3 || value6 <= value4
            ? null
            : (() => {
                const _Component2 = PictureDropGhost;
                const _props2 = {
                  x: value2.x + input.x,
                  y: value2.y + input.y,
                  w: input.w,
                  h: input.h,
                  clip: {
                    x: value2.x + value3,
                    y: value2.y + value4,
                    w: value5 - value3,
                    h: value6 - value4,
                  },
                } as const;
                const _key2 = input.key;
                return <_Component2 key={_key2} {..._props2} />;
              })();
        })}
      </jsxCanvasPictureDropGhost.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactCanvasPictureDropGhost",
    () => reactCanvasPictureDropGhost,
    (value) => {
      reactCanvasPictureDropGhost = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCanvasPictureDropGhost",
    () => jsxCanvasPictureDropGhost,
    (value) => {
      jsxCanvasPictureDropGhost = value;
    },
  );
  bindRuntimeValue(runtime, "UploadingOverlay", () => UploadingOverlay);
  bindRuntimeValue(runtime, "PictureDropGhost", () => PictureDropGhost);
  bindRuntimeValue(runtime, "PictureDropGhosts", () => PictureDropGhosts);
  return () => {
    reactCanvasPictureDropGhost = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    jsxCanvasPictureDropGhost = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
