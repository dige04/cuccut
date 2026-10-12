/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasSelectionChrome(
  runtime: RuntimeBindings,
): () => void {
  var jsx__b: Dynamic;
  var resizeGripCursorOverrides: Dynamic;
  var noopResizeGrip: Dynamic;
  var selectionResizeDisabledMessage: Dynamic;
  var selectionRotateDisabledMessages: Dynamic;
  function resizeGripCompassDirection(grip?: Dynamic): Dynamic {
    return (
      (grip.y === "top" ? "n" : grip.y === "bottom" ? "s" : "") +
      (grip.x === "left" ? "w" : grip.x === "right" ? "e" : "")
    );
  }
  function SelectionChromeOverlay({
    chrome: chrome,
    scale: scale,
    interactive: interactive,
    onGripDown: onGripDown,
    onContextMenu: onContextMenu,
    crop: crop,
    board: board,
  }: Dynamic): Dynamic {
    let stroke: Dynamic = chrome.stroke,
      value: Dynamic = [...chrome.rings].sort(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          +(input.k === "grip") - +(options.k === "grip"),
      ),
      value2: Dynamic = value.some(
        (input?: Dynamic): Dynamic => input.k === "grip" && input.group,
      ),
      index: Dynamic = 0;
    return (
      <div
        className={"absolute inset-0"}
        style={{
          pointerEvents: "none",
        }}
        data-testid={"mega-element-chrome"}
        onContextMenu={onContextMenu}
      >
        {chrome.artboard && board && (
          <runtime.SelectionRing
            data-testid={"mega-artboard-hover"}
            className={"[[data-mega-selected]_&]:hidden"}
            frame={{
              x: 0,
              y: 0,
              w: board.w,
              h: board.h,
            }}
            scale={scale}
            state={"hover"}
            variant={board.component ? "component" : "object"}
          />
        )}
        {value.map(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            input.k === "busy"
              ? (() => {
                  const _Component = "div";
                  const _props = {
                    "data-testid": "mega-element-busy",
                    style: {
                      position: "absolute",
                      left: input.x,
                      top: input.y,
                      width: input.w,
                      height: input.h,
                      transform: input.rot
                        ? "rotate(" + String(input.rot) + "rad)"
                        : undefined,
                      pointerEvents: "none",
                    },
                    children: <runtime.UploadingOverlay />,
                  } as const;
                  const _key = "busy" + String(index++);
                  return <_Component key={_key} {..._props} />;
                })()
              : input.k === "hov"
                ? (() => {
                    const _Component2 = runtime.SelectionRing;
                    const _props2 = {
                      "data-testid": "mega-element-hover",
                      "data-component": input.component ? "" : undefined,
                      frame: {
                        x: input.x,
                        y: input.y,
                        w: input.w,
                        h: input.h,
                      },
                      scale: scale,
                      rotation: input.rot,
                      state: "hover",
                      variant: input.component ? "component" : "object",
                    } as const;
                    const _key2 = "hov" + String(options);
                    return <_Component2 key={_key2} {..._props2} />;
                  })()
                : input.k === "grip" && crop && input.media?.tid === crop.tid
                  ? ((): Dynamic => {
                      let [inset, inset2, inset3, inset4]: Dynamic =
                          input.media.inset,
                        state: Dynamic = {
                          w: input.w * (1 - inset - inset3),
                          h: input.h * (1 - inset2 - inset4),
                        },
                        state2: Dynamic = {
                          w: input.media.w,
                          h: input.media.h,
                        };
                      return (
                        <div
                          key={"crop"}
                          data-testid={"mega-element-crop"}
                          style={{
                            position: "absolute",
                            left: input.x + input.w * inset,
                            top: input.y + input.h * inset2,
                            width: state.w,
                            height: state.h,
                            transform: input.rot
                              ? "rotate(" + String(input.rot) + "rad)"
                              : undefined,
                            transformOrigin:
                              String(input.w * (0.5 - inset)) +
                              "px " +
                              String(input.h * (0.5 - inset2)) +
                              "px",
                          }}
                        >
                          <runtime.MediaCropEditor
                            frame={state}
                            natural={state2}
                            crop={crop.live}
                            scale={scale}
                            rotation={input.rot}
                            src={crop.src}
                            video={input.media.video}
                            zoomDisabledReason={crop.zoomDisabledReason}
                            onLive={(input2?: Dynamic): Dynamic =>
                              crop.onLive(input2, state, state2)
                            }
                            onDone={crop.onDone}
                            onGesture={crop.onGesture}
                            onFrame={noopResizeGrip}
                            frameHandleOff={
                              input.media.abs
                                ? undefined
                                : resizeGripCursorOverrides
                            }
                            onSideStart={(
                              input2?: Dynamic,
                              options2?: Dynamic,
                            ): Dynamic =>
                              crop.onSideStart(input2, options2, {
                                frame: state,
                                natural: state2,
                                rot: input.rot ?? 0,
                                abs: input.media?.abs === true,
                              })
                            }
                          />
                        </div>
                      );
                    })()
                  : (() => {
                      const _Component3 = "div";
                      const _props3 = {
                        "data-testid":
                          input.k !== "grip"
                            ? "mega-element-ring"
                            : input.group
                              ? "mega-element-group-grips"
                              : "mega-element-grips",
                        "data-component": input.component ? "" : undefined,
                        children: (
                          <runtime.SelectionRing
                            frame={{
                              x: input.x,
                              y: input.y,
                              w: input.w,
                              h: input.h,
                            }}
                            scale={scale}
                            rotation={input.rot}
                            state={
                              input.k === "sel" && value2
                                ? "member"
                                : "selected"
                            }
                            variant={input.component ? "component" : "object"}
                            grips={
                              input.k === "grip" && interactive
                                ? "corners"
                                : "none"
                            }
                            edgeStrips={!input.aspectLock}
                            resizeDisabledReason={
                              input.k === "grip" &&
                              interactive &&
                              input.noResize
                                ? selectionResizeDisabledMessage
                                : undefined
                            }
                            onResizeStart={
                              input.k === "grip"
                                ? (
                                    input2?: Dynamic,
                                    options2?: Dynamic,
                                  ): Dynamic =>
                                    onGripDown(
                                      {
                                        kind: "resize",
                                        dir: resizeGripCompassDirection(input2),
                                      },
                                      options2,
                                    )
                                : undefined
                            }
                            onRotateStart={
                              input.k === "grip" &&
                              interactive &&
                              input.rotatable
                                ? (
                                    input2?: Dynamic,
                                    options2?: Dynamic,
                                  ): Dynamic =>
                                    onGripDown(
                                      {
                                        kind: "rotate",
                                        corner: input2,
                                      },
                                      options2,
                                    )
                                : undefined
                            }
                            rotateDisabledReason={
                              input.k === "grip" &&
                              interactive &&
                              input.group &&
                              !input.rotatable
                                ? selectionRotateDisabledMessages[
                                    input.noRotate ?? "none"
                                  ]
                                : undefined
                            }
                            angleLabel={
                              input.deg != null
                                ? String(input.deg) + "\xB0"
                                : undefined
                            }
                          />
                        ),
                      } as const;
                      const _key3 =
                        input.k === "grip" ? "grip" : "sel" + String(options);
                      return <_Component3 key={_key3} {..._props3} />;
                    })(),
        )}
        {chrome.measure ? (
          <runtime.MeasurementOverlay m={chrome.measure} scale={scale} />
        ) : null}
        {chrome.guides ? (
          <runtime.AlignmentGuides guides={chrome.guides} scale={scale} />
        ) : null}
        {stroke ? (
          <runtime.SelectionPoints
            data-testid={"mega-element-line"}
            points={[
              {
                x: stroke.x1,
                y: stroke.y1,
              },
              {
                x: stroke.x2,
                y: stroke.y2,
              },
            ]}
            shaft={[
              {
                x: stroke.x1,
                y: stroke.y1,
              },
              {
                x: stroke.x2,
                y: stroke.y2,
              },
            ]}
            scale={scale}
            shape={"square"}
            onPointDragStart={
              interactive
                ? (input?: Dynamic, options?: Dynamic): Dynamic =>
                    onGripDown(
                      {
                        kind: "endpoint",
                        which: input === 0 ? 0 : 1,
                      },
                      options,
                    )
                : undefined
            }
          />
        ) : null}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsx__b",
    () => jsx__b,
    (value) => {
      jsx__b = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resizeGripCursorOverrides",
    () => resizeGripCursorOverrides,
    (value) => {
      resizeGripCursorOverrides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noopResizeGrip",
    () => noopResizeGrip,
    (value) => {
      noopResizeGrip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resizeGripCompassDirection",
    () => resizeGripCompassDirection,
  );
  bindRuntimeValue(
    runtime,
    "selectionResizeDisabledMessage",
    () => selectionResizeDisabledMessage,
    (value) => {
      selectionResizeDisabledMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectionRotateDisabledMessages",
    () => selectionRotateDisabledMessages,
    (value) => {
      selectionRotateDisabledMessages = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionChromeOverlay",
    () => SelectionChromeOverlay,
  );
  return () => {
    (0, runtime.initializeCdsIndex)();
    jsx__b = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    resizeGripCursorOverrides = {
      n: runtime.ThePageLayoutPlacesTheTopMessage,
      w: runtime.ThePageLayoutPlacesTheTopMessage,
      nw: runtime.ThePageLayoutPlacesTheTopMessage,
      ne: runtime.ThePageLayoutPlacesTheTopMessage,
      sw: runtime.ThePageLayoutPlacesTheTopMessage,
    };
    noopResizeGrip = (): Dynamic => {};
    selectionResizeDisabledMessage =
      "Nothing in this selection can be resized by dragging.";
    selectionRotateDisabledMessages = {
      none: "Nothing in this selection can be rotated.",
      layout:
        "Rotate works on freely placed elements. Drag these out of their layout first.",
    };
  };
}
