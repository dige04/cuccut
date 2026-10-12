/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorMediaCropEditor(
  runtime: RuntimeBindings,
): () => void {
  function blurBeforeCrop(): Dynamic {
    let activeElement: Dynamic = (document as Dynamic).activeElement;
    !(activeElement instanceof HTMLElement) ||
      activeElement.closest("[data-media-crop-keep]") ||
      ((activeElement.isContentEditable ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(activeElement.tagName) ||
        activeElement.closest('button, a[href], [role="button"]')) &&
        activeElement.blur());
  }
  function MediaCropEditor({
    frame: frame,
    natural: natural,
    crop: crop,
    scale: scale,
    rotation = 0,
    src: src,
    video = false,
    zoomDisabledReason: zoomDisabledReason,
    onLive: onLive,
    onDone: onDone,
    onGesture: onGesture,
    onFrame: onFrame,
    frameHandleOff: frameHandleOff,
    minFrame = 0,
    snapFrame: snapFrame,
    onSideStart: onSideStart,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactPropertiesSides.useRef)({
      frame: frame,
      natural: natural,
      crop: crop,
      scale: scale,
      rotation: rotation,
      zoomDisabledReason: zoomDisabledReason,
      onLive: onLive,
      onDone: onDone,
      onGesture: onGesture,
      onFrame: onFrame,
    });
    value.current = {
      frame: frame,
      natural: natural,
      crop: crop,
      scale: scale,
      rotation: rotation,
      zoomDisabledReason: zoomDisabledReason,
      onLive: onLive,
      onDone: onDone,
      onGesture: onGesture,
      onFrame: onFrame,
    };
    let value2: Dynamic = (0, runtime.reactPropertiesSides.useRef)(null),
      value3: Dynamic = (0, runtime.reactPropertiesSides.useRef)(null),
      value4: Dynamic = (0, runtime.reactPropertiesSides.useRef)({
        x: 0,
        y: 0,
      }),
      value5: Dynamic = (0, runtime.reactPropertiesSides.useRef)(false),
      [value6, value7]: Dynamic = (0, runtime.reactPropertiesSides.useState)(
        false,
      ),
      [value8, value9]: Dynamic = (0, runtime.reactPropertiesSides.useState)(
        false,
      ),
      callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        let current: Dynamic = value.current;
        options && current.onFrame
          ? ((value4.current = {
              x: options.x,
              y: options.y,
            }),
            current.onFrame({
              crop: input,
              frame: options,
            }))
          : (0, runtime.sameImageCrop)(input, current.crop) ||
            current.onLive(input);
      },
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        let current: Dynamic = value3.current;
        current &&
          ((value3.current = null),
          current.el.hasPointerCapture(current.pid) &&
            current.el.releasePointerCapture(current.pid),
          input &&
            callback(
              current.start,
              current.drag.of === "side"
                ? {
                    ...current.base,
                    ...current.frame,
                  }
                : undefined,
            ),
          value7(false),
          value.current.onGesture?.(false));
      };
    (0, runtime.reactPropertiesSides.useEffect)((): Dynamic => {
      let current: Dynamic = value.current;
      (0, runtime.announce)(
        "Cropping. Press Enter when done. " +
          (current.onFrame ? "Drag an edge to crop. " : "") +
          "Arrow keys move the picture." +
          (current.zoomDisabledReason === undefined
            ? " Plus and minus zoom it."
            : ""),
      );
      let callback8: Dynamic = (event?: Dynamic): Dynamic => {
          let current3: Dynamic = value.current,
            target: Dynamic = event.target;
          if (
            value5.current ||
            (target instanceof HTMLElement &&
              (target.isContentEditable ||
                /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) ||
            ((event.key === "Enter" || event.key === " ") &&
              target instanceof Element &&
              target.closest('button, a[href], [role="button"]'))
          )
            return;
          let value22: Dynamic =
              (event.metaKey || event.ctrlKey) &&
              (event.key.toLowerCase() === "z" ||
                event.key.toLowerCase() === "y"),
            value23: Dynamic =
              !event.metaKey && !event.ctrlKey && !event.altKey
                ? event.key === "+" || event.key === "="
                  ? runtime.PropertiesSidesConstant_3
                  : event.key === "-" || event.key === "_"
                    ? 1 / runtime.PropertiesSidesConstant_3
                    : 0
                : 0,
            value24: Dynamic =
              !event.metaKey && !event.ctrlKey && !event.altKey
                ? runtime.PropertiesSidesArrowLeftArrowRightArrowUpConfig[
                    event.key
                  ]
                : undefined;
          if (
            event.key !== "Escape" &&
            event.key !== "Enter" &&
            !value22 &&
            value23 === 0 &&
            value24 === undefined
          ) {
            !(
              event.key === " " ||
              event.key === "Tab" ||
              ((event.metaKey || event.ctrlKey) && /^[-=+01]$/.test(event.key))
            ) &&
              !/^(Shift|Control|Alt|AltGraph|Meta|OS|Hyper|Super|Fn|FnLock|Symbol|SymbolLock|CapsLock|NumLock|ScrollLock|Dead|Process|Unidentified)$/.test(
                event.key,
              ) &&
              !value3.current &&
              current3.onDone(true);
            return;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          if (value3.current)
            return event.key === "Escape" ? callback2(true) : undefined;
          if (value24) {
            let value25: Dynamic = (event.shiftKey ? 10 : 1) / current3.scale;
            callback(
              (0, runtime.translateImageCrop)(
                current3.frame,
                current3.natural,
                current3.crop,
                value24[0] * value25,
                value24[1] * value25,
              ),
            );
          } else
            value23 !== 0
              ? current3.zoomDisabledReason === undefined
                ? callback(
                    (0, runtime.zoomImageCrop)(
                      current3.frame,
                      current3.natural,
                      current3.crop,
                      value23,
                    ),
                  )
                : (0, runtime.announce)(current3.zoomDisabledReason)
              : value22
                ? event.key.toLowerCase() === "z" &&
                  !event.shiftKey &&
                  current3.onDone(false)
                : current3.onDone(true);
        },
        callback9: Dynamic = (event?: Dynamic): Dynamic => {
          let value22: Dynamic =
            event.target instanceof Element ? event.target : null;
          value5.current ||
            (event.button === 0 &&
              !value2.current?.contains(value22) &&
              !value22?.closest("[data-media-crop-keep]") &&
              value.current.onDone(true));
        },
        callback10: Dynamic = (
          input?: Dynamic,
          options?: Dynamic,
          context?: Dynamic,
        ): Dynamic => {
          let current3: Dynamic = value.current,
            current4: Dynamic = value2.current;
          if (!current4 || value3.current || value5.current) return;
          let bounds: Dynamic = current4.getBoundingClientRect(),
            [items5, items6]: Dynamic = [
              (input - (bounds.left + bounds.width / 2)) / current3.scale,
              (options - (bounds.top + bounds.height / 2)) / current3.scale,
            ],
            [items7, items8]: Dynamic = [
              Math.cos(-current3.rotation),
              Math.sin(-current3.rotation),
            ],
            state6: Dynamic = {
              x: current3.frame.w / 2 + items5 * items7 - items6 * items8,
              y: current3.frame.h / 2 + items5 * items8 + items6 * items7,
            },
            value22: Dynamic = (0, runtime.zoomImageCrop)(
              current3.frame,
              current3.natural,
              current3.crop,
              Math.min(2, Math.max(0.5, context)),
              state6,
            );
          (0, runtime.sameImageCrop)(value22, current3.crop) ||
            current3.onLive(value22);
        },
        [items3, items4]: Dynamic = [0, 0],
        callback11: Dynamic = (event?: Dynamic): Dynamic => (
          event.preventDefault(),
          event.stopPropagation()
        ),
        callback12: Dynamic = (input?: Dynamic): Dynamic => {
          !(input.ctrlKey || input.metaKey) ||
            value.current.zoomDisabledReason !== undefined ||
            (callback11(input),
            items3 !== 0 && Date.now() - items4 > 1e3 && (items3 = 0),
            items3 === 0 &&
              callback10(
                input.clientX,
                input.clientY,
                Math.exp(-input.deltaY * runtime.PropertiesSidesConstant),
              ));
        },
        callback13: Dynamic = (): Dynamic =>
          value.current.zoomDisabledReason !== undefined,
        callback14: Dynamic = (input?: Dynamic): Dynamic => {
          callback13() ||
            (callback11(input), ([items3, items4] = [1, Date.now()]));
        },
        callback15: Dynamic = (input?: Dynamic): Dynamic => {
          if (callback13()) return;
          callback11(input);
          let value22: Dynamic = input;
          items3 === 0 ||
            !(typeof value22.scale == "number" && value22.scale > 0) ||
            (callback10(
              value22.clientX ?? 0,
              value22.clientY ?? 0,
              value22.scale / items3,
            ),
            ([items3, items4] = [value22.scale, Date.now()]));
        },
        callback16: Dynamic = (input?: Dynamic): Dynamic => {
          callback13() || (callback11(input), (items3 = 0));
        },
        current2: Dynamic = value2.current;
      (window as Dynamic).addEventListener("keydown", callback8, true);
      (window as Dynamic).addEventListener("pointerdown", callback9, true);
      current2?.addEventListener("wheel", callback12, {
        passive: false,
      });
      current2?.addEventListener("gesturestart", callback14);
      current2?.addEventListener("gesturechange", callback15);
      current2?.addEventListener("gestureend", callback16);
      return (): Dynamic => {
        (window as Dynamic).removeEventListener("keydown", callback8, true);
        (window as Dynamic).removeEventListener("pointerdown", callback9, true);
        current2?.removeEventListener("wheel", callback12);
        current2?.removeEventListener("gesturestart", callback14);
        current2?.removeEventListener("gesturechange", callback15);
        current2?.removeEventListener("gestureend", callback16);
        callback2(false);
      };
    }, []);
    let callback3: Dynamic = (event?: Dynamic, options?: Dynamic): Dynamic => {
        if (!(event.button !== 0 || value3.current)) {
          event.preventDefault();
          event.stopPropagation();
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {}
          value3.current = {
            pid: event.pointerId,
            el: event.currentTarget,
            sx: event.clientX,
            sy: event.clientY,
            start: value.current.crop,
            frame: {
              w: frame.w,
              h: frame.h,
            },
            base: {
              ...value4.current,
            },
            drag: options,
          };
          value7(true);
          onGesture?.(true);
        }
      },
      callback4: Dynamic = (input?: Dynamic): Dynamic => {
        let current: Dynamic = value3.current;
        if (!current || input.pointerId !== current.pid) return;
        let [items3, items4]: Dynamic = [
            (input.clientX - current.sx) / scale,
            (input.clientY - current.sy) / scale,
          ],
          [items5, items6]: Dynamic = [
            Math.cos(-rotation),
            Math.sin(-rotation),
          ],
          [items7, items8]: Dynamic = [
            items3 * items5 - items4 * items6,
            items3 * items6 + items4 * items5,
          ];
        if (current.drag.of === "side") {
          let value22: Dynamic = (0, runtime.resizeImageCropFrame)(
              current.frame,
              natural,
              current.start,
              current.drag.side,
              items7,
              items8,
              Math.max(runtime.RESIZE_HANDLE_HIT_SIZE_PX / scale, minFrame),
            ),
            state6: Dynamic = {
              x: current.base.x + value22.frame.x,
              y: current.base.y + value22.frame.y,
              w: value22.frame.w,
              h: value22.frame.h,
            },
            value23: Dynamic = snapFrame ? snapFrame(state6) : state6,
            value24: Dynamic = snapFrame
              ? (0, runtime.cropIntoFrame)(
                  current.frame,
                  natural,
                  current.start,
                  {
                    x: value23.x - current.base.x,
                    y: value23.y - current.base.y,
                    w: value23.w,
                    h: value23.h,
                  },
                )
              : value22.crop;
          (zoomDisabledReason === undefined ||
            value24.zoom <= Math.max(1, current.start.zoom) + 0.001) &&
            callback(value24, value23);
        } else
          callback(
            current.drag.of === "media"
              ? (0, runtime.translateImageCrop)(
                  current.frame,
                  natural,
                  current.start,
                  items7,
                  items8,
                )
              : (0, runtime.resizeImageCropCorner)(
                  current.frame,
                  natural,
                  current.start,
                  current.drag.corner,
                  items7,
                  items8,
                ),
          );
      },
      callback5: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => ({
        onPointerDown: (input2?: Dynamic): Dynamic => {
          input2.button === 0 && (options?.(), callback3(input2, input));
        },
        onPointerMove: callback4,
        onPointerUp: (input2?: Dynamic): Dynamic =>
          value3.current?.pid === input2.pointerId && callback2(false),
        onPointerCancel: (input2?: Dynamic): Dynamic =>
          value3.current?.pid === input2.pointerId && callback2(true),
        onLostPointerCapture: (input2?: Dynamic): Dynamic => {
          if (value3.current?.pid === input2.pointerId) {
            if (input2.buttons === 0) return callback2(false);
            try {
              input2.currentTarget.setPointerCapture(input2.pointerId);
            } catch {
              callback2(false);
            }
          }
        },
      }),
      callback6: Dynamic = (input?: Dynamic): Dynamic => {
        let value22: Dynamic = callback5(
          {
            of: "side",
            side: input,
          },
          (): Dynamic => value9(false),
        );
        return {
          ...value22,
          onPointerDown: (input2?: Dynamic): Dynamic => {
            if (input2.button !== 0 || !onSideStart?.(input, input2))
              return value22.onPointerDown(input2);
            value9(false);
            value5.current = true;
            let pointerId: Dynamic = input2.pointerId,
              callback8: Dynamic = (): Dynamic => {
                value5.current = false;
                (window as Dynamic).removeEventListener(
                  "pointerup",
                  callback9,
                  true,
                );
                (window as Dynamic).removeEventListener(
                  "pointercancel",
                  callback9,
                  true,
                );
                (window as Dynamic).removeEventListener("blur", callback8);
              },
              callback9: Dynamic = (input3?: Dynamic): Dynamic => {
                input3.pointerId === pointerId && callback8();
              };
            (window as Dynamic).addEventListener("pointerup", callback9, true);
            (window as Dynamic).addEventListener(
              "pointercancel",
              callback9,
              true,
            );
            (window as Dynamic).addEventListener("blur", callback8);
          },
        };
      },
      callback7: Dynamic = (input?: Dynamic): Dynamic => ({
        onPointerDown: (event?: Dynamic): Dynamic => (
          event.preventDefault(),
          event.stopPropagation(),
          (0, runtime.announce)(input)
        ),
      }),
      value10: Dynamic = (0, runtime.imageCropRect)(frame, natural, crop),
      value11: Dynamic =
        typeof matchMedia == "function" &&
        matchMedia("(pointer: coarse)").matches,
      value12: Dynamic =
        (value11
          ? runtime.ComponentsSelectionRingPointPointStrokeGripHitConfig
              .gripHitTouch
          : runtime.ComponentsSelectionRingPointPointStrokeGripHitConfig.grip +
            4) / scale,
      value13: Dynamic =
        runtime.ComponentsSelectionRingPointPointStrokeGripHitConfig.grip /
        scale,
      value14: Dynamic =
        (value11
          ? runtime.ComponentsSelectionRingPointPointStrokeGripHitConfig
              .gripHitTouch
          : 20) / scale,
      value15: Dynamic = zoomDisabledReason !== undefined,
      value16: Dynamic = onFrame !== undefined,
      [items, items2]: Dynamic = [
        runtime.RESIZE_HANDLE_LENGTH_PX / scale,
        runtime.RESIZE_HANDLE_THICKNESS_PX / scale,
      ],
      state: Dynamic = {
        position: "absolute",
        background: "var(--t-app-accent)",
        boxShadow: "0 0 0 " + String(1 / scale) + "px #fff",
        borderRadius: items2 / 2,
      },
      state2: Dynamic = {
        ...state,
        boxShadow: undefined,
      },
      state3: Dynamic = {
        ...state,
        background: "#fff",
      },
      [value17, value18, value19, value20]: Dynamic = [
        -value10.x,
        -value10.y,
        -value10.x + frame.w,
        -value10.y + frame.h,
      ].map((input?: Dynamic): Dynamic => String(input) + "px"),
      value21: Dynamic = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${value17} ${value18}, ${value17} ${value20}, ${value19} ${value20}, ${value19} ${value18}, ${value17} ${value18})`,
      state4: Dynamic = {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: runtime.PropertiesSidesConstant_2,
        pointerEvents: "none",
        userSelect: "none",
        clipPath: value21,
      },
      state5: Dynamic = {
        position: "absolute",
        cursor: value6 ? "grabbing" : "grab",
        touchAction: "none",
        pointerEvents: "auto",
      };
    return (
      <div
        ref={value2}
        data-media-crop={""}
        role={"group"}
        aria-label={"Crop"}
        style={{
          position: "absolute",
          inset: 0,
        }}
      >
        <div
          data-media-crop-pan={""}
          style={{
            ...state5,
            left: value10.x,
            top: value10.y,
            width: value10.w,
            height: value10.h,
          }}
          {...callback5(
            {
              of: "media",
            },
            (): Dynamic => value9(true),
          )}
        >
          {src !== null &&
            (video ? (
              <video
                src={src}
                muted={true}
                playsInline={true}
                preload={"metadata"}
                style={state4}
              />
            ) : (
              <img src={src} alt={""} draggable={false} style={state4} />
            ))}
        </div>
        {value16 && (
          <div
            data-media-crop-inside={""}
            style={{
              ...state5,
              inset: 0,
            }}
            {...callback5(
              {
                of: "media",
              },
              (): Dynamic => value9(false),
            )}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            outlineWidth:
              runtime.ComponentsSelectionRingPointPointStrokeGripHitConfig
                .ring / scale,
            outlineStyle: "solid",
            outlineColor: "var(--t-app-accent)",
          }}
        />
        {value16 && value8 && (
          <div
            style={{
              position: "absolute",
              left: value10.x,
              top: value10.y,
              width: value10.w,
              height: value10.h,
              pointerEvents: "none",
              outlineWidth: 1 / scale,
              outlineStyle: "solid",
              outlineColor: "var(--t-app-accent)",
            }}
          />
        )}
        {value16 &&
          runtime.PropertiesSidesNESValues.map((items3?: Dynamic): Dynamic => {
            let value22: Dynamic = frameHandleOff?.[items3],
              value23: Dynamic = items3.length === 2;
            if (
              !value23 &&
              (items3 === "n" || items3 === "s" ? frame.w : frame.h) * scale <
                runtime.RESIZE_EDGE_MIN_LENGTH_PX
            )
              return null;
            let [items4, items5]: Dynamic = [
                items3.includes("w")
                  ? 0
                  : items3.includes("e")
                    ? frame.w
                    : frame.w / 2,
                items3.includes("n")
                  ? 0
                  : items3.includes("s")
                    ? frame.h
                    : frame.h / 2,
              ],
              value24: Dynamic = items3.includes("e") ? -1 : 1,
              value25: Dynamic = items3.includes("s") ? -1 : 1,
              [items6, items7]: Dynamic = [
                value24 > 0
                  ? value14 / 2 - items2 / 2
                  : value14 / 2 + items2 / 2 - items,
                value25 > 0
                  ? value14 / 2 - items2 / 2
                  : value14 / 2 + items2 / 2 - items,
              ];
            return (
              <div
                key={items3}
                data-media-crop-side={items3}
                role={"img"}
                aria-label={
                  "Crop handle, " + runtime.PropertiesSidesNESConfig[items3]
                }
                title={value22 ?? "Drag to crop."}
                aria-disabled={value22 !== undefined || undefined}
                style={{
                  position: "absolute",
                  left: items4 - value14 / 2,
                  top: items5 - value14 / 2,
                  width: value14,
                  height: value14,
                  cursor:
                    value22 !== undefined
                      ? "not-allowed"
                      : runtime.PropertiesSidesNSEConfig[items3],
                  touchAction: "none",
                  pointerEvents: "auto",
                  opacity: value22 !== undefined ? 0.45 : undefined,
                }}
                {...(value22 !== undefined
                  ? callback7(value22)
                  : callback6(items3))}
              >
                {value23 ? (
                  [state3, state2].map(
                    (input?: Dynamic, options?: Dynamic): Dynamic => (
                      <runtime.reactPropertiesSides.Fragment key={options}>
                        <div
                          style={{
                            ...input,
                            left: items6,
                            top: value14 / 2 - items2 / 2,
                            width: items,
                            height: items2,
                          }}
                        />
                        <div
                          style={{
                            ...input,
                            left: value14 / 2 - items2 / 2,
                            top: items7,
                            width: items2,
                            height: items,
                          }}
                        />
                      </runtime.reactPropertiesSides.Fragment>
                    ),
                  )
                ) : items3 === "n" || items3 === "s" ? (
                  <div
                    style={{
                      ...state,
                      width: items * 1.5,
                      height: items2,
                      left: value14 / 2 - (items * 1.5) / 2,
                      top: value14 / 2 - items2 / 2,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      ...state,
                      width: items2,
                      height: items * 1.5,
                      left: value14 / 2 - items2 / 2,
                      top: value14 / 2 - (items * 1.5) / 2,
                    }}
                  />
                )}
              </div>
            );
          })}
        {(!value16 || value8) &&
          runtime.PropertiesSidesNwNeSeValues.map(
            (input?: Dynamic): Dynamic => (
              <div
                key={input}
                data-media-crop-handle={input}
                role={"img"}
                aria-label={
                  "Zoom handle, " + runtime.PropertiesSidesNwNeSeConfig[input]
                }
                title={zoomDisabledReason ?? "Drag to zoom."}
                aria-disabled={value15 || undefined}
                style={{
                  position: "absolute",
                  left:
                    (input === "nw" || input === "sw"
                      ? value10.x
                      : value10.x + value10.w) -
                    value12 / 2,
                  top:
                    (input === "nw" || input === "ne"
                      ? value10.y
                      : value10.y + value10.h) -
                    value12 / 2,
                  width: value12,
                  height: value12,
                  display: "grid",
                  placeItems: "center",
                  cursor: value15
                    ? "not-allowed"
                    : input === "nw" || input === "se"
                      ? "nwse-resize"
                      : "nesw-resize",
                  touchAction: "none",
                  pointerEvents: "auto",
                }}
                {...(value15
                  ? callback7(zoomDisabledReason)
                  : callback5({
                      of: "corner",
                      corner: input,
                    }))}
              >
                <div
                  style={{
                    width: value13,
                    height: value13,
                    boxSizing: "border-box",
                    borderRadius: "50%",
                    background: "#fff",
                    borderWidth: 1.5 / scale,
                    borderStyle: "solid",
                    borderColor: "var(--t-app-accent)",
                    opacity: value15 ? 0.45 : undefined,
                  }}
                />
              </div>
            ),
          )}
      </div>
    );
  }
  bindRuntimeValue(runtime, "blurBeforeCrop", () => blurBeforeCrop);
  bindRuntimeValue(runtime, "MediaCropEditor", () => MediaCropEditor);
  return () => {};
}
