/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardState(
  runtime: RuntimeBindings,
): () => void {
  var DesignElementsKey: Dynamic;
  var DesignArtboardsKey: Dynamic;
  var ClipboardStateResolvedValue: Dynamic;
  var ClipboardStateIsArray: Dynamic;
  var ClipboardStateHandler: Dynamic;
  var ClipboardStateCurrentState: Dynamic;
  var ClipboardStateConstant: Dynamic;
  var ClipboardStateAlias: Dynamic;
  var ClipboardStateResolvedValue_2: Dynamic;
  var ClipboardStateSliceValue: Dynamic;
  var ClipboardStateFilterValue: Dynamic;
  var ClipboardStateConstant_2: Dynamic;
  var localClipboardSequence: Dynamic;
  var ClipboardStateFilterValue_2: Dynamic;
  var ClipboardStateDelayMs: Dynamic;
  var ClipboardStateObservedElements: Dynamic;
  var ClipboardStateLimit: Dynamic;
  var hasPendingClipboardMarks: Dynamic;
  var ClipboardStateConstant_3: Dynamic;
  var ClipboardStateLimit_2: Dynamic;
  var ClipboardStateAlias_2: Dynamic;
  var ClipboardStateAlias_3: Dynamic;
  var ClipboardStateNowValue: Dynamic;
  var ClipboardStateResolvedValue_3: Dynamic;
  var ClipboardStateResolvedValue_4: Dynamic;
  var ClipboardStateReplace: Dynamic;
  function clipboardObjectStamp(input?: Dynamic): Dynamic {
    if (input?.kind !== DesignElementsKey && input?.kind !== DesignArtboardsKey)
      return null;
    let value: Dynamic = input.data?.stamp;
    return typeof value == "string" && value.length > 0 && value.length <= 64
      ? value
      : null;
  }
  function readBoundedClipboardObject(input?: Dynamic): Dynamic {
    return (input.clipboardData?.getData("text/html") ?? "").length >
      ClipboardStateResolvedValue
      ? undefined
      : (0, runtime.readClipboardObject)(input);
  }
  function readArtboardClipboard(input?: Dynamic): Dynamic {
    if (input?.kind !== DesignArtboardsKey) return;
    let data: Dynamic = input.data;
    return ClipboardStateIsArray(data) ||
      (Array.isArray(data?.annotations) && data.annotations.length > 0) ||
      ClipboardStateHandler(data?.leftOut) > 0 ||
      ClipboardStateHandler(data?.stayed) > 0
      ? data
      : undefined;
  }
  function expireClipboardMarks(input?: Dynamic): Dynamic {
    ClipboardStateFilterValue = ClipboardStateFilterValue.filter(
      (input2?: Dynamic): Dynamic =>
        input2.droppedAt > 0
          ? input - input2.droppedAt < ClipboardStateLimit
          : input - input2.at < ClipboardStateLimit_2,
    );
    runDeferredClipboardTasks();
  }
  function runDeferredClipboardTasks(): Dynamic {
    let value: Dynamic = ClipboardStateFilterValue_2.filter(
      (input?: Dynamic): Dynamic => !hasPendingClipboardMarks(input.until),
    );
    if (value.length !== 0) {
      ClipboardStateFilterValue_2 = ClipboardStateFilterValue_2.filter(
        (input?: Dynamic): Dynamic => !value.includes(input),
      );
      for (let value2 of value as Dynamic) {
        clearTimeout(value2.timer);
        setTimeout(value2.run, 0);
      }
    }
  }
  function afterClipboardSettled(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = ClipboardStateConstant_2;
    if (!hasPendingClipboardMarks(value)) return input();
    let state: Dynamic = {
      until: value,
      run: input,
      timer: setTimeout((): Dynamic => {
        ClipboardStateFilterValue_2 = ClipboardStateFilterValue_2.filter(
          (input2?: Dynamic): Dynamic => input2 !== state,
        );
        options?.();
      }, ClipboardStateDelayMs),
    };
    ClipboardStateFilterValue_2.push(state);
  }
  function isClipboardSettling(): Dynamic {
    return hasPendingClipboardMarks(ClipboardStateConstant_2);
  }
  function markConsumedClipboardStamp(input?: Dynamic): Dynamic {
    ClipboardStateObservedElements.add(input);
  }
  function isClipboardStampConsumed(input?: Dynamic): Dynamic {
    return ClipboardStateObservedElements.has(input);
  }
  function clipboardGeneration(): Dynamic {
    return ClipboardStateConstant_3;
  }
  function clearClipboardStamps(): Dynamic {
    for (let value of [
      ClipboardStateAlias,
      ClipboardStateResolvedValue_3,
    ] as Dynamic)
      value &&
        (ClipboardStateSliceValue = [value, ...ClipboardStateSliceValue].slice(
          0,
          8,
        ));
    ClipboardStateAlias = null;
    ClipboardStateResolvedValue_2 = null;
    ClipboardStateResolvedValue_3 = null;
    ClipboardStateResolvedValue_4 = null;
  }
  function getElementClipboard(): Dynamic {
    return ClipboardStateCurrentState;
  }
  function setElementClipboard(input?: Dynamic, options?: Dynamic): Dynamic {
    ClipboardStateConstant_3++;
    clearClipboardStamps();
    localClipboardSequence = ++ClipboardStateConstant_2;
    ClipboardStateCurrentState = input;
    ClipboardStateAlias = options?.stamp ?? null;
    ClipboardStateResolvedValue_2 =
      ClipboardStateAlias != null && options?.rendition
        ? options.rendition
        : null;
    ClipboardStateConstant =
      options?.inTabOnly && ClipboardStateAlias == null ? Date.now() : 0;
    ClipboardStateAlias_2 = null;
    ClipboardStateAlias_3 = [];
  }
  function markLocalElementClipboard(input?: Dynamic): Dynamic {
    ClipboardStateCurrentState === input &&
      (ClipboardStateConstant = Date.now());
  }
  function rememberClipboardStamp(input?: Dynamic): Dynamic {
    input &&
      (ClipboardStateSliceValue = [input, ...ClipboardStateSliceValue].slice(
        0,
        8,
      ));
  }
  function mirrorArtboardClipboardStamp(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = Date.now(),
  ): Dynamic {
    ClipboardStateAlias_2 == null ||
      ClipboardStateResolvedValue_3 != null ||
      context - ClipboardStateNowValue > 2e3 ||
      ((ClipboardStateResolvedValue_3 = input),
      (ClipboardStateResolvedValue_4 = options || null));
  }
  function claimClipboardMark(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = Date.now(),
  ): Dynamic {
    expireClipboardMarks(context);
    let value: Dynamic =
        ClipboardStateCurrentState != null &&
        ClipboardStateConstant !== 0 &&
        context - ClipboardStateConstant <= 2e3,
      value2: Dynamic = ClipboardStateFilterValue.find(
        (input2?: Dynamic): Dynamic => input2.mark == null && input2.markable,
      ),
      value3: Dynamic =
        value2 && !(value && localClipboardSequence > value2.seq)
          ? value2
          : undefined;
    value2 &&
      !value3 &&
      value2.droppedAt > 0 &&
      (ClipboardStateFilterValue = ClipboardStateFilterValue.filter(
        (input2?: Dynamic): Dynamic => input2 !== value2,
      ));
    return value3 && value3.droppedAt > 0
      ? ((ClipboardStateFilterValue = ClipboardStateFilterValue.filter(
          (input2?: Dynamic): Dynamic => input2 !== value3,
        )),
        rememberClipboardStamp(input),
        false)
      : value3
        ? ((value3.mark = {
            stamp: input,
            rendition: options || null,
          }),
          true)
        : value
          ? ((ClipboardStateAlias = input),
            (ClipboardStateResolvedValue_2 = options || null),
            (ClipboardStateConstant = 0),
            true)
          : false;
  }
  function startClipboardMark(input?: Dynamic): Dynamic {
    let state: Dynamic = {
      at: Date.now(),
      seq: ++ClipboardStateConstant_2,
      mark: null,
      droppedAt: 0,
      markable: input?.markable ?? true,
    };
    ClipboardStateConstant_3++;
    expireClipboardMarks(state.at);
    ClipboardStateFilterValue = ClipboardStateFilterValue.filter(
      (input2?: Dynamic): Dynamic => input2.droppedAt === 0,
    );
    ClipboardStateFilterValue.push(state);
    return {
      write: (input2?: Dynamic): Dynamic => {
        ClipboardStateFilterValue = ClipboardStateFilterValue.filter(
          (input3?: Dynamic): Dynamic => input3 !== state,
        );
        setElementClipboard(input2, {
          inTabOnly: true,
          stamp: state.mark?.stamp,
          rendition: state.mark?.rendition,
        });
        runDeferredClipboardTasks();
      },
      drop: (): Dynamic => {
        state.mark == null && state.markable
          ? (state.droppedAt = Date.now())
          : ((ClipboardStateFilterValue = ClipboardStateFilterValue.filter(
              (input2?: Dynamic): Dynamic => input2 !== state,
            )),
            rememberClipboardStamp(state.mark?.stamp));
        runDeferredClipboardTasks();
      },
    };
  }
  function sameClipboardText(input?: Dynamic, options?: Dynamic): Dynamic {
    return (
      options != null &&
      options !== "" &&
      ClipboardStateReplace(input) === ClipboardStateReplace(options)
    );
  }
  function resolveClipboardSource(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.stamp == null && !options.hasImage,
      value2: Dynamic =
        options.stamp != null &&
        (input.supersededStamps ?? []).includes(options.stamp),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        context - input2 < ClipboardStateLimit_2;
    return input.artboardClip
      ? (options.stamp != null && options.stamp === input.artboardClipStamp) ||
        (value &&
          sameClipboardText(options.text, input.artboardClipRendition)) ||
        value2 ||
        (input.artboardClipStamp == null && callback(input.artboardClipAt))
        ? "artboards"
        : options.artboards != null
          ? "foreign-artboards"
          : options.hasImage
            ? "image"
            : options.text.trim() !== ""
              ? "text"
              : options.stamp != null
                ? "nothing"
                : "artboards"
      : input.buffer != null &&
          ((options.stamp != null && options.stamp === input.bufferStamp) ||
            (value &&
              (sameClipboardText(options.text, input.buffer) ||
                sameClipboardText(options.text, input.bufferRendition))) ||
            value2 ||
            (input.unmirroredAt > 0 && callback(input.unmirroredAt)))
        ? "buffer"
        : options.artboards != null
          ? "foreign-artboards"
          : options.hasImage
            ? "image"
            : options.text.trim() !== ""
              ? "text"
              : input.buffer != null && options.stamp == null
                ? "buffer"
                : "nothing";
  }
  function getActiveClipboardSource(
    input?: Dynamic,
    options: Dynamic = Date.now(),
  ): Dynamic {
    return resolveClipboardSource(
      {
        buffer: ClipboardStateCurrentState,
        bufferStamp: ClipboardStateAlias,
        bufferRendition: ClipboardStateResolvedValue_2,
        unmirroredAt: ClipboardStateConstant,
        artboardClip: ClipboardStateAlias_2 != null,
        artboardClipAt: ClipboardStateNowValue,
        artboardClipStamp: ClipboardStateResolvedValue_3,
        artboardClipRendition: ClipboardStateResolvedValue_4,
        supersededStamps: ClipboardStateSliceValue,
      },
      input,
      options,
    );
  }
  function clearClipboardBuffers(): Dynamic {
    clearClipboardStamps();
    ClipboardStateCurrentState = null;
    ClipboardStateConstant = 0;
    ClipboardStateAlias_2 = null;
    ClipboardStateAlias_3 = [];
  }
  function getArtboardClipboard(): Dynamic {
    return ClipboardStateAlias_2;
  }
  function getAnnotationClipboard(): Dynamic {
    return ClipboardStateAlias_2 == null ? [] : ClipboardStateAlias_3;
  }
  function setArtboardClipboard(
    items?: Dynamic,
    options?: Dynamic,
    items2: Dynamic = [],
  ): Dynamic {
    (items.length === 0 && items2.length === 0) ||
      (ClipboardStateConstant_3++,
      clearClipboardStamps(),
      (ClipboardStateAlias_2 = items),
      (ClipboardStateAlias_3 = items2),
      (ClipboardStateNowValue = Date.now()),
      (ClipboardStateResolvedValue_3 = options?.stamp ?? null),
      (ClipboardStateResolvedValue_4 =
        ClipboardStateResolvedValue_3 != null && options?.rendition
          ? options.rendition
          : null),
      (ClipboardStateCurrentState = null));
  }
  bindRuntimeValue(
    runtime,
    "DesignElementsKey",
    () => DesignElementsKey,
    (value) => {
      DesignElementsKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignArtboardsKey",
    () => DesignArtboardsKey,
    (value) => {
      DesignArtboardsKey = value;
    },
  );
  bindRuntimeValue(runtime, "clipboardObjectStamp", () => clipboardObjectStamp);
  bindRuntimeValue(
    runtime,
    "ClipboardStateResolvedValue",
    () => ClipboardStateResolvedValue,
    (value) => {
      ClipboardStateResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readBoundedClipboardObject",
    () => readBoundedClipboardObject,
  );
  bindRuntimeValue(
    runtime,
    "readArtboardClipboard",
    () => readArtboardClipboard,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateIsArray",
    () => ClipboardStateIsArray,
    (value) => {
      ClipboardStateIsArray = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateHandler",
    () => ClipboardStateHandler,
    (value) => {
      ClipboardStateHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateCurrentState",
    () => ClipboardStateCurrentState,
    (value) => {
      ClipboardStateCurrentState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateConstant",
    () => ClipboardStateConstant,
    (value) => {
      ClipboardStateConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateAlias",
    () => ClipboardStateAlias,
    (value) => {
      ClipboardStateAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateResolvedValue_2",
    () => ClipboardStateResolvedValue_2,
    (value) => {
      ClipboardStateResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateSliceValue",
    () => ClipboardStateSliceValue,
    (value) => {
      ClipboardStateSliceValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateFilterValue",
    () => ClipboardStateFilterValue,
    (value) => {
      ClipboardStateFilterValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateConstant_2",
    () => ClipboardStateConstant_2,
    (value) => {
      ClipboardStateConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "localClipboardSequence",
    () => localClipboardSequence,
    (value) => {
      localClipboardSequence = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateFilterValue_2",
    () => ClipboardStateFilterValue_2,
    (value) => {
      ClipboardStateFilterValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateDelayMs",
    () => ClipboardStateDelayMs,
    (value) => {
      ClipboardStateDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateObservedElements",
    () => ClipboardStateObservedElements,
    (value) => {
      ClipboardStateObservedElements = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateLimit",
    () => ClipboardStateLimit,
    (value) => {
      ClipboardStateLimit = value;
    },
  );
  bindRuntimeValue(runtime, "expireClipboardMarks", () => expireClipboardMarks);
  bindRuntimeValue(
    runtime,
    "hasPendingClipboardMarks",
    () => hasPendingClipboardMarks,
    (value) => {
      hasPendingClipboardMarks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "runDeferredClipboardTasks",
    () => runDeferredClipboardTasks,
  );
  bindRuntimeValue(
    runtime,
    "afterClipboardSettled",
    () => afterClipboardSettled,
  );
  bindRuntimeValue(runtime, "isClipboardSettling", () => isClipboardSettling);
  bindRuntimeValue(
    runtime,
    "markConsumedClipboardStamp",
    () => markConsumedClipboardStamp,
  );
  bindRuntimeValue(
    runtime,
    "isClipboardStampConsumed",
    () => isClipboardStampConsumed,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateConstant_3",
    () => ClipboardStateConstant_3,
    (value) => {
      ClipboardStateConstant_3 = value;
    },
  );
  bindRuntimeValue(runtime, "clipboardGeneration", () => clipboardGeneration);
  bindRuntimeValue(runtime, "clearClipboardStamps", () => clearClipboardStamps);
  bindRuntimeValue(
    runtime,
    "ClipboardStateLimit_2",
    () => ClipboardStateLimit_2,
    (value) => {
      ClipboardStateLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateAlias_2",
    () => ClipboardStateAlias_2,
    (value) => {
      ClipboardStateAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateAlias_3",
    () => ClipboardStateAlias_3,
    (value) => {
      ClipboardStateAlias_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateNowValue",
    () => ClipboardStateNowValue,
    (value) => {
      ClipboardStateNowValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateResolvedValue_3",
    () => ClipboardStateResolvedValue_3,
    (value) => {
      ClipboardStateResolvedValue_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardStateResolvedValue_4",
    () => ClipboardStateResolvedValue_4,
    (value) => {
      ClipboardStateResolvedValue_4 = value;
    },
  );
  bindRuntimeValue(runtime, "getElementClipboard", () => getElementClipboard);
  bindRuntimeValue(runtime, "setElementClipboard", () => setElementClipboard);
  bindRuntimeValue(
    runtime,
    "markLocalElementClipboard",
    () => markLocalElementClipboard,
  );
  bindRuntimeValue(
    runtime,
    "rememberClipboardStamp",
    () => rememberClipboardStamp,
  );
  bindRuntimeValue(
    runtime,
    "mirrorArtboardClipboardStamp",
    () => mirrorArtboardClipboardStamp,
  );
  bindRuntimeValue(runtime, "claimClipboardMark", () => claimClipboardMark);
  bindRuntimeValue(runtime, "startClipboardMark", () => startClipboardMark);
  bindRuntimeValue(
    runtime,
    "ClipboardStateReplace",
    () => ClipboardStateReplace,
    (value) => {
      ClipboardStateReplace = value;
    },
  );
  bindRuntimeValue(runtime, "sameClipboardText", () => sameClipboardText);
  bindRuntimeValue(
    runtime,
    "resolveClipboardSource",
    () => resolveClipboardSource,
  );
  bindRuntimeValue(
    runtime,
    "getActiveClipboardSource",
    () => getActiveClipboardSource,
  );
  bindRuntimeValue(
    runtime,
    "clearClipboardBuffers",
    () => clearClipboardBuffers,
  );
  bindRuntimeValue(runtime, "getArtboardClipboard", () => getArtboardClipboard);
  bindRuntimeValue(
    runtime,
    "getAnnotationClipboard",
    () => getAnnotationClipboard,
  );
  bindRuntimeValue(runtime, "setArtboardClipboard", () => setArtboardClipboard);
  return () => {
    DesignElementsKey = "design-elements";
    DesignArtboardsKey = "design-artboards";
    ClipboardStateResolvedValue = 34 * 1024 * 1024;
    ClipboardStateIsArray = (input?: Dynamic): Dynamic =>
      typeof input == "object" &&
      input !== null &&
      Array.isArray(input.artboards) &&
      input.artboards.length > 0;
    ClipboardStateHandler = (input?: Dynamic): Dynamic =>
      typeof input == "number" &&
      Number.isInteger(input) &&
      input > 0 &&
      input <= runtime.PlatformFileContentLimit_5
        ? input
        : 0;
    ClipboardStateCurrentState = null;
    ClipboardStateConstant = 0;
    ClipboardStateAlias = null;
    ClipboardStateResolvedValue_2 = null;
    ClipboardStateSliceValue = [];
    ClipboardStateFilterValue = [];
    ClipboardStateConstant_2 = 0;
    localClipboardSequence = 0;
    ClipboardStateFilterValue_2 = [];
    ClipboardStateDelayMs = 3e3;
    ClipboardStateObservedElements = new WeakSet();
    ClipboardStateLimit = 2e3;
    hasPendingClipboardMarks = (
      input?: Dynamic,
      options: Dynamic = Date.now(),
    ): Dynamic =>
      ClipboardStateFilterValue.some(
        (input2?: Dynamic): Dynamic =>
          input2.droppedAt === 0 &&
          input2.seq <= input &&
          options - input2.at < ClipboardStateLimit_2,
      );
    ClipboardStateConstant_3 = 0;
    ClipboardStateLimit_2 = 3e4;
    ClipboardStateAlias_2 = null;
    ClipboardStateAlias_3 = [];
    ClipboardStateNowValue = 0;
    ClipboardStateResolvedValue_3 = null;
    ClipboardStateResolvedValue_4 = null;
    ClipboardStateReplace = (input?: Dynamic): Dynamic =>
      input.replace(
        /\r\n?/g,
        `
`,
      );
  };
}
