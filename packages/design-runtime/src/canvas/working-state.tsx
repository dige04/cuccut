/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasWorkingState(
  runtime: RuntimeBindings,
): () => void {
  var Value_5: Dynamic;
  var CanvasWorkingStateConstant: Dynamic;
  var CanvasWorkingStateConstant_2: Dynamic;
  var CanvasWorkingStateRegistry: Dynamic;
  var CanvasWorkingStateFloorValue: Dynamic;
  var CanvasWorkingStateLimit: Dynamic;
  var CanvasWorkingStatePxPtPcConfig: Dynamic;
  var CanvasWorkingStateItems: Dynamic;
  var CanvasWorkingStateCache: Dynamic;
  var CanvasWorkingStateSubscribers: Dynamic;
  var CanvasWorkingStateMapValue: Dynamic;
  var CanvasWorkingStateConstant_3: Dynamic;
  var CanvasWorkingStateHtml: Dynamic;
  var imagePreviewWorker: Dynamic;
  var imagePreviewWorkerUnavailable: Dynamic;
  var CanvasWorkingStateItems_2: Dynamic;
  var CanvasWorkingStateJobState: Dynamic;
  var CanvasWorkingStateDelayMs: Dynamic;
  var imagePreviewWorkerDeadline: Dynamic;
  var CanvasWorkingStateConstant_4: Dynamic;
  var CanvasWorkingStateLimit_2: Dynamic;
  var CanvasWorkingStateOnload: Dynamic;
  var CanvasWorkingStateAlias: Dynamic;
  var filePublishInProgress: Dynamic;
  var CanvasWorkingStateDataImagePattern: Dynamic;
  var CanvasWorkingStateResolvedValue: Dynamic;
  var CanvasWorkingStateWidth: Dynamic;
  var CanvasWorkingStateReplace: Dynamic;
  var CanvasWorkingStateHandler: Dynamic;
  var CanvasWorkingStateConstant_5: Dynamic;
  var CanvasWorkingStateQuotaOrStateRateLimitedStoreUnavailableSet: Dynamic;
  var CanvasWorkingStateJoin: Dynamic;
  var CanvasWorkingStatePrint: Dynamic;
  var BoxcancelValue: Dynamic;
  var CanvasWorkingStateLimit_3: Dynamic;
  var reactCanvasWorkingState: Dynamic;
  var CanvasWorkingStateLimit_4: Dynamic;
  var CanvasWorkingStateConstant_6: Dynamic;
  var CanvasWorkingStateConstant_7: Dynamic;
  var CanvasWorkingStateKEEPFILESMAXWaitsConfig: Dynamic;
  var CanvasWorkingStateChangedStaleUnsavedSet: Dynamic;
  var CanvasWorkingStateHas: Dynamic;
  var CanvasWorkingStateContext: Dynamic;
  var CanvasWorkingStateHandler_2: Dynamic;
  var CanvasWorkingStateAddDeletePageAddConfig: Dynamic;
  var CanvasWorkingStateHandler_3: Dynamic;
  var CanvasWorkingStateLimit_5: Dynamic;
  var CanvasWorkingStateConstant_8: Dynamic;
  var CanvasValue: Dynamic;
  var CanvasWorkingStateCtrlKey: Dynamic;
  var CanvasWorkingStateGetAltKey: Dynamic;
  var CanvasWorkingStateCtrl: Dynamic;
  var CanvasWorkingStateMetaKey: Dynamic;
  function createCanvasWorkingState(input?: Dynamic): Dynamic {
    let flag: Dynamic = false,
      flag2: Dynamic = false,
      value: Dynamic,
      callback: Dynamic = (): Dynamic => new Map(),
      flag3: Dynamic = false,
      flag4: Dynamic = false,
      flag5: Dynamic = false,
      flag6: Dynamic = false,
      flag7: Dynamic = false,
      flag8: Dynamic = false,
      flag9: Dynamic = false,
      entries: Dynamic = new Map(),
      values: Dynamic = new Set(),
      callback2: Dynamic = (): Dynamic => (
        (flag7 = false),
        (flag5 = flag4),
        flag4 || (flag6 = false),
        flag4
      ),
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        let value2: Dynamic = (flag && flag3) || (flag2 && flag8);
        value2 !== flag4 && ((flag4 = value2), input.onBusy(value2));
        !(!flag4 || flag5 || flag7 || (input2 && flag6)) &&
          (input2
            ? (flag6 = true)
            : ((flag7 = true),
              input.after(
                CanvasWorkingStateConstant_2,
                (): Dynamic => (flag7 = false),
              )),
          input.say(
            runtime.CanvasWorkingLabelAnimationLabel,
            input2,
            callback2,
          ));
      },
      callback4: Dynamic = (): Dynamic => {
        value = undefined;
        let value2: Dynamic = callback7(callback);
        flag2 = false;
        entries = value2;
        callback3(true);
        if (!flag8 || (flag9 && callback6(value2) === 0)) {
          (flag5 || flag6) && input.hush();
          return;
        }
        let index: Dynamic = 0;
        for (let value3 of values as Dynamic) value2.has(value3) && index++;
        input.say(
          flag9
            ? input.words.ready(callback6(value2))
            : index > 0
              ? input.words.updated(index)
              : input.words.changed(callback6(value2)),
          false,
        );
      },
      callback5: Dynamic = (input2?: Dynamic): Dynamic =>
        input2.startsWith(Value_5),
      callback6: Dynamic = (input2?: Dynamic): Dynamic => {
        let index: Dynamic = 0;
        for (let value2 of input2.keys() as Dynamic)
          callback5(value2) || index++;
        return index;
      },
      callback7: Dynamic = (input2?: Dynamic): Dynamic => {
        try {
          return input2();
        } catch {
          return entries;
        }
      };
    return {
      busy: (): Dynamic => flag4,
      set(input2: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        callback = context;
        let value2: Dynamic = input2 && value !== undefined;
        value2 && value();
        value2 && (value = undefined);
        let value3: Dynamic = input2 && !flag2,
          value4: Dynamic = input2 || flag2 ? callback7(callback) : entries;
        value3 &&
          ((flag5 = false),
          (flag6 = false),
          (flag7 = false),
          (flag8 = false),
          values.clear(),
          (flag9 = callback6(value4) === 0));
        flag = input2;
        input2 && (flag2 = true);
        flag3 = options;
        entries = value4;
        callback3(!value3);
        !input2 &&
          flag2 &&
          value === undefined &&
          (value = input.after(CanvasWorkingStateConstant, callback4));
      },
      changed(input2: Dynamic, options: Dynamic): Dynamic {
        if (!flag2) return;
        callback = options;
        let value2: Dynamic = callback7(callback),
          flag10: Dynamic = false;
        if (input2) {
          for (let [value3, value4] of value2 as Dynamic)
            (!entries.has(value3) || !Object.is(entries.get(value3), value4)) &&
              ((flag10 = true), callback5(value3) || values.add(value3));
          for (let value3 of entries.keys() as Dynamic)
            value2.has(value3) || (flag10 = true);
          flag10 && (flag8 = true);
        }
        entries = value2;
        flag10 && callback3(false);
      },
      stop(): Dynamic {
        value?.();
        value = undefined;
        flag = false;
        flag2 = false;
        flag4 = false;
      },
    };
  }
  function subscribeRemoteDocumentUpdates(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.loadState?.();
    return input.subscribe((input2?: Dynamic): Dynamic => {
      let value2: Dynamic = input.loadState?.(),
        value3: Dynamic = value2 !== value;
      value = value2;
      options(input2?.remote === true && !value3);
    });
  }
  function useCanvasWorkingState(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactCanvasWorkingLabelAnimation.useRef)(
      input,
    );
    value.current = input;
    let value2: Dynamic = (0, runtime.reactCanvasWorkingLabelAnimation.useRef)(
      null,
    );
    value2.current ??= createCanvasWorkingState({
      words: {
        ready: (input2?: Dynamic): Dynamic => value.current.words.ready(input2),
        updated: (input2?: Dynamic): Dynamic =>
          value.current.words.updated(input2),
        changed: (input2?: Dynamic): Dynamic =>
          value.current.words.changed(input2),
      },
      after: (input2?: Dynamic, options?: Dynamic): Dynamic => {
        let value5: Dynamic = setTimeout(
          options,
          input2 === CanvasWorkingStateConstant
            ? (CanvasWorkingStateRegistry.graceMs ?? input2)
            : input2,
        );
        return (): Dynamic => clearTimeout(value5);
      },
      say: (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic =>
        (0, runtime.announce)(
          context ? (): Dynamic => (context() ? input2 : null) : input2,
          options
            ? {
                ifIdle: true,
              }
            : {},
        ),
      hush: (): Dynamic =>
        (0, runtime.announce)("", {
          ifIdle: true,
        }),
      onBusy: (input2?: Dynamic): Dynamic => value.current.onBusy(input2),
    });
    let current: Dynamic = value2.current,
      { doc: value3, empty: value4 }: Dynamic = input,
      callback: Dynamic = (): Dynamic => value.current.items();
    (0, runtime.reactCanvasWorkingLabelAnimation.useEffect)(
      (): Dynamic =>
        subscribeRemoteDocumentUpdates(
          value3,
          (input2?: Dynamic): Dynamic => current.changed(input2, callback),
        ),
      [value3, current],
    );
    (0, runtime.reactCanvasWorkingLabelAnimation.useEffect)(
      (): Dynamic =>
        runtime.claudeActivityStore.subscribe(
          (): Dynamic =>
            current.set(
              runtime.claudeActivityStore.get() === "working",
              value.current.empty,
              callback,
            ),
        ),
      [current],
    );
    (0, runtime.reactCanvasWorkingLabelAnimation.useEffect)(
      (): Dynamic =>
        current.set(
          runtime.claudeActivityStore.get() === "working",
          value4,
          callback,
        ),
      [current, value4],
    );
    (0, runtime.reactCanvasWorkingLabelAnimation.useEffect)(
      (): Dynamic => (
        value.current.onBusy(current.busy()),
        (): Dynamic => {
          current.stop();
          value.current.onBusy(false);
        }
      ),
      [current],
    );
    return null;
  }
  function isSvgFile(input?: Dynamic): Dynamic {
    return input.type === "image/svg+xml" || /\.svg$/i.test(input.name);
  }
  async function imageHeaderDimensions(input?: Dynamic): Promise<Dynamic> {
    if (isSvgFile(input))
      try {
        return svgHeaderDimensions(await input.slice(0, 262144).text());
      } catch {
        return null;
      }
    let value: Dynamic;
    try {
      value = new DataView(await input.slice(0, 262144).arrayBuffer());
    } catch {
      return null;
    }
    return rasterImageDimensions(value);
  }
  function pngPhysicalDimensions(input?: Dynamic): Dynamic {
    if (
      input.byteLength < 8 ||
      input.getUint32(0) !== 2303741511 ||
      input.getUint32(4) !== 218765834
    )
      return null;
    for (
      let count: Dynamic = 8;
      count + 12 <= input.byteLength;
      count += 12 + input.getUint32(count)
    ) {
      let value: Dynamic = input.getUint32(count + 4);
      if (value === 1229209940) return null;
      if (value === 1883789683 && count + 17 <= input.byteLength)
        return input.getUint8(count + 16) === 1
          ? input.getUint32(count + 8)
          : null;
    }
    return null;
  }
  function rasterImageDimensions(input?: Dynamic): Dynamic {
    let value: Dynamic =
      input instanceof DataView
        ? new DataView(
            input.buffer,
            input.byteOffset,
            Math.min(input.byteLength, 262144),
          )
        : new DataView(input, 0, Math.min(input.byteLength, 262144));
    try {
      return parseRasterHeaderDimensions(value);
    } catch {
      return null;
    }
  }
  function parseRasterHeaderDimensions(input?: Dynamic): Dynamic {
    if (input.byteLength < 10) return null;
    if (input.getUint32(0) === 2303741511 && input.getUint32(4) === 218765834)
      return input.getUint32(12) !== 1229472850
        ? null
        : validImageDimensions(input.getUint32(16), input.getUint32(20));
    if (input.getUint32(0) === 1195984440)
      return validImageDimensions(
        input.getUint16(6, true),
        input.getUint16(8, true),
      );
    if (
      input.getUint32(0) === 1380533830 &&
      input.getUint32(8) === 1464156752
    ) {
      let value: Dynamic = input.getUint32(12);
      if (value === 1448097880) {
        let value2: Dynamic =
            1 +
            (input.getUint8(24) |
              (input.getUint8(25) << 8) |
              (input.getUint8(26) << 16)),
          value3: Dynamic =
            1 +
            (input.getUint8(27) |
              (input.getUint8(28) << 8) |
              (input.getUint8(29) << 16));
        return validImageDimensions(value2, value3);
      }
      if (value === 1448097824)
        return input.getUint8(23) !== 157 ||
          input.getUint8(24) !== 1 ||
          input.getUint8(25) !== 42
          ? null
          : validImageDimensions(
              input.getUint16(26, true) & 16383,
              input.getUint16(28, true) & 16383,
            );
      if (value === 1448097868) {
        if (input.getUint8(20) !== 47) return null;
        let value2: Dynamic = input.getUint32(21, true);
        return validImageDimensions(
          1 + (value2 & 16383),
          1 + ((value2 >> 14) & 16383),
        );
      }
      return null;
    }
    return input.getUint16(0) === 65496 ? jpegHeaderDimensions(input) : null;
  }
  function validImageDimensions(input?: Dynamic, options?: Dynamic): Dynamic {
    return input > 0 &&
      options > 0 &&
      input <= CanvasWorkingStateLimit &&
      options <= CanvasWorkingStateLimit
      ? {
          width: input,
          height: options,
        }
      : null;
  }
  function svgLengthToPixels(input?: Dynamic): Dynamic {
    if (input == null) return null;
    let value: Dynamic = /^\s*\+?(\d*\.?\d+)([a-z%]*)\s*$/i.exec(input);
    if (!value) return null;
    let value2: Dynamic =
      CanvasWorkingStatePxPtPcConfig[(value[2] ?? "").toLowerCase()];
    return value2 == null ? null : parseFloat(value[1] ?? "") * value2;
  }
  function svgAttributeValue(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = new RegExp(
      "(?<![\\w-])" + options + `\\s*=\\s*("([^"]*)"|'([^']*)')`,
      "i",
    ).exec(input);
    return value ? (value[2] ?? value[3]) : undefined;
  }
  function svgHeaderDimensions(input?: Dynamic): Dynamic {
    let value: Dynamic = /<svg(?=[\s>])[^>]*/i.exec(input);
    if (!value) return null;
    let value2: Dynamic = value[0],
      value3: Dynamic = svgLengthToPixels(svgAttributeValue(value2, "width")),
      value4: Dynamic = svgLengthToPixels(svgAttributeValue(value2, "height"));
    if (value3 != null && value4 != null)
      return validImageDimensions(value3, value4);
    let value5: Dynamic = svgAttributeValue(value2, "viewBox");
    if (value5 == null) return null;
    let value6: Dynamic = value5
      .trim()
      .split(/[\s,]+/)
      .map(parseFloat);
    return value6.length !== 4 ||
      value6.some((input2?: Dynamic): Dynamic => !Number.isFinite(input2))
      ? null
      : validImageDimensions(value6[2], value6[3]);
  }
  function jpegHeaderDimensions(input?: Dynamic): Dynamic {
    let count: Dynamic = 2,
      count2: Dynamic = 1;
    for (; count + 4 <= input.byteLength; ) {
      if (input.getUint8(count) !== 255) return null;
      let value: Dynamic = input.getUint8(count + 1);
      for (; value === 255 && count + 2 < input.byteLength; ) {
        count++;
        value = input.getUint8(count + 1);
      }
      if (value === 1 || (value >= 208 && value <= 215)) {
        count += 2;
        continue;
      }
      if (value === 217 || value === 218) return null;
      let value2: Dynamic = input.getUint16(count + 2);
      if (value2 < 2) return null;
      if (
        value >= 192 &&
        value <= 207 &&
        value !== 196 &&
        value !== 200 &&
        value !== 204
      ) {
        let value3: Dynamic = input.getUint16(count + 5),
          value4: Dynamic = input.getUint16(count + 7),
          value5: Dynamic = count2 >= 5 && count2 <= 8;
        return validImageDimensions(
          value5 ? value3 : value4,
          value5 ? value4 : value3,
        );
      }
      if (
        value === 225 &&
        value2 >= 16 &&
        input.getUint32(count + 4) === 1165519206
      )
        try {
          count2 =
            exifImageOrientation(input, count + 10, value2 - 8) ?? count2;
        } catch {}
      count += 2 + value2;
    }
    return null;
  }
  function exifImageOrientation(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
      input2 >= 0 && input2 + options2 <= context;
    if (!callback(0, 8)) return null;
    let value: Dynamic = input.getUint16(options),
      value2: Dynamic = value === 18761;
    if (
      (!value2 && value !== 19789) ||
      input.getUint16(options + 2, value2) !== 42
    )
      return null;
    let value3: Dynamic = input.getUint32(options + 4, value2);
    if (!callback(value3, 2)) return null;
    let value4: Dynamic = input.getUint16(options + value3, value2);
    for (let index: Dynamic = 0; index < value4; index++) {
      let value5: Dynamic = value3 + 2 + index * 12;
      if (!callback(value5, 12)) return null;
      if (input.getUint16(options + value5, value2) === 274) {
        let value6: Dynamic = input.getUint16(options + value5 + 8, value2);
        return value6 >= 1 && value6 <= 8 ? value6 : null;
      }
    }
    return null;
  }
  function notifyDropGhosts(): Dynamic {
    CanvasWorkingStateMapValue = CanvasWorkingStateItems.map(
      ({ need: need, ...props }: Dynamic): Dynamic => props,
    );
    for (let value of CanvasWorkingStateSubscribers as Dynamic) value();
  }
  function removeDropGhost(input?: Dynamic): Dynamic {
    let value: Dynamic = CanvasWorkingStateItems.indexOf(input);
    value < 0 || (CanvasWorkingStateItems.splice(value, 1), notifyDropGhosts());
  }
  function createDropGhost({ washless: washless, ...props }: Dynamic): Dynamic {
    let length: Dynamic = CanvasWorkingStateItems.filter(
        (input?: Dynamic): Dynamic =>
          input.file != null &&
          input.file === props.file &&
          input.need !== 1 / 0,
      ).length,
      state: Dynamic = {
        ...props,
        key: "dg-" + String(++CanvasWorkingStateConstant_3),
        need:
          props.file == null || washless
            ? 1 / 0
            : (CanvasWorkingStateCache.get(props.file) ?? 0) + length + 1,
      };
    CanvasWorkingStateItems.push(state);
    notifyDropGhosts();
    return {
      replaced: (): Dynamic =>
        afterRendering((): Dynamic => removeDropGhost(state)),
      cancel: (): Dynamic => {
        if (CanvasWorkingStateItems.includes(state)) {
          for (let value of CanvasWorkingStateItems as Dynamic)
            value !== state &&
              value.file != null &&
              value.file === state.file &&
              value.need > state.need &&
              (value.need -= 1);
          removeDropGhost(state);
        }
      },
      landed: (): Dynamic => {
        setTimeout((): Dynamic => removeDropGhost(state), 700);
      },
      move: (input?: Dynamic, options?: Dynamic): Dynamic => {
        !CanvasWorkingStateItems.includes(state) ||
          (state.x === input && state.y === options) ||
          ((state.x = input), (state.y = options), notifyDropGhosts());
      },
      place: (input?: Dynamic): Dynamic => {
        !CanvasWorkingStateItems.includes(state) ||
          (state.x === input.x &&
            state.y === input.y &&
            state.w === input.w &&
            state.h === input.h) ||
          (Object.assign(state, input), notifyDropGhosts());
      },
    };
  }
  function updateDropGhostDemand(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = Math.max(
      0,
      (CanvasWorkingStateCache.get(input) ?? 0) - options,
    );
    CanvasWorkingStateCache.set(input, options);
    value > 0 &&
      CanvasWorkingStateItems.filter(
        (input2?: Dynamic): Dynamic =>
          input2.file === input && input2.need !== 1 / 0,
      ).forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
        input2.need = Math.max(options2 + 1, input2.need - value);
      });
    for (let value2 of CanvasWorkingStateItems.filter(
      (input2?: Dynamic): Dynamic => input2.file === input,
    ) as Dynamic)
      options >= value2.need &&
        afterRendering((): Dynamic => removeDropGhost(value2));
  }
  function uploadingAnimationDelay(): Dynamic {
    return "-" + String(Date.now() % 1600) + "ms";
  }
  function getDropGhosts(): Dynamic {
    return CanvasWorkingStateMapValue;
  }
  function subscribeDropGhosts(input?: Dynamic): Dynamic {
    CanvasWorkingStateSubscribers.add(input);
    return (): Dynamic => {
      CanvasWorkingStateSubscribers.delete(input);
    };
  }
  function afterNextPaint(): Dynamic {
    return new Promise((input?: Dynamic): Dynamic => {
      typeof requestAnimationFrame == "function" &&
        requestAnimationFrame((): Dynamic => setTimeout(input, 0));
      setTimeout(input, 100);
    });
  }
  function afterRendering(input?: Dynamic): Dynamic {
    typeof requestAnimationFrame == "function"
      ? afterNextPaint().then(input)
      : input();
  }
  function markDropPerformance(input?: Dynamic): Dynamic {
    try {
      if (input === "received")
        for (let value of performance.getEntriesByType("mark") as Dynamic)
          value.name.startsWith("dc-drop:") &&
            performance.clearMarks(value.name);
      performance.mark("dc-drop:" + input);
    } catch {}
  }
  function stopImagePreviewWorker(): Dynamic {
    clearTimeout(imagePreviewWorkerDeadline);
    imagePreviewWorkerUnavailable = true;
    imagePreviewWorker?.terminate();
    imagePreviewWorker = null;
    for (let value of [
      ...(CanvasWorkingStateJobState ? [CanvasWorkingStateJobState] : []),
      ...CanvasWorkingStateItems_2.splice(0),
    ] as Dynamic)
      value.settle("unavailable");
    CanvasWorkingStateJobState = null;
  }
  function runNextImagePreviewJob(): Dynamic {
    if (
      !(
        CanvasWorkingStateJobState !== null ||
        CanvasWorkingStateItems_2.length === 0
      )
    ) {
      CanvasWorkingStateJobState = CanvasWorkingStateItems_2.shift();
      try {
        imagePreviewWorker === null &&
          ((imagePreviewWorker = new Worker(
            URL.createObjectURL(
              new Blob([CanvasWorkingStateHtml], {
                type: "text/javascript",
              }),
            ),
          )),
          (imagePreviewWorker.onmessage = (input?: Dynamic): Dynamic => {
            if (input.data.unavailable) return stopImagePreviewWorker();
            clearTimeout(imagePreviewWorkerDeadline);
            let value: Dynamic = CanvasWorkingStateJobState;
            CanvasWorkingStateJobState = null;
            value?.settle(
              input.data.threw
                ? "unavailable"
                : {
                    url: input.data.url ?? null,
                    width: input.data.width ?? 0,
                    height: input.data.height ?? 0,
                  },
            );
            runNextImagePreviewJob();
          }),
          (imagePreviewWorker.onerror = stopImagePreviewWorker),
          (imagePreviewWorker.onmessageerror = stopImagePreviewWorker));
        imagePreviewWorker.postMessage(CanvasWorkingStateJobState.job);
        imagePreviewWorkerDeadline = setTimeout(
          stopImagePreviewWorker,
          CanvasWorkingStateDelayMs,
        );
      } catch {
        stopImagePreviewWorker();
      }
    }
  }
  function previewImageInWorker(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return imagePreviewWorkerUnavailable ||
      typeof Worker === "undefined" ||
      typeof OffscreenCanvas === "undefined"
      ? Promise.resolve("unavailable")
      : new Promise((input2?: Dynamic): Dynamic => {
          CanvasWorkingStateItems_2.push({
            job: {
              file: input,
              width: options,
              edge: context,
              maxChars: value,
            },
            settle: input2,
          });
          runNextImagePreviewJob();
        });
  }
  function encodeImagePreview(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = 0,
  ): Dynamic {
    let value: Dynamic = input,
      text: Dynamic = "image/webp",
      value2: Dynamic = options,
      value3: Dynamic = value.toDataURL(text, value2);
    if (!value3.startsWith("data:image/webp")) {
      let value4: Dynamic = (document as Dynamic).createElement("canvas");
      value4.width = value.width;
      value4.height = value.height;
      let value5: Dynamic = value4.getContext("2d");
      value5 &&
        ((value5.fillStyle = "#fff"),
        value5.fillRect(0, 0, value4.width, value4.height),
        value5.drawImage(value, 0, 0));
      value = value4;
      text = "image/jpeg";
      value3 = value.toDataURL(text, value2);
    }
    for (; context && value3.length > context && value2 > 0.3; ) {
      value2 -= 0.1;
      value3 = value.toDataURL(text, value2);
    }
    if (context && value3.length > context) {
      let value4: Dynamic = (document as Dynamic).createElement("canvas");
      value4.width = value.width >> 1 || 1;
      value4.height = value.height >> 1 || 1;
      value4
        .getContext("2d")
        ?.drawImage(value, 0, 0, value4.width, value4.height);
      value3 = value4.toDataURL(text, value2);
    }
    return value3;
  }
  function imagePreviewDecodeWidth(input?: Dynamic): Dynamic {
    let value: Dynamic = input
      ? Math.max(
          1,
          Math.ceil(
            Math.max(input.width, input.height) / CanvasWorkingStateConstant_4,
          ),
        )
      : 1;
    if (input == null || value === 1) return 0;
    let value2: Dynamic = Math.max(1, Math.round(input.width / value)),
      value3: Dynamic = input.width / input.height;
    return value2 * value2 * Math.max(value3, 1 / value3) > 67108864
      ? 0
      : value2;
  }
  function reconcileImageDimensions(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return input == null
      ? {
          width: options.width,
          height: options.height,
        }
      : Math.abs(
            Math.log(
              (options.width / options.height) * (input.width / input.height),
            ),
          ) < 0.02 && Math.abs(Math.log(input.width / input.height)) > 0.04
        ? {
            width: input.height,
            height: input.width,
          }
        : input;
  }
  async function previewImageFile(
    input?: Dynamic,
    options: Dynamic = {},
  ): Promise<Dynamic> {
    if (isSvgFile(input))
      return input.size > CanvasWorkingStateFloorValue
        ? null
        : previewSvgFile(input);
    let [value, value2]: Dynamic = await Promise.all([
      options.sized ?? (0, runtime.canDecodeRasterImage)(input),
      options.head !== undefined
        ? options.head
        : imageHeaderDimensions(input).catch((): Dynamic => null),
    ]);
    if (!value) return null;
    let value3: Dynamic = imagePreviewDecodeWidth(value2),
      value4: Dynamic = await previewImageInWorker(
        input,
        value3,
        CanvasWorkingStateConstant_4,
        CanvasWorkingStateLimit_2,
      );
    value4 === "unavailable"
      ? (value4 = await decodeRasterPreview(input, value3))
      : value4.url != null && markDropPerformance("worker");
    return value4.url == null
      ? null
      : {
          url: value4.url,
          ...reconcileImageDimensions(value2, value4),
        };
  }
  async function decodeRasterPreview(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    let value: Dynamic;
    try {
      value = await (options > 0
        ? createImageBitmap(input, {
            resizeWidth: options,
            resizeQuality: "medium",
          }).catch((): Dynamic => createImageBitmap(input))
        : createImageBitmap(input));
    } catch {
      return {
        url: null,
        width: 0,
        height: 0,
      };
    }
    try {
      let value2: Dynamic = Math.max(
          1,
          Math.ceil(
            Math.max(value.width, value.height) / CanvasWorkingStateConstant_4,
          ),
        ),
        value3: Dynamic = Math.max(1, Math.round(value.width / value2)),
        value4: Dynamic = Math.max(1, Math.round(value.height / value2)),
        value5: Dynamic =
          (await encodeOffscreenPreview(value, value3, value4)) ??
          encodeCanvasPreview(value, value3, value4);
      return {
        url:
          value5 != null && value5.length <= CanvasWorkingStateLimit_2
            ? value5
            : null,
        width: value.width,
        height: value.height,
      };
    } finally {
      value.close();
    }
  }
  async function encodeOffscreenPreview(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Promise<Dynamic> {
    if (typeof OffscreenCanvas === "undefined") return null;
    try {
      let value: Dynamic = new OffscreenCanvas(options, context);
      value.getContext("2d")?.drawImage(input, 0, 0, options, context);
      for (let count: Dynamic = 0.8; count > 0.25; count -= 0.1) {
        let value3: Dynamic = await value.convertToBlob({
          type: "image/webp",
          quality: count,
        });
        if (value3.type !== "image/webp") return null;
        let value4: Dynamic = await CanvasWorkingStateOnload(value3);
        if (value4.length <= CanvasWorkingStateLimit_2) return value4;
      }
      let value2: Dynamic = new OffscreenCanvas(
        options >> 1 || 1,
        context >> 1 || 1,
      );
      value2
        .getContext("2d")
        ?.drawImage(value, 0, 0, value2.width, value2.height);
      return await CanvasWorkingStateOnload(
        await value2.convertToBlob({
          type: "image/webp",
          quality: 0.3,
        }),
      );
    } catch {
      return null;
    }
  }
  function encodeCanvasPreview(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (document as Dynamic).createElement("canvas");
    value.width = options;
    value.height = context;
    let value2: Dynamic = value.getContext("2d");
    return value2
      ? (value2.drawImage(input, 0, 0, options, context),
        encodeImagePreview(value, 0.8, CanvasWorkingStateLimit_2))
      : null;
  }
  async function previewSvgFile(input?: Dynamic): Promise<Dynamic> {
    try {
      let value: Dynamic = new Image();
      value.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await input.text())}`;
      await value.decode();
      let naturalWidth: Dynamic = value.naturalWidth,
        naturalHeight: Dynamic = value.naturalHeight;
      if (!(naturalWidth > 0) || !(naturalHeight > 0)) return null;
      let value2: Dynamic = Math.max(
          1,
          Math.ceil(
            Math.max(naturalWidth, naturalHeight) /
              CanvasWorkingStateConstant_4,
          ),
        ),
        value3: Dynamic = Math.max(1, Math.round(naturalWidth / value2)),
        value4: Dynamic = Math.max(1, Math.round(naturalHeight / value2)),
        value5: Dynamic = (document as Dynamic).createElement("canvas");
      value5.width = value3;
      value5.height = value4;
      let value6: Dynamic = value5.getContext("2d");
      if (!value6) return null;
      value6.drawImage(value, 0, 0, value3, value4);
      let value7: Dynamic = encodeImagePreview(
        value5,
        0.8,
        CanvasWorkingStateLimit_2,
      );
      return value7.length <= CanvasWorkingStateLimit_2
        ? {
            url: value7,
            width: naturalWidth,
            height: naturalHeight,
          }
        : null;
    } catch {
      return null;
    }
  }
  async function writeVersionedProjectFile(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Promise<Dynamic> {
    if (!runtime.projectFilesystem.writeFileVersioned) {
      await runtime.projectFilesystem.writeFile(
        input,
        options,
        context?.encoding,
      );
      return "unversioned";
    }
    try {
      await runtime.projectFilesystem.writeFileVersioned(input, options, {
        encoding: context?.encoding,
        baseline: {
          occToken: 0n,
        },
        conflictPolicy: "fail",
      });
      return "created";
    } catch (value: Dynamic) {
      if (value?.code === 10) {
        console.warn("[occ] create-assert collision:", input);
        return "exists";
      }
      throw value;
    }
  }
  function setFilePublishHandler(input?: Dynamic): Dynamic {
    CanvasWorkingStateAlias = input;
  }
  async function uploadDesignFile(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Promise<Dynamic> {
    let value: Dynamic =
        (context.name.replace(/\.[^.]*$/, "") || "image")
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/^-+/, "")
          .slice(0, 40) || "image",
      value2: Dynamic = await (0, runtime.uploadImageWithFallback)(context, {}),
      value3: Dynamic = (0, runtime.classifyUploadResult)(value2);
    value3 && runtime.healthReporter.report(...value3);
    if (value2.kind === "blob")
      return {
        relName: value2.src,
        relPath: value2.src,
        base: value,
        src: value2.src,
      };
    filePublishInProgress ||
      ((filePublishInProgress = true),
      CanvasWorkingStateAlias?.(value2.reason));
    let value4: Dynamic = CanvasWorkingStateDataImagePattern.exec(value2.src);
    if (value4 === null) throw new Error("could not encode the image");
    let value5: Dynamic = value4[1].toLowerCase(),
      value6: Dynamic =
        value5 === "jpeg"
          ? "jpg"
          : value5 === "svg+xml"
            ? "svg"
            : value5.replace(/[^a-z0-9]/g, "") || "png",
      value7: Dynamic = value2.src.slice(value4[0].length),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        `${value}-${Date.now().toString(36)}${input2}.${value6}`,
      value8: Dynamic = callback(`-${Math.random().toString(36).slice(2, 6)}`),
      value9: Dynamic = options ? `${options}/${value8}` : value8;
    if (
      (await writeVersionedProjectFile(`${input}/${value9}`, value7, {
        encoding: "base64",
      })) === "exists" &&
      ((value8 = callback(`-${Math.random().toString(36).slice(2, 6)}`)),
      (value9 = options ? `${options}/${value8}` : value8),
      (await writeVersionedProjectFile(`${input}/${value9}`, value7, {
        encoding: "base64",
      })) === "exists")
    )
      throw new Error(`upload target already exists: ${value9}`);
    (0, runtime.markLocalFileChange)(input, value9);
    return {
      relName: value8,
      relPath: value9,
      base: value,
      src: "./" + value8,
    };
  }
  async function uploadDesignVideo(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    let value: Dynamic = await (0, runtime.uploadVideo)(input, {
        probed: options,
      }),
      value2: Dynamic = (0, runtime.classifyUploadResult)(value);
    value2 && runtime.healthReporter.report(...value2);
    return value.kind === "refused"
      ? {
          refused: (0, runtime.videoUploadFailureMessage)(value.reason),
          repeats:
            CanvasWorkingStateQuotaOrStateRateLimitedStoreUnavailableSet.has(
              value.reason,
            ),
        }
      : (0, runtime.isBlobAssetUrl)(value.src)
        ? {
            src:
              runtime.blobAssetPathPattern.test(value.src) &&
              !value.src.startsWith("/")
                ? "/" + value.src
                : value.src,
          }
        : {
            refused: (0, runtime.videoUploadFailureMessage)("bad_result"),
            repeats: false,
          };
  }
  function positionedVideoHtml(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return (0, runtime.uploadedVideoHtml)(input, {
      ...options,
      style: `position: absolute; left: ${String(context.left)}px; top: ${String(context.top)}px; width: ${String(context.w)}px; height: auto`,
      label: value,
    });
  }
  function videoFileTitle(input?: Dynamic): Dynamic {
    return (
      (0, runtime.truncateUtf16Safely)(
        input.name.replace(/\.[^.]*$/, "").trim(),
        60,
      ) || "Video"
    );
  }
  function uploadedVideoAnnotation(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return (0, runtime.updateAnnotationAlt)(
      (0, runtime.updateAnnotationVideo)(
        {
          ...input,
          src: options.src,
          ...(options.h !== undefined
            ? {
                h: options.h,
              }
            : {}),
        },
        options.video,
      ),
      options.alt,
    );
  }
  function isSessionCancelMessage(input?: Dynamic, options?: Dynamic): Dynamic {
    return (
      input != null && options != null && input === BoxcancelValue + options
    );
  }
  function reduceSessionCancellation(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
      rec: input,
      restore: null,
      cancelKey: null,
    };
    return options.type === "escape"
      ? !input || !input.live || input.cancelling || context.busy
        ? state
        : {
            rec: {
              ...input,
              cancelling: true,
            },
            restore: null,
            cancelKey: input.key,
          }
      : options.file !== context.focusedFile
        ? state
        : options.type === "press"
          ? context.busy
            ? state
            : {
                rec: {
                  file: options.file,
                  key: options.key,
                  live: false,
                  prior: context.selection,
                  at: context.now,
                },
                restore: null,
                cancelKey: null,
              }
          : !input || input.file !== options.file || input.key !== options.key
            ? state
            : options.type === "live"
              ? context.busy ||
                context.now - input.at > CanvasWorkingStateLimit_3
                ? {
                    rec: null,
                    restore: null,
                    cancelKey: null,
                  }
                : {
                    rec: {
                      ...input,
                      live: true,
                    },
                    restore: null,
                    cancelKey: null,
                  }
              : options.type === "end"
                ? {
                    rec: null,
                    restore: null,
                    cancelKey: null,
                  }
                : !input.live ||
                    context.busy ||
                    !(input.cancelling || context.frameFocused)
                  ? {
                      rec: null,
                      restore: null,
                      cancelKey: null,
                    }
                  : {
                      rec: null,
                      restore: input.prior,
                      cancelKey: null,
                    };
  }
  function randomSessionToken(): Dynamic {
    return Array.from(
      crypto.getRandomValues(new Uint8Array(8)),
      (input?: Dynamic): Dynamic => input.toString(16).padStart(2, "0"),
    ).join("");
  }
  function createEditSessionManager(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      items2: Dynamic = [],
      flag: Dynamic = false,
      index: Dynamic = 0,
      index2: Dynamic = 0,
      value: Dynamic = new WeakSet(),
      value2: Dynamic = null,
      flag2: Dynamic = false,
      callback: Dynamic = (): Dynamic => {
        flag2 = true;
        queueMicrotask((): Dynamic => {
          flag2 = false;
        });
      },
      values: Dynamic = new Set(),
      callback2: Dynamic = (): Dynamic => {
        for (let value3 of values as Dynamic) value3();
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic =>
        input.floor?.(input2) ?? 0,
      callback4: Dynamic = (input2?: Dynamic): Dynamic => {
        let value3: Dynamic = callback3(input2.file);
        return value3 < input2.floor
          ? 0
          : Math.max(0, input2.depth - (value3 - input2.floor));
      },
      callback5: Dynamic = (input2?: Dynamic): Dynamic => {
        let value3: Dynamic = input.depths(input2.file);
        return value3 != null && value3 > 0 && value3 === callback4(input2);
      },
      callback6: Dynamic = (input2?: Dynamic): Dynamic => {
        let value3: Dynamic = input.depths(input2.file);
        return (
          value3 != null &&
          callback4(input2) > 0 &&
          value3 === callback4(input2) - 1 &&
          (input.redos?.(input2.file) ?? 1) > 0
        );
      },
      callback7: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic =>
        input2.atomic
          ? input2.parts.every(options)
          : input2.parts.some(options),
      callback8: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context: Dynamic = false,
        value3?: Dynamic,
        extra?: Dynamic,
      ): Dynamic => {
        if (context && value.has(input2)) return;
        options === "stale" && value.add(input2);
        let bound: Dynamic = input2.bound;
        queueMicrotask(
          (): Dynamic => input.onAtomicRefused?.(bound, options, value3, extra),
        );
      },
      callback9: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic =>
        !value.has(input2) && callback7(input2, options),
      callback10: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value3: Dynamic = input2.parts.filter(context);
        if (value3.length === input2.parts.length)
          return {
            parts: value3,
            atomic: true,
            ...(input2.holder !== undefined
              ? {
                  holder: input2.holder,
                }
              : {}),
          };
        if (input2.holder === undefined) return null;
        let value4: Dynamic = value3.filter(
          (input3?: Dynamic): Dynamic =>
            options === "undo"
              ? input3.file !== input2.holder
              : input3.file === input2.holder,
        );
        return value4.length > 0
          ? {
              parts: value4,
            }
          : null;
      },
      callback11: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value3: Dynamic = callback10(input2, options, context);
        return value3
          ? value3.atomic
            ? "whole"
            : options === "undo"
              ? "others"
              : "holder"
          : "nothing";
      },
      callback12: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        if (
          input2.holder === undefined ||
          callback10(input2, "undo", options)?.atomic
        )
          return;
        let value3: Dynamic = input2.parts.find(
            (input3?: Dynamic): Dynamic => input3.file === input2.holder,
          ),
          value4: Dynamic = value3 ? input.depths(value3.file) : null;
        return value3 &&
          value4 != null &&
          callback4(value3) > 0 &&
          value4 >= callback4(value3)
          ? value3
          : undefined;
      },
      callback13: Dynamic = (input2?: Dynamic): Dynamic => {
        if (!input.dropRedo) return [];
        let value3: Dynamic = input2.filter((input3?: Dynamic): Dynamic => {
          let value4: Dynamic = input.depths(input3.file);
          return value4 != null && value4 < callback4(input3);
        });
        for (let value4 of value3 as Dynamic)
          input.dropRedo(value4.file, callback4(value4));
        return value3;
      },
      callback14: Dynamic = (items3?: Dynamic, options?: Dynamic): Dynamic =>
        items3.length < 2
          ? []
          : callback13(
              items3.filter(
                (input2?: Dynamic): Dynamic => input2.file !== options,
              ),
            ),
      callback15: Dynamic = (input2?: Dynamic): Dynamic => {
        let items3: Dynamic = [...input2];
        for (; items3.length > 0; ) {
          let value3: Dynamic = items3,
            callback19: Dynamic = (input3?: Dynamic): Dynamic =>
              value3.some(
                (input4?: Dynamic): Dynamic =>
                  input4.file === input3.file &&
                  callback4(input3) >= callback4(input4),
              ),
            items4: Dynamic = [],
            items5: Dynamic = [];
          for (let value4 of items2 as Dynamic)
            value4.parts.some(callback19)
              ? value4.atomic
                ? (callback8(value4, "stale", false, "nothing"),
                  items4.push(
                    ...callback13(
                      value4.parts.filter(
                        (input3?: Dynamic): Dynamic => !callback19(input3),
                      ),
                    ),
                  ))
                : ((value4.parts = value4.parts.filter(
                    (input3?: Dynamic): Dynamic => !callback19(input3),
                  )),
                  value4.parts.length > 0 && items5.push(value4))
              : items5.push(value4);
          items2 = items5;
          items3 = items4;
        }
      },
      callback16: Dynamic = (): Dynamic => {
        if (flag || index > 0) return;
        let length: Dynamic = items.length;
        for (
          ;
          length > 0 &&
          !items[length - 1].atomic &&
          !callback7(items[length - 1], callback5);

        )
          length--;
        length !== items.length && (items = items.slice(0, length));
        let value3: Dynamic = items[items.length - 1];
        value3?.atomic &&
          !callback7(value3, callback5) &&
          callback8(
            value3,
            "stale",
            true,
            callback11(value3, "undo", callback5),
          );
        let length2: Dynamic = items2.length;
        for (
          ;
          length2 > 0 &&
          !items2[length2 - 1].atomic &&
          !callback7(items2[length2 - 1], callback6);

        )
          length2--;
        length2 !== items2.length && (items2 = items2.slice(0, length2));
        let value4: Dynamic = items2[items2.length - 1];
        value4?.atomic &&
          !callback7(value4, callback6) &&
          callback8(
            value4,
            "stale",
            true,
            callback11(value4, "redo", callback6),
          );
      },
      callback17: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let callback19: Dynamic = (input3?: Dynamic): Dynamic => (
          (flag = true),
          input3
            .then(
              (): Dynamic => true,
              (): Dynamic => false,
            )
            .finally((): Dynamic => {
              flag = false;
              callback2();
            })
        );
        if (input2.parts.length === 1) {
          let value5: Dynamic = input.apply(input2.parts[0].file, options);
          return value5
            ? callback19(Promise.resolve(value5))
            : Promise.resolve(true);
        }
        let value3: Dynamic =
          options === "undo" ? [...input2.parts].reverse() : input2.parts;
        if (!input2.atomic)
          return callback19(
            (async (): Promise<Dynamic> => {
              for (let value5 of value3 as Dynamic)
                context(value5) &&
                  (await input.apply(value5.file, options, true));
            })(),
          );
        let value4: Dynamic = options === "undo" ? "redo" : "undo",
          items3: Dynamic = [];
        return callback19(
          (async (): Promise<Dynamic> => {
            for (let value5 of value3 as Dynamic) {
              let value6: Dynamic = input.depths(value5.file);
              if (!context(value5)) {
                for (let value8 of [...items3].reverse() as Dynamic)
                  await input.apply(value8.file, value4);
                throw new Error("atomic part went stale: " + value5.file);
              }
              await input.apply(value5.file, options, true);
              let value7: Dynamic = input.depths(value5.file);
              if (
                value6 == null ||
                value7 == null ||
                value7 !== value6 + (options === "undo" ? -1 : 1)
              ) {
                for (let value8 of [...items3].reverse() as Dynamic)
                  await input.apply(value8.file, value4);
                throw new Error("atomic part did not land: " + value5.file);
              }
              items3.push(value5);
            }
          })(),
        );
      },
      callback18: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let bound: Dynamic = input2.bound;
        bound === undefined ||
          !input.onBoundApplied ||
          context.then((input3?: Dynamic): Dynamic => {
            input3 &&
              setTimeout(
                (): Dynamic => input.onBoundApplied?.(bound, options),
                0,
              );
          });
      };
    return {
      reportPush(input2: Dynamic): Dynamic {
        let value3: Dynamic = input.depths(input2);
        if (value3 == null || value3 <= 0) return;
        value2 &&
          !value2.atomic &&
          !value2.files.has(input2) &&
          !value2.taken.has(input2) &&
          (value2 = null);
        index2 += 1;
        let state: Dynamic = {
            file: input2,
            depth: value3,
            floor: callback3(input2),
          },
          value4: Dynamic =
            value2 != null &&
            value2.files.has(input2) &&
            !value2.taken.has(input2) &&
            !value2.waiting.has(input2);
        if (value4 && value2?.entry && items.includes(value2.entry)) {
          let entry: Dynamic = value2.entry;
          entry.parts.push(state);
          let value5: Dynamic = items.indexOf(entry),
            value6: Dynamic = items.slice(value5 + 1);
          if (
            value6.some(
              (input3?: Dynamic): Dynamic =>
                input3.parts.some(
                  (input4?: Dynamic): Dynamic => input4.file === input2,
                ),
            )
          ) {
            let values2: Dynamic = new Set(
                entry.parts
                  .map((input3?: Dynamic): Dynamic => input3.file)
                  .filter((input3?: Dynamic): Dynamic => input3 !== input2),
              ),
              value7: Dynamic = value6.filter(
                (input3?: Dynamic): Dynamic =>
                  input3.parts.some(
                    (input4?: Dynamic): Dynamic => values2.has(input4.file),
                  ),
              ),
              value8: Dynamic = value6.filter(
                (input3?: Dynamic): Dynamic => !value7.includes(input3),
              ),
              values3: Dynamic = new Set(
                value7.flatMap(
                  (input3?: Dynamic): Dynamic =>
                    input3.parts.map(
                      (input4?: Dynamic): Dynamic => input4.file,
                    ),
                ),
              );
            !values3.has(input2) &&
              !value8.some(
                (input3?: Dynamic): Dynamic =>
                  input3.parts.some(
                    (input4?: Dynamic): Dynamic => values3.has(input4.file),
                  ),
              ) &&
              (items = [
                ...items.slice(0, value5),
                ...value8,
                entry,
                ...value7,
              ]);
          }
        } else {
          let state2: Dynamic = {
            parts: [state],
            ...(value4 && value2?.bound !== undefined
              ? {
                  bound: value2.bound,
                }
              : {}),
            ...(value4 && value2?.atomic
              ? {
                  atomic: true,
                }
              : {}),
            ...(value4 && value2?.atomic && value2.holder !== undefined
              ? {
                  holder: value2.holder,
                }
              : {}),
          };
          value4 && value2 && (value2.entry = state2);
          let items3: Dynamic = [...items, state2];
          for (let value5 of items3.slice(
            0,
            Math.max(0, items3.length - 50),
          ) as Dynamic)
            value5.atomic && callback8(value5, "capped");
          items = items3.slice(-50);
        }
        value4 &&
          value2 &&
          (value2.taken.add(input2),
          value2.taken.size === value2.files.size && (value2 = null));
        items2 = [];
        callback2();
      },
      group(input2: Dynamic, options: Dynamic): Dynamic {
        let state: Dynamic = {
          files: new Set(input2),
          taken: new Set(),
          waiting: new Set(options?.waiting ?? []),
          entry: null,
          ...(options?.bound !== undefined
            ? {
                bound: options.bound,
              }
            : {}),
          ...(options?.atomic
            ? {
                atomic: true,
              }
            : {}),
          ...(options?.atomic && options.holder !== undefined
            ? {
                holder: options.holder,
              }
            : {}),
        };
        value2 = state;
        return {
          end(): Dynamic {
            value2 === state && (value2 = null);
          },
          admit(input3: Dynamic): Dynamic {
            state.waiting.delete(input3);
          },
          settled(input3: Dynamic): Dynamic {
            value2 !== state ||
              !state.files.has(input3) ||
              (state.taken.add(input3),
              state.taken.size === state.files.size && (value2 = null));
          },
          discard(input3: Dynamic): Dynamic {
            let entry: Dynamic = state.entry,
              value3: Dynamic =
                entry && items.includes(entry)
                  ? entry.parts.find(
                      (input4?: Dynamic): Dynamic => input4.file === input3,
                    )
                  : undefined;
            if (!entry || !value3 || !callback5(value3)) return null;
            let state2: Dynamic = {
              parts: entry.parts,
              atomic: entry.atomic,
              holder: entry.holder,
            };
            entry.parts = entry.parts.filter(
              (input4?: Dynamic): Dynamic => input4.file !== input3,
            );
            input3 === entry.holder &&
              (delete entry.atomic, delete entry.holder);
            entry.parts.length === 0 &&
              (items = items.filter(
                (input4?: Dynamic): Dynamic => input4 !== entry,
              ));
            callback2();
            return (): Dynamic => {
              entry.parts = state2.parts;
              state2.atomic && (entry.atomic = state2.atomic);
              state2.holder !== undefined && (entry.holder = state2.holder);
              items.includes(entry) || (items = [...items, entry].slice(-50));
              callback2();
            };
          },
        };
      },
      canUndo(): Dynamic {
        callback16();
        return items.length > 0;
      },
      canRedo(): Dynamic {
        callback16();
        return items2.length > 0;
      },
      undoFile(): Dynamic {
        callback16();
        let value3: Dynamic = items[items.length - 1];
        return (
          [
            ...((value3?.atomic && !callback9(value3, callback5)
              ? callback10(value3, "undo", callback5)
              : value3
            )?.parts ?? []),
          ]
            .reverse()
            .find(callback5)?.file ?? null
        );
      },
      redoFile(): Dynamic {
        callback16();
        let value3: Dynamic = items2[items2.length - 1];
        return (
          (value3?.atomic && !callback9(value3, callback6)
            ? callback10(value3, "redo", callback6)
            : value3
          )?.parts.find(callback6)?.file ?? null
        );
      },
      undo(): Dynamic {
        if (flag || flag2) return "applied";
        let value3: Dynamic = items.length > 0;
        for (; items.length > 0; ) {
          let value4: Dynamic = items[items.length - 1];
          items = items.slice(0, -1);
          if (
            value4.atomic
              ? !callback9(value4, callback5)
              : !callback7(value4, callback5)
          ) {
            if (value4.atomic) {
              let value7: Dynamic = callback12(value4, callback5);
              callback8(
                value4,
                "stale",
                false,
                callback11(value4, "undo", callback5),
                value7?.file,
              );
              let value8: Dynamic = callback10(value4, "undo", callback5);
              value7 && input.cutUndo?.(value7.file, callback4(value7));
              if (value8) {
                items = [...items, value8];
                continue;
              }
              callback2();
              return "refused-atomic";
            }
            continue;
          }
          callback();
          let value5: Dynamic = index2,
            value6: Dynamic = callback17(value4, "undo", callback5);
          value4.atomic && index++;
          callback18(value4, "undo", value6);
          value4.atomic
            ? value6
                .catch((): Dynamic => false)
                .then((input2?: Dynamic): Dynamic => {
                  index--;
                  input2
                    ? index2 === value5
                      ? (items2 = [...items2, value4].slice(-50))
                      : callback8(value4, "stale", false, "nothing")
                    : index2 === value5
                      ? ((items = [...items, value4].slice(-50)),
                        callback8(value4, "failed"))
                      : callback8(value4, "stale", false, "nothing");
                  callback2();
                })
            : (items2 = [...items2, value4].slice(-50));
          callback2();
          return "applied";
        }
        callback2();
        return value3 ? "skipped-all" : "empty";
      },
      redo(): Dynamic {
        if (flag || flag2) return "applied";
        let value3: Dynamic = items2.length > 0;
        for (; items2.length > 0; ) {
          let value4: Dynamic = items2[items2.length - 1];
          items2 = items2.slice(0, -1);
          if (
            value4.atomic
              ? !callback9(value4, callback6)
              : !callback7(value4, callback6)
          ) {
            if (value4.atomic) {
              callback8(
                value4,
                "stale",
                false,
                callback11(value4, "redo", callback6),
              );
              let value7: Dynamic = callback10(value4, "redo", callback6);
              if (value7) {
                items2 = [...items2, value7];
                continue;
              }
              callback15(callback14(value4.parts));
              callback2();
              return "refused-atomic";
            }
            continue;
          }
          callback();
          let value5: Dynamic = index2,
            value6: Dynamic = callback17(value4, "redo", callback6);
          value4.atomic && index++;
          callback18(value4, "redo", value6);
          value4.atomic
            ? value6
                .catch((): Dynamic => false)
                .then((input2?: Dynamic): Dynamic => {
                  index--;
                  input2
                    ? index2 === value5
                      ? (items = [...items, value4].slice(-50))
                      : callback8(value4, "stale", false, "nothing")
                    : index2 === value5
                      ? ((items2 = [...items2, value4].slice(-50)),
                        callback8(value4, "failed"))
                      : callback8(value4, "stale", false, "nothing");
                  callback2();
                })
            : (items = [...items, value4].slice(-50));
          callback2();
          return "applied";
        }
        callback2();
        return value3 ? "skipped-all" : "empty";
      },
      busy: (): Dynamic => flag || index > 0,
      settle: callback16,
      staleBound(input2: Dynamic): Dynamic {
        let value3: Dynamic = input2 === "undo" ? items : items2,
          value4: Dynamic = value3[value3.length - 1];
        return value4?.atomic &&
          !callback9(value4, input2 === "undo" ? callback5 : callback6)
          ? (value4.bound ?? null)
          : null;
      },
      headBound(input2: Dynamic): Dynamic {
        callback16();
        let value3: Dynamic = input2 === "undo" ? items : items2;
        return value3[value3.length - 1]?.bound ?? null;
      },
      forget(input2: Dynamic): Dynamic {
        let items3: Dynamic = [],
          callback19: Dynamic = (
            input3?: Dynamic,
            options?: Dynamic,
          ): Dynamic => {
            for (let value3 of input3 as Dynamic)
              if (
                value3.atomic &&
                value3.parts.some(
                  (input4?: Dynamic): Dynamic => input4.file === input2,
                )
              ) {
                let value4: Dynamic = callback10(
                    value3,
                    options,
                    (input4?: Dynamic): Dynamic => input4.file !== input2,
                  ),
                  value5: Dynamic =
                    options === "undo"
                      ? callback12(
                          value3,
                          (input4?: Dynamic): Dynamic => input4.file !== input2,
                        )
                      : undefined;
                callback8(
                  value3,
                  "stale",
                  false,
                  value4
                    ? options === "undo"
                      ? "others"
                      : "holder"
                    : "nothing",
                  value5?.file,
                );
                !value4 &&
                  options === "redo" &&
                  items3.push(...callback14(value3.parts, input2));
                value5 && input.cutUndo?.(value5.file, callback4(value5));
                value3.parts = value4?.parts ?? [];
                delete value3.atomic;
                delete value3.bound;
                delete value3.holder;
              } else
                value3.parts = value3.parts.filter(
                  (input4?: Dynamic): Dynamic => input4.file !== input2,
                );
            return input3.filter(
              (input4?: Dynamic): Dynamic => input4.parts.length > 0,
            );
          };
        items = callback19(items, "undo");
        items2 = callback19(items2, "redo");
        callback15(items3);
        value2?.entry &&
          value2.entry.parts.length === 0 &&
          (value2.entry = null);
        callback2();
      },
      clearRedo(): Dynamic {
        let value3: Dynamic = items2;
        return value3.length === 0
          ? (): Dynamic => {}
          : ((items2 = []),
            callback2(),
            (): Dynamic => {
              items2.length > 0 || ((items2 = value3), callback2());
            });
      },
      subscribe(input2: Dynamic): Dynamic {
        values.add(input2);
        return (): Dynamic => {
          values.delete(input2);
        };
      },
    };
  }
  function createSessionHistory(input?: Dynamic): Dynamic {
    let entries: Dynamic = new Map(),
      values: Dynamic = new Set(),
      value: Dynamic,
      callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        entries.delete(input2) && input.onDrop(input2, options);
      },
      callback2: Dynamic = (items?: Dynamic, items2?: Dynamic): Dynamic =>
        items === items2.entries && items.length === items2.length,
      callback3: Dynamic = (input2?: Dynamic): Dynamic =>
        [...input2.undo, ...input2.redo].some(
          (source?: Dynamic): Dynamic =>
            typeof source != "string" && source.kind === "prop",
        ),
      callback4: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        try {
          return JSON.parse(input2 ?? "")?.[options]?.default;
        } catch {
          return;
        }
      },
      callback5: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        let value2: Dynamic = (0, runtime.getDcPropsJson)(options),
          values2: Dynamic = new Set();
        for (let value3 of [...input2.redo].reverse() as Dynamic)
          if (!(typeof value3 == "string" || value3.kind !== "prop")) {
            if (value3.before === undefined && !values2.has(value3.prop)) {
              let value4: Dynamic = callback4(value2, value3.prop);
              if (
                typeof value4 != "string" ||
                value4 !== callback4(value3.base, value3.prop)
              )
                return false;
            }
            values2.add(value3.prop);
          }
        return true;
      },
      callback6: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let state: Dynamic = options.state;
        if (!options.settled) return "unsaved";
        if (state.adoptedMerge) return "merged";
        if (
          state.dirty ||
          state.pendingScript !== undefined ||
          Object.keys(state.pendingProps ?? {}).length > 0
        )
          return "unsaved";
        try {
          if (
            !callback2(state.undo, options.undo) ||
            !callback2(state.redo, options.redo)
          )
            return "stale";
          if (context === undefined) return "changed";
          let value2: Dynamic = (0, runtime.parseDcHtmlDocument)(context);
          if (
            !value2 ||
            !(0, runtime.sameDcTemplate)(context, state.src) ||
            (callback3(state) &&
              (0, runtime.getDcPropsJson)(context) !==
                (0, runtime.getDcPropsJson)(state.src))
          )
            return "changed";
          if (!callback5(state, context)) return "stale";
          let value3: Dynamic = (0, runtime.serializeStableModel)(state);
          return value2.template === value3 ||
            state.model.rebuild(value2.template).serialize() ===
              state.model.rebuild(value3).serialize()
            ? "same"
            : "changed";
        } catch (value2: Dynamic) {
          console.warn(
            "[history-keeper] could not compare the kept history of " + input2,
            value2,
          );
          return "stale";
        }
      };
    return {
      setEpoch(input2: Dynamic): Dynamic {
        value = input2;
      },
      keep(
        input2: Dynamic,
        options: Dynamic,
        context: Dynamic,
        value2: Dynamic,
      ): Dynamic {
        if (
          entries.has(input2) ||
          values.has(input2) ||
          !input.inDocument(input2) ||
          value2 === undefined ||
          value2 !== value ||
          (options.undo.length === 0 && options.redo.length === 0) ||
          options.adoptedMerge
        )
          return false;
        let state: Dynamic = {
            state: options,
            undo: {
              entries: options.undo,
              length: options.undo.length,
            },
            redo: {
              entries: options.redo,
              length: options.redo.length,
            },
            epoch: value2,
            settled: false,
            chain: Promise.resolve(),
            loadStarted: false,
          },
          callback7: Dynamic = (): Dynamic => {
            state.settled = true;
          };
        for (
          state.chain = context.then(callback7, callback7),
            entries.set(input2, state);
          entries.size > CanvasWorkingStateLimit_4;

        ) {
          let value3: Dynamic = [...entries.keys()].find(
            (input3?: Dynamic): Dynamic =>
              input3 !== input2 && !input.isProtected(input3),
          );
          if (value3 === undefined) {
            entries.delete(input2);
            return false;
          }
          callback(value3, "cap");
        }
        return true;
      },
      decline(input2: Dynamic): Dynamic {
        let entry: Dynamic = entries.get(input2);
        if (!entry) return input.onDrop(input2, "declined");
        entry.loadStarted = false;
        entry.waitingSince = undefined;
      },
      holds: (input2?: Dynamic): Dynamic => entries.has(input2),
      heldFiles: (): Dynamic => [...entries.keys()],
      read(input2: Dynamic, options: Dynamic): Dynamic {
        let value2: Dynamic = entries.get(input2)?.state;
        return value2
          ? options === "depth"
            ? value2.undo.length
            : options === "redos"
              ? value2.redo.length
              : (value2.undoFloor ?? 0)
          : null;
      },
      peekEpoch: (input2?: Dynamic): Dynamic => entries.get(input2)?.epoch,
      settledOf: (input2?: Dynamic): Dynamic =>
        entries.get(input2)?.settled ?? false,
      whenSettled(input2: Dynamic): Dynamic {
        let entry: Dynamic = entries.get(input2);
        return entry
          ? new Promise((input3?: Dynamic): Dynamic => {
              let value2: Dynamic = setTimeout(
                (): Dynamic => input3(false),
                input.writeSettleMs ??
                  CanvasWorkingStateKEEPFILESMAXWaitsConfig.waits.writeSettleMs,
              );
              entry.chain.then((): Dynamic => {
                clearTimeout(value2);
                input3(true);
              });
            })
          : Promise.resolve(true);
      },
      check(input2: Dynamic, options: Dynamic): Dynamic {
        let entry: Dynamic = entries.get(input2);
        return entry ? callback6(input2, entry, options) : "gone";
      },
      take(input2: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        let entry: Dynamic = entries.get(input2);
        if (!entry) return null;
        let value2: Dynamic = callback6(input2, entry, options),
          value3: Dynamic =
            value2 !== "same"
              ? value2
              : context !== entry.epoch
                ? "epoch"
                : null;
        return value3 !== null
          ? (callback(input2, value3), null)
          : (entries.delete(input2),
            {
              undo: [...entry.state.undo],
              redo: [...entry.state.redo],
              undoFloor: entry.state.undoFloor ?? 0,
            });
      },
      drop: callback,
      taint(input2: Dynamic): Dynamic {
        for (let value2 of input2 as Dynamic) values.add(value2);
      },
      prune(): Dynamic {
        for (let value2 of [...entries.keys()] as Dynamic)
          input.inDocument(value2) || callback(value2, "gone");
      },
      clearAll(): Dynamic {
        for (let value2 of [...entries.keys()] as Dynamic)
          callback(value2, "session");
      },
      clearRedo(): Dynamic {
        let items: Dynamic = [],
          callback7: Dynamic = (
            input2?: Dynamic,
            items2?: Dynamic,
          ): Dynamic => {
            input2.state.redo = items2;
            input2.redo = {
              entries: items2,
              length: items2.length,
            };
          };
        for (let [value2, value3] of entries as Dynamic)
          value3.state.redo.length === 0 ||
            !callback2(value3.state.redo, value3.redo) ||
            (items.push([value2, value3, value3.state.redo]),
            callback7(value3, []));
        return (): Dynamic => {
          for (let [value2, value3, value4] of items as Dynamic)
            entries.get(value2) === value3 &&
              callback2(value3.state.redo, value3.redo) &&
              value3.state.redo.length === 0 &&
              callback7(value3, value4);
        };
      },
      noteAbsorbed(input2: Dynamic): Dynamic {
        let entry: Dynamic = entries.get(input2);
        entry && (entry.waitingSince ??= input.now());
      },
      noteLoadStart(input2: Dynamic): Dynamic {
        let entry: Dynamic = entries.get(input2);
        entry &&
          ((entry.loadStarted = true), (entry.waitingSince ??= input.now()));
      },
      loadStarted: (input2?: Dynamic): Dynamic =>
        entries.get(input2)?.loadStarted ?? false,
      waitedTooLong(input2: Dynamic): Dynamic {
        let value2: Dynamic = entries.get(input2)?.waitingSince;
        return (
          value2 !== undefined &&
          input.now() - value2 >
            CanvasWorkingStateKEEPFILESMAXWaitsConfig.waits.loadLimitMs
        );
      },
    };
  }
  function textEditHistoryEpoch(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return input
      ? {
          epoch: options ? context : undefined,
          clear: false,
        }
      : {
          epoch: undefined,
          clear: true,
        };
  }
  function createInlineHistoryBridge(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let flag: Dynamic = false,
      flag2: Dynamic = false,
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value: Dynamic = input2 === "undo" ? input.undo() : input.redo();
        value === "applied" &&
          ((flag = true),
          queueMicrotask((): Dynamic => {
            flag = false;
          }));
        return value;
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 === "undo" ? input.undoFile() : input.redoFile(),
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        if (!context.inDocument(input2)) return "gone";
        let value: Dynamic = options.check(input2, context.currentSrc(input2));
        return value === "same" ? null : value;
      },
      callback4: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
      ): Dynamic => {
        flag2 = true;
        context.afterExitGuard((): Dynamic => {
          flag2 = false;
          let value: Dynamic = context.pageOfFile(options2);
          !context.mayShowPage() ||
            context.openPage() !== context2 ||
            callback2(input2) !== options2 ||
            !options.holds(options2) ||
            value === undefined ||
            !context.inDocument(options2) ||
            (context.switchPage(
              value,
              context.isFramed(options2) ? options2 : undefined,
            ),
            context.say({
              kind: "first-press",
              dir: input2,
              file: options2,
              page: value,
            }));
        });
      },
      callback5: Dynamic = (input2?: Dynamic): Dynamic => {
        if (flag) return "applied";
        for (;;) {
          let value: Dynamic = callback2(input2);
          if (value === null || !options.holds(value)) return callback(input2);
          if (!context.inDocument(value)) {
            options.drop(value, "gone");
            input.forget(value);
            continue;
          }
          let value2: Dynamic = context.openPage();
          if (context.pageOfFile(value) === value2) {
            options.waitedTooLong(value)
              ? options.drop(value, "load")
              : (options.noteAbsorbed(value),
                context.startLoad(value),
                context.say({
                  kind: "loading",
                  dir: input2,
                  file: value,
                }));
            return "deferred";
          }
          if (flag2 || !context.mayShowPage()) return "deferred";
          let value3: Dynamic = options.settledOf(value)
            ? callback3(value)
            : null;
          if (value3 !== null) {
            options.drop(value, value3);
            for (let value4 of options.heldFiles() as Dynamic) {
              let value5: Dynamic = options.settledOf(value4)
                ? callback3(value4)
                : null;
              value5 !== null && options.drop(value4, value5);
            }
            return "deferred";
          }
          callback4(input2, value, value2);
          return "deferred";
        }
      };
    return {
      ...input,
      group(input2: Dynamic, options2: Dynamic): Dynamic {
        let items: Dynamic = [...input2];
        (items.length > 1 ||
          options2?.bound !== undefined ||
          options2?.atomic) &&
          options.taint(items);
        return input.group(items, options2);
      },
      reportPush(input2: Dynamic): Dynamic {
        options.holds(input2) || input.reportPush(input2);
      },
      undo: (): Dynamic => callback5("undo"),
      redo: (): Dynamic => callback5("redo"),
    };
  }
  function recordSessionLoadStart(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    !context ||
      input.loadStarted(options) ||
      (input.noteLoadStart(options), context());
  }
  function readHeldSessionState(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    return input.holds(context)
      ? options(context)
        ? input.read(context, value)
        : null
      : extra();
  }
  function updateTextEditHistoryCounts(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    input.counts &&
      (options === "push"
        ? ((input.redoableBeforePush = input.redoable),
          (input.applied += 1),
          (input.redoable = 0))
        : options === "revoke"
          ? input.applied > 0 &&
            ((input.applied -= 1), (input.redoable = input.redoableBeforePush))
          : options === "undo"
            ? input.applied > 0 && ((input.applied -= 1), (input.redoable += 1))
            : options === "redo"
              ? input.redoable > 0 &&
                ((input.redoable -= 1), (input.applied += 1))
              : options === "drop-undo"
                ? input.applied > 0 && (input.applied -= 1)
                : options === "clear-redo"
                  ? ((input.redoable = 0), (input.redoableBeforePush = 0))
                  : options === "drop-redo" &&
                    input.redoable > 0 &&
                    (input.redoable -= 1));
  }
  function canApplyTextEditHistory(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = null,
  ): Dynamic {
    return value !== null
      ? input.counts && value.duringTextEdit === input
      : ((context === null || context < input.applied) &&
          ((input.applied = 0),
          (input.redoable = 0),
          (input.redoableBeforePush = 0)),
        options === "undo" ? input.applied > 0 : input.redoable > 0);
  }
  function stepInlineHistory({
    blocked: blocked,
    stillOk: stillOk,
    liveUndoDepth: liveUndoDepth,
    canvasStep: canvasStep,
    textEdit: textEdit,
    pending: pending,
    dir: dir,
    step: step,
  }: Dynamic): Dynamic {
    if (!(blocked() || pending.current)) {
      if (
        textEdit === null ||
        canApplyTextEditHistory(
          textEdit,
          dir,
          liveUndoDepth(),
          canvasStep?.(dir) ?? null,
        )
      ) {
        step();
        return;
      }
      pending.current = true;
      return (async (): Promise<Dynamic> => {
        let flag: Dynamic = false;
        try {
          flag = await textEdit.commit();
        } catch (value: Dynamic) {
          console.error(
            "[design/undo] could not commit the open text edit before undo or redo; nothing was undone or redone:",
            value,
          );
        } finally {
          pending.current = false;
        }
        flag === true && !blocked() && stillOk() && step();
      })();
    }
  }
  function handleInlineUndoKey(input?: Dynamic, options?: Dynamic): Dynamic {
    if (
      !(input.metaKey || input.ctrlKey) ||
      typeof input.key != "string" ||
      input.key.toLowerCase() !== "z" ||
      input.defaultPrevented ||
      !options.editing ||
      options.filesOpen ||
      (!options.textEditOpen && !options.pending) ||
      options.targetOwnsKey()
    )
      return "ignore";
    if (options.pending) return "drop";
    let value: Dynamic = input.shiftKey ? "redo" : "undo";
    return input.repeat && options.canvasStepOnTop(value)
      ? "drop"
      : options.stepMadeDuringEdit(value)
        ? "ignore"
        : input.repeat
          ? "drop"
          : value;
  }
  function hasMultipleEditingGroups(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let length: Dynamic = Object.values(input ?? {}).filter(
      (items?: Dynamic): Dynamic => items.length > 0,
    ).length;
    return length >= 2 || (length >= 1 && options >= 1);
  }
  function sessionAllowsMutation(input?: Dynamic): Dynamic {
    return !input.gesturing && input.setMoveCommits <= 0;
  }
  function pointerDelta(input?: Dynamic, options?: Dynamic): Dynamic {
    return {
      x: input.x - options.x,
      y: input.y - options.y,
    };
  }
  function createElementMoveSessions(input?: Dynamic): Dynamic {
    let value: Dynamic = null,
      callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        if (!options.pure || options.canvas) return;
        let value4: Dynamic = (options.opened ?? Promise.resolve(true))
          .then(
            (): Dynamic =>
              input.handle(options.file)?.moveHost(input2.key, "close"),
          )
          .catch((): Dynamic => false);
        input2.closing.set(options.file, value4);
      },
      callback2: Dynamic = (event?: Dynamic): Dynamic => {
        let target: Dynamic = event.target;
        target &&
          (input.handle(target.file)?.dropPlanClear(event.key),
          callback(event, target),
          (event.target = null));
        for (let [value4, value5] of event.files as Dynamic)
          value5.started && input.handle(value4)?.moveCancel(event.key);
        event.live &&
          !event.canvasCommitted &&
          (event.canvas.files.size > 0 || event.canvas.notes.size > 0) &&
          input.canvas.cancel(event.key, event.pointerId);
        event.committed = true;
        value3 === event && (value3 = null);
        callback3(event);
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        let value4: Dynamic = input2 ?? value;
        if (!value4) return;
        let value5: Dynamic = value === value4;
        value5 && (value = null);
        value4.done = true;
        value4.off();
        clearInterval(value4.keepalive);
        for (let value6 of value4.files.values() as Dynamic)
          value6.raf && cancelAnimationFrame(value6.raf);
        input.showGhost(null);
        if (!!value5) {
          input.setGestureSource("set-move", false);
          input.setHeldCover(null);
          try {
            value4.captureEl?.releasePointerCapture(value4.pointerId);
          } catch {}
        }
      },
      callback4: Dynamic = (): Dynamic => {
        !value || value.releasing || callback2(value);
      },
      callback5: Dynamic = async (input2?: Dynamic): Promise<Dynamic> => {
        let value4: Dynamic = input.canvasPoint(
          input2.press.clientX,
          input2.press.clientY,
        );
        await Promise.all(
          [...input2.files].map(
            async ([input3, input4]: Dynamic): Promise<Dynamic> => {
              let value5: Dynamic = input.handle(input3),
                value6: Dynamic = input.origin(input3),
                value7: Dynamic =
                  "file" in input2.leader && input2.leader.file === input3,
                value8: Dynamic =
                  value7 && "tid" in input2.leader
                    ? input2.leader.tid
                    : input4.tids[0];
              if (
                !value5 ||
                !value6 ||
                !value5.isReady() ||
                value8 === undefined
              ) {
                input2.dropped.push(input3);
                return;
              }
              let value9: Dynamic = value7
                  ? pointerDelta(value4, value6)
                  : null,
                value10: Dynamic = await value5
                  .moveStart(
                    input2.key,
                    value8,
                    value9,
                    input2.last.mods,
                    input4.tids,
                  )
                  .catch((): Dynamic => null);
              if (!value10) {
                input2.dropped.push(input3);
                return;
              }
              if (input2.done) {
                value5.moveCancel(input2.key);
                return;
              }
              if (!value7 && value10.tids.length < input4.tids.length) {
                value5.moveCancel(input2.key);
                input2.dropped.push(input3);
                return;
              }
              input4.started = true;
              input4.tids = value10.tids;
              input4.members = value10.members ?? [];
              input4.anchor = value9 ?? {
                x: value10.rect.x + value10.rect.w / 2,
                y: value10.rect.y + value10.rect.h / 2,
              };
              callback9(input2);
            },
          ),
        );
      },
      callback6: Dynamic = (event?: Dynamic): Dynamic => {
        let value4: Dynamic = input.targetAt(
          event.last.clientX,
          event.last.clientY,
        );
        event.blockedTarget = value4?.blocked ? value4.file : null;
        let value5: Dynamic = value4?.blocked ? null : value4,
          value6: Dynamic = value5
            ? event.files.get(value5.file)?.started
              ? {
                  file: value5.file,
                  pure: false,
                }
              : {
                  file: value5.file,
                  pure: true,
                }
            : !value4 && event.files.size > 0 && input.piecesAllowed()
              ? {
                  file: CanvasValue,
                  pure: true,
                  canvas: true,
                }
              : null,
          target: Dynamic = event.target;
        target &&
          (!value6 || value6.file !== target.file) &&
          (target.canvas || input.handle(target.file)?.dropPlanClear(event.key),
          callback(event, target),
          (event.dropPlan = null));
        if (value6 && (!target || target.file !== value6.file)) {
          let value9: Dynamic =
            value6.pure && !value6.canvas
              ? (event.closing.get(value6.file) ?? Promise.resolve()).then(
                  (): Dynamic =>
                    input.handle(value6.file)?.moveHost(event.key, "open") ??
                    false,
                )
              : null;
          event.target = {
            ...value6,
            opened: value9,
          };
        } else value6 || (event.target = null);
        let value7: Dynamic = input.canvasPoint(
            event.last.clientX,
            event.last.clientY,
          ),
          value8: Dynamic = input.canvasPoint(
            event.press.clientX,
            event.press.clientY,
          );
        for (let [value9, value10] of event.files as Dynamic) {
          if (!value10.started) continue;
          let callback12: Dynamic = (): Dynamic => {
              let value12: Dynamic = input.origin(value9),
                value13: Dynamic = input.bounds(value9);
              if (!value12 || !value13) return true;
              let callback13: Dynamic = (
                input2?: Dynamic,
                options?: Dynamic,
              ): Dynamic =>
                input2 >= value13.x &&
                options >= value13.y &&
                input2 <= value13.x + value13.w &&
                options <= value13.y + value13.h;
              return value10.members.some((input2?: Dynamic): Dynamic => {
                let value14: Dynamic =
                    value12.x + input2.rect.x + input2.rect.w / 2,
                  value15: Dynamic =
                    value12.y + input2.rect.y + input2.rect.h / 2;
                return (
                  callback13(value14, value15) &&
                  !callback13(
                    value14 + (value7.x - value8.x),
                    value15 + (value7.y - value8.y),
                  )
                );
              });
            },
            value11: Dynamic =
              value6 != null &&
              (value6.canvas
                ? event.last.alt || callback12()
                : value6.file !== value9 || event.last.alt);
          value11 && !value10.travelling
            ? ((value10.travelling = true),
              input.handle(value9)?.moveExit(event.key))
            : !value11 &&
              value10.travelling &&
              ((value10.travelling = false),
              input.handle(value9)?.moveReturn(event.key));
        }
      },
      callback7: Dynamic = (input2?: Dynamic): Dynamic => {
        let value4: Dynamic = input.canvasPoint(
            input2.press.clientX,
            input2.press.clientY,
          ),
          items: Dynamic = [],
          items2: Dynamic = [];
        for (let [value5, value6] of input2.files as Dynamic) {
          if (!value6.travelling) continue;
          let value7: Dynamic = input.origin(value5);
          if (value7)
            for (let value8 of value6.members as Dynamic) {
              let length: Dynamic = items.length;
              items.push({
                tid: length,
                tag: value8.tag,
                w: value8.rect.w,
                h: value8.rect.h,
                dx: value7.x + value8.rect.x - value4.x,
                dy: value7.y + value8.rect.y - value4.y,
              });
              items2.push({
                file: value5,
                tid: value8.tid,
                index: length,
              });
            }
        }
        return {
          members: items,
          map: items2,
        };
      },
      callback8: Dynamic = (
        event?: Dynamic,
        options: Dynamic = false,
      ): Dynamic => {
        let target: Dynamic = event.target;
        if (!target || target.canvas) return null;
        if (event.planInFlight) {
          event.planPending = true;
          return event.planInFlight;
        }
        let { members: value4, map: value5 }: Dynamic = callback7(event);
        if (value4.length === 0) return null;
        let value6: Dynamic = input.origin(target.file),
          value7: Dynamic = input.handle(target.file);
        if (!value6 || !value7) return null;
        let state: Dynamic = {
            clientX: event.last.clientX,
            clientY: event.last.clientY,
          },
          value8: Dynamic = CanvasWorkingStateCtrl(event.last.mods),
          alt2: Dynamic = event.last.alt,
          value9: Dynamic = pointerDelta(
            input.canvasPoint(state.clientX, state.clientY),
            value6,
          );
        event.planInFlight = (target.opened ?? Promise.resolve(true))
          .then(
            (input2?: Dynamic): Dynamic =>
              input2
                ? value7.dropPlanAt(event.key, value9, value4, value8)
                : null,
          )
          .then((input2?: Dynamic): Dynamic => {
            event.target?.file === target.file &&
              (event.dropPlan = input2
                ? {
                    file: target.file,
                    plan: input2,
                    members: value5,
                    at: state,
                    mode: value8,
                    alt: alt2,
                  }
                : null);
          })
          .catch((): Dynamic => {
            event.target?.file === target.file && (event.dropPlan = null);
          })
          .finally((): Dynamic => {
            event.planInFlight = null;
            event.planPending &&
              !event.done &&
              !options &&
              !event.releasing &&
              ((event.planPending = false), callback8(event));
          });
        return event.planInFlight;
      },
      callback9: Dynamic = (event?: Dynamic): Dynamic => {
        if (event.done) return;
        callback6(event);
        let value4: Dynamic = input.canvasPoint(
            event.last.clientX,
            event.last.clientY,
          ),
          value5: Dynamic = input.canvasPoint(
            event.press.clientX,
            event.press.clientY,
          );
        for (let [value6, value7] of event.files as Dynamic) {
          if (!value7.started || !value7.anchor) continue;
          if (value7.travelling) {
            input.handle(value6)?.moveTouch(event.key);
            continue;
          }
          let state: Dynamic = {
            x: value7.anchor.x + (value4.x - value5.x),
            y: value7.anchor.y + (value4.y - value5.y),
          };
          value7.pending = {
            ...state,
            mods: event.last.mods,
          };
          !value7.raf &&
            (value7.raf = requestAnimationFrame((): Dynamic => {
              value7.raf = 0;
              let pending: Dynamic = value7.pending;
              value7.pending = null;
              !(!pending || event.done) &&
                input.handle(value6)?.moveMove(
                  event.key,
                  {
                    x: pending.x,
                    y: pending.y,
                  },
                  pending.mods,
                );
            }));
        }
        if (event.target) {
          let target: Dynamic = event.target;
          target.pure &&
            (target.opened ?? Promise.resolve(true)).then(
              (input2?: Dynamic): Dynamic => {
                input2 &&
                  event.target === target &&
                  !event.done &&
                  input.handle(target.file)?.moveTouch(event.key);
              },
            );
          callback8(event);
          let { members: value6 }: Dynamic = callback7(event);
          if (value6.length === 0) input.showGhost(null);
          else if (
            CanvasWorkingStateCtrl(event.last.mods) === "keep" ||
            event.target?.canvas
          )
            input.showGhost(
              value6.map(
                (input2?: Dynamic): Dynamic => ({
                  x: value4.x + input2.dx,
                  y: value4.y + input2.dy,
                  w: input2.w,
                  h: input2.h,
                }),
              ),
            );
          else {
            let y: Dynamic = value4.y;
            input.showGhost(
              value6.map((input2?: Dynamic): Dynamic => {
                let state: Dynamic = {
                  x: value4.x - input2.w / 2,
                  y: y,
                  w: input2.w,
                  h: input2.h,
                };
                y += input2.h + 8;
                return state;
              }),
            );
          }
        } else input.showGhost(null);
      },
      callback10: Dynamic = (input2?: Dynamic): Dynamic => {
        if (!(input2.live || input2.done)) {
          input2.live = true;
          if (input2.canvas.files.size > 0 || input2.canvas.notes.size > 0) {
            let callback12: Dynamic = (): Dynamic => {
                let [files]: Dynamic = input2.canvas.files,
                  [notes]: Dynamic = input2.canvas.notes;
                return files !== undefined
                  ? {
                      file: files,
                    }
                  : {
                      note: notes,
                    };
              },
              value4: Dynamic =
                "canvas" in input2.leader
                  ? input2.leader.canvas
                  : "file" in input2.leader
                    ? {
                        file: input2.leader.file,
                      }
                    : callback12();
            input.canvas.start(
              input2.key,
              input2.pointerId,
              value4,
              input2.canvas,
              input2.press.clientX,
              input2.press.clientY,
            );
          }
          input2.starting = (input2.armWait ?? Promise.resolve(true)).then(
            async (input3?: Dynamic): Promise<Dynamic> => {
              if (!input2.done) {
                if (!input3) {
                  callback2(input2);
                  return;
                }
                await callback5(input2);
              }
            },
          );
          input2.keepalive = (window as Dynamic).setInterval((): Dynamic => {
            input2.done || callback9(input2);
          }, 2e4);
        }
      },
      callback11: Dynamic = async (): Promise<Dynamic> => {
        if (!value) return;
        let value4: Dynamic = value;
        if (!value4.live) {
          let stillAction: Dynamic = value4.stillAction;
          callback3();
          stillAction?.();
          return;
        }
        value4.releasing = true;
        value3 = value4;
        index = Date.now();
        let value5: Dynamic = index;
        value4.offPointer();
        input.showGhost(null);
        if (input.readOnly()) {
          callback2(value4);
          return;
        }
        let value6: Dynamic =
            value4.canvas.files.size > 0 || value4.canvas.notes.size > 0,
          value7: Dynamic =
            value4.target?.canvas === true &&
            [...value4.files.values()].some(
              (input2?: Dynamic): Dynamic =>
                input2.started && input2.travelling,
            ),
          callback12: Dynamic = (): Dynamic =>
            value6
              ? input.canvas.update(
                  value4.key,
                  value4.pointerId,
                  value4.last.clientX,
                  value4.last.clientY,
                  value4.last.free,
                  true,
                  value4.key,
                  value4.last.alt,
                )
              : true,
          value8: Dynamic = value7 || value4.last.alt ? true : callback12();
        value4.canvasCommitted = true;
        value4.blockedTarget &&
          value4.files.size > 0 &&
          !value4.last.alt &&
          input.say(
            "That artboard is playing. Stop it to move elements into it.",
          );
        await value4.starting;
        if (value4.done) return;
        let value9: Dynamic = input.canvasPoint(
            value4.last.clientX,
            value4.last.clientY,
          ),
          value10: Dynamic = input.canvasPoint(
            value4.press.clientX,
            value4.press.clientY,
          ),
          entries: Dynamic = new Map(),
          items: Dynamic = [],
          target: Dynamic = value4.target;
        if (target && !target.canvas) {
          let callback14: Dynamic = (input2?: Dynamic): Dynamic =>
            input2
              ? Promise.race([
                  input2,
                  new Promise(
                    (input3?: Dynamic): Dynamic => setTimeout(input3, 1500),
                  ),
                ])
              : Promise.resolve();
          await callback14(value4.planInFlight);
          let dropPlan: Dynamic = value4.dropPlan;
          (!dropPlan ||
            dropPlan.file !== target.file ||
            dropPlan.at.clientX !== value4.last.clientX ||
            dropPlan.at.clientY !== value4.last.clientY ||
            dropPlan.mode !== CanvasWorkingStateCtrl(value4.last.mods) ||
            dropPlan.alt !== value4.last.alt) &&
            ((value4.planPending = false),
            await callback14(callback8(value4, true)));
        }
        let value11: Dynamic =
            target &&
            value4.dropPlan &&
            value4.dropPlan.file === target.file &&
            value4.dropPlan.at.clientX === value4.last.clientX &&
            value4.dropPlan.at.clientY === value4.last.clientY &&
            value4.dropPlan.mode === CanvasWorkingStateCtrl(value4.last.mods) &&
            value4.dropPlan.alt === value4.last.alt
              ? value4.dropPlan
              : null,
          value12: Dynamic = null;
        if (target && value11) {
          let entries2: Dynamic = new Map();
          for (let value15 of value11.members as Dynamic) {
            if (!value4.files.get(value15.file)?.travelling) continue;
            let value16: Dynamic = entries2.get(value15.file) ?? [];
            value16.push({
              tid: value15.tid,
              index: value15.index,
            });
            entries2.set(value15.file, value16);
          }
          entries2.size > 0 &&
            (value12 = {
              target: target.file,
              pureTarget: target.pure,
              plan: value11.plan,
              travellers: [...entries2].map(
                ([input2, input3]: Dynamic): Dynamic => ({
                  file: input2,
                  members: input3,
                }),
              ),
              endHome: (input2?: Dynamic): Dynamic =>
                input.handle(input2)?.moveCancel(value4.key),
              ...(value4.last.alt
                ? {
                    copy: true,
                  }
                : {}),
            });
        } else if (target?.canvas && value7) {
          let { members: value15, map: value16 }: Dynamic = callback7(value4),
            entries2: Dynamic = new Map();
          for (let value17 of value16 as Dynamic) {
            let value18: Dynamic = entries2.get(value17.file) ?? [];
            value18.push({
              tid: value17.tid,
              index: value17.index,
            });
            entries2.set(value17.file, value18);
          }
          value12 = {
            target: CanvasValue,
            pureTarget: true,
            plan: {
              container: null,
              landing: [],
              refused: [],
            },
            travellers: [...entries2].map(
              ([input2, input3]: Dynamic): Dynamic => ({
                file: input2,
                members: input3,
              }),
            ),
            pieces: value16.map((input2?: Dynamic): Dynamic => {
              let value17: Dynamic = value15[input2.index];
              return {
                file: input2.file,
                tid: input2.tid,
                index: input2.index,
                box: {
                  x: value9.x + value17.dx,
                  y: value9.y + value17.dy,
                  w: value17.w,
                  h: value17.h,
                },
              };
            }),
            endHome: (input2?: Dynamic): Dynamic =>
              input.handle(input2)?.moveCancel(value4.key),
            ...(value4.last.alt
              ? {
                  copy: true,
                }
              : {}),
          };
        }
        let value13: Dynamic = value4.last.alt && !value12;
        if (value13) {
          value6 && input.canvas.cancel(value4.key, value4.pointerId);
          for (let [value16, value17] of value4.files as Dynamic)
            value17.started &&
              (value17.raf &&
                (cancelAnimationFrame(value17.raf), (value17.raf = 0)),
              input.handle(value16)?.moveCancel(value4.key));
          let value15: Dynamic = value4.blockedTarget
            ? "that artboard is playing."
            : target && !target.canvas
              ? "that artboard did not answer in time; try again."
              : target
                ? "nothing could travel; try again."
                : input.piecesAllowed()
                  ? "release over an artboard or the bare canvas."
                  : "release over an artboard.";
          input.say("Nothing copied \u2014 " + value15);
          target &&
            !target.canvas &&
            (input.handle(target.file)?.dropPlanClear(value4.key),
            callback(value4, target));
          for (let value16 of value4.files.keys() as Dynamic)
            input.handle(value16)?.moveSettle();
          callback3(value4);
          value4.committed = true;
          value4.offKeys();
          value3 === value4 && (value3 = null);
          return;
        } else value4.last.alt && !value7 && (value8 = callback12());
        await Promise.all(
          [...value4.files].map(
            async ([input2, input3]: Dynamic): Promise<Dynamic> => {
              if (!input3.started || !input3.anchor) return;
              let value15: Dynamic = input.handle(input2);
              if (!value15) return;
              input3.raf &&
                (cancelAnimationFrame(input3.raf), (input3.raf = 0));
              if (input3.travelling) {
                if (
                  value12 &&
                  value12.travellers.some(
                    (input4?: Dynamic): Dynamic => input4.file === input2,
                  )
                )
                  return;
                value15.moveCancel(value4.key);
                items.push(input2);
                return;
              }
              let state: Dynamic = {
                  x: input3.anchor.x + (value9.x - value10.x),
                  y: input3.anchor.y + (value9.y - value10.y),
                },
                value16: Dynamic = await Promise.race([
                  value15
                    .moveEnd(value4.key, state, value4.last.mods, input3.tids)
                    .catch((): Dynamic => null),
                  new Promise(
                    (input4?: Dynamic): Dynamic =>
                      setTimeout((): Dynamic => input4(null), 1500),
                  ),
                ]);
              value16
                ? entries.set(input2, [value16])
                : (value15.moveCancel(value4.key), items.push(input2));
            },
          ),
        );
        callback3(value4);
        let callback13: Dynamic = (): Dynamic => {
            value4.committed ||
              ((value4.committed = true),
              value4.offKeys(),
              value3 === value4 && (value3 = null));
          },
          value14: Dynamic = setTimeout(
            callback13,
            value12
              ? CanvasWorkingStateConstant_8
              : Math.max(0, CanvasWorkingStateLimit_5 - (Date.now() - index)),
          ),
          flag: Dynamic = false;
        try {
          let value15: Dynamic = await input.commit({
            token: value4.key,
            releasedAt: value5,
            plans: entries,
            unanswered: [...items, ...value4.dropped],
            canvasMoved: value6 && !value13,
            canvasDropped: value6 && !value13 && !value8,
            copy: value4.last.alt,
            canvas: value7 ? callback12 : (): Dynamic => {},
            travel: value12,
          });
          flag =
            !!value12 &&
            !!value15 &&
            !!value15.written &&
            value15.written.includes(value12.target);
        } finally {
          clearTimeout(value14);
          callback13();
          target &&
            !target.canvas &&
            (flag && value12 && target.file === value12.target
              ? (input.handle(target.file)?.dropPlanClear(value4.key, true),
                setTimeout((): Dynamic => callback(value4, target), 150))
              : (input.handle(target.file)?.dropPlanClear(value4.key),
                callback(value4, target)));
        }
      },
      value2: Dynamic = null,
      value3: Dynamic = null,
      index: Dynamic = 0;
    return {
      active: (): Dynamic => value !== null,
      begin(input2: Dynamic): Dynamic {
        if (
          value3 &&
          !value3.committed &&
          Date.now() - index < CanvasWorkingStateLimit_5
        )
          return false;
        value && callback4();
        value2?.();
        value2 = null;
        let value4: Dynamic = randomSessionToken(),
          entries: Dynamic = new Map();
        for (let [value5, value6] of input2.files as Dynamic)
          value6.length > 0 &&
            entries.set(value5, {
              tids: [...value6],
              started: false,
              anchor: null,
              pending: null,
              raf: 0,
              members: [],
              travelling: false,
            });
        let callback12: Dynamic = (input3?: Dynamic): Dynamic => {
            if (
              !(!value || input3.pointerId !== value.pointerId) &&
              ((value.last = {
                clientX: input3.clientX,
                clientY: input3.clientY,
                mods: CanvasWorkingStateCtrlKey(input3),
                free: CanvasWorkingStateMetaKey(input3),
                alt: CanvasWorkingStateGetAltKey(input3),
              }),
              !(
                !value.live &&
                Math.hypot(
                  input3.clientX - value.press.clientX,
                  input3.clientY - value.press.clientY,
                ) < input.slopPx
              ))
            ) {
              if (input.readOnly()) {
                callback4();
                return;
              }
              callback10(value);
              (value.canvas.files.size > 0 || value.canvas.notes.size > 0) &&
                input.canvas.update(
                  value.key,
                  value.pointerId,
                  input3.clientX,
                  input3.clientY,
                  CanvasWorkingStateMetaKey(input3),
                  false,
                  undefined,
                  CanvasWorkingStateGetAltKey(input3),
                );
              callback9(value);
            }
          },
          callback13: Dynamic = (input3?: Dynamic): Dynamic => {
            if (!value || input3.pointerId !== value.pointerId) return;
            let alt2: Dynamic = value.last.alt;
            value.last = {
              clientX: input3.clientX,
              clientY: input3.clientY,
              mods: CanvasWorkingStateCtrlKey(input3),
              free: CanvasWorkingStateMetaKey(input3),
              alt: CanvasWorkingStateGetAltKey(input3),
            };
            value.live && value.last.alt !== alt2 && callback6(value);
            callback11();
          },
          callback14: Dynamic = (input3?: Dynamic): Dynamic => {
            !value || input3.pointerId !== value.pointerId || callback4();
          },
          callback15: Dynamic = (): Dynamic => {
            flag = false;
            callback4();
            callback18();
          },
          flag: Dynamic = false,
          callback16: Dynamic = (input3?: Dynamic): Dynamic =>
            (input3.metaKey || input3.ctrlKey) &&
            !input3.shiftKey &&
            input3.key.toLowerCase() === "x",
          callback17: Dynamic = (event?: Dynamic): Dynamic => {
            if (state2.releasing && !state2.committed) {
              (event.key === "Escape" ||
                event.key === "Delete" ||
                event.key === "Backspace" ||
                callback16(event) ||
                ((event.metaKey || event.ctrlKey) &&
                  (event.key === "z" ||
                    event.key === "Z" ||
                    event.key === "y"))) &&
                (event.preventDefault(),
                event.stopImmediatePropagation(),
                event.key === "Escape" && (flag = event.type === "keydown"));
              return;
            }
            if (event.key === "Escape" && event.type === "keyup") {
              flag = false;
              value || callback18();
              return;
            }
            if (event.key === "Escape" && event.type === "keydown" && flag) {
              event.preventDefault();
              event.stopImmediatePropagation();
              return;
            }
            if (value) {
              if (event.key === "Escape" && event.type === "keydown") {
                event.preventDefault();
                event.stopImmediatePropagation();
                flag = true;
                callback4();
                return;
              }
              if (
                value.live &&
                (event.key === "Delete" ||
                  event.key === "Backspace" ||
                  callback16(event))
              ) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
              }
              value.live &&
                !event.repeat &&
                (event.key === "Meta" ||
                  event.key === "Control" ||
                  event.key === "Alt" ||
                  event.key === "Shift") &&
                ((value.last = {
                  ...value.last,
                  mods: CanvasWorkingStateCtrlKey(event),
                  free: CanvasWorkingStateMetaKey(event),
                  alt: CanvasWorkingStateGetAltKey(event),
                }),
                (value.canvas.files.size > 0 || value.canvas.notes.size > 0) &&
                  input.canvas.update(
                    value.key,
                    value.pointerId,
                    value.last.clientX,
                    value.last.clientY,
                    CanvasWorkingStateMetaKey(event),
                    false,
                    undefined,
                    CanvasWorkingStateGetAltKey(event),
                  ),
                callback9(value));
            }
          },
          callback18: Dynamic = (): Dynamic => {
            (window as Dynamic).removeEventListener(
              "keydown",
              callback17,
              true,
            );
            (window as Dynamic).removeEventListener("keyup", callback17, true);
            value2 === callback18 && (value2 = null);
          };
        (window as Dynamic).addEventListener("pointermove", callback12);
        (window as Dynamic).addEventListener("pointerup", callback13);
        (window as Dynamic).addEventListener("pointercancel", callback14);
        (window as Dynamic).addEventListener("blur", callback15);
        (window as Dynamic).addEventListener("keydown", callback17, true);
        (window as Dynamic).addEventListener("keyup", callback17, true);
        let state: Dynamic = {
            clientX: input2.clientX,
            clientY: input2.clientY,
          },
          callback19: Dynamic = (): Dynamic => {
            (window as Dynamic).removeEventListener("pointermove", callback12);
            (window as Dynamic).removeEventListener("pointerup", callback13);
            (window as Dynamic).removeEventListener(
              "pointercancel",
              callback14,
            );
            (window as Dynamic).removeEventListener("blur", callback15);
          },
          state2: Dynamic = {
            key: value4,
            pointerId: input2.pointerId,
            captureEl: input2.captureEl,
            press: state,
            last: {
              clientX: input2.from?.clientX ?? input2.clientX,
              clientY: input2.from?.clientY ?? input2.clientY,
              mods: {
                alt: false,
                ctrl: false,
                meta: false,
                shift: false,
              },
              free: false,
              alt: false,
            },
            leader: input2.leader,
            files: entries,
            canvas: input2.canvas,
            live: false,
            starting: null,
            keepalive: 0,
            dropped: [],
            armWait: input2.armWait,
            stillAction: input2.stillAction,
            heldCover: input2.heldCover,
            done: false,
            releasing: false,
            canvasCommitted: false,
            committed: false,
            offPointer: callback19,
            offKeys: (): Dynamic => {
              flag ? (value2 = callback18) : callback18();
            },
            target: null,
            blockedTarget: null,
            dropPlan: null,
            closing: new Map(),
            planInFlight: null,
            planPending: false,
            off: (): Dynamic => {
              callback19();
              (state2.releasing && !state2.committed) || state2.offKeys();
            },
          };
        value = state2;
        input.claimKeyboard();
        input.setGestureSource("set-move", true);
        input.setHeldCover(input2.heldCover);
        try {
          input2.captureEl?.setPointerCapture(input2.pointerId);
        } catch {}
        input2.from &&
          Math.hypot(
            input2.from.clientX - input2.clientX,
            input2.from.clientY - input2.clientY,
          ) >= input.slopPx &&
          (callback10(value),
          (value.canvas.files.size > 0 || value.canvas.notes.size > 0) &&
            input.canvas.update(
              value.key,
              value.pointerId,
              value.last.clientX,
              value.last.clientY,
              false,
              false,
            ),
          callback9(value));
        return true;
      },
    };
  }
  function selectionAfterElementEdits(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set(input.artboards),
      entries: Dynamic = new Map(),
      flag: Dynamic = false,
      items: Dynamic = [];
    for (let [value2, value3] of context as Dynamic)
      if (values.has(value2)) {
        if (value3.length === 0) {
          items.push(value2);
          continue;
        }
        values.delete(value2);
        entries.set(value2, {
          name: extra(value2),
          tids: [...value3],
          rect: null,
          count: value3.length,
        });
        flag = true;
      }
    for (let [value2, value3] of input.elements as Dynamic) {
      let entry: Dynamic = value.get(value2);
      if (entry === "artboard") {
        values.add(value2);
        flag = true;
        continue;
      }
      if (entry == null || entry.length === 0) {
        entry != null && items.push(value2);
        entries.set(value2, value3);
        continue;
      }
      let value4: Dynamic =
        entry.length === value3.tids.length &&
        entry.every(
          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            input2 === value3.tids[options2],
        );
      entries.set(
        value2,
        value4
          ? value3
          : {
              name: value3.name ?? extra(value2),
              tids: [...entry],
              rect: null,
              count: entry.length,
            },
      );
      value4 || (flag = true);
    }
    if (!flag) return input;
    let notes: Dynamic = input.notes;
    if (options === "children") {
      for (let value2 of items as Dynamic) {
        values.delete(value2);
        entries.delete(value2);
      }
      notes = new Set();
    }
    return (0, runtime.selectionFromParts)(
      values,
      notes,
      entries,
      input.primary,
    );
  }
  function nudgeCanvasObjects(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (
      !Number.isFinite(context) ||
      !Number.isFinite(value) ||
      (context === 0 && value === 0)
    )
      return null;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        Math.max(
          -runtime.PlatformFileContentConstant_18,
          Math.min(runtime.PlatformFileContentConstant_18, Math.round(input2)),
        ),
      items: Dynamic = [],
      value2: Dynamic = input.artboards.map((input2?: Dynamic): Dynamic => {
        if (!options.files.has(input2.file)) return input2;
        let state: Dynamic = {
          x: callback(input2.x + context),
          y: callback(input2.y + value),
        };
        return state.x === input2.x && state.y === input2.y
          ? input2
          : (items.push({
              file: input2.file,
              from: {
                x: input2.x,
                y: input2.y,
              },
              to: state,
            }),
            {
              ...input2,
              ...state,
            });
      }),
      items2: Dynamic = [],
      value3: Dynamic = input.annotations?.map((input2?: Dynamic): Dynamic => {
        if (!options.notes.has(input2.id)) return input2;
        let state: Dynamic = {
          x: callback(input2.x + context),
          y: callback(input2.y + value),
        };
        return state.x === input2.x && state.y === input2.y
          ? input2
          : (items2.push({
              id: input2.id,
              from: {
                x: input2.x,
                y: input2.y,
              },
              to: state,
            }),
            (0, runtime.moveAnnotation)(input2, state.x, state.y));
      });
    return items.length === 0 && items2.length === 0
      ? null
      : {
          moves: items,
          anns: items2,
          manifest: {
            ...input,
            artboards: value2,
            ...(value3
              ? {
                  annotations: value3,
                }
              : {}),
          },
        };
  }
  function boardSelectionKey(input?: Dynamic): Dynamic {
    return (
      [...input.files].sort().join(`
`) +
      `

` +
      [...input.notes].sort().join(`
`)
    );
  }
  function selectionNavigationScope(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return options
      ? "panel"
      : input.elements.size === 0 ||
          input.artboards.size > 0 ||
          input.notes.size > 0
        ? "canvas"
        : "siblings";
  }
  function canNavigateSelection(input?: Dynamic): Dynamic {
    return !input.gesturing && input.setMoveCommits <= 0;
  }
  function sameSelectionStructure(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.canvasBoardSelection)(input),
      value2: Dynamic = (0, runtime.canvasBoardSelection)(options);
    return (
      options.elements.size === input.elements.size &&
      [...options.elements.keys()].every(
        (input2?: Dynamic): Dynamic => input.elements.has(input2),
      ) &&
      value2.files.size === value.files.size &&
      [...value2.files].every(
        (input2?: Dynamic): Dynamic => value.files.has(input2),
      ) &&
      value2.notes.size === value.notes.size &&
      [...value2.notes].every(
        (input2?: Dynamic): Dynamic => value.notes.has(input2),
      )
    );
  }
  function sameSelectedObjectFiles(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        new Set([...input2.artboards, ...input2.elements.keys()]),
      value: Dynamic = callback(input),
      value2: Dynamic = callback(options);
    return (
      value2.size === value.size &&
      [...value2].every((input2?: Dynamic): Dynamic => value.has(input2)) &&
      options.notes.size === input.notes.size &&
      [...options.notes].every(
        (input2?: Dynamic): Dynamic => input.notes.has(input2),
      )
    );
  }
  function keyboardNudgeDelta(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options ? 10 : 1;
    switch (input) {
      case "ArrowLeft":
        return {
          dx: -value,
          dy: 0,
        };
      case "ArrowRight":
        return {
          dx: value,
          dy: 0,
        };
      case "ArrowUp":
        return {
          dx: 0,
          dy: -value,
        };
      case "ArrowDown":
        return {
          dx: 0,
          dy: value,
        };
      default:
        return null;
    }
  }
  function activeDesignColorTokens(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set(
        options.map((input2?: Dynamic): Dynamic => input2.selector),
      ),
      entries: Dynamic = new Map(),
      values2: Dynamic = new Set();
    for (let value of input as Dynamic) {
      let value2: Dynamic = context !== undefined && value.scope === context,
        value3: Dynamic = value.scope === undefined || !values.has(value.scope);
      (!value2 && !value3) ||
        ((value2 || !values2.has(value.name)) && entries.set(value.name, value),
        value2 && values2.add(value.name));
    }
    return [...entries.values()];
  }
  function cssVariableValue(name?: Dynamic): Dynamic {
    return `var(${name.startsWith("--") ? name : `--${name}`})`;
  }
  function cssVariableName(value?: Dynamic): Dynamic {
    return value?.match(/^var\(\s*(--[\w-]+)\s*\)$/)?.[1] ?? null;
  }
  bindRuntimeValue(
    runtime,
    "Value_5",
    () => Value_5,
    (value) => {
      Value_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateConstant",
    () => CanvasWorkingStateConstant,
    (value) => {
      CanvasWorkingStateConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateConstant_2",
    () => CanvasWorkingStateConstant_2,
    (value) => {
      CanvasWorkingStateConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createCanvasWorkingState",
    () => createCanvasWorkingState,
  );
  bindRuntimeValue(
    runtime,
    "subscribeRemoteDocumentUpdates",
    () => subscribeRemoteDocumentUpdates,
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateRegistry",
    () => CanvasWorkingStateRegistry,
    (value) => {
      CanvasWorkingStateRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useCanvasWorkingState",
    () => useCanvasWorkingState,
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateFloorValue",
    () => CanvasWorkingStateFloorValue,
    (value) => {
      CanvasWorkingStateFloorValue = value;
    },
  );
  bindRuntimeValue(runtime, "isSvgFile", () => isSvgFile);
  bindRuntimeValue(
    runtime,
    "imageHeaderDimensions",
    () => imageHeaderDimensions,
  );
  bindRuntimeValue(
    runtime,
    "pngPhysicalDimensions",
    () => pngPhysicalDimensions,
  );
  bindRuntimeValue(
    runtime,
    "rasterImageDimensions",
    () => rasterImageDimensions,
  );
  bindRuntimeValue(
    runtime,
    "parseRasterHeaderDimensions",
    () => parseRasterHeaderDimensions,
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateLimit",
    () => CanvasWorkingStateLimit,
    (value) => {
      CanvasWorkingStateLimit = value;
    },
  );
  bindRuntimeValue(runtime, "validImageDimensions", () => validImageDimensions);
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStatePxPtPcConfig",
    () => CanvasWorkingStatePxPtPcConfig,
    (value) => {
      CanvasWorkingStatePxPtPcConfig = value;
    },
  );
  bindRuntimeValue(runtime, "svgLengthToPixels", () => svgLengthToPixels);
  bindRuntimeValue(runtime, "svgAttributeValue", () => svgAttributeValue);
  bindRuntimeValue(runtime, "svgHeaderDimensions", () => svgHeaderDimensions);
  bindRuntimeValue(runtime, "jpegHeaderDimensions", () => jpegHeaderDimensions);
  bindRuntimeValue(runtime, "exifImageOrientation", () => exifImageOrientation);
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateItems",
    () => CanvasWorkingStateItems,
    (value) => {
      CanvasWorkingStateItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateCache",
    () => CanvasWorkingStateCache,
    (value) => {
      CanvasWorkingStateCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateSubscribers",
    () => CanvasWorkingStateSubscribers,
    (value) => {
      CanvasWorkingStateSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateMapValue",
    () => CanvasWorkingStateMapValue,
    (value) => {
      CanvasWorkingStateMapValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateConstant_3",
    () => CanvasWorkingStateConstant_3,
    (value) => {
      CanvasWorkingStateConstant_3 = value;
    },
  );
  bindRuntimeValue(runtime, "notifyDropGhosts", () => notifyDropGhosts);
  bindRuntimeValue(runtime, "removeDropGhost", () => removeDropGhost);
  bindRuntimeValue(runtime, "createDropGhost", () => createDropGhost);
  bindRuntimeValue(
    runtime,
    "updateDropGhostDemand",
    () => updateDropGhostDemand,
  );
  bindRuntimeValue(
    runtime,
    "uploadingAnimationDelay",
    () => uploadingAnimationDelay,
  );
  bindRuntimeValue(runtime, "getDropGhosts", () => getDropGhosts);
  bindRuntimeValue(runtime, "subscribeDropGhosts", () => subscribeDropGhosts);
  bindRuntimeValue(runtime, "afterNextPaint", () => afterNextPaint);
  bindRuntimeValue(runtime, "afterRendering", () => afterRendering);
  bindRuntimeValue(runtime, "markDropPerformance", () => markDropPerformance);
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateHtml",
    () => CanvasWorkingStateHtml,
    (value) => {
      CanvasWorkingStateHtml = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imagePreviewWorker",
    () => imagePreviewWorker,
    (value) => {
      imagePreviewWorker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imagePreviewWorkerUnavailable",
    () => imagePreviewWorkerUnavailable,
    (value) => {
      imagePreviewWorkerUnavailable = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateItems_2",
    () => CanvasWorkingStateItems_2,
    (value) => {
      CanvasWorkingStateItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateJobState",
    () => CanvasWorkingStateJobState,
    (value) => {
      CanvasWorkingStateJobState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateDelayMs",
    () => CanvasWorkingStateDelayMs,
    (value) => {
      CanvasWorkingStateDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imagePreviewWorkerDeadline",
    () => imagePreviewWorkerDeadline,
    (value) => {
      imagePreviewWorkerDeadline = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stopImagePreviewWorker",
    () => stopImagePreviewWorker,
  );
  bindRuntimeValue(
    runtime,
    "runNextImagePreviewJob",
    () => runNextImagePreviewJob,
  );
  bindRuntimeValue(runtime, "previewImageInWorker", () => previewImageInWorker);
  bindRuntimeValue(runtime, "encodeImagePreview", () => encodeImagePreview);
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateConstant_4",
    () => CanvasWorkingStateConstant_4,
    (value) => {
      CanvasWorkingStateConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateLimit_2",
    () => CanvasWorkingStateLimit_2,
    (value) => {
      CanvasWorkingStateLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imagePreviewDecodeWidth",
    () => imagePreviewDecodeWidth,
  );
  bindRuntimeValue(
    runtime,
    "reconcileImageDimensions",
    () => reconcileImageDimensions,
  );
  bindRuntimeValue(runtime, "previewImageFile", () => previewImageFile);
  bindRuntimeValue(runtime, "decodeRasterPreview", () => decodeRasterPreview);
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateOnload",
    () => CanvasWorkingStateOnload,
    (value) => {
      CanvasWorkingStateOnload = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeOffscreenPreview",
    () => encodeOffscreenPreview,
  );
  bindRuntimeValue(runtime, "encodeCanvasPreview", () => encodeCanvasPreview);
  bindRuntimeValue(runtime, "previewSvgFile", () => previewSvgFile);
  bindRuntimeValue(
    runtime,
    "writeVersionedProjectFile",
    () => writeVersionedProjectFile,
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateAlias",
    () => CanvasWorkingStateAlias,
    (value) => {
      CanvasWorkingStateAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "filePublishInProgress",
    () => filePublishInProgress,
    (value) => {
      filePublishInProgress = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setFilePublishHandler",
    () => setFilePublishHandler,
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateDataImagePattern",
    () => CanvasWorkingStateDataImagePattern,
    (value) => {
      CanvasWorkingStateDataImagePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateResolvedValue",
    () => CanvasWorkingStateResolvedValue,
    (value) => {
      CanvasWorkingStateResolvedValue = value;
    },
  );
  bindRuntimeValue(runtime, "uploadDesignFile", () => uploadDesignFile);
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateWidth",
    () => CanvasWorkingStateWidth,
    (value) => {
      CanvasWorkingStateWidth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateReplace",
    () => CanvasWorkingStateReplace,
    (value) => {
      CanvasWorkingStateReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateHandler",
    () => CanvasWorkingStateHandler,
    (value) => {
      CanvasWorkingStateHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateConstant_5",
    () => CanvasWorkingStateConstant_5,
    (value) => {
      CanvasWorkingStateConstant_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateQuotaOrStateRateLimitedStoreUnavailableSet",
    () => CanvasWorkingStateQuotaOrStateRateLimitedStoreUnavailableSet,
    (value) => {
      CanvasWorkingStateQuotaOrStateRateLimitedStoreUnavailableSet = value;
    },
  );
  bindRuntimeValue(runtime, "uploadDesignVideo", () => uploadDesignVideo);
  bindRuntimeValue(runtime, "positionedVideoHtml", () => positionedVideoHtml);
  bindRuntimeValue(runtime, "videoFileTitle", () => videoFileTitle);
  bindRuntimeValue(
    runtime,
    "uploadedVideoAnnotation",
    () => uploadedVideoAnnotation,
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateJoin",
    () => CanvasWorkingStateJoin,
    (value) => {
      CanvasWorkingStateJoin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStatePrint",
    () => CanvasWorkingStatePrint,
    (value) => {
      CanvasWorkingStatePrint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BoxcancelValue",
    () => BoxcancelValue,
    (value) => {
      BoxcancelValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSessionCancelMessage",
    () => isSessionCancelMessage,
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateLimit_3",
    () => CanvasWorkingStateLimit_3,
    (value) => {
      CanvasWorkingStateLimit_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reduceSessionCancellation",
    () => reduceSessionCancellation,
  );
  bindRuntimeValue(runtime, "randomSessionToken", () => randomSessionToken);
  bindRuntimeValue(
    runtime,
    "createEditSessionManager",
    () => createEditSessionManager,
  );
  bindRuntimeValue(
    runtime,
    "reactCanvasWorkingState",
    () => reactCanvasWorkingState,
    (value) => {
      reactCanvasWorkingState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateLimit_4",
    () => CanvasWorkingStateLimit_4,
    (value) => {
      CanvasWorkingStateLimit_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateConstant_6",
    () => CanvasWorkingStateConstant_6,
    (value) => {
      CanvasWorkingStateConstant_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateConstant_7",
    () => CanvasWorkingStateConstant_7,
    (value) => {
      CanvasWorkingStateConstant_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateKEEPFILESMAXWaitsConfig",
    () => CanvasWorkingStateKEEPFILESMAXWaitsConfig,
    (value) => {
      CanvasWorkingStateKEEPFILESMAXWaitsConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateChangedStaleUnsavedSet",
    () => CanvasWorkingStateChangedStaleUnsavedSet,
    (value) => {
      CanvasWorkingStateChangedStaleUnsavedSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateHas",
    () => CanvasWorkingStateHas,
    (value) => {
      CanvasWorkingStateHas = value;
    },
  );
  bindRuntimeValue(runtime, "createSessionHistory", () => createSessionHistory);
  bindRuntimeValue(runtime, "textEditHistoryEpoch", () => textEditHistoryEpoch);
  bindRuntimeValue(
    runtime,
    "createInlineHistoryBridge",
    () => createInlineHistoryBridge,
  );
  bindRuntimeValue(
    runtime,
    "recordSessionLoadStart",
    () => recordSessionLoadStart,
  );
  bindRuntimeValue(runtime, "readHeldSessionState", () => readHeldSessionState);
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateContext",
    () => CanvasWorkingStateContext,
    (value) => {
      CanvasWorkingStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateHandler_2",
    () => CanvasWorkingStateHandler_2,
    (value) => {
      CanvasWorkingStateHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateTextEditHistoryCounts",
    () => updateTextEditHistoryCounts,
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateAddDeletePageAddConfig",
    () => CanvasWorkingStateAddDeletePageAddConfig,
    (value) => {
      CanvasWorkingStateAddDeletePageAddConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateHandler_3",
    () => CanvasWorkingStateHandler_3,
    (value) => {
      CanvasWorkingStateHandler_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canApplyTextEditHistory",
    () => canApplyTextEditHistory,
  );
  bindRuntimeValue(runtime, "stepInlineHistory", () => stepInlineHistory);
  bindRuntimeValue(runtime, "handleInlineUndoKey", () => handleInlineUndoKey);
  bindRuntimeValue(
    runtime,
    "hasMultipleEditingGroups",
    () => hasMultipleEditingGroups,
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateLimit_5",
    () => CanvasWorkingStateLimit_5,
    (value) => {
      CanvasWorkingStateLimit_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateConstant_8",
    () => CanvasWorkingStateConstant_8,
    (value) => {
      CanvasWorkingStateConstant_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasValue",
    () => CanvasValue,
    (value) => {
      CanvasValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sessionAllowsMutation",
    () => sessionAllowsMutation,
  );
  bindRuntimeValue(runtime, "pointerDelta", () => pointerDelta);
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateCtrlKey",
    () => CanvasWorkingStateCtrlKey,
    (value) => {
      CanvasWorkingStateCtrlKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateGetAltKey",
    () => CanvasWorkingStateGetAltKey,
    (value) => {
      CanvasWorkingStateGetAltKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateCtrl",
    () => CanvasWorkingStateCtrl,
    (value) => {
      CanvasWorkingStateCtrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingStateMetaKey",
    () => CanvasWorkingStateMetaKey,
    (value) => {
      CanvasWorkingStateMetaKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createElementMoveSessions",
    () => createElementMoveSessions,
  );
  bindRuntimeValue(
    runtime,
    "selectionAfterElementEdits",
    () => selectionAfterElementEdits,
  );
  bindRuntimeValue(runtime, "nudgeCanvasObjects", () => nudgeCanvasObjects);
  bindRuntimeValue(runtime, "boardSelectionKey", () => boardSelectionKey);
  bindRuntimeValue(
    runtime,
    "selectionNavigationScope",
    () => selectionNavigationScope,
  );
  bindRuntimeValue(runtime, "canNavigateSelection", () => canNavigateSelection);
  bindRuntimeValue(
    runtime,
    "sameSelectionStructure",
    () => sameSelectionStructure,
  );
  bindRuntimeValue(
    runtime,
    "sameSelectedObjectFiles",
    () => sameSelectedObjectFiles,
  );
  bindRuntimeValue(runtime, "keyboardNudgeDelta", () => keyboardNudgeDelta);
  bindRuntimeValue(
    runtime,
    "activeDesignColorTokens",
    () => activeDesignColorTokens,
  );
  bindRuntimeValue(runtime, "cssVariableValue", () => cssVariableValue);
  bindRuntimeValue(runtime, "cssVariableName", () => cssVariableName);
  return () => {
    Value_5 = "\0";
    CanvasWorkingStateConstant = 2e3;
    CanvasWorkingStateConstant_2 = 500;
    CanvasWorkingStateRegistry = {};
    CanvasWorkingStateFloorValue = Math.floor(1572864);
    CanvasWorkingStateLimit = 65535;
    CanvasWorkingStatePxPtPcConfig = {
      "": 1,
      px: 1,
      pt: 96 / 72,
      pc: 16,
      in: 96,
      cm: 96 / 2.54,
      mm: 96 / 25.4,
      q: 96 / 101.6,
    };
    CanvasWorkingStateItems = [];
    CanvasWorkingStateCache = new Map();
    CanvasWorkingStateSubscribers = new Set();
    CanvasWorkingStateMapValue = [];
    CanvasWorkingStateConstant_3 = 0;
    CanvasWorkingStateHtml = `self.onmessage = async function (e) {
  var d = e.data, bm = null;
  try {
    bm = await createImageBitmap(d.file, d.width > 0 ? { resizeWidth: d.width, resizeQuality: 'medium' } : undefined);
    var k = Math.max(1, Math.ceil(Math.max(bm.width, bm.height) / d.edge));
    var w = Math.max(1, Math.round(bm.width / k)), h = Math.max(1, Math.round(bm.height / k));
    var encode = async function (cw, ch, q) {
      var c = new OffscreenCanvas(cw, ch);
      c.getContext('2d').drawImage(bm, 0, 0, cw, ch);
      var b = await c.convertToBlob({ type: 'image/webp', quality: q });
      return b.type === 'image/webp' ? new FileReaderSync().readAsDataURL(b) : null;
    };
    var url = null;
    for (var q = 0.8; q > 0.25 && url === null; q -= 0.1) {
      var u = await encode(w, h, q);
      if (u === null) { self.postMessage({ unavailable: true }); return; }
      if (u.length <= d.maxChars) url = u;
    }
    if (url === null) { var s = await encode(w >> 1 || 1, h >> 1 || 1, 0.3); if (s !== null && s.length <= d.maxChars) url = s; }
    self.postMessage({ url: url, width: bm.width, height: bm.height });
  } catch (err) {
    self.postMessage({ threw: true });
  } finally {
    if (bm) bm.close();
  }
};`;
    imagePreviewWorker = null;
    imagePreviewWorkerUnavailable = false;
    CanvasWorkingStateItems_2 = [];
    CanvasWorkingStateJobState = null;
    CanvasWorkingStateDelayMs = 12e3;
    CanvasWorkingStateConstant_4 = 1600;
    CanvasWorkingStateLimit_2 = 4e5;
    CanvasWorkingStateOnload = (input?: Dynamic): Dynamic =>
      new Promise((input2?: Dynamic, options?: Dynamic): Dynamic => {
        let value: Dynamic = new FileReader();
        value.onload = (): Dynamic => input2(String(value.result));
        value.onerror = (): Dynamic =>
          options(value.error ?? new Error("could not read the preview"));
        value.readAsDataURL(input);
      });
    CanvasWorkingStateAlias = null;
    filePublishInProgress = false;
    CanvasWorkingStateDataImagePattern = /^data:image\/([a-z0-9.+-]+);base64,/i;
    CanvasWorkingStateResolvedValue = 512 * 1024;
    CanvasWorkingStateWidth = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
      extra?: Dynamic,
    ): Dynamic =>
      options && options.width > 0 && options.height > 0
        ? Math.min(
            extra,
            Math.max(
              value,
              Math.round((input * options.height) / options.width),
            ),
          )
        : context;
    CanvasWorkingStateReplace = (input?: Dynamic): Dynamic =>
      input
        .replace("so videos can't be added", "so the video can't be replaced")
        .replace("so it wasn't added", "so the video wasn't replaced")
        .replace("videos can be added", "videos can be used")
        .replace(
          "No more uploads can be added",
          "No more files can be uploaded",
        )
        .replace("can't be added", "can't be used");
    CanvasWorkingStateHandler = (input?: Dynamic): Dynamic =>
      `A slide deck can't take videos yet. Add the video to another ${input}.`;
    CanvasWorkingStateConstant_5 = 4;
    CanvasWorkingStateQuotaOrStateRateLimitedStoreUnavailableSet = new Set([
      "quota_or_state",
      "rate_limited",
      "store_unavailable",
      "unavailable",
      "not_granted",
      "capability_disabled",
      "capability_removed",
    ]);
    CanvasWorkingStateJoin = (input?: Dynamic): Dynamic =>
      [input.name, input.size, input.lastModified].join("|");
    CanvasWorkingStatePrint = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic =>
      input !== undefined &&
      input.print === options &&
      input.src === context.src &&
      input.video === context.video;
    BoxcancelValue = "boxcancel:";
    CanvasWorkingStateLimit_3 = 1e4;
    reactCanvasWorkingState = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    CanvasWorkingStateLimit_4 = 24;
    CanvasWorkingStateConstant_6 = 3e3;
    CanvasWorkingStateConstant_7 = 5e3;
    CanvasWorkingStateKEEPFILESMAXWaitsConfig = {
      KEEP_FILES_MAX: CanvasWorkingStateLimit_4,
      waits: {
        writeSettleMs: CanvasWorkingStateConstant_6,
        loadLimitMs: CanvasWorkingStateConstant_7,
      },
    };
    CanvasWorkingStateChangedStaleUnsavedSet = new Set([
      "changed",
      "stale",
      "unsaved",
      "merged",
      "load",
      "cap",
    ]);
    CanvasWorkingStateHas = (input?: Dynamic): Dynamic =>
      CanvasWorkingStateChangedStaleUnsavedSet.has(input);
    CanvasWorkingStateContext = (0, reactCanvasWorkingState.createContext)(
      null,
    );
    CanvasWorkingStateHandler_2 = (
      input?: Dynamic,
      options: Dynamic = true,
    ): Dynamic => ({
      commit: input,
      counts: options,
      applied: 0,
      redoable: 0,
      redoableBeforePush: 0,
    });
    CanvasWorkingStateAddDeletePageAddConfig = {
      add: false,
      delete: false,
      "page-add": false,
      move: true,
      order: true,
      rename: true,
      print: true,
      paper: true,
      cover: true,
      guides: true,
      radius: true,
      resize: true,
      transform: true,
      tweak: true,
      "page-rename": true,
      "ann-add": true,
      "ann-delete": true,
      "ann-move": true,
      "ann-resize": true,
      "ann-text": true,
      "ann-style": true,
      "ann-box": true,
      "ann-path": true,
      "ann-color": true,
      "ann-css": true,
      "ann-src": true,
      "ann-crop": true,
      "ann-heads": true,
    };
    CanvasWorkingStateHandler_3 = (input?: Dynamic): Dynamic =>
      CanvasWorkingStateAddDeletePageAddConfig[input];
    CanvasWorkingStateLimit_5 = 5e3;
    CanvasWorkingStateConstant_8 = 3e4;
    CanvasValue = "<canvas>";
    CanvasWorkingStateCtrlKey = (input?: Dynamic): Dynamic => ({
      alt: false,
      ctrl: input.ctrlKey,
      meta: input.metaKey,
      shift: input.shiftKey,
    });
    CanvasWorkingStateGetAltKey = (input?: Dynamic): Dynamic => input.altKey;
    CanvasWorkingStateCtrl = (input?: Dynamic): Dynamic =>
      input.ctrl ? "keep" : "flow";
    CanvasWorkingStateMetaKey = (input?: Dynamic): Dynamic =>
      input.metaKey || input.ctrlKey;
  };
}
