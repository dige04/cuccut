/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelPublishing(
  runtime: RuntimeBindings,
): () => void {
  var ModelPublishingH1H2H3Config: Dynamic;
  var ModelPublishingHandler: Dynamic;
  async function publishModelChanges(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Promise<Dynamic> {
    let src: Dynamic = input.src,
      originalTemplate: Dynamic = input.originalTemplate,
      baseVersion: Dynamic = input.baseVersion,
      value2: Dynamic = value,
      value3: Dynamic =
        extra && "pendingScriptAtCall" in extra
          ? extra.pendingScriptAtCall
          : input.pendingScript,
      value4: Dynamic =
        extra && "pendingScriptBaseAtCall" in extra
          ? extra.pendingScriptBaseAtCall
          : input.pendingScriptBase,
      value5: Dynamic =
        extra && "pendingPropsAtCall" in extra
          ? extra.pendingPropsAtCall
          : input.pendingProps,
      value6: Dynamic =
        extra && "pendingPropsBaseAtCall" in extra
          ? extra.pendingPropsBaseAtCall
          : input.pendingPropsBase,
      callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value17: Dynamic = (0, runtime.replaceDcTemplate)(
          input2,
          options2,
          value2,
        );
        if (value3 !== undefined) {
          let value18: Dynamic = (0, runtime.parseDcHtmlDocument)(value17);
          value18 &&
            (value17 = (0, runtime.setDcScript)(value17, value18, value3));
        }
        if (value5 !== undefined) {
          let value18: Dynamic = (0, runtime.getPendingPropKeys)(
            value17,
            value5,
          );
          if (value18 == null)
            throw new Error(
              "data-props became unspliceable; prop edit kept pending",
            );
          value17 = value18;
        }
        return value17;
      };
    !extra?.hasQueuedSuccessor &&
      (value === undefined || input.model.serialize() === value2) &&
      input.pendingScript === value3 &&
      input.pendingProps === value5 &&
      (input.dirty = false);
    let value7: Dynamic = (0, runtime.parseDcHtmlDocument)(src);
    if (!value7) {
      input.dirty = true;
      return {
        kind: "failed",
        error: new Error("dc source is not parseable; edit kept pending"),
      };
    }
    if (
      value5 !== undefined &&
      (0, runtime.getPendingPropKeys)(src, value5) == null
    ) {
      input.dirty = true;
      return {
        kind: "failed",
        error: new Error(
          "data-props is not spliceable; prop edit kept pending",
        ),
      };
    }
    let callback2: Dynamic = (): Dynamic => {
        value3 !== undefined &&
          (input.pendingScript === value3
            ? ((input.pendingScript = undefined),
              (input.pendingScriptBase = undefined))
            : (input.pendingScriptBase = value3));
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        value5 !== undefined &&
          (input.pendingProps === value5
            ? ((input.pendingProps = undefined),
              (input.pendingPropsBase = undefined))
            : input.pendingProps === undefined
              ? (input.pendingPropsBase = undefined)
              : (input.pendingPropsBase =
                  (0, runtime.getDcPropsJson)(input2) ??
                  input.pendingPropsBase));
      },
      value8: Dynamic = callback(src, value7),
      value9: Dynamic =
        value8 === src &&
        extra.diskIsMirror === true &&
        extra.mirrored !== value8;
    if (value8 === src && !value9) {
      callback2();
      callback3(src);
      let value17: Dynamic = (0, runtime.getSavedPendingProps)(src, value5);
      input.originalTemplate = value2;
      return value17 !== undefined
        ? {
            kind: "noop",
            settledProps: value17,
          }
        : {
            kind: "noop",
          };
    }
    let value10: Dynamic = `${options}/${input.path}`,
      flag: Dynamic = false,
      value11: Dynamic =
        baseVersion !== undefined
          ? {
              occToken: baseVersion,
            }
          : undefined,
      value12: Dynamic =
        value11 !== undefined
          ? extra?.baselineAtCall?.occToken === value11.occToken
            ? extra.baselineAtCall
            : value11
          : extra?.baselineAtCall,
      value13: Dynamic;
    if (context.readWithVersion && !value9) {
      let value17: Dynamic = null;
      try {
        value17 = await context.readWithVersion(value10);
      } catch {}
      try {
        if (
          value17 &&
          !value17.isBase64 &&
          value17.content &&
          value17.content !== extra.mirrored
        ) {
          let value18: Dynamic = (0, runtime.parseDcHtmlDocument)(
            value17.content,
          );
          if (
            value18 &&
            value18.template === originalTemplate &&
            (value3 === undefined || value18.js === value4) &&
            (value5 === undefined ||
              (0, runtime.getDcPropsJson)(value17.content) === value6) &&
            (value17.version !== undefined &&
              ((value12 = {
                occToken: value17.version,
                content: value17.content,
              }),
              (value13 = value17.version),
              (input.baseVersion === undefined ||
                value17.version > input.baseVersion) &&
                (input.baseVersion = value17.version)),
            value17.content !== src &&
              ((input.src = value17.content),
              (value8 = callback(value17.content, value18)),
              (flag = true),
              value8 === value17.content))
          ) {
            callback2();
            callback3(value17.content);
            let value19: Dynamic = (0, runtime.getSavedPendingProps)(
              value17.content,
              value5,
            );
            return value19 !== undefined
              ? {
                  kind: "noop",
                  version: value17.version,
                  settledProps: value19,
                }
              : {
                  kind: "noop",
                  version: value17.version,
                };
          }
        }
      } catch (value18: Dynamic) {
        input.dirty = true;
        return {
          kind: "failed",
          error: value18,
          version: value13,
        };
      }
    }
    let value14: Dynamic;
    try {
      value14 = (
        await context.write(
          value10,
          value8,
          value12
            ? {
                baseline: value12,
              }
            : undefined,
        )
      )?.version;
    } catch (value17: Dynamic) {
      input.dirty = true;
      return {
        kind: "failed",
        error: value17,
        version: value13,
      };
    }
    input.src = value8;
    callback2();
    callback3(value8);
    let value15: Dynamic = (0, runtime.getSavedPendingProps)(value8, value5);
    input.originalTemplate = value2;
    input.carriedEditCount = 0;
    {
      let value17: Dynamic = value14 ?? value13;
      value17 !== undefined &&
        (input.baseVersion === undefined || value17 > input.baseVersion) &&
        (input.baseVersion = value17);
    }
    let value16: Dynamic = value14 ?? value13;
    try {
      let value17: Dynamic = await context.read(value10);
      if (value17 !== value8) {
        input.src = value17;
        let value18: Dynamic = (0, runtime.getSavedPendingProps)(
          value17,
          value5,
        );
        return flag
          ? {
              kind: "saved-adopted",
              saved: value17,
              rebased: true,
              version: value16,
              ...(value18 !== undefined
                ? {
                    settledProps: value18,
                  }
                : {}),
            }
          : {
              kind: "saved-adopted",
              saved: value17,
              version: value16,
              ...(value18 !== undefined
                ? {
                    settledProps: value18,
                  }
                : {}),
            };
      }
    } catch (value17: Dynamic) {
      console.warn("[dc-editor] post-save adopt read failed:", value17);
    }
    return flag
      ? {
          kind: "saved",
          rebased: true,
          version: value16,
          ...(value15 !== undefined
            ? {
                settledProps: value15,
              }
            : {}),
        }
      : {
          kind: "saved",
          version: value16,
          ...(value15 !== undefined
            ? {
                settledProps: value15,
              }
            : {}),
        };
  }
  bindRuntimeValue(runtime, "publishModelChanges", () => publishModelChanges);
  bindRuntimeValue(
    runtime,
    "ModelPublishingH1H2H3Config",
    () => ModelPublishingH1H2H3Config,
    (value) => {
      ModelPublishingH1H2H3Config = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelPublishingHandler",
    () => ModelPublishingHandler,
    (value) => {
      ModelPublishingHandler = value;
    },
  );
  return () => {
    ModelPublishingH1H2H3Config = {
      h1: "a heading",
      h2: "a heading",
      h3: "a heading",
      h4: "a heading",
      h5: "a heading",
      h6: "a heading",
      p: "a paragraph",
      a: "a link",
      button: "a button",
      img: "an image",
      li: "a list item",
      label: "a label",
      td: "a table cell",
      th: "a table cell",
      span: "a piece of text",
      div: "a block",
      section: "a section",
    };
    ModelPublishingHandler = (input?: Dynamic): Dynamic =>
      Object.hasOwn(ModelPublishingH1H2H3Config, input.toLowerCase())
        ? ModelPublishingH1H2H3Config[input.toLowerCase()]
        : "an element";
  };
}
