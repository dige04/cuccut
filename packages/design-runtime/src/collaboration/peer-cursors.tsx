/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCollaborationPeerCursors(
  runtime: RuntimeBindings,
): () => void {
  var reactCollaborationPeerCursors: Dynamic;
  var reactCollaborationPeerCursors_2: Dynamic;
  var reactCollaborationPeerCursors_3: Dynamic;
  var jsxCollaborationPeerCursors: Dynamic;
  var jsxCollaborationPeerCursors_2: Dynamic;
  var CollaborationPeerCursorsResolvedValue: Dynamic;
  var CollaborationPeerCursorsLimit: Dynamic;
  var CollaborationPeerCursorsDelayMs: Dynamic;
  var CollaborationPeerCursorsItems: Dynamic;
  var CollaborationPeerCursorsPattern: Dynamic;
  var CollaborationPeerCursorsCache: Dynamic;
  var CollaborationPeerCursorsConstant: Dynamic;
  var CollaborationPeerCursorsConstant_2: Dynamic;
  var CollaborationPeerCursorsConstant_3: Dynamic;
  var CollaborationPeerCursorsConstant_4: Dynamic;
  var CollaborationPeerCursorsDelayMs_2: Dynamic;
  var CollaborationPeerCursorsMcChatHoldMcChatFadeMcChatExitConfig: Dynamic;
  var PeerCursorLabel: Dynamic;
  var CollaborationPeerCursorsCache_2: Dynamic;
  function PeerCursorGlyph({ color: color }: Dynamic): Dynamic {
    return (
      <svg
        aria-hidden={"true"}
        width={"16"}
        height={"16"}
        viewBox={"0 0 16 16"}
        className={"mc-peer-cursor-arrow"}
      >
        <path
          d={"M1.5 1.2 L14 7.2 L8.4 8.6 L6.4 14.5 Z"}
          fill={color}
          stroke={"#fff"}
          strokeWidth={"1.2"}
          strokeLinejoin={"round"}
        />
      </svg>
    );
  }
  function peerColor(items?: Dynamic): Dynamic {
    let index: Dynamic = 0;
    for (let index2: Dynamic = 0; index2 < items.length; index2++)
      index = (index * 31 + items.charCodeAt(index2)) >>> 0;
    return (
      CollaborationPeerCursorsItems[
        index % CollaborationPeerCursorsItems.length
      ] ?? "#788c5d"
    );
  }
  function peerCollaboratorIndex(input?: Dynamic, options?: Dynamic): Dynamic {
    return (
      (typeof input == "string" && CollaborationPeerCursorsPattern.test(input)
        ? CollaborationPeerCursorsCache.get(input.toLowerCase())
        : undefined) ??
      CollaborationPeerCursorsCache.get(peerColor(options)) ??
      1
    );
  }
  function peerCollaboratorToken(input?: Dynamic): Dynamic {
    return (
      runtime.tokens.editor.collaborator[input]?.cssVar ??
      runtime.tokens.editor.collaborator[1].cssVar
    );
  }
  function peerMotionReduced(): Dynamic {
    return (
      typeof matchMedia == "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }
  function usePeerMessageVisibility(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, reactCollaborationPeerCursors_3.useRef)(null),
      value2: Dynamic = (0, reactCollaborationPeerCursors_3.useRef)(null),
      current: Dynamic = value.current,
      value3: Dynamic =
        current != null &&
        typeof getComputedStyle == "function" &&
        parseFloat(getComputedStyle(current).opacity) < 0.2;
    (0, reactCollaborationPeerCursors_3.useLayoutEffect)((): Dynamic => {
      let current2: Dynamic = value.current;
      if (!current2) return;
      let state: Dynamic = {
          w: current2.offsetWidth,
          h: current2.offsetHeight,
          shape: input,
        },
        current3: Dynamic = value2.current;
      value2.current = state;
      if (
        !current3 ||
        current3.shape === input ||
        !state.w ||
        !state.h ||
        typeof current2.animate != "function"
      )
        return;
      for (let value6 of (current2.getAnimations?.() ?? []) as Dynamic)
        value6.animationName || value6.cancel();
      if (value3 || peerMotionReduced()) {
        current2.animate(
          [
            {
              opacity: 0,
            },
            {
              opacity: 1,
            },
          ],
          {
            duration: 160,
            easing: "ease-out",
          },
        );
        return;
      }
      let value4: Dynamic = Math.min(
          2,
          Math.max(
            0.5,
            Math.sqrt((current3.w / state.w) * (current3.h / state.h)),
          ),
        ),
        value5: Dynamic = input === "line";
      current2.animate(
        [
          {
            transform: "scale(" + value4 + ")",
            transformOrigin: "0 0",
          },
          {
            transform: "scale(1)",
            transformOrigin: "0 0",
          },
        ],
        {
          duration: value5 ? 200 : 160,
          easing: value5 ? "cubic-bezier(.2,.9,.3,1.15)" : "ease-in",
        },
      );
    });
    return value;
  }
  function normalizePeerMessage(input?: Dynamic): Dynamic {
    let value: Dynamic = Array.from(
      input
        .replace(/[\p{Cc}\p{Zl}\p{Zp}\s]+/gu, " ")
        .replace(/[^\P{Cf}\u200C\u200D]+/gu, ""),
    )
      .slice(0, CollaborationPeerCursorsConstant_2)
      .join("");
    return /^[\s\u200C\u200D\p{Variation_Selector}]*$/u.test(value)
      ? ""
      : value;
  }
  function createPresenceReporter(input: Dynamic = {}): Dynamic {
    let value: Dynamic = input.now ?? ((): Dynamic => Date.now()),
      value2: Dynamic = input.minDelta ?? 0.002,
      value3: Dynamic =
        input.idleNullMs ?? CollaborationPeerCursorsResolvedValue,
      value4: Dynamic = !(0, runtime.hasRoomCapability)(),
      value5: Dynamic,
      value6: Dynamic,
      value7: Dynamic,
      value8: Dynamic,
      value9: Dynamic,
      flag: Dynamic = false,
      text: Dynamic = "";
    async function value10(input2?: Dynamic): Promise<Dynamic> {
      if (value4) return;
      let value13: Dynamic = await (0, runtime.cachedRoomCapability)();
      if (typeof value13?.presence != "function") {
        value4 = true;
        return;
      }
      try {
        await value13.presence.call(value13, input2);
      } catch (value14: Dynamic) {
        let value15: Dynamic =
          typeof value14 == "object" && value14 !== null ? value14.code : "";
        value15 !== "upstream_error" &&
          value15 !== "invalid_argument" &&
          (value4 = true);
      }
    }
    function value11(): Dynamic {
      value9 !== undefined && clearTimeout(value9);
      value9 = undefined;
      value8 = undefined;
      value5 = undefined;
      flag &&
        ((flag = false),
        value10({
          cursor: null,
        }));
    }
    function value12(
      input2?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      let value13: Dynamic = value();
      value5 = {
        s: input2,
        x: options,
        y: context,
        at: value13,
      };
      value6 = {
        s: input2,
        x: options,
        y: context,
      };
      flag = true;
      let callback2: Dynamic = (input3?: Dynamic): Dynamic =>
        Math.round(input3 * 1e4) / 1e4;
      value10({
        cursor: {
          s: input2.slice(0, CollaborationPeerCursorsConstant),
          x: callback2(options),
          y: callback2(context),
          t: value13,
          ...(text === ""
            ? {}
            : {
                m: text,
              }),
        },
      });
      value9 !== undefined && clearTimeout(value9);
      value9 = setTimeout(value11, value3);
    }
    let callback: Dynamic = (): Dynamic => state.clear();
    typeof addEventListener == "function" &&
      addEventListener("pagehide", callback);
    let state: Dynamic = {
      move(input2: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        if (
          value4 ||
          !Number.isFinite(options) ||
          !Number.isFinite(context) ||
          (value5 &&
            value5.s === input2 &&
            Math.abs(value5.x - options) < value2 &&
            Math.abs(value5.y - context) < value2)
        )
          return;
        let value13: Dynamic = value();
        if (
          value5 &&
          value5.s === input2 &&
          value13 - value5.at < CollaborationPeerCursorsDelayMs
        ) {
          value8 = {
            s: input2,
            x: options,
            y: context,
          };
          value7 ??= setTimeout((): Dynamic => {
            value7 = undefined;
            let value14: Dynamic = value8;
            value8 = undefined;
            value14 && value12(value14.s, value14.x, value14.y);
          }, CollaborationPeerCursorsDelayMs);
          return;
        }
        value8 = undefined;
        value12(input2, options, context);
      },
      say(input2: Dynamic): Dynamic {
        let value13: Dynamic = normalizePeerMessage(input2);
        if (value4 || value13 === text || !value6) return false;
        text = value13;
        let value14: Dynamic = value8 ?? value6;
        value8 = undefined;
        value12(value14.s, value14.x, value14.y);
        return true;
      },
      live: (): Dynamic => !value4 && value6 !== undefined,
      clear(): Dynamic {
        value11();
      },
      setWho(input2: Dynamic, options: Dynamic): Dynamic {
        let value13: Dynamic = Array.from(input2).slice(0, 40).join(""),
          value14: Dynamic = CollaborationPeerCursorsPattern.test(options)
            ? options
            : "";
        (value13 === "" && value14 === "") ||
          value10({
            who: {
              n: value13,
              c: value14,
            },
          });
      },
      dispose(): Dynamic {
        value11();
        value4 = true;
        value7 !== undefined && clearTimeout(value7);
        typeof removeEventListener == "function" &&
          removeEventListener("pagehide", callback);
      },
    };
    return state;
  }
  function getPeerCursors(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = CollaborationPeerCursorsCache_2,
  ): Dynamic {
    let items: Dynamic = [];
    for (let value2 of input as Dynamic) {
      if (value2.sameTab) continue;
      let cursor: Dynamic = value2.presence.cursor;
      if (typeof cursor != "object" || cursor === null) continue;
      let value3: Dynamic = cursor;
      if (value3.s !== options) continue;
      let t: Dynamic = value3.t,
        value4: Dynamic =
          typeof t == "number" && Number.isFinite(t)
            ? Math.min(t, context)
            : value2.updatedAt,
        value5: Dynamic = context - value4;
      if (value5 >= CollaborationPeerCursorsResolvedValue) continue;
      let x: Dynamic = value3.x,
        y3: Dynamic = value3.y;
      if (
        typeof x != "number" ||
        typeof y3 != "number" ||
        !Number.isFinite(x) ||
        !Number.isFinite(y3)
      )
        continue;
      let who: Dynamic = value2.presence.who,
        value6: Dynamic = typeof who == "object" && who !== null ? who : {},
        value7: Dynamic = (
          (value2.by !== null && value.get(value2.by)) ||
          (typeof value6.n == "string" ? value6.n : "")
        ).slice(0, 40),
        value8: Dynamic = peerCollaboratorIndex(value6.c, value2.peer),
        value9: Dynamic =
          value2.updatedAt > 0 ? context - value2.updatedAt : value5,
        value10: Dynamic =
          typeof value3.m == "string" &&
          value9 <
            CollaborationPeerCursorsConstant_3 +
              CollaborationPeerCursorsConstant_4
            ? normalizePeerMessage(value3.m).trim()
            : "";
      items.push({
        peer: value2.peer,
        x: x,
        y: y3,
        name: value7,
        collaborator: value8,
        idleMs: Math.max(0, value5),
        message: value10,
      });
    }
    return items;
  }
  function usePeerProfiles(input?: Dynamic): Dynamic {
    let value: Dynamic = [
        ...new Set(
          input.flatMap(
            (input2?: Dynamic): Dynamic =>
              input2.by !== null && !input2.sameTab ? [input2.by] : [],
          ),
        ),
      ].sort().join(`
`),
      [value2, value3]: Dynamic = (0, reactCollaborationPeerCursors_3.useState)(
        CollaborationPeerCursorsCache_2,
      );
    (0, reactCollaborationPeerCursors_3.useEffect)((): Dynamic => {
      if (value === "") return;
      let flag: Dynamic = true;
      (0, runtime.getUserNames)(
        value.split(`
`),
      ).then((input2?: Dynamic): Dynamic => {
        flag && value3(input2);
      });
      return (): Dynamic => {
        flag = false;
      };
    }, [value]);
    return value2;
  }
  function usePeerCursors(
    input?: Dynamic,
    options: Dynamic = Date.now,
  ): Dynamic {
    let value: Dynamic = (0,
      reactCollaborationPeerCursors_3.useSyncExternalStore)(
        runtime.roomPeersStore.subscribe,
        runtime.roomPeersStore.getSnapshot,
        runtime.roomPeersStore.getSnapshot,
      ),
      value2: Dynamic = usePeerProfiles(value),
      [, value3]: Dynamic = (0, reactCollaborationPeerCursors_3.useState)(0);
    (0, reactCollaborationPeerCursors_3.useEffect)((): Dynamic => {
      let value4: Dynamic = setInterval(
        (): Dynamic => value3((input2?: Dynamic): Dynamic => input2 + 1),
        5e3,
      );
      return (): Dynamic => clearInterval(value4);
    }, []);
    return getPeerCursors(value, input, options(), value2);
  }
  function PeerCursors({
    surface: surface,
    toLocal: toLocal,
    glyphScale: glyphScale,
    className: className,
    now: now,
    working: working,
  }: Dynamic): Dynamic {
    let value: Dynamic = usePeerCursors(surface, now),
      value2: Dynamic =
        glyphScale !== undefined &&
        Number.isFinite(glyphScale) &&
        glyphScale > 0
          ? glyphScale
          : 1;
    return (
      <div
        aria-hidden={"true"}
        className={"mc-peer-cursors " + (className ?? "")}
      >
        {value.map((input?: Dynamic): Dynamic => {
          let value3: Dynamic = toLocal(input.x, input.y);
          if (value3 === null) return null;
          let value4: Dynamic = input.idleMs >= CollaborationPeerCursorsLimit,
            value5: Dynamic = peerCollaboratorToken(input.collaborator);
          return (() => {
            const _Component = "div";
            const _props = {
              className: "mc-peer-cursor",
              "data-idle": value4 ? "true" : undefined,
              style: {
                transform:
                  "translate(" +
                  value3.left +
                  "px," +
                  value3.top +
                  "px)" +
                  (value2 === 1 ? "" : " scale(" + value2 + ")"),
                transformOrigin: "0 0",
              },
              children: [
                <PeerCursorGlyph color={value5} />,
                <PeerCursorLabel
                  name={input.name}
                  color={value5}
                  message={input.message}
                  dim={value4}
                  working={working?.has(input.peer) === true}
                />,
              ],
            } as const;
            const _key = input.peer;
            return <_Component key={_key} {..._props} />;
          })();
        })}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactCollaborationPeerCursors",
    () => reactCollaborationPeerCursors,
    (value) => {
      reactCollaborationPeerCursors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactCollaborationPeerCursors_2",
    () => reactCollaborationPeerCursors_2,
    (value) => {
      reactCollaborationPeerCursors_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactCollaborationPeerCursors_3",
    () => reactCollaborationPeerCursors_3,
    (value) => {
      reactCollaborationPeerCursors_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCollaborationPeerCursors",
    () => jsxCollaborationPeerCursors,
    (value) => {
      jsxCollaborationPeerCursors = value;
    },
  );
  bindRuntimeValue(runtime, "PeerCursorGlyph", () => PeerCursorGlyph);
  bindRuntimeValue(
    runtime,
    "jsxCollaborationPeerCursors_2",
    () => jsxCollaborationPeerCursors_2,
    (value) => {
      jsxCollaborationPeerCursors_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsResolvedValue",
    () => CollaborationPeerCursorsResolvedValue,
    (value) => {
      CollaborationPeerCursorsResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsLimit",
    () => CollaborationPeerCursorsLimit,
    (value) => {
      CollaborationPeerCursorsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsDelayMs",
    () => CollaborationPeerCursorsDelayMs,
    (value) => {
      CollaborationPeerCursorsDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsItems",
    () => CollaborationPeerCursorsItems,
    (value) => {
      CollaborationPeerCursorsItems = value;
    },
  );
  bindRuntimeValue(runtime, "peerColor", () => peerColor);
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsPattern",
    () => CollaborationPeerCursorsPattern,
    (value) => {
      CollaborationPeerCursorsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsCache",
    () => CollaborationPeerCursorsCache,
    (value) => {
      CollaborationPeerCursorsCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "peerCollaboratorIndex",
    () => peerCollaboratorIndex,
  );
  bindRuntimeValue(
    runtime,
    "peerCollaboratorToken",
    () => peerCollaboratorToken,
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsConstant",
    () => CollaborationPeerCursorsConstant,
    (value) => {
      CollaborationPeerCursorsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsConstant_2",
    () => CollaborationPeerCursorsConstant_2,
    (value) => {
      CollaborationPeerCursorsConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsConstant_3",
    () => CollaborationPeerCursorsConstant_3,
    (value) => {
      CollaborationPeerCursorsConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsConstant_4",
    () => CollaborationPeerCursorsConstant_4,
    (value) => {
      CollaborationPeerCursorsConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsDelayMs_2",
    () => CollaborationPeerCursorsDelayMs_2,
    (value) => {
      CollaborationPeerCursorsDelayMs_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsMcChatHoldMcChatFadeMcChatExitConfig",
    () => CollaborationPeerCursorsMcChatHoldMcChatFadeMcChatExitConfig,
    (value) => {
      CollaborationPeerCursorsMcChatHoldMcChatFadeMcChatExitConfig = value;
    },
  );
  bindRuntimeValue(runtime, "peerMotionReduced", () => peerMotionReduced);
  bindRuntimeValue(
    runtime,
    "usePeerMessageVisibility",
    () => usePeerMessageVisibility,
  );
  bindRuntimeValue(
    runtime,
    "PeerCursorLabel",
    () => PeerCursorLabel,
    (value) => {
      PeerCursorLabel = value;
    },
  );
  bindRuntimeValue(runtime, "normalizePeerMessage", () => normalizePeerMessage);
  bindRuntimeValue(
    runtime,
    "createPresenceReporter",
    () => createPresenceReporter,
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerCursorsCache_2",
    () => CollaborationPeerCursorsCache_2,
    (value) => {
      CollaborationPeerCursorsCache_2 = value;
    },
  );
  bindRuntimeValue(runtime, "getPeerCursors", () => getPeerCursors);
  bindRuntimeValue(runtime, "usePeerProfiles", () => usePeerProfiles);
  bindRuntimeValue(runtime, "usePeerCursors", () => usePeerCursors);
  bindRuntimeValue(runtime, "PeerCursors", () => PeerCursors);
  return () => {
    reactCollaborationPeerCursors = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactCollaborationPeerCursors_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    reactCollaborationPeerCursors_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxCollaborationPeerCursors = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    jsxCollaborationPeerCursors_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    CollaborationPeerCursorsResolvedValue = 15 * 6e4;
    CollaborationPeerCursorsLimit = 6e4;
    CollaborationPeerCursorsDelayMs = 33;
    CollaborationPeerCursorsItems = [
      "#62744c",
      "#b04e72",
      "#5b7596",
      "#a3651f",
      "#7a6ba8",
      "#3f7a75",
    ];
    CollaborationPeerCursorsPattern = /^#[0-9a-f]{6}$/i;
    CollaborationPeerCursorsCache = new Map([
      ["#7a6ba8", 1],
      ["#b04e72", 2],
      ["#3f7a75", 3],
      ["#62744c", 4],
      ["#a3651f", 5],
      ["#5b7596", 6],
      ["#c7c9d1", 6],
    ]);
    CollaborationPeerCursorsConstant = 128;
    CollaborationPeerCursorsConstant_2 = 50;
    CollaborationPeerCursorsConstant_3 = 5e3;
    CollaborationPeerCursorsConstant_4 = 600;
    CollaborationPeerCursorsDelayMs_2 = 150;
    CollaborationPeerCursorsMcChatHoldMcChatFadeMcChatExitConfig = {
      "--mc-chat-hold": CollaborationPeerCursorsConstant_3 + "ms",
      "--mc-chat-fade": CollaborationPeerCursorsConstant_4 + "ms",
      "--mc-chat-exit": CollaborationPeerCursorsDelayMs_2 + "ms",
    };
    PeerCursorLabel = (0, reactCollaborationPeerCursors_3.memo)(function ({
      name: name,
      color: color,
      message: message,
      dim: dim,
      working: working,
    }: Dynamic): Dynamic {
      let value: Dynamic = (0, reactCollaborationPeerCursors_3.useRef)({
        m: "",
        n: 0,
      });
      message !== value.current.m &&
        (value.current = {
          m: message,
          n: message === "" ? value.current.n : value.current.n + 1,
        });
      let [value2, value3]: Dynamic = (0,
        reactCollaborationPeerCursors_3.useState)(0),
        value4: Dynamic =
          message !== "" && value2 !== value.current.n ? "line" : "name",
        value5: Dynamic = usePeerMessageVisibility(value4);
      return dim && value4 === "name" && !working ? null : (
        <span
          ref={value5}
          className={
            "mc-peer-tag " +
            (value4 === "name" ? "mc-peer-cursor-label" : "mc-cursor-chat")
          }
          data-mode={value4}
          data-working={working && value4 === "name" ? "true" : undefined}
          data-beat={value4 === "line" ? value.current.n % 2 : undefined}
          style={{
            background: color,
            ...CollaborationPeerCursorsMcChatHoldMcChatFadeMcChatExitConfig,
          }}
          onAnimationEnd={(event?: Dynamic): Dynamic => {
            event.target === event.currentTarget &&
              event.animationName ===
                "mc-cursor-chat-fade-" + (value.current.n % 2) &&
              value3(value.current.n);
          }}
        >
          {value4 === "name" ? (
            <span key={"name"} className={"mc-peer-tag-name"}>
              {(name || "Someone").slice(0, 16)}
            </span>
          ) : (
            <span key={"line"} className={"mc-peer-tag-line"}>
              {message}
            </span>
          )}
          {working && value4 === "name" ? (
            <span className={"mc-peer-tag-dots"}>
              <i />
              <i />
              <i />
            </span>
          ) : null}
        </span>
      );
    });
    CollaborationPeerCursorsCache_2 = new Map();
  };
}
