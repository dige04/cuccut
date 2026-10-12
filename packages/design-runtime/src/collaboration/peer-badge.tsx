/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCollaborationPeerBadge(
  runtime: RuntimeBindings,
): () => void {
  var reactCollaborationPeerBadge: Dynamic;
  var jsxCollaborationPeerBadge: Dynamic;
  var CollaborationPeerBadgeConstant: Dynamic;
  var CollaborationPeerBadgeConstant_2: Dynamic;
  var jsxCollaborationPeerBadge_2: Dynamic;
  var reactCollaborationPeerBadge_2: Dynamic;
  var jsxCollaborationPeerBadge_3: Dynamic;
  var jsxCollaborationPeerBadge_4: Dynamic;
  var reactCollaborationPeerBadge_3: Dynamic;
  var jsxCollaborationPeerBadge_5: Dynamic;
  function CrossfadeLabel({
    text: text,
    outMs: outMs,
    inMs: inMs,
    shimmer: shimmer,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, reactCollaborationPeerBadge.useState)({
        a: text,
        b: "",
        front: "a",
      }),
      value3: Dynamic = (0, reactCollaborationPeerBadge.useRef)(null),
      [value4, value5]: Dynamic = (0, reactCollaborationPeerBadge.useState)(
        null,
      ),
      [value6, value7]: Dynamic = (0, reactCollaborationPeerBadge.useState)(0);
    (0, reactCollaborationPeerBadge.useEffect)((): Dynamic => {
      value2(
        (input?: Dynamic): Dynamic =>
          (input.front === "a" ? input.a : input.b) === text
            ? input
            : input.front === "a"
              ? {
                  ...input,
                  b: text,
                  front: "b",
                }
              : {
                  ...input,
                  a: text,
                  front: "a",
                },
      );
    }, [text]);
    (0, reactCollaborationPeerBadge.useEffect)((): Dynamic => {
      let flag: Dynamic = true;
      (typeof document !== "undefined"
        ? (document as Dynamic).fonts?.ready
        : undefined
      )?.then((): Dynamic => {
        flag && value7((input?: Dynamic): Dynamic => input + 1);
      });
      return (): Dynamic => {
        flag = false;
      };
    }, []);
    (0, reactCollaborationPeerBadge.useLayoutEffect)((): Dynamic => {
      if (!value3.current) return;
      let value10: Dynamic = value3.current.offsetWidth + 1;
      value5(
        (input?: Dynamic): Dynamic =>
          input !== null && input.width === value10
            ? input
            : {
                width: value10,
                narrows: input !== null && value10 < input.width,
              },
      );
    }, [value, value6]);
    let value8: Dynamic =
        value4?.narrows === true
          ? {
              transitionDuration: inMs + "ms",
              transitionDelay: outMs + "ms",
            }
          : {
              transitionDuration: outMs + "ms",
              transitionDelay: "0ms",
            },
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        input
          ? {
              transitionDuration: inMs + "ms",
              transitionDelay: outMs + "ms",
            }
          : {
              transitionDuration: outMs + "ms",
              transitionDelay: "0ms",
            },
      value9: Dynamic = value.front === "a" ? value.a : value.b;
    return (
      <span
        className={"mc-tip-fade"}
        style={{
          width: value4 === null ? undefined : value4.width,
          ...value8,
        }}
      >
        <span ref={value3} className={"mc-tip-sizer"} aria-hidden={"true"}>
          {value9}
        </span>
        {["a", "b"].map(
          (input?: Dynamic): Dynamic => (
            <span
              key={input}
              className={shimmer ? "mc-tip-line mc-tip-shimmer" : "mc-tip-line"}
              data-front={value.front === input ? "true" : undefined}
              style={callback(value.front === input)}
            >
              {value[input]}
            </span>
          ),
        )}
      </span>
    );
  }
  function PeerBadgeLabel({ tint: tint, label: label }: Dynamic): Dynamic {
    let value: Dynamic = "var(--cds-" + tint + "-500)";
    return label.kind === "name" ? (
      <span
        aria-hidden={"true"}
        className={"mc-peer-tag mc-peer-cursor-label mc-claude-tag-name"}
        style={{
          background: value,
        }}
      >
        {label.text}
      </span>
    ) : (
      <span
        aria-hidden={"true"}
        className={"mc-peer-tag mc-cursor-chat"}
        style={{
          background: value,
        }}
      >
        <CrossfadeLabel
          text={label.text}
          outMs={label.outMs ?? CollaborationPeerBadgeConstant}
          inMs={label.inMs ?? CollaborationPeerBadgeConstant_2}
          shimmer={label.shimmer === true}
        />
      </span>
    );
  }
  function PeerBadge({
    tint: tint,
    label: label,
    at: at,
    align = "arrow",
    glideMs = 0,
    glyphScale: glyphScale,
    hidden = false,
    arrowRef: arrowRef,
  }: Dynamic): Dynamic {
    let value: Dynamic =
        glyphScale !== undefined &&
        Number.isFinite(glyphScale) &&
        glyphScale > 0
          ? glyphScale
          : 1,
      value2: Dynamic = at !== undefined && glideMs > 0,
      value3: Dynamic = value === 1 ? "" : " scale(" + String(value) + ")",
      value4: Dynamic =
        at !== undefined
          ? {
              transform:
                "translate(" +
                String(at.left) +
                "px," +
                String(at.top) +
                "px)" +
                value3,
              transformOrigin: "0 0",
              ...(value2
                ? {
                    "--mc-claude-glide": String(glideMs) + "ms",
                  }
                : {}),
            }
          : value === 1
            ? undefined
            : {
                transform: value3.trim(),
                transformOrigin: "0 0",
              };
    return (
      <div
        aria-hidden={"true"}
        className={"mc-claude-cursor"}
        data-flow={at === undefined ? "" : undefined}
        data-align={
          at !== undefined && align === "centre" ? "centre" : undefined
        }
        data-glide={value2 ? "" : undefined}
        data-hidden={hidden ? "" : undefined}
        style={value4}
      >
        <div className={"mc-claude-cursor-unit"}>
          <div ref={arrowRef} className={"mc-claude-cursor-arrow"}>
            <runtime.PeerCursorGlyph color={"var(--cds-" + tint + "-500)"} />
          </div>
          <PeerBadgeLabel tint={tint} label={label} />
        </div>
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactCollaborationPeerBadge",
    () => reactCollaborationPeerBadge,
    (value) => {
      reactCollaborationPeerBadge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCollaborationPeerBadge",
    () => jsxCollaborationPeerBadge,
    (value) => {
      jsxCollaborationPeerBadge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerBadgeConstant",
    () => CollaborationPeerBadgeConstant,
    (value) => {
      CollaborationPeerBadgeConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerBadgeConstant_2",
    () => CollaborationPeerBadgeConstant_2,
    (value) => {
      CollaborationPeerBadgeConstant_2 = value;
    },
  );
  bindRuntimeValue(runtime, "CrossfadeLabel", () => CrossfadeLabel);
  bindRuntimeValue(runtime, "PeerBadgeLabel", () => PeerBadgeLabel);
  bindRuntimeValue(
    runtime,
    "jsxCollaborationPeerBadge_2",
    () => jsxCollaborationPeerBadge_2,
    (value) => {
      jsxCollaborationPeerBadge_2 = value;
    },
  );
  bindRuntimeValue(runtime, "PeerBadge", () => PeerBadge);
  bindRuntimeValue(
    runtime,
    "reactCollaborationPeerBadge_2",
    () => reactCollaborationPeerBadge_2,
    (value) => {
      reactCollaborationPeerBadge_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCollaborationPeerBadge_3",
    () => jsxCollaborationPeerBadge_3,
    (value) => {
      jsxCollaborationPeerBadge_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCollaborationPeerBadge_4",
    () => jsxCollaborationPeerBadge_4,
    (value) => {
      jsxCollaborationPeerBadge_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactCollaborationPeerBadge_3",
    () => reactCollaborationPeerBadge_3,
    (value) => {
      reactCollaborationPeerBadge_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCollaborationPeerBadge_5",
    () => jsxCollaborationPeerBadge_5,
    (value) => {
      jsxCollaborationPeerBadge_5 = value;
    },
  );
  return () => {
    reactCollaborationPeerBadge = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    jsxCollaborationPeerBadge = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    CollaborationPeerBadgeConstant = 80;
    CollaborationPeerBadgeConstant_2 = 120;
    jsxCollaborationPeerBadge_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    reactCollaborationPeerBadge_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    jsxCollaborationPeerBadge_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    jsxCollaborationPeerBadge_4 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    reactCollaborationPeerBadge_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxCollaborationPeerBadge_5 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
