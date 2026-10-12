/**
 * Reconstructed components subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 167221..172959.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */
/* @jsxRuntime classic */
/* @jsx renderJSX */
import { createElement as renderJSX, getReact, initializeField } from "./react";
import { reportError } from "./errors";
import type {
  RuntimeValue,
  Keyframe,
  PropsMetadata,
  ParsedDesignComponent,
  ComponentRegistry,
  StreamingTracker,
  RenderValues,
  TemplateContext,
  CompiledTemplate,
  DesignRuntime,
  RuntimeOptions,
} from "./types";
export var StreamableLogic: RuntimeValue = class {
  declare __host: RuntimeValue;
  declare state: RuntimeValue;
  declare props: RuntimeValue;
  constructor(props?: RuntimeValue) {
    initializeField(this, "props");
    initializeField(this, "state", {});
    initializeField(this, "__host");
    this.props = props || {};
  }
  setState(update?: RuntimeValue, callback?: RuntimeValue): RuntimeValue {
    this.__host && this.__host.__setLogicState(update, callback);
  }
  forceUpdate(): RuntimeValue {
    this.__host && this.__host.forceUpdate();
  }
  componentDidMount(): RuntimeValue {}
  componentDidUpdate(previousProps?: RuntimeValue): RuntimeValue {}
  componentWillUnmount(): RuntimeValue {}
  renderVals(): RuntimeValue {
    return {};
  }
};
export function evaluateLogicClass(javascript?: RuntimeValue): RuntimeValue {
  return new Function(
    "DCLogic",
    "StreamableLogic",
    "React",
    javascript +
      `
;return (typeof Component!=="undefined"&&Component)||undefined;`,
  )(StreamableLogic, StreamableLogic, getReact());
}
export function sameUserProps(
  current?: RuntimeValue,
  previous?: RuntimeValue,
): RuntimeValue {
  if (!previous) return false;
  const currentKeys: RuntimeValue = Object.keys(current).filter(
      (key?: RuntimeValue): RuntimeValue => key !== "children",
    ),
    previousKeys: RuntimeValue = Object.keys(previous).filter(
      (key?: RuntimeValue): RuntimeValue => key !== "children",
    );
  if (currentKeys.length !== previousKeys.length) return false;
  for (const key of currentKeys)
    if (current[key] !== previous[key]) return false;
  return true;
}
export var ErrorMessageComponent: RuntimeValue,
  errorMessageProps: RuntimeValue = (props?: RuntimeValue): RuntimeValue =>
    props.chrome
      ? {
          className: props.className,
          "data-omelette-chrome": "",
        }
      : {
          className: props.className,
        };
