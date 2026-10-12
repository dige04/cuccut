/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsUseDcProps(
  runtime: RuntimeBindings,
): () => void {
  function useDcProps(input?: Dynamic): Dynamic {
    let {
        webviewRef: value,
        readyGen: value2,
        projectPath: value3,
        filePath: value4,
        enabled: value5,
      }: Dynamic = input,
      [value6, value7]: Dynamic = (0,
      runtime.reactComponentsPropCache.useState)({}),
      value8: Dynamic = (0, runtime.reactComponentsPropCache.useRef)(value6);
    value8.current = value6;
    let [value9, value10]: Dynamic = (0,
      runtime.reactComponentsPropCache.useState)(null),
      [value11, value12]: Dynamic = (0,
      runtime.reactComponentsPropCache.useState)(0),
      [value13, value14]: Dynamic = (0,
      runtime.reactComponentsPropCache.useState)({}),
      [value15, value16]: Dynamic = (0,
      runtime.reactComponentsPropCache.useState)(false),
      value17: Dynamic = (0, runtime.reactComponentsPropCache.useRef)(value5);
    value17.current = value5;
    let value18: Dynamic = (0, runtime.reactComponentsPropCache.useRef)(
      value11,
    );
    value18.current = value11;
    let value19: Dynamic = (0, runtime.reactComponentsPropCache.useCallback)(
      (input2?: Dynamic): Dynamic => {
        if (!value17.current) return;
        let value33: Dynamic = (0, runtime.normalizePropString)(
          input2.rootName,
        );
        value10(value33);
        value8.current = value33
          ? (0, runtime.parsePropsMetadata)(input2.propsMeta)
          : {};
        value7(value8.current);
        value12((input3?: Dynamic): Dynamic => input3 + 1);
      },
      [],
    );
    (0, runtime.reactComponentsPropCache.useEffect)((): Dynamic => {
      if (!value5 || value2 === 0) {
        value8.current = {};
        value7({});
        value10(null);
        return;
      }
      let value33: Dynamic = (0, runtime.createPreviewHandle)(value.current);
      if (!value33) return;
      let flag: Dynamic = false,
        current: Dynamic = value18.current,
        value34: Dynamic = null,
        callback: Dynamic = (): Dynamic => {
          flag ||
            value18.current !== current ||
            value33
              .executeJavaScript(
                "(function(){try{if(!window.__dcRootName)return null;var n=window.__dcRootName();var r=window.__dcRegistry&&window.__dcRegistry[n];if(!r)return null;return JSON.stringify({n:n,p:r.propsMeta||null})}catch(e){return null}})()",
              )
              .then((input2?: Dynamic): Dynamic => {
                if (flag || value18.current !== current) return;
                if (typeof input2 != "string") {
                  value34 = setTimeout(callback, 1e3);
                  return;
                }
                let value35: Dynamic = JSON.parse(input2);
                value19({
                  rootName: value35.n,
                  propsMeta: value35.p,
                });
              })
              .catch((): Dynamic => {
                !flag &&
                  value18.current === current &&
                  (value34 = setTimeout(callback, 1e3));
              });
        };
      value34 = setTimeout(callback, 1500);
      return (): Dynamic => {
        flag = true;
        value34 !== null && clearTimeout(value34);
      };
    }, [value5, value2, value, value19]);
    (0, runtime.reactComponentsPropCache.useEffect)((): Dynamic => {
      value14({});
      value8.current = {};
      value7({});
      value10(null);
      value12(0);
    }, [value4]);
    let value20: Dynamic = (0, runtime.reactComponentsPropCache.useRef)(
      value13,
    );
    value20.current = value13;
    (0, runtime.reactComponentsPropCache.useEffect)((): Dynamic => {
      if (!value5 || value11 === 0 || !value9) return;
      let value33: Dynamic = (0, runtime.createPreviewHandle)(value.current);
      if (!value33) return;
      let state: Dynamic = {};
      for (let [value35, value36] of Object.entries(value8.current) as Dynamic)
        (0, runtime.isEditablePropMetadata)(value36) &&
          value36.default !== undefined &&
          (state[value35] = value36.default);
      for (let [value35, value36] of Object.entries(value20.current) as Dynamic)
        value35 in value8.current && (state[value35] = value36);
      let value34: Dynamic = Object.keys(state).length
        ? JSON.stringify(state)
        : "null";
      value33.executeJavaScriptUnchecked(
        `window.__dcSetProps&&window.__dcSetProps(${JSON.stringify(value9)},${value34})`,
      );
    }, [value5, value11, value9, value13, value]);
    let value21: Dynamic = (0, runtime.reactComponentsPropCache.useRef)({
      projectPath: value3,
      filePath: value4,
    });
    value21.current = {
      projectPath: value3,
      filePath: value4,
    };
    let value22: Dynamic = (0, runtime.reactComponentsPropCache.useRef)(false),
      value23: Dynamic = (0, runtime.reactComponentsPropCache.useCallback)(
        (): Dynamic => value22.current,
        [],
      ),
      value24: Dynamic = (0, runtime.reactComponentsPropCache.useCallback)(
        (input2?: Dynamic): Dynamic => value8.current[input2]?.default,
        [],
      ),
      value25: Dynamic = (0, runtime.reactComponentsPropCache.useCallback)(
        (input2?: Dynamic, options?: Dynamic): Dynamic => {
          let { projectPath: current, filePath: current2 }: Dynamic =
            value21.current;
          current &&
            current2 &&
            (0, runtime.cacheUnsavedComponentProp)(
              current,
              current2,
              input2,
              options,
            );
          value14((input3?: Dynamic): Dynamic => {
            if (options === undefined) {
              if (!(input2 in input3)) return input3;
              let state: Dynamic = {
                ...input3,
              };
              delete state[input2];
              return state;
            }
            return {
              ...input3,
              [input2]: options,
            };
          });
        },
        [],
      ),
      value26: Dynamic = (0,
      runtime.reactComponentsPropCache.useCallback)((): Dynamic => {
        let { projectPath: current, filePath: current2 }: Dynamic =
          value21.current;
        current &&
          current2 &&
          (0, runtime.clearUnsavedComponentProps)(current, current2);
        value14({});
      }, []),
      value27: Dynamic = (0, runtime.reactComponentsPropCache.useMemo)(
        (): Dynamic =>
          Object.values(value6).some(runtime.isEditablePropMetadata),
        [value6],
      ),
      value28: Dynamic = (0,
      runtime.reactComponentsPropCache.useMemo)((): Dynamic => {
        for (let [value33, value34] of Object.entries(value13) as Dynamic)
          if (
            value33 in value6 &&
            !(0, runtime.equalPropValues)(value6[value33]?.default, value34)
          )
            return true;
        return false;
      }, [value13, value6]),
      value29: Dynamic = (0, runtime.reactComponentsPropCache.useRef)(
        input.onAdopted,
      );
    value29.current = input.onAdopted;
    let value30: Dynamic = (0, runtime.reactComponentsPropCache.useRef)(
      input.onWritten,
    );
    value30.current = input.onWritten;
    let value31: Dynamic = (0,
      runtime.reactComponentsPropCache
        .useCallback)(async (): Promise<Dynamic> => {
        let { projectPath: current, filePath: current2 }: Dynamic =
          value21.current;
        if (!current || !current2) return;
        value22.current = true;
        value16(true);
        let value33: Dynamic;
        try {
          let value34: Dynamic = `${current}/${current2}`,
            value35: Dynamic = runtime.projectFilesystem.readFileWithVersion
              ? await runtime.projectFilesystem.readFileWithVersion(value34)
              : {
                  content: await runtime.projectFilesystem.readFile(value34),
                  version: undefined,
                },
            content: Dynamic = value35.content,
            value36: Dynamic = (0, runtime.getDcPropsJson)(content);
          if (value36 == null) {
            console.error(
              "[dc-props] could not read data-props from",
              current2,
            );
            return;
          }
          let value37: Dynamic;
          try {
            value37 = JSON.parse(value36);
          } catch {
            console.error(
              "[dc-props] data-props is not valid JSON in",
              current2,
            );
            return;
          }
          if (
            value37 == null ||
            typeof value37 != "object" ||
            Array.isArray(value37)
          ) {
            console.error(
              "[dc-props] data-props is not an object in",
              current2,
            );
            return;
          }
          let value38: Dynamic = value37,
            current3: Dynamic = value8.current,
            state: Dynamic = {
              ...value20.current,
            };
          for (let [value40, value41] of Object.entries(state) as Dynamic) {
            if (!(value40 in current3)) continue;
            let value42: Dynamic = value38[value40] ?? current3[value40],
              value43: Dynamic =
                value42 && typeof value42 == "object" && !Array.isArray(value42)
                  ? value42
                  : {};
            value38[value40] = {
              ...value43,
              default: value41,
            };
          }
          let value39: Dynamic = (0, runtime.setDcPropsJson)(
            content,
            JSON.stringify(value38),
          );
          if (value39 == null) {
            console.error(
              "[dc-props] could not splice data-props in",
              current2,
            );
            return;
          }
          value35.version !== undefined &&
            !value35.isBase64 &&
            value29.current?.(current2, value35.version, content);
          value33 = value30.current?.(current2, value39);
          await runtime.projectFilesystem.writeFile(value34, value39);
          value33 = undefined;
          (0, runtime.markLocalFileChange)(current, current2);
          let state2: Dynamic = {};
          for (let [value40, value41] of Object.entries(state) as Dynamic)
            value40 in current3 && (state2[value40] = value41);
          (0, runtime.adoptComponentPropDefaults)(current, current2, state2);
          value21.current.projectPath === current &&
            value21.current.filePath === current2 &&
            ((value8.current = (0, runtime.applyComponentPropDefaults)(
              value8.current,
              state,
            )),
            value7(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.applyComponentPropDefaults)(input2, state),
            ),
            value14(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.omitUnchangedProps)(input2, state2),
            ));
        } catch (value34: Dynamic) {
          value33?.();
          console.error("[dc-props] save as defaults failed:", value34);
        } finally {
          value22.current = false;
          value16(false);
        }
      }, []),
      value32: Dynamic = (0, runtime.reactComponentsPropCache.useCallback)(
        (input2?: Dynamic): Dynamic => {
          let current: Dynamic = value8.current,
            value33: Dynamic = (0, runtime.normalizePropValues)(input2),
            state: Dynamic = {};
          for (let [value34, value35] of Object.entries(value33) as Dynamic)
            Object.hasOwn(current, value34) && (state[value34] = value35);
          if (Object.keys(state).length === 0) return;
          let { projectPath: current2, filePath: current3 }: Dynamic =
            value21.current;
          current2 &&
            current3 &&
            (0, runtime.adoptComponentPropDefaults)(current2, current3, state);
          value8.current = (0, runtime.applyComponentPropDefaults)(
            value8.current,
            state,
          );
          value7(
            (input3?: Dynamic): Dynamic =>
              (0, runtime.applyComponentPropDefaults)(input3, state),
          );
          value14(
            (input3?: Dynamic): Dynamic =>
              (0, runtime.omitUnchangedProps)(input3, state),
          );
        },
        [],
      );
    return value5
      ? {
          booted: value11 > 0,
          hasProps: value27,
          lifecycleCallbacks: {
            onDcBooted: value19,
          },
          propsMeta: value6,
          values: value13,
          setProp: value25,
          reset: value26,
          dirty: value28,
          saveAsDefaults: value31,
          adoptSavedDefaults: value32,
          saving: value15,
          isSaving: value23,
          currentDefault: value24,
        }
      : runtime.ComponentsPropValidationBootedHasPropsLifecycleCallbacksConfig;
  }
  bindRuntimeValue(runtime, "useDcProps", () => useDcProps);
  return () => {};
}
