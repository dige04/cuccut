/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasWorkingLabelAnimation(
  runtime: RuntimeBindings,
): () => void {
  var reactCanvasWorkingLabelAnimation: Dynamic;
  var reactCanvasWorkingLabelAnimation_2: Dynamic;
  var CanvasWorkingLabelAnimationHandler: Dynamic;
  var CanvasWorkingLabelAnimationPow: Dynamic;
  var CanvasWorkingLabelAnimationHandler_2: Dynamic;
  var CanvasWorkingLabelAnimationReduce: Dynamic;
  var jsxCanvasWorkingLabelAnimation: Dynamic;
  var CanvasWorkingLabelAnimationLabel: Dynamic;
  var CanvasWorkingLabelAnimationConstant: Dynamic;
  var CanvasWorkingLabelAnimationConstant_2: Dynamic;
  var CanvasWorkingLabelAnimationConstant_3: Dynamic;
  var CanvasWorkingLabelAnimationConstant_4: Dynamic;
  var CanvasWorkingLabelAnimationConstant_5: Dynamic;
  var CanvasWorkingLabelAnimationConstant_6: Dynamic;
  var CanvasWorkingLabelAnimationConstant_7: Dynamic;
  function createSeededRandom(input?: Dynamic): Dynamic {
    let value: Dynamic = input >>> 0;
    return (): Dynamic => {
      value = (value + 1831565813) >>> 0;
      let value2: Dynamic = Math.imul(value ^ (value >>> 15), value | 1);
      value2 ^= value2 + Math.imul(value2 ^ (value2 >>> 7), value2 | 61);
      return ((value2 ^ (value2 >>> 14)) >>> 0) / 4294967296;
    };
  }
  function workingLabelPosition(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let x: Dynamic = input.x,
      y: Dynamic = input.y;
    for (let value of options as Dynamic) {
      let value2: Dynamic = (context - value.t0) / value.T;
      if (value2 <= 0) continue;
      let value3: Dynamic = CanvasWorkingLabelAnimationPow(value2);
      x += value.dx * value3;
      y += value.dy * value3;
      let value4: Dynamic = Math.hypot(value.dx, value.dy);
      if (value4 > 0 && value.bend !== 0 && value2 < 1) {
        let value5: Dynamic =
          (value.bend * CanvasWorkingLabelAnimationHandler_2(value2)) / value4;
        x += -value.dy * value5;
        y += value.dx * value5;
      }
    }
    return {
      x: x,
      y: y,
    };
  }
  function workingLabelTravel(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = context.x - options.x,
      value3: Dynamic = context.y - options.y,
      value4: Dynamic = Math.hypot(value2, value3),
      value5: Dynamic =
        input() < 0.75 ? 0.05 + 0.08 * input() : -(0.05 + 0.06 * input()),
      value6: Dynamic = (input() - 0.5) * 0.1,
      state: Dynamic = {
        t0: value,
        T: 0.9 + 0.25 * input() + Math.min(0.2, value4 / 600),
        dx: value2 * (1 + value5) - value3 * value6,
        dy: value3 * (1 + value5) + value2 * value6,
        bend: extra * (0.1 + 0.1 * input()) * value4,
      };
    return [
      state,
      {
        t0: value + (0.7 + 0.08 * input()) * state.T,
        T: 0.5 + 0.2 * input(),
        dx: value2 - state.dx,
        dy: value3 - state.dy,
        bend: 0,
      },
    ];
  }
  function workingLabelSweep(
    input: Dynamic,
    { rx: rx, ry: ry }: Dynamic,
  ): Dynamic {
    let value: Dynamic = input() < 0.65 ? 1 : -1,
      state: Dynamic = {
        x: (input() - 0.5) * 0.3 * rx,
        y: (input() - 0.3) * 0.4 * ry,
      },
      value2: Dynamic = input() < 0.7 ? value : -value,
      value3: Dynamic = value2 === value ? 0 : 0.2,
      state2: Dynamic = {
        x: value * (0.72 + 0.2 * input()) * rx,
        y: (0.65 - value3 + 0.3 * input()) * ry,
      };
    if (input() < 0.6)
      return {
        from: state2,
        strokes: workingLabelTravel(input, state2, state, 0, value2),
        rest: state,
      };
    let state3: Dynamic = {
        x: state.x + value * (0.1 + 0.3 * input()) * rx,
        y: state.y - (0.4 + 0.4 * input()) * ry,
      },
      state4: Dynamic = {
        t0: 0,
        T: 0.85 + 0.2 * input(),
        dx: state3.x - state2.x,
        dy: state3.y - state2.y,
        bend:
          value2 * 0.12 * Math.hypot(state3.x - state2.x, state3.y - state2.y),
      };
    return {
      from: state2,
      strokes: [
        state4,
        ...workingLabelTravel(
          input,
          state3,
          state,
          (0.5 + 0.1 * input()) * state4.T,
          -value2,
        ),
      ],
      rest: state,
    };
  }
  function workingLabelWander(
    input: Dynamic,
    options: Dynamic,
    { rx: rx, ry: ry }: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        Math.min(options2, Math.max(-options2, input2)),
      value2: Dynamic = options,
      value3: Dynamic = -1;
    for (let index: Dynamic = 0; index < 8 && value3 < 30; index++) {
      let value4: Dynamic = input() * 2 * Math.PI,
        value5: Dynamic = 30 + 50 * input(),
        state: Dynamic = {
          x: callback(options.x + value5 * Math.cos(value4), 0.62 * rx),
          y: callback(options.y + 0.6 * value5 * Math.sin(value4), 0.5 * ry),
        },
        value6: Dynamic = Math.hypot(state.x - options.x, state.y - options.y);
      value6 > value3 && ((value3 = value6), (value2 = state));
    }
    return {
      strokes: workingLabelTravel(
        input,
        options,
        value2,
        value,
        input() < 0.5 ? 1 : -1,
      ),
      rest: value2,
    };
  }
  function animateWorkingLabel(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = value || typeof requestAnimationFrame != "function",
      clientWidth: Dynamic = input.clientWidth,
      clientHeight: Dynamic = input.clientHeight,
      callback: Dynamic = (): Dynamic => ({
        rx: Math.max(
          0,
          (clientWidth -
            CanvasWorkingLabelAnimationConstant -
            2 * CanvasWorkingLabelAnimationConstant_3) /
            2,
        ),
        ry: Math.max(
          0,
          (clientHeight -
            CanvasWorkingLabelAnimationConstant_2 -
            2 * CanvasWorkingLabelAnimationConstant_3) /
            2,
        ),
      }),
      value3: Dynamic = createSeededRandom(Math.random() * 4294967296),
      value4: Dynamic = workingLabelSweep(value3, callback()),
      from: Dynamic = value4.from,
      strokes: Dynamic = value4.strokes,
      NaN2: Dynamic = Number.NaN,
      index: Dynamic = 0,
      index2: Dynamic = 0,
      index3: Dynamic = 0,
      count: Dynamic = 0.18,
      value5: Dynamic = -1,
      index4: Dynamic = 0,
      value6: Dynamic,
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        let value8: Dynamic =
          value5 < 0 ? 0 : Math.min(0.05, Math.max(0, (input2 - value5) / 1e3));
        value5 = input2;
        count += value8;
        let { rx: value9, ry: value10 }: Dynamic = callback(),
          value11: Dynamic = value2
            ? value4.rest
            : workingLabelPosition(from, strokes, count),
          value12: Dynamic =
            CanvasWorkingLabelAnimationConstant_3 +
            value9 +
            Math.min(value9, Math.max(-value9, value11.x)),
          value13: Dynamic =
            CanvasWorkingLabelAnimationConstant_3 +
            value10 +
            Math.min(value10, Math.max(-value10, value11.y));
        (value2 || Number.isNaN(NaN2)) && ((NaN2 = value12), (index = value13));
        for (let value15: Dynamic = value8; value15 > 0; value15 -= 0.008) {
          let value16: Dynamic = Math.min(0.008, value15);
          index2 +=
            (CanvasWorkingLabelAnimationConstant_4 * (value12 - NaN2) -
              CanvasWorkingLabelAnimationConstant_5 * index2) *
            value16;
          index3 +=
            (CanvasWorkingLabelAnimationConstant_4 * (value13 - index) -
              CanvasWorkingLabelAnimationConstant_5 * index3) *
            value16;
          NaN2 += index2 * value16;
          index += index3 * value16;
        }
        let value14: Dynamic =
          !value2 &&
          (count < CanvasWorkingLabelAnimationReduce(strokes) ||
            Math.abs(value12 - NaN2) + Math.abs(value13 - index) > 0.05 ||
            Math.abs(index2) + Math.abs(index3) > 1);
        value14 || ((NaN2 = value12), (index = value13), (index2 = index3 = 0));
        options.style.transform =
          "translate(" +
          value12.toFixed(2) +
          "px," +
          value13.toFixed(2) +
          "px)";
        context.style.transform =
          "translate(" + NaN2.toFixed(2) + "px," + index.toFixed(2) + "px)";
        return value14;
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        index4 = callback2(input2) ? requestAnimationFrame(callback3) : 0;
        index4 === 0 && callback5();
      },
      callback4: Dynamic = (): Dynamic => {
        value5 = -1;
        index4 = requestAnimationFrame(callback3);
      },
      callback5: Dynamic = (): Dynamic => {
        value6 = setTimeout(
          (): Dynamic => {
            from = workingLabelPosition(from, strokes, count);
            strokes = workingLabelWander(
              value3,
              from,
              callback(),
              count,
            ).strokes;
            callback4();
          },
          (CanvasWorkingLabelAnimationConstant_6 +
            CanvasWorkingLabelAnimationConstant_7 * value3()) *
            1e3,
        );
      },
      value7: Dynamic =
        typeof ResizeObserver == "function"
          ? new ResizeObserver((): Dynamic => {
              clientWidth = input.clientWidth;
              clientHeight = input.clientHeight;
              index4 === 0 && ((NaN2 = Number.NaN), callback2(value5));
            })
          : null;
    value7?.observe(input);
    callback2(typeof performance == "object" ? performance.now() : 0);
    value2 || callback4();
    return (): Dynamic => {
      index4 !== 0 && cancelAnimationFrame(index4);
      clearTimeout(value6);
      value7?.disconnect();
    };
  }
  function ClaudeWorkingLabel({
    working: working,
    tint: tint,
    idle: idle,
    action: action,
    busy: busy,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, reactCanvasWorkingLabelAnimation_2.useRef)(null),
      value2: Dynamic = (0, reactCanvasWorkingLabelAnimation_2.useRef)(null),
      value3: Dynamic = (0, reactCanvasWorkingLabelAnimation_2.useRef)(null);
    (0, reactCanvasWorkingLabelAnimation_2.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value.current,
        current2: Dynamic = value2.current,
        current3: Dynamic = value3.current;
      if (!working || !current || !current2 || !current3) return;
      let value5: Dynamic =
          typeof matchMedia == "function"
            ? matchMedia("(prefers-reduced-motion: reduce)")
            : null,
        value6: Dynamic = animateWorkingLabel(
          current,
          current2,
          current3,
          value5?.matches === true,
        ),
        callback: Dynamic = (): Dynamic => {
          value6();
          value6 = animateWorkingLabel(
            current,
            current2,
            current3,
            value5?.matches === true,
          );
        };
      value5?.addEventListener?.("change", callback);
      return (): Dynamic => {
        value5?.removeEventListener?.("change", callback);
        value6();
      };
    }, [working]);
    let value4: Dynamic = "var(--cds-" + tint + "-500)";
    return (
      <div
        data-kit={"claude-working-empty-state"}
        data-working={working ? "true" : undefined}
        className={"mc-claude-empty flex flex-col items-center gap-3"}
      >
        <div className={"relative"} aria-busy={busy ? true : undefined}>
          <div
            className={"mc-claude-empty-idle flex flex-col items-center gap-3"}
            aria-hidden={working ? true : undefined}
          >
            {idle}
          </div>
          <div
            ref={value}
            className={"mc-claude-empty-working"}
            aria-hidden={"true"}
          >
            <div ref={value3} className={"mc-peer-cursor"}>
              <span
                className={"mc-peer-tag mc-cursor-chat"}
                style={{
                  background: value4,
                }}
              >
                {CanvasWorkingLabelAnimationLabel}
              </span>
            </div>
            <div ref={value2} className={"mc-peer-cursor"}>
              <runtime.PeerCursorGlyph color={value4} />
            </div>
          </div>
        </div>
        {action}
        {working ? (
          <span className={"sr-only"}>{CanvasWorkingLabelAnimationLabel}</span>
        ) : null}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactCanvasWorkingLabelAnimation",
    () => reactCanvasWorkingLabelAnimation,
    (value) => {
      reactCanvasWorkingLabelAnimation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactCanvasWorkingLabelAnimation_2",
    () => reactCanvasWorkingLabelAnimation_2,
    (value) => {
      reactCanvasWorkingLabelAnimation_2 = value;
    },
  );
  bindRuntimeValue(runtime, "createSeededRandom", () => createSeededRandom);
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationHandler",
    () => CanvasWorkingLabelAnimationHandler,
    (value) => {
      CanvasWorkingLabelAnimationHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationPow",
    () => CanvasWorkingLabelAnimationPow,
    (value) => {
      CanvasWorkingLabelAnimationPow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationHandler_2",
    () => CanvasWorkingLabelAnimationHandler_2,
    (value) => {
      CanvasWorkingLabelAnimationHandler_2 = value;
    },
  );
  bindRuntimeValue(runtime, "workingLabelPosition", () => workingLabelPosition);
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationReduce",
    () => CanvasWorkingLabelAnimationReduce,
    (value) => {
      CanvasWorkingLabelAnimationReduce = value;
    },
  );
  bindRuntimeValue(runtime, "workingLabelTravel", () => workingLabelTravel);
  bindRuntimeValue(runtime, "workingLabelSweep", () => workingLabelSweep);
  bindRuntimeValue(runtime, "workingLabelWander", () => workingLabelWander);
  bindRuntimeValue(
    runtime,
    "jsxCanvasWorkingLabelAnimation",
    () => jsxCanvasWorkingLabelAnimation,
    (value) => {
      jsxCanvasWorkingLabelAnimation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationLabel",
    () => CanvasWorkingLabelAnimationLabel,
    (value) => {
      CanvasWorkingLabelAnimationLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationConstant",
    () => CanvasWorkingLabelAnimationConstant,
    (value) => {
      CanvasWorkingLabelAnimationConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationConstant_2",
    () => CanvasWorkingLabelAnimationConstant_2,
    (value) => {
      CanvasWorkingLabelAnimationConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationConstant_3",
    () => CanvasWorkingLabelAnimationConstant_3,
    (value) => {
      CanvasWorkingLabelAnimationConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationConstant_4",
    () => CanvasWorkingLabelAnimationConstant_4,
    (value) => {
      CanvasWorkingLabelAnimationConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationConstant_5",
    () => CanvasWorkingLabelAnimationConstant_5,
    (value) => {
      CanvasWorkingLabelAnimationConstant_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationConstant_6",
    () => CanvasWorkingLabelAnimationConstant_6,
    (value) => {
      CanvasWorkingLabelAnimationConstant_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasWorkingLabelAnimationConstant_7",
    () => CanvasWorkingLabelAnimationConstant_7,
    (value) => {
      CanvasWorkingLabelAnimationConstant_7 = value;
    },
  );
  bindRuntimeValue(runtime, "animateWorkingLabel", () => animateWorkingLabel);
  bindRuntimeValue(runtime, "ClaudeWorkingLabel", () => ClaudeWorkingLabel);
  return () => {
    reactCanvasWorkingLabelAnimation = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactCanvasWorkingLabelAnimation_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    CanvasWorkingLabelAnimationHandler = (input?: Dynamic): Dynamic =>
      input < 0 ? 0 : input > 1 ? 1 : input;
    CanvasWorkingLabelAnimationPow = (input?: Dynamic): Dynamic => {
      let value: Dynamic = Math.pow(
        CanvasWorkingLabelAnimationHandler(input),
        0.86,
      );
      return value * value * value * (10 + value * (6 * value - 15));
    };
    CanvasWorkingLabelAnimationHandler_2 = (input?: Dynamic): Dynamic => {
      let value: Dynamic =
        CanvasWorkingLabelAnimationHandler(input) *
        (1 - CanvasWorkingLabelAnimationHandler(input));
      return 16 * value * value;
    };
    CanvasWorkingLabelAnimationReduce = (input?: Dynamic): Dynamic =>
      input.reduce(
        (input2?: Dynamic, options?: Dynamic): Dynamic =>
          Math.max(input2, options.t0 + options.T),
        0,
      );
    jsxCanvasWorkingLabelAnimation = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    // CucCut: user-facing copy calls the agent "the agent", not Claude.
    CanvasWorkingLabelAnimationLabel = "The agent is working\u2026";
    CanvasWorkingLabelAnimationConstant = 176;
    CanvasWorkingLabelAnimationConstant_2 = 56;
    CanvasWorkingLabelAnimationConstant_3 = 8;
    CanvasWorkingLabelAnimationConstant_4 = 1600;
    CanvasWorkingLabelAnimationConstant_5 = 76;
    CanvasWorkingLabelAnimationConstant_6 = 12;
    CanvasWorkingLabelAnimationConstant_7 = 14;
  };
}
