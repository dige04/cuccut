/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCollaborationPresenceComposer(
  runtime: RuntimeBindings,
): () => void {
  var CollaborationPresenceComposerJoin: Dynamic;
  function isPeerTextInput(input?: Dynamic): Dynamic {
    let value: Dynamic = input;
    return (
      value != null &&
      typeof value.tagName == "string" &&
      (/^(INPUT|TEXTAREA|SELECT)$/.test(value.tagName) ||
        value.isContentEditable === true)
    );
  }
  function usePresenceComposer({
    reporter: reporter,
    color: color,
    canOpen: canOpen,
    idleMs = runtime.CollaborationPeerCursorsConstant_3,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactCollaborationPeerCursors_3.useState)(false),
      [value3, value4]: Dynamic = (0,
      runtime.reactCollaborationPeerCursors_3.useState)(false),
      [value5, value6]: Dynamic = (0,
      runtime.reactCollaborationPeerCursors_3.useState)(""),
      [value7, value8]: Dynamic = (0,
      runtime.reactCollaborationPeerCursors_3.useState)(false),
      value9: Dynamic = (0, runtime.reactCollaborationPeerCursors_3.useRef)(
        undefined,
      ),
      [value10, value11]: Dynamic = (0,
      runtime.reactCollaborationPeerCursors_3.useState)(""),
      [value12, value13]: Dynamic = (0,
      runtime.reactCollaborationPeerCursors_3.useState)(null),
      value14: Dynamic = (0, runtime.reactCollaborationPeerCursors_3.useRef)(
        null,
      ),
      value15: Dynamic = (0, runtime.reactCollaborationPeerCursors_3.useRef)(
        false,
      );
    value15.current = value && !value3;
    let value16: Dynamic = (0, runtime.reactCollaborationPeerCursors_3.useRef)(
        null,
      ),
      value17: Dynamic = (0, runtime.reactCollaborationPeerCursors_3.useRef)(
        null,
      ),
      value18: Dynamic = (0, runtime.reactCollaborationPeerCursors_3.useRef)(
        null,
      ),
      value19: Dynamic = (0, runtime.reactCollaborationPeerCursors_3.useRef)(
        [],
      ),
      value20: Dynamic = (0, runtime.reactCollaborationPeerCursors_3.useRef)({
        reporter: reporter,
        canOpen: canOpen,
        idleMs: idleMs,
        color: color,
      });
    value20.current = {
      reporter: reporter,
      canOpen: canOpen,
      idleMs: idleMs,
      color: color,
    };
    let callback: Dynamic = (): Dynamic => {
        for (let value22 of value19.current as Dynamic) clearTimeout(value22);
        value19.current = [];
      },
      callback2: Dynamic = (): Dynamic => {
        callback();
        value20.current.reporter()?.say("");
        value4(true);
        clearTimeout(value9.current);
        value9.current = setTimeout((): Dynamic => {
          value2(false);
          value4(false);
          value6("");
          value8(false);
        }, runtime.CollaborationPeerCursorsDelayMs_2);
        let current: Dynamic = value18.current;
        value18.current = null;
        let activeElement: Dynamic = (document as Dynamic).activeElement;
        (activeElement === value17.current ||
          activeElement === null ||
          activeElement === (document as Dynamic).body) &&
          (document as Dynamic).hasFocus() &&
          current?.isConnected &&
          typeof current.focus == "function" &&
          current.focus();
        (document as Dynamic).activeElement === value17.current &&
          value17.current?.blur();
      },
      value21: Dynamic = (0, runtime.reactCollaborationPeerCursors_3.useRef)(
        callback2,
      );
    value21.current = callback2;
    let callback3: Dynamic = (): Dynamic => {
        callback();
        value8(false);
        let idleMs2: Dynamic = value20.current.idleMs;
        value19.current = [
          setTimeout((): Dynamic => value8(true), idleMs2),
          setTimeout(
            (): Dynamic => value21.current(),
            idleMs2 + runtime.CollaborationPeerCursorsConstant_4,
          ),
        ];
      },
      callback4: Dynamic = (input?: Dynamic): Dynamic => {
        value20.current
          .reporter()
          ?.say((0, runtime.normalizePeerMessage)(input).trim());
      };
    (0, runtime.reactCollaborationPeerCursors_3.useEffect)((): Dynamic => {
      let callback5: Dynamic = (input?: Dynamic): Dynamic => {
          value14.current = {
            x: input.clientX,
            y: input.clientY,
          };
          value15.current && value13(value14.current);
        },
        callback6: Dynamic = (event?: Dynamic): Dynamic => {
          if (
            event.key !== "/" ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            event.repeat ||
            event.defaultPrevented ||
            event.isComposing
          )
            return;
          let {
            reporter: current,
            canOpen: current2,
            color: current3,
          }: Dynamic = value20.current;
          if (
            isPeerTextInput(event.target) ||
            (current2 !== undefined && !current2(event))
          )
            return;
          if (value15.current) {
            (document as Dynamic).activeElement !== value17.current &&
              (event.preventDefault(), value17.current?.focus(), callback3());
            return;
          }
          if (current()?.live() !== true) return;
          event.preventDefault();
          value18.current = (document as Dynamic).activeElement;
          let value22: Dynamic = runtime.roomPeersStore
            .getSnapshot()
            .find((input?: Dynamic): Dynamic => input.sameTab);
          value11(
            (0, runtime.peerCollaboratorToken)(
              (0, runtime.peerCollaboratorIndex)(current3, value22?.peer ?? ""),
            ),
          );
          value13(value14.current);
          value6("");
          value8(false);
          clearTimeout(value9.current);
          value4(false);
          value2(true);
          callback3();
          value17.current?.focus();
        },
        flag: Dynamic = false,
        callback7: Dynamic = (event?: Dynamic): Dynamic => {
          if (event.key === "Escape") {
            if (!event.repeat) {
              let value22: Dynamic =
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                event.shiftKey;
              flag =
                value15.current &&
                !event.defaultPrevented &&
                !event.isComposing &&
                event.keyCode !== 229 &&
                !value22 &&
                !isPeerTextInput(event.target) &&
                !(0, runtime.hasBlockingOverlay)();
            }
            flag &&
              (event.preventDefault(),
              event.stopPropagation(),
              event.repeat || value21.current());
          }
        },
        callback8: Dynamic = (input?: Dynamic): Dynamic => {
          (input.type === "blur" || input.key === "Escape") && (flag = false);
        };
      (window as Dynamic).addEventListener("pointermove", callback5, true);
      (window as Dynamic).addEventListener("keydown", callback6);
      (window as Dynamic).addEventListener("keydown", callback7, true);
      (window as Dynamic).addEventListener("keyup", callback8, true);
      (window as Dynamic).addEventListener("blur", callback8);
      return (): Dynamic => {
        (window as Dynamic).removeEventListener("pointermove", callback5, true);
        (window as Dynamic).removeEventListener("keydown", callback6);
        (window as Dynamic).removeEventListener("keydown", callback7, true);
        (window as Dynamic).removeEventListener("keyup", callback8, true);
        (window as Dynamic).removeEventListener("blur", callback8);
      };
    }, []);
    (0, runtime.reactCollaborationPeerCursors_3.useEffect)(
      (): Dynamic => (): Dynamic => {
        for (let value22 of value19.current as Dynamic) clearTimeout(value22);
        clearTimeout(value9.current);
        value20.current.reporter()?.say("");
      },
      [],
    );
    (0, runtime.reactCollaborationPeerCursors_3.useLayoutEffect)(
      (): Dynamic => {
        let current: Dynamic = value16.current;
        if (!current) return;
        let value22: Dynamic = value12 ?? {
            x: (window as Dynamic).innerWidth / 2,
            y: (window as Dynamic).innerHeight / 2,
          },
          offsetWidth: Dynamic = current.offsetWidth,
          offsetHeight: Dynamic = current.offsetHeight,
          value23: Dynamic = Math.max(
            4,
            Math.min(
              value22.x + 10,
              (window as Dynamic).innerWidth - offsetWidth - 4,
            ),
          ),
          value24: Dynamic =
            value22.y + 16 + offsetHeight > (window as Dynamic).innerHeight - 4
              ? Math.max(4, value22.y - 12 - offsetHeight)
              : value22.y + 16;
        current.style.transform =
          "translate(" + value23 + "px," + value24 + "px)";
      },
    );
    return value ? (
      <div
        ref={value16}
        className={"mc-cursor-chat-self"}
        data-fading={value7 ? "true" : undefined}
        data-leaving={value3 ? "true" : undefined}
        style={{
          ...runtime.CollaborationPeerCursorsMcChatHoldMcChatFadeMcChatExitConfig,
          "--mc-chat-hold": idleMs + "ms",
        }}
      >
        <label
          className={"mc-cursor-chat"}
          style={{
            background: value10,
          }}
        >
          <span className={"mc-cursor-chat-sizer"} aria-hidden={"true"}>
            {value5 || " "}
          </span>
          <input
            ref={value17}
            className={"mc-cursor-chat-input"}
            aria-label={"Cursor chat"}
            autoFocus={true}
            autoComplete={"off"}
            spellCheck={false}
            size={1}
            readOnly={value3}
            value={value5}
            onChange={(event?: Dynamic): Dynamic => {
              callback3();
              let value22: Dynamic = CollaborationPresenceComposerJoin(
                event.target.value,
              );
              value6(value22);
              callback4(value22);
            }}
            onKeyDown={(event?: Dynamic): Dynamic => {
              value3 ||
                event.nativeEvent.isComposing ||
                (callback3(),
                event.key === "Escape"
                  ? (event.preventDefault(),
                    event.stopPropagation(),
                    value5 === ""
                      ? callback2()
                      : (value6(""), callback4(""), callback3()))
                  : event.key === "Enter"
                    ? (event.preventDefault(), value6(""))
                    : event.key === "/" &&
                      event.repeat &&
                      value5 === "" &&
                      event.preventDefault());
            }}
          />
        </label>
      </div>
    ) : null;
  }
  bindRuntimeValue(runtime, "isPeerTextInput", () => isPeerTextInput);
  bindRuntimeValue(
    runtime,
    "CollaborationPresenceComposerJoin",
    () => CollaborationPresenceComposerJoin,
    (value) => {
      CollaborationPresenceComposerJoin = value;
    },
  );
  bindRuntimeValue(runtime, "usePresenceComposer", () => usePresenceComposer);
  return () => {
    CollaborationPresenceComposerJoin = (input?: Dynamic): Dynamic =>
      Array.from(input)
        .slice(0, runtime.CollaborationPeerCursorsConstant_2)
        .join("");
  };
}
