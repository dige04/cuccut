/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorCodeInspectorCodePanel(
  runtime: RuntimeBindings,
): () => void {
  var reactCodeInspectorCodePanel: Dynamic;
  function InspectorCodePanel({
    selKey: selKey,
    tids: tids,
    model: model,
    modelSig = "",
    readOnly = false,
    textareaRef: textareaRef,
    outline: outline,
    onSelectTid: onSelectTid,
    onHoverTid: onHoverTid,
    onEdits: onEdits,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactInspectorAnnotation.useState)(
        (): Dynamic => (0, runtime.selectionCodeText)(model, tids),
      ),
      [value3, value4]: Dynamic = (0,
      runtime.reactInspectorAnnotation.useState)([]),
      [value5, value6]: Dynamic = (0,
      runtime.reactInspectorAnnotation.useState)(null),
      value7: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(null),
      value8: Dynamic = (0, runtime.reactInspectorAnnotation.useCallback)(
        (input?: Dynamic): Dynamic => {
          value7.current = input;
          typeof textareaRef == "function"
            ? textareaRef(input)
            : textareaRef && (textareaRef.current = input);
        },
        [textareaRef],
      ),
      value9: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(new Map()),
      value10: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(false),
      value11: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(false),
      value12: Dynamic = (0, runtime.reactInspectorAnnotation.useMemo)(
        (): Dynamic => (): Dynamic => {
          let value30: Dynamic = (0, runtime.getSelectionCodeEntries)(
            model,
            tids,
          );
          value9.current = new Map(
            value30.entries.map(
              (input?: Dynamic): Dynamic => [input.key, input.value],
            ),
          );
          value2(
            (0, runtime.serializeSelectionCode)(value30.entries, value30.mixed),
          );
          value4((0, runtime.sharedInheritedTextStyle)(model, tids));
          value6(null);
          value11.current = false;
        },
        [model, tids],
      ),
      value13: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(null),
      callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        value13.current &&
          (window as Dynamic).clearTimeout(value13.current.timer);
        let value30: Dynamic = (window as Dynamic).setTimeout((): Dynamic => {
          value13.current = null;
          (0, runtime.announce)(input);
        }, options);
        value13.current = {
          sentence: input,
          timer: value30,
        };
      },
      value14: Dynamic = (0, runtime.reactInspectorAnnotation.useEffectEvent)(
        (): Dynamic => {
          value13.current &&
            callback(
              value13.current.sentence,
              runtime.CodePropertyCodeResolvedValue,
            );
        },
      );
    (0, runtime.reactInspectorAnnotation.useEffect)((): Dynamic => {
      value12();
      value14();
    }, [selKey]);
    (0, runtime.reactInspectorAnnotation.useEffect)((): Dynamic => {
      value10.current || value12();
    }, [modelSig, model]);
    let value15: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(null);
    (0, runtime.reactInspectorAnnotation.useEffect)(
      (): Dynamic => (): Dynamic => {
        value15.current != null &&
          (window as Dynamic).clearTimeout(value15.current);
      },
      [],
    );
    let callback2: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        let value30: Dynamic = (0, runtime.parseInspectorCode)(input);
        if (!value30.ok) {
          value6({
            line: value30.line,
            message: value30.message,
          });
          return;
        }
        value6(null);
        value11.current = false;
        let items: Dynamic = [];
        for (let [value31, value32] of value30.map as Dynamic)
          value9.current.get(value31) !== value32 &&
            items.push({
              prop: value31,
              value: value32,
            });
        for (let value31 of value9.current.keys() as Dynamic)
          value30.map.has(value31) ||
            items.push({
              prop: value31,
              value: null,
            });
        items.length !== 0 &&
          ((value9.current = value30.map),
          onEdits(items, {
            live: options,
          }));
      },
      value16: Dynamic = value5
        ? (0, runtime.sourceLineErrorAnnouncement)(value5.line, value5.message)
        : undefined,
      value17: Dynamic = (0, runtime.reactInspectorAnnotation.useId)();
    (0, runtime.useCodeErrorAnnouncement)(value16, value);
    let callback3: Dynamic = (input?: Dynamic): Dynamic => {
        value2(input);
        !readOnly &&
          ((value11.current = true),
          value15.current != null &&
            (window as Dynamic).clearTimeout(value15.current),
          (value15.current = (window as Dynamic).setTimeout(
            (): Dynamic => callback2(input, true),
            220,
          )));
      },
      value18: Dynamic = tids.length > 1,
      value19: Dynamic = value18 ? "these elements" : "this element",
      callback4: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        if (readOnly)
          return (
            (value18 ? "These elements are" : "This element is") +
            " read-only here."
          );
        if ((0, runtime.isTextStyleProperty)(input, options))
          return "This value is relative to its parent. Type one in the field instead.";
        if (/var\(|\{\{/i.test(options))
          return "This value depends on where it is read. Type one in the field instead.";
        let value30: Dynamic = (0, runtime.parseInspectorCode)(value);
        if (!value30.ok) return "Fix the marked line in the field first.";
        if (value30.map.has(input))
          return "The field already has a line for " + input + ".";
        if (!(0, runtime.parseInspectorCode)(input + ": " + options + ";").ok)
          return "This value can't be written as one line. Type one in the field instead.";
      },
      value20: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(null),
      value21: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(null),
      value22: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(0),
      callback5: Dynamic = (): Dynamic => [
        ...(value20.current?.querySelectorAll(
          "[data-inherited-set]:not(:disabled)",
        ) ?? []),
      ],
      callback6: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        if (callback4(input, options) !== undefined) return;
        let value30: Dynamic = Date.now();
        if (value30 - value22.current < 400) return;
        value22.current = value30;
        value15.current != null &&
          (window as Dynamic).clearTimeout(value15.current);
        let value31: Dynamic = value.split(`
`),
          value32: Dynamic = value31.findIndex(
            (input2?: Dynamic): Dynamic => input2.trim().startsWith("@"),
          ),
          value33: Dynamic = (value32 < 0 ? value31 : value31.slice(0, value32))
            .join(
              `
`,
            )
            .trimEnd(),
          value34: Dynamic =
            value32 < 0
              ? ""
              : value31.slice(value32).join(`
`);
        value21.current = callback5().findIndex(
          (input2?: Dynamic): Dynamic =>
            input2 === (document as Dynamic).activeElement,
        );
        callback2(
          [value33, input + ": " + options + ";"].filter(
            (input2?: Dynamic): Dynamic => input2 !== "",
          ).join(`
`) +
            (value34 === ""
              ? ""
              : `

` + value34),
          false,
        );
        value12();
      };
    (0, runtime.reactInspectorAnnotation.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value21.current;
      value21.current = null;
      if (current == null || current < 0) return;
      let value30: Dynamic = callback5();
      value30[Math.min(current, value30.length - 1)]?.focus();
    }, [value3]);
    let value23: Dynamic = (0, runtime.reactInspectorAnnotation.useRef)(null),
      [value24, value25]: Dynamic = (0,
      runtime.reactInspectorAnnotation.useState)(0);
    (0, runtime.reactInspectorAnnotation.useEffect)((): Dynamic => {
      let current: Dynamic = value23.current;
      if (!current || typeof ResizeObserver === "undefined") return;
      let observer: Dynamic = new ResizeObserver(
        (): Dynamic => value25(current.clientWidth),
      );
      observer.observe(current);
      return (): Dynamic => observer.disconnect();
    }, []);
    let value26: Dynamic =
      typeof CSS !== "undefined" &&
      CSS.supports?.("field-sizing", "content") === true;
    (0, runtime.reactInspectorAnnotation.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value7.current;
      if (!current || value26) return;
      let value30: Dynamic = value23.current?.scrollTop ?? 0;
      current.style.height = "auto";
      current.style.height = String(current.scrollHeight) + "px";
      value23.current && (value23.current.scrollTop = value30);
    }, [value, value24, value26]);
    let value27: Dynamic =
        tids.length === 1
          ? (0, runtime.findInspectorOutlineNode)(outline, tids[0])
          : null,
      value28: Dynamic = tids.length === 1 ? model.tagName?.(tids[0]) : null,
      value29: Dynamic = "Nothing set on " + value19;
    return (
      <div
        data-testid={"dc-code-pane"}
        className={"relative flex min-h-[10rem] flex-1 flex-col"}
      >
        <div
          ref={value23}
          className={
            "flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2 " +
            runtime.ChromeScrollbarLabel
          }
          onMouseDown={(event?: Dynamic): Dynamic => {
            event.target !== event.currentTarget ||
              !value7.current ||
              (event.preventDefault(),
              value7.current.focus(),
              value7.current.setSelectionRange(value.length, value.length));
          }}
        >
          {value28 && (
            <div
              data-testid={"dc-code-subject"}
              className={
                "truncate px-3.5 pt-2.5 font-mono text-[11px] text-muted select-none"
              }
            >
              {"<" + value28 + ">"}
              {value27?.detail ? (
                <span className={"ml-2 font-sans"}>{value27.detail}</span>
              ) : null}
            </div>
          )}
          <textarea
            ref={value8}
            data-testid={"dc-code-text"}
            value={value}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize={"off"}
            autoCorrect={"off"}
            aria-label={"CSS and attributes"}
            aria-invalid={value5 != null}
            aria-describedby={value16 === undefined ? undefined : value17}
            title={
              value5
                ? "Line " + String(value5.line) + ": " + value5.message
                : undefined
            }
            onChange={(event?: Dynamic): Dynamic =>
              callback3(event.target.value)
            }
            onFocus={(): Dynamic => {
              value10.current = true;
            }}
            onBlur={(): Dynamic => {
              value10.current = false;
              value15.current != null &&
                ((window as Dynamic).clearTimeout(value15.current),
                (value15.current = null));
              callback2(value, false);
              let value30: Dynamic = (0, runtime.parseInspectorCode)(value);
              !value30.ok &&
                value11.current &&
                callback(
                  (0, runtime.discardedCodeChangesAnnouncement)(value30.line),
                  runtime.CodePropertyCodeConstant_2,
                );
              value12();
            }}
            onKeyDown={(input?: Dynamic): Dynamic => {
              input.stopPropagation();
              input.key === "Escape" && input.currentTarget.blur();
            }}
            className={
              "block min-h-[6rem] w-full shrink-0 resize-none overflow-hidden border-0 bg-transparent px-3.5 py-3 [field-sizing:content] supports-[field-sizing:content]:min-h-[4.5rem] font-mono text-[11.5px] leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere] text-primary outline-none [tab-size:2] " +
              (value5 ? "shadow-[inset_-3px_0_0_#b42318]" : "")
            }
            placeholder={
              tids.length === 0
                ? "Select an element to see its CSS."
                : readOnly
                  ? value29 + "."
                  : value29 +
                    ` yet.
Type  color: red;  to style ` +
                    (value18 ? "them" : "it") +
                    "."
            }
          />
          <div ref={value20} className={"contents"}>
            <runtime.ClassStyleTargets
              groups={value3}
              outline={outline}
              many={value18}
              lockFor={callback4}
              onSet={callback6}
              onSelectTid={onSelectTid}
              onHoverTid={onHoverTid}
            />
          </div>
        </div>
        <runtime.FloatingScrollbar target={value23} />
        {value16 !== undefined && (
          <span id={value17} hidden={true}>
            {value16}
          </span>
        )}
      </div>
    );
  }
  bindRuntimeValue(runtime, "InspectorCodePanel", () => InspectorCodePanel);
  bindRuntimeValue(
    runtime,
    "reactCodeInspectorCodePanel",
    () => reactCodeInspectorCodePanel,
    (value) => {
      reactCodeInspectorCodePanel = value;
    },
  );
  return () => {
    (0, runtime.initializeNpm_usehooks_ts_p0)();
    reactCodeInspectorCodePanel = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
  };
}
