/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditDraftChannel(
  runtime: RuntimeBindings,
): () => void {
  var DRAFT_EVENT_NAME: Dynamic;
  var DRAFT_EMIT_MIN_GAP_MS: Dynamic;
  var DRAFT_EMIT_MIN_CHARS: Dynamic;
  var DRAFT_INITIAL_TIMEOUT_MS: Dynamic;
  var DRAFT_HEARTBEAT_MS: Dynamic;
  var DRAFT_SOFT_EXPIRY_MS: Dynamic;
  var DRAFT_MAX_LIFETIME_MS: Dynamic;
  var DRAFT_MAX_TOMBSTONES: Dynamic;
  var resolveDraftChannel: Dynamic;
  var DRAFT_MAX_ACTIVE_FILES: Dynamic;
  function createDraftEmitter(
    path?: Dynamic,
    now: Dynamic = Date.now,
  ): Dynamic {
    let value: Dynamic,
      flag: Dynamic = false,
      index: Dynamic = 0,
      text: Dynamic = "",
      value2: Dynamic = null,
      index2: Dynamic = 0,
      count: Dynamic = 250,
      value3: Dynamic,
      flag2: Dynamic = false;
    resolveDraftChannel().then((input?: Dynamic): Dynamic => {
      value = input;
      input === null || typeof input.emit != "function"
        ? (flag = true)
        : value4(0);
    });
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
      value
        ?.emit?.(DRAFT_EVENT_NAME, input)
        .catch((input2?: Dynamic): Dynamic => {
          input2?.code !== "upstream_error" && (flag = true);
        });
    };
    function value4(input?: Dynamic): Dynamic {
      flag ||
        flag2 ||
        value3 !== undefined ||
        value === undefined ||
        (value3 = setTimeout(
          (): Dynamic => {
            value3 = undefined;
            if (flag || flag2) return;
            if (text === value2 && now() - index2 < DRAFT_INITIAL_TIMEOUT_MS)
              return value4(DRAFT_INITIAL_TIMEOUT_MS - (now() - index2));
            let value5: Dynamic = text.match(/[\s\S]{1,1000}/g) ?? [""],
              value6: Dynamic = Math.min(value5.length, DRAFT_EMIT_MIN_CHARS),
              value7: Dynamic = index++;
            value2 = text;
            index2 = now();
            count = Math.max(250, 200 * value6);
            value5.slice(0, value6).forEach(
              (input2?: Dynamic, options?: Dynamic): Dynamic =>
                callback({
                  s: path,
                  n: value7,
                  i: options,
                  k: value6,
                  h: input2,
                }),
            );
            value4();
          },
          input ?? Math.max(0, count - (now() - index2)),
        ));
    }
    return {
      frame(input: Dynamic): Dynamic {
        text = input.slice(0, DRAFT_EMIT_MIN_GAP_MS * DRAFT_EMIT_MIN_CHARS);
        value3 !== undefined &&
          text !== value2 &&
          (clearTimeout(value3), (value3 = undefined));
        value4();
      },
      end(): Dynamic {
        flag2 ||
          ((flag2 = true),
          value3 !== undefined && clearTimeout(value3),
          !flag &&
            index > 0 &&
            callback({
              s: path,
              end: 1,
            }));
      },
    };
  }
  function subscribeDraftPreviews(
    onPreview?: Dynamic,
    viewerId?: Dynamic,
    now: Dynamic = Date.now,
    resolveChannel: Dynamic = resolveDraftChannel,
  ): Dynamic {
    let activePreviews: Dynamic = new Map(),
      tombstones: Dynamic = new Map(),
      rememberTombstone: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
      ): Dynamic => {
        tombstones.set(input + "\0" + options, now() + DRAFT_MAX_LIFETIME_MS);
        tombstones.size > DRAFT_MAX_TOMBSTONES &&
          tombstones.delete(tombstones.keys().next().value);
      },
      expirePreview: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
      ): Dynamic => {
        activePreviews.delete(input);
        now() - options.since >= DRAFT_MAX_LIFETIME_MS &&
          rememberTombstone(options.who, input);
        onPreview({
          path: input,
          html: null,
          peer: options.peer,
        });
      },
      value: Dynamic,
      flag: Dynamic = false;
    resolveChannel().then((input?: Dynamic): Dynamic => {
      if (!(flag || input === null || typeof input.on != "function"))
        try {
          value = input.on(DRAFT_EVENT_NAME, (input2?: Dynamic): Dynamic => {
            let data: Dynamic = input2.data;
            if (
              input2.sameTab === true ||
              data === null ||
              typeof data != "object" ||
              typeof data.s != "string" ||
              data.s.length > 64 ||
              !viewerId(data.s) ||
              (!activePreviews.has(data.s) &&
                activePreviews.size >= DRAFT_MAX_ACTIVE_FILES)
            )
              return;
            let value2: Dynamic =
                typeof input2.peer == "string" ? input2.peer : "",
              value3: Dynamic =
                typeof input2.by == "string" && input2.by !== ""
                  ? "u:" + input2.by
                  : "p:" + value2,
              entry: Dynamic = tombstones.get(value3 + "\0" + data.s);
            if (entry !== undefined) {
              if (now() < entry) return;
              tombstones.delete(value3 + "\0" + data.s);
            }
            if (data.end !== undefined) {
              activePreviews.get(data.s)?.peer === value2 &&
                (activePreviews.delete(data.s),
                onPreview({
                  path: data.s,
                  html: null,
                  peer: value2,
                }));
              return;
            }
            if (
              typeof data.n != "number" ||
              typeof data.i != "number" ||
              typeof data.k != "number" ||
              typeof data.h != "string" ||
              data.k < 1 ||
              data.k > DRAFT_EMIT_MIN_CHARS ||
              data.i < 0 ||
              data.i >= data.k ||
              data.h.length > DRAFT_EMIT_MIN_GAP_MS
            )
              return;
            let entry2: Dynamic = activePreviews.get(data.s);
            if (
              entry2 !== undefined &&
              entry2.who === value3 &&
              now() - entry2.since >= DRAFT_MAX_LIFETIME_MS
            ) {
              expirePreview(data.s, entry2);
              return;
            }
            if (
              (entry2 !== undefined &&
                entry2.peer !== value2 &&
                now() - entry2.seen < DRAFT_HEARTBEAT_MS) ||
              ((entry2 === undefined || entry2.peer !== value2) &&
                ((entry2 = {
                  peer: value2,
                  who: value3,
                  n: -1,
                  parts: new Map(),
                  k: 0,
                  seen: now(),
                  moved: now(),
                  since:
                    entry2 !== undefined && entry2.who === value3
                      ? entry2.since
                      : now(),
                  last: "\0",
                }),
                activePreviews.set(data.s, entry2)),
              (entry2.seen = now()),
              data.n < entry2.n) ||
              (data.n > entry2.n &&
                ((entry2.n = data.n),
                (entry2.parts = new Map()),
                (entry2.k = data.k),
                (entry2.moved = now())),
              entry2.parts.set(data.i, data.h),
              entry2.parts.size < entry2.k)
            )
              return;
            let text: Dynamic = "";
            for (let index: Dynamic = 0; index < entry2.k; index++)
              text += entry2.parts.get(index) ?? "";
            text !== entry2.last &&
              ((entry2.last = text),
              (entry2.moved = now()),
              onPreview({
                path: data.s,
                html: text,
                peer: value2,
              }));
          });
        } catch {}
    });
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      now() - input.seen < DRAFT_HEARTBEAT_MS &&
      now() - input.moved < DRAFT_SOFT_EXPIRY_MS &&
      now() - input.since < DRAFT_MAX_LIFETIME_MS;
    return {
      holds(input: Dynamic): Dynamic {
        let entry: Dynamic = activePreviews.get(input);
        return entry !== undefined && callback(entry);
      },
      sweep(): Dynamic {
        for (let [value2, value3] of [...activePreviews] as Dynamic)
          callback(value3) || expirePreview(value2, value3);
        return activePreviews.size > 0;
      },
      stop(): Dynamic {
        flag = true;
        value?.();
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "DRAFT_EVENT_NAME",
    () => DRAFT_EVENT_NAME,
    (value) => {
      DRAFT_EVENT_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DRAFT_EMIT_MIN_GAP_MS",
    () => DRAFT_EMIT_MIN_GAP_MS,
    (value) => {
      DRAFT_EMIT_MIN_GAP_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DRAFT_EMIT_MIN_CHARS",
    () => DRAFT_EMIT_MIN_CHARS,
    (value) => {
      DRAFT_EMIT_MIN_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DRAFT_INITIAL_TIMEOUT_MS",
    () => DRAFT_INITIAL_TIMEOUT_MS,
    (value) => {
      DRAFT_INITIAL_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DRAFT_HEARTBEAT_MS",
    () => DRAFT_HEARTBEAT_MS,
    (value) => {
      DRAFT_HEARTBEAT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DRAFT_SOFT_EXPIRY_MS",
    () => DRAFT_SOFT_EXPIRY_MS,
    (value) => {
      DRAFT_SOFT_EXPIRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DRAFT_MAX_LIFETIME_MS",
    () => DRAFT_MAX_LIFETIME_MS,
    (value) => {
      DRAFT_MAX_LIFETIME_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DRAFT_MAX_TOMBSTONES",
    () => DRAFT_MAX_TOMBSTONES,
    (value) => {
      DRAFT_MAX_TOMBSTONES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveDraftChannel",
    () => resolveDraftChannel,
    (value) => {
      resolveDraftChannel = value;
    },
  );
  bindRuntimeValue(runtime, "createDraftEmitter", () => createDraftEmitter);
  bindRuntimeValue(
    runtime,
    "DRAFT_MAX_ACTIVE_FILES",
    () => DRAFT_MAX_ACTIVE_FILES,
    (value) => {
      DRAFT_MAX_ACTIVE_FILES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeDraftPreviews",
    () => subscribeDraftPreviews,
  );
  return () => {
    DRAFT_EVENT_NAME = "draft";
    DRAFT_EMIT_MIN_GAP_MS = 1e3;
    DRAFT_EMIT_MIN_CHARS = 40;
    DRAFT_INITIAL_TIMEOUT_MS = 5e3;
    DRAFT_HEARTBEAT_MS = 2e4;
    DRAFT_SOFT_EXPIRY_MS = 9e4;
    DRAFT_MAX_LIFETIME_MS = 18e4;
    DRAFT_MAX_TOMBSTONES = 64;
    resolveDraftChannel = async (): Promise<Dynamic> =>
      await (0, runtime.cachedRoomCapability)();
    DRAFT_MAX_ACTIVE_FILES = 8;
  };
}