export function renderErrorMessage(props?: RuntimeValue): RuntimeValue {
  return ErrorMessageComponent ? (
    <ErrorMessageComponent {...props} />
  ) : (
    <div {...errorMessageProps(props)}>{props.message}</div>
  );
}
export function Placeholder({
  name: name,
  hintSize: hintSize,
  streaming: streaming,
  error: error,
}: RuntimeValue): RuntimeValue {
  const [width, height] = (hintSize || "100%,60px").split(","),
    message: RuntimeValue = error ? (name ? name + ": " : "") + error : null;
  return (
    <div
      className={"sc-placeholder" + (streaming ? " sc-streaming" : "")}
      style={{
        width: width.trim(),
        height: height && height.trim(),
      }}
      title={name}
    >
      {message
        ? renderErrorMessage({
            className: "sc-placeholder-error",
            message: message,
          })
        : null}
    </div>
  );
}
export function parseHintSize(hintSize?: RuntimeValue): RuntimeValue {
  if (!hintSize) return;
  const [width, height] = hintSize.split(",");
  return {
    minWidth: width.trim(),
    minHeight: height && height.trim(),
  };
}
export function createComponentFactory(
  registry?: RuntimeValue,
  fetchSibling?: RuntimeValue,
  ensureCompiled: RuntimeValue = (): RuntimeValue => {},
): RuntimeValue {
  const react: RuntimeValue = getReact();
  ErrorMessageComponent = class extends (
    (react.Component as new (
      ...args: RuntimeValue[]
    ) => import("react").Component<RuntimeValue, RuntimeValue>)
  ) {
    declare off: RuntimeValue;
    constructor() {
      super(...arguments);
      initializeField(this, "off");
    }
    componentDidMount(): RuntimeValue {
      this.off = reportError(this.props.message);
    }
    componentDidUpdate(previousProps?: RuntimeValue): RuntimeValue {
      previousProps.message !== this.props.message &&
        (this.off?.(), (this.off = reportError(this.props.message)));
    }
    componentWillUnmount(): RuntimeValue {
      this.off?.();
    }
    render(): RuntimeValue {
      return <div {...errorMessageProps(this.props)}>{this.props.message}</div>;
    }
  };
  const ancestryContext: RuntimeValue = react.createContext([]);
  class StreamableComponent extends (react.Component as new (
    ...args: RuntimeValue[]
  ) => import("react").Component<RuntimeValue, RuntimeValue>) {
    declare logic: RuntimeValue;
    declare __ctorError: RuntimeValue;
    declare __failedVer: RuntimeValue;
    declare __failedUserProps: RuntimeValue;
    declare __failedLogic: RuntimeValue;
    declare __htmlStreamingNow: RuntimeValue;
    declare __streamingNow: RuntimeValue;
    declare __needsDidMount: RuntimeValue;
    declare __sub: RuntimeValue;
    declare __name: RuntimeValue;
    constructor(props?: RuntimeValue) {
      super(props);
      initializeField(this, "__name");
      initializeField(this, "__sub");
      initializeField(this, "__needsDidMount", false);
      initializeField(this, "__streamingNow", false);
      initializeField(this, "__htmlStreamingNow", false);
      initializeField(this, "__failedLogic", null);
      initializeField(this, "__failedUserProps", null);
      initializeField(this, "__failedVer", -1);
      initializeField(this, "__ctorError", null);
      initializeField(this, "logic");
      this.__name = props.__name;
      this.state = {
        __v: 0,
        __err: null,
      };
      this.__sub = (): RuntimeValue => {
        this.state.__err &&
          this.setState({
            __err: null,
          });
        this.forceUpdate();
      };
      this.__makeLogic(registry.get(this.__name).Logic, null);
      fetchSibling(this.__name);
    }
    static getDerivedStateFromError(error?: RuntimeValue): RuntimeValue {
      return {
        __err:
          error instanceof Error && error.message
            ? error.message
            : String(error),
      };
    }
    componentDidCatch(error?: RuntimeValue, info?: RuntimeValue): RuntimeValue {
      console.error(
        "[dc-runtime] render error in <" + this.__name + ">:",
        error,
        info?.componentStack || "",
      );
    }
    __makeLogic(
      Logic?: RuntimeValue,
      previousState?: RuntimeValue,
    ): RuntimeValue {
      const LogicClass: RuntimeValue = Logic || StreamableLogic;
      try {
        this.logic = new LogicClass(this.__userProps());
        this.__failedLogic = null;
        this.__failedUserProps = null;
        this.__ctorError = null;
      } catch (error) {
        console.error(error);
        this.__failedLogic = Logic;
        this.__failedUserProps = this.__userProps();
        this.__failedVer = registry.get(this.__name).ver;
        this.__ctorError =
          this.__name +
          ": " +
          (error instanceof Error && error.message
            ? error.message
            : String(error));
        this.logic = new StreamableLogic(this.__userProps());
      }
      this.logic.__host = this;
      previousState &&
        (this.logic.state = {
          ...(this.logic.state || {}),
          ...previousState,
        });
    }
    __userProps(): RuntimeValue {
      const {
        __name: name,
        __hintSize: hintSize,
        __tplId: templateId,
        __hostStyle: hostStyle,
        ...userProps
      } = this.props;
      return userProps;
    }
    __setLogicState(
      update?: RuntimeValue,
      callback?: RuntimeValue,
    ): RuntimeValue {
      const previousState: RuntimeValue = this.logic.state,
        nextState: RuntimeValue =
          typeof update == "function" ? update(previousState) : update;
      this.logic.state = {
        ...previousState,
        ...nextState,
      };
      this.setState(
        (state?: RuntimeValue): RuntimeValue => ({
          __v: state.__v + 1,
        }),
        callback,
      );
    }
    __reconcileLogic(): RuntimeValue {
      const entry: RuntimeValue = registry.get(this.__name),
        Logic: RuntimeValue = entry.Logic,
        currentLogicClass: RuntimeValue = this.logic.constructor;
      if (
        !(
          Logic === currentLogicClass ||
          (!Logic && currentLogicClass === StreamableLogic) ||
          (Logic === this.__failedLogic &&
            entry.ver === this.__failedVer &&
            sameUserProps(this.__userProps(), this.__failedUserProps))
        )
      ) {
        if (!this.__needsDidMount)
          try {
            this.logic.componentWillUnmount();
          } catch (error) {
            console.error(error);
          }
        this.__makeLogic(Logic, this.logic.state);
        this.__needsDidMount = true;
      }
    }
    componentDidMount(): RuntimeValue {
      registry.get(this.__name).subs.add(this.__sub);
      try {
        this.logic.componentDidMount();
      } catch (error) {
        console.error(error);
      }
    }
    componentDidUpdate(previousProps?: RuntimeValue): RuntimeValue {
      if (((this.logic.props = this.__userProps()), this.__needsDidMount)) {
        if (this.state.__err || !registry.get(this.__name).tpl) return;
        this.__needsDidMount = false;
        try {
          this.logic.componentDidMount();
        } catch (error) {
          console.error(error);
        }
      } else
        try {
          this.logic.componentDidUpdate(previousProps);
        } catch (error) {
          console.error(error);
        }
    }
    componentWillUnmount(): RuntimeValue {
      if (
        (registry.get(this.__name).subs.delete(this.__sub),
        !this.__needsDidMount)
      )
        try {
          this.logic.componentWillUnmount();
        } catch (error) {
          console.error(error);
        }
    }
    render(): RuntimeValue {
      ensureCompiled(this.__name);
      const entry: RuntimeValue = registry.get(this.__name),
        className: RuntimeValue =
          "sc-host" +
          (entry.htmlStreaming ? " sc-streaming-html" : "") +
          (entry.jsStreaming ? " sc-streaming-js" : ""),
        placeholderStyle: RuntimeValue = entry.htmlStreaming
          ? parseHintSize(this.props.__hintSize)
          : undefined,
        hostStyle: RuntimeValue =
          this.props.__hostStyle || placeholderStyle
            ? {
                ...(placeholderStyle || {}),
                ...(this.props.__hostStyle || {}),
              }
            : undefined,
        hostProps: RuntimeValue = {
          className: className,
          style: hostStyle,
          "data-sc-name": this.__name,
          "data-dc-tpl": this.props.__tplId,
        },
        ancestry: RuntimeValue = Array.isArray(this.context)
          ? this.context
          : [];
      if (ancestry.includes(this.__name)) {
        const cycle: RuntimeValue = [
          ...ancestry.slice(ancestry.indexOf(this.__name)),
          this.__name,
        ].join(" \u2192 ");
        return (
          <div {...hostProps} className={className + " sc-has-error"}>
            <Placeholder
              name={this.__name}
              hintSize={this.props.__hintSize}
              error={"circular import: " + cycle}
            />
          </div>
        );
      }
      if (this.state.__err)
        return (
          <div {...hostProps} className={className + " sc-has-error"}>
            {renderErrorMessage({
              className: "sc-logic-error",
              message: this.__name + ": " + this.state.__err,
              chrome: true,
            })}
            <Placeholder
              name={this.__name}
              hintSize={this.props.__hintSize}
              error={this.state.__err}
            />
          </div>
        );
      if ((this.__reconcileLogic(), !entry.tpl))
        return (
          <div {...hostProps}>
            <Placeholder name={this.__name} hintSize={this.props.__hintSize} />
          </div>
        );
      const userProps: RuntimeValue = this.__userProps();
      this.logic.props = userProps;
      let renderValues: RuntimeValue = userProps,
        logicError: RuntimeValue = entry.logicError || this.__ctorError;
      try {
        renderValues = {
          ...userProps,
          ...(this.logic.renderVals() || {}),
        };
      } catch (error) {
        console.error(error);
        logicError =
          this.__name +
          ".renderVals(): " +
          (error instanceof Error && error.message
            ? error.message
            : String(error));
      }
      this.__streamingNow = !!(entry.htmlStreaming || entry.jsStreaming);
      this.__htmlStreamingNow = !!entry.htmlStreaming;
      return (
        <div
          {...hostProps}
          className={className + (logicError ? " sc-has-error" : "")}
        >
          {logicError &&
            renderErrorMessage({
              className: "sc-logic-error",
              message: logicError,
              chrome: true,
            })}
          <ancestryContext.Provider value={[...ancestry, this.__name]}>
            {entry.tpl(renderValues, this)}
          </ancestryContext.Provider>
        </div>
      );
    }
  }
  initializeField(StreamableComponent, "contextType", ancestryContext);
  const components: RuntimeValue = new Map();
  function getDC(name?: RuntimeValue): RuntimeValue {
    const existing: RuntimeValue = components.get(name);
    if (existing) return existing;
    function DesignComponent(props?: RuntimeValue): RuntimeValue {
      const [, setVersion] = react.useState(0);
      react.useEffect((): RuntimeValue => {
        const refresh: RuntimeValue = (): RuntimeValue =>
          setVersion((version?: RuntimeValue): RuntimeValue => version + 1);
        registry.get(name).subs.add(refresh);
        return (): RuntimeValue => {
          registry.get(name).subs.delete(refresh);
        };
      }, []);
      fetchSibling(name);
      return <StreamableComponent {...props} __name={name} />;
    }
    DesignComponent.displayName = name;
    components.set(name, DesignComponent);
    return DesignComponent;
  }
  return {
    getDC: getDC,
    StreamableComponent: StreamableComponent,
  };
}
